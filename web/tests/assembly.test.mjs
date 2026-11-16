import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import model from '../src/assembly/model-data.json' with {type:'json'};
const root=new URL('../../',import.meta.url);
const readSource=name=>JSON.parse(fs.readFileSync(new URL('assembly/sources/'+name,root),'utf8'));
const bounds=part=>[0,1,2].map(a=>[Math.min(...part.vertices.map(v=>v[a])),Math.max(...part.vertices.map(v=>v[a]))]);
test('both plates preserve the reviewed contour, open holes and 3 + 30 + 3 mm stack',()=>{
 const trace=readSource('chassis-photo-trace.json'),mesh=readSource('chassis-planar-mesh.json');
 const lower=model.parts.find(p=>p.id==='lower'),upper=model.parts.find(p=>p.id==='upper');
 assert.deepEqual(bounds(lower),[[-75,75],[-127.5,127.5],[0,3]]);
 assert.deepEqual(bounds(upper),[[-75,75],[-127.5,127.5],[33,36]]);
 assert.deepEqual(upper.faces,lower.faces);
 assert.deepEqual(upper.vertices.map(([x,y,z])=>[x,y,z-33]),lower.vertices);
 const top=lower.faces.filter(f=>f.every(i=>lower.vertices[i][2]===3)).map(f=>f.map(i=>lower.vertices[i]));
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 assert.ok(top.every(f=>f.length===3));
 const area=top.reduce((a,[p,q,r])=>a+Math.abs(cross(p,q,r))/2,0);
 assert.ok(Math.abs(area-mesh.area_mm2)<1e-6);
 assert.equal(trace.features.length,72);
 for(const feature of trace.features){
  const centre=[0,1].map(a=>feature.polygon_xy.reduce((s,p)=>s+p[a],0)/feature.polygon_xy.length);
  assert.ok(!top.some(([a,b,c])=>[cross(a,b,centre),cross(b,c,centre),cross(c,a,centre)].every(n=>n>=-1e-8)),feature.id+' must stay open');
 }
 // A closed extrusion has two incident faces on each edge, including hole walls.
 const edges=new Map();
 for(const f of lower.faces)for(let i=0;i<f.length;i++){
  const key=[f[i],f[(i+1)%f.length]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);
 }
 assert.ok([...edges.values()].every(n=>n===2),'no missing wall or capped opening');
});
test('battery uses reviewed underside envelope, with cells inside and no invented straps',()=>{
 const b=readSource('battery-measurements.json'),holder=model.parts.find(p=>p.id==='batteryEnvelope');
 const [x,y]=b.display_pose.centre_xy_mm,z=b.display_pose.top_z_mm;
 const box=bounds(holder);
 assert.deepEqual(box,[[x-b.width_mm/2,x+b.width_mm/2],[y-b.length_mm/2,y+b.length_mm/2],[z-b.height_with_cells_mm,z]]);
 const cells=model.parts.filter(p=>/^cell\d/.test(p.id));assert.equal(cells.length,4);
 for(const cell of cells)bounds(cell).forEach(([min,max],axis)=>assert.ok(min>=box[axis][0]&&max<=box[axis][1]));
 assert.ok(!model.parts.some(p=>/^(strap|batterywall|batterybase|tape)/.test(p.id)));
 assert.equal(model.battery.selected_pose.tape_thickness_mm,null);
 assert.equal(model.battery.selected_pose.centre_xy_mm,null);
 assert.ok(model.wires.find(w=>w.name==='Живлення U2 через захист і S1').points[0][2]<0);
 assert.equal(model.steps.find(s=>s.new===6).view,'bottom');
});
test('base exported mesh matches the current manual OBJ before photo-model substitution',()=>{
 const obj=fs.readFileSync(new URL('assembly/sources/model-demo.obj',root),'utf8');
 const vertices=obj.split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(' ').slice(1).map(Number));
 const actual=model.parts.flatMap(p=>p.faces.flatMap(f=>f.map(i=>p.vertices[i])));
 const manifest=JSON.parse(fs.readFileSync(new URL('assembly/sources/model-manifest.json',root),'utf8'));assert.equal(model.parts.length,manifest.length);assert.equal(actual.length,vertices.length);assert.deepEqual(actual,vertices);
 assert.equal(new Set(model.parts.map(p=>p.key)).size,model.parts.length);
 for(const [file,hash]of Object.entries(model.sourceSHA256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),hash,'Regenerate model after source changes');
});
test('all 19 mechanical assembly pages retain their order and underside battery access',()=>{
 const pages=JSON.parse(fs.readFileSync(new URL('assembly/sources/page-manifest.json',root),'utf8'));
 const builds=model.steps.filter(s=>s.kind==='build');assert.equal(builds.length,pages.length);
 for(let i=0;i<pages.length;i++){const a=builds[i],b=pages[i];assert.equal(a.page,b.page);assert.equal(a.stage,b.stage);assert.equal(a.new,b.new_stage);assert.equal(a.lift,b.lift_mm);assert.equal(a.title,b.title);}
 const inspection=model.steps.findIndex(s=>s.id==='inspection'),cells=model.steps.findIndex(s=>s.new===18);
 assert.ok(inspection<cells);assert.equal(model.steps[cells].stage,18);assert.equal(model.steps[cells].view,'bottom');assert.ok(model.steps.every(s=>s.lift===0));
 assert.equal(model.status,'ILLUSTRATIVE_NOT_FOR_MANUFACTURE');
});
test('raising the electronics leaves chassis and sensor wire endpoints fixed',()=>{
 for(let i=0;i<model.wires.length;i++)for(let j=0;j<model.wires[i].points.length;j++){
  const a=model.wires[i].points[j],b=model.liftedWires[i].points[j];assert.deepEqual(a.slice(0,2),b.slice(0,2));assert.ok([0,82].includes(b[2]-a[2]));
 }
 assert.deepEqual(model.wires[5].points[0],model.liftedWires[5].points[0]);
 assert.ok(model.steps.every(s=>s.title&&s.action&&s.need&&s.check));
});

test('legacy exported CAD keeps its 30P sockets; photo models are tested separately',()=>{
 assert.ok(!model.parts.some(p=>p.id==='carrier'));
 assert.equal(model.parts.filter(p=>p.id==='socketOpening').length,30);
 assert.equal(model.parts.filter(p=>p.id==='expansionPin').length,90);
 const bounds=id=>{const vs=model.parts.find(p=>p.id===id).vertices;return [0,1,2].map(a=>[Math.min(...vs.map(v=>v[a])),Math.max(...vs.map(v=>v[a]))]);};
 const board=bounds('expansion');assert.equal(board[0][1]-board[0][0],51);assert.equal(board[1][1]-board[1][0],66);
 for(const id of ['driver0','driver1','regulator']){const b=bounds(id);assert.ok(b[0][1]<=board[0][0]||b[0][0]>=board[0][1]||b[1][1]<=board[1][0]||b[1][0]>=board[1][1],id+' must not sit on the expansion board');}
 assert.equal(model.parts.filter(p=>p.id==='expansionpost').length,4);
 assert.match(model.steps.find(s=>s.stage===11).need,/30 контактів/);
});
