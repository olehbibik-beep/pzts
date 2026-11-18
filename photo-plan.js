(() => {
    if(window.isGoomReadOnly?.())return;
    const modal=document.createElement('div');modal.id='photoPlanModal';modal.className='modal';
    modal.innerHTML=`<section class="modal-content photo-plan-card" role="dialog" aria-modal="true" aria-labelledby="photoPlanTitle"><div class="photo-plan-heading"><button type="button" id="photoPlanClose" class="btn-cad" aria-label="${tr('Zavřít')}">×</button><h2 id="photoPlanTitle">${tr('Fotografie plánu')}</h2></div><p class="photo-plan-help">${tr('Posuňte čtyři rohy na okraje papíru.')}</p><canvas id="photoPlanPreview" tabindex="0" aria-label="${tr('Rohy fotografie plánu')}"></canvas><div class="photo-plan-actions"><label><input type="checkbox" id="photoPlanClean" checked> ${tr('Vyčistit pozadí')}</label><button type="button" id="photoPlanAdd" class="btn-cad">${tr('Přidat do plánu')}</button></div><p id="photoPlanStatus" role="status"></p></section>`;
    document.body.append(modal);
    const input=document.createElement('input');input.type='file';input.id='photoPlanInput';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;document.body.append(input);
    const canvas=document.getElementById('photoPlanPreview'),ctx=canvas.getContext('2d'),status=document.getElementById('photoPlanStatus'),add=document.getElementById('photoPlanAdd');
    let image=null,corners=[],active=-1,floor=null,uid=null,sequence=0,pending=false;
    function close(){sequence++;modal.style.display='none';active=-1;}
    document.getElementById('photoPlanClose').onclick=close;modal.addEventListener('click',event=>{if(event.target===modal)close();});
    document.getElementById('btnMenuPhoto').onclick=()=>{if(!isSystemReady||!floors[currentFloorIndex])return;floor=floors[currentFloorIndex];uid=window.getFirebaseUser?.()?.uid;input.click();};
    function draw(){if(!image)return;ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.save();ctx.strokeStyle='#87d0ee';ctx.fillStyle='#87d0ee';ctx.lineWidth=2;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke();
        corners.forEach((p,i)=>{ctx.beginPath();ctx.arc(...p,8,0,2*Math.PI);ctx.fill();ctx.fillStyle='#102029';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(i+1,p[0],p[1]+4);ctx.fillStyle='#87d0ee';});ctx.restore();}
    input.onchange=async()=>{const file=input.files[0];input.value='';if(!file||!floor||!isSystemReady)return;const attempt=++sequence;
        try{const loaded=await loadPlanImage(await fileDataURL(file));if(attempt!==sequence||floors[currentFloorIndex]!==floor||uid!==window.getFirebaseUser?.()?.uid)return;
            image=loaded;const factor=Math.min(1,1100/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*factor);canvas.height=Math.round(image.naturalHeight*factor);
            corners=detectPhotoPageCorners(image).map(p=>[p[0]*canvas.width,p[1]*canvas.height]);status.textContent='';mainMenuModal.style.display='none';modal.style.display='flex';draw();
        }catch{void showAppAlert(tr('Fotografii nelze otevřít. Vyberte obrázek JPG nebo PNG.'),tr('Fotografie plánu'));}
    };
    function position(event){const rect=canvas.getBoundingClientRect(),factor=Math.min(rect.width/canvas.width,rect.height/canvas.height),left=(rect.width-canvas.width*factor)/2,top=(rect.height-canvas.height*factor)/2;return [(event.clientX-rect.left-left)/factor,(event.clientY-rect.top-top)/factor];}
    canvas.onpointerdown=event=>{if(pending)return;const p=position(event);active=corners.map(c=>Math.hypot(c[0]-p[0],c[1]-p[1])).reduce((best,d,i,a)=>d<a[best]?i:best,0);canvas.setPointerCapture(event.pointerId);event.preventDefault();};
    canvas.onpointermove=event=>{if(active<0||pending)return;const p=position(event);corners[active]=[Math.max(0,Math.min(canvas.width-1,p[0])),Math.max(0,Math.min(canvas.height-1,p[1]))];draw();};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{active=-1;});
    canvas.onkeydown=event=>{if(event.key==='Tab'||pending)return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[event.key])return;event.preventDefault();if(active<0)active=0;const d=moves[event.key];corners[active]=[Math.max(0,Math.min(canvas.width-1,corners[active][0]+d[0]*(event.shiftKey?10:1))),Math.max(0,Math.min(canvas.height-1,corners[active][1]+d[1]*(event.shiftKey?10:1)))];draw();};
    add.onclick=async()=>{if(pending||!image||floors[currentFloorIndex]!==floor||uid!==window.getFirebaseUser?.()?.uid||window.isGoomReadOnly?.())return;
        const attempt=sequence;pending=true;add.disabled=true;status.textContent=tr('Zpracování fotografie…');
        try{await new Promise(requestAnimationFrame);const points=corners.map(p=>[p[0]/canvas.width,p[1]/canvas.height]);
            const result=rectifyPhotoPlan(image,points,document.getElementById('photoPlanClean').checked),imgData=result.toDataURL('image/png'),loaded=await loadPlanImage(imgData);
            if(attempt!==sequence||modal.style.display!=='flex'||floors[currentFloorIndex]!==floor||uid!==window.getFirebaseUser?.()?.uid)return;
            const candidate={...floor,image:loaded,imgData,pdfSource:null,rasterSource:null,vectorPlan:null,pdfPage:1,satellite:null,sourceName:tr('Fotografie plánu'),planTheme:'light'};candidate.wallMask=createWallMask(candidate,candidate.wallThreshold);
            planPdfCache.get(floor)?.loadingTask?.destroy();planPdfCache.delete(floor);planOriginalCache.delete(floor);planTileCache.delete(floor);
            Object.assign(floor,candidate);window.resetActiveCloudProject?.();close();changeFloor();saveStateToHistory();triggerAutoSave();requestRedraw();
        }catch(error){status.textContent=tr('Zkontrolujte rohy fotografie a zkuste to znovu.');}
        finally{pending=false;add.disabled=false;}
    };
    document.addEventListener('goom-auth-state-changed',()=>{if(uid&&uid!==window.getFirebaseUser?.()?.uid)close();});
})();

function detectPhotoPageCorners(image){
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=Math.max(1,Math.round(180*(image.naturalHeight||image.height)/(image.naturalWidth||image.width)));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height,n=w*h,mask=new Uint8Array(n),seen=new Uint8Array(n),queue=new Int32Array(n);let best=[];
    for(let i=0;i<n;i++){const r=data[4*i],g=data[4*i+1],b=data[4*i+2];mask[i]=Math.min(r,g,b)>165&&Math.max(r,g,b)-Math.min(r,g,b)<65?1:0;}
    for(let seed=0;seed<n;seed++)if(mask[seed]&&!seen[seed]){let head=0,tail=1;queue[0]=seed;seen[seed]=1;while(head<tail){const i=queue[head++];for(const d of [-w,w,-1,1]){const j=i+d;if(j<0||j>=n||d===1&&i%w===w-1||d===-1&&i%w===0||!mask[j]||seen[j])continue;seen[j]=1;queue[tail++]=j;}}if(tail>best.length)best=Array.from(queue.subarray(0,tail));}
    if(best.length<n*.15)return [[.02,.02],[.98,.02],[.98,.98],[.02,.98]];
    const points=best.map(i=>[i%w,Math.floor(i/w)]),extreme=score=>points.reduce((a,b)=>score(b)<score(a)?b:a);
    return [extreme(p=>p[0]+p[1]),extreme(p=>-p[0]+p[1]),extreme(p=>-p[0]-p[1]),extreme(p=>p[0]-p[1])].map(p=>[p[0]/w,p[1]/h]);
}
function rectifyPhotoPlan(image,corners,clean=true){
    if(corners.length!==4||corners.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid page corners');
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,points=corners.map(p=>[p[0]*iw,p[1]*ih]);
    let sign=0;for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)<1||sign&&Math.sign(cross)!==sign)throw Error('Crossed page corners');sign=Math.sign(cross);}
    const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let width=Math.max(distance(points[0],points[1]),distance(points[3],points[2])),height=Math.max(distance(points[0],points[3]),distance(points[1],points[2]));
    const factor=Math.min(1,4000/Math.max(width,height),Math.sqrt(8000000/(width*height)));width=Math.round(width*factor);height=Math.round(height*factor);if(width<16||height<16)throw Error('Page too small');
    const source=document.createElement('canvas');const sf=Math.min(1,5000/Math.max(iw,ih));source.width=Math.round(iw*sf);source.height=Math.round(ih*sf);const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0,source.width,source.height);const src=sc.getImageData(0,0,source.width,source.height).data;
    const p=points.map(q=>[q[0]*sf,q[1]*sf]),uv=[[0,0],[1,0],[1,1],[0,1]],matrix=[];
    for(let i=0;i<4;i++){const [u,v]=uv[i],[x,y]=p[i];matrix.push([u,v,1,0,0,0,-u*x,-v*x,x],[0,0,0,u,v,1,-u*y,-v*y,y]);}
    for(let k=0;k<8;k++){let pivot=k;for(let j=k+1;j<8;j++)if(Math.abs(matrix[j][k])>Math.abs(matrix[pivot][k]))pivot=j;[matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];const div=matrix[k][k];if(Math.abs(div)<1e-9)throw Error('Degenerate page');for(let j=k;j<=8;j++)matrix[k][j]/=div;for(let i=0;i<8;i++)if(i!==k){const d=matrix[i][k];for(let j=k;j<=8;j++)matrix[i][j]-=d*matrix[k][j];}}
    const a=matrix.map(row=>row[8]),out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d'),rgba=ctx.createImageData(width,height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const u=x/Math.max(1,width-1),v=y/Math.max(1,height-1),d=a[6]*u+a[7]*v+1,sx=Math.max(0,Math.min(source.width-1,(a[0]*u+a[1]*v+a[2])/d)),sy=Math.max(0,Math.min(source.height-1,(a[3]*u+a[4]*v+a[5])/d)),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,source.width-1),y1=Math.min(y0+1,source.height-1),fx=sx-x0,fy=sy-y0,index=(y*width+x)*4;
        for(let c=0;c<3;c++)rgba.data[index+c]=src[(y0*source.width+x0)*4+c]*(1-fx)*(1-fy)+src[(y0*source.width+x1)*4+c]*fx*(1-fy)+src[(y1*source.width+x0)*4+c]*(1-fx)*fy+src[(y1*source.width+x1)*4+c]*fx*fy;rgba.data[index+3]=255;
    }
    if(clean){const gray=new Float32Array(width*height),integral=new Float64Array((width+1)*(height+1));for(let y=0;y<height;y++){let sum=0;for(let x=0;x<width;x++){const i=y*width+x;gray[i]=rgba.data[4*i]*.2126+rgba.data[4*i+1]*.7152+rgba.data[4*i+2]*.0722;sum+=gray[i];integral[(y+1)*(width+1)+x+1]=integral[y*(width+1)+x+1]+sum;}}
        const radius=Math.max(12,Math.round(Math.min(width,height)/32));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const left=Math.max(0,x-radius),right=Math.min(width,x+radius+1),top=Math.max(0,y-radius),bottom=Math.min(height,y+radius+1),stride=width+1,mean=(integral[bottom*stride+right]-integral[top*stride+right]-integral[bottom*stride+left]+integral[top*stride+left])/((right-left)*(bottom-top)),i=y*width+x;const value=gray[i]<Math.min(160,mean-15)?52:255;rgba.data[4*i]=rgba.data[4*i+1]=rgba.data[4*i+2]=value;}}
    ctx.putImageData(rgba,0,0);return out;
}
