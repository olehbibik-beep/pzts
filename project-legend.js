// A floor annotation in world coordinates; the same vectors are used on screen and on paper.
const legendDeviceTypes = new Set(['panel','expander','abax','keypad','pir','pir_wl','magnet','magnet_wl','glassbreak','panic','siren']);
let selectedProjectLegend = null;
let projectLegendDrag = null;
const projectLegendLayouts = new WeakMap();

function sanitizeProjectLegend(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.entries)) return null;
    const finite = (n, fallback, min, max) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    return {
        visible: value.visible !== false,
        x: finite(value.x, 0, -1e7, 1e7), y: finite(value.y, 0, -1e7, 1e7),
        scale: finite(value.scale, 1, .01, 1000),
        entries: value.entries.slice(0, 50).filter(entry => entry && legendDeviceTypes.has(entry.type)).map(entry => ({
            type: entry.type, label: typeof entry.label === 'string' ? entry.label.slice(0, 160) : entry.type,
            // Keep the snapshot even during early startup, before the icon editor has loaded.
            shapes: Array.isArray(entry.shapes) ? entry.shapes.slice(0, 100).filter(s => s && typeof s === 'object').map(s => ({
                kind:s.kind,x:s.x,y:s.y,size:s.size,rotation:s.rotation,color:s.color,fill:s.fill,stroke:s.stroke,
                text:typeof s.text==='string'?s.text.slice(0,8):''
            })) : []
        }))
    };
}
function projectLegendEntries() {
    const menu = getActiveToolbarMenu();
    return [...new Set(menu.deviceTypes)].filter(type => legendDeviceTypes.has(type)).map(type => ({
        type, label: toolbarMenuTypes.find(item => item.type === type)?.title || type,
        shapes: sanitizeIconShapes(customDeviceIcons[type])
    }));
}
function projectLegendLayout(legend) {
    const language = getGoomLanguage();
    const iconsReady = typeof sanitizeIconShapes === 'function';
    const cached = projectLegendLayouts.get(legend);
    if (cached?.language === language && cached.entries === legend.entries && cached.iconsReady === iconsReady) return cached;
    ctx.save(); ctx.font = '13px sans-serif';
    const labels = legend.entries.map(entry => tr(entry.label));
    const width = Math.max(170, ...labels.map(label => 56 + ctx.measureText(label).width));
    ctx.restore();
    const shapes = legend.entries.map(entry => iconsReady ? sanitizeIconShapes(entry.shapes) : []);
    const layout = {language, iconsReady, entries:legend.entries, labels, shapes, width, height:34 + legend.entries.length * 28};
    projectLegendLayouts.set(legend, layout);
    return layout;
}
function getProjectLegendBounds(floor) {
    const legend = floor?.legend;
    if (!legend?.visible || !legend.entries.length) return null;
    const layout = projectLegendLayout(legend);
    return {minX:legend.x, minY:legend.y, width:layout.width * legend.scale, height:layout.height * legend.scale};
}
function drawProjectLegend(target, floor, editing, theme) {
    const legend = floor.legend, bounds = getProjectLegendBounds(floor);
    if (!bounds) return;
    const layout = projectLegendLayout(legend);
    target.save(); target.translate(legend.x, legend.y); target.scale(legend.scale, legend.scale);
    target.textAlign = 'left'; target.textBaseline = 'middle';
    target.fillStyle = theme === 'dark' ? '#f4f4f5' : '#171719'; target.font = '16px sans-serif';
    target.fillText(tr('LEGENDA'), 0, 12);
    legend.entries.forEach((entry, index) => {
        const y = 46 + index * 28;
        target.save(); target.translate(20, y);
        const shapes = layout.shapes[index];
        if (shapes.length) {
            target.scale(.075, .075); target.translate(-200, -200);
            shapes.forEach(shape => drawEditorShape(target, shape));
        } else drawDevice(target, {type:entry.type, x:0, y:0}, true, theme, {baseSize:10, defaultIcon:true});
        target.restore();
        target.fillStyle = theme === 'dark' ? '#f4f4f5' : '#171719';
        target.font = '13px sans-serif'; target.textAlign = 'left'; target.textBaseline = 'middle';
        target.fillText(layout.labels[index], 48, y);
    });
    target.restore();
    // The only editing mark is a small corner grip. It never reaches an export.
    if (editing && selectedProjectLegend === legend) {
        const x = bounds.minX + bounds.width, y = bounds.minY + bounds.height, unit = 1 / scale;
        target.save(); target.strokeStyle = theme === 'dark' ? '#a1a1aa' : '#52525b'; target.lineWidth = 1.5 * unit;
        target.beginPath(); target.moveTo(x-12*unit,y);target.lineTo(x,y-12*unit);
        target.moveTo(x-6*unit,y);target.lineTo(x,y-6*unit);target.stroke();target.restore();
    }
}
function projectLegendHit(x, y) {
    const floor = floors[currentFloorIndex], bounds = getProjectLegendBounds(floor);
    if (!bounds) return null;
    const right = bounds.minX + bounds.width, bottom = bounds.minY + bounds.height;
    if (selectedProjectLegend === floor.legend && Math.hypot(x-right,y-bottom) <= 22 / scale) return 'resize';
    return x >= bounds.minX && x <= right && y >= bounds.minY && y <= bottom ? 'move' : null;
}
function beginProjectLegendDrag(event, x, y) {
    const mode = projectLegendHit(x, y);
    if (!mode) { selectedProjectLegend = null; requestRedraw(); return false; }
    const legend = floors[currentFloorIndex].legend;
    selectedProjectLegend = legend; activeDeviceIds.clear(); window.clearGoomTooltips?.();
    projectLegendDrag = {legend, mode, pointerId:event.pointerId, x, y, startX:legend.x, startY:legend.y, startScale:legend.scale, changed:false};
    container.setPointerCapture(event.pointerId); event.preventDefault(); requestRedraw(); return true;
}
function moveProjectLegend(event, x, y) {
    const drag = projectLegendDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    if (floors[currentFloorIndex]?.legend !== drag.legend) { finishProjectLegendDrag(); return true; }
    if (drag.mode === 'move') { drag.legend.x = drag.startX + x-drag.x; drag.legend.y = drag.startY + y-drag.y; }
    else {
        const layout = projectLegendLayout(drag.legend), w = layout.width, h = layout.height;
        const dx = x-drag.x, dy = y-drag.y;
        drag.legend.scale = Math.max(.01, Math.min(1000, drag.startScale + (dx*w+dy*h)/(w*w+h*h)));
    }
    drag.changed = drag.legend.x !== drag.startX || drag.legend.y !== drag.startY || drag.legend.scale !== drag.startScale;
    container.style.cursor = drag.mode === 'resize' ? 'nwse-resize' : 'grabbing'; requestRedraw(); return true;
}
function finishProjectLegendDrag(event) {
    const drag = projectLegendDrag;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return false;
    projectLegendDrag = null;
    if (container.hasPointerCapture(drag.pointerId)) container.releasePointerCapture(drag.pointerId);
    if (drag.changed) { saveStateToHistory(); triggerAutoSave(); }
    requestRedraw(); return true;
}
function hoverProjectLegend(x,y) {
    const mode = projectLegendHit(x,y);
    if (!mode) return false;
    window.clearGoomTooltips?.(); container.style.cursor = mode === 'resize' ? 'nwse-resize' : 'move'; return true;
}
function toggleProjectLegend() {
    const floor = floors[currentFloorIndex];
    if (!floor || !isSystemReady) return;
    finishProjectLegendDrag();
    if (floor.legend?.entries.length) floor.legend.visible = !floor.legend.visible;
    else {
        const legend = {visible:true,x:0,y:0,scale:1,entries:projectLegendEntries()};
        if (!legend.entries.length) return;
        const layout = projectLegendLayout(legend), width = planCanvasWidth(), height = planCanvasHeight();
        const displayScale = Math.min(1, width*.38/layout.width, height*.65/layout.height);
        legend.scale = Math.max(.01, Math.min(1000, displayScale / scale));
        legend.x = (width - 28 - layout.width*legend.scale*scale - offsetX)/scale;
        legend.y = (28-offsetY)/scale;
        floor.legend = legend;
    }
    selectedProjectLegend = floor.legend.visible ? floor.legend : null;
    activeDeviceIds.clear(); resetPlacementTool();
    document.getElementById('mainMenuModal').style.display = 'none';
    saveStateToHistory(); triggerAutoSave(); requestRedraw(); updateProjectLegendButton();
}
function updateProjectLegendButton() {
    const button = document.getElementById('btnMenuLegend');
    if (!button) return;
    const visible = !!floors[currentFloorIndex]?.legend?.visible;
    button.querySelector('span').textContent = tr(visible ? 'Skrýt legendu' : 'Zobrazit legendu');
    button.setAttribute('aria-pressed', String(visible));
    button.title = tr('Přetažením přesunout, rohem změnit velikost.');
}
document.getElementById('btnMenuLegend').addEventListener('click', toggleProjectLegend);
new MutationObserver(updateProjectLegendButton).observe(document.getElementById('mainMenuModal'),{attributes:true,attributeFilter:['style']});
window.addEventListener('goom-language-changed', () => {updateProjectLegendButton();requestRedraw();});
// Keyboard precision also makes resizing discoverable without a mouse grip.
window.addEventListener('keydown', event => {
    const legend = floors[currentFloorIndex]?.legend;
    if (!legend?.visible || selectedProjectLegend !== legend || isOverviewMode ||
        event.target.closest?.('input,textarea,select,[contenteditable="true"]') ||
        [...document.querySelectorAll('.modal')].some(modal => getComputedStyle(modal).display !== 'none')) return;
    const key = event.key;
    if (!['+','=','-','_','Escape','Delete','Backspace','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)) return;
    event.preventDefault();event.stopImmediatePropagation();
    if (key === 'Escape') selectedProjectLegend = null;
    else {
        if (key === 'Delete' || key === 'Backspace') {legend.visible = false;selectedProjectLegend = null;}
        else if (key.startsWith('Arrow')) {const step=(event.shiftKey?10:1)/scale;legend.x+=(key==='ArrowRight'?step:key==='ArrowLeft'?-step:0);legend.y+=(key==='ArrowDown'?step:key==='ArrowUp'?-step:0);}
        else legend.scale = Math.max(.01,Math.min(1000,legend.scale * ((key==='-' || key==='_') ? .9 : 1.1)));
        saveStateToHistory();triggerAutoSave();
    }
    updateProjectLegendButton();requestRedraw();
},true);
