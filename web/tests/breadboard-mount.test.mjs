import test from 'node:test';
import assert from 'node:assert/strict';
import {breadboardCircuit} from './breadboard-fixture.mjs';
import {validateWiring,analyzeWiring} from '../src/wiring-model.js';
import {physicalLayout} from '../src/wiring-physical.js';
import {syncMounts,findMount,seatComponent,detachChildren} from '../src/breadboard-mount.js';
import {compileUsbState} from '../src/usb-compiler.js';
import {compileUsbBytecode} from '../src/usb-bytecode.js';
import {Blockly} from '../src/usb-blocks.js';
import {wired} from './wiring-fixture.mjs';
const binding=s=>analyzeWiring(s).bindings.find(b=>b.ref==='led:A');
function aligned(s){for(const c of s.components.filter(c=>c.breadboardMount)){const b=s.components.find(b=>b.id===c.breadboardMount.boardId);for(const [pin,hole]of Object.entries(c.breadboardMount.holes)){const p=physicalLayout(c).points.get(pin),q=physicalLayout(b).points.get(hole);assert.ok(Math.hypot(c.x+p.x-b.x-q.x,c.y+p.y-b.y-q.y)<.001);}}}
test('inserted LED and resistor form a complete circuit without leg wires and compile both firmware paths',()=>{
 const s=syncMounts(breadboardCircuit());validateWiring(s);aligned(s);assert.equal(s.wires.length,3);assert.equal(binding(s).gpio,16);assert.equal(binding(s).available,true);assert.deepEqual(analyzeWiring(s).issues,[]);
 const state={wiring:s,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:wired('led:A','pwm')}}]}};
 assert.match(compileUsbState(state),/mcarPwm\(16, 180/);
 const ws=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(state,ws);assert.deepEqual(Blockly.serialization.workspaces.save(ws).wiring,s);assert.equal(compileUsbBytecode(ws).code.find(i=>i.op==='p').value,16);}finally{ws.dispose();}
 delete s.components.find(c=>c.id==='r').breadboardMount;assert.equal(binding(s).available,false);
});
test('parts stay exactly in their holes through all board rotations and edge moves; deletion detaches',()=>{
 const s=breadboardCircuit(),b=s.components.find(c=>c.id==='bb');
 for(const rotation of [0,90,180,270])for(const pos of [0,220]){b.rotation=rotation;b.x=b.y=pos;syncMounts(s);validateWiring(s);aligned(s);assert.equal(binding(s).gpio,16);}
 detachChildren(s,'bb');s.components=s.components.filter(c=>c.id!=='bb');s.wires=s.wires.filter(w=>!w.a.startsWith('bb:')&&!w.b.startsWith('bb:'));validateWiring(s);assert.equal(s.components.filter(c=>c.breadboardMount).length,0);assert.equal(binding(s).available,false);
});
test('snap only accepts compatible free pairs and converts an old direct leg wire',()=>{
 const s=syncMounts(breadboardCircuit()),r=s.components.find(c=>c.id==='r');delete r.breadboardMount;r.x+=4;r.y-=3;
 const candidate=findMount(s,r);assert.deepEqual(candidate.holes,{A:'E5',B:'F5'});
 s.wires.push({id:'old',a:'r:A',b:'bb:E5',color:'#328f83'});assert.ok(seatComponent(s,r));assert.equal(s.wires.length,3);validateWiring(s);aligned(s);
 const copy={...r,id:'r2'};delete copy.breadboardMount;s.components.push(copy);assert.equal(findMount(s,copy),null);
 copy.y+=10;copy.x+=10;assert.equal(findMount(s,copy),null);s.components.pop();
 delete r.breadboardMount;s.wires.push({id:'occupied',a:'esp:right-1',b:'bb:E5',color:'#328f83'});assert.equal(findMount(s,r),null);
});
test('invalid mounts, shared holes and wires in inserted holes are rejected on import',()=>{
 const broken=[s=>s.components[3].breadboardMount.boardId='missing',s=>s.components[3].breadboardMount.holes.B='E5',s=>s.components[3].breadboardMount.holes.B='G5',s=>s.components[3].breadboardMount.holes={A:'X1',B:'F5'},s=>s.components[0].breadboardMount=s.components[3].breadboardMount,s=>s.components.push({...s.components[3],id:'other'}),s=>s.wires.push({id:'collision',a:'esp:right-1',b:'bb:F5',color:'#328f83'}),s=>s.components[3].breadboardMount=null];
 for(const breakIt of broken){const s=breadboardCircuit();breakIt(s);assert.throws(()=>validateWiring(s));}
});
test('LED legs in one strip are reported as a short rather than an unexplained missing circuit',()=>{
 const s=breadboardCircuit();s.components.find(c=>c.id==='led').breadboardMount.holes={A:'A10',K:'B10'};syncMounts(s);aligned(s);
 assert.ok(analyzeWiring(s).issues.some(i=>i.code==='led-shorted'));assert.equal(binding(s).available,false);
});

test('DRV8833 seats all 12 pins at seven pitches, carries through rotations and survives reload',async()=>{
 const {driverBreadboard}=await import('./driver-breadboard-fixture.mjs');const s=driverBreadboard(),[b,d]=s.components;
 const candidate=findMount(s,d);assert.equal(candidate.points.length,12);assert.equal(candidate.holes.SLEEP,'B10');assert.equal(candidate.holes.IN4,'F10');assert.equal(candidate.holes.IN1,'F5');assert.equal(candidate.holes.FAULT,'B5');assert.equal(seatComponent(s,d),true);
 for(const rotation of [0,90,180,270]){b.rotation=rotation;b.x+=30;b.y+=20;syncMounts(s);validateWiring(s);aligned(s);assert.equal(s.wires.length,0);}
 const copy=syncMounts(JSON.parse(JSON.stringify(s)));validateWiring(copy);aligned(copy);assert.deepEqual(copy,s);
 detachChildren(s,'bb');assert.equal(d.breadboardMount,undefined);
});
test('DRV8833 refuses partial, occupied, mirrored or distorted footprints',async()=>{
 const {driverBreadboard}=await import('./driver-breadboard-fixture.mjs');
 for(const terminal of ['B10','F5']){const s=driverBreadboard();s.components.push({id:'led',kind:'led',name:'LED',x:0,y:0});s.wires.push({id:'wire',a:'led:A',b:`bb:${terminal}`,color:'#328f83'});assert.equal(findMount(s,s.components[1]),null);}
 const s=driverBreadboard(),d=s.components[1];seatComponent(s,d);
 for(const change of [holes=>delete holes.IN1,holes=>holes.IN1='G5',holes=>holes.IN1=holes.IN2,holes=>{[holes.IN1,holes.IN2]=[holes.IN2,holes.IN1];}]){const copy=structuredClone(s);change(copy.components[1].breadboardMount.holes);assert.throws(()=>validateWiring(copy));}
 const other={...d,id:'other'};delete other.breadboardMount;s.components.push(other);assert.equal(findMount(s,other),null);
});
test('DRV8833 breadboard strips resolve GPIO commands without artificial pin wires',async()=>{
 const {driverBreadboard}=await import('./driver-breadboard-fixture.mjs');const s=driverBreadboard(),d=s.components[1];seatComponent(s,d);s.components.push({id:'esp',kind:'esp32',name:'ESP32',x:20,y:20});
 s.wires.push({id:'input',a:'esp:right-11',b:'bb:J5',color:'#328f83'});validateWiring(s);
 const binding=analyzeWiring(s).bindings.find(b=>b.ref==='drv:IN1');assert.equal(binding.gpio,16);
 assert.match(compileUsbState({wiring:s,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:wired('drv:IN1','pwm')}}]}}),/mcarPwm\(16, 180/);
});
