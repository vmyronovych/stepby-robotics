import test from 'node:test';
import assert from 'node:assert/strict';
import {resistorBands,formatResistance,RESISTANCES,teachingPartSvg} from '../src/teaching-parts.js';
import {BREADBOARD_PINS} from '../src/breadboard.js';
import {ports,analyzeWiring,validateWiring} from '../src/wiring-model.js';
import {physicalLayout} from '../src/wiring-physical.js';
import {compileUsbBytecode} from '../src/usb-bytecode.js';
import {compileUsbState} from '../src/usb-compiler.js';
import {Blockly} from '../src/usb-blocks.js';
import {wired} from './wiring-fixture.mjs';

export const lightCircuit=()=>({version:1,components:[
 {id:'esp',kind:'esp32',name:'ESP32',x:30,y:30},
 {id:'usb',kind:'usb',name:'USB',x:30,y:650},
 {id:'r',kind:'resistor',name:'Резистор',resistance:330,x:400,y:140},
 {id:'led',kind:'led',name:'Мій LED',ledColor:'red',x:820,y:60},
],wires:[['usb:USB','esp:USB'],['esp:right-11','r:A'],['r:B','led:A'],['led:K','esp:left-13']].map(([a,b],i)=>({id:`w${i}`,a,b,color:'#328f83'})),checked:[]});
const bind=s=>analyzeWiring(s).bindings.find(b=>b.ref==='led:A');
const program=s=>({wiring:s,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:wired('led:A','pwm')}}]}});
const codes=s=>analyzeWiring(s).issues.map(i=>i.code);

test('four standard bands decode every supported resistor value and show gold tolerance',()=>{
 const names=v=>resistorBands(v).map(b=>b[0]);
 assert.deepEqual(names(330),['Помаранчева','Помаранчева','Коричнева','Золота']);
 assert.deepEqual(names(220),['Червона','Червона','Коричнева','Золота']);
 assert.deepEqual(names(1000),['Коричнева','Чорна','Червона','Золота']);
 assert.deepEqual(names(4700),['Жовта','Фіолетова','Червона','Золота']);
 const digits=['Чорна','Коричнева','Червона','Помаранчева','Жовта','Зелена','Синя','Фіолетова','Сіра','Біла'];
 for(const v of RESISTANCES){const b=names(v);assert.equal((digits.indexOf(b[0])*10+digits.indexOf(b[1]))*10**digits.indexOf(b[2]),v);assert.equal(b[3],'Золота');}
 assert.equal(formatResistance(4700),'4,7 кОм');assert.throws(()=>resistorBands(123));
});
test('LED color, resistor value and artwork survive serialization; malformed imports are rejected',()=>{
 for(const color of ['red','yellow','green']){const s=lightCircuit();s.components[3].ledColor=color;s.components[2].resistance=2200;validateWiring(s);const workspace=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(program(s),workspace);assert.deepEqual(Blockly.serialization.workspaces.save(workspace).wiring,s);}finally{workspace.dispose();}}
 assert.notEqual(teachingPartSvg({kind:'led',ledColor:'red'}),teachingPartSvg({kind:'led',ledColor:'green'}));assert.notEqual(teachingPartSvg({kind:'resistor',resistance:220}),teachingPartSvg({kind:'resistor',resistance:330}));
 for(const value of ['blue',null,{},17]){const s=lightCircuit();s.components[3].ledColor=value;assert.throws(()=>validateWiring(s));}
 for(const value of [0,-1,Infinity,123,'330']){const s=lightCircuit();s.components[2].resistance=value;assert.throws(()=>validateWiring(s));}
});
test('LED resolves GPIO through a series resistor on either side and recompiles after rewiring',()=>{
 const s=lightCircuit();assert.equal(bind(s).gpio,16);assert.equal(bind(s).available,true);assert.match(compileUsbState(program(s)),/mcarPwm\(16, 180/);
 const ws=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(program(s),ws);assert.equal(compileUsbBytecode(ws).code.find(i=>i.op==='p').value,16);}finally{ws.dispose();}
 s.wires[1].a='esp:right-1';assert.match(compileUsbState(program(s)),/mcarPwm\(23, 180/);
 s.wires[1]={...s.wires[1],a:'esp:right-11',b:'led:A'};s.wires[2]={...s.wires[2],a:'led:K',b:'r:B'};s.wires[3]={...s.wires[3],a:'r:A',b:'esp:left-13'};assert.equal(bind(s).gpio,16);assert.deepEqual(analyzeWiring(s).issues.filter(i=>i.severity==='error'||i.severity==='incomplete'),[]);
});
test('LED checks missing or bypassed resistance, low resistance, reversed legs and input-only GPIO',()=>{
 let s=lightCircuit();s.wires[1].b='led:A';s.wires.splice(2,1);assert.ok(codes(s).includes('led-resistor'));assert.throws(()=>compileUsbState(program(s)),/резистор/);
 s=lightCircuit();s.wires.push({id:'bypass',a:'r:A',b:'r:B',color:'#ff0000'});assert.ok(codes(s).includes('led-resistor'));
 s=lightCircuit();s.components[2].resistance=100;assert.ok(codes(s).includes('led-resistance'));assert.equal(bind(s).available,true);assert.equal(analyzeWiring(s).issues.find(i=>i.code==='led-resistance').severity,'unknown');
 s=lightCircuit();s.wires[2].b='led:K';s.wires[3].a='led:A';assert.ok(codes(s).includes('led-polarity'));
 s=lightCircuit();s.wires[1].a='esp:left-4';assert.ok(codes(s).includes('led-input'));
 s=lightCircuit();s.wires.pop();assert.ok(codes(s).includes('led-circuit'));assert.equal(bind(s).available,false);
 s=lightCircuit();s.components.push({id:'parallel',kind:'resistor',name:'R2',x:500,y:500});s.wires.push({id:'p1',a:'r:A',b:'parallel:A',color:'#ff0000'},{id:'p2',a:'r:B',b:'parallel:B',color:'#ff0000'});assert.equal(bind(s).available,false);
});
test('breadboard exposes 170 holes in 34 isolated groups of five',()=>{
 const s={version:1,components:[{id:'bb',kind:'breadboard',name:'BB',x:0,y:0}],wires:[],checked:[]};const analysis=analyzeWiring(s);
 assert.equal(ports(s.components[0]).length,170);assert.equal(new Set(BREADBOARD_PINS.map(p=>p.id)).size,170);
 for(const p of BREADBOARD_PINS){const group=analysis.net(`bb:${p.id}`);assert.equal(group.length,5);assert.ok(group.every(t=>t.group===p.group));}
 assert.ok(!analysis.net('bb:A1').some(t=>['F1','A2'].includes(t.id)));
});
test('LED binds through breadboard strips; shared-hole mistakes are detected',()=>{
 const s=lightCircuit();s.components.push({id:'bb',kind:'breadboard',name:'BB',x:400,y:400});s.wires=s.wires.filter(w=>w.id!=='w2');s.wires.push({id:'bb1',a:'r:B',b:'bb:A1',color:'#ff0000'},{id:'bb2',a:'bb:E1',b:'led:A',color:'#ff0000'});
 assert.equal(bind(s).gpio,16);assert.match(compileUsbState(program(s)),/mcarPwm\(16, 180/);
 s.wires.find(w=>w.id==='bb2').a='bb:F1';assert.equal(bind(s).available,false);
 s.wires.push({id:'short',a:'esp:left-0',b:'bb:A2',color:'#ff0000'},{id:'short2',a:'esp:left-13',b:'bb:E2',color:'#ff0000'});assert.ok(codes(s).includes('short'));
});
test('all new physical contacts remain inside their rotated artwork bounds',()=>{
 for(const kind of ['led','resistor','breadboard'])for(const rotation of [0,90,180,270]){const l=physicalLayout({kind,rotation});for(const p of l.points.values())assert.ok(p.x>=0&&p.x<=l.width&&p.y>=l.header&&p.y<=l.height);}
});
