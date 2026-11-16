import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COMPONENTS} from '../src/assembly/components.js';
import {createModuleModel} from '../src/assembly/module-viewer.js';
import {HW627_PINS} from '../src/assembly/hw627.js';
import {ESP_PINS,EXPANSION_PINS} from '../src/assembly/board-layouts.js';
import {disposeModel} from '../src/assembly/hw627-model.js';
import presentation from '../src/assembly/presentation-data.js';

test('HW-627 front and mirrored solder side match the supplied pinout',()=>{
 assert.deepEqual(HW627_PINS.filter(p=>p.x>0).map(p=>p.name),['IN4','IN3','GND','VCC','IN2','IN1']);
 assert.deepEqual(HW627_PINS.filter(p=>p.x<0).map(p=>p.name),['SLEEP','OUT1','OUT2','OUT3','OUT4','FAULT']);
 const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(0,0,-50);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 assert.ok(new THREE.Vector3(7.8,6.35,0).project(camera).x<0,'IN4 appears on left when looking at solder side');
});
test('ESP32 photo has 38 individually selectable contacts, including three separate grounds',()=>{
 assert.equal(ESP_PINS.length,38);assert.equal(ESP_PINS.filter(p=>p.label==='GND').length,3);
 assert.deepEqual(ESP_PINS.filter(p=>p.name[0]==='L').map(p=>p.label).slice(0,4),['3V3','EN','SP','SN']);
 assert.equal(ESP_PINS.find(p=>p.name==='L19').label,'5V');assert.equal(ESP_PINS.find(p=>p.name==='R19').label,'CLK');
 const sockets=EXPANSION_PINS.filter(p=>p.group==='Гнізда ESP32');assert.equal(sockets.length,57);
 for(const edge of ['top','bottom'])for(const band of ['S','V','G'])assert.equal(EXPANSION_PINS.filter(p=>p.name.startsWith(`${edge}-${band}-`)).length,17);
 assert.equal(EXPANSION_PINS.find(p=>p.name==='bottom-S-16').label,'5V · S');
 assert.equal(new Set(EXPANSION_PINS.map(p=>p.name)).size,EXPANSION_PINS.length);
});
test('every physical contact can be ray-picked on each photo-based 3D model',()=>{
 for(const id of ['D1','ESP32','30P','M1']){
  const c=COMPONENTS[id],m=createModuleModel(c,{labels:false});m.root.updateMatrixWorld(true);
  assert.equal(m.hitTargets.length,c.pins.length,id);
  for(const p of c.pins){const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,100),new THREE.Vector3(0,0,-1));const hit=ray.intersectObjects(m.hitTargets,false)[0];assert.equal(hit?.object.userData.pin,p.name,`${id} ${p.name}`);}
  const bounds=new THREE.Box3().setFromObject(m.root);assert.ok(Number.isFinite(bounds.max.x));disposeModel(m.root);
 }
});
test('new teaching steps no longer tell the user that their 38-pin board is incompatible',()=>{
 const text=JSON.stringify(presentation.steps);assert.doesNotMatch(text,/30P|30 контактів|38 контактів не підходить|2 модулі Pololu/);
 assert.match(text,/HW-627/);assert.match(text,/19 контактів/);
 for(const id of ['M1','M2','M3','M4']){assert.equal(COMPONENTS[id].pins.length,2);assert.ok(COMPONENTS[id].pins.every(p=>!/[+−]/.test(p.label)));}
});

test('jumper shunt moves between adjacent post pairs in mounted and standalone models',()=>{
 for(const model of ['expansion','esp32-mounted']){
  const models=[3.3,5].map(jumperVoltage=>createModuleModel({model,jumperVoltage,pins:[]},{labels:false}));
  try{
   const [a,b]=models.map(m=>new THREE.Box3().setFromObject(m.root.getObjectByName('expansion-jumper-shunt')).getCenter(new THREE.Vector3()));
   assert.ok(Math.abs(a.y-b.y-2.54)<1e-6);assert.equal(a.x,b.x);
  }finally{models.forEach(m=>disposeModel(m.root));}
 }
});
