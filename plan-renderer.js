// Source pixels, presentation and wall detection deliberately stay independent.
const planRasterCache = new WeakMap();
const planPdfCache = new WeakMap();
const planMaskPreviewCache = new WeakMap();
const planVectorPathCache = new WeakMap();
const PLAN_DARK = '#181a1d';
const PLAN_MAX_PIXELS = 24000000;
function getPlanTheme(floor) { return floor.planTheme === 'original' ? 'original' : 'dark'; }
function planBackground(theme) { return theme === 'dark' ? PLAN_DARK : '#ffffff'; }
function resizePlanCanvas() {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    canvasPixelRatio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(12000000 / (width * height)));
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    const pixelWidth=Math.round(width*canvasPixelRatio),pixelHeight=Math.round(height*canvasPixelRatio);
    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
    if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
}
new ResizeObserver(()=>{if(!isExporting){resizePlanCanvas();requestRedraw();}}).observe(container);
function planCanvasWidth() { return canvas.width / canvasPixelRatio; }
function planCanvasHeight() { return canvas.height / canvasPixelRatio; }

function getDarkPlanImage(image) {
    let result = planRasterCache.get(image);
    if (result) return result;
    result = document.createElement('canvas');
    result.width = image.naturalWidth || image.width; result.height = image.naturalHeight || image.height;
    const target = result.getContext('2d');
    target.fillStyle = '#fff'; target.fillRect(0, 0, result.width, result.height);
    target.filter = 'grayscale(1)';
    target.drawImage(image, 0, 0);
    // Native canvas compositing avoids a full-resolution JavaScript pixel loop on the UI thread.
    target.filter = 'none'; target.globalCompositeOperation = 'difference';
    target.fillStyle = '#fff'; target.fillRect(0, 0, result.width, result.height);
    target.globalCompositeOperation = 'screen'; target.fillStyle = PLAN_DARK;
    target.fillRect(0, 0, result.width, result.height); target.globalCompositeOperation = 'source-over';
    planRasterCache.set(image, result);
    return result;
}
function drawVectorPlan(target, vector, theme) {
    target.save(); target.strokeStyle = theme === 'dark' ? '#f2f4f7' : '#121214';
    target.lineWidth = vector.lineWidth || 1.5; target.lineCap = 'round'; target.lineJoin = 'round';
    if(target.strokePath)for(const d of vector.paths)target.strokePath(d);
    else {
        let path=planVectorPathCache.get(vector);
        if(!path){path=new Path2D(vector.paths.join(' '));planVectorPathCache.set(vector,path);}
        target.stroke(path);
    }
    target.restore();
}
function drawPlanSource(target, floor, theme = getPlanTheme(floor), imageOverride) {
    if (!floor.image) return;
    const width = floor.image.naturalWidth || floor.image.width, height = floor.image.naturalHeight || floor.image.height;
    target.save(); target.fillStyle = planBackground(theme); target.fillRect(0, 0, width, height);
    if (floor.vectorPlan) drawVectorPlan(target, floor.vectorPlan, theme);
    else {
        const image = imageOverride || floor.image;
        target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
        target.drawImage(theme === 'dark' ? getDarkPlanImage(image) : image, 0, 0, width, height);
    }
    target.restore();
}
function drawDetectedWalls(target,floor) {
    const mask=floor.wallMask;
    if(!floor.previewWalls || !mask)return;
    let overlay=planMaskPreviewCache.get(mask);
    if(!overlay){
        overlay=document.createElement('canvas');overlay.width=mask.width;overlay.height=mask.height;
        const context=overlay.getContext('2d'),pixels=context.createImageData(mask.width,mask.height);
        for(let i=0;i<mask.data.length;i++)if(mask.data[i]){pixels.data[i*4]=251;pixels.data[i*4+1]=191;pixels.data[i*4+2]=36;pixels.data[i*4+3]=190;}
        context.putImageData(pixels,0,0);planMaskPreviewCache.set(mask,overlay);
    }
    target.save();target.imageSmoothingEnabled=false;target.drawImage(overlay,0,0,mask.imageWidth,mask.imageHeight);target.restore();
}

function fileDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
    });
}
function loadPlanImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(tr('Výkres nelze načíst.'))); image.src = src;
    });
}
async function getPlanPdfPage(floor) {
    let cached = planPdfCache.get(floor);
    if (!cached) {
        cached = { promise: (async () => {
            await window.planLibrariesReady;
            if (!window.pdfjsLib?.getDocument) throw new Error(tr('Knihovna PDF není dostupná.'));
            const bytes = Uint8Array.from(atob(floor.pdfSource.split(',')[1]), c => c.charCodeAt(0));
            const document = await pdfjsLib.getDocument({ data: bytes }).promise;
            cached.document = document;
            return document.getPage(floor.pdfPage || 1);
        })(), raster: null, pending: false, failed: false };
        planPdfCache.set(floor, cached);
    }
    return cached.promise;
}
async function rasterizePlanPdf(floor, desiredWidth) {
    const page = await getPlanPdfPage(floor), base = page.getViewport({ scale: 1 });
    const factor = Math.min(desiredWidth / base.width, 12000 / Math.max(base.width, base.height), Math.sqrt(PLAN_MAX_PIXELS / (base.width * base.height)));
    const viewport = page.getViewport({ scale: factor });
    const raster = document.createElement('canvas'); raster.width = Math.ceil(viewport.width); raster.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: raster.getContext('2d'), viewport, background: '#ffffff' }).promise;
    return raster;
}
function getScreenPlanImage(floor) {
    if (!floor.pdfSource || isDragging || isPanning) return floor.image;
    const desiredWidth = Math.min((floor.image.naturalWidth || floor.image.width) * scale * canvasPixelRatio,
        12000, Math.sqrt(PLAN_MAX_PIXELS * floor.image.width / floor.image.height));
    const cache = planPdfCache.get(floor);
    const available = cache?.raster || floor.image;
    const baseWidth = available.naturalWidth || available.width;
    if (desiredWidth > baseWidth * 1.35 && !cache?.pending && !cache?.failed) {
        // Keep the previous image visible while the higher resolution is prepared.
        getPlanPdfPage(floor);
        const state = planPdfCache.get(floor); state.pending = true;
        rasterizePlanPdf(floor, desiredWidth * 1.15).then(raster => {
            state.raster = raster;
        }).catch(error => { state.failed = true; console.warn('PDF detail:', error); }).finally(() => {
            state.pending = false; requestRedraw();
        });
    }
    return available;
}

// Only supported DXF geometry is imported; unsupported entities are reported, never silently claimed as complete.
function makeVectorPlan(dxf) {
    const paths = [], points = [], unsupported = new Set();
    const addPoint = p => { if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) points.push(p); };
    const entities = dxf.entities || [];
    for (const e of entities) {
        if (['LINE','LWPOLYLINE','POLYLINE'].includes(e.type)) {
            const vertices=e.vertices||[];vertices.forEach(addPoint);
            for(let i=0;i<vertices.length-(e.shape?0:1);i++){
                const a=vertices[i],b=vertices[(i+1)%vertices.length],bulge=Number(a.bulge)||0;
                if(!bulge)continue;
                const dx=b.x-a.x,dy=b.y-a.y,offset=(1-bulge*bulge)/(4*bulge);
                const cx=(a.x+b.x)/2-dy*offset,cy=(a.y+b.y)/2+dx*offset;
                const r=Math.hypot(dx,dy)*(1+bulge*bulge)/(4*Math.abs(bulge));
                addPoint({x:cx-r,y:cy-r});addPoint({x:cx+r,y:cy+r});
            }
        }
        else if (['CIRCLE','ARC'].includes(e.type) && Number.isFinite(e.radius) && e.radius > 0) {
            addPoint({x:e.center.x-e.radius,y:e.center.y-e.radius}); addPoint({x:e.center.x+e.radius,y:e.center.y+e.radius});
        } else unsupported.add(e.type);
    }
    if (!points.length) throw new Error(tr('DXF neobsahuje podporované čáry.'));
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const p of points) { minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y); }
    const extent = Math.max(maxX-minX,maxY-minY,1), factor = 3800 / extent, pad = 50;
    const width = Math.ceil((maxX-minX)*factor+pad*2), height=Math.ceil((maxY-minY)*factor+pad*2);
    const tx = x => (x-minX)*factor+pad, ty = y => (maxY-y)*factor+pad;
    const segment = (a,b) => {
        const bulge = Number(a.bulge) || 0;
        if (Math.abs(bulge) < 1e-8) return `L${tx(b.x)} ${ty(b.y)}`;
        const radius = Math.hypot(b.x-a.x,b.y-a.y)*(1+bulge*bulge)/(4*Math.abs(bulge))*factor;
        return `A${radius} ${radius} 0 ${Math.abs(bulge)>1?1:0} ${bulge>0?0:1} ${tx(b.x)} ${ty(b.y)}`;
    };
    for (const e of entities) {
        if (['LINE','LWPOLYLINE','POLYLINE'].includes(e.type) && e.vertices?.length>1) {
            const v=e.vertices; let d=`M${tx(v[0].x)} ${ty(v[0].y)}`;
            for(let i=1;i<v.length;i++)d+=segment(v[i-1],v[i]);
            if(e.shape)d+=segment(v[v.length-1],v[0])+'Z'; paths.push(d);
        } else if (['CIRCLE','ARC'].includes(e.type) && Number.isFinite(e.radius) && e.radius>0) {
            const cx=tx(e.center.x),cy=ty(e.center.y),r=e.radius*factor;
            if(e.type==='CIRCLE')paths.push(`M${cx+r} ${cy}A${r} ${r} 0 1 0 ${cx-r} ${cy}A${r} ${r} 0 1 0 ${cx+r} ${cy}`);
            else {
                const a=e.startAngle,b=e.endAngle,span=((b-a)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
                paths.push(`M${cx+r*Math.cos(a)} ${cy-r*Math.sin(a)}A${r} ${r} 0 ${span>Math.PI?1:0} 0 ${cx+r*Math.cos(b)} ${cy-r*Math.sin(b)}`);
            }
        }
    }
    return { width,height,paths,lineWidth:1.5,unsupported:[...unsupported] };
}
async function importPlanSource(file, floor) {
    let image, imgData, vectorPlan=null, pdfSource=null, pdfPage=1, pdfState;
    if (/\.pdf$/i.test(file.name) || file.type==='application/pdf') {
        pdfSource = (await fileDataURL(file)).replace(/^data:[^,]*,/, 'data:application/pdf;base64,');
        const candidate = { pdfSource, pdfPage };
        await getPlanPdfPage(candidate);
        pdfState=planPdfCache.get(candidate);
        const pdf=pdfState.document;
        if(pdf.numPages>1) {
            const answer=await showAppPrompt(tr`Číslo stránky PDF (1–${pdf.numPages})`, '1', tr('Import PDF'));
            if(answer===null){await pdf.destroy();return null;}
            pdfPage=Number(answer);
            if(!Number.isInteger(pdfPage)||pdfPage<1||pdfPage>pdf.numPages){await pdf.destroy();throw new Error(tr('Neplatné číslo stránky.'));}
        }
        candidate.pdfPage=pdfPage; pdfState.promise=pdf.getPage(pdfPage);
        const page=await getPlanPdfPage(candidate), base=page.getViewport({scale:3});
        const raster=await rasterizePlanPdf(candidate,Math.min(base.width,Math.sqrt(12000000*base.width/base.height)));
        imgData=raster.toDataURL('image/png'); image=await loadPlanImage(imgData);
    } else if (/\.dxf$/i.test(file.name)) {
        await window.planLibrariesReady;
        if(!window.DxfParser)throw new Error(tr('Knihovna DXF není dostupná.'));
        vectorPlan=makeVectorPlan(new DxfParser().parseSync(await file.text()));
        const raster=document.createElement('canvas');raster.width=vectorPlan.width;raster.height=vectorPlan.height;
        const target=raster.getContext('2d');target.fillStyle='#fff';target.fillRect(0,0,raster.width,raster.height);
        drawVectorPlan(target,vectorPlan,'original');imgData=raster.toDataURL('image/png');image=await loadPlanImage(imgData);
    } else {
        imgData=await fileDataURL(file);image=await loadPlanImage(imgData);
        if(image.naturalWidth*image.naturalHeight>PLAN_MAX_PIXELS || Math.max(image.naturalWidth,image.naturalHeight)>16000)
            throw new Error(tr('Obrázek je příliš velký. Použijte nejvýše 24 Mpx a stranu 16000 px.'));
    }
    const candidate={...floor,image,imgData,vectorPlan,pdfSource,pdfPage,planTheme:'dark',sourceName:file.name};
    candidate.wallMask=createWallMask(candidate,candidate.wallThreshold);
    if(pdfState)planPdfCache.set(floor,pdfState);else planPdfCache.delete(floor);
    return candidate;
}

function sanitizeVectorPlan(value) {
    if(!value || !Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width<=0 || value.height<=0 ||
        !Array.isArray(value.paths) || value.paths.length>100000) return null;
    if(!value.paths.every(d=>typeof d==='string' && d.length<2000000 && /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+\-]+$/.test(d)))return null;
    return { width:value.width,height:value.height,paths:value.paths,lineWidth:1.5,unsupported:Array.isArray(value.unsupported)?value.unsupported:[] };
}
