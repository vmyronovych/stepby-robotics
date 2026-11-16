// Validate and triangulate the photo trace. This does not assign a plate thickness.
import fs from 'node:fs';
import {ShapeUtils, Vector2} from '../web/node_modules/three/build/three.module.js';
const root=new URL('../',import.meta.url),file=new URL('assembly/sources/chassis-photo-trace.json',root);
const j=JSON.parse(fs.readFileSync(file));
const contour=j.outline.polygon_xy.map(p=>new Vector2(...p));
const holes=j.features.map(f=>f.polygon_xy.map(p=>new Vector2(...p)));
const vertices=[contour,...holes].flat();
const pending=ShapeUtils.triangulateShape(contour,holes),triangles=[];
// Earcut can span several collinear boundary vertices with one edge. Split
// those edges so caps and opening walls meet vertex-for-vertex in 3D.
while(pending.length){
 const triangle=pending.pop();let split=false;
 for(let edge=0;edge<3&&!split;edge++){
  const a=triangle[edge],b=triangle[(edge+1)%3],c=triangle[(edge+2)%3];
  const start=vertices[a],end=vertices[b],dx=end.x-start.x,dy=end.y-start.y,length=dx*dx+dy*dy;
  for(let i=0;i<vertices.length;i++){
   if(triangle.includes(i))continue;
   const px=vertices[i].x-start.x,py=vertices[i].y-start.y,dot=px*dx+py*dy;
   if(dot>1e-8&&dot<length-1e-8&&Math.abs(dx*py-dy*px)<1e-8){
    pending.push([a,i,c],[i,b,c]);split=true;break;
   }
  }
 }
 if(!split)triangles.push(triangle);
}
const area=polygon=>Math.abs(ShapeUtils.area(polygon));
const expected=area(contour)-holes.reduce((sum,p)=>sum+area(p),0);
const actual=triangles.reduce((sum,t)=>sum+area(t.map(i=>vertices[i])),0);
if(Math.abs(expected-actual)>0.01)throw Error(`Hole triangulation mismatch ${actual} != ${expected}`);
const bounds=[0,1].map(a=>{const v=j.outline.polygon_xy.map(p=>p[a]);return Math.max(...v)-Math.min(...v)});
if(bounds[0]!==150||bounds[1]!==255)throw Error(`Unexpected normalized envelope ${bounds}`);
const output={status:j.status,thickness_mm:j.thickness_mm,clear_gap_mm:j.clear_gap_mm,units:'mm',vertices_xy:vertices.map(p=>[p.x,p.y]),triangles,area_mm2:actual,openingCount:holes.length};
fs.writeFileSync(new URL('assembly/sources/chassis-planar-mesh.json',root),JSON.stringify(output)+'\n');
console.log(JSON.stringify({openings:holes.length,triangles:triangles.length,envelope_mm:bounds,areaError:Math.abs(expected-actual),thickness:j.thickness_mm,clearGap:j.clear_gap_mm}));
