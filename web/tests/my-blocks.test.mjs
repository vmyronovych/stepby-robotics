import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Blockly} from '../src/usb-blocks.js';
import {getMyBlocks,changeMyBlocks,callState} from '../src/my-blocks.js';
import {compileUsb,compileUsbState} from '../src/usb-compiler.js';
import {compileUsbBytecode} from '../src/usb-bytecode.js';
const chain=(...blocks)=>blocks.reduceRight((next,b)=>({...b,...(next?{next:{block:next}}:{})}),null);
const pin=(pin,state)=>({type:'usb_pin_write',fields:{PIN:String(pin),STATE:state}});
const wait=n=>({type:'robot_wait',inputs:{TIME:{shadow:{type:'math_number',fields:{NUM:n}}}}});
const definitions=[{id:'left',name:'Лівий мотор',body:chain(pin(17,'OFF'),pin(16,'ON'))},{id:'both',name:'Обидва мотори',body:chain(callState('left'),pin(19,'OFF'),pin(18,'ON'))}];
const program=(body=chain(callState('both'),wait(.01),callState('left')),defs=definitions)=>({myBlocks:defs,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:body}}]}});
function load(state){const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,w);return w;}catch(e){w.dispose();throw e;}}
const dir=mkdtempSync(path.join(tmpdir(),'mcar-custom-'));
before(()=>{const r=spawnSync('c++',['-std=c++17',path.resolve('../firmware/tests/usb_vm_runner.cpp'),'-o',path.join(dir,'vm')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);});
after(()=>rmSync(dir,{recursive:true,force:true}));
test('nested user commands execute in order in the real VM and local compiler',()=>{
 const w=load(program());try{
  const code=compileUsb(w),payload=compileUsbBytecode(w);assert.match(code,/mcarWrite\(17, false\);\n mcarWrite\(16, true\);/);
  assert.equal(compileUsbState(program()),code);
  const file=path.join(dir,'program.bin');writeFileSync(file,payload.bytes);const r=spawnSync(path.join(dir,'vm'),[file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout,'WRITE 17 0\nWRITE 16 1\nWRITE 19 0\nWRITE 18 1\nWRITE 17 0\nWRITE 16 1\nDONE\n');
 }finally{w.dispose();}
});
test('round trip keeps library, repeated calls and edited definitions; clearing project clears library',()=>{
 const w=load(program()),again=load(Blockly.serialization.workspaces.save(w));try{
  assert.deepEqual(compileUsbBytecode(w).bytes,compileUsbBytecode(again).bytes);
  const defs=structuredClone(getMyBlocks(w));defs[0].name='Новий лівий';defs[0].body=pin(23,'ON');changeMyBlocks(w,defs);
  assert.equal(w.getAllBlocks().find(b=>b.type==='my_block_call'&&b.definitionId==='left').getFieldValue('NAME'),'Новий лівий');
  assert.equal(compileUsbBytecode(w).code.filter(i=>i.op==='o'&&i.value===23).length,2);
  Blockly.serialization.workspaces.load({blocks:{blocks:[{type:'usb_start'}]}},w);assert.deepEqual(getMyBlocks(w),[]);
 }finally{w.dispose();again.dispose();}
});
test('rejects direct/indirect recursion, missing definitions, duplicate names and empty definitions',()=>{
 for(const defs of [[{id:'a',name:'А',body:callState('a')}],[{id:'a',name:'А',body:callState('b')},{id:'b',name:'Б',body:callState('a')}],[{id:'a',name:'А',body:callState('missing')}],[{id:'a',name:'А',body:wait(1)},{id:'b',name:'а',body:wait(1)}],[{id:'a',name:'А',body:null}]])assert.throws(()=>load(program(callState('a'),defs)));
 const w=load({blocks:{blocks:[{type:'usb_start',next:{block:callState('missing')}}]}});try{assert.throws(()=>compileUsbBytecode(w),/не знайдено/);}finally{w.dispose();}
});
test('bounds expanded programs and reports the visible call for errors inside a definition',()=>{
 const bad=program(callState('left'),[{id:'left',name:'Помилка',body:{type:'robot_wait'}}]);const w=load(bad);try{const call=w.getAllBlocks().find(b=>b.type==='my_block_call');assert.throws(()=>compileUsbBytecode(w),e=>e.blockId===call.id&&/порожнє/.test(e.message));}finally{w.dispose();}
 const many=Array.from({length:8},(_,i)=>({id:String(i),name:`Блок ${i}`,body:i===0?wait(1):chain(...Array.from({length:4},()=>callState(String(i-1))))}));
 const big=load(program(callState('7'),many));try{assert.throws(()=>compileUsbBytecode(big),/завелика|256/);}finally{big.dispose();}
});
test('raw server input checks GPIOs inside definitions and never injects user names into C++',()=>{
 assert.throws(()=>compileUsbState(program(callState('a'),[{id:'a',name:'А',body:pin(34,'ON')}])),/пін/);
 const source=compileUsbState(program(callState('a'),[{id:'a',name:'bad(); //',body:wait(1)}]));assert.doesNotMatch(source,/bad\(\)/);
});

const param=(id,name,kind='number',defaultValue=0)=>({id,name,kind,defaultValue});
const ref=(definitionId,p)=>({type:'my_block_parameter',extraState:{definitionId,parameterId:p.id,kind:p.kind,name:p.name}});
const arg=(value)=>({block:typeof value==='number'?{type:'math_number',fields:{NUM:value}}:value});
const gpio=n=>({type:'my_block_pin',fields:{PIN:String(n)}});
const call=(id,args)=>({...callState(id),inputs:Object.fromEntries(Object.entries(args).map(([k,v])=>[`ARG_${k}`,arg(v)]))});
function runVm(w){const file=path.join(dir,'parameters.bin');writeFileSync(file,compileUsbBytecode(w).bytes);const r=spawnSync(path.join(dir,'vm'),[file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
test('parameterized GPIO and speed calls execute independently and survive project reload',()=>{
 const speed=param('speed','Швидкість'),port=param('port','Пін','pin',25);
 const defs=[{id:'motor',name:'Мотор',parameters:[port,speed],body:{type:'usb_pin_pwm',fields:{PIN:'param:port'},inputs:{DUTY:arg(ref('motor',speed))}}}];
 const state=program(chain(call('motor',{port:gpio(25),speed:128}),call('motor',{port:gpio(26),speed:200})),defs);
 const w=load(state),again=load(Blockly.serialization.workspaces.save(w));try{
  assert.equal(runVm(w),'PWM 25 128\nPWM 26 200\nDONE\n');assert.deepEqual(compileUsbBytecode(w).bytes,compileUsbBytecode(again).bytes);assert.match(compileUsbState(state),/mcarPwm\(26,/);
 }finally{w.dispose();again.dispose();}
});
test('numeric arguments capture values once; nested calls do not overwrite caller parameters',()=>{
 const speed=param('speed','Швидкість');
 const set=n=>({type:'variables_set',fields:{VAR:{id:'user'}},inputs:{VALUE:arg(n)}});
 const out=(id,pin)=>({type:'usb_pin_pwm',fields:{PIN:String(pin)},inputs:{DUTY:arg(ref(id,speed))}});
 const defs=[{id:'inner',name:'Вкладена',parameters:[speed],body:out('inner',26)},{id:'outer',name:'Зовнішня',parameters:[speed],body:chain(set(200),out('outer',25),call('inner',{speed:90}),out('outer',25))}];
 const state=program(chain(set(70),call('outer',{speed:{type:'variables_get',fields:{VAR:{id:'user'}}}})),defs);state.variables=[{id:'user',name:'Швидкість',type:''}];
 const w=load(state);try{assert.equal(runVm(w),'PWM 25 70\nPWM 26 90\nPWM 25 70\nDONE\n');}finally{w.dispose();}
});
test('boolean parameter controls branches and GPIO arguments pass through nested calls',()=>{
 const port=param('port','Пін','pin',25),direction=param('forward','Вперед','boolean',true);
 const write=state=>({type:'usb_pin_write',fields:{PIN:'param:port',STATE:state}});
 const defs=[{id:'inner',name:'Стан',parameters:[port,direction],body:{type:'controls_if',extraState:{hasElse:true},inputs:{IF0:arg(ref('inner',direction)),DO0:arg(write('ON')),ELSE:arg(write('OFF'))}}},{id:'outer',name:'Мотор',parameters:[port,direction],body:call('inner',{port:ref('outer',port),forward:ref('outer',direction)})}];
 const w=load(program(call('outer',{port:gpio(26),forward:{type:'logic_boolean',fields:{BOOL:'FALSE'}}}),defs));try{assert.equal(runVm(w),'WRITE 26 0\nDONE\n');}finally{w.dispose();}
});
test('rejects unsupported GPIO through parameters, foreign references and malformed signatures',()=>{
 const port=param('port','Пін','pin',25),speed=param('speed','Швидкість');
 const def={id:'motor',name:'Мотор',parameters:[port],body:{type:'usb_pin_write',fields:{PIN:'param:port',STATE:'ON'}}};
 const w=load(program(call('motor',{port:gpio(34)}),[def]));try{assert.throws(()=>compileUsbBytecode(w),/GPIO34 не підтримує/);}finally{w.dispose();}
 assert.throws(()=>compileUsbState(program(callState('motor'),[{...def,body:{type:'robot_wait',inputs:{TIME:arg(ref('other',speed))}}}])),/параметр/);
 assert.throws(()=>load(program(callState('motor'),[{...def,parameters:[port,port]}])),/ідентифікатори/);
 assert.throws(()=>compileUsbState(program({type:'usb_pin_write',fields:{PIN:'param:port',STATE:'ON'}},[])),/лише всередині/);
});
test('adding and renaming parameters preserves existing arguments and defaults new ones',()=>{
 const speed=param('speed','Швидкість','number',128),def={id:'motor',name:'Мотор',parameters:[speed],body:{type:'usb_pin_pwm',fields:{PIN:'25'},inputs:{DUTY:arg(ref('motor',speed))}}};
 const w=load(program(call('motor',{speed:99}),[def]));try{
  const defs=structuredClone(getMyBlocks(w));defs[0].parameters[0].name='Потужність';defs[0].parameters.push(param('unused','Пауза','number',2));changeMyBlocks(w,defs);
  const b=w.getAllBlocks().find(b=>b.type==='my_block_call');assert.equal(b.getInputTargetBlock('ARG_speed').getFieldValue('NUM'),99);assert.equal(b.getInputTargetBlock('ARG_unused').getFieldValue('NUM'),2);assert.equal(runVm(w),'PWM 25 99\nDONE\n');
 }finally{w.dispose();}
});
test('new parameters on nested existing calls get defaults, copied definitions own their parameters',async()=>{
 const speed=param('speed','Швидкість','number',77);
 const defs=[{id:'inner',name:'Мотор',parameters:[speed],body:{type:'usb_pin_pwm',fields:{PIN:'25'},inputs:{DUTY:arg(ref('inner',speed))}}},{id:'outer',name:'Два мотори',body:chain(callState('inner'),callState('inner'))}];
 const w=load(program(callState('outer'),defs));try{assert.equal(runVm(w),'PWM 25 77\nPWM 25 77\nDONE\n');}finally{w.dispose();}
 const {duplicateDefinition,validateLibrary}=await import('../src/my-blocks.js');const copy=duplicateDefinition(defs,'inner');validateLibrary([...defs,copy]);assert.equal(copy.body.inputs.DUTY.block.extraState.definitionId,copy.id);assert.equal(copy.parameters[0].id,'speed');
});
test('rejects invalid parameter GPIO constants in imported definitions before dropdown coercion',()=>{
 const port=param('port','Пін','pin',25);
 const defs=[{id:'inner',name:'Стан',parameters:[port],body:pin(25,'ON')},{id:'outer',name:'Мотор',parameters:[port],body:call('inner',{port:{type:'my_block_pin',fields:{PIN:'param:port'}}})}];
 assert.throws(()=>compileUsbState(program(callState('outer'),defs)),/Параметр піна/);
});
test('nested saved calls reject argument kind mismatches before inlining',()=>{
 const condition=param('yes','Вперед','boolean',true);
 const defs=[{id:'inner',name:'Умова',parameters:[condition],body:pin(25,'ON')},{id:'outer',name:'Обгортка',body:call('inner',{yes:5})}];
 const w=load(program(callState('outer'),defs));try{assert.throws(()=>compileUsbBytecode(w),/тип параметра/);}finally{w.dispose();}
});
