import {routeWire} from './wiring-route.js';
import {simplifyRoute} from './wiring-path.js';
import {terminalMap} from './wiring-model.js';
import {physicalLayout} from './wiring-physical.js';
import {PART_LAYOUTS} from './teaching-parts.js';
export const insideObstacle=(p,r,padding=0)=>p.x>r.x-padding&&p.x<r.x+r.width+padding&&p.y>r.y-padding&&p.y<r.y+r.height+padding;
export function routingScene(state){
 const obstacles=[],layouts=new Map(state.components.map(c=>[c.id,physicalLayout(c)]));
 for(const c of state.components){
  const l=layouts.get(c.id),part=PART_LAYOUTS[c.kind];
  if(part){const g=part.grip,corners=[[g.x,g.y],[g.x+g.width,g.y],[g.x,g.y+g.height],[g.x+g.width,g.y+g.height]].map(([x,y])=>l.project(x,part.height-y)),xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);obstacles.push({id:c.id,x:c.x+Math.min(...xs),y:c.y+Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)});}
  // Breadboard is a wiring surface. Only solid parts are obstacles.
  else if(c.kind!=='breadboard')obstacles.push({id:c.id,x:c.x,y:c.y+l.header,width:l.width,height:l.imageHeight,pins:true});
 }
 const terminals=new Map([...terminalMap(state)].map(([key,t])=>{const l=layouts.get(t.component.id),p=l.points.get(t.id);return [key,{x:t.component.x+p.x,y:t.component.y+p.y,side:p.side,shape:obstacles.find(r=>r.id===t.component.id&&r.pins)?.id}];}));
 return {obstacles,terminals};
}

// The small JS router remains available while WASM loads or is unavailable.
export function routingExit(p,obstacles){
 const r=obstacles.find(r=>r.id===p.shape);if(!r)return p;
 return {x:p.side==='left'?r.x-24:p.side==='right'?r.x+r.width+24:p.x,y:p.side==='top'?r.y-24:p.side==='bottom'?r.y+r.height+24:p.y};
}

export function fallbackWireRoute(w,scene,vertices=w.vertices||[]){
 const a=scene.terminals.get(w.a),b=scene.terminals.get(w.b);if(!a||!b)return [];
 const points=[{...a,exit:routingExit(a,scene.obstacles)},...vertices.map(p=>({...p,exit:p})),{...b,exit:routingExit(b,scene.obstacles)}],route=[];
 for(let i=1;i<points.length;i++)route.push(...routeWire(points[i-1],points[i],scene.obstacles));
 return simplifyRoute(route);
}
export function fallbackRouting(state){const scene=routingScene(state);return {routes:new Map(state.wires.map(w=>[w.id,fallbackWireRoute(w,scene)])),warnings:new Set(),engine:'fallback'};}
