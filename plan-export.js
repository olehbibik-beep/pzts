let planExportBusy = false;
let planPrintURL;
async function printPlanDirect(){
    const floor=floors[currentFloorIndex];
    if(!floor||!isSystemReady||planExportBusy)return;
    planExportBusy=true;container.setAttribute('aria-busy','true');
    try{
        await new Promise(requestAnimationFrame);
        const coverage=document.getElementById('togglePirCoverage')?.getAttribute('aria-pressed')!=='false';
        const bounds=getPlanOutputBounds(floor,coverage);
        const ratio=Math.min(6000/Math.max(bounds.width,bounds.height),Math.sqrt(PLAN_MAX_PIXELS/(bounds.width*bounds.height)));
        const width=Math.max(1,Math.round(bounds.width*ratio)),height=Math.max(1,Math.round(bounds.height*ratio));
        let image;
        if(floor.pdfSource)image=await rasterizePlanPdf(floor,width*floor.image.width/bounds.width);
        else if(floor.rasterSource)image=await rasterizePlanImage(floor,width*floor.image.width/bounds.width);
        const target=new SVGPlanContext(width,height);
        drawPlanOutput(target,floor,{bounds,widthMM:bounds.width,heightMM:bounds.height,margin:0,options:{theme:'original',coverage}},image);
        if(planPrintURL)URL.revokeObjectURL(planPrintURL);
        planPrintURL=URL.createObjectURL(new Blob([target.toSVG()],{type:'image/svg+xml'}));
        const preview=await loadPlanImage(planPrintURL);preview.alt=`${projectName} – ${floor.name}`;
        let style=document.getElementById('planPrintStyle');if(!style){style=document.createElement('style');style.id='planPrintStyle';document.head.appendChild(style);}
        style.textContent='@media print{@page{size:auto;margin:8mm}html,body{margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;width:auto!important;height:auto!important;overflow:visible!important}#printPage{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;background:#fff!important}#printPage img{width:100%;height:100%;max-width:100%!important;max-height:100%!important;object-fit:contain}}';
        document.getElementById('printPage').replaceChildren(preview);window.print();
    }catch(error){console.error(error);showAppAlert(error.message,tr('Ошибка печати'));}
    finally{planExportBusy=false;container.removeAttribute('aria-busy');}
}
window.addEventListener('afterprint',()=>{if(planPrintURL){URL.revokeObjectURL(planPrintURL);planPrintURL=null;}});
function planOutputOptions() {
    return { paper: document.getElementById('outputPaper').value, orientation: document.getElementById('outputOrientation').value,
        dpi: Number(document.getElementById('outputDpi').value), theme: document.getElementById('outputTheme').value,
        coverage: document.getElementById('outputCoverage').checked };
}
function getPlanOutputBounds(floor,coverage) {
    const base=getProjectBounds(floor,showDeactivatedDevices);
    let left=base.minX,top=base.minY,right=left+base.width,bottom=top+base.height;
    for(const device of floor.devices){
        if(!showDeactivatedDevices && device.type==='deactivated')continue;
        if(coverage && ['pir','pir_wl','glassbreak'].includes(device.type)){
            for(const point of getPIRCoveragePoints(floor,device)||[]){left=Math.min(left,point.x-10);top=Math.min(top,point.y-10);right=Math.max(right,point.x+10);bottom=Math.max(bottom,point.y+10);}
        }
        if(device.manualName){
            const labelScale=1+(Number(document.getElementById('deviceSizeSlider').value)/14-1)*.5;
            ctx.save();ctx.font=device.type==='textNode'?planTextNodeFont(device,labelScale):`${13*labelScale}px sans-serif`;
            const half=ctx.measureText(device.manualName).width/2+32*labelScale;ctx.restore();
            // A circle around text covers any rotation without clipping corners.
            const radius=half+24*labelScale;left=Math.min(left,device.x-radius);right=Math.max(right,device.x+radius);top=Math.min(top,device.y-radius);bottom=Math.max(bottom,device.y+radius);
        }
    }
    return {minX:left,minY:top,width:right-left,height:bottom-top};
}
function planOutputLayout(floor,options=planOutputOptions()) {
    const bounds=getPlanOutputBounds(floor,options.coverage);
    const landscape=options.orientation==='landscape'||(options.orientation==='auto'&&bounds.width>=bounds.height);
    const size=options.paper==='a3'?[297,420]:[210,297];
    const widthMM=landscape?size[1]:size[0],heightMM=landscape?size[0]:size[1];
    return {bounds,widthMM,heightMM,landscape,margin:10,options};
}
function drawPlanOutput(target,floor,layout,imageOverride) {
    const {bounds,options,widthMM,heightMM,margin}=layout;
    const width=target.canvas.width,height=target.canvas.height;
    const marginX=width*margin/widthMM,marginY=height*margin/heightMM;
    const factor=Math.min((width-2*marginX)/bounds.width,(height-2*marginY)/bounds.height);
    target.fillStyle=planBackground(options.theme);target.fillRect(0,0,width,height);
    target.save();target.translate((width-bounds.width*factor)/2-bounds.minX*factor,(height-bounds.height*factor)/2-bounds.minY*factor);target.scale(factor,factor);
    const previousExport=isExporting;
    try{
        isExporting=true;calculateDynamicNumbersGlobal(floors);
        drawPlanSource(target,floor,options.theme,imageOverride);
        if(options.coverage)drawPIRCoverage(target,floor,true);
        drawFloorData(target,floor,true,options.theme);
    }finally{isExporting=previousExport;target.restore();}
}
function updatePlanOutputPreview(){
    const floor=floors[currentFloorIndex];if(!floor)return;
    const layout=planOutputLayout(floor),preview=document.getElementById('outputPreview');
    preview.width=520;preview.height=Math.round(520*layout.heightMM/layout.widthMM);
    drawPlanOutput(preview.getContext('2d'),floor,layout);
    const width=Math.round(layout.widthMM/25.4*layout.options.dpi),height=Math.round(layout.heightMM/25.4*layout.options.dpi);
    document.getElementById('outputSize').textContent=`${layout.widthMM} × ${layout.heightMM} mm · ${width} × ${height} px · ${layout.options.dpi} DPI`;
}
function openPlanOutput(print=false){
    if(print)return printPlanDirect();
    if(!floors[currentFloorIndex] || !isSystemReady)return;
    saveModal.style.display='flex';saveModal.dataset.output=print?'print':'export';updatePlanOutputPreview();
}
async function makePlanOutput(floor,options=planOutputOptions(),svg=false){
    const layout=planOutputLayout(floor,options);
    const width=Math.round(layout.widthMM/25.4*options.dpi),height=Math.round(layout.heightMM/25.4*options.dpi);
    if(width*height>PLAN_MAX_PIXELS)throw new Error(tr('Výstup je příliš velký.'));
    let image;
    if(floor.pdfSource)image=await rasterizePlanPdf(floor,width*floor.image.width/layout.bounds.width);
    else if(floor.rasterSource)image=await rasterizePlanImage(floor,width*floor.image.width/layout.bounds.width);
    if(svg){
        const target=new SVGPlanContext(width,height);drawPlanOutput(target,floor,layout,image);
        return {svg:target.toSVG(),layout};
    }
    const raster=document.createElement('canvas');raster.width=width;raster.height=height;
    drawPlanOutput(raster.getContext('2d'),floor,layout,image);return {raster,layout};
}
function downloadPlanBlob(blob,extension,floor){
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=(projectName||'projekt')+'-'+floor.name+'.'+extension;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportPlanFile(format){
    if(format==='print')return printPlanDirect();
    if(planExportBusy||!isSystemReady||!floors[currentFloorIndex])return;
    planExportBusy=true;const floor=floors[currentFloorIndex],options=planOutputOptions();
    const buttons=[...document.querySelectorAll('#saveModal button')];buttons.forEach(b=>b.disabled=true);
    const status=document.getElementById('outputStatus');status.textContent=tr('Příprava výstupu…');saveModal.setAttribute('aria-busy','true');
    try{
        await new Promise(requestAnimationFrame);
        const result=await makePlanOutput(floor,options,format==='svg');
        if(format==='svg')downloadPlanBlob(new Blob([result.svg],{type:'image/svg+xml;charset=utf-8'}),'svg',floor);
        else if(format==='pdf'){
            await window.planLibrariesReady;
            if(!window.jspdf?.jsPDF)throw new Error(tr('Knihovna PDF není dostupná.'));
            const pdf=new jspdf.jsPDF({orientation:result.layout.landscape?'landscape':'portrait',unit:'mm',format:options.paper,compress:true});
            pdf.addImage(result.raster.toDataURL('image/png'),'PNG',0,0,result.layout.widthMM,result.layout.heightMM,undefined,'FAST');
            pdf.save((projectName||'projekt')+'-'+floor.name+'.pdf');
        }else{
            const mime=format==='jpeg'?'image/jpeg':'image/png';
            const blob=await new Promise(resolve=>result.raster.toBlob(resolve,mime,.96));
            if(!blob)throw new Error(tr('Výstup nelze uložit.'));downloadPlanBlob(blob,format==='jpeg'?'jpg':'png',floor);
        }
        status.textContent=tr('Výstup je připraven.');
    }catch(error){console.error(error);status.textContent=tr('Výstup se nezdařil.');showAppAlert(error.message,tr('Exportovat projekt'));}
    finally{buttons.forEach(b=>b.disabled=false);saveModal.removeAttribute('aria-busy');planExportBusy=false;}
}
document.getElementById('btnOutputClose').addEventListener('click',()=>{if(!planExportBusy)saveModal.style.display='none';});
document.querySelectorAll('#saveModal select,#outputCoverage').forEach(input=>input.addEventListener('change',updatePlanOutputPreview));
new MutationObserver(()=>{if(saveModal.style.display==='flex')updatePlanOutputPreview();}).observe(saveModal,{attributes:true,attributeFilter:['style']});
