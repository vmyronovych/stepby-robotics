import {syncMounts} from './breadboard-mount.js';
import {physicalLayout} from './wiring-physical.js';

export function movingComponentIds(state,selected){
 const ids=new Set(selected);
 for(const c of state.components)if(ids.has(c.breadboardMount?.boardId))ids.add(c.id);
 return ids;
}

// Always derive a preview from the original state, so pointer events do not
// accumulate rounding errors or move an explicitly selected mounted part twice.
export function moveComponentGroup(start,selected,dx,dy,routes=new Map()){
 const next=structuredClone(start),ids=movingComponentIds(start,selected);
 const components=start.components.filter(c=>ids.has(c.id));
 if(!components.length)return next;
 const internal=start.wires.filter(w=>[w.a,w.b].every(key=>ids.has(key.split(':')[0])));
 const vertices=new Map(internal.map(w=>[w.id,w.vertices??routes.get(w.id)?.slice(1,-1)??[]]));
 const bends=[...vertices.values()].flat();
 const minX=Math.min(...components.map(c=>c.x),...bends.map(p=>p.x));
 const minY=Math.min(...components.map(c=>c.y),...bends.map(p=>p.y));
 dx=Math.max(-minX,Math.min(Math.round(dx),...components.map(c=>Math.max(c.x,1700)-c.x),...bends.map(p=>6000-p.x)));
 dy=Math.max(-minY,Math.min(Math.round(dy),...components.map(c=>Math.max(c.y,1500-physicalLayout(c).height)-c.y),...bends.map(p=>6000-p.y)));
 for(const c of next.components)if(ids.has(c.id)){
  if(c.breadboardMount&&!ids.has(c.breadboardMount.boardId))delete c.breadboardMount;
  c.x+=dx;c.y+=dy;
 }
 for(const w of next.wires)if(vertices.has(w.id)){
  const points=vertices.get(w.id);
  if(points.length<=32&&(points.length||w.vertices))w.vertices=points.map(p=>({x:p.x+dx,y:p.y+dy}));
 }
 syncMounts(next);
 if(components.some(c=>c.breadboardMount&&!ids.has(c.breadboardMount.boardId)))next.checked=[];
 return next;
}
