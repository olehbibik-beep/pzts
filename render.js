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

function drawAdvancedOrthoRoute(ctx, x1, y1, h1x, h1y, h2x, h2y, h3x, h3y, x2, y2, color, lineWidth) {
    const points = [ {x: x1, y: y1}, {x: h1x, y: h1y}, {x: h2x, y: h2y}, {x: h3x, y: h3y}, {x: x2, y: y2} ];
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for(let i = 0; i < points.length - 1; i++) { ctx.lineTo(points[i+1].x, points[i].y); ctx.lineTo(points[i+1].x, points[i+1].y); }
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
    const rangePixels = 300;
    const isGlassbreak = device.type === 'glassbreak';
    const fovDegrees = 90;
    if (!rangePixels) return null;

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
    const centerAngle = ((device.rotation || 0) + (isGlassbreak ? 0 : 180)) * Math.PI / 180;
    const rayCount = Math.min(720, Math.max(90, Math.ceil(fovDegrees * rangePixels / 180)));
    const points = [{ x: device.x, y: device.y }];

    for (let ray = 0; ray <= rayCount; ray++) {
        const angle = centerAngle - fov / 2 + fov * ray / rayCount;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let distance = 0;
        let lastX = originX;
        let lastY = originY;

        for (distance = 1; distance <= range; distance += 1) {
            const x = originX + dx * distance;
            const y = originY + dy * distance;
            if (mask) {
                if (x >= 0 && y >= 0 && x < mask.width && y < mask.height) {
                    const pixelIndex = Math.floor(y) * mask.width + Math.floor(x);
                    if (distance > 3 && mask.data[pixelIndex]) break;
                }
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
        if (!['pir', 'pir_wl', 'glassbreak'].includes(device.type)) return;
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
        ctx.fillStyle = device.type === 'glassbreak'
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
            (activeDeviceIds.size>0||floor.devices.some(d=>d.type==='ramen')))requestRedraw();
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

function planTextNodeFont(device, labelScale) {
    return `${device.plainText === true ? '' : 'bold '}${13 * labelScale}px sans-serif`;
}

function planTextNodeContent(device) {
    return device.manualName || tr(device.plainText === true ? 'Text na výkresu' : 'Poznámka');
}

function hitTestPlanTextNode(device, x, y, labelScale) {
    ctx.save();
    ctx.font = planTextNodeFont(device, labelScale);
    const halfWidth = getPlanTextWidth(ctx, planTextNodeContent(device)) / 2;
    ctx.restore();
    const angle = (device.rotation || 0) * Math.PI / 180;
    const dx = x - device.x, dy = y - device.y;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= halfWidth + 6 * labelScale && Math.abs(localY) <= 11 * labelScale;
}

function drawDevice(ctx, dev, skipSelection = false, theme = 'dark', options = {}) {
    let slider = document.getElementById('deviceSizeSlider');
    let baseSize = options.baseSize ?? ((slider && slider.value) ? parseInt(slider.value) : 16);
    let sMult = (baseSize / 14); 
    let labelScale = 1 + (sMult - 1) * 0.5;

    if (dev.type === 'textNode') {
        const plainText = dev.plainText === true;
        const selected = activeDeviceIds.has(dev.id) && !isExporting && !skipSelection;
        const text = planTextNodeContent(dev);
        ctx.save();
        ctx.translate(dev.x, dev.y);
        ctx.rotate((dev.rotation || 0) * Math.PI / 180);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = planTextNodeFont(dev, labelScale);
        if (!plainText || selected) {
            const width = getPlanTextWidth(ctx, text) + 12 * labelScale;
            const height = 22 * labelScale;
            if (!plainText) {
                ctx.fillStyle = 'rgba(18, 18, 20, 0.75)';
                ctx.fillRect(-width / 2, -height / 2, width, height);
            }
            if (selected) {
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2 * labelScale;
                ctx.setLineDash([6 * labelScale, 4 * labelScale]);
                ctx.strokeRect(-width / 2, -height / 2, width, height);
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
    const customIcon = !options.defaultIcon && typeof getCustomDeviceIconImage === 'function' ? getCustomDeviceIconImage(dev.type) : null;
    if (customIcon && customIcon.complete && customIcon.naturalWidth > 0) {
        ctx.drawImage(customIcon, -20 * sMult, -20 * sMult, 40 * sMult, 40 * sMult);
        ctx.restore();
        return;
    }

    if (dev.type === 'panel') {
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
    } else if (dev.type === 'deactivated') {
        ctx.strokeStyle = COLORS.deactivated; ctx.lineWidth = 2.5 * sMult;
        ctx.beginPath(); ctx.arc(0, 0, 10 * sMult, 0, Math.PI*2); ctx.stroke(); 
        ctx.beginPath(); ctx.moveTo(-6 * sMult, -6 * sMult); ctx.lineTo(6 * sMult, 6 * sMult); ctx.stroke(); 
    } else if (dev.type === 'ramen') {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; ctx.fillRect(-18*sMult, -25*sMult, 36*sMult, 47*sMult); 
        if (!isExporting) {
            ctx.strokeStyle = "rgba(156, 163, 175, 0.9)"; ctx.lineWidth = 1.8*sMult; ctx.beginPath();
            let wave1 = Math.sin(globalTime * 2.5) * 6 * sMult; let wave2 = Math.cos(globalTime * 2.5 + 1) * 6 * sMult; let wave3 = Math.sin(globalTime * 2.5 + 2) * 5 * sMult;
            ctx.moveTo(-7*sMult, -4*sMult); ctx.bezierCurveTo(-7*sMult + wave1, -15*sMult, -7*sMult - wave1, -22*sMult, -7*sMult, -30*sMult);
            ctx.moveTo(0, -4*sMult);  ctx.bezierCurveTo(0 + wave3, -15*sMult, 0 - wave3, -22*sMult, 0, -30*sMult);
            ctx.moveTo(7*sMult, -4*sMult);  ctx.bezierCurveTo(7*sMult + wave2, -15*sMult, 7*sMult - wave2, -22*sMult, 7*sMult, -30*sMult); ctx.stroke();
        }
        ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2*sMult; ctx.beginPath(); ctx.moveTo(-9*sMult, 4*sMult); ctx.lineTo(-6*sMult, -1*sMult); ctx.lineTo(-3*sMult, 4*sMult); ctx.lineTo(0, -1*sMult); ctx.lineTo(3*sMult, 4*sMult); ctx.lineTo(6*sMult, -1*sMult); ctx.lineTo(9*sMult, 4*sMult); ctx.stroke();
        ctx.strokeStyle = "#ea580c"; ctx.lineWidth = 2.5*sMult; ctx.beginPath(); ctx.arc(0, 5*sMult, 12*sMult, 0, Math.PI, false); ctx.closePath(); ctx.fillStyle = "#ea580c"; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2.5*sMult; ctx.beginPath(); ctx.moveTo(5*sMult, 5*sMult); ctx.lineTo(15*sMult, -12*sMult); ctx.moveTo(2*sMult, 5*sMult); ctx.lineTo(12*sMult, -12*sMult); ctx.stroke();
    }
    ctx.restore(); 

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

    if (floor.showConnections) {
        const devicesById=new Map(floor.devices.map(device=>[device.id,device]));
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
                let color = "#22c55e"; let lineWidth = 3.5;
                if (['panel', 'keypad', 'expander', 'abax'].includes(d1.type) && ['panel', 'keypad', 'expander', 'abax'].includes(d2.type)) { color = "#0ea5e9"; }
                else if (d1.type === 'siren' || d2.type === 'siren' || d1.type === 'panic' || d2.type === 'panic') { color = "#ef4444"; }
                else if (d1.type === 'ramen' || d2.type === 'ramen') { color = "#ea580c"; }
                drawAdvancedOrthoRoute(ctx, d1.x, d1.y, c.h1x, c.h1y, c.h2x, c.h2y, c.h3x, c.h3y, d2.x, d2.y, color, lineWidth);
                if (!isExporting && !skipSelection && (selectedTool === 'cableTool' || activeDeviceIds.has(d1.id) || activeDeviceIds.has(d2.id) || (draggedHandle && draggedHandle.cable === c))) {
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

function redraw() {
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
}

