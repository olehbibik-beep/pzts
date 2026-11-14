const iconEditorDeviceTypes = [
    ['panel', tr('Управляющая панель')],
    ['expander', tr('Расширитель')],
    ['abax', tr('Беспроводной модуль')],
    ['keypad', tr('Клавиатура')],
    ['pir', tr('PIR датчик')],
    ['pir_wl', tr('Беспроводной PIR')],
    ['magnet', tr('Магнитный контакт')],
    ['magnet_wl', tr('Беспроводной контакт')],
    ['glassbreak', tr('Датчик разбития стекла')],
    ['panic', tr('Тревожная кнопка')],
    ['siren', tr('Сирена')]
];

const iconEditorCanvas = document.getElementById('iconEditorCanvas');
const iconEditorCtx = iconEditorCanvas.getContext('2d');
const iconEditorModal = document.getElementById('iconEditorModal');
const iconEditorTarget = document.getElementById('iconEditorTarget');
const iconEditorTemplate = document.getElementById('iconEditorTemplate');
const iconEditorTurn = document.getElementById('iconEditorTurn');
const iconEditorShapeKinds = new Set(['circle', 'rect', 'roundRect', 'triangle', 'diamond', 'line', 'text', 'ellipse', 'hexagon', 'arc', 'arrow']);
const iconEditorOpenShapes = new Set(['line', 'arc', 'arrow']);
const canChangeIcon = () => Boolean(window.hasProAccess?.() && typeof editingToolbarMenu !== 'undefined'
    && editingToolbarMenu && !isBuiltInToolbarMenu(editingToolbarMenu));
let iconEditorShapes = [];
let iconEditorSelectedIndex = -1;
let iconEditorHistory = [];
let iconEditorHistoryIndex = -1;
let iconEditorDragging = false;
let iconEditorDragChanged = false;
let iconEditorDragOffset = { x: 0, y: 0 };
let iconEditorPendingShapeKind = null;
let iconEditorDrawingShape = false;
let iconEditorDrawAnchor = null;
const customDeviceShapeCache = new WeakMap();
const defaultDeviceButtonContent = new Map();

iconEditorDeviceTypes.forEach(([type, label]) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = label;
    iconEditorTarget.appendChild(option);
    const button = document.querySelector(`#deviceSelector .device-btn[data-type="${type}"]`);
    if (button) defaultDeviceButtonContent.set(type, button.innerHTML);
});

function cloneIconShapes(shapes) {
    return JSON.parse(JSON.stringify(shapes));
}

function hslColorToHex(hue, saturation, lightness) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const section = hue / 60;
    const intermediate = chroma * (1 - Math.abs(section % 2 - 1));
    const offset = lightness - chroma / 2;
    const [red, green, blue] = section < 1 ? [chroma, intermediate, 0]
        : section < 2 ? [intermediate, chroma, 0]
            : section < 3 ? [0, chroma, intermediate]
                : section < 4 ? [0, intermediate, chroma]
                    : section < 5 ? [intermediate, 0, chroma]
                        : [chroma, 0, intermediate];
    return `#${[red, green, blue].map(channel =>
        Math.round((channel + offset) * 255).toString(16).padStart(2, '0')
    ).join('')}`;
}

function updateIconEditorColorPalette() {
    document.querySelectorAll('.icon-editor-color-swatch').forEach(button => {
        button.classList.toggle('selected', button.dataset.color === document.getElementById('iconEditorColor').value);
    });
}

function buildIconEditorColorPalette() {
    const palette = document.getElementById('iconEditorColorPalette');
    const tones = [0.9, 0.74, 0.58, 0.42, 0.26, 0.1];
    const colors = tones.flatMap(lightness =>
        Array.from({ length: 12 }, (_, index) => hslColorToHex(index * 30, 0.82, lightness))
    );
    colors.push(...[0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08].map(lightness =>
        hslColorToHex(0, 0, lightness)
    ));
    colors.forEach(color => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'icon-editor-color-swatch';
        swatch.dataset.color = color;
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.setAttribute('aria-label', tr`Цвет ${color}`);
        swatch.addEventListener('click', () => {
            if (!canChangeIcon()) return;
            document.getElementById('iconEditorColor').value = color;
            const shape = iconEditorShapes[iconEditorSelectedIndex];
            if (shape) {
                shape.color = color;
                pushIconEditorHistory();
                redrawIconEditor();
                saveIconEditorChanges();
            }
            updateIconEditorColorPalette();
        });
        palette.append(swatch);
    });
    updateIconEditorColorPalette();
}

function sanitizeIconShapes(shapes) {
    if (!Array.isArray(shapes)) return [];
    return shapes.slice(0, 100).filter(shape => shape && iconEditorShapeKinds.has(shape.kind)).map(shape => ({
        kind: shape.kind,
        x: Number.isFinite(shape.x) ? Math.min(400, Math.max(0, shape.x)) : 200,
        y: Number.isFinite(shape.y) ? Math.min(400, Math.max(0, shape.y)) : 200,
        size: Number.isFinite(shape.size) ? Math.min(400, Math.max(10, shape.size)) : 90,
        rotation: Number.isFinite(shape.rotation) ? Math.max(-180, Math.min(180, shape.rotation)) : 0,
        color: /^#[0-9a-f]{6}$/i.test(shape.color) ? shape.color : '#22c55e',
        fill: shape.fill === true,
        fillColor: /^#[0-9a-f]{6}$/i.test(shape.fillColor) ? shape.fillColor : null,
        stroke: Number.isFinite(shape.stroke) ? Math.min(24, Math.max(1, shape.stroke)) : 6,
        fontWeight: Number.isFinite(shape.fontWeight) ? Math.min(900, Math.max(100, Math.round(shape.fontWeight / 100) * 100)) : 700,
        text: typeof shape.text === 'string' ? shape.text.slice(0, 8) : 'A'
    }));
}

function iconShapeLines(kind, half) {
    switch (kind) {
        case 'triangle': return [[0, -half], [half, half], [-half, half]];
        case 'diamond': return [[0, -half], [half, 0], [0, half], [-half, 0]];
        case 'hexagon': return [[-half / 2, -half * .86], [half / 2, -half * .86], [half, 0], [half / 2, half * .86], [-half / 2, half * .86], [-half, 0]];
        case 'line': return [[-half, 0], [half, 0]];
        case 'arrow': return [[-half, 0], [half, 0], [half * .49, -half * .53], [half, 0], [half * .49, half * .53]];
    }
}

function escapeIconXml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[char]);
}

function getCustomDeviceIconSvg(type, iconMap = customDeviceIcons) {
    const shapes = sanitizeIconShapes(iconMap[type]);
    if (!shapes.length) return null;
    const elements = shapes.map(shape => {
        const half = shape.size / 2;
        const fill = shape.fill && !iconEditorOpenShapes.has(shape.kind) ? shape.fillColor || shape.color : 'none';
        const stroke = shape.kind === 'text' ? 'none' : shape.color;
        const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${shape.stroke}" stroke-linecap="round" stroke-linejoin="round"`;
        let geometry;
        if (shape.kind === 'circle') geometry = `<circle cx="0" cy="0" r="${half}" ${attrs}/>`;
        else if (shape.kind === 'ellipse') geometry = `<ellipse cx="0" cy="0" rx="${half}" ry="${half * .62}" ${attrs}/>`;
        else if (shape.kind === 'rect') geometry = `<rect x="${-half}" y="${-half}" width="${shape.size}" height="${shape.size}" ${attrs}/>`;
        else if (shape.kind === 'roundRect') geometry = `<rect x="${-half}" y="${-half}" width="${shape.size}" height="${shape.size}" rx="${shape.size * 0.14}" ${attrs}/>`;
        else if (shape.kind === 'arc') geometry = `<path d="M ${-half} 0 A ${half} ${half} 0 0 1 ${half} 0" ${attrs}/>`;
        else if (shape.kind === 'text') geometry = `<text x="0" y="0" fill="${shape.color}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="${shape.fontWeight}" font-size="${Math.max(10, shape.size * .75)}">${escapeIconXml(shape.text)}</text>`;
        else {
            const points = iconShapeLines(shape.kind, half).map(point => point.join(' ')).join(' ');
            const tag = iconEditorOpenShapes.has(shape.kind) ? 'polyline' : 'polygon';
            geometry = `<${tag} points="${points}" ${attrs}/>`;
        }
        return `<g transform="translate(${shape.x} ${shape.y}) rotate(${shape.rotation})">${geometry}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${elements}</svg>`;
}

function getCustomDeviceIconDataUrl(type, iconMap = customDeviceIcons) {
    const svg = getCustomDeviceIconSvg(type, iconMap);
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}

function getCustomDeviceShapes(type) {
    const source = customDeviceIcons[type];
    if (!Array.isArray(source)) return null;
    if (!customDeviceShapeCache.has(source)) customDeviceShapeCache.set(source, sanitizeIconShapes(source));
    return customDeviceShapeCache.get(source);
}

function refreshCustomDeviceIcons() {
    iconEditorDeviceTypes.forEach(([type]) => {
        const button = document.querySelector(`#deviceSelector .device-btn[data-type="${type}"]`);
        if (!button) return;
        const dataUrl = getCustomDeviceIconDataUrl(type);
        button.innerHTML = dataUrl
            ? `<img src="${dataUrl}" alt="" style="width:24px;height:24px;object-fit:contain;">`
            : defaultDeviceButtonContent.get(type) || button.innerHTML;
    });
    if (typeof renderToolbarMenuEditor === 'function') renderToolbarMenuEditor();
    requestRedraw();
}

function drawEditorShape(ctx, shape) {
    const half = shape.size / 2;
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.rotation * Math.PI / 180);
    ctx.lineWidth = shape.stroke;
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.fillColor || shape.color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (shape.kind === 'circle') ctx.arc(0, 0, half, 0, Math.PI * 2);
    else if (shape.kind === 'ellipse') {
        ctx.save();
        ctx.scale(1, .62);
        ctx.arc(0, 0, half, 0, Math.PI * 2);
        ctx.restore();
    }
    else if (shape.kind === 'rect') ctx.rect(-half, -half, shape.size, shape.size);
    else if (shape.kind === 'roundRect') ctx.roundRect(-half, -half, shape.size, shape.size, shape.size * 0.14);
    else if (shape.kind === 'arc') ctx.arc(0, 0, half, Math.PI, Math.PI * 2);
    else if (shape.kind === 'text') {
        ctx.fillStyle = shape.color;
        ctx.font = `${shape.fontWeight} ${Math.max(10, shape.size * 0.75)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(shape.text, 0, 0, shape.size * 1.5);
        ctx.restore();
        return;
    } else {
        const [first, ...rest] = iconShapeLines(shape.kind, half);
        ctx.moveTo(...first);
        for (const point of rest) ctx.lineTo(...point);
        if (!iconEditorOpenShapes.has(shape.kind)) ctx.closePath();
    }
    if (!iconEditorOpenShapes.has(shape.kind) && shape.fill) ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function redrawIconEditor() {
    iconEditorCtx.clearRect(0, 0, 400, 400);
    iconEditorShapes.forEach((shape, index) => {
        drawEditorShape(iconEditorCtx, shape);
        if (index === iconEditorSelectedIndex) {
            iconEditorCtx.save();
            iconEditorCtx.strokeStyle = '#0ea5e9';
            iconEditorCtx.lineWidth = 1.5;
            iconEditorCtx.setLineDash([5, 4]);
            iconEditorCtx.strokeRect(shape.x - shape.size / 2 - 7, shape.y - shape.size / 2 - 7, shape.size + 14, shape.size + 14);
            iconEditorCtx.restore();
        }
    });
    document.getElementById('iconEditorSelection').textContent = iconEditorSelectedIndex < 0
        ? tr('Выберите фигуру или добавьте новую.')
        : tr`Выбрана фигура ${iconEditorSelectedIndex + 1} из ${iconEditorShapes.length}. Перетаскивайте её мышью.`;
    updateIconEditorControls();
    updateIconEditorColorPalette();
}

function updateIconEditorControls() {
    const shape = iconEditorShapes[iconEditorSelectedIndex];
    const editable = canChangeIcon();
    const disabled = !shape || !editable;
    const text = shape?.kind === 'text';
    const fillable = shape && !text && !iconEditorOpenShapes.has(shape.kind);
    ['iconEditorColor', 'iconEditorSize', 'btnIconEditorDelete', 'btnIconEditorDuplicate']
        .forEach(id => { document.getElementById(id).disabled = disabled; });
    for (const id of ['iconEditorFill', 'iconEditorFillColor']) document.getElementById(id).disabled = disabled || !fillable;
    document.getElementById('iconEditorStroke').disabled = disabled || text;
    document.getElementById('iconEditorWeight').disabled = disabled || !text;
    document.getElementById('iconEditorWeightField').hidden = !text;
    document.getElementById('btnIconEditorClear').disabled = !editable || !iconEditorShapes.length;
    document.getElementById('btnIconEditorReset').disabled = !editable;
    document.getElementById('btnIconEditorUndo').disabled = !editable || iconEditorHistoryIndex <= 0;
    document.getElementById('btnIconEditorTemplate').disabled = !editable || !iconEditorTemplate.value;
    document.querySelectorAll('[data-icon-shape]').forEach(button => { button.disabled = !editable; });
    document.querySelectorAll('.icon-editor-color-swatch').forEach(button => { button.disabled = !editable; });
    iconEditorTurn.hidden = disabled || iconEditorDrawingShape || iconEditorDragging;
    if (!shape) return;
    if (!iconEditorTurn.hidden) {
        const spread = Math.min(170, Math.max(45, shape.size / 2 + 23));
        const x = Math.min(400 - spread, Math.max(spread, shape.x));
        iconEditorTurn.style.left = `${x / 4}%`;
        iconEditorTurn.style.top = `${Math.min(374, Math.max(26, shape.y)) / 4}%`;
        iconEditorTurn.style.setProperty('--turn-width', `${spread / 2}%`);
    }
    document.getElementById('iconEditorColor').value = shape.color;
    document.getElementById('iconEditorFill').checked = shape.fill;
    document.getElementById('iconEditorFillColor').value = shape.fillColor || shape.color;
    document.getElementById('iconEditorSize').value = shape.size;
    document.getElementById('iconEditorStroke').value = shape.stroke;
    document.getElementById('iconEditorWeight').value = shape.fontWeight;
}

function pushIconEditorHistory() {
    iconEditorHistory = iconEditorHistory.slice(0, iconEditorHistoryIndex + 1);
    iconEditorHistory.push(cloneIconShapes(iconEditorShapes));
    if (iconEditorHistory.length > 50) iconEditorHistory.shift();
    iconEditorHistoryIndex = iconEditorHistory.length - 1;
}

function saveIconEditorChanges() {
    if (!canChangeIcon()) return;
    const target = iconEditorTarget.value;
    const shapes = sanitizeIconShapes(iconEditorShapes);
    editingToolbarMenu.icons ||= {};
    if (shapes.length) editingToolbarMenu.icons[target] = shapes;
    else delete editingToolbarMenu.icons[target];
    refreshIconEditorTemplates();
    updateIconEditorControls();
    renderToolbarMenuEditor();
}

function addIconEditorShape(kind) {
    const color = document.getElementById('iconEditorColor').value;
    const anchor = iconEditorDrawAnchor || { x: 200, y: 200 };
    iconEditorShapes.push({
        kind, x: anchor.x, y: anchor.y, size: Number(document.getElementById('iconEditorSize').value) || 90,
        rotation: 0, color, fill: !iconEditorOpenShapes.has(kind) && kind !== 'text' && document.getElementById('iconEditorFill').checked,
        fillColor: document.getElementById('iconEditorFillColor').value,
        fontWeight: Number(document.getElementById('iconEditorWeight').value),
        stroke: Number(document.getElementById('iconEditorStroke').value) || 6,
        text: 'A'
    });
    iconEditorSelectedIndex = iconEditorShapes.length - 1;
    redrawIconEditor();
    return iconEditorShapes[iconEditorSelectedIndex];
}

function openIconEditorTextInput(shapeIndex) {
    const shape = iconEditorShapes[shapeIndex];
    if (!shape || shape.kind !== 'text') return;
    document.querySelector('.icon-editor-text-input')?.remove();
    const originalText = shape.text;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 8;
    input.className = 'icon-editor-text-input';
    input.value = shape.text;
    input.setAttribute('aria-label', tr('Текст фигуры'));
    const wrap = document.querySelector('.icon-editor-canvas-wrap');
    input.style.left = `${Math.max(60, Math.min(wrap.clientWidth - 60, shape.x / 400 * iconEditorCanvas.clientWidth))}px`;
    input.style.top = `${Math.max(16, Math.min(iconEditorCanvas.clientHeight - 16, shape.y / 400 * iconEditorCanvas.clientHeight))}px`;
    wrap.append(input);
    input.addEventListener('input', () => {
        shape.text = input.value.slice(0, 8);
        redrawIconEditor();
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') input.blur();
        if (event.key === 'Escape') {
            shape.text = originalText;
            redrawIconEditor();
            input.blur();
        }
    });
    input.addEventListener('blur', () => {
        input.remove();
        pushIconEditorHistory();
        saveIconEditorChanges();
    }, { once: true });
    input.focus();
    input.select();
}

function updateIconEditorDrawPreview(event) {
    if (!iconEditorDrawingShape || iconEditorSelectedIndex < 0 || !iconEditorDrawAnchor) return;
    const rect = iconEditorCanvas.getBoundingClientRect();
    const x = Math.min(400, Math.max(0, (event.clientX - rect.left) * 400 / rect.width));
    const y = Math.min(400, Math.max(0, (event.clientY - rect.top) * 400 / rect.height));
    const shape = iconEditorShapes[iconEditorSelectedIndex];
    const dx = x - iconEditorDrawAnchor.x;
    const dy = y - iconEditorDrawAnchor.y;
    if (shape.kind === 'line' || shape.kind === 'arrow') {
        shape.x = (x + iconEditorDrawAnchor.x) / 2;
        shape.y = (y + iconEditorDrawAnchor.y) / 2;
        shape.size = Math.min(400, Math.max(10, Math.hypot(dx, dy)));
        shape.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
    } else if (shape.kind === 'circle') {
        shape.x = iconEditorDrawAnchor.x;
        shape.y = iconEditorDrawAnchor.y;
        shape.size = Math.min(400, Math.max(10, Math.hypot(dx, dy) * 2));
    } else {
        shape.x = (x + iconEditorDrawAnchor.x) / 2;
        shape.y = (y + iconEditorDrawAnchor.y) / 2;
        shape.size = Math.min(400, Math.max(10, Math.max(Math.abs(dx), Math.abs(dy))));
    }
    iconEditorDragChanged = iconEditorDragChanged || Math.abs(dx) + Math.abs(dy) > 2;
    redrawIconEditor();
}

function selectIconEditorTarget(type) {
    if (!iconEditorDeviceTypes.some(([deviceType]) => deviceType === type)) return;
    iconEditorTarget.value = type;
    iconEditorShapes = sanitizeIconShapes(editingToolbarMenu?.icons?.[type]);
    iconEditorSelectedIndex = -1;
    iconEditorPendingShapeKind = null;
    document.querySelectorAll('[data-icon-shape]').forEach(tool => tool.classList.remove('active'));
    iconEditorCanvas.style.cursor = 'default';
    iconEditorHistory = [];
    iconEditorHistoryIndex = -1;
    pushIconEditorHistory();
    refreshIconEditorTemplates();
    document.getElementById('iconEditorCurrentType').textContent =
        iconEditorDeviceTypes.find(([deviceType]) => deviceType === type)?.[1] || type;
    redrawIconEditor();
    if (typeof renderToolbarMenuPresets === 'function') renderToolbarMenuPresets();
}

function openIconEditor(preferredType) {
    if (!window.hasProAccess?.()) { window.requestProUpgrade?.(); return; }
    const selected = floors[currentFloorIndex]?.devices.find(device => activeDeviceIds.has(device.id));
    const selectedType = selected && iconEditorDeviceTypes.some(([type]) => type === selected.type) ? selected.type : selectedTool;
    const target = preferredType || (iconEditorDeviceTypes.some(([type]) => type === selectedType) ? selectedType : 'pir');
    selectIconEditorTarget(target);
    iconEditorModal.style.display = 'flex';
    if (typeof renderToolbarMenuEditor === 'function') renderToolbarMenuEditor();
}

iconEditorTarget.addEventListener('change', () => selectIconEditorTarget(iconEditorTarget.value));
buildIconEditorColorPalette();

document.querySelectorAll('[data-icon-shape]').forEach(button => {
    button.addEventListener('click', () => {
        iconEditorPendingShapeKind = button.dataset.iconShape;
        document.querySelectorAll('[data-icon-shape]').forEach(tool => {
            tool.classList.toggle('active', tool === button);
        });
        iconEditorCanvas.style.cursor = iconEditorPendingShapeKind === 'text' ? 'text' : 'crosshair';
    });
});

iconEditorCanvas.addEventListener('pointerdown', event => {
    if (!canChangeIcon()) return;
    const rect = iconEditorCanvas.getBoundingClientRect();
    const x = Math.min(400, Math.max(0, (event.clientX - rect.left) * 400 / rect.width));
    const y = Math.min(400, Math.max(0, (event.clientY - rect.top) * 400 / rect.height));
    if (iconEditorPendingShapeKind) {
        if (iconEditorShapes.length >= 100) return;
        document.querySelector('.icon-editor-text-input')?.blur();
        iconEditorDrawAnchor = { x, y };
        addIconEditorShape(iconEditorPendingShapeKind);
        iconEditorPendingShapeKind = null;
        iconEditorDrawingShape = true;
        iconEditorDragChanged = false;
        iconEditorCanvas.setPointerCapture(event.pointerId);
        redrawIconEditor();
        document.querySelectorAll('[data-icon-shape]').forEach(tool => tool.classList.remove('active'));
        event.preventDefault();
        return;
    }
    iconEditorSelectedIndex = -1;
    for (let i = iconEditorShapes.length - 1; i >= 0; i--) {
        const shape = iconEditorShapes[i];
        if (Math.hypot(shape.x - x, shape.y - y) <= Math.max(14, shape.size * 0.65)) {
            iconEditorSelectedIndex = i;
            iconEditorDragOffset = { x: shape.x - x, y: shape.y - y };
            iconEditorDragging = true;
            iconEditorDragChanged = false;
            iconEditorCanvas.setPointerCapture(event.pointerId);
            break;
        }
    }
    redrawIconEditor();
});

iconEditorCanvas.addEventListener('pointermove', event => {
    if (iconEditorDrawingShape) {
        updateIconEditorDrawPreview(event);
        return;
    }
    if (!iconEditorDragging || iconEditorSelectedIndex < 0) return;
    const rect = iconEditorCanvas.getBoundingClientRect();
    const shape = iconEditorShapes[iconEditorSelectedIndex];
    shape.x = Math.min(400, Math.max(0, (event.clientX - rect.left) * 400 / rect.width + iconEditorDragOffset.x));
    shape.y = Math.min(400, Math.max(0, (event.clientY - rect.top) * 400 / rect.height + iconEditorDragOffset.y));
    iconEditorDragChanged = true;
    redrawIconEditor();
});

iconEditorCanvas.addEventListener('pointerup', () => {
    if (iconEditorDrawingShape) {
        iconEditorDrawingShape = false;
        if (iconEditorSelectedIndex >= 0) {
            pushIconEditorHistory();
            saveIconEditorChanges();
            openIconEditorTextInput(iconEditorSelectedIndex);
        }
        iconEditorDrawAnchor = null;
        redrawIconEditor();
        return;
    }
    if (iconEditorDragging && iconEditorDragChanged) {
        pushIconEditorHistory();
        saveIconEditorChanges();
    }
    iconEditorDragging = false;
    redrawIconEditor();
});

iconEditorCanvas.addEventListener('pointercancel', () => {
    if (iconEditorDrawingShape || iconEditorDragChanged) {
        iconEditorShapes = cloneIconShapes(iconEditorHistory[iconEditorHistoryIndex]);
        iconEditorSelectedIndex = -1;
    }
    iconEditorDragging = false;
    iconEditorDrawingShape = false;
    iconEditorDragChanged = false;
    iconEditorDrawAnchor = null;
    redrawIconEditor();
});

document.getElementById('btnIconEditorUndo').addEventListener('click', () => {
    if (!canChangeIcon() || iconEditorHistoryIndex <= 0) return;
    iconEditorHistoryIndex--;
    iconEditorShapes = cloneIconShapes(iconEditorHistory[iconEditorHistoryIndex]);
    iconEditorSelectedIndex = -1;
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorDelete').addEventListener('click', () => {
    if (!canChangeIcon() || iconEditorSelectedIndex < 0) return;
    iconEditorShapes.splice(iconEditorSelectedIndex, 1);
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorClear').addEventListener('click', () => {
    if (!canChangeIcon() || !iconEditorShapes.length) return;
    iconEditorShapes = [];
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorReset').addEventListener('click', () => {
    if (!canChangeIcon()) return;
    iconEditorShapes = [];
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

const iconEditorControlIds = ['iconEditorColor', 'iconEditorFillColor', 'iconEditorFill', 'iconEditorSize', 'iconEditorStroke', 'iconEditorWeight'];
iconEditorControlIds.forEach(id => {
    const control = document.getElementById(id);
    control.addEventListener('input', () => {
        const shape = iconEditorShapes[iconEditorSelectedIndex];
        if (!shape) return;
        if (id === 'iconEditorColor') shape.color = control.value;
        else if (id === 'iconEditorFillColor') { shape.fillColor = control.value; shape.fill = true; }
        else if (id === 'iconEditorFill') shape.fill = control.checked;
        else if (id === 'iconEditorSize') shape.size = Number(control.value);
        else if (id === 'iconEditorStroke') shape.stroke = Number(control.value);
        else if (id === 'iconEditorWeight') shape.fontWeight = Number(control.value);
        redrawIconEditor();
    });
    control.addEventListener('change', () => {
        if (iconEditorSelectedIndex >= 0) {
            pushIconEditorHistory();
            saveIconEditorChanges();
        }
    });
});

iconEditorTurn.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    const shape = iconEditorShapes[iconEditorSelectedIndex];
    if (!shape || !canChangeIcon()) return;
    shape.rotation = ((shape.rotation + Number(button.dataset.iconTurn) + 540) % 360) - 180;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
}));

document.getElementById('btnIconEditorDuplicate').addEventListener('click', () => {
    const shape = iconEditorShapes[iconEditorSelectedIndex];
    if (!canChangeIcon() || !shape || iconEditorShapes.length >= 100) return;
    iconEditorShapes.push({ ...shape, x: shape.x < 385 ? shape.x + 15 : shape.x - 15,
        y: shape.y < 385 ? shape.y + 15 : shape.y - 15 });
    iconEditorSelectedIndex = iconEditorShapes.length - 1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

function refreshIconEditorTemplates() {
    const selected = iconEditorTemplate.value;
    const options = [];
    for (const menu of toolbarMenus) {
        const icons = menu.id === editingToolbarMenu?.id ? editingToolbarMenu.icons : menu.icons;
        for (const [type, label] of iconEditorDeviceTypes) {
            if (!icons?.[type]?.length || (menu.id === editingToolbarMenu?.id && type === iconEditorTarget.value)) continue;
            const value = JSON.stringify([menu.id, type]);
            options.push(new Option(`${menu.name} · ${tr(label)}`, value));
        }
    }
    iconEditorTemplate.replaceChildren(...options);
    if (options.some(option => option.value === selected)) iconEditorTemplate.value = selected;
    window.refreshGoomSelects?.();
}
iconEditorTemplate.addEventListener('change', updateIconEditorControls);
document.getElementById('btnIconEditorTemplate').addEventListener('click', async () => {
    if (!canChangeIcon() || !iconEditorTemplate.value) return;
    const target = iconEditorTarget.value;
    const targetMenu = editingToolbarMenu;
    const [id, type] = JSON.parse(iconEditorTemplate.value);
    const source = id === targetMenu.id ? targetMenu : toolbarMenus.find(menu => menu.id === id);
    const shapes = sanitizeIconShapes(source?.icons?.[type]);
    if (!shapes.length || (iconEditorShapes.length && !await showAppConfirm(tr('Nahradit ikonu šablonou?')))) return;
    if (!canChangeIcon() || targetMenu !== editingToolbarMenu || target !== iconEditorTarget.value) return;
    iconEditorShapes = shapes;
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});
