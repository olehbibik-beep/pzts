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
    if (!floor.image) return null;

    const imageWidth = floor.image.naturalWidth || floor.image.width;
    const imageHeight = floor.image.naturalHeight || floor.image.height;
    const maxPixels = 6000000;
    const resizeFactor = Math.min(1, Math.sqrt(maxPixels / (imageWidth * imageHeight)));
    const width = Math.max(1, Math.round(imageWidth * resizeFactor));
    const height = Math.max(1, Math.round(imageHeight * resizeFactor));
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) throw new Error(tr('Не удалось создать маску стен для чертежа.'));

    maskCtx.drawImage(floor.image, 0, 0, width, height);
    const pixels = maskCtx.getImageData(0, 0, width, height).data;
    const data = new Uint8Array(width * height);
    const columnInk = new Uint32Array(width);
    const rowInk = new Uint32Array(height);
    for (let source = 0, target = 0; target < data.length; source += 4, target++) {
        const luminance = 0.2126 * pixels[source] + 0.7152 * pixels[source + 1] + 0.0722 * pixels[source + 2];
        data[target] = pixels[source + 3] > 127 && luminance <= threshold ? 1 : 0;
        if (pixels[source + 3] > 127 && luminance < 230) {
            columnInk[target % width]++;
            rowInk[Math.floor(target / width)]++;
        }
    }

    const findEdgeLines = (counts, span) => {
        const margin = Math.ceil(counts.length * 0.025);
        const thresholdRatio = 0.85;
        const left = [];
        const right = [];
        for (let i = 0; i < margin; i++) {
            if (counts[i] / span >= thresholdRatio) left.push(i);
            const oppositeIndex = counts.length - 1 - i;
            if (counts[oppositeIndex] / span >= thresholdRatio) right.push(oppositeIndex);
        }
        return left.length && right.length ? [...left, ...right] : [];
    };
    const frameColumns = findEdgeLines(columnInk, height);
    const frameRows = findEdgeLines(rowInk, width);

    if (frameColumns.length || frameRows.length) {
        for (let y = 0; y < height; y++) {
            for (const x of frameColumns) data[y * width + x] = 0;
        }
        for (const y of frameRows) {
            data.fill(0, y * width, (y + 1) * width);
        }
    }

    return { data, width, height, imageWidth, imageHeight, frameColumns, frameRows };
}

const pirCoverageCache = new WeakMap();

function getPIRCoveragePoints(floor, device) {
    const mask = floor.wallMask;
    const rangePixels = Number.isFinite(device.pirRangePixels) ? device.pirRangePixels : floor.pirRangePixels;
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
    const rayCount = Math.max(12, Math.ceil(fovDegrees));
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

function drawPIRCoverage(ctx, floor) {
    const toggle = document.getElementById('togglePirCoverage');
    if (toggle?.getAttribute('aria-pressed') === 'false') return;
    floor.devices.forEach(device => {
        if (!['pir', 'pir_wl', 'glassbreak'].includes(device.type)) return;
        const points = getPIRCoveragePoints(floor, device);
        if (!points) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fillStyle = device.type === 'glassbreak'
            ? 'rgba(56, 189, 248, 0.2)'
            : 'rgba(34, 197, 94, 0.18)';
        ctx.fill();
        ctx.restore();
    });
}

function drawPlanGrid(ctx, floor) {
    const toggle = document.getElementById('togglePlanGrid');
    if (toggle?.getAttribute('aria-pressed') !== 'true') return;

    const spacing = 50;
    const minX = -offsetX / scale;
    const minY = -offsetY / scale;
    const maxX = (canvas.width - offsetX) / scale;
    const maxY = (canvas.height - offsetY) / scale;
    ctx.save();
    ctx.beginPath();
    for (let x = Math.floor(minX / spacing) * spacing; x <= maxX; x += spacing) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
    }
    for (let y = Math.floor(minY / spacing) * spacing; y <= maxY; y += spacing) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
    }
    ctx.strokeStyle = 'rgba(220, 224, 230, 0.56)';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
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
            redraw();
            window.updateTabletTools?.();
            redrawRequested = false;
        });
    }
}

function animationLoop(timestamp) {
    if (!lastRenderTime) lastRenderTime = timestamp;
    const floor = currentFloorIndex !== -1 ? floors[currentFloorIndex] : null;
    const animateEmptyCanvas = !!(floor && !floor.image && isSystemReady && !isExporting);
    if (timestamp - lastRenderTime > (animateEmptyCanvas ? 16 : 33)) {
        globalTime += 0.08; lastRenderTime = timestamp;
        let requiresAnimation = activeDeviceIds.size > 0;
        if (floor) {
            if (floor.devices.some(d => d.type === 'ramen')) requiresAnimation = true;
        }
        if (animateEmptyCanvas) requiresAnimation = true;
        if (requiresAnimation && !isExporting && !isPanning && !isDragging) { 
            requestRedraw(); 
        }
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

function drawDevice(ctx, dev, skipSelection = false) {
    let slider = document.getElementById('deviceSizeSlider');
    let baseSize = (slider && slider.value) ? parseInt(slider.value) : 16;
    let sMult = (baseSize / 14); 
    let labelScale = 1 + (sMult - 1) * 0.5;

    if (dev.type === 'textNode') {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        let text = dev.manualName || tr("Poznámka");
        ctx.save(); ctx.translate(dev.x, dev.y); ctx.rotate((dev.rotation || 0) * Math.PI / 180);
        ctx.font = "bold " + (13 * labelScale) + "px sans-serif"; 
        let w = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(18, 18, 20, 0.75)"; 
        ctx.fillRect(-w/2 - 6*labelScale, -11*labelScale, w + 12*labelScale, 22*labelScale);
        if (activeDeviceIds.has(dev.id) && !isExporting && !skipSelection) { 
            ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2*labelScale; ctx.setLineDash([6*labelScale, 4*labelScale]); ctx.strokeRect(-w/2 - 6*labelScale, -11*labelScale, w + 12*labelScale, 22*labelScale); 
        }
        ctx.fillStyle = "#ffffff"; ctx.fillText(text, 0, 0); ctx.restore(); return; 
    }

    ctx.lineWidth = 2.5 * sMult; ctx.textAlign = "center"; ctx.textBaseline = "middle"; const size = 14 * sMult; 

    // =========================================================
    // Подсветка устройства при наведении
    // =========================================================
    if (window.hoveredDeviceId === dev.id && !isExporting && !skipSelection && !activeDeviceIds.has(dev.id)) {
        ctx.save(); 
        ctx.translate(dev.x, dev.y); 
        const hoverRadius = size + 9 * sMult;
        ctx.beginPath();
        ctx.arc(0, 0, hoverRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(14, 165, 233, 0.14)";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2 * sMult;
        ctx.setLineDash([5 * sMult, 3 * sMult]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    // =========================================================
    
    // Активное выделение (вращающийся синий пунктир)
    if (activeDeviceIds.has(dev.id) && !isExporting && !skipSelection) {
        ctx.save(); ctx.translate(dev.x, dev.y); ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 4 * sMult; 
        ctx.save(); ctx.rotate(globalTime * 0.5); ctx.setLineDash([16*sMult, 8*sMult]); ctx.beginPath(); ctx.arc(0, 0, size + 16*sMult, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.rotate(-globalTime); ctx.setLineDash([3*sMult, 12*sMult]); ctx.beginPath(); ctx.arc(0, 0, size + 9*sMult, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.restore(); ctx.setLineDash([]);
    }

    ctx.save(); ctx.translate(dev.x, dev.y); ctx.rotate((dev.rotation || 0) * Math.PI / 180);
    const customIcon = typeof getCustomDeviceIconImage === 'function' ? getCustomDeviceIconImage(dev.type) : null;
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
            const prefixWidth = ctx.measureText(label.prefix).width;
            ctx.font = `700 ${fontSize}px sans-serif`;
            const numberWidth = ctx.measureText(label.number).width;
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
            ctx.font = (11 * labelScale) + "px sans-serif"; ctx.fillStyle = "#121214"; ctx.shadowColor = "rgba(255,255,255,0.8)"; ctx.shadowBlur = 4; ctx.fillText(dev.manualName, textX, nameY); ctx.shadowBlur = 0;
        }
    }
}

function drawFloorData(ctx, floor, skipSelection = false) {
    if (!floor) return;
    if (!isSystemReady) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#121214"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#22c55e"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText(tr("Načítání projektu..."), canvas.width / 2, canvas.height / 2); ctx.restore(); return;
    }

    if (floor.showConnections) {
        floor.cables.forEach(c => {
            let d1 = floor.devices.find(d => d.id === c.fromId); let d2 = floor.devices.find(d => d.id === c.toId);
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
        drawDevice(ctx, dev, skipSelection);
    });
}

function redraw() {
    if (floors.length === 0) return;
    calculateDynamicNumbersGlobal(floors);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentFloorIndex === -1) return;
    const floor = floors[currentFloorIndex];
    if (!floor.image && !isExporting) {
        ctx.fillStyle = "#252529"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (emptyCanvasLogo.complete && emptyCanvasLogo.naturalWidth > 0) {
            const logoWidth = Math.min(180, canvas.width * 0.3);
            const logoHeight = logoWidth * emptyCanvasLogo.naturalHeight / emptyCanvasLogo.naturalWidth;
            ctx.drawImage(emptyCanvasLogo, (canvas.width - logoWidth) / 2, (canvas.height - logoHeight) / 2, logoWidth, logoHeight);
        }
        const spacing = 28;
        for (let x = spacing / 2; x < canvas.width; x += spacing) {
            for (let y = spacing / 2; y < canvas.height; y += spacing) {
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
    } else { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    if (floor.image) {
        ctx.drawImage(floor.image, 0, 0);
        const frame = floor.wallMask;
        if (frame?.frameColumns?.length || frame?.frameRows?.length) {
            const scaleX = frame.width / frame.imageWidth;
            const scaleY = frame.height / frame.imageHeight;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            const fillFrameLines = (lines, lineScale, length, vertical) => {
                const sorted = [...lines].sort((a, b) => a - b);
                let start = sorted[0];
                let end = start;
                for (let i = 1; i <= sorted.length; i++) {
                    if (i < sorted.length && sorted[i] <= end + 1) {
                        end = sorted[i];
                        continue;
                    }
                    const center = (start + end) / (2 * lineScale);
                    const thickness = Math.max((end - start + 3) / lineScale, 3 / scale);
                    const position = center - thickness / 2;
                    if (vertical) ctx.fillRect(position, 0, thickness, length);
                    else ctx.fillRect(0, position, length, thickness);
                    start = sorted[i];
                    end = start;
                }
            };
            if (frame.frameColumns.length) fillFrameLines(frame.frameColumns, scaleX, frame.imageHeight, true);
            if (frame.frameRows.length) fillFrameLines(frame.frameRows, scaleY, frame.imageWidth, false);
            ctx.restore();
        }
    }
    drawPlanGrid(ctx, floor);
    drawPIRCoverage(ctx, floor);

    if ((snapGuideX !== null || snapGuideY !== null) && !isExporting && isDragging) {
        ctx.save(); ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5 / scale; ctx.setLineDash([5 / scale, 5 / scale]); ctx.globalAlpha = 0.6;
        if (snapGuideX !== null) { ctx.beginPath(); ctx.moveTo(snapGuideX, -offsetY / scale); ctx.lineTo(snapGuideX, (canvas.height - offsetY) / scale); ctx.stroke(); }
        if (snapGuideY !== null) { ctx.beginPath(); ctx.moveTo(-offsetX / scale, snapGuideY); ctx.lineTo((canvas.width - offsetX) / scale, snapGuideY); ctx.stroke(); }
        ctx.restore();
    }

    if (isSelecting) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.08)"; ctx.strokeStyle = "rgba(128, 128, 128, 0.75)"; ctx.lineWidth = 1 / scale;
        const w = selEndX - selStartX; const h = selEndY - selStartY;
        ctx.fillRect(selStartX, selStartY, w, h); ctx.strokeRect(selStartX, selStartY, w, h);
    }
    drawFloorData(ctx, floor, false);
}

// ==========================================
// RENDER SŘEZU BUDOVY (PŘEHLED)
// ==========================================
const overviewFloorLabels = ['3NP', '2NP', '1NP', '1PP', '2PP'];

function getOverviewFloorIndex(label) {
    return floors.findIndex(floor => String(floor.name).replace(/\s/g, '').toUpperCase() === label);
}

function updateOverviewFloorButtons(layout) {
    const group = document.getElementById('overviewFloors');
    if (!group.children.length) {
        for (const label of overviewFloorLabels) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'overview-floor'; button.dataset.overviewFloor = label;
            button.innerHTML = '<span class="overview-floor-label"></span><span class="overview-floor-body" aria-hidden="true"></span><span class="overview-floor-count" aria-hidden="true"></span>';
            button.querySelector('.overview-floor-label').textContent = label;
            group.appendChild(button);
        }
    }
    [...group.children].forEach((button, row) => {
        const index = getOverviewFloorIndex(button.dataset.overviewFloor);
        const count = index < 0 ? 0 : floors[index].devices.filter(device => !['deactivated','textNode','ramen','cableTool'].includes(device.type)).length;
        button.disabled = index < 0;
        button.setAttribute('aria-current', String(index === currentFloorIndex));
        button.setAttribute('aria-label', button.dataset.overviewFloor + ' · ' + tr`Počet prvků: ${count}`);
        button.style.left = (layout.x - 76) + 'px';
        button.style.top = (layout.y + row * layout.rowHeight) + 'px';
        button.style.width = (layout.width + 136) + 'px';
        button.style.height = layout.rowHeight + 'px';
        const badge = button.querySelector('.overview-floor-count');
        badge.hidden = count === 0; badge.textContent = String(count);
    });
}

function drawBuildingOverview() {
    const canvas = document.getElementById('overviewCanvas');
    const stage = document.getElementById('overviewStage');
    if (!canvas || !stage || !isOverviewMode) return;
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#252529'; context.fillRect(0,0,width,height);
    context.fillStyle = '#111115'; context.beginPath();
    for (let x = 14; x < width; x += 28) for (let y = 14; y < height; y += 28) {
        context.moveTo(x + 1.7, y); context.arc(x,y,1.7,0,Math.PI * 2);
    }
    context.fill();

    const buildingWidth = Math.min(440, width - 184);
    const roofHeight = 24;
    const rowHeight = Math.max(44, Math.min(88, (height - roofHeight - 48) / 5));
    const totalHeight = roofHeight + 5 * rowHeight;
    const x = (width - buildingWidth) / 2;
    const roofTop = (height - totalHeight) / 2;
    const y = roofTop + roofHeight;
    const groundY = y + 3 * rowHeight;
    updateOverviewFloorButtons({ x, y, width: buildingWidth, rowHeight });

    context.strokeStyle = '#88888f'; context.lineWidth = 1.5; context.setLineDash([8,7]);
    context.beginPath(); context.moveTo(20,groundY); context.lineTo(width - 20,groundY); context.stroke(); context.setLineDash([]);
    context.fillStyle = '#aaaab0'; context.font = '12px sans-serif'; context.textAlign = 'left';
    context.fillText(tr('Terén'), 24, groundY - 10);

    // Flat roofs, projecting volumes and glazing, with two gray basement levels.
    const unit = buildingWidth / 440;
    const frontWidth = buildingWidth * .92;
    const sideDepth = buildingWidth - frontWidth;
    const mainX = x + buildingWidth * .34;
    const mainWidth = frontWidth - buildingWidth * .34;
    const frame = Math.max(4, 7 * unit);
    const line = (x1,y1,x2,y2,color = '#414d4f', thickness = 1) => {
        context.strokeStyle = color; context.lineWidth = thickness;
        context.beginPath(); context.moveTo(x1,y1); context.lineTo(x2,y2); context.stroke();
    };
    const polygon = (points, color) => {
        context.fillStyle = color; context.beginPath();
        points.forEach(([px,py],index) => index ? context.lineTo(px,py) : context.moveTo(px,py));
        context.closePath(); context.fill();
    };
    // Quiet gray foundation distinguishes the underground floors from the facade.
    for (let row = 3; row < 5; row++) {
        const top = y + row * rowHeight;
        context.fillStyle = row === 3 ? '#414147' : '#38383e';
        context.fillRect(x,top,buildingWidth,rowHeight);
        context.strokeStyle = '#828288'; context.lineWidth = 1;
        context.strokeRect(x,top,buildingWidth,rowHeight);
        for (const fraction of [.25,.75]) {
            const ww = buildingWidth * .13, wh = rowHeight * .17;
            context.fillStyle = '#29292f'; context.fillRect(x + buildingWidth * fraction - ww / 2,top + rowHeight * .42,ww,wh);
            context.strokeStyle = '#707078'; context.strokeRect(x + buildingWidth * fraction - ww / 2,top + rowHeight * .42,ww,wh);
        }
    }
    // Recessed ground-floor wing with closely spaced vertical facade fins.
    context.fillStyle = '#627476'; context.fillRect(x,y + 2 * rowHeight,frontWidth, rowHeight);
    for (let px = x + 6 * unit; px < mainX; px += 5 * unit) line(px,y + 2 * rowHeight,px,groundY,'#43585a',.65);
    // Warm, shallow cantilever on the left, matching the reference's timber volume.
    context.fillStyle = '#a49a87'; context.fillRect(x - 10 * unit,y + rowHeight,mainX - x + 10 * unit,rowHeight * .86);
    for (let px = x - 6 * unit; px < mainX; px += 4 * unit) line(px,y + rowHeight + 3 * unit,px,y + rowHeight * 1.86 - 3 * unit,'#8b8274',.55);
    line(x - 10 * unit,y + rowHeight * 1.86,mainX,y + rowHeight * 1.86,'#303f42',5 * unit);
    // Dark side plane and pale front frame give the house a modest sense of depth.
    polygon([[x + frontWidth,y - 5 * unit],[x + buildingWidth,y + sideDepth * .65],
        [x + buildingWidth,groundY],[x + frontWidth,groundY]],'#384e51');
    context.fillStyle = '#bdbbb1'; context.fillRect(mainX,y,mainWidth,3 * rowHeight);
    for (let row = 0; row < 3; row++) {
        const top = y + row * rowHeight;
        const glassX = mainX + frame, glassY = top + frame;
        const glassWidth = mainWidth - 2 * frame, glassHeight = rowHeight - frame * 1.7;
        context.fillStyle = row === 1 ? '#637b7d' : '#71888a';
        context.fillRect(glassX,glassY,glassWidth,glassHeight);
        // Muted interior panels, fine mullions and vertical blinds.
        context.fillStyle = row === 0 ? '#b2ada0' : '#87958f';
        context.fillRect(glassX + glassWidth * .48,glassY,glassWidth * .17,glassHeight);
        for (let px = glassX + 3 * unit; px < glassX + glassWidth * .3; px += 3 * unit) line(px,glassY,px,glassY + glassHeight,'rgba(44,67,69,.4)',.55);
        for (const fraction of [0,.31,.67,1]) line(glassX + glassWidth * fraction,glassY,glassX + glassWidth * fraction,glassY + glassHeight,'#273b3f',fraction === .31 ? 2 * unit : 1);
        context.strokeStyle = '#2e4043'; context.lineWidth = 1.5;
        context.strokeRect(glassX,glassY,glassWidth,glassHeight);
        line(mainX,top + rowHeight - 1,mainX + mainWidth,top + rowHeight - 1,'#a6a69e',1);
    }
    // A slim glazed entrance and a few architectural planting strokes at ground level.
    context.strokeStyle = '#354b4e'; context.lineWidth = 1.3;
    context.strokeRect(x + buildingWidth * .2,y + rowHeight * 2.25,buildingWidth * .09,rowHeight * .75);
    for (const fraction of [.05,.08,.11]) {
        const plantX = x + buildingWidth * fraction;
        line(plantX,groundY,plantX - 7 * unit,groundY - 15 * unit,'#777f7d',1);
        line(plantX,groundY,plantX + 6 * unit,groundY - 12 * unit,'#777f7d',1);
    }
    line(x - 16 * unit,groundY,x + buildingWidth + 12 * unit,groundY,'#9c9ca1',1.5);
}
