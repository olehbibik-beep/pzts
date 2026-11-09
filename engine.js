// ==========================================
// 3. ENGINE: MATEMATIKA A JÁDRO
// ==========================================
function genId() { return Math.random().toString(36).substr(2, 9); }

function getSnappedCoords(x, y, floor, scale, skipDeviceId = null, connectedD1 = null, connectedD2 = null, showDeac) {
    let resX = x, resY = y; let snapDist = 15 / scale;
    let gX = null, gY = null; 
    let snappedX = false, snappedY = false;

    if (connectedD1 && connectedD2) {
        if (Math.abs(x - connectedD1.x) < snapDist) { resX = connectedD1.x; snappedX = true; }
        else if (Math.abs(x - connectedD2.x) < snapDist) { resX = connectedD2.x; snappedX = true; }
        if (Math.abs(y - connectedD1.y) < snapDist) { resY = connectedD1.y; snappedY = true; }
        else if (Math.abs(y - connectedD2.y) < snapDist) { resY = connectedD2.y; snappedY = true; }
    }

    if (!snappedX || !snappedY) {
        for (let dev of floor.devices) {
            if (dev.id === skipDeviceId) continue;
            if (!showDeac && dev.type === 'deactivated') continue; 
            if (!snappedX && Math.abs(x - dev.x) < snapDist) { resX = dev.x; snappedX = true; }
            if (!snappedY && Math.abs(y - dev.y) < snapDist) { resY = dev.y; snappedY = true; }
            if (snappedX && snappedY) break;
        }
    }

    if (!snappedX) resX = Math.round(x / 10) * 10;
    if (!snappedY) resY = Math.round(y / 10) * 10;
    if (snappedX) gX = resX;
    if (snappedY) gY = resY;
    
    return { x: resX, y: resY, guideX: gX, guideY: gY };
}

function distToSegmentSquared(p, v, w) {
    let l2 = (w.x - v.x)*(w.x - v.x) + (w.y - v.y)*(w.y - v.y);
    if (l2 === 0) return (p.x - v.x)*(p.x - v.x) + (p.y - v.y)*(p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t)); return (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
}

function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

function hitTestCables(canvasX, canvasY, floor, showDeac) {
    const p = {x: canvasX, y: canvasY};
    for (let i = floor.cables.length - 1; i >= 0; i--) {
        let c = floor.cables[i]; let d1 = floor.devices.find(d => d.id === c.fromId); let d2 = floor.devices.find(d => d.id === c.toId);
        if (!d1 || !d2) continue;
        if (!showDeac && (d1.type === 'deactivated' || d2.type === 'deactivated')) continue; 
        if (d1.type === 'textNode' || d2.type === 'textNode') {
            if (distToSegment(p, {x: d1.x, y: d1.y}, {x: d2.x, y: d2.y}) < 8) return c.id; continue;
        }
        const points = [ {x: d1.x, y: d1.y}, {x: c.h1x, y: c.h1y}, {x: c.h2x, y: c.h2y}, {x: c.h3x, y: c.h3y}, {x: d2.x, y: d2.y} ];
        for(let j = 0; j < points.length - 1; j++) { if (distToSegment(p, points[j], points[j+1]) < 8) return c.id; }
    }
    return null;
}

function recalcCableHandles(c, d1, d2) {
    c.h1x = d1.x + (d2.x - d1.x)*0.25; c.h1y = d1.y + (d2.y - d1.y)*0.25;
    c.h2x = d1.x + (d2.x - d1.x)*0.50; c.h2y = d1.y + (d2.y - d1.y)*0.50;
    c.h3x = d1.x + (d2.x - d1.x)*0.75; c.h3y = d1.y + (d2.y - d1.y)*0.75;
}

function getDeviceAddressParts(device) {
    if (!device.number || ['panel', 'abax', 'textNode', 'ramen', 'deactivated', 'cableTool'].includes(device.type)) return { prefix: '', number: '' };
    const prefix = ['expander', 'keypad', 'siren'].includes(device.type) ? '' : `${device.loopId || 1}/`;
    return { prefix, number: String(device.number) };
}

function calculateDynamicNumbersGlobal(floorsArray) {
    if (!floorsArray || floorsArray.length === 0) return;

    let taken = { expander: new Set(), keypad: new Set(), abax: new Set(), siren: new Set(), loops: {} };
    
    // ЭТАП 1: Собираем все ручные (замороженные) номера, чтобы не занять их
    floorsArray.forEach(floor => {
        if (!floor || !floor.devices) return;
        floor.devices.forEach(dev => {
            if (dev.manualNumber) {
                if (['expander', 'keypad', 'abax', 'siren'].includes(dev.type)) {
                    taken[dev.type].add(dev.manualNumber);
                } else if (!['panel', 'deactivated', 'textNode', 'ramen', 'cableTool'].includes(dev.type)) {
                    let lId = dev.loopId || 1;
                    if (!taken.loops[lId]) taken.loops[lId] = new Set();
                    taken.loops[lId].add(dev.manualNumber);
                }
            }
        });
    });

    let counters = { expander: 1, keypad: 1, abax: 1, siren: 1, loops: {} };
    
    // Функция: найти следующий свободный номер
    function getNextFree(category, isLoop = false) {
        let current = isLoop ? (counters.loops[category] || 1) : counters[category];
        let takenSet = isLoop ? (taken.loops[category] || new Set()) : taken[category];
        
        while (takenSet.has(current)) {
            current++;
        }
        if (isLoop) counters.loops[category] = current + 1;
        else counters[category] = current + 1;
        
        return current;
    }

    // ЭТАП 2: Раздаем номера (с учетом прыжков счетчика)
    floorsArray.forEach(floor => {
        if (!floor || !floor.devices) return;
        floor.devices.forEach(dev => {
            if (['panel', 'deactivated', 'textNode', 'ramen', 'cableTool'].includes(dev.type)) {
                dev.number = "";
                return;
            }

            if (dev.manualNumber) {
                dev.number = dev.manualNumber;
                // ПРЫЖОК СЧЕТЧИКА: Автоматика продолжает отсчет после ручного номера
                if (['expander', 'keypad', 'abax', 'siren'].includes(dev.type)) {
                    if (dev.manualNumber >= (counters[dev.type] || 1)) counters[dev.type] = dev.manualNumber + 1;
                } else {
                    let lId = dev.loopId || 1;
                    if (!counters.loops[lId]) counters.loops[lId] = 1;
                    if (dev.manualNumber >= counters.loops[lId]) counters.loops[lId] = dev.manualNumber + 1;
                }
            } else {
                // Выдаем автоматический номер
                if (['expander', 'keypad', 'abax', 'siren'].includes(dev.type)) {
                    dev.number = getNextFree(dev.type, false);
                } else {
                    let lId = dev.loopId || 1;
                    dev.number = getNextFree(lId, true);
                }
            }
        });
    });
}

function getProjectBounds(floor, showDeac) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (floor.image) { const bounds=getPlanSourceBounds(floor);minX=bounds.minX;minY=bounds.minY;maxX=minX+bounds.width;maxY=minY+bounds.height; }
    if (floor.devices.length === 0 && !floor.image) return { minX: 0, minY: 0, width: 1920, height: 1080 };

    floor.devices.forEach(d => {
        if (!showDeac && d.type === 'deactivated') return;
        minX = Math.min(minX, d.x - 50); minY = Math.min(minY, d.y - 50);
        maxX = Math.max(maxX, d.x + 50); maxY = Math.max(maxY, d.y + 50);
    });

    floor.cables.forEach(c => {
        let d1 = floor.devices.find(d => d.id === c.fromId);
        let d2 = floor.devices.find(d => d.id === c.toId);
        if (d1 && d2 && d1.type !== 'textNode' && d2.type !== 'textNode') {
            if (!showDeac && (d1.type === 'deactivated' || d2.type === 'deactivated')) return;
            for(let i=1; i<=3; i++) {
                minX = Math.min(minX, c['h'+i+'x'] - 50); minY = Math.min(minY, c['h'+i+'y'] - 50);
                maxX = Math.max(maxX, c['h'+i+'x'] + 50); maxY = Math.max(maxY, c['h'+i+'y'] + 50);
            }
        }
    });

    if (minX === Infinity) { minX = 0; minY = 0; maxX = 1920; maxY = 1080; }
    minX -= 50; minY -= 50; maxX += 50; maxY += 50; 
    return { minX, minY, width: maxX - minX, height: maxY - minY };
}
