// Closed vector outlines for satellite photographs. Source pixels remain untouched.
const mapLineworkCache = new WeakMap();
function simplifyMapLine(points, tolerance) {
    const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
    const stack=[[0,points.length-1]],limit=tolerance*tolerance;
    while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],length=dx*dx+dy*dy;
        let best=limit,index=-1;
        for(let i=a+1;i<b;i++){const r=points[i],t=length?Math.max(0,Math.min(1,((r[0]-p[0])*dx+(r[1]-p[1])*dy)/length)):0;
            const distance=(r[0]-p[0]-t*dx)**2+(r[1]-p[1]-t*dy)**2;if(distance>best){best=distance;index=i;}}
        if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}
    }
    return points.filter((_,i)=>keep[i]);
}
function closedMapPath(points) {
    let far=1;for(let i=2;i<points.length;i++)if((points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2>(points[far][0]-points[0][0])**2+(points[far][1]-points[0][1])**2)far=i;
    const p=[...simplifyMapLine(points.slice(0,far+1),1.6).slice(0,-1),...simplifyMapLine([...points.slice(far),points[0]],1.6).slice(0,-1)];
    if(p.length<3)return null;
    const number=n=>Math.round(n*100)/100,format=q=>`${number(q[0])} ${number(q[1])}`;
    const corners=p.map((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);
        // Preserve sharp building corners; round the small turns along curved boundaries.
        const round=lu>2&&lv>2&&(u[0]*v[0]+u[1]*v[1])/(lu*lv)>.57;
        const inset=round?Math.min(lu,lv)*.3:0;
        return {b,start:[b[0]-u[0]*inset/lu,b[1]-u[1]*inset/lu],end:[b[0]+v[0]*inset/lv,b[1]+v[1]*inset/lv],round};
    });
    let path=`M${format(corners[0].end)}`;
    for(let j=1;j<=corners.length;j++){const c=corners[j%corners.length];path+=`L${format(c.start)}`;if(c.round)path+=`Q${format(c.b)} ${format(c.end)}`;}
    return path+'Z';
}
function getMapLinework(image,footerHeight=0) {
    let modes=mapLineworkCache.get(image);if(!modes){modes=new Map();mapLineworkCache.set(image,modes);}let result=modes.get(footerHeight);if(result)return result;
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    // Work at saved map resolution; zoom and SVG export draw the resulting paths directly.
    const w=width,h=Math.max(1,height-footerHeight),n=w*h;
    const sample=document.createElement('canvas');sample.width=w;sample.height=h;
    const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const rgba=ctx.getImageData(0,0,w,h).data,gray=new Float32Array(n),temp=new Float32Array(n),smooth=new Float32Array(n);
    for(let i=0;i<n;i++)gray[i]=rgba[4*i]*.2126+rgba[4*i+1]*.7152+rgba[4*i+2]*.0722;
    const weights=[1,4,6,4,1];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let k=-2;k<=2;k++)sum+=gray[y*w+Math.max(0,Math.min(w-1,x+k))]*weights[k+2];temp[y*w+x]=sum/16;}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let k=-2;k<=2;k++)sum+=temp[Math.max(0,Math.min(h-1,y+k))*w+x]*weights[k+2];smooth[y*w+x]=sum/16;}
    const gradient=new Float32Array(n),hist=new Uint32Array(256);
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;
        const dx=-smooth[i-w-1]+smooth[i-w+1]-2*smooth[i-1]+2*smooth[i+1]-smooth[i+w-1]+smooth[i+w+1];
        const dy=-smooth[i-w-1]-2*smooth[i-w]-smooth[i-w+1]+smooth[i+w-1]+2*smooth[i+w]+smooth[i+w+1];
        gradient[i]=Math.hypot(dx,dy);hist[Math.min(255,Math.round(gradient[i]))]++;
    }
    let cumulative=0,threshold=80;for(let i=0;i<256;i++){cumulative+=hist[i];if(cumulative>=n*.9){threshold=Math.max(80,Math.min(170,i));break;}}
    const edges=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
    for(let i=0;i<n;i++)if(gradient[i]>=threshold){edges[i]=1;queue[tail++]=i;}
    while(head<tail){const i=queue[head++];for(const d of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]){const j=i+d;if(j>=0&&j<n&&!edges[j]&&gradient[j]>=threshold*.52){edges[j]=1;queue[tail++]=j;}}}
    // Close one-pixel breaks, then discard isolated specks and short fragments.
    const dilated=new Uint8Array(n),mask=new Uint8Array(n);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(edges[i+dy*w+dx])dilated[i]=1;}
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;let all=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!dilated[i+dy*w+dx])all=false;mask[i]=all?1:0;}
    const visited=new Uint8Array(n);
    for(let seed=0;seed<n;seed++)if(mask[seed]&&!visited[seed]){head=0;tail=1;queue[0]=seed;visited[seed]=1;let minX=w,minY=h,maxX=0,maxY=0;
        while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
            for(const d of [-w,-1,1,w]){const j=i+d;if(j>=0&&j<n&&mask[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}}}
        if(tail<45||Math.max(maxX-minX,maxY-minY)<12)for(let i=0;i<tail;i++)mask[queue[i]]=0;
    }
    const boundaries=new Map(),stride=w+1;
    function edge(x,y,d){const key=y*stride+x;let a=boundaries.get(key);if(!a){a=[];boundaries.set(key,a);}a.push(d);}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!mask[i])continue;
        if(!mask[i-w])edge(x,y,0);if(!mask[i+1])edge(x+1,y,1);if(!mask[i+w])edge(x+1,y+1,2);if(!mask[i-1])edge(x,y+1,3);
    }
    const paths=[],steps=[1,stride,-1,-stride];
    while(boundaries.size){const start=boundaries.keys().next().value;let key=start,direction=boundaries.get(start)[0],closed=false;const points=[];
        for(let guard=0;guard<n*4;guard++){
            const choices=boundaries.get(key);if(!choices?.length)break;
            let next=choices[0];for(const turn of [1,0,3,2]){const candidate=(direction+turn)%4;if(choices.includes(candidate)){next=candidate;break;}}
            choices.splice(choices.indexOf(next),1);if(!choices.length)boundaries.delete(key);
            points.push([key%stride,Math.floor(key/stride)]);key+=steps[next];direction=next;
            if(key===start){closed=true;break;}
        }
        if(!closed||points.length<48)continue;
        let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
        if(Math.abs(area)<20)continue;
        const path=closedMapPath(points);if(path)paths.push(path);
    }
    result={width,height,paths};modes.set(footerHeight,result);return result;
}
function drawMapScene(target,buildings,scene,image,cartoon=false){
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,reference=scene||buildings;target.save();target.fillStyle=cartoon?'#faf9f4':'#fff';target.fillRect(0,0,width,height);target.scale(width/reference.width,height/reference.height);target.lineJoin='round';target.lineCap='round';
 function path(parts,closed){target.beginPath();for(const part of parts){target.moveTo(...part[0]);for(const p of part.slice(1))target.lineTo(...p);if(closed)target.closePath();}}
 const scale=Math.max(.4,Math.min(4,2**((scene?.zoom||18)-18)));
 for(const feature of scene?.water||[]){path(feature.rings,true);target.fillStyle=cartoon?'#c5e4ec':'#f5f7f8';target.fill('evenodd');target.strokeStyle=cartoon?'#90bcc9':'#c3c8cb';target.lineWidth=.7;target.stroke();}
 let symbols=0;for(const feature of scene?.green||[]){path(feature.rings,true);target.fillStyle=cartoon?'#dce8c9':'#fafbf8';target.fill('evenodd');target.strokeStyle=cartoon?'#b4c992':'#c3c8bd';target.lineWidth=.6;target.stroke();
  const wooded=/wood|forest|park|garden|orchard|scrub/.test(feature.class);const step=(wooded?34:58)*scale,ring=feature.rings[0];let minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minY=Math.min(...ring.map(p=>p[1])),maxY=Math.max(...ring.map(p=>p[1]));
  const inside=(x,y)=>{let yes=false;for(const ring of feature.rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  for(let y=minY+step/2;y<maxY&&symbols<1200;y+=step)for(let x=minX+step/2;x<maxX&&symbols<1200;x+=step){if(!inside(x,y)||!inside(x+6*scale,y)||!inside(x-6*scale,y)||!inside(x,y+6*scale)||!inside(x,y-6*scale))continue;symbols++;
   target.beginPath();if(wooded)target.arc(x,y,5*scale,0,Math.PI*2);else{target.moveTo(x-3*scale,y);target.lineTo(x,y-3*scale);target.lineTo(x+3*scale,y);}target.strokeStyle=cartoon?'#96b47b':'#b9bfb3';target.lineWidth=.65;target.stroke();if(cartoon&&wooded){target.fillStyle='#c4dba8';target.fill();}
  }
 }
 for(const road of scene?.roads||[]){path([road.points],false);const roadWidth=(/motorway|trunk/.test(road.class)?14:/primary|secondary/.test(road.class)?10:/tertiary|minor|service|residential/.test(road.class)?6:2.5)*scale;target.strokeStyle=cartoon?'#b7b5aa':'#9da3a6';target.lineWidth=roadWidth+1;target.stroke();target.strokeStyle=cartoon?(/motorway|trunk|primary/.test(road.class)?'#f1dfb4':'#fffdf8'):'#fff';target.lineWidth=roadWidth;target.stroke();}
 if(buildings){target.strokeStyle=cartoon?'#777e85':'#737b82';target.lineWidth=cartoon?1:.7;target.lineJoin='miter';for(const ring of buildings.rings){path([ring],true);target.fillStyle=cartoon?'#e4e0d6':'#fff';target.fill();target.stroke();}}
 target.restore();
}
function drawMapLinework(target,image,metadata,cartoon=false) {
    const scene=sanitizeMapScene(metadata?.mapScene);
    if(scene&&(scene.roads.length||scene.green.length||scene.water.length)||cartoon&&metadata?.buildingOutlines){drawMapScene(target,sanitizeMapBuildings(metadata?.buildingOutlines),scene,image,cartoon);return;}
    const buildings=sanitizeMapBuildings(metadata?.buildingOutlines);
    if(buildings){
        const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
        target.save();target.fillStyle='#fff';target.fillRect(0,0,width,height);
        target.strokeStyle='#777d82';target.lineWidth=.65;target.lineCap='butt';target.lineJoin='miter';
        const sx=width/buildings.width,sy=height/buildings.height;
        const d=buildings.rings.map(ring=>'M'+ring.map(p=>(Math.round(p[0]*sx*100)/100)+' '+(Math.round(p[1]*sy*100)/100)).join('L')+'Z').join(' ');
        if(target.strokePath)target.strokePath(d);else target.stroke(new Path2D(d));target.restore();return;
    }
    const legacyFooter=metadata?.provider&&metadata.footerHeight!==0?Math.round((image.naturalHeight||image.height)*28/796):0;
    const vector=getMapLinework(image,legacyFooter);target.save();target.fillStyle='#fff';target.fillRect(0,0,vector.width,vector.height);
    target.strokeStyle='#777d82';target.lineWidth=.65;target.lineCap='round';target.lineJoin='round';const d=vector.paths.join(' ');
    if(d){if(target.strokePath)target.strokePath(d);else {vector.nativePath ||= new Path2D(d);target.stroke(vector.nativePath);}}
    target.restore();
}
