// Geographic building footprints stay independent of photograph contrast and shadows.
function sanitizeMapBuildings(value){
    if(!value||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<1||value.height<1||value.width>12000||value.height>12000||!Array.isArray(value.rings))return null;
    let total=0;const rings=[];
    for(const ring of value.rings.slice(0,2500)){
        if(!Array.isArray(ring)||ring.length<3||ring.length>512||total+ring.length>30000)continue;
        if(!ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=value.width&&p[1]>=0&&p[1]<=value.height))continue;
        rings.push(ring.map(p=>p.map(n=>Math.round(n*100)/100)));total+=ring.length;
    }
    return rings.length?{width:value.width,height:value.height,rings}:null;
}
function clipMapBuilding(points,width,height){
    let polygon=points;
    for(const[axis,bound,sign]of[[0,0,1],[0,width,-1],[1,0,1],[1,height,-1]]){
        const next=[];if(!polygon.length)break;
        for(let i=0;i<polygon.length;i++){
            const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
            if(insideA)next.push(a);
            if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);const p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];p[axis]=bound;next.push(p);}
        }polygon=next;
    }return polygon.map(p=>[Math.max(0,Math.min(width,p[0])),Math.max(0,Math.min(height,p[1]))]);
}
function projectMapBuildings(data,view){
    const world=256*2**view.zoom,left=view.center.x-view.width/2,top=view.center.y-view.height/2,rings=[];
    for(const element of (data?.elements||[]).slice(0,5000)){
        const geometry=element.geometry;if(element.type!=='way'||!Array.isArray(geometry)||geometry.length<4||geometry.length>513)continue;
        const first=geometry[0],last=geometry.at(-1);if(first.lat!==last.lat||first.lon!==last.lon)continue;
        const points=[];for(const node of geometry.slice(0,-1)){
            if(!Number.isFinite(node.lat)||!Number.isFinite(node.lon)||Math.abs(node.lat)>85||Math.abs(node.lon)>180){points.length=0;break;}
            const sine=Math.sin(node.lat*Math.PI/180);let x=(node.lon+180)/360*world;
            while(x-view.center.x>world/2)x-=world;while(x-view.center.x<-world/2)x+=world;
            points.push([x-left,(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*world-top]);
        }
        const ring=clipMapBuilding(points,view.width,view.height);if(ring.length<3)continue;
        const area=Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
        if(area>=4)rings.push(ring);
    }
    return sanitizeMapBuildings({width:view.width,height:view.height,rings});
}
// Scene geometry is bounded before rendering or loading a native project.
function sanitizeMapScene(value){
 if(!value||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<1||value.height<1||value.width>12000||value.height>12000)return null;
 const result={width:value.width,height:value.height,zoom:Math.max(2,Math.min(24,Number(value.zoom)||18)),roads:[],green:[],water:[]};let total=0;
 for(const key of ['roads','green','water'])for(const feature of (Array.isArray(value[key])?value[key]:[]).slice(0,1800)){
  const source=key==='roads'?[feature.points]:feature.rings;if(!Array.isArray(source))continue;const parts=[];
  for(const part of source.slice(0,64)){if(!Array.isArray(part)||part.length<(key==='roads'?2:3)||part.length>2048||total+part.length>50000)continue;
   if(!part.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=value.width&&p[1]>=0&&p[1]<=value.height))continue;
   parts.push(part.map(p=>p.map(n=>Math.round(n*100)/100)));total+=part.length;
  }if(parts.length)result[key].push(key==='roads'?{points:parts[0],class:String(feature.class||'').slice(0,40)}:{rings:parts,class:String(feature.class||'').slice(0,40)});
 }return result;
}
function clipMapRoad(points,width,height){
 const lines=[];let line=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];let low=0,high=1,valid=true;
  for(const[p,q]of[[-dx,a[0]],[dx,width-a[0]],[-dy,a[1]],[dy,height-a[1]]]){if(p===0){if(q<0)valid=false;}else{const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);}}
  if(!valid||low>high){if(line.length>1)lines.push(line);line=[];continue;}const clamp=p=>[Math.max(0,Math.min(width,p[0])),Math.max(0,Math.min(height,p[1]))];
  const start=clamp([a[0]+low*dx,a[1]+low*dy]),end=clamp([a[0]+high*dx,a[1]+high*dy]);
  if(line.length&&Math.hypot(line.at(-1)[0]-start[0],line.at(-1)[1]-start[1])>.01){if(line.length>1)lines.push(line);line=[];}
  if(!line.length)line.push(start);line.push(end);
 }if(line.length>1)lines.push(line);return lines;
}
let mapBuildingSourcePromise=null;
async function fetchMapScene(view,signal){
 if(view.zoom<16)return null;
 if(!mapBuildingSourcePromise)mapBuildingSourcePromise=fetch('https://tiles.openfreemap.org/planet',{signal}).then(r=>{if(!r.ok)throw Error('Map source unavailable');return r.json();}).then(data=>{const template=data.tiles?.[0];if(typeof template!=='string'||!template.startsWith('https://tiles.openfreemap.org/planet/'))throw Error('Invalid map source');return{template,zoom:Math.min(14,Number(data.maxzoom)||14)};}).catch(e=>{mapBuildingSourcePromise=null;throw e;});
 const source=await mapBuildingSourcePromise,z=source.zoom,span=256*2**(view.zoom-z),left=view.center.x-view.width/2,top=view.center.y-view.height/2,tiles=[];
 for(let y=Math.floor(top/span);y<=Math.floor((top+view.height)/span);y++)for(let x=Math.floor(left/span);x<=Math.floor((left+view.width)/span);x++)if(y>=0&&y<2**z)tiles.push({x,y});
 if(tiles.length>16)return null;const buildings=new Map(),scene={width:view.width,height:view.height,zoom:view.zoom,roads:[],green:[],water:[]};let index=0,failed=false;
 async function worker(){while(index<tiles.length){const{x,y}=tiles[index++],tx=((x%2**z)+2**z)%2**z,url=source.template.replace('{z}',z).replace('{x}',tx).replace('{y}',y);const response=await fetch(url,{signal});if(!response.ok){failed=true;continue;}const buffer=await response.arrayBuffer();
  for(const feature of readMapVectorTile(buffer)){
   const parts=feature.parts.map(part=>part.map(p=>[x*span+p[0]/feature.extent*span-left,y*span+p[1]/feature.extent*span-top]));
   if(feature.layer==='building'&&feature.type===3){const area=parts.reduce((sum,ring)=>sum+Math.abs(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1];},0)),0),key=feature.id===null?url+':'+buildings.size:String(feature.id);if(!buildings.has(key)||buildings.get(key).area<area)buildings.set(key,{area,parts});}
   else if(feature.layer==='transportation'&&feature.type===2){for(const part of parts)for(const points of clipMapRoad(part,view.width,view.height))scene.roads.push({points,class:feature.class});}
   else if(feature.type===3){const rings=parts.map(part=>clipMapBuilding(part,view.width,view.height)).filter(part=>part.length>=3);if(!rings.length)continue;
    if(feature.layer==='water')scene.water.push({rings,class:feature.class});
    else if(feature.layer==='park'||['wood','forest','grass','park','recreation_ground','village_green','garden','meadow','farmland','orchard','scrub','heath','nature_reserve','wetland'].includes(feature.class)||['wood','forest','grass','park','garden','meadow','orchard'].includes(feature.subclass))scene.green.push({rings,class:feature.subclass||feature.class});
   }
  }
 }}await Promise.all(Array.from({length:Math.min(4,tiles.length)},worker));if(failed)return null;
 const rings=[...buildings.values()].flatMap(f=>f.parts.map(part=>clipMapBuilding(part,view.width,view.height))).filter(part=>part.length>=3);
 return{buildingOutlines:sanitizeMapBuildings({width:view.width,height:view.height,rings}),mapScene:sanitizeMapScene(scene)};
}
async function fetchMapBuildings(view,signal){return(await fetchMapScene(view,signal))?.buildingOutlines||null;}
async function ensureMapSceneForFloor(floor){
 const meta=floor?.satellite;if(!meta||meta.mapScene||!Array.isArray(meta.center))return;const[lat,lon]=meta.center,zoom=meta.zoom,world=256*2**zoom,sine=Math.sin(lat*Math.PI/180),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const scene=await fetchMapScene({center:{x:(lon+180)/360*world,y:(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*world},zoom,width:meta.buildingOutlines?.width||1684,height:meta.buildingOutlines?.height||1191},controller.signal);
  if(floor.satellite===meta&&scene){meta.mapScene=scene.mapScene;if(scene.buildingOutlines)meta.buildingOutlines=scene.buildingOutlines;}
 }catch{}finally{clearTimeout(timer);}
}
