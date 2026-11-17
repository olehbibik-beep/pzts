let planExportBusy = false;
const planPrintURLs = [];
async function printPlanDirect(){
    if(!isSystemReady||planExportBusy)return;
    const printFloors = floors.filter(floor => floor.image || floor.legend?.visible && floor.legend.entries?.length
        || floor.devices.some(device => showDeactivatedDevices || device.type !== 'deactivated'));
    if (!printFloors.length) {
        showAppAlert(tr('Projekt neobsahuje žádné podlaží k tisku.'), tr('Ошибка печати'));
        return;
    }
    const printedProjectName = projectName;
    planExportBusy=true;container.setAttribute('aria-busy','true');
    try{
        clearPrintPage();
        const printPage = document.getElementById('printPage');
        printPage.toggleAttribute('data-tablet-print', matchMedia('(any-pointer: coarse)').matches);
        await new Promise(requestAnimationFrame);
        if (!window.hasProAccess?.()) await emptyCanvasLogo.decode().catch(() => {});
        const sheets = document.createDocumentFragment();
        for (const floor of printFloors) {
            const options = planOutputOptions(floor);
            const bounds = getPlanOutputBounds(floor, options.coverage);
            const ratio = Math.min(6000 / Math.max(bounds.width, bounds.height),
                Math.sqrt(PLAN_MAX_PIXELS / (bounds.width * bounds.height)));
            const width = Math.max(1, Math.round(bounds.width * ratio));
            const height = Math.max(1, Math.round(bounds.height * ratio));
            const image = await rasterizePlanOutputSource(floor, width, bounds);
            const target = new SVGPlanContext(width, height);
            drawPlanOutput(target, floor, { bounds, widthMM: bounds.width, heightMM: bounds.height, margin: 0, options }, image);
            const url = URL.createObjectURL(new Blob([target.toSVG()], { type: 'image/svg+xml;charset=utf-8' }));
            planPrintURLs.push(url);
            const preview = await loadPlanImage(url);
            preview.className = 'plan-print-image';
            preview.alt = `${printedProjectName} – ${floor.name}`;
            await preview.decode();

            const sheet = document.createElement('section');
            sheet.className = 'plan-print-sheet';
            const header = document.createElement('header');
            header.className = 'plan-print-header';
            const title = document.createElement('strong');
            title.textContent = printedProjectName;
            const floorName = document.createElement('span');
            floorName.textContent = floor.name;
            header.append(title, floorName);
            sheet.append(header, preview);
            sheets.append(sheet);
        }
        printPage.replaceChildren(sheets);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        window.print();
    }catch(error){console.error(error);clearPrintPage();showAppAlert(error.message,tr('Ошибка печати'));}
    finally{planExportBusy=false;container.removeAttribute('aria-busy');}
}
function clearPrintPage(){
    document.getElementById('printPage').replaceChildren();
    for (const url of planPrintURLs) URL.revokeObjectURL(url);
    planPrintURLs.length = 0;
}
window.addEventListener('afterprint',clearPrintPage);
function planOutputOptions(floor) {
    return { paper:'a4', orientation:'auto', dpi:300, theme:getPlanTheme(floor), coverage:isPirCoverageVisible() };
}
function getPlanOutputBounds(floor,coverage) {
    const base=getProjectBounds(floor,showDeactivatedDevices);
    let left=base.minX,top=base.minY,right=left+base.width,bottom=top+base.height;
    for(const device of floor.devices){
        if(!showDeactivatedDevices && device.type==='deactivated')continue;
        if(coverage && ['pir','pir_wl','glassbreak'].includes(device.type)){
            for(const point of getPIRCoveragePoints(floor,device)||[]){left=Math.min(left,point.x-10);top=Math.min(top,point.y-10);right=Math.max(right,point.x+10);bottom=Math.max(bottom,point.y+10);}
        }
        if (device.type === 'textNode') {
            const labelScale = 1 + (Number(document.getElementById('deviceSizeSlider').value) / 14 - 1) * .5;
            ctx.save();
            const { width, height } = getPlanTextLayout(ctx, device, labelScale);
            ctx.restore();
            const angle = (device.rotation || 0) * Math.PI / 180;
            const halfWidth = (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) / 2 + 10;
            const halfHeight = (Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))) / 2 + 10;
            left = Math.min(left, device.x - halfWidth); right = Math.max(right, device.x + halfWidth);
            top = Math.min(top, device.y - halfHeight); bottom = Math.max(bottom, device.y + halfHeight);
        } else if(device.manualName){
            const labelScale=1+(Number(document.getElementById('deviceSizeSlider').value)/14-1)*.5;
            ctx.save();ctx.font=`${13*labelScale}px sans-serif`;
            const half=ctx.measureText(device.manualName).width/2+32*labelScale;ctx.restore();
            // A circle around text covers any rotation without clipping corners.
            const radius=half+24*labelScale;left=Math.min(left,device.x-radius);right=Math.max(right,device.x+radius);top=Math.min(top,device.y-radius);bottom=Math.max(bottom,device.y+radius);
        }
    }
    return {minX:left,minY:top,width:right-left,height:bottom-top};
}
function planOutputLayout(floor,options=planOutputOptions(floor)) {
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
    const contentX=(width-bounds.width*factor)/2-bounds.minX*factor;
    const contentY=(height-bounds.height*factor)/2-bounds.minY*factor;
    target.save();
    const previousExport=isExporting;
    try{
        isExporting=true;calculateDynamicNumbersGlobal(floors);
        target.save();target.translate(contentX,contentY);target.scale(factor,factor);
        try { drawPlanSource(target,floor,options.theme,imageOverride); }
        finally { target.restore(); }
        drawFreePlanWatermark(target,width,height,options.theme);
        target.translate(contentX,contentY);target.scale(factor,factor);
        if(options.coverage)drawPIRCoverage(target,floor,true);
        drawFloorData(target,floor,true,options.theme);
    }finally{isExporting=previousExport;target.restore();}
}
function updatePlanOutputPreview(){
    const floor=floors[currentFloorIndex];if(!floor)return;
    const layout=planOutputLayout(floor),preview=document.getElementById('outputPreview');
    preview.width=520;preview.height=Math.round(520*layout.heightMM/layout.widthMM);
    drawPlanOutput(preview.getContext('2d'),floor,layout);
}
function openPlanOutput(){
    if(!floors[currentFloorIndex] || !isSystemReady)return;
    saveModal.style.display='flex';
    document.getElementById('outputStatus').textContent='';
}
async function makePlanOutput(floor,options=planOutputOptions(floor),svg=false){
    const layout=planOutputLayout(floor,options);
    const width=Math.round(layout.widthMM/25.4*options.dpi),height=Math.round(layout.heightMM/25.4*options.dpi);
    if(width*height>PLAN_MAX_PIXELS)throw new Error(tr('Výstup je příliš velký.'));
    const image = await rasterizePlanOutputSource(floor, width, layout.bounds);
    if (!window.hasProAccess?.()) await emptyCanvasLogo.decode().catch(() => {});
    if(svg){
        const target=new SVGPlanContext(width,height);drawPlanOutput(target,floor,layout,image);
        return {svg:target.toSVG(),layout};
    }
    const raster=document.createElement('canvas');raster.width=width;raster.height=height;
    drawPlanOutput(raster.getContext('2d'),floor,layout,image);return {raster,layout};
}
function rasterizePlanOutputSource(floor, width, bounds) {
    if (!floor.image) return;
    const requestedWidth = width * floor.image.width / bounds.width;
    if (floor.pdfSource) return rasterizePlanPdf(floor, requestedWidth);
    if (floor.rasterSource) return rasterizePlanImage(floor, requestedWidth);
}
function downloadPlanBlob(blob,extension,floor){
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=(projectName||'projekt')+'-'+floor.name+'.'+extension;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportPlanFile(format){
    if(planExportBusy||!isSystemReady||!floors[currentFloorIndex])return;
    planExportBusy=true;const floor=floors[currentFloorIndex],options=planOutputOptions(floor);
    const buttons=[...document.querySelectorAll('#saveModal button:not(:disabled)')];buttons.forEach(b=>b.disabled=true);
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
new MutationObserver(()=>{if(saveModal.style.display==='flex')updatePlanOutputPreview();}).observe(saveModal,{attributes:true,attributeFilter:['style']});
emptyCanvasLogo.addEventListener('load', () => {
    if (isSystemReady && saveModal.style.display === 'flex') updatePlanOutputPreview();
});
document.addEventListener('goom-account-changed', () => {
    requestRedraw();
    if (isSystemReady && saveModal.style.display === 'flex') updatePlanOutputPreview();
});
