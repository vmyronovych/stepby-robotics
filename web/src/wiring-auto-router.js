import wasmUrl from '../node_modules/libavoid-js/dist/libavoid.wasm?url';
import {fallbackRouting,fallbackWireRoute,routingScene} from './wiring-routing-scene.js';

// One job in flight and one latest snapshot. Stale routes never reach the canvas.
// A worker timeout preserves editing with the JS fallback instead of freezing UI.
export async function loadWireRouter(onRoute){
 const worker=new Worker(new URL('./wiring-router-worker.js',import.meta.url),{type:'module'});
 let dead=false,ready=false,timer,serial=0,inflight=null,latest=null,result=null,previewKey='',preview=null;const cache=new Map();
 const fail=()=>{dead=true;preview=null;clearTimeout(timer);worker.terminate();onRoute?.();};
 const start=()=>{if(!ready||dead||inflight||!latest)return;inflight=latest;timer=setTimeout(fail,2500);worker.postMessage({type:'route',id:inflight.id,state:inflight.state});};
 await new Promise((resolve,reject)=>{
  timer=setTimeout(()=>{fail();reject(Error('Routing engine initialization timed out'));},10000);
  worker.onerror=e=>{e.preventDefault();fail();reject(Error('Routing worker unavailable'));};
  worker.onmessage=({data})=>{
   if(data.type==='ready'){clearTimeout(timer);ready=true;resolve();return;}
   if(data.type==='error'){fail();reject(Error(data.message));return;}
   if(data.type==='result'){
    clearTimeout(timer);if(inflight?.id===data.id){cache.set(inflight.key,data.result);if(cache.size>32)cache.delete(cache.keys().next().value);result=data.result;}if(latest?.id===data.id)latest=null;inflight=null;start();onRoute?.();
   }
  };
  worker.postMessage({type:'init',wasmUrl:new URL(wasmUrl,location.href).href});
 });
 return Object.assign(state=>{
  const nextKey=JSON.stringify([state.components.map(c=>[c.id,c.kind,c.name,c.x,c.y,c.rotation,c.expansion,c.breadboardMount]),state.wires.map(w=>[w.id,w.a,w.b,w.vertices])]);
  if(cache.has(nextKey)){latest=null;return cache.get(nextKey);}
  if(!dead&&latest?.key!==nextKey){latest={id:++serial,key:nextKey,state:structuredClone(state)};start();}
  if(previewKey!==nextKey||!preview){
   if(dead||!result)preview=fallbackRouting(state);
   else{const scene=routingScene(state);preview={routes:new Map(),warnings:new Set()};for(const w of state.wires){const old=result.routes.get(w.id),a=scene.terminals.get(w.a),b=scene.terminals.get(w.b);if(!old?.length||!a||!b){preview.routes.set(w.id,fallbackWireRoute(w,scene));continue;}const points=old.map(p=>({...p}));if(points.length===2){preview.routes.set(w.id,[{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y}]);continue;}
    if(Math.abs(points[0].x-points[1].x)<.01)points[1].x=a.x;else points[1].y=a.y;
    if(Math.abs(points.at(-1).x-points.at(-2).x)<.01)points.at(-2).x=b.x;else points.at(-2).y=b.y;
    points[0]={x:a.x,y:a.y};points[points.length-1]={x:b.x,y:b.y};preview.routes.set(w.id,points);
   }}previewKey=nextKey;
  }preview.engine=dead?'fallback':'routing';return preview;
 },{dispose(){dead=true;clearTimeout(timer);worker.terminate();}});
}
