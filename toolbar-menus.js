const toolbarMenuStorageKey = 'goom-toolbar-menus-v1';
const toolbarMenuLimit = 7;
const toolbarMenuDeviceButtons = [...document.querySelectorAll('#deviceSelector .device-btn[data-type]:not([data-type="plainText"])')];
const toolbarMenuTypeLabels = {
    panel: tr('Центральный блок'),
    expander: tr('Расширитель'),
    abax: tr('Беспроводной модуль'),
    keypad: tr('Клавиатура'),
    pir: tr('PIR-датчик'),
    pir_wl: tr('Беспроводной PIR'),
    magnet: tr('Магнитный контакт'),
    magnet_wl: tr('Беспроводной контакт'),
    glassbreak: tr('Датчик разбития стекла'),
    panic: tr('Тревожная кнопка'),
    siren: tr('Сирена'),
    textNode: tr('Текстовая заметка')
};
const toolbarMenuTypes = toolbarMenuDeviceButtons.map(button => ({
    type: button.dataset.type,
    title: toolbarMenuTypeLabels[button.dataset.type] || button.title || button.dataset.type
}));
const validToolbarMenuTypes = new Set(toolbarMenuTypes.map(item => item.type));
const defaultToolbarMenu = {
    id: 'default',
    name: 'Default',
    deviceTypes: toolbarMenuTypes.map(item => item.type)
};
const proToolbarLabels = {
    panel: 'EZS', expander: 'EXP', abax: 'RF', keypad: 'KEY', pir: 'PIR', pir_wl: 'PIR+',
    magnet: 'MC', magnet_wl: 'MC+', glassbreak: 'GB', panic: 'SOS', siren: 'SIR'
};
const proToolbarMenu = {
    id: 'pro',
    name: 'PROJECT',
    deviceTypes: defaultToolbarMenu.deviceTypes,
    icons: Object.fromEntries(Object.entries(proToolbarLabels).map(([type, label]) => {
        const shape = { x: 200, y: 200, rotation: 0, color: COLORS[type], stroke: 17 };
        return [type, sanitizeIconShapes([
            { ...shape, kind: 'roundRect', size: 302, fill: true, fillColor: '#ffffff' },
            { ...shape, kind: 'text', size: label.length > 3 ? 103 : 124, text: label, fontWeight: 800 }
        ])];
    }))
};
const builtInToolbarMenus = [defaultToolbarMenu, proToolbarMenu];
const isBuiltInToolbarMenu = menu => builtInToolbarMenus.some(preset => preset.id === menu.id);
const canEditToolbarMenus = () => Boolean(window.hasProAccess?.() || window.hasAdminAccess?.());
const canEditToolbarPreset = menu => Boolean(menu && canEditToolbarMenus()
    && (!isBuiltInToolbarMenu(menu) || window.hasAdminAccess?.()));

let toolbarMenus = [...builtInToolbarMenus];
let activeToolbarMenuId = defaultToolbarMenu.id;
let editingToolbarMenu = null;
let editingToolbarMenuIsNew = false;
let toolbarMenuPreviousActiveId = null;
let toolbarMenuEditorOriginal = '';

function sanitizeToolbarMenu(menu, id, fallbackName) {
    const deviceTypes = Array.isArray(menu.deviceTypes)
        ? [...new Set(menu.deviceTypes.filter(type => validToolbarMenuTypes.has(type)))] : [];
    const name = typeof menu.name === 'string' ? menu.name.trim().slice(0, 32) : '';
    const cleaned = { id, name: name || fallbackName, deviceTypes };
    if (menu.icons && typeof menu.icons === 'object' && !Array.isArray(menu.icons)) {
        cleaned.icons = Object.fromEntries(
            Object.entries(menu.icons)
                .filter(([type]) => iconEditorDeviceTypes.some(([iconType]) => iconType === type))
                .map(([type, shapes]) => [type, sanitizeIconShapes(shapes)])
        );
    }
    return cleaned;
}

function sanitizeToolbarMenus(value, overrides) {
    if (!Array.isArray(value)) return [...builtInToolbarMenus];
    const seenIds = new Set(builtInToolbarMenus.map(menu => menu.id));
    const legacyDefaultNames = ['Default', 'Основное меню', 'Hlavní nabídka', 'Main menu'];
    const menus = value.filter(menu => menu && typeof menu === 'object' && menu.id !== 'pro')
        .filter(menu => menu.id !== 'default' || Object.keys(menu.icons || {}).length
            || menu.deviceTypes?.length !== defaultToolbarMenu.deviceTypes.length || !legacyDefaultNames.includes(menu.name))
        .slice(0, toolbarMenuLimit).map((menu, index) => {
        let id = typeof menu.id === 'string' && menu.id.trim() ? menu.id.trim().slice(0, 80) : `menu-${index + 1}`;
        while (seenIds.has(id)) id += '-copy';
        seenIds.add(id);
        return sanitizeToolbarMenu(menu, id, tr`Меню ${index + 1}`);
    });
    const presets = builtInToolbarMenus.map(preset => {
        const override = overrides?.[preset.id];
        if (!override || typeof override !== 'object') return preset;
        const cleaned = sanitizeToolbarMenu(override, preset.id, preset.name);
        if (preset.id === proToolbarMenu.id && cleaned.name === 'PRO') cleaned.name = preset.name;
        return cleaned.deviceTypes.length ? cleaned : preset;
    });
    return [...presets, ...menus];
}

function loadToolbarMenus() {
    try {
        const stored = localStorage.getItem(toolbarMenuStorageKey);
        if (!stored) return;
        const data = JSON.parse(stored);
        toolbarMenus = sanitizeToolbarMenus(data.menus, data.version === 3 ? data.presets : null);
        const savedId = !(data.version >= 2) && data.activeMenuId === 'default'
            ? toolbarMenus.find(menu => menu.id === 'default-copy')?.id || 'default' : data.activeMenuId;
        activeToolbarMenuId = toolbarMenus.some(menu => menu.id === savedId) ? savedId : defaultToolbarMenu.id;
    } catch (error) {
        console.error('Не удалось загрузить сохранённые наборы меню:', error);
        toolbarMenus = [...builtInToolbarMenus];
        activeToolbarMenuId = defaultToolbarMenu.id;
    }
}

function saveToolbarMenus() {
    try {
        localStorage.setItem(toolbarMenuStorageKey, JSON.stringify({
            version: 3,
            activeMenuId: activeToolbarMenuId,
            menus: toolbarMenus.filter(menu => !isBuiltInToolbarMenu(menu)),
            presets: Object.fromEntries(toolbarMenus.filter(isBuiltInToolbarMenu).map(menu => [menu.id, menu]))
        }));
        return true;
    } catch (error) {
        console.error('Не удалось сохранить наборы меню:', error);
        showAppAlert(tr('Не удалось сохранить наборы меню в этом браузере.'), tr('Ошибка сохранения'));
        return false;
    }
}

function getActiveToolbarMenu() {
    return toolbarMenus.find(menu => menu.id === activeToolbarMenuId) || toolbarMenus[0];
}

function applyToolbarMenu(menu, persist = true) {
    if (!menu) return;
    const cycleButton = document.getElementById('btnCycleToolbarMenu');
    const menuChanged = cycleButton.dataset.menuId !== menu.id;
    activeToolbarMenuId = menu.id;
    if (menuChanged || !isSystemReady) applyToolbarMenuIcons(menu);
    const visibleTypes = new Set(menu.deviceTypes);
    toolbarMenuDeviceButtons.forEach(button => {
        button.hidden = !visibleTypes.has(button.dataset.type);
    });
    const textTools = document.getElementById('textTools');
    textTools.hidden = !visibleTypes.has('textNode');

    const selectorChildren = [...document.getElementById('deviceSetTools').children];
    const isVisibleTool = child => !child.hidden && (child === textTools || child.matches('.device-btn[data-type]'));
    selectorChildren.forEach((element, index) => {
        if (!element.classList.contains('menu-divider')) return;
        const beforeHasDevice = selectorChildren.slice(0, index).some(isVisibleTool);
        const afterHasDevice = selectorChildren.slice(index + 1).some(isVisibleTool);
        element.hidden = !beforeHasDevice || !afterHasDevice;
    });

    if (!visibleTypes.has(selectedTool === 'plainText' ? 'textNode' : selectedTool)) {
        selectedTool = 'select';
        document.querySelectorAll('#deviceSelector .device-btn').forEach(button => button.classList.remove('active'));
    }
    cycleButton.dataset.menuId = menu.id;
    cycleButton.title = canEditToolbarMenus() ? tr`Текущий набор: ${menu.name}. Нажмите, чтобы переключить` : menu.name;
    cycleButton.setAttribute('aria-label', tr`Текущий набор меню: ${menu.name}. Переключить набор`);
    document.getElementById('activeToolbarMenuName').textContent = menu.name;
    cycleButton.disabled = !canEditToolbarMenus();

    if (persist) saveToolbarMenus();
    if (typeof requestRedraw === 'function') requestRedraw();
}

function applyToolbarMenuIcons(menu = getActiveToolbarMenu()) {
    customDeviceIcons = cloneIconShapes(menu?.icons || {});
    refreshCustomDeviceIcons();
}

function toolbarMenuButtonContent(type, menu) {
    const iconDataUrl = menu.icons && Object.prototype.hasOwnProperty.call(menu.icons, type)
        ? getCustomDeviceIconDataUrl(type, menu.icons)
        : null;
    if (iconDataUrl) return `<img src="${iconDataUrl}" alt="" style="width:22px;height:22px;object-fit:contain;">`;
    return defaultDeviceButtonContent.get(type) || '';
}

function renderToolbarMenuPresets() {
    const container = document.getElementById('toolbarMenuPresets');
    const addMenuButton = document.getElementById('btnToolbarMenuNew');
    const toolbarMenuActions = document.querySelector('.toolbar-menu-editor-actions');
    container.replaceChildren();
    toolbarMenus.forEach(menu => {
        const card = document.createElement('div');
        card.className = `toolbar-menu-preset${activeToolbarMenuId === menu.id ? ' selected' : ''}`;
        card.dataset.menuId = menu.id;
        const indicator = document.createElement('span');
        indicator.className = `toolbar-menu-active-indicator${activeToolbarMenuId === menu.id ? ' active' : ''}`;
        indicator.title = activeToolbarMenuId === menu.id ? tr('Выбранное меню') : '';
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 32;
        name.className = 'toolbar-menu-preset-name';
        name.value = menu.name;
        name.readOnly = !canEditToolbarPreset(menu);
        name.setAttribute('aria-label', tr`Название меню: ${menu.name}`);
        name.addEventListener('focus', async () => { await selectToolbarMenuForEditing(menu.id, true); });
        name.addEventListener('input', () => {
            if (editingToolbarMenu?.id !== menu.id || !canEditToolbarPreset(editingToolbarMenu)) return;
            editingToolbarMenu.name = name.value.slice(0, 32);
            updateToolbarMenuEditorStatus();
        });
        const preview = editingToolbarMenu?.id === menu.id ? editingToolbarMenu : menu;
        const icons = document.createElement('span');
        icons.className = 'toolbar-menu-preset-icons';
        menu.deviceTypes.forEach(type => {
            const iconButton = document.createElement('button');
            iconButton.type = 'button';
            iconButton.dataset.type = type;
            const typeInfo = toolbarMenuTypes.find(item => item.type === type);
            iconButton.title = tr`Выбрать значок: ${typeInfo?.title || type}`;
            iconButton.setAttribute('aria-label', iconButton.title);
            iconButton.classList.toggle('selected', activeToolbarMenuId === menu.id && iconEditorTarget.value === type);
            iconButton.innerHTML = toolbarMenuButtonContent(type, preview);
            iconButton.addEventListener('click', async event => {
                event.stopPropagation();
                document.querySelector('.icon-editor-text-input')?.blur();
                if (editingToolbarMenu?.id !== menu.id && !await selectToolbarMenuForEditing(menu.id)) return;
                if (iconEditorDeviceTypes.some(([iconType]) => iconType === type)) {
                    selectIconEditorTarget(type);
                }
            });
            icons.append(iconButton);
        });
        const removeMenu = document.createElement('button');
        removeMenu.type = 'button';
        removeMenu.className = 'toolbar-menu-remove';
        removeMenu.textContent = '×';
        removeMenu.title = tr`Удалить меню «${menu.name}»`;
        removeMenu.setAttribute('aria-label', removeMenu.title);
        removeMenu.disabled = isBuiltInToolbarMenu(menu);
        removeMenu.addEventListener('click', () => deleteToolbarMenu(menu.id));
        card.append(indicator, name, icons, removeMenu);
        container.append(card);
    });
    addMenuButton.disabled = toolbarMenus.length - builtInToolbarMenus.length >= toolbarMenuLimit;
    addMenuButton.title = addMenuButton.disabled ? tr('Можно создать не более 7 меню') : tr('Добавить меню');
    toolbarMenuActions.prepend(addMenuButton);
    updateToolbarMenuRowHighlights();
}

function updateToolbarMenuRowHighlights() {
    document.querySelectorAll('.toolbar-menu-preset').forEach(row => {
        row.classList.toggle('selected', row.dataset.menuId === activeToolbarMenuId);
        row.querySelectorAll('.toolbar-menu-preset-icons button').forEach(button => {
            button.classList.toggle('selected',
                row.dataset.menuId === activeToolbarMenuId && button.dataset.type === iconEditorTarget.value);
        });
    });
    document.querySelectorAll('.toolbar-menu-preset').forEach(row => {
        row.querySelector('.toolbar-menu-active-indicator')?.classList.toggle(
            'active', row.dataset.menuId === activeToolbarMenuId
        );
    });
}

function updateToolbarMenuEditorStatus() {
    const saveButton = document.getElementById('btnToolbarMenuSave');
    if (!editingToolbarMenu) return;
    if (!canEditToolbarPreset(editingToolbarMenu)) {
        saveButton.disabled = true;
        saveButton.textContent = tr('Сохранено');
        document.getElementById('toolbarMenuEditorStatus').textContent = tr('Vytvořte kopii sady pro úpravy.');
        return;
    }
    const changed = editingToolbarMenuIsNew
        || JSON.stringify(editingToolbarMenu) !== toolbarMenuEditorOriginal;
    document.getElementById('toolbarMenuEditorStatus').textContent = changed
        ? tr('Есть несохранённые изменения')
        : (activeToolbarMenuId === editingToolbarMenu.id ? tr('Этот набор используется на панели') : tr('Выберите набор, измените его и сохраните'));
    saveButton.disabled = !changed;
    saveButton.textContent = changed ? tr('Сохранить меню') : tr('Сохранено');
    saveButton.style.opacity = changed ? '1' : '.48';
}

function renderToolbarMenuEditor() {
    renderToolbarMenuPresets();
    updateToolbarMenuEditorStatus();
}

function editorHasUnsavedChanges() {
    return editingToolbarMenuIsNew || JSON.stringify(editingToolbarMenu) !== toolbarMenuEditorOriginal;
}

function discardUnsavedNewMenu() {
    if (!editingToolbarMenuIsNew || !editingToolbarMenu) return;
    toolbarMenus = toolbarMenus.filter(menu => menu.id !== editingToolbarMenu.id);
    const previousMenu = toolbarMenus.find(menu => menu.id === toolbarMenuPreviousActiveId) || toolbarMenus[0];
    editingToolbarMenuIsNew = false;
    toolbarMenuPreviousActiveId = null;
    applyToolbarMenu(previousMenu, false);
}

async function selectToolbarMenuForEditing(id, focusName = false) {
    if (editingToolbarMenu?.id === id) return true;
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Отбросить несохранённые изменения?'))) return false;
    discardUnsavedNewMenu();
    const menu = toolbarMenus.find(item => item.id === id);
    if (!menu) return false;
    document.querySelector('.icon-editor-text-input')?.blur();
    editingToolbarMenu = JSON.parse(JSON.stringify(menu));
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    applyToolbarMenu(menu);
    const firstEditableType = menu.deviceTypes.find(type =>
        iconEditorDeviceTypes.some(([iconType]) => iconType === type));
    selectIconEditorTarget(firstEditableType || iconEditorTarget.value);
    renderToolbarMenuEditor();
    if (focusName) document.querySelector(`.toolbar-menu-preset[data-menu-id="${CSS.escape(id)}"] .toolbar-menu-preset-name`)?.focus();
    return true;
}

function openToolbarMenuEditor() {
    if (!canEditToolbarMenus()) { window.requestProUpgrade?.(); return; }
    editingToolbarMenu = JSON.parse(JSON.stringify(getActiveToolbarMenu()));
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    const firstEditableType = editingToolbarMenu.deviceTypes.find(type =>
        iconEditorDeviceTypes.some(([iconType]) => iconType === type));
    if (typeof openIconEditor === 'function') openIconEditor(firstEditableType);
    renderToolbarMenuEditor();
}

document.getElementById('btnOpenToolbarMenuEditor').addEventListener('click', openToolbarMenuEditor);
document.getElementById('iconEditorModal').addEventListener('click', event => {
    if (event.target === event.currentTarget) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}, true);
document.getElementById('btnIconEditorClose').addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Закрыть редактор меню без сохранения изменений?'))) return;
    discardUnsavedNewMenu();
    saveToolbarMenus();
    document.getElementById('iconEditorModal').style.display = 'none';
}, true);
document.getElementById('btnToolbarMenuNew').addEventListener('click', async () => {
    if (!canEditToolbarMenus()) return;
    if (toolbarMenus.length - builtInToolbarMenus.length >= toolbarMenuLimit) {
        showAppAlert(tr('Достигнут лимит в 7 меню.'), tr('Лимит меню'));
        return;
    }
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Сохранить текущие изменения перед созданием меню?'))) return;
    if (editorHasUnsavedChanges()) {
        document.getElementById('btnToolbarMenuSave').click();
        if (editorHasUnsavedChanges()) return;
    }
    const source = getActiveToolbarMenu();
    toolbarMenuPreviousActiveId = activeToolbarMenuId;
    editingToolbarMenu = {
        id: `menu-${Date.now()}`,
        name: tr`Меню ${toolbarMenus.length - builtInToolbarMenus.length + 1}`,
        deviceTypes: [...source.deviceTypes],
        icons: JSON.parse(JSON.stringify(source.icons || {}))
    };
    editingToolbarMenuIsNew = true;
    toolbarMenuEditorOriginal = '';
    toolbarMenus.push(JSON.parse(JSON.stringify(editingToolbarMenu)));
    applyToolbarMenu(editingToolbarMenu, false);
    const firstEditableType = editingToolbarMenu.deviceTypes.find(type =>
        iconEditorDeviceTypes.some(([iconType]) => iconType === type));
    selectIconEditorTarget(firstEditableType || iconEditorTarget.value);
    renderToolbarMenuEditor();
    document.querySelector(`.toolbar-menu-preset[data-menu-id="${editingToolbarMenu.id}"] .toolbar-menu-preset-name`)?.focus();
});
async function deleteToolbarMenu(id) {
    const menu = toolbarMenus.find(item => item.id === id);
    if (!menu || isBuiltInToolbarMenu(menu) || !canEditToolbarMenus() || !await showAppConfirm(tr`Удалить меню «${menu.name}»?`)) return;
    toolbarMenus = toolbarMenus.filter(item => item.id !== id);
    const activeMenuWasDeleted = activeToolbarMenuId === id;
    if (activeMenuWasDeleted) activeToolbarMenuId = id;
    if (editingToolbarMenu?.id === id) editingToolbarMenu = JSON.parse(JSON.stringify(getActiveToolbarMenu()));
    applyToolbarMenu(activeMenuWasDeleted ? toolbarMenus[0] : getActiveToolbarMenu(), false);
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    selectIconEditorTarget(iconEditorTarget.value);
    saveToolbarMenus();
    renderToolbarMenuEditor();
}
document.getElementById('btnToolbarMenuSave').addEventListener('click', () => {
    if (!canEditToolbarPreset(editingToolbarMenu)) return;
    const name = editingToolbarMenu.name.trim();
    if (!name) {
        showAppAlert(tr('Укажите название набора меню.'), tr('Название меню'));
        document.querySelector(`.toolbar-menu-preset[data-menu-id="${CSS.escape(editingToolbarMenu.id)}"] .toolbar-menu-preset-name`)?.focus();
        return;
    }
    if (!editingToolbarMenu.deviceTypes.length) {
        showAppAlert(tr('Выберите хотя бы один датчик или инструмент для набора меню.'), tr('Пустое меню'));
        return;
    }
    editingToolbarMenu.name = name.slice(0, 32);
    editingToolbarMenu.deviceTypes = toolbarMenuTypes
        .map(item => item.type)
        .filter(type => editingToolbarMenu.deviceTypes.includes(type));
    const index = toolbarMenus.findIndex(menu => menu.id === editingToolbarMenu.id);
    if (index < 0) toolbarMenus.push(JSON.parse(JSON.stringify(editingToolbarMenu)));
    else toolbarMenus[index] = JSON.parse(JSON.stringify(editingToolbarMenu));
    editingToolbarMenuIsNew = false;
    toolbarMenuPreviousActiveId = null;
    if (!saveToolbarMenus()) return;
    applyToolbarMenu(editingToolbarMenu, false);
    applyToolbarMenuIcons(editingToolbarMenu);
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    renderToolbarMenuEditor();
    if (isSystemReady) {
        saveStateToHistory();
        triggerAutoSave();
    }
});
let isToolbarMenuCycling = false;
document.getElementById('btnCycleToolbarMenu').addEventListener('click', async () => {
    if (isToolbarMenuCycling || !canEditToolbarMenus()) return;
    const tools = document.getElementById('deviceSetTools');
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    isToolbarMenuCycling = true;
    window.clearGoomTooltips?.();
    try {
        if (animate) await tools.animate([{ opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-12px)' }], { duration: 120, easing: 'ease-in' }).finished;
        if (!canEditToolbarMenus()) return;
        const activeIndex = toolbarMenus.findIndex(menu => menu.id === activeToolbarMenuId);
        applyToolbarMenu(toolbarMenus[(activeIndex + 1) % toolbarMenus.length]);
        tools.scrollLeft = 0;
        if (isSystemReady) triggerAutoSave();
        if (animate) await tools.animate([{ opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' }], { duration: 190, easing: 'cubic-bezier(.22,.61,.36,1)' }).finished;
    } finally {
        isToolbarMenuCycling = false;
    }
});

loadToolbarMenus();
applyToolbarMenu(canEditToolbarMenus() ? getActiveToolbarMenu() : toolbarMenus[0], false);
let lastToolbarAccess = canEditToolbarMenus();
let lastToolbarAdmin = Boolean(window.hasAdminAccess?.());
document.addEventListener('goom-account-changed', () => {
    const allowed = canEditToolbarMenus();
    const admin = Boolean(window.hasAdminAccess?.());
    if (allowed === lastToolbarAccess && admin === lastToolbarAdmin) return;
    const wasAllowed = lastToolbarAccess;
    lastToolbarAccess = allowed;
    lastToolbarAdmin = admin;
    if (!allowed || (wasAllowed && !admin)) {
        discardUnsavedNewMenu();
        iconEditorModal.style.display = 'none';
    }
    if (allowed && !wasAllowed) {
        loadToolbarMenus();
        applyToolbarMenu(getActiveToolbarMenu(), false);
    } else if (!allowed) {
        applyToolbarMenu(toolbarMenus[0], false);
    } else if (iconEditorModal.style.display === 'flex') {
        redrawIconEditor();
        renderToolbarMenuEditor();
    }
});
