// ==========================================
// 3. ENGINE: MATEMATIKA A JÁDRO
// ==========================================
function genId() { return Math.random().toString(36).substr(2, 9); }

function getSnappedCoords(x, y, floor, scale, skipDeviceId = null, connectedD1 = null, connectedD2 = null, showDeac, movingIds) {
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
            if (dev.id === skipDeviceId || movingIds?.has(dev.id)) continue;
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

function getCableRoute(cable, from, to) {
    const { h1x, h1y, h2x, h2y, h3x, h3y } = cable;
    return [from, { x: h1x, y: from.y }, { x: h1x, y: h1y }, { x: h2x, y: h1y }, { x: h2x, y: h2y },
        { x: h3x, y: h2y }, { x: h3x, y: h3y }, { x: to.x, y: h3y }, to];
}

function hitTestCables(canvasX, canvasY, floor, showDeac) {
    const p = {x: canvasX, y: canvasY};
    const devicesById=new Map(floor.devices.map(device=>[device.id,device]));
    let nearest = 8 ** 2;
    let hit = null;
    for (let i = floor.cables.length - 1; i >= 0; i--) {
        const cable = floor.cables[i];
        const from = devicesById.get(cable.fromId), to = devicesById.get(cable.toId);
        if (!from || !to || (!showDeac && (from.type === 'deactivated' || to.type === 'deactivated'))) continue;
        const points = from.type === 'textNode' || to.type === 'textNode' ? [from, to] : getCableRoute(cable, from, to);
        for (let j = 1; j < points.length; j++) {
            const distance = distToSegmentSquared(p, points[j - 1], points[j]);
            if (!(distance < nearest)) continue;
            nearest = distance;
            hit = cable.id;
        }
    }
    return hit;
}

function recalcCableHandles(c, d1, d2) {
    c.h1x = d1.x + (d2.x - d1.x)*0.25; c.h1y = d1.y + (d2.y - d1.y)*0.25;
    c.h2x = d1.x + (d2.x - d1.x)*0.50; c.h2y = d1.y + (d2.y - d1.y)*0.50;
    c.h3x = d1.x + (d2.x - d1.x)*0.75; c.h3y = d1.y + (d2.y - d1.y)*0.75;
}

function fixedCableEnds(cable) {
    // Older custom routes have coordinates but no record of which small handles were moved.
    return cable.fixedEnds ?? (cable.isCustom ? 3 : 0);
}

function refreshAutomaticCableEnds(cable, from, to) {
    const fixed = fixedCableEnds(cable);
    if (!(fixed & 1)) {
        cable.h1x = (from.x + cable.h2x) / 2;
        cable.h1y = (from.y + cable.h2y) / 2;
    }
    if (!(fixed & 2)) {
        cable.h3x = (to.x + cable.h2x) / 2;
        cable.h3y = (to.y + cable.h2y) / 2;
    }
}

const independentDeviceNumberTypes = new Set(['expander', 'keypad', 'abax', 'siren', 'acs_module', 'acs_reader']);

function getDeviceAddressParts(device) {
    if (!device.number || ['panel', 'abax', 'textNode', 'ramen', 'deactivated', 'cableTool'].includes(device.type)) return { prefix: '', number: '' };
    const prefix = independentDeviceNumberTypes.has(device.type) ? '' : `${device.loopId || 1}/`;
    return { prefix, number: String(device.number) };
}

function getDeviceNumberGroup(device) {
    if (['panel', 'deactivated', 'textNode', 'ramen', 'cableTool'].includes(device.type)) return null;
    if (independentDeviceNumberTypes.has(device.type)) return device.type;
    return `bus:${device.loopId || 1}`;
}

function mergeAddressReservations(reservations) {
    const sorted = reservations.filter(range => typeof range?.group === 'string'
        && (independentDeviceNumberTypes.has(range.group) || /^bus:\d+$/.test(range.group))
        && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end)
        && range.start > 0 && range.end >= range.start).sort((a, b) => a.group.localeCompare(b.group) || a.start - b.start);
    const merged = [];
    for (const range of sorted) {
        const previous = merged.at(-1);
        if (previous?.group === range.group && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
        else merged.push({ group: range.group, start: range.start, end: range.end });
    }
    return merged;
}

function reserveDeletedAddresses(floorsArray, floor, deletedIds) {
    const groups = new Map();
    for (const device of floor.devices) {
        const group = getDeviceNumberGroup(device);
        if (!deletedIds.has(device.id) || !group || !Number.isSafeInteger(device.number)) continue;
        const entry = groups.get(group) || { last: 0, remaining: new Set() };
        entry.last = Math.max(entry.last, device.number);
        groups.set(group, entry);
    }
    for (const item of floorsArray) {
        for (const device of item.devices) {
            const entry = groups.get(getDeviceNumberGroup(device));
            if (!entry || !Number.isSafeInteger(device.number) || device.number < 1 || (item === floor && deletedIds.has(device.id))) continue;
            entry.last = Math.max(entry.last, device.number);
            entry.remaining.add(device.number);
        }
    }
    const reservations = [...(floor.addressReservations || [])];
    for (const [group, { last, remaining }] of groups) {
        // Preserve earlier jumps as well when the removed device held a manually assigned address.
        let start = 1;
        for (const number of [...remaining].sort((a, b) => a - b)) {
            if (number > start) reservations.push({ group, start, end: number - 1 });
            start = number + 1;
        }
        if (start <= last) reservations.push({ group, start, end: last });
    }
    floor.addressReservations = mergeAddressReservations(reservations);
}

function calculateDynamicNumbersGlobal(floorsArray) {
    if (!floorsArray?.length) return;
    const devices = floorsArray.flatMap(floor => floor?.devices || []);
    const blocked = floorsArray.flatMap(floor => floor?.addressReservations || []);
    const counters = new Map();
    for (const device of devices) {
        const group = getDeviceNumberGroup(device);
        if (!group) continue;
        if (!counters.has(group)) counters.set(group, { next: 1, offset: 0, ranges: [] });
        const number = Number(device.manualNumber);
        if (Number.isSafeInteger(number) && number > 0) blocked.push({ group, start: number, end: number });
    }
    for (const range of mergeAddressReservations(blocked)) counters.get(range.group)?.ranges.push(range);

    for (const device of devices) {
        const counter = counters.get(getDeviceNumberGroup(device));
        if (!counter) { device.number = ''; continue; }
        const manual = Number(device.manualNumber);
        if (Number.isSafeInteger(manual) && manual > 0) {
            device.number = manual;
            counter.next = Math.max(counter.next, manual + 1);
            continue;
        }
        while (counter.ranges[counter.offset]?.start <= counter.next) {
            counter.next = Math.max(counter.next, counter.ranges[counter.offset++].end + 1);
        }
        device.number = counter.next++;
    }
}

function getProjectBounds(floor, showDeac) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (floor.image) { const bounds=getPlanSourceBounds(floor);minX=bounds.minX;minY=bounds.minY;maxX=minX+bounds.width;maxY=minY+bounds.height; }
    const legendBounds = getProjectLegendBounds(floor);
    if (legendBounds) {
        minX=Math.min(minX,legendBounds.minX); minY=Math.min(minY,legendBounds.minY);
        maxX=Math.max(maxX,legendBounds.minX+legendBounds.width); maxY=Math.max(maxY,legendBounds.minY+legendBounds.height);
    }
    if (floor.devices.length === 0 && !floor.image && !legendBounds) return { minX: 0, minY: 0, width: 1920, height: 1080 };

    floor.devices.forEach(d => {
        if (!showDeac && d.type === 'deactivated') return;
        minX = Math.min(minX, d.x - 50); minY = Math.min(minY, d.y - 50);
        maxX = Math.max(maxX, d.x + 50); maxY = Math.max(maxY, d.y + 50);
    });

    const devicesById=new Map(floor.devices.map(device=>[device.id,device]));
    floor.cables.forEach(c => {
        const d1=devicesById.get(c.fromId),d2=devicesById.get(c.toId);
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
