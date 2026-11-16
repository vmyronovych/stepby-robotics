import test from 'node:test';import assert from 'node:assert/strict';
import {AvoidLib} from 'libavoid-js';
import {createAvoidRouter} from '../src/wiring-avoid-core.js';
import {moveRouteSegment,roundedWirePath} from '../src/wiring-path.js';
import {routingScene,insideObstacle} from '../src/wiring-routing-scene.js';
import {validateWiring,analyzeWiring} from '../src/wiring-model.js';
import {syncMounts} from '../src/breadboard-mount.js';
import {breadboardCircuit} from './breadboard-fixture.mjs';
await AvoidLib.load();const route=createAvoidRouter(AvoidLib.getInstance());
export function routingCircuit(){const s=breadboardCircuit();Object.assign(s.components[0],{x:40,y:30,rotation:270});Object.assign(s.components[2],{x:40,y:360});return syncMounts(s);}
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
function orthogonal(points){for(let i=1;i<points.length;i++)assert.ok(Math.abs(points[i].x-points[i-1].x)<.01||Math.abs(points[i].y-points[i-1].y)<.01);}
test('libavoid uses the breadboard as a surface instead of routing ground around its bottom',()=>{
 const s=routingCircuit(),result=route(s),scene=routingScene(s),wire=s.wires[2],points=result.routes.get(wire.id);assert.equal(result.engine,'libavoid');orthogonal(points);
 assert.deepEqual(points[0],{x:scene.terminals.get(wire.a).x,y:scene.terminals.get(wire.a).y});assert.deepEqual(points.at(-1),{x:scene.terminals.get(wire.b).x,y:scene.terminals.get(wire.b).y});
 const bottom=s.components[2].y+400;assert.ok(Math.max(...points.map(p=>p.y))<bottom);assert.ok(length(points)<700);
 for(let i=1;i<points.length-1;i++)for(const r of scene.obstacles)assert.equal(insideObstacle(points[i],r),false);
 assert.match(roundedWirePath(points),/ Q/);
});
test('manual segment movement keeps terminals fixed, persists checkpoints, and leaves electrical bindings intact',()=>{
 const s=routingCircuit(),w=s.wires[2],points=route(s).routes.get(w.id);const before=analyzeWiring(s).bindings;
 const index=points.findIndex((p,i)=>i<points.length-1&&Math.abs(p.y-points[i+1].y)<.01);assert.ok(index>=0);
 w.vertices=moveRouteSegment(points,index,-24);validateWiring(s);const moved=route(s).routes.get(w.id);orthogonal(moved);assert.notDeepEqual(moved,points);assert.deepEqual(moved[0],points[0]);assert.deepEqual(moved.at(-1),points.at(-1));assert.deepEqual(analyzeWiring(s).bindings,before);
 assert.deepEqual(route(JSON.parse(JSON.stringify(s))).routes.get(w.id),moved);delete w.vertices;assert.deepEqual(route(s).routes.get(w.id),points);
});
test('obstacles covering a manual checkpoint temporarily reroute without corrupting the saved point',()=>{
 const s=routingCircuit(),w=s.wires[2];w.vertices=[{x:800,y:600}];assert.ok(!route(s).warnings.has(w.id));s.components.push({id:'obstacle',kind:'driver',name:'Driver',x:750,y:500});const saved=structuredClone(w.vertices),result=route(s);assert.ok(result.warnings.has(w.id));assert.deepEqual(w.vertices,saved);orthogonal(result.routes.get(w.id));
});
test('route imports reject invalid/excessive coordinates; reset is compatible with old projects',()=>{
 for(const vertices of [null,{},Array.from({length:33},()=>({x:10,y:10})),[{x:NaN,y:10}],[{x:-1,y:10}],[{x:10,y:Infinity}],[{x:'5',y:10}],[{x:6001,y:10}]]){const s=routingCircuit();s.wires[0].vertices=vertices;assert.throws(()=>validateWiring(s),/Маршрут/);}
 const s=routingCircuit();validateWiring(s);s.wires[0].vertices=[];validateWiring(s);
});
test('routing remains deterministic across moves and cached redraws',()=>{
 const s=routingCircuit();const first=route(s);assert.equal(route(s),first);
 for(let i=0;i<12;i++){s.components[0].x+=6;for(const points of route(s).routes.values())orthogonal(points);}
 s.components[0].x-=72;assert.deepEqual([...route(s).routes],[...first.routes]);
});
test('all four board rotations route outward from the actual pin side',()=>{
 for(const rotation of [0,90,180,270]){const s=routingCircuit();s.components[0].rotation=rotation;if(rotation%180===0){s.components.find(c=>c.id==='bb').y=660;syncMounts(s);}s.components=s.components.filter(c=>c.id!=='usb');s.wires=s.wires.filter(w=>w.id!=='w0');const scene=routingScene(s),routes=route(s).routes;
  for(const w of s.wires)for(const [key,points] of [[w.a,routes.get(w.id)],[w.b,[...routes.get(w.id)].reverse()]]){const p=scene.terminals.get(key),r=scene.obstacles.find(r=>r.id===p.shape);if(!r)continue;const next=points[1];assert.ok(({top:next.y<r.y,bottom:next.y>r.y+r.height,left:next.x<r.x,right:next.x>r.x+r.width})[p.side],`rotation ${rotation}: ${key} must exit ${p.side}`);}
 }
});
