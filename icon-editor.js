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
const customDeviceIconImages = new Map();
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
    const allowed = new Set(['circle', 'rect', 'roundRect', 'triangle', 'diamond', 'line', 'text']);
    return shapes.slice(0, 100).filter(shape => shape && allowed.has(shape.kind)).map(shape => ({
        kind: shape.kind,
        x: Number.isFinite(shape.x) ? Math.min(400, Math.max(0, shape.x)) : 200,
        y: Number.isFinite(shape.y) ? Math.min(400, Math.max(0, shape.y)) : 200,
        size: Number.isFinite(shape.size) ? Math.min(400, Math.max(10, shape.size)) : 90,
        rotation: Number.isFinite(shape.rotation) ? Math.max(-180, Math.min(180, shape.rotation)) : 0,
        color: /^#[0-9a-f]{6}$/i.test(shape.color) ? shape.color : '#22c55e',
        fill: shape.fill === true,
        stroke: Number.isFinite(shape.stroke) ? Math.min(24, Math.max(1, shape.stroke)) : 6,
        text: typeof shape.text === 'string' ? shape.text.slice(0, 8) : 'A'
    }));
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
        const fill = shape.kind === 'text' ? shape.color : shape.fill ? shape.color : 'none';
        const stroke = shape.kind === 'text' ? 'none' : shape.color;
        const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${shape.stroke}" stroke-linecap="round" stroke-linejoin="round"`;
        let geometry;
        if (shape.kind === 'circle') geometry = `<circle cx="0" cy="0" r="${half}" ${attrs}/>`;
        else if (shape.kind === 'rect') geometry = `<rect x="${-half}" y="${-half}" width="${shape.size}" height="${shape.size}" ${attrs}/>`;
        else if (shape.kind === 'roundRect') geometry = `<rect x="${-half}" y="${-half}" width="${shape.size}" height="${shape.size}" rx="${shape.size * 0.14}" ${attrs}/>`;
        else if (shape.kind === 'triangle') geometry = `<path d="M 0 ${-half} L ${half} ${half} L ${-half} ${half} Z" ${attrs}/>`;
        else if (shape.kind === 'diamond') geometry = `<path d="M 0 ${-half} L ${half} 0 L 0 ${half} L ${-half} 0 Z" ${attrs}/>`;
        else if (shape.kind === 'line') geometry = `<path d="M ${-half} 0 L ${half} 0" ${attrs}/>`;
        else geometry = `<text x="0" y="0" fill="${shape.color}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" font-size="${shape.size * 0.75}">${escapeIconXml(shape.text)}</text>`;
        return `<g transform="translate(${shape.x} ${shape.y}) rotate(${shape.rotation})">${geometry}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${elements}</svg>`;
}

function getCustomDeviceIconDataUrl(type, iconMap = customDeviceIcons) {
    const svg = getCustomDeviceIconSvg(type, iconMap);
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}

function getCustomDeviceIconImage(type) {
    const svg = getCustomDeviceIconSvg(type);
    if (!svg) return null;
    let entry = customDeviceIconImages.get(type);
    if (!entry || entry.svg !== svg) {
        const image = new Image();
        entry = { svg, image };
        customDeviceIconImages.set(type, entry);
        image.onload = requestRedraw;
        image.onerror = () => console.error(`Не удалось загрузить созданный значок устройства: ${type}`);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    return entry.image;
}

function refreshCustomDeviceIcons() {
    if (typeof getActiveToolbarMenu === 'function') {
        const menu = getActiveToolbarMenu();
        if (menu && Object.prototype.hasOwnProperty.call(menu, 'icons')) {
            customDeviceIcons = JSON.parse(JSON.stringify(menu.icons));
        } else if (menu && Object.keys(customDeviceIcons).length) {
            menu.icons = JSON.parse(JSON.stringify(customDeviceIcons));
            if (typeof saveToolbarMenus === 'function') saveToolbarMenus();
        }
    }
    iconEditorDeviceTypes.forEach(([type]) => {
        const button = document.querySelector(`#deviceSelector .device-btn[data-type="${type}"]`);
        if (!button) return;
        const dataUrl = getCustomDeviceIconDataUrl(type);
        button.innerHTML = dataUrl
            ? `<img src="${dataUrl}" alt="" style="width:24px;height:24px;object-fit:contain;">`
            : defaultDeviceButtonContent.get(type) || button.innerHTML;
    });
    customDeviceIconImages.clear();
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
    ctx.fillStyle = shape.color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (shape.kind === 'circle') ctx.arc(0, 0, half, 0, Math.PI * 2);
    else if (shape.kind === 'rect') ctx.rect(-half, -half, shape.size, shape.size);
    else if (shape.kind === 'roundRect') ctx.roundRect(-half, -half, shape.size, shape.size, shape.size * 0.14);
    else if (shape.kind === 'triangle') {
        ctx.moveTo(0, -half); ctx.lineTo(half, half); ctx.lineTo(-half, half); ctx.closePath();
    } else if (shape.kind === 'diamond') {
        ctx.moveTo(0, -half); ctx.lineTo(half, 0); ctx.lineTo(0, half); ctx.lineTo(-half, 0); ctx.closePath();
    } else if (shape.kind === 'line') {
        ctx.moveTo(-half, 0); ctx.lineTo(half, 0);
    } else if (shape.kind === 'text') {
        ctx.font = `700 ${Math.max(10, shape.size * 0.75)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(shape.text, 0, 0, shape.size * 1.5);
        ctx.restore();
        return;
    }
    if (shape.kind !== 'line' && shape.fill) ctx.fill();
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
    const disabled = !shape;
    ['iconEditorColor', 'iconEditorFill', 'iconEditorSize', 'iconEditorStroke', 'iconEditorRotation', 'btnIconEditorDelete']
        .forEach(id => { document.getElementById(id).disabled = disabled; });
    if (!shape) return;
    document.getElementById('iconEditorColor').value = shape.color;
    document.getElementById('iconEditorFill').checked = shape.fill;
    document.getElementById('iconEditorSize').value = shape.size;
    document.getElementById('iconEditorStroke').value = shape.stroke;
    document.getElementById('iconEditorRotation').value = shape.rotation;
}

function pushIconEditorHistory() {
    iconEditorHistory = iconEditorHistory.slice(0, iconEditorHistoryIndex + 1);
    iconEditorHistory.push(cloneIconShapes(iconEditorShapes));
    if (iconEditorHistory.length > 50) iconEditorHistory.shift();
    iconEditorHistoryIndex = iconEditorHistory.length - 1;
}

function saveIconEditorChanges() {
    const target = iconEditorTarget.value;
    const shapes = sanitizeIconShapes(iconEditorShapes);
    if (shapes.length) customDeviceIcons[target] = shapes;
    else delete customDeviceIcons[target];
    if (typeof saveCustomIconsToActiveMenu === 'function') saveCustomIconsToActiveMenu();
    refreshCustomDeviceIcons();
    saveStateToHistory();
    triggerAutoSave();
}

function addIconEditorShape(kind) {
    const color = document.getElementById('iconEditorColor').value;
    const anchor = iconEditorDrawAnchor || { x: 200, y: 200 };
    iconEditorShapes.push({
        kind, x: anchor.x, y: anchor.y, size: Number(document.getElementById('iconEditorSize').value) || 90,
        rotation: 0, color, fill: document.getElementById('iconEditorFill').checked,
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
    if (shape.kind === 'line') {
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
    iconEditorShapes = sanitizeIconShapes(customDeviceIcons[type]);
    iconEditorSelectedIndex = -1;
    iconEditorHistory = [];
    iconEditorHistoryIndex = -1;
    pushIconEditorHistory();
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

document.getElementById('btnIconEditorClose').addEventListener('click', () => { iconEditorModal.style.display = 'none'; });
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
    const rect = iconEditorCanvas.getBoundingClientRect();
    const x = Math.min(400, Math.max(0, (event.clientX - rect.left) * 400 / rect.width));
    const y = Math.min(400, Math.max(0, (event.clientY - rect.top) * 400 / rect.height));
    if (iconEditorPendingShapeKind) {
        document.querySelector('.icon-editor-text-input')?.blur();
        iconEditorDrawAnchor = { x, y };
        addIconEditorShape(iconEditorPendingShapeKind);
        iconEditorPendingShapeKind = null;
        iconEditorDrawingShape = true;
        iconEditorDragChanged = false;
        iconEditorCanvas.setPointerCapture(event.pointerId);
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
        return;
    }
    if (iconEditorDragging && iconEditorDragChanged) {
        pushIconEditorHistory();
        saveIconEditorChanges();
    }
    iconEditorDragging = false;
});

document.getElementById('btnIconEditorUndo').addEventListener('click', () => {
    if (iconEditorHistoryIndex <= 0) return;
    iconEditorHistoryIndex--;
    iconEditorShapes = cloneIconShapes(iconEditorHistory[iconEditorHistoryIndex]);
    iconEditorSelectedIndex = -1;
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorDelete').addEventListener('click', () => {
    if (iconEditorSelectedIndex < 0) return;
    iconEditorShapes.splice(iconEditorSelectedIndex, 1);
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorClear').addEventListener('click', () => {
    if (!iconEditorShapes.length) return;
    iconEditorShapes = [];
    iconEditorSelectedIndex = -1;
    pushIconEditorHistory();
    redrawIconEditor();
    saveIconEditorChanges();
});

document.getElementById('btnIconEditorReset').addEventListener('click', () => {
    delete customDeviceIcons[iconEditorTarget.value];
    customDeviceIconImages.delete(iconEditorTarget.value);
    if (typeof saveCustomIconsToActiveMenu === 'function') saveCustomIconsToActiveMenu();
    refreshCustomDeviceIcons();
    selectIconEditorTarget(iconEditorTarget.value);
    saveStateToHistory();
    triggerAutoSave();
});

const iconEditorControlIds = ['iconEditorColor', 'iconEditorFill', 'iconEditorSize', 'iconEditorStroke', 'iconEditorRotation'];
iconEditorControlIds.forEach(id => {
    const control = document.getElementById(id);
    control.addEventListener('input', () => {
        const shape = iconEditorShapes[iconEditorSelectedIndex];
        if (!shape) return;
        if (id === 'iconEditorColor') shape.color = control.value;
        else if (id === 'iconEditorFill') shape.fill = control.checked;
        else if (id === 'iconEditorSize') shape.size = Number(control.value);
        else if (id === 'iconEditorStroke') shape.stroke = Number(control.value);
        else if (id === 'iconEditorRotation') shape.rotation = Number(control.value);
        redrawIconEditor();
    });
    control.addEventListener('change', () => {
        if (iconEditorSelectedIndex >= 0) {
            pushIconEditorHistory();
            saveIconEditorChanges();
        }
    });
});
