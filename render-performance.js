// Keep the static plan separate from the devices that animate or move over it.
let planScreenCache=null;
let planCameraUntil=0,planCameraTimer,lastPlanView='';
let wheelCamera=null,wheelFrame=0;
const planReducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const planTextWidths=new Map();
function getPlanTextWidth(context,text){
    const key=context.font+'\n'+text;
    if(planTextWidths.has(key))return planTextWidths.get(key);
    if(planTextWidths.size>4000)planTextWidths.clear();
    const width=context.measureText(text).width;planTextWidths.set(key,width);return width;
}
function planCameraBusy(){return isPanning||isDragging||!!wheelCamera||performance.now()<planCameraUntil;}
function trackPlanView(){
    const signature=[currentFloorIndex,scale,offsetX,offsetY,canvas.width,canvas.height].join(':');
    if(signature===lastPlanView)return;
    lastPlanView=signature;planCameraUntil=performance.now()+140;clearTimeout(planCameraTimer);
    planCameraTimer=setTimeout(()=>requestRedraw(),145);
}
function drawPlanScreenBase(target,floor){
    trackPlanView();
    const source=getScreenPlanImage(floor);
    const key=[floor.image,floor.vectorPlan,source,scale,offsetX,offsetY,canvas.width,canvas.height,canvasPixelRatio,
        getPlanTheme(floor),floor.wallMask?.contentBounds,!!floor.previewWalls,floor.previewWalls?floor.wallMask:null,
        document.getElementById('togglePlanGrid')?.getAttribute('aria-pressed')];
    if(!planScreenCache||key.some((value,index)=>value!==planScreenCache.key[index])){
        const surface=planScreenCache?.surface||document.createElement('canvas');
        if(surface.width!==canvas.width)surface.width=canvas.width;
        if(surface.height!==canvas.height)surface.height=canvas.height;
        const base=surface.getContext('2d');base.setTransform(canvasPixelRatio,0,0,canvasPixelRatio,0,0);
        base.fillStyle=planBackground(getPlanTheme(floor));base.fillRect(0,0,planCanvasWidth(),planCanvasHeight());
        base.translate(offsetX,offsetY);base.scale(scale,scale);
        drawPlanSource(base,floor,getPlanTheme(floor),source);drawDetectedWalls(base,floor);drawPlanGrid(base,floor);
        planScreenCache={key,surface};
    }
    target.save();target.setTransform(1,0,0,1,0,0);target.drawImage(planScreenCache.surface,0,0);target.restore();
}
function cancelWheelCamera(){
    wheelCamera=null;if(wheelFrame)cancelAnimationFrame(wheelFrame);wheelFrame=0;
}
function zoomPlanAt(x,y,delta){
    if(!isSystemReady||isOverviewMode)return;
    const current=wheelCamera||{scale,offsetX,offsetY};
    const nextScale=Math.max(.005,Math.min(128,current.scale*Math.exp(-delta*.0015)));
    const ratio=nextScale/current.scale;
    const next={scale:nextScale,offsetX:x-(x-current.offsetX)*ratio,offsetY:y-(y-current.offsetY)*ratio};
    if(planReducedMotion.matches){cancelWheelCamera();({scale,offsetX,offsetY}=next);requestRedraw();return;}
    wheelCamera=next;
    if(wheelFrame)return;
    let previous=performance.now();
    const step=now=>{
        if(!wheelCamera){wheelFrame=0;return;}
        const alpha=1-Math.exp(-Math.min(40,Math.max(1,now-previous))/35);previous=now;
        scale+=(wheelCamera.scale-scale)*alpha;
        offsetX+=(wheelCamera.offsetX-offsetX)*alpha;offsetY+=(wheelCamera.offsetY-offsetY)*alpha;
        if(Math.abs(scale-wheelCamera.scale)<Math.max(.00001,wheelCamera.scale*.0003)&&Math.hypot(offsetX-wheelCamera.offsetX,offsetY-wheelCamera.offsetY)<.15){
            ({scale,offsetX,offsetY}=wheelCamera);wheelCamera=null;wheelFrame=0;
        }else wheelFrame=requestAnimationFrame(step);
        requestRedraw();
    };
    wheelFrame=requestAnimationFrame(step);
}
function syncPlanLoading(){
    const spinner=document.getElementById('planLoading');
    const active=!isSystemReady&&floors.length>0;
    if(spinner.hidden===active)spinner.hidden=!active;
    if(active)container.setAttribute('aria-busy','true');
    else if(typeof planExportBusy==='undefined'||!planExportBusy)container.removeAttribute('aria-busy');
}
new MutationObserver(()=>{
    if(document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])'))cancelWheelCamera();
}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-modal-open']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelWheelCamera();});
