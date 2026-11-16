import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expansionPorts} from '../src/wiring-model.js';
import {expansionPinDocs} from '../src/expansion-pin-docs.js';
import {boardPins,supportsPin} from '../src/usb-pins.js';
const pins=expansionPorts();
const docs=(id,props={})=>expansionPinDocs({...pins.find(p=>p.id===`exp-${id}`),component:props});
test('every expansion contact has documentation and shares ESP32 capabilities',()=>{
 for(const pin of pins){
  const doc=expansionPinDocs({...pin,component:{signalsVerified:true}});
  assert.ok(doc.description,pin.id);assert.ok(doc.kind,pin.id);assert.ok(doc.path,pin.id);
  const host=boardPins.find(p=>p.id===pin.hostPin);
  if(host){assert.equal(doc.description,host.description);assert.equal(doc.modes.length,['write','pwm','read','pullup','analog'].filter(a=>supportsPin(host.gpio,a)).length);}
 }
 assert.equal(expansionPinDocs({id:'left-1'}),null);
});
test('input-only aliases, UART, flash and 5V retain their actual roles',()=>{
 for(const [id,gpio]of [['bottom-S-1',36],['bottom-S-2',39],['bottom-S-3',34],['bottom-S-4',35]]){
  const doc=docs(id);assert.equal(doc.title,`GPIO${gpio}`);assert.equal(doc.kind,'Лише вхід');assert.deepEqual(doc.modes,['Вхід · 0 / 1','Аналоговий вхід · 0…4095']);assert.equal(doc.verification,undefined);
 }
 for(const id of ['aux-top-0','aux-top-1','top-S-16','bottom-S-0'])assert.equal(docs(id).modes.length,0);
 assert.equal(docs('bottom-S-16').kind,'Живлення');assert.equal(docs('bottom-S-16').jumper,false);
 assert.match(docs('aux-bottom-1').path,/GPIO21 ESP32/);assert.match(docs('aux-bottom-0').path,/GPIO22 ESP32/);
 assert.equal(docs('top-S-9',{signalsVerified:false}).verification,undefined);
});
test('V and G never inherit the GPIO of their column; VCC remains distinct from JUMP',()=>{
 for(const pin of pins.filter(p=>/-(V|G)-/.test(p.id))){const doc=expansionPinDocs({...pin,component:{}});assert.deepEqual(doc.modes,[]);assert.equal(doc.hostPin,undefined);}
 const v=docs('bottom-V-3',{jumperVoltage:3.3});assert.match(v.description,/3,3 В/);assert.equal(v.jumper,true);
 assert.match(docs('bottom-V-3',{jumperVoltage:5}).description,/обрано 5 В/);
 assert.equal(docs('bottom-G-3').kind,'Земля');
 const vcc=docs('aux-top-2');assert.equal(vcc.jumper,false);assert.match(vcc.warning,/не підтверджена/);
});
