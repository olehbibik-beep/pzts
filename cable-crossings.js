// Visual line jumps never create electrical/topological connections.
const cableJumpCache=new WeakMap();
function getCablePaintPlan(floor){
 const nodes=new Map(floor.devices.map(d=>[d.id,d])),routes=[];
 for(const cable of floor.cables){const from=nodes.get(cable.fromId),to=nodes.get(cable.toId);if(!from||!to||from.type==='textNode'||to.type==='textNode'||!showDeactivatedDevices&&(from.type==='deactivated'||to.type==='deactivated'))continue;if(!Number.isFinite(cable.h1x))recalcCableHandles(cable,from,to);routes.push({cable,from,to,points:getCableRoute(cable,from,to)});}
 const signature=routes.map(r=>r.cable.id+':'+r.cable.kind+':'+r.points.map(p=>p.x+','+p.y).join(';')).join('|');const cached=cableJumpCache.get(floor);if(cached?.signature===signature)return cached.plan;
 const plan=new Map(),segments=[];for(const route of routes){const parts=[];plan.set(route.cable.id,parts);route.points.slice(1).forEach((b,index)=>{const a=route.points[index],length=Math.hypot(b.x-a.x,b.y-a.y);parts[index]=[];if(length>.001)segments.push({route,index,a,b,length,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)});});}
 segments.sort((a,b)=>a.minX-b.minX);let active=[],count=0;
 for(const b of segments){active=active.filter(a=>a.maxX>=b.minX);for(const a of active){if(a.maxY<b.minY||b.maxY<a.minY||a.route===b.route&&Math.abs(a.index-b.index)<2)continue;
  const ax=a.b.x-a.a.x,ay=a.b.y-a.a.y,bx=b.b.x-b.a.x,by=b.b.y-b.a.y,den=ax*by-ay*bx;if(Math.abs(den)<1e-8)continue;const dx=b.a.x-a.a.x,dy=b.a.y-a.a.y,t=(dx*by-dy*bx)/den,u=(dx*ay-dy*ax)/den;if(t<-.00001||t>1.00001||u<-.00001||u>1.00001)continue;
  const point={x:a.a.x+t*ax,y:a.a.y+t*ay};const endpoint=[a.route.from,a.route.to].some(d=>Math.hypot(d.x-point.x,d.y-point.y)<1&&([b.route.from.id,b.route.to.id].includes(d.id)||d.attachedCableId===b.route.cable.id))||[b.route.from,b.route.to].some(d=>Math.hypot(d.x-point.x,d.y-point.y)<1&&d.attachedCableId===a.route.cable.id);if(endpoint)continue;
  const availableA=Math.min(t,1-t)*a.length,availableB=Math.min(u,1-u)*b.length;let over,under,position,below;
  if(availableA>=10&&(availableB<10||Math.abs(ax)>=Math.abs(ay))){over=a;under=b;position=t*a.length;below=u*b.length;}else if(availableB>=10){over=b;under=a;position=u*b.length;below=t*a.length;}else continue;
  const radius=over.route.cable.kind==='trunk'?10:7;const marker={start:position-radius,end:position+radius,kind:'bridge',radius};const bridgeParts=plan.get(over.route.cable.id)[over.index];const occupied=bridgeParts.find(m=>m.end>=marker.start-2&&m.start<=marker.end+2);if(occupied){if(occupied.kind==='bridge'&&Math.abs(occupied.start-marker.start)<.001&&Math.abs(occupied.end-marker.end)<.001)plan.get(under.route.cable.id)[under.index].push({start:Math.max(0,below-radius-5),end:Math.min(under.length,below+radius+5),kind:'gap'});continue;}bridgeParts.push(marker);
  const gapParts=plan.get(under.route.cable.id)[under.index],gapRadius=radius+5;gapParts.push({start:Math.max(0,below-gapRadius),end:Math.min(under.length,below+gapRadius),kind:'gap'});if(++count>5000)break;
 }active.push(b);if(count>5000)break;}
 for(const parts of plan.values())for(const events of parts)events.sort((a,b)=>a.start-b.start);plan.crossings=count;cableJumpCache.set(floor,{signature,plan});return plan;
}
function drawCableWithJumps(ctx,points,parts){
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let index=0;index<points.length-1;index++){const a=points[index],b=points[index+1],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.001)continue;const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;let nx=uy,ny=-ux;if(ny>0||Math.abs(ny)<.001&&nx<0){nx=-nx;ny=-ny;}let cursor=0;
  for(const event of parts?.[index]||[]){if(event.end<=cursor)continue;const start=Math.max(cursor,event.start),end=Math.min(length,event.end);ctx.lineTo(a.x+ux*start,a.y+uy*start);if(event.kind==='gap'){ctx.moveTo(a.x+ux*end,a.y+uy*end);}else if(start===event.start){const r=event.radius;ctx.bezierCurveTo(a.x+ux*start+nx*r*1.35,a.y+uy*start+ny*r*1.35,a.x+ux*end+nx*r*1.35,a.y+uy*end+ny*r*1.35,a.x+ux*end,a.y+uy*end);}else ctx.lineTo(a.x+ux*end,a.y+uy*end);cursor=end;}
  ctx.lineTo(b.x,b.y);
 }
}

function getCablePaintSegments(points,parts){
 const segments=[];let cursor=null;const collector={beginPath(){},moveTo(x,y){cursor={x,y};},lineTo(x,y){const end={x,y};if(cursor)segments.push([cursor,end]);cursor=end;},bezierCurveTo(x1,y1,x2,y2,x,y){const start=cursor;for(let i=1;i<=12;i++){const t=i/12,u=1-t;this.lineTo(u*u*u*start.x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x,u*u*u*start.y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y);}}};drawCableWithJumps(collector,points,parts);return segments;
}
