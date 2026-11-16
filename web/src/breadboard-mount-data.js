import {HW627,HW627_PINS} from './assembly/hw627.js';
import {BREADBOARD_PINS} from './breadboard.js';

// Footprints use the breadboard's 12-unit pitch, with screen-down Y.
export function mountFootprint(c){
 if(c.kind==='resistor')return {A:{x:0,y:0},B:{x:48,y:0}};
 if(c.kind==='led')return {A:{x:0,y:0},K:{x:12,y:0}};
 if(c.kind==='driver')return Object.fromEntries([HW627_PINS[0],HW627_PINS[6],...HW627_PINS.filter((_,i)=>i!==0&&i!==6)].map(p=>[p.name,{x:p.side==='left'?0:HW627.rowPitchCount*12,y:p.row*12}]));
 return {};
}
export const mountPins=c=>Object.keys(mountFootprint(c));
export const mountLinks=state=>state.components.flatMap(c=>c.breadboardMount?Object.entries(c.breadboardMount.holes).map(([pin,hole])=>[`${c.id}:${pin}`,`${c.breadboardMount.boardId}:${hole}`]):[]);
export function validFootprint(c,holes){
 const footprint=mountFootprint(c),pins=mountPins(c),points=pins.map(id=>BREADBOARD_PINS.find(p=>p.id===holes?.[id]));
 if(!pins.length||points.some(p=>!p))return false;
 return [0,1,2,3].some(turn=>pins.every((id,i)=>{const {x,y}=footprint[id],offset=[{x,y},{x:-y,y:x},{x:-x,y:-y},{x:y,y:-x}][turn];return Math.abs(points[i].x-points[0].x-offset.x)<.001&&Math.abs(points[0].y-points[i].y-offset.y)<.001;}));
}
export function validateMounts(state){
 const occupied=new Set();
 for(const c of state.components){
  const m=c.breadboardMount;if(m===undefined)continue;
  if(!m||!mountPins(c).length||!state.components.some(b=>b.id===m.boardId&&b.kind==='breadboard')||!m.holes||Object.keys(m.holes).length!==mountPins(c).length||!validFootprint(c,m.holes))throw Error('Перевір отвори встановлення компонента на breadboard.');
  for(const hole of Object.values(m.holes)){
   const key=`${m.boardId}:${hole}`;
   if(occupied.has(key)||state.wires.some(w=>w.a===key||w.b===key))throw Error('Цей отвір breadboard уже зайнятий. Обери сусідній отвір тієї самої групи.');
   occupied.add(key);
  }
 }
}
