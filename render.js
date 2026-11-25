// ==========================================
// 5. RENDER: VYKRESLOVÁNÍ KANVASU
// ==========================================

function drawArrow(ctx, x, y, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, 0); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawDirectLeaderLine(ctx, x1, y1, x2, y2, color, lineWidth, arrowStart, arrowEnd) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
    let angle = Math.atan2(y2 - y1, x2 - x1);
    if (arrowEnd) drawArrow(ctx, x2, y2, angle, color);
    if (arrowStart) drawArrow(ctx, x1, y1, angle + Math.PI, color);
}

function cableRouteColor(from,to) {
    const types=[from.type,to.type].map(type=>type==='deactivated'?null:type);
    if(types.some(type=>type?.startsWith('acs_')||type==='cctv_doorbell'))return '#a78bfa';
    const modules=['panel','keypad','expander','abax','cctv_nvr','cctv_poe','cctv_antenna','cctv_receiver'];
    if(types.every(type=>modules.includes(type)))return '#38bdf8';
    return '#22c55e';
}
function drawCableRoute(ctx, cable, from, to, color, lineWidth, paintParts) {
    const points = getCableRoute(cable, from, to);
    ctx.lineCap=cable.kind==='trunk'?'round':'butt';drawCableWithJumps(ctx,points,paintParts);
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
}

function drawHandles(ctx, obj, color) {
    let handleScale = 1;
    ctx.fillStyle = "#1e1e22"; ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * handleScale; ctx.beginPath(); ctx.arc(obj.h1x, obj.h1y, 4 * handleScale, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.5 * handleScale; ctx.beginPath(); ctx.arc(obj.h3x, obj.h3y, 4 * handleScale, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.5 * handleScale; ctx.beginPath(); ctx.arc(obj.h2x, obj.h2y, 8 * handleScale, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(obj.h2x - 4 * handleScale, obj.h2y); ctx.lineTo(obj.h2x + 4 * handleScale, obj.h2y); ctx.stroke();
}

function drawWirelessWaves(ctx, startX, startY, sMult, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5 * sMult; ctx.lineCap = 'round';
    const angle = Math.PI / 3.5; 
    ctx.beginPath(); ctx.arc(startX, startY, 5*sMult, -angle, angle); ctx.stroke();
    ctx.beginPath(); ctx.arc(startX, startY, 11*sMult, -angle, angle); ctx.stroke(); ctx.restore();
}

function createWallMask(floor, threshold = floor.wallThreshold) {
    if (floor.satellite) return null;
    if(!floor.image)return null;
    const source=analyzePlanPixels(floor.image,!floor.vectorPlan),data=new Uint8Array(source.width*source.height);
    const limit=Math.max(0,Math.min(255,Number(threshold)||0));
    if(limit>0)for(let i=0;i<data.length;i++)data[i]=source.luminance[i]<limit?1:0;
    for(const x of source.frameColumns)for(let y=0;y<source.height;y++)data[y*source.width+x]=0;
    for(const y of source.frameRows)data.fill(0,y*source.width,(y+1)*source.width);
    const {width,height,imageWidth,imageHeight,frameColumns,frameRows,contentBounds,paperLevel}=source;
    return {data,width,height,imageWidth,imageHeight,frameColumns,frameRows,contentBounds,paperLevel};
}

const pirCoverageCache = new WeakMap();

function getPIRCoveragePoints(floor, device) {
    const mask = floor.wallMask;
    const optics = getCameraOptics(device);
    const rangePixels = (optics?.range ?? 300)*(Number(document.getElementById('deviceSizeSlider').value)||16)/16;
    const fovDegrees = optics?.angle ?? 90;

    const cached = pirCoverageCache.get(device);
    if (cached && cached.mask === mask && cached.x === device.x && cached.y === device.y &&
        cached.rotation === device.rotation && cached.range === rangePixels && cached.fov === fovDegrees) {
        return cached.points;
    }

    const maskScaleX = mask ? mask.width / mask.imageWidth : 1;
    const maskScaleY = mask ? mask.height / mask.imageHeight : 1;
    const originX = device.x * maskScaleX;
    const originY = device.y * maskScaleY;
    const range = rangePixels * maskScaleX;
    const fov = fovDegrees * Math.PI / 180;
    const centerAngle = ((device.rotation || 0) + (optics || device.type === 'glassbreak' ? 0 : 180)) * Math.PI / 180;
    const rayCount = Math.min(720, Math.max(90, Math.ceil(fovDegrees * rangePixels / 180)));
    const points = [{ x: device.x, y: device.y }];

    for (let ray = 0; ray <= rayCount; ray++) {
        const angle = centerAngle - fov / 2 + fov * ray / rayCount;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        if (!mask) {
            points.push({ x: device.x + dx * rangePixels, y: device.y + dy * rangePixels });
            continue;
        }
        let distance = 0;
        let lastX = originX;
        let lastY = originY;

        for (distance = 1; distance <= range; distance += 1) {
            const x = originX + dx * distance;
            const y = originY + dy * distance;
            if (x >= 0 && y >= 0 && x < mask.width && y < mask.height) {
                const pixelIndex = Math.floor(y) * mask.width + Math.floor(x);
                if (distance > 3 && mask.data[pixelIndex]) break;
            }
            lastX = x;
            lastY = y;
        }

        points.push({ x: lastX / maskScaleX, y: lastY / maskScaleY });
    }

    const entry = {
        mask, x: device.x, y: device.y, rotation: device.rotation,
        range: rangePixels, fov: fovDegrees, points
    };
    pirCoverageCache.set(device, entry);
    return points;
}

const pirCoveragePathCache=new WeakMap();
function drawPIRCoverage(ctx, floor, force = false) {
    const toggle = document.getElementById('togglePirCoverage');
    if (!force && toggle?.getAttribute('aria-pressed') === 'false') return;
    floor.devices.forEach(device => {
        if (!hasDeviceCoverage(device)) return;
        const points = getPIRCoveragePoints(floor, device);
        if (!points) return;
        ctx.save();
        let path;
        if(typeof ctx.strokePath==='function'){
            ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
            for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();
        }else{
            path=pirCoveragePathCache.get(points);
            if(!path){path=new Path2D();path.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)path.lineTo(points[i].x,points[i].y);path.closePath();pirCoveragePathCache.set(points,path);}
        }
        ctx.fillStyle = APP_PRODUCT === 'CCTV'
            ? 'rgba(14, 165, 233, 0.22)'
            : device.type === 'glassbreak'
            ? 'rgba(56, 189, 248, 0.2)'
            : 'rgba(34, 197, 94, 0.18)';
        if(path)ctx.fill(path);else ctx.fill();
        ctx.restore();
    });
}

function getPlanGridStyle(zoom=scale){
    let spacing=100;
    while(spacing*zoom<55)spacing*=2;
    while(spacing*zoom>140)spacing/=2;
    return {spacing,majorEvery:5,minorAlpha:.065,majorAlpha:.14,minorWidth:.55,majorWidth:.85};
}
function drawPlanGrid(ctx,floor){
    if(document.getElementById('togglePlanGrid')?.getAttribute('aria-pressed')!=='true')return;
    const grid=getPlanGridStyle(),minX=-offsetX/scale,minY=-offsetY/scale,maxX=(planCanvasWidth()-offsetX)/scale,maxY=(planCanvasHeight()-offsetY)/scale;
    ctx.save();
    for(const major of [false,true]){
        ctx.beginPath();
        for(let i=Math.floor(minX/grid.spacing);i*grid.spacing<=maxX;i++)if((i%grid.majorEvery===0)===major){ctx.moveTo(i*grid.spacing,minY);ctx.lineTo(i*grid.spacing,maxY);}
        for(let i=Math.floor(minY/grid.spacing);i*grid.spacing<=maxY;i++)if((i%grid.majorEvery===0)===major){ctx.moveTo(minX,i*grid.spacing);ctx.lineTo(maxX,i*grid.spacing);}
        ctx.strokeStyle=getPlanTheme(floor)==='dark'?`rgba(225,229,235,${major?grid.majorAlpha:grid.minorAlpha})`:`rgba(30,35,42,${major?grid.majorAlpha:grid.minorAlpha})`;
        ctx.lineWidth=(major?grid.majorWidth:grid.minorWidth)/scale;ctx.stroke();
    }
    ctx.restore();
}

// --- УМНЫЙ ОПТИМИЗИРОВАННЫЙ RENDER LOOP ---
let redrawRequested = false;
const emptyCanvasLogo = new Image();
emptyCanvasLogo.src = 'Logo.png';
emptyCanvasLogo.onload = () => requestRedraw();

function requestRedraw() {
    if (!redrawRequested) {
        redrawRequested = true;
        requestAnimationFrame(() => {
            try{redraw();window.updateTabletTools?.();}finally{redrawRequested=false;}
        });
    }
}

function animationLoop(timestamp) {
    if(timestamp-lastRenderTime>=33){
        const elapsed=lastRenderTime?Math.min(100,timestamp-lastRenderTime):33;lastRenderTime=timestamp;globalTime+=elapsed*.0024;
        const floor=floors[currentFloorIndex];
        const modal=document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])');
        if(floor&&!document.hidden&&!planReducedMotion.matches&&!modal&&!isOverviewMode&&isSystemReady&&!isExporting&&!isPanning&&!isDragging&&
            activeDeviceIds.size>0)requestRedraw();
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

function getPlanTextSize(device, labelScale = 1) {
    return Number.isFinite(device.textSize) ? Math.max(8, Math.min(72, Math.round(device.textSize))) : 13 * labelScale;
}

function planTextNodeContent(device) {
    return device.manualName || tr(device.plainText === true ? 'Text na výkresu' : 'Poznámka');
}

function getPlanTextLayout(context, device, labelScale) {
    const size = getPlanTextSize(device, labelScale);
    const text = planTextNodeContent(device);
    context.font = `${device.plainText === true ? '' : 'bold '}${size}px sans-serif`;
    return {
        text,
        width: getPlanTextWidth(context, text) + 12 * size / 13,
        height: 22 * size / 13,
        radius: Math.max(3, Math.min(6, size * 0.28))
    };
}

function hitTestPlanTextNode(device, x, y, labelScale) {
    ctx.save();
    const { width, height } = getPlanTextLayout(ctx, device, labelScale);
    ctx.restore();
    const angle = (device.rotation || 0) * Math.PI / 180;
    const dx = x - device.x, dy = y - device.y;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2;
}

function drawDevice(ctx, dev, skipSelection = false, theme = 'dark', options = {}) {
    if(dev.type==='trunkJunction'){if(!skipSelection&&!isExporting&&showTrunkHandle(dev))drawInfrastructureDevice(ctx,dev,16,options);return;}
    if(!options.portableCapture&&!isOwnPlanEntity(dev)){drawForeignPlanDevice(ctx,dev);return;}
    if(isInfrastructureDevice(dev)||dev.type==='trunkTool'){drawInfrastructureDevice(ctx,dev,options.baseSize??Number(document.getElementById('deviceSizeSlider').value),options);return;}
    let slider = document.getElementById('deviceSizeSlider');
    let baseSize = options.baseSize ?? ((slider && slider.value) ? parseInt(slider.value) : 16);
    let sMult = (baseSize / 14); 
    let labelScale = 1 + (sMult - 1) * 0.5;

    if (dev.type === 'textNode') {
        const plainText = dev.plainText === true;
        const selected = activeDeviceIds.has(dev.id) && !isExporting && !skipSelection;
        ctx.save();
        ctx.translate(dev.x, dev.y);
        ctx.rotate((dev.rotation || 0) * Math.PI / 180);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const { text, width, height, radius } = getPlanTextLayout(ctx, dev, labelScale);
        if (!plainText || selected) {
            ctx.beginPath();
            ctx.roundRect(-width / 2, -height / 2, width, height, radius);
            if (!plainText) {
                ctx.fillStyle = '#2d2e32';
                ctx.fill();
            }
            if (selected) {
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2 * labelScale;
                ctx.setLineDash([6 * labelScale, 4 * labelScale]);
                ctx.stroke();
            }
        }
        ctx.fillStyle = plainText && theme !== 'dark' ? '#171719' : '#ffffff';
        ctx.fillText(text, 0, 0);
        ctx.restore();
        return;
    }

    ctx.lineWidth = 2.5 * sMult; ctx.textAlign = "center"; ctx.textBaseline = "middle"; const size = 14 * sMult; 

    const selected = activeDeviceIds.has(dev.id);
    const hovered = window.hoveredDeviceId === dev.id;
    if ((selected || hovered) && !isExporting && !skipSelection) {
        ctx.save();
        ctx.translate(dev.x, dev.y);
        if (selected) {
            ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,.8)' : '#52525b';
            ctx.rotate(planReducedMotion.matches ? 0 : globalTime * .16);
            ctx.lineWidth = 1.5 * sMult;
            ctx.lineCap = 'round';
            for (const start of [0, Math.PI]) {
                ctx.beginPath();
                ctx.arc(0, 0, size + 13 * sMult, start, start + Math.PI * .38);
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, size + 7 * sMult, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.save(); ctx.translate(dev.x, dev.y); ctx.rotate((dev.rotation || 0) * Math.PI / 180);
    const customShapes = !options.defaultIcon && typeof getCustomDeviceShapes === 'function' ? getCustomDeviceShapes(dev.type) : null;
    if (customShapes?.length) {
        ctx.save();
        ctx.scale(.1 * sMult, .1 * sMult);
        ctx.translate(-200, -200);
        for (const shape of customShapes) drawEditorShape(ctx, shape);
        ctx.restore();
    } else if (APP_PRODUCT === 'CCTV' && Object.hasOwn(CCTV_DEVICE_LABELS, dev.type)) {
        drawCctvDevice(ctx, dev.type, sMult);
    } else if (dev.type === 'panel') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-20*sMult, -10*sMult, 40*sMult, 20*sMult);
        ctx.strokeStyle = COLORS.panel; ctx.lineWidth = 2 * sMult; ctx.strokeRect(-20*sMult, -10*sMult, 40*sMult, 20*sMult);
        ctx.fillStyle = COLORS.panel; ctx.font = "bold " + (11*sMult) + "px monospace"; ctx.fillText("EZS", 0, 0);
   } else if (dev.type === 'expander') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-14*sMult, -12*sMult, 28*sMult, 24*sMult);
        ctx.strokeStyle = COLORS.expander; ctx.lineWidth = 2 * sMult; ctx.strokeRect(-14*sMult, -12*sMult, 28*sMult, 24*sMult);
        ctx.fillStyle = COLORS.expander; ctx.font = "bold " + (10*sMult) + "px monospace"; ctx.fillText("EXP", 0, 0);
    } else if (dev.type === 'abax') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-16*sMult, -12*sMult, 26*sMult, 24*sMult);
        ctx.strokeStyle = COLORS.abax; ctx.lineWidth = 2 * sMult; ctx.strokeRect(-16*sMult, -12*sMult, 26*sMult, 24*sMult);
        ctx.fillStyle = COLORS.abax; ctx.font = "bold " + (7.5*sMult) + "px monospace"; ctx.fillText("ABAX2", -3*sMult, 0);
        drawWirelessWaves(ctx, 16*sMult, 0, sMult, COLORS.abax); 
    } else if (dev.type === 'keypad') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-12*sMult, -12*sMult, 24*sMult, 24*sMult);
        ctx.strokeStyle = COLORS.keypad; ctx.lineWidth = 2 * sMult; ctx.strokeRect(-12*sMult, -12*sMult, 24*sMult, 24*sMult);
        ctx.fillStyle = COLORS.keypad; ctx.beginPath(); 
        ctx.moveTo(-12*sMult, 12*sMult); ctx.lineTo(12*sMult, -12*sMult); ctx.lineTo(12*sMult, 12*sMult); 
        ctx.closePath(); ctx.fill();
    } else if (dev.type === 'pir') {
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = COLORS.pir; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.moveTo(10*sMult, 0); ctx.arc(10*sMult, 0, 22*sMult, 5*Math.PI/6, 7*Math.PI/6); ctx.closePath(); 
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); 
        ctx.moveTo(-18*sMult, -8*sMult); ctx.lineTo(-14*sMult, -5*sMult);
        ctx.moveTo(-20*sMult, 0); ctx.lineTo(-15*sMult, 0);
        ctx.moveTo(-18*sMult, 8*sMult); ctx.lineTo(-14*sMult, 5*sMult);
        ctx.stroke();
    } else if (dev.type === 'pir_wl') {
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = COLORS.pir_wl; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.moveTo(10*sMult, 0); ctx.arc(10*sMult, 0, 22*sMult, 5*Math.PI/6, 7*Math.PI/6); ctx.closePath(); 
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); 
        ctx.moveTo(-18*sMult, -8*sMult); ctx.lineTo(-14*sMult, -5*sMult);
        ctx.moveTo(-20*sMult, 0); ctx.lineTo(-15*sMult, 0);
        ctx.moveTo(-18*sMult, 8*sMult); ctx.lineTo(-14*sMult, 5*sMult);
        ctx.stroke();
        ctx.lineWidth = 1.5 * sMult;
        ctx.beginPath(); ctx.arc(10*sMult, 0, 8*sMult, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(10*sMult, 0, 16*sMult, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke();
    } else if (dev.type === 'magnet') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-7*sMult, -7*sMult, 14*sMult, 14*sMult);
        ctx.strokeStyle = COLORS.magnet; ctx.lineWidth = 3.5 * sMult; ctx.strokeRect(-7*sMult, -7*sMult, 14*sMult, 14*sMult);
    } else if (dev.type === 'magnet_wl') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-9*sMult, -6*sMult, 12*sMult, 12*sMult);
        ctx.strokeStyle = COLORS.magnet_wl; ctx.lineWidth = 2.5 * sMult; ctx.strokeRect(-9*sMult, -6*sMult, 12*sMult, 12*sMult);
        drawWirelessWaves(ctx, 4*sMult, 0, sMult, COLORS.magnet_wl); 
    } else if (dev.type === 'glassbreak') {
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = COLORS.glassbreak; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, 12*sMult, Math.PI/4, 7*Math.PI/4); ctx.closePath(); 
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(14*sMult, 0); ctx.stroke();
    } else if (dev.type === 'panic') {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-10*sMult, -10*sMult, 20*sMult, 20*sMult); 
        ctx.strokeStyle = COLORS.panic; ctx.lineWidth = 2 * sMult; ctx.strokeRect(-10*sMult, -10*sMult, 20*sMult, 20*sMult);
        ctx.beginPath(); ctx.arc(0, 0, 5*sMult, 0, Math.PI*2); ctx.fillStyle = COLORS.panic; ctx.fill(); 
    } else if (dev.type === 'siren') {
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = COLORS.siren; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.moveTo(-8*sMult, -4*sMult); ctx.lineTo(-2*sMult, -4*sMult); ctx.lineTo(6*sMult, -12*sMult); ctx.lineTo(6*sMult, 12*sMult); ctx.lineTo(-2*sMult, 4*sMult); ctx.lineTo(-8*sMult, 4*sMult); ctx.closePath(); 
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(22*sMult, -4*sMult); ctx.quadraticCurveTo(26*sMult, 0, 22*sMult, 4*sMult); ctx.stroke();
    } else if (dev.type === 'acs_module') {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.acs_module; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.roundRect(-14 * sMult, -9 * sMult, 28 * sMult, 18 * sMult, 3 * sMult); ctx.fill(); ctx.stroke();
        ctx.fillStyle = COLORS.acs_module; ctx.font = `bold ${10 * sMult}px monospace`; ctx.fillText('ACS', 0, 0);
    } else if (dev.type === 'acs_reader') {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.acs_reader; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.roundRect(-12 * sMult, -11 * sMult, 13 * sMult, 22 * sMult, 3 * sMult); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-5.5 * sMult, -5 * sMult, 1.75 * sMult, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS.acs_reader; ctx.fill();
        drawWirelessWaves(ctx, 2 * sMult, 0, sMult, COLORS.acs_reader);
    } else if (dev.type === 'smoke') {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.smoke; ctx.lineWidth = 2 * sMult;
        ctx.beginPath(); ctx.arc(0, 0, 11 * sMult, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 3 * sMult, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS.smoke; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6 * sMult, -5 * sMult); ctx.lineTo(6 * sMult, -5 * sMult);
        ctx.moveTo(-6 * sMult, 5 * sMult); ctx.lineTo(6 * sMult, 5 * sMult); ctx.stroke();
    } else if (dev.type === 'deactivated') {
        ctx.strokeStyle = COLORS.deactivated; ctx.lineWidth = 2.5 * sMult;
        ctx.beginPath(); ctx.arc(0, 0, 10 * sMult, 0, Math.PI*2); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(-6 * sMult, -6 * sMult); ctx.lineTo(6 * sMult, 6 * sMult); ctx.stroke(); 

    }
    ctx.restore(); 

    if(options.skipLabels)return;
    const label = getDeviceAddressParts(dev);
    const labelText = label.prefix + label.number;

    if (labelText !== "" || (dev.manualName && dev.type !== 'textNode')) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        let textX = dev.x + size + (8 * labelScale); let textY = dev.y + size + (8 * labelScale);
        if (labelText !== "") {
            const fontSize = 12 * labelScale;
            ctx.font = `400 ${fontSize}px sans-serif`;
            const prefixWidth = getPlanTextWidth(ctx,label.prefix);
            ctx.font = `700 ${fontSize}px sans-serif`;
            const numberWidth = getPlanTextWidth(ctx,label.number);
            const width = prefixWidth + numberWidth;
            ctx.fillStyle = '#000'; ctx.beginPath();
            ctx.roundRect(textX - width / 2 - 5 * labelScale, textY - 10 * labelScale, width + 10 * labelScale, 20 * labelScale, 9 * labelScale); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
            ctx.font = `400 ${fontSize}px sans-serif`; ctx.fillText(label.prefix, textX - width / 2, textY);
            ctx.font = `700 ${fontSize}px sans-serif`; ctx.fillText(label.number, textX - width / 2 + prefixWidth, textY);
            ctx.textAlign = 'center';
        }
        if (dev.manualName && dev.type !== 'textNode') { 
            let nameY = (labelText !== "") ? textY + (16 * labelScale) : textY;
            ctx.font = (11 * labelScale) + "px sans-serif"; ctx.fillStyle = theme === 'dark' ? "#f2f4f7" : "#121214"; ctx.shadowColor = theme === 'dark' ? "#181a1d" : "rgba(255,255,255,0.8)"; ctx.shadowBlur = 4; ctx.fillText(dev.manualName, textX, nameY); ctx.shadowBlur = 0;
        }
    }
}

function drawFloorData(ctx, floor, skipSelection = false, theme = getPlanTheme(floor)) {
    if (!floor) return;
    if (!isSystemReady) return;
    updateTrunkJunctions(floor);
    if (floor.showConnections) {
        const devicesById=new Map(floor.devices.map(device=>[device.id,device]));
        const cablePaint=getCablePaintPlan(floor);
        floor.cables.forEach(c => {
            const d1=devicesById.get(c.fromId),d2=devicesById.get(c.toId);
            if(!d1 || !d2) return;
            
            if (c.h1x === undefined || isNaN(c.h1x)) { recalcCableHandles(c, d1, d2); }
            if (!showDeactivatedDevices && (d1.type === 'deactivated' || d2.type === 'deactivated')) return;

            if (d1.type === 'textNode' || d2.type === 'textNode') {
                let color = "#94a3b8"; let lineWidth = 1.5; let arrowStart = false; let arrowEnd = false;
                if (d1.type === 'textNode') arrowEnd = true; if (d2.type === 'textNode') arrowStart = true;
                drawDirectLeaderLine(ctx, d1.x, d1.y, d2.x, d2.y, color, lineWidth, arrowStart, arrowEnd);
            } else {
                const trunkStyle=getTrunkRouteStyle(c);
                const color=c.kind==='trunk'?trunkStyle.color:(!isOwnPlanEntity(c)&&c.routeColor)||cableRouteColor(d1,d2);
                const routeWidth=c.kind==='trunk'?trunkStyle.width:4;
                const lineWidth=isExporting||skipSelection?routeWidth:Math.max(routeWidth,2/Math.max(.01,scale));
                drawCableRoute(ctx, c, d1, d2, color, lineWidth,cablePaint.get(c.id));
                if (isOwnPlanEntity(c) && c.kind!=='trunk' && !isExporting && !skipSelection && (selectedTool === 'cableTool' || activeDeviceIds.has(d1.id) || activeDeviceIds.has(d2.id) || (draggedHandle && draggedHandle.cable === c))) {
                    drawHandles(ctx, c, color);
                }
            }
        });
    }
    floor.devices.forEach(dev => {
        if (!showDeactivatedDevices && dev.type === 'deactivated') return;
        drawDevice(ctx, dev, skipSelection, theme);
    });
    drawProjectLegend(ctx, floor, !skipSelection && !isExporting, theme);
    drawForeignLegends(ctx,floor);
}

const planWatermarkImages = new Map();

function drawFreePlanWatermark(target, width, height, theme, footerHeight = 0) {
    if (window.hasProAccess?.() || !emptyCanvasLogo.naturalWidth) return;
    const dark = theme === 'dark';
    let logo = planWatermarkImages.get(dark);
    if (!logo) {
        // Cache a small tinted copy. Canvas-backed images are embedded in SVG exports.
        logo = document.createElement('canvas');
        logo.width = 160;
        logo.height = Math.max(1, Math.round(logo.width * emptyCanvasLogo.naturalHeight / emptyCanvasLogo.naturalWidth));
        const mask = logo.getContext('2d');
        mask.fillStyle = dark ? '#ffffff' : '#172033';
        mask.fillRect(0, 0, logo.width, logo.height);
        mask.globalCompositeOperation = 'destination-in';
        mask.drawImage(emptyCanvasLogo, 0, 0, logo.width, logo.height);
        planWatermarkImages.set(dark, logo);
    }
    const shortSide = Math.min(width, height);
    const markWidth = shortSide * .075;
    const markHeight = markWidth * logo.height / logo.width;
    const margin = shortSide * .024;
    target.save();
    target.globalAlpha = dark ? .16 : .14;
    target.drawImage(logo, width - margin - markWidth, height - footerHeight - margin - markHeight, markWidth, markHeight);
    target.restore();
}

const planSourceInfo=document.createElement('a');planSourceInfo.id='planSourceInfo';planSourceInfo.target='_blank';planSourceInfo.rel='noopener';planSourceInfo.hidden=true;document.getElementById('appFooter').append(planSourceInfo);
function redraw() {
    const floorStatus=document.getElementById('footerCurrentFloor'),floorName=isSystemReady?floors[currentFloorIndex]?.name||'':'';if(floorStatus&&floorStatus.textContent!==floorName)floorStatus.textContent=floorName;
    const source=floors[currentFloorIndex]?.satellite;planSourceInfo.hidden=!isSystemReady||!source;
    if(source){const outlines=!!source.buildingOutlines;planSourceInfo.textContent=outlines?'© OpenStreetMap':source.provider.includes('ČÚZK')?'© ČÚZK · Esri':'© Esri';planSourceInfo.href=outlines?'https://www.openstreetmap.org/copyright':source.provider.includes('ČÚZK')?'https://ags.cuzk.gov.cz/opendata/':'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';}
    const shortcut=document.getElementById('emptyProjectShortcut');
    if(shortcut)shortcut.hidden=Boolean(window.isGoomReadOnly?.()||!isSystemReady||isOverviewMode||currentFloorIndex<0||!floors[currentFloorIndex]||floors[currentFloorIndex].image||floors[currentFloorIndex].devices.length||isExporting);
    if(typeof syncPlanLoading==='function')syncPlanLoading();
    if (!isSystemReady || floors.length === 0) return;
    ctx.setTransform(canvasPixelRatio, 0, 0, canvasPixelRatio, 0, 0); ctx.clearRect(0, 0, planCanvasWidth(), planCanvasHeight());
    if (currentFloorIndex === -1) return;
    const floor = floors[currentFloorIndex];
    if (!floor.image && !isExporting) {
        ctx.fillStyle = "#252529"; ctx.fillRect(0, 0, planCanvasWidth(), planCanvasHeight());
        if (emptyCanvasLogo.complete && emptyCanvasLogo.naturalWidth > 0) {
            const logoWidth = Math.min(180, planCanvasWidth() * 0.3);
            const logoHeight = logoWidth * emptyCanvasLogo.naturalHeight / emptyCanvasLogo.naturalWidth;
            ctx.drawImage(emptyCanvasLogo, (planCanvasWidth() - logoWidth) / 2, (planCanvasHeight() - logoHeight) / 2, logoWidth, logoHeight);
        }
        const spacing = 28;
        for (let x = spacing / 2; x < planCanvasWidth(); x += spacing) {
            for (let y = spacing / 2; y < planCanvasHeight(); y += spacing) {
                let dx = 0; let dy = 0; let distance = Infinity;
                if (pointerCanvasX !== null && pointerCanvasY !== null) {
                    dx = x - pointerCanvasX; dy = y - pointerCanvasY;
                    distance = Math.hypot(dx, dy);
                }
                const proximity = Math.max(0, 1 - distance / 78);
                const easedProximity = proximity * proximity * (3 - 2 * proximity);
                const displacement = distance > 0 ? 14 * easedProximity / distance : 0;
                const visible = Math.max(0.82, Math.min(1, (distance - 2) / 8));
                const radius = 1.7 + 2.2 * easedProximity;

                ctx.globalAlpha = visible;
                ctx.fillStyle = "#111115";
                ctx.beginPath();
                ctx.arc(x + dx * displacement, y + dy * displacement, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    } else { drawPlanScreenBase(ctx,floor); }

    const theme = floor.image ? getPlanTheme(floor) : 'dark';
    if (floor.image || floor.devices.length || floor.legend?.visible) {
        drawFreePlanWatermark(ctx, planCanvasWidth(), planCanvasHeight(), theme, document.getElementById('appFooter').offsetHeight);
    }
    ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    if(!floor.image){drawDetectedWalls(ctx,floor);drawPlanGrid(ctx,floor);}
    drawPIRCoverage(ctx, floor);

    if ((snapGuideX !== null || snapGuideY !== null) && !isExporting && isDragging) {
        ctx.save(); ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5 / scale; ctx.setLineDash([5 / scale, 5 / scale]); ctx.globalAlpha = 0.6;
        if (snapGuideX !== null) { ctx.beginPath(); ctx.moveTo(snapGuideX, -offsetY / scale); ctx.lineTo(snapGuideX, (planCanvasHeight() - offsetY) / scale); ctx.stroke(); }
        if (snapGuideY !== null) { ctx.beginPath(); ctx.moveTo(-offsetX / scale, snapGuideY); ctx.lineTo((planCanvasWidth() - offsetX) / scale, snapGuideY); ctx.stroke(); }
        ctx.restore();
    }

    if (isSelecting) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.08)"; ctx.strokeStyle = "rgba(128, 128, 128, 0.75)"; ctx.lineWidth = 1 / scale;
        const w = selEndX - selStartX; const h = selEndY - selStartY;
        ctx.fillRect(selStartX, selStartY, w, h); ctx.strokeRect(selStartX, selStartY, w, h);
    }
    drawFloorData(ctx, floor, false, theme);
    if (!isExporting) drawDetectorSearchHighlight(ctx, floor);
}

