import test from 'node:test';
import assert from 'node:assert/strict';
import {Blockly} from '../src/usb-blocks.js';
import {analyzeWiring,validateWiring,wiringImpact} from '../src/wiring-model.js';
import {getWiring,changeWiring,inheritWiring} from '../src/wiring-state.js';
import {compileUsbState,compileUsb} from '../src/usb-compiler.js';
import {compileUsbBytecode} from '../src/usb-bytecode.js';
import {fixture,program,wired} from './wiring-fixture.mjs';
const load=state=>{const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,w);return w;}catch(e){w.dispose();throw e;}};
const wire=(a,b,id='extra')=>({id,a,b,color:'#ff0000'});
const codes=s=>analyzeWiring(s).issues.map(i=>i.code);
test('connected motor circuit has named GPIOs but retains unknown hardware qualifications',()=>{
 const result=analyzeWiring(fixture());assert.deepEqual(result.issues.filter(i=>i.severity==='error'||i.severity==='incomplete'),[]);
 assert.equal(result.bindings.find(b=>b.ref==='drv:IN1').gpio,16);assert.equal(result.bindings.find(b=>b.ref==='drv:IN1').label,'Лівий мотор · IN1');
 assert.ok(!result.issues.some(i=>i.code==='sleep'));assert.ok(result.issues.some(i=>i.code==='motor-rating'));assert.ok(result.issues.some(i=>i.code==='battery-voltage'));
 const fault=fixture();fault.wires.push(wire('drv:FAULT','esp:left-4'));assert.ok(codes(fault).includes('fault-pullup'));
});
test('net analysis catches transitive shorts, source conflicts, output-only connections and wrong motor pairs',()=>{
 for(const [a,b,code]of [['battery:PLUS','esp:left-13','short'],['battery:PLUS','esp:left-18','usb-backfeed'],['motor:A','esp:right-11','motor-gpio'],['drv:OUT1','drv:OUT2','output-conflict'],['esp:right-11','esp:right-0','gpio-ground'],['esp:left-15','drv:IN1','reserved']]){
  const s=fixture();s.wires.push(wire(a,b));assert.ok(codes(s).includes(code),code);
 }
 const input=fixture();input.wires.find(w=>w.b==='drv:IN1').a='esp:left-4';assert.ok(codes(input).includes('input-only'));
 const wrong=fixture();wrong.wires.find(w=>w.b==='motor:B').a='drv:OUT3';assert.ok(codes(wrong).includes('motor-pair'));
 const ground=fixture();ground.wires=ground.wires.filter(w=>w.a!=='esp:left-13');assert.ok(codes(ground).includes('ground'));
});
test('named GPIO recompiles after rewiring, including inside a user-defined command; disconnected references fail',()=>{
 const state=program();state.myBlocks=[{id:'forward',name:'Вперед',body:wired('drv:IN1','pwm')}];state.blocks.blocks[0].next.block={type:'my_block_call',extraState:{definitionId:'forward'}};
 const w=load(state);try{
  assert.match(compileUsb(w),/mcarPwm\(16, 180/);assert.equal(compileUsbBytecode(w).code.find(i=>i.op==='p').value,16);
  const next=fixture();next.wires.find(w=>w.b==='drv:IN1').a='esp:right-1';
  const impact=wiringImpact(fixture(),next,state);assert.deepEqual(impact.map(i=>[i.owner,i.from,i.to]),[['Вперед',16,23]]);
  changeWiring(w,next);assert.match(compileUsb(w),/mcarPwm\(23, 180/);assert.equal(compileUsbBytecode(w).code.find(i=>i.op==='p').value,23);
  const again=load(Blockly.serialization.workspaces.save(w));try{assert.deepEqual(compileUsbBytecode(w).bytes,compileUsbBytecode(again).bytes);}finally{again.dispose();}
  next.wires=next.wires.filter(w=>w.b!=='drv:IN1');changeWiring(w,next);assert.throws(()=>compileUsbBytecode(w),/немає придатного GPIO/);
 }finally{w.dispose();}
});
test('server compile accepts schema metadata but rejects unsafe wiring and corrupt endpoints before upload',()=>{
 assert.match(compileUsbState(program()),/mcarPwm\(16, 180/);
 const bad=fixture();bad.wires.push(wire('battery:PLUS','esp:left-13'));assert.throws(()=>compileUsbState(program(bad)),/Перевір підключення/);
 const corrupt=fixture();corrupt.wires[0].b='missing:USB';assert.throws(()=>validateWiring(corrupt),/Провід/);
 const duplicate=fixture();duplicate.wires.push({...duplicate.wires[0],id:'other'});assert.throws(()=>validateWiring(duplicate),/Провід/);
 const malformed=fixture();malformed.components[0].x=Infinity;assert.throws(()=>validateWiring(malformed));
});
test('expansion signal routing requires a host without a confirmation checkbox; power remains unknown',()=>{
 const s=fixture();s.components.push({id:'ext',kind:'expansion',name:'Розширення',x:1100,y:500,host:'esp',signalsVerified:false});s.wires.find(w=>w.b==='drv:IN1').a='ext:S16';
 assert.equal(analyzeWiring(s).bindings.find(b=>b.ref==='drv:IN1').gpio,16);
 s.components.at(-1).signalsVerified=true;assert.equal(analyzeWiring(s).bindings.find(b=>b.ref==='drv:IN1').gpio,16);assert.ok(codes(s).includes('expansion-power'));
});
test('definition editor inherits schema; loading an older project clears the schema without remapping raw GPIO',()=>{
 const w=load(program()),child=new Blockly.Workspace();try{
  inheritWiring(child,w);assert.equal(getWiring(child).wires.length,8);
  Blockly.serialization.workspaces.load({blocks:{blocks:[{type:'usb_start',next:{block:{type:'usb_pin_write',fields:{PIN:'16',STATE:'ON'}}}}]}},w);
  assert.equal(getWiring(w).components.length,0);assert.equal(getWiring(child).components.length,0);assert.match(compileUsb(w),/mcarWrite\(16, true/);
 }finally{child.dispose();w.dispose();}
});
test('wire routes leave terminals outwards and avoid every component interior',async()=>{
 const {routeWire}=await import('../src/wiring-route.js');
 const rects=[{x:100,y:100,width:280,height:230},{x:600,y:100,width:280,height:230}];
 const a={x:103,y:160,side:'left'},b={x:603,y:180,side:'left'},points=routeWire(a,b,rects);
 assert.ok(points[1].x<a.x);assert.ok(points.at(-2).x<b.x);
 for(let i=2;i<points.length-1;i++){const p=points[i-1],q=points[i];assert.ok(p.x===q.x||p.y===q.y);for(const r of rects){const intersects=p.y===q.y?p.y>r.y&&p.y<r.y+r.height&&Math.max(p.x,q.x)>r.x&&Math.min(p.x,q.x)<r.x+r.width:p.x>r.x&&p.x<r.x+r.width&&Math.max(p.y,q.y)>r.y&&Math.min(p.y,q.y)<r.y+r.height;assert.equal(intersects,false);}}
});

test('mounted expansion exposes physical S/V/G pins, resolves profile signals and migrates old wires without loss',async()=>{
 const {ports,mountLegacyExpansions}=await import('../src/wiring-model.js');
 const {physicalLayout}=await import('../src/wiring-physical.js');
 const state=fixture(),esp=state.components[0];esp.expansion='esp32s-38p';esp.signalsVerified=true;
 const signal=ports(esp).find(p=>p.id.startsWith('exp-')&&p.role==='breakout'&&p.gpio===16);
 state.wires.find(w=>w.b==='drv:IN1').a=`esp:${signal.id}`;
 assert.equal(analyzeWiring(state).bindings.find(b=>b.ref==='drv:IN1').gpio,16);
 assert.deepEqual(analyzeWiring(state).issues.filter(i=>i.severity==='error'),[]);
 const ws=load(program(state));try{assert.match(compileUsb(ws),/mcarPwm\(16, 180/);}finally{ws.dispose();}
 const layout=physicalLayout(esp);
 for(const p of ports(esp)){const point=layout.points.get(p.id);assert.ok(point.x>=0&&point.x<=layout.width&&point.y>=layout.header&&point.y<=layout.height,p.id);}
 esp.signalsVerified=false;assert.equal(analyzeWiring(state).bindings.find(b=>b.ref==='drv:IN1').available,true);
 delete esp.signalsVerified;assert.equal(analyzeWiring(state).bindings.find(b=>b.ref==='drv:IN1').available,true);
 const old=fixture();old.components.push({id:'exp',kind:'expansion',name:'Моя плата',host:'esp',signalsVerified:true,x:900,y:700});
 old.wires.find(w=>w.b==='drv:IN1').a='exp:S16';old.checked=['wire0'];
 const merged=mountLegacyExpansions(old);validateWiring(merged);assert.equal(merged.components.length,5);assert.equal(merged.wires.length,old.wires.length);assert.equal(merged.components[0].expansion,'esp32s-38p');assert.deepEqual(merged.checked,[]);
 assert.equal(analyzeWiring(merged).bindings.find(b=>b.ref==='drv:IN1').gpio,16);assert.equal(old.components.length,6);
 const unverified=structuredClone(old);unverified.components.at(-1).host='';assert.equal(analyzeWiring(mountLegacyExpansions(unverified)).bindings.find(b=>b.ref==='drv:IN1').gpio,16);
});

test('photo layout has 17 columns on both S/V/G headers, including the final 5V power contact',async()=>{
 const {EXPANSION_PINS}=await import('../src/assembly/board-layouts.js');
 const {ports}=await import('../src/wiring-model.js');
 for(const edge of ['top','bottom'])for(const band of ['S','V','G'])assert.equal(EXPANSION_PINS.filter(p=>p.name.startsWith(`${edge}-${band}-`)).length,17,`${edge} ${band}`);
 assert.equal(EXPANSION_PINS.find(p=>p.name==='bottom-S-16').label,'5V · S');
 for(const edge of ['top','bottom'])assert.ok(Math.abs(EXPANSION_PINS.find(p=>p.name===`${edge}-S-0`).y)>Math.abs(EXPANSION_PINS.find(p=>p.name===`${edge}-G-0`).y),'S is the outer yellow row in the photo');
 const state=fixture();state.components[0].expansion='esp32s-38p';state.components[0].signalsVerified=true;
 const power=ports(state.components[0]).find(p=>p.id==='exp-bottom-S-16');assert.equal(power.role,'rail');assert.equal(power.gpio,null);assert.equal(power.voltage,5);
 state.wires.push(wire('battery:PLUS','esp:exp-bottom-S-16','power'));assert.ok(codes(state).includes('usb-backfeed'));
 state.wires=state.wires.filter(w=>w.id!=='wire0');assert.ok(!codes(state).includes('esp-power'),'external supply is drawn; do not ask to connect USB too');assert.ok(codes(state).includes('external-5v'));
 assert.deepEqual(analyzeWiring(state).issues.filter(i=>i.severity==='error'),[]);
 state.wires.push(wire('esp:exp-bottom-S-16','esp:left-13','short'));assert.ok(codes(state).includes('short'));
});

test('quarter-turn layouts preserve pin identity, world coordinates and electrical bindings',async()=>{
 const {physicalLayout}=await import('../src/wiring-physical.js');
 for(const component of [...fixture().components,{id:'mounted',kind:'esp32',expansion:'esp32s-38p'}]){
  const base=physicalLayout(component);
  for(const rotation of [0,90,180,270]){
   const turned=physicalLayout({...component,rotation});
   assert.equal(turned.width,rotation%180?base.imageHeight:base.width);
   assert.equal(turned.imageHeight,rotation%180?base.width:base.imageHeight);
   for(const [id,p]of base.points){
    const q=turned.points.get(id);assert.deepEqual(q.world,p.world);
    assert.ok(q.x>=0&&q.x<=turned.width&&q.y>=turned.header&&q.y<=turned.height);
    if(rotation===90){assert.equal(q.x,base.height-p.y);assert.equal(q.y,base.header+p.x);}
    if(rotation===180){assert.equal(q.x,base.width-p.x);assert.equal(q.y,base.header+base.height-p.y);}
   }
  }
 }
 const state=program();const initial=compileUsbState(state);
 for(const c of state.wiring.components)c.rotation=270;
 assert.equal(compileUsbState(state),initial);
 const workspace=load(state);try{assert.deepEqual(Blockly.serialization.workspaces.save(workspace).wiring,state.wiring);}finally{workspace.dispose();}
 for(const rotation of [-90,45,360,'90',null]){const s=fixture();s.components[0].rotation=rotation;assert.throws(()=>validateWiring(s),/Кут повороту/);}
});

test('photo auxiliary 2x4 header exposes both GND pins, VCC and communication signals',async()=>{
 const {EXPANSION_PINS}=await import('../src/assembly/board-layouts.js');
 const {ports}=await import('../src/wiring-model.js');
 const aux=EXPANSION_PINS.filter(p=>p.name.startsWith('aux-'));
 assert.deepEqual(aux.map(p=>p.label),['TX','RX','VCC','GND','D22','D21','VCC','GND']);
 const state=fixture(),esp=state.components[0];esp.expansion='esp32s-38p';esp.signalsVerified=true;
 const pins=ports(esp).filter(p=>p.id.startsWith('exp-aux-'));
 assert.equal(pins.filter(p=>p.role==='ground').length,2);
 assert.equal(pins.filter(p=>p.label.startsWith('VCC')&&p.role==='unknown'&&p.voltage===undefined).length,2);
 assert.equal(pins.filter(p=>p.role==='reserved').length,2);
 state.wires.find(w=>w.b==='drv:IN1').a='esp:exp-aux-bottom-1';
 state.wires.find(w=>w.a==='esp:left-13').a='esp:exp-aux-bottom-3';
 assert.equal(analyzeWiring(state).bindings.find(b=>b.ref==='drv:IN1').gpio,21);
 assert.deepEqual(analyzeWiring(state).issues.filter(i=>i.severity==='error'||i.severity==='incomplete'),[]);
 state.wires.push(wire('battery:PLUS','esp:exp-aux-top-3','short'));assert.ok(codes(state).includes('short'));
});

test('jumper choices persist without claiming measured voltage or changing GPIO code',()=>{
 const state=program();state.wiring.components[0].expansion='esp32s-38p';const code=compileUsbState(state);
 for(const v of [3.3,5]){state.wiring.components[0].jumperVoltage=v;assert.equal(compileUsbState(state),code);const ws=load(state);try{assert.equal(Blockly.serialization.workspaces.save(ws).wiring.components[0].jumperVoltage,v);}finally{ws.dispose();}assert.ok(codes(state.wiring).includes('expansion-power'));}
 for(const v of [0,3,12,'5',null]){state.wiring.components[0].jumperVoltage=v;assert.throws(()=>validateWiring(state.wiring),/Перемичка/);}
});
