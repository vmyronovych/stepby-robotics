import {routingScene,insideObstacle,fallbackWireRoute} from './wiring-routing-scene.js';
import {simplifyRoute} from './wiring-path.js';
// libavoid routes the entire graph together, so it can separate shared corridors.
// Stable 0.4.x bindings have no setRoutingCheckpoints; a manual path is represented
// by consecutive connectors with fixed point endpoints (never electrical nodes).
export function createAvoidRouter(A){
 let key='',cached;
 return state=>{
  const scene=routingScene(state),signature=JSON.stringify([scene.obstacles,[...scene.terminals],state.wires.map(w=>[w.id,w.a,w.b,w.vertices])]);
  if(signature===key)return cached;
  const optimize=state.wires.length<=24&&state.wires.reduce((n,w)=>n+(w.vertices?.length||0),0)<=48;
  const router=new A.Router(A.OrthogonalRouting),owned=[],borrowed=[],alloc=o=>(owned.push(o),o),shapes=new Map(),pins=new Map(),legs=new Map(),warnings=new Set();
  const point=p=>alloc(new A.Point(p.x,p.y));
  router.setRoutingParameter(A.segmentPenalty,40);router.setRoutingParameter(A.crossingPenalty,optimize?80:0);router.setRoutingParameter(A.shapeBufferDistance,4);router.setRoutingParameter(A.idealNudgingDistance,12);
  router.setRoutingOption(A.nudgeOrthogonalSegmentsConnectedToShapes,false);router.setRoutingOption(A.nudgeSharedPathsWithCommonEndPoint,optimize);
  try{
   for(const r of scene.obstacles){const rect=alloc(new A.Rectangle(point(r),point({x:r.x+r.width,y:r.y+r.height}))),shape=new A.ShapeRef(router,rect);borrowed.push(shape);shapes.set(r.id,{shape,r});}
   let pinId=1;
   const end=(p,key)=>{
    const shape=p.shape&&shapes.get(p.shape);
    if(!shape)return alloc(new A.ConnEnd(point(p)));
    if(!pins.has(key)){const id=pinId++,r=shape.r,dir={left:A.ConnDirLeft,right:A.ConnDirRight,top:A.ConnDirUp,bottom:A.ConnDirDown}[p.side];const pin=new A.ShapeConnectionPin(shape.shape,id,(p.x-r.x)/r.width,(p.y-r.y)/r.height,true,0,dir);pin.setExclusive(false);borrowed.push(pin);pins.set(key,id);}
    return alloc(new A.ConnEnd(shape.shape,pins.get(key)));
   };
   for(const w of state.wires){
    const a=scene.terminals.get(w.a),b=scene.terminals.get(w.b);if(!a||!b)continue;
    const checkpoints=(w.vertices||[]).filter(p=>{const blocked=scene.obstacles.some(r=>insideObstacle(p,r,4));if(blocked)warnings.add(w.id);return !blocked;});
    const ends=[end(a,w.a),...checkpoints.map(p=>end(p)),end(b,w.b)],connectors=[];
    for(let i=1;i<ends.length;i++){const conn=new A.ConnRef(router,ends[i-1],ends[i]);conn.setHateCrossings(optimize);borrowed.push(conn);connectors.push(conn);}legs.set(w.id,connectors);
   }
   router.processTransaction();
   const routes=new Map();
   for(const [id,connectors]of legs){const points=[];for(const conn of connectors){const line=conn.displayRoute();borrowed.push(line);for(let i=0;i<line.size();i++){const p=line.get_ps(i);borrowed.push(p);points.push({x:p.x,y:p.y});}}const w=state.wires.find(w=>w.id===id),a=scene.terminals.get(w.a),b=scene.terminals.get(w.b),result=simplifyRoute(points);
    const valid=result.length>=2&&result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&Math.hypot(result[0].x-a.x,result[0].y-a.y)<.01&&Math.hypot(result.at(-1).x-b.x,result.at(-1).y-b.y)<.01&&result.slice(1).every((p,i)=>Math.abs(p.x-result[i].x)<.01||Math.abs(p.y-result[i].y)<.01);
    routes.set(id,valid?result:fallbackWireRoute(w,scene,(w.vertices||[]).filter(p=>!scene.obstacles.some(r=>insideObstacle(p,r,4)))));}
   cached={routes,warnings,engine:'libavoid'};key=signature;return cached;
  }finally{
   // Router owns shapes, pins, connectors and displayRoute points. Remove only
   // their JS wrapper cache entries after native destruction (no double-free).
   A.destroy(router);for(const obj of borrowed){const cache=A.getCache(A.getClass(obj));delete cache[A.getPointer(obj)];}
   for(const obj of owned.reverse())A.destroy(obj);
  }
 };
}
