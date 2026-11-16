import {physicalLayout} from './wiring-physical.js';
import {mountPins,mountLinks} from './breadboard-mount-data.js';

const world=(c,p)=>({x:c.x+p.x,y:c.y+p.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Hole IDs are the source of truth: moving/rotating the board carries its parts.
export function syncMounts(state){
 for(const c of state.components){
  const m=c.breadboardMount;if(!m)continue;
  const b=state.components.find(b=>b.id===m.boardId);
  if(!b){delete c.breadboardMount;continue;}
  const [first,last]=mountPins(c),layout=physicalLayout(b),a=world(b,layout.points.get(m.holes[first])),z=world(b,layout.points.get(m.holes[last]));
  c.rotation=(Math.round(Math.atan2(z.y-a.y,z.x-a.x)*180/Math.PI)+360)%360;
  const p=physicalLayout(c).points.get(first);c.x=a.x-p.x;c.y=a.y-p.y;
 }
 // Keep a board and its attached parts together at the canvas edges.
 for(const b of state.components.filter(c=>c.kind==='breadboard')){
  const group=state.components.filter(c=>c.id===b.id||c.breadboardMount?.boardId===b.id);
  const dx=Math.max(0,-Math.min(...group.map(c=>c.x))),dy=Math.max(0,-Math.min(...group.map(c=>c.y)));
  for(const c of group){c.x+=dx;c.y+=dy;}
 }
 return state;
}
export function findMount(state,c,tolerance=12){
 const pins=mountPins(c);if(!pins.length)return null;
 const ownLayout=physicalLayout(c),own=pins.map(id=>world(c,ownLayout.points.get(id)));
 const occupied=new Set(mountLinks({...state,components:state.components.filter(n=>n.id!==c.id)}).map(([,hole])=>hole));
 let best=null;
 for(const b of state.components.filter(c=>c.kind==='breadboard')){
  const points=[...physicalLayout(b).points].map(([id,p])=>({id,...world(b,p)}));
  for(const a of points){
   const error=distance(a,own[0]);if(error>tolerance)continue;
   const targets=own.map(p=>points.find(h=>distance(h,{x:a.x+p.x-own[0].x,y:a.y+p.y-own[0].y})<.01));
   if(targets.some(p=>!p))continue;
   const holes=Object.fromEntries(pins.map((pin,i)=>[pin,targets[i].id]));
   const free=pins.every(pin=>{const key=`${b.id}:${holes[pin]}`,leg=`${c.id}:${pin}`;return !occupied.has(key)&&!state.wires.some(w=>(w.a===key||w.b===key)&&!([w.a,w.b].includes(leg)));});
   const x=c.x+a.x-own[0].x,y=c.y+a.y-own[0].y;
   if(!free||x<0||y<0)continue;
   if(!best||error<best.error)best={boardId:b.id,holes,x,y,error,points:targets};
  }
 }
 return best;
}
export function seatComponent(state,c,candidate=findMount(state,c)){
 if(!candidate)return false;
 c.breadboardMount={boardId:candidate.boardId,holes:candidate.holes};c.x=candidate.x;c.y=candidate.y;
 // Convert any old leg-to-hole wires into direct placement, preserving other wiring.
 const pairs=mountLinks({components:[c]}).map(pair=>pair.sort().join('|'));
 state.wires=state.wires.filter(w=>!pairs.includes([w.a,w.b].sort().join('|')));
 state.checked=[];
 return true;
}
export function detachChildren(state,id){for(const c of state.components)if(c.breadboardMount?.boardId===id)delete c.breadboardMount;}
