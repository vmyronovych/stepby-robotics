import test from 'node:test';
import assert from 'node:assert/strict';
import {moveComponentGroup} from '../src/wiring-group-move.js';
import {driverBreadboard} from './driver-breadboard-fixture.mjs';
import {seatComponent,syncMounts} from '../src/breadboard-mount.js';
import {validateWiring} from '../src/wiring-model.js';
function fixture(){
 const state=driverBreadboard();assert.ok(seatComponent(state,state.components[1]));syncMounts(state);
 state.components.push({id:'bat',kind:'battery',name:'Батарейки',x:80,y:220});
 state.wires=[{id:'power',a:'bat:PLUS',b:'bb:J1',color:'#d64545',vertices:[{x:260,y:700},{x:380,y:700}]}];
 validateWiring(state);return state;
}
test('battery and breadboard carry mounted driver and internal wire bends exactly once',()=>{
 const start=fixture(),snapshot=structuredClone(start),next=moveComponentGroup(start,['bat','bb','drv'],90,40);
 for(const c of start.components){const n=next.components.find(n=>n.id===c.id);assert.equal(n.x,c.x+90);assert.equal(n.y,c.y+40);assert.deepEqual(n.breadboardMount,c.breadboardMount);}
 assert.deepEqual(next.wires[0].vertices,[{x:350,y:740},{x:470,y:740}]);assert.deepEqual(start,snapshot);
});
test('canvas bounds clamp the whole group, preserving spacing and wire shape',()=>{
 const start=fixture(),next=moveComponentGroup(start,['bat','bb'],-10000,-10000);
 const dx=next.components[0].x-start.components[0].x,dy=next.components[0].y-start.components[0].y;
 for(const c of start.components){const n=next.components.find(n=>n.id===c.id);assert.ok(Math.abs(n.x-c.x-dx)<1e-8);assert.ok(Math.abs(n.y-c.y-dy)<1e-8);assert.ok(n.x>=0&&n.y>=0);}
 assert.equal(next.wires[0].vertices[0].x,start.wires[0].vertices[0].x+dx);
});
test('automatic internal routes are carried, external wires and stationary parts stay unchanged',()=>{
 const start=fixture();delete start.wires[0].vertices;
 start.components.push({id:'other',kind:'battery',name:'Інша батарея',x:1100,y:100});
 start.wires.push({id:'external',a:'other:PLUS',b:'bb:J2',color:'#d64545',vertices:[{x:900,y:100}]});
 const routes=new Map([['power',[{x:100,y:300},{x:250,y:600},{x:380,y:600},{x:400,y:300}]]]);
 const next=moveComponentGroup(start,['bat','bb'],60,30,routes);
 assert.deepEqual(next.wires[0].vertices,[{x:310,y:630},{x:440,y:630}]);
 assert.deepEqual(next.wires[1],start.wires[1]);assert.deepEqual(next.components.at(-1),start.components.at(-1));
});
test('moving a mounted part without its board detaches only that part',()=>{
 const start=fixture(),next=moveComponentGroup(start,['bat','drv'],20,20);
 assert.equal(next.components.find(c=>c.id==='drv').breadboardMount,undefined);
 assert.deepEqual(next.components[0],start.components[0]);
});
