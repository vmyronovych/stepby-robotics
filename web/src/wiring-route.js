// Orthogonal routes keep wires outside module cards. The short first/last
// segments leave each terminal in its outward direction, so an OUT on the
// left cannot visually look like an IN on the right of the same board.
export function routeWire(a,b,rectangles,{clearance=10}={}){
 const outside=p=>p.exit||{x:p.x+(p.side==='left'?-30:p.side==='right'?30:0),y:p.y+(p.side==='top'?-30:p.side==='bottom'?30:0)};
 const start=outside(a),end=outside(b);
 const blocks=rectangles.map(r=>({left:r.x-clearance,right:r.x+r.width+clearance,top:r.y-clearance,bottom:r.y+r.height+clearance}));
 const xs=[...new Set([start.x,end.x,...blocks.flatMap(r=>[r.left-8,r.right+8])])].sort((a,b)=>a-b);
 const ys=[...new Set([start.y,end.y,...blocks.flatMap(r=>[r.top-8,r.bottom+8])])].sort((a,b)=>a-b);
 const nx=xs.length,index=(x,y)=>y*nx+x,source=index(xs.indexOf(start.x),ys.indexOf(start.y)),target=index(xs.indexOf(end.x),ys.indexOf(end.y));
 const point=id=>({x:xs[id%nx],y:ys[Math.floor(id/nx)]});
 const clear=(a,b)=>!blocks.some(r=>a.y===b.y?a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right:a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom);
 const costs=new Map([[source,0]]),previous=new Map(),queue=[{id:source,score:0}],closed=new Set();
 while(queue.length){
  queue.sort((a,b)=>b.score-a.score);const {id}=queue.pop();if(closed.has(id))continue;if(id===target)break;closed.add(id);
  const x=id%nx,y=Math.floor(id/nx),p=point(id);
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
   const xx=x+dx,yy=y+dy;if(xx<0||xx>=nx||yy<0||yy>=ys.length)continue;
   const n=index(xx,yy),q=point(n);if(closed.has(n)||!clear(p,q))continue;
   const cost=costs.get(id)+Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
   if(cost<(costs.get(n)??Infinity)){costs.set(n,cost);previous.set(n,id);queue.push({id:n,score:cost+Math.abs(q.x-end.x)+Math.abs(q.y-end.y)});}
  }
 }
 if(!costs.has(target))return [a,start,{x:end.x,y:start.y},end,b]; // Even the fallback keeps right-angle segments.
 const points=[end];for(let id=target;id!==source;){id=previous.get(id);points.push(point(id));}points.reverse();points.unshift(a);points.push(b);
 return points.filter((p,i)=>i===0||i===points.length-1||!(points[i-1].x===p.x&&p.x===points[i+1].x||points[i-1].y===p.y&&p.y===points[i+1].y));
}
