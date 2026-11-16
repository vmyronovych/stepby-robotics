// Editing uses persistent checkpoints; endpoints always remain attached to pins.
export const ROUTE_GRID=12;
export const snapRoute=(value,free=false)=>Math.max(0,Math.min(6000,free?value:Math.round(value/ROUTE_GRID)*ROUTE_GRID));
export function simplifyRoute(points){
 const result=[];
 for(const p of points){const q={x:p.x,y:p.y};if(result.length&&Math.hypot(q.x-result.at(-1).x,q.y-result.at(-1).y)<.01)continue;
  while(result.length>1){const a=result.at(-2),b=result.at(-1);if(!(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-q.x)<.01||Math.abs(a.y-b.y)<.01&&Math.abs(b.y-q.y)<.01))break;result.pop();}result.push(q);
 }
 return result;
}
export function roundedWirePath(points,radius=6){
 if(!points.length)return '';
 let d=`M${points[0].x},${points[0].y}`;
 for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(radius,ab/2,bc/2);if(!r)continue;
  const enter={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab},exit={x:b.x+(c.x-b.x)*r/bc,y:b.y+(c.y-b.y)*r/bc};d+=` L${enter.x},${enter.y} Q${b.x},${b.y} ${exit.x},${exit.y}`;
 }const last=points.at(-1);return d+` L${last.x},${last.y}`;
}
export function moveRouteSegment(points,index,delta,free=false){
 const result=points.map(p=>({x:p.x,y:p.y})),a=result[index],b=result[index+1],horizontal=Math.abs(a.y-b.y)<.01,axis=horizontal?'y':'x',target=snapRoute(a[axis]+delta,free);
 if(index>0&&index+1<result.length-1){a[axis]=b[axis]=target;return simplifyRoute(result).slice(1,-1);}
 // End segments gain two checkpoints instead of moving a physical terminal.
 const p={x:snapRoute(a.x+(b.x-a.x)*.3,free),y:snapRoute(a.y+(b.y-a.y)*.3,free)},q={x:snapRoute(a.x+(b.x-a.x)*.7,free),y:snapRoute(a.y+(b.y-a.y)*.7,free)};p[axis]=q[axis]=target;
 const updated=index===0?[result[0],p,q,...result.slice(result.length===2?1:2)]:[...result.slice(0,-2),p,q,result.at(-1)];return updated.slice(1,-1);
}
