import test from 'node:test';import assert from 'node:assert/strict';
import {expansionBreadboard} from './expansion-breadboard-fixture.mjs';
import {analyzeWiring,validateWiring} from '../src/wiring-model.js';
import {unavailableConnections} from '../src/wiring-diagnostics.js';
import {compileUsbState} from '../src/usb-compiler.js';
import {wired} from './wiring-fixture.mjs';
const program=s=>({wiring:s,blocks:{languageVersion:0,blocks:[{type:'usb_start',next:{block:wired('drv:IN4','pwm')}}]}});
test('expansion through inserted driver exposes the actual blocked GPIO without an obsolete confirmation requirement',()=>{
 const s=expansionBreadboard();validateWiring(s);const a=analyzeWiring(s),blocked=unavailableConnections(s,a);assert.equal(blocked.length,2);
 assert.deepEqual(blocked.map(b=>b.connectedGpio).sort(),[34,35]);for(const b of blocked){assert.equal(b.gpio,null);assert.equal(b.available,false);assert.ok(b.messages.every(m=>!m.includes('звір')));assert.ok(b.messages.some(m=>m.includes('лише вхід')));}
 assert.throws(()=>compileUsbState(program(s)),/лише читає/);

 s.wires[0].a='esp:exp-top-S-9';s.wires[1].a='esp:exp-top-S-8';assert.equal(unavailableConnections(s,analyzeWiring(s)).length,0);assert.match(compileUsbState(program(s)),/mcarPwm\(16, 180/);
});
test('input-only GPIO remains valid for reading FAULT without verification',()=>{
 const s=expansionBreadboard();s.wires=[{...s.wires[0],b:'bb:J6'}];const a=analyzeWiring(s);assert.equal(a.bindings.find(b=>b.ref==='drv:FAULT').gpio,34);assert.equal(a.bindings.find(b=>b.ref==='drv:FAULT').available,true);assert.equal(unavailableConnections(s,a).length,0);
});
test('old false/true and missing confirmation metadata produce identical GPIO, ground and compiler results',()=>{
 const base=expansionBreadboard();base.wires[0].a='esp:exp-top-S-9';base.wires[1].a='esp:exp-top-S-8';
 const results=[];
 for(const value of [false,true,undefined]){
  const state=structuredClone(base);if(value===undefined)delete state.components[0].signalsVerified;else state.components[0].signalsVerified=value;
  const a=analyzeWiring(state);assert.equal(a.bindings.find(b=>b.ref==='drv:IN4').gpio,16);assert.equal(a.bindings.find(b=>b.ref==='drv:IN3').available,true);
  assert.ok(a.net('esp:exp-bottom-G-9').some(t=>t.key==='esp:left-13'));
  assert.ok(a.net('esp:exp-aux-bottom-1').some(t=>t.key==='esp:right-5'));
  assert.ok(!a.issues.some(i=>i.code==='expansion-signals'));assert.ok(a.issues.some(i=>i.code==='expansion-power'));
  results.push(compileUsbState(program(state)));
 }
 assert.equal(results[0],results[1]);assert.equal(results[0],results[2]);
});
