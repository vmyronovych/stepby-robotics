import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {COMPONENTS,componentKey} from '../src/assembly/components.js';
import {initComponentDetails} from '../src/assembly/component-details.js';
import {initModelFullscreen} from '../src/assembly/fullscreen.js';
import {createPinFallback} from '../src/assembly/module-viewer.js';
import model from '../src/assembly/model-data.json' with {type:'json'};

test('D1/D2 pin connections agree with firmware GPIO and project motor connectors',()=>{
 const source=fs.readFileSync(new URL('../../firmware/src/config.h',import.meta.url),'utf8');
 const gpios=source.match(/MOTOR_PINS\[4\]\[2\] = (.*?);/)[1].match(/\d+/g).map(Number);
 const faults=source.match(/FAULT_PINS\[2\] = (.*?);/)[1].match(/\d+/g).map(Number);
 for(const [i,id] of ['D1','D2'].entries()){
  const pins=COMPONENTS[id].pins;
  ['IN1','IN2','IN3','IN4'].forEach((name,j)=>assert.match(pins.find(p=>p.name===name).connection,new RegExp(`GPIO${gpios[i*4+j]} · JD${i+1}\\.${j+2}$`)));
  assert.match(pins.find(p=>p.name==='FAULT').connection,new RegExp(`GPIO${faults[i]}`));
  ['OUT1','OUT2','OUT3','OUT4'].forEach((name,j)=>assert.ok(pins.find(p=>p.name===name).connection.startsWith(`JM${i*2+1+Math.floor(j/2)}.${j%2+1}`)));
  assert.equal(new Set(pins.map(p=>p.name)).size,12);
  assert.match(pins.find(p=>p.name==='SLEEP').connection,/J1/);
  assert.match(pins.find(p=>p.name==='FAULT').note,/10 кΩ до 3V3/);
  assert.ok(!pins.some(p=>['VMM','AISEN','BISEN'].includes(p.name)));
  assert.match(COMPONENTS[id].diagramNote,/зворотний бік/);
 }
});
test('model subparts resolve to their own component without confusing the two drivers',()=>{
 for(const [index,id] of ['D1','D2'].entries())for(const prefix of ['driver','driverchip','drivercap','driverMount'])assert.equal(componentKey({id:prefix+index}),id);
 const sockets=model.parts.filter(p=>p.id==='driversocket');assert.deepEqual(sockets.map(componentKey),['D1','D2']);
 for(const part of model.parts){const key=componentKey(part);if(key)assert.ok(COMPONENTS[key],part.id);}
 for(const component of Object.values(COMPONENTS))for(const related of component.related)assert.ok(COMPONENTS[related]);
 assert.equal(componentKey({id:'wire',stage:14}),null);
});
function setup(t){
 const dom=new JSDOM('<dialog open><section id="presentation"><div id="host"></div><select id="picker"><option>D1</option></select><button id="full">На весь екран</button></section></dialog>',{pretendToBeVisual:true});
 globalThis.document=dom.window.document;t.after(()=>{dom.window.close();delete globalThis.document});
 let closed=0;const details=initComponentDetails(document.querySelector('#host'),{createViewer:createPinFallback,onClose:()=>closed++,onNavigate:key=>details.open(key)});
 const fullscreen=initModelFullscreen(document.querySelector('#presentation'),document.querySelector('#full'));
 return {dom,details,fullscreen,get closed(){return closed}};
}
test('physical pin selection reveals one visual explanation; technical data stays collapsed',t=>{
 const {details}=setup(t);details.open('D1');const panel=details.panel;
 assert.match(panel.querySelector('.component-pin-detail').textContent,/Торкнися/);
 assert.equal(panel.querySelector('details').open,false);assert.equal(panel.querySelectorAll('[data-pin]').length,12);
 panel.querySelector('[data-pin="FAULT"]').click();assert.match(panel.querySelector('.component-pin-detail').textContent,/ESP32/);
 assert.match(panel.querySelector('[data-pin-technical]').textContent,/GPIO21/);
 panel.querySelector('[data-related="D2"]').click();assert.match(panel.querySelector('h2').textContent,/D2/);
 assert.match(panel.querySelector('.component-pin-detail').textContent,/Торкнися/);assert.doesNotMatch(panel.querySelector('table').textContent,/GPIO16/);
 panel.querySelector('[data-pin="FAULT"]').click();assert.match(panel.querySelector('[data-pin-technical]').textContent,/GPIO22/);
 assert.equal(panel.querySelectorAll('[aria-pressed="true"]').length,1);
 panel.querySelector('[data-pin="OUT1"]').click();panel.querySelector('.pin-route-target').click();assert.equal(panel.dataset.component,'M3');
});
test('module renderers are disposed on switching component and closing',t=>{
 const {details}=setup(t);let disposed=0,created=0;const other=initComponentDetails(document.querySelector('#host'),{createViewer:()=>{created++;return {dispose:()=>disposed++,filter(){}}}});
 other.open('ESP32');other.open('30P');other.close();other.close();assert.equal(created,2);assert.equal(disposed,2);details.close();
});
test('first Escape leaves component details, second Escape leaves presentation',async t=>{
 const state=setup(t),{dom,details,fullscreen}=state;
 document.querySelector('#full').click();await new Promise(resolve=>setImmediate(resolve));assert.ok(fullscreen.active);
 const picker=document.querySelector('#picker');picker.focus();details.open('D1');
 document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.ok(!details.isOpen);assert.equal(state.closed,1);assert.ok(fullscreen.active);assert.equal(document.activeElement,picker);
 document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.ok(!fullscreen.active);
});
test('closing details for a new assembly step does not steal focus from navigation',t=>{
 const {details}=setup(t);details.open('D1');const picker=document.querySelector('#picker');picker.focus();details.close();assert.equal(document.activeElement,picker);assert.ok(!details.isOpen);
 details.open('chassis');assert.equal(details.panel.querySelector('table'),null);assert.ok(!details.panel.textContent.includes('AIN1'));
});
