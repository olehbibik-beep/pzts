const toolbarMenuStorageKey = productStorageKey('goom-toolbar-menus-v1');
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
    textNode: tr('Текстовая заметка'),
    ...Object.fromEntries(Object.entries(ADDITIONAL_DEVICE_LABELS).map(([type, label]) => [type, tr(label)]))
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
const proToolbarLabels = APP_PRODUCT === 'CCTV' ? {
    cctv_bullet: 'CAM', cctv_dome: 'DOME', cctv_ptz: 'PTZ', cctv_nvr: 'NVR', cctv_poe: 'PoE'
} : {
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
const isPremiumToolbarId = id => typeof id === 'string' && id.startsWith('shared-');
const isPersonalToolbarMenu = menu => !isBuiltInToolbarMenu(menu) && !isPremiumToolbarId(menu.id);
const personalToolbarMenuCount = () => toolbarMenus.filter(isPersonalToolbarMenu).length;
const canEditToolbarMenus = () => Boolean(window.hasProAccess?.() || window.hasAdminAccess?.());
const canEditToolbarPreset = menu => Boolean(menu && canEditToolbarMenus()
    && (isPersonalToolbarMenu(menu) || window.hasAdminAccess?.()));

let toolbarMenus = [...builtInToolbarMenus];
let activeToolbarMenuId = defaultToolbarMenu.id;
let editingToolbarMenu = null;
let editingToolbarMenuIsNew = false;
let toolbarMenuPreviousActiveId = null;
let toolbarMenuEditorOriginal = '';
let sharedToolbarMenus = {};
let toolbarAccountUid = null;
let displayedToolbarMenu = null;
let toolbarSyncGeneration = 0;
let toolbarSubscriptions = [];
let toolbarSavePending = false;
let toolbarShareRequested = false;
let preferredSharedToolbarMenuId = null;

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

function addNewToolbarDeviceTypes(menu) {
    if (!menu.deviceTypes.length || NEW_TOOLBAR_DEVICE_TYPES.every(type => menu.deviceTypes.includes(type))) return menu;
    const types = new Set([...menu.deviceTypes, ...NEW_TOOLBAR_DEVICE_TYPES]);
    return { ...menu, deviceTypes: toolbarMenuTypes.filter(({ type }) => types.has(type)).map(({ type }) => type) };
}

function sanitizeToolbarMenus(value) {
    if (!Array.isArray(value)) return [];
    const seenIds = new Set(builtInToolbarMenus.map(menu => menu.id));
    const legacyDefaultNames = ['Default', 'Основное меню', 'Hlavní nabídka', 'Main menu'];
    const bundledTypeCount = defaultToolbarMenu.deviceTypes.length;
    return value.filter(menu => menu && typeof menu === 'object' && menu.id !== 'pro')
        .filter(menu => menu.id !== 'default' || Object.keys(menu.icons || {}).length
            || ![bundledTypeCount, bundledTypeCount - NEW_TOOLBAR_DEVICE_TYPES.length].includes(menu.deviceTypes?.length)
            || !legacyDefaultNames.includes(menu.name))
        .slice(0, toolbarMenuLimit).map((menu, index) => {
        let id = typeof menu.id === 'string' && menu.id.trim() ? menu.id.trim().slice(0, 80) : `menu-${index + 1}`;
        if (isPremiumToolbarId(id)) id = `menu-${index + 1}`;
        while (seenIds.has(id)) id += '-copy';
        seenIds.add(id);
        return addNewToolbarDeviceTypes(sanitizeToolbarMenu(menu, id, tr`Меню ${index + 1}`));
    });
}

function loadToolbarMenus() {
    const allowed = canEditToolbarMenus();
    const presets = allowed ? builtInToolbarMenus : [defaultToolbarMenu];
    const premiumMenus = allowed ? toolbarMenus.filter(menu => isPremiumToolbarId(menu.id)) : [];
    toolbarMenus = presets.map(preset => sharedToolbarMenus[preset.id] || preset);
    toolbarMenus.push(...premiumMenus);
    activeToolbarMenuId = defaultToolbarMenu.id;
    preferredSharedToolbarMenuId = null;
    if (!toolbarAccountUid || !allowed) return;
    try {
        const stored = localStorage.getItem(`${toolbarMenuStorageKey}:${toolbarAccountUid}`);
        if (!stored) return;
        const data = JSON.parse(stored);
        toolbarMenus.push(...sanitizeToolbarMenus(data.menus));
        if (toolbarMenus.some(menu => menu.id === data.activeMenuId)) activeToolbarMenuId = data.activeMenuId;
        else if (isPremiumToolbarId(data.activeMenuId)) preferredSharedToolbarMenuId = data.activeMenuId;
    } catch (error) {
        console.error('Не удалось загрузить сохранённые наборы меню:', error);
    }
}

function saveToolbarMenus() {
    if (!toolbarAccountUid || !canEditToolbarMenus()) return true;
    try {
        localStorage.setItem(`${toolbarMenuStorageKey}:${toolbarAccountUid}`, JSON.stringify({
            activeMenuId: preferredSharedToolbarMenuId || activeToolbarMenuId,
            menus: toolbarMenus.filter(isPersonalToolbarMenu)
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

function sharedToolbarRef(db, preset) {
    const product = db.collection('goomToolbarPresets').doc(APP_PRODUCT);
    return product.collection(isPremiumToolbarId(preset.id) ? 'premiumSets' : 'sets').doc(preset.id);
}

function sharedToolbarData(menu) {
    return { name: menu.name, deviceTypes: menu.deviceTypes, iconsJson: JSON.stringify(menu.icons || {}) };
}

function readSharedToolbarMenu(id, data, fallbackName) {
    if (!data) return null;
    try {
        const menu = sanitizeToolbarMenu({ ...data, icons: JSON.parse(data.iconsJson) }, id, fallbackName);
        return menu.deviceTypes.length ? addNewToolbarDeviceTypes(menu) : null;
    } catch { return null; }
}

function updateSharedToolbarMenu(preset, data) {
    const menu = readSharedToolbarMenu(preset.id, data, preset.name) || preset;
    const index = toolbarMenus.findIndex(item => item.id === preset.id);
    if (JSON.stringify(toolbarMenus[index]) === JSON.stringify(menu)) return;
    sharedToolbarMenus[preset.id] = menu;
    toolbarMenus[index] = menu;
    if (activeToolbarMenuId === menu.id) {
        applyToolbarMenu(menu, false);
        if (isSystemReady) updateProjectLegendsFromMenu(menu);
    }
    if (iconEditorModal.style.display === 'flex') renderToolbarMenuEditor();
}

function updatePremiumToolbarMenus(menus) {
    menus.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const previousPremiumMenus = toolbarMenus.filter(menu => isPremiumToolbarId(menu.id));
    if (JSON.stringify(previousPremiumMenus) === JSON.stringify(menus)) return;
    const previous = getActiveToolbarMenu();
    toolbarMenus = [
        ...toolbarMenus.filter(isBuiltInToolbarMenu),
        ...menus,
        ...toolbarMenus.filter(isPersonalToolbarMenu)
    ];
    const preferred = toolbarMenus.find(menu => menu.id === preferredSharedToolbarMenuId);
    if (preferred) preferredSharedToolbarMenuId = null;
    const active = preferred || getActiveToolbarMenu();
    if (JSON.stringify(active) !== JSON.stringify(previous)) {
        applyToolbarMenu(active, false);
        if (isSystemReady) updateProjectLegendsFromMenu(active);
        if (active.id !== previous.id) saveToolbarMenus();
    }
    if (iconEditorModal.style.display === 'flex') {
        if (editingToolbarMenu && !toolbarMenus.some(menu => menu.id === editingToolbarMenu.id)) {
            editingToolbarMenu = JSON.parse(JSON.stringify(active));
            toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
            selectIconEditorTarget(iconEditorTarget.value);
        }
        renderToolbarMenuEditor();
    }
}

async function watchSharedToolbarMenus(uid, allowed) {
    const generation = ++toolbarSyncGeneration;
    toolbarSubscriptions.forEach(stop => stop());
    toolbarSubscriptions = [];
    if (!uid) return;
    try {
        const db = await window.getFirebaseDatabase();
        if (generation !== toolbarSyncGeneration) return;
        for (const preset of allowed ? builtInToolbarMenus : [defaultToolbarMenu]) {
            const stop = sharedToolbarRef(db, preset).onSnapshot(snapshot => {
                if (generation === toolbarSyncGeneration && !snapshot.metadata?.hasPendingWrites) {
                    updateSharedToolbarMenu(preset, snapshot.data());
                }
            }, () => { /* Bundled presets also work offline or before rules are deployed. */ });
            toolbarSubscriptions.push(stop);
        }
        if (allowed) {
            const stop = db.collection('goomToolbarPresets').doc(APP_PRODUCT).collection('premiumSets')
                .onSnapshot({ includeMetadataChanges: true }, snapshot => {
                    if (generation !== toolbarSyncGeneration || snapshot.metadata?.hasPendingWrites) return;
                    const menus = snapshot.docs.filter(doc => isPremiumToolbarId(doc.id))
                        .map(doc => readSharedToolbarMenu(doc.id, doc.data(), 'PROJECT')).filter(Boolean);
                    updatePremiumToolbarMenus(menus);
                }, error => {
                    if (generation === toolbarSyncGeneration && error?.code === 'permission-denied') updatePremiumToolbarMenus([]);
                });
            toolbarSubscriptions.push(stop);
        }
    } catch { /* Bundled presets are already available. */ }
}

function applyToolbarMenu(menu, persist = true) {
    if (!menu) return;
    const cycleButton = document.getElementById('btnCycleToolbarMenu');
    activeToolbarMenuId = menu.id;
    if (displayedToolbarMenu !== menu || !isSystemReady) {
        displayedToolbarMenu = menu;
        applyToolbarMenuIcons(menu);
    }
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

    if (persist) {
        preferredSharedToolbarMenuId = null;
        saveToolbarMenus();
        updateProjectLegendsFromMenu(menu);
    }
    if (typeof requestRedraw === 'function') requestRedraw();
}

function applyToolbarMenuIcons(menu = getActiveToolbarMenu()) {
    customDeviceIcons = cloneIconShapes(menu?.icons || {});
    refreshCustomDeviceIcons(customDeviceIcons);
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
        name.value = editingToolbarMenu?.id === menu.id ? editingToolbarMenu.name : menu.name;
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
        removeMenu.title = isPremiumToolbarId(menu.id) ? tr('Снять с публикации') : tr`Удалить меню «${menu.name}»`;
        removeMenu.setAttribute('aria-label', removeMenu.title);
        removeMenu.disabled = isBuiltInToolbarMenu(menu) || !canEditToolbarPreset(menu);
        removeMenu.addEventListener('click', () => deleteToolbarMenu(menu.id));
        card.append(indicator, name);
        if (isPremiumToolbarId(menu.id)) {
            const badge = document.createElement('span');
            badge.className = 'toolbar-menu-premium-badge';
            badge.textContent = 'PROJECT';
            badge.title = tr('Опубликовано для PROJECT');
            card.append(badge);
        }
        card.append(icons, removeMenu);
        container.append(card);
    });
    addMenuButton.disabled = personalToolbarMenuCount() >= toolbarMenuLimit;
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
    if (!window.hasAdminAccess?.()) toolbarShareRequested = false;
    const saveButton = document.getElementById('btnToolbarMenuSave');
    const publishButton = document.getElementById('btnToolbarMenuPublish');
    const share = document.getElementById('toolbarMenuShare');
    share.closest('label').hidden = !window.hasAdminAccess?.() || !editingToolbarMenu || !isPersonalToolbarMenu(editingToolbarMenu);
    share.checked = toolbarShareRequested;
    share.disabled = Boolean(toolbarSavePending);
    publishButton.hidden = !editingToolbarMenu || !window.hasAdminAccess?.() || !isPersonalToolbarMenu(editingToolbarMenu);
    publishButton.disabled = Boolean(toolbarSavePending) || editorHasUnsavedChanges();
    publishButton.title = publishButton.disabled ? tr('Сначала сохраните меню') : '';
    document.getElementById('btnToolbarLegacyPreset').hidden = !getLegacyToolbarPreset();
    document.getElementById('btnToolbarImportMenus').hidden = !getLegacyPersonalToolbarMenus().length;
    if (!editingToolbarMenu) return;
    if (!canEditToolbarPreset(editingToolbarMenu)) {
        saveButton.disabled = true;
        saveButton.textContent = tr('Сохранено');
        document.getElementById('toolbarMenuEditorStatus').textContent = tr('Vytvořte kopii sady pro úpravy.');
        return;
    }
    const changed = toolbarShareRequested || editingToolbarMenuIsNew
        || JSON.stringify(editingToolbarMenu) !== toolbarMenuEditorOriginal;
    document.getElementById('toolbarMenuEditorStatus').textContent = changed
        ? tr('Есть несохранённые изменения')
        : (activeToolbarMenuId === editingToolbarMenu.id ? tr('Этот набор используется на панели') : tr('Выберите набор, измените его и сохраните'));
    saveButton.disabled = !changed || Boolean(toolbarSavePending);
    saveButton.textContent = toolbarSavePending ? tr('Publikujeme…') : changed
        ? tr(isPersonalToolbarMenu(editingToolbarMenu) && !toolbarShareRequested ? 'Сохранить меню' : 'Publikovat sdílenou sadu') : tr('Сохранено');
    saveButton.style.opacity = changed ? '1' : '.48';
}

function getLegacyPersonalToolbarMenus() {
    if (!canEditToolbarMenus()) return [];
    try {
        const legacy = JSON.parse(localStorage.getItem(toolbarMenuStorageKey));
        const addedIds = new Set(toolbarMenus.map(menu => menu.id));
        const slots = Math.max(0, toolbarMenuLimit - personalToolbarMenuCount());
        return sanitizeToolbarMenus(legacy?.menus).filter(menu => !addedIds.has(menu.id)).slice(0, slots);
    } catch { return []; }
}

function getLegacyToolbarPreset() {
    if (!editingToolbarMenu || !isBuiltInToolbarMenu(editingToolbarMenu) || !window.hasAdminAccess?.()) return null;
    try {
        const raw = JSON.parse(localStorage.getItem(toolbarMenuStorageKey))?.presets?.[editingToolbarMenu.id];
        if (!raw) return null;
        const bundled = builtInToolbarMenus.find(preset => preset.id === editingToolbarMenu.id);
        const legacy = addNewToolbarDeviceTypes(sanitizeToolbarMenu(raw, bundled.id, bundled.name));
        const serialized = JSON.stringify(legacy);
        if (legacy.deviceTypes.length && serialized !== JSON.stringify(bundled) && serialized !== JSON.stringify(editingToolbarMenu)) return legacy;
    } catch { /* No usable legacy preset on this browser. */ }
    return null;
}

function renderToolbarMenuEditor() {
    renderToolbarMenuPresets();
    updateToolbarMenuEditorStatus();
}

function editorHasUnsavedChanges() {
    return toolbarShareRequested || editingToolbarMenuIsNew || JSON.stringify(editingToolbarMenu) !== toolbarMenuEditorOriginal;
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
    if (toolbarSavePending) return false;
    if (editingToolbarMenu?.id === id) return true;
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Отбросить несохранённые изменения?'))) return false;
    discardUnsavedNewMenu();
    const menu = toolbarMenus.find(item => item.id === id);
    if (!menu) return false;
    document.querySelector('.icon-editor-text-input')?.blur();
    editingToolbarMenu = JSON.parse(JSON.stringify(menu));
    toolbarShareRequested = false;
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
    toolbarShareRequested = false;
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
    if (toolbarSavePending) return;
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Закрыть редактор меню без сохранения изменений?'))) return;
    discardUnsavedNewMenu();
    saveToolbarMenus();
    document.getElementById('iconEditorModal').style.display = 'none';
}, true);
document.getElementById('btnToolbarMenuNew').addEventListener('click', async () => {
    if (toolbarSavePending || !canEditToolbarMenus()) return;
    if (personalToolbarMenuCount() >= toolbarMenuLimit) {
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
        name: tr`Меню ${personalToolbarMenuCount() + 1}`,
        deviceTypes: [...source.deviceTypes],
        icons: JSON.parse(JSON.stringify(source.icons || {}))
    };
    editingToolbarMenuIsNew = true;
    toolbarShareRequested = Boolean(window.hasAdminAccess?.());
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
    if (toolbarSavePending || !canEditToolbarPreset(menu) || isBuiltInToolbarMenu(menu)) return;
    const uid = toolbarAccountUid;
    const premium = isPremiumToolbarId(id);
    const confirmed = await showAppConfirm(premium ? tr`Снять меню «${menu.name}» с публикации?` : tr`Удалить меню «${menu.name}»?`);
    if (!confirmed || toolbarSavePending || uid !== toolbarAccountUid || !canEditToolbarPreset(menu)) return;
    if (premium) {
        await writePremiumToolbarMenu(menu, ref => ref.delete());
        return;
    }
    toolbarMenus = toolbarMenus.filter(item => item.id !== id);
    const activeMenuWasDeleted = activeToolbarMenuId === id;
    if (activeMenuWasDeleted) activeToolbarMenuId = id;
    if (editingToolbarMenu?.id === id) editingToolbarMenu = JSON.parse(JSON.stringify(getActiveToolbarMenu()));
    applyToolbarMenu(activeMenuWasDeleted ? toolbarMenus[0] : getActiveToolbarMenu(), false);
    if (activeMenuWasDeleted) updateProjectLegendsFromMenu(getActiveToolbarMenu());
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    selectIconEditorTarget(iconEditorTarget.value);
    saveToolbarMenus();
    renderToolbarMenuEditor();
}
document.getElementById('btnToolbarLegacyPreset').addEventListener('click', () => {
    const legacy = getLegacyToolbarPreset();
    if (!legacy || toolbarSavePending) return;
    editingToolbarMenu = legacy;
    selectIconEditorTarget(legacy.deviceTypes.find(type => iconEditorDeviceTypes.some(([iconType]) => iconType === type)) || iconEditorTarget.value);
    renderToolbarMenuEditor();
});

document.getElementById('btnToolbarImportMenus').addEventListener('click', async () => {
    const uid = toolbarAccountUid;
    if (toolbarSavePending || !getLegacyPersonalToolbarMenus().length
        || !await showAppConfirm(tr('Přidat starší osobní nabídky z tohoto prohlížeče k právě přihlášenému účtu?'))
        || uid !== toolbarAccountUid) return;
    toolbarMenus.push(...getLegacyPersonalToolbarMenus());
    saveToolbarMenus();
    renderToolbarMenuEditor();
});

async function writePremiumToolbarMenu(menu, write) {
    const attempt = { uid: toolbarAccountUid };
    toolbarSavePending = attempt;
    updateToolbarMenuEditorStatus();
    try {
        const db = await window.getFirebaseDatabase();
        if (toolbarSavePending !== attempt || !window.hasAdminAccess?.()) return false;
        await write(sharedToolbarRef(db, menu));
        return toolbarSavePending === attempt && toolbarAccountUid === attempt.uid && Boolean(window.hasAdminAccess?.());
    } catch {
        if (toolbarSavePending === attempt) {
            showAppAlert(tr('Не удалось обновить набор PROJECT. Проверьте подключение и правила Firebase.'), tr('Ошибка сохранения'));
        }
        return false;
    } finally {
        if (toolbarSavePending === attempt) {
            toolbarSavePending = false;
            updateToolbarMenuEditorStatus();
        }
    }
}

document.getElementById('btnToolbarMenuPublish').addEventListener('click', async () => {
    if (toolbarSavePending || !window.hasAdminAccess?.() || !editingToolbarMenu
        || !isPersonalToolbarMenu(editingToolbarMenu) || editorHasUnsavedChanges()) return;
    const source = toolbarMenus.find(menu => menu.id === editingToolbarMenu.id);
    if (!source) return;
    const menu = { ...source, id: `shared-${crypto.randomUUID()}` };
    if (!await writePremiumToolbarMenu(menu, ref => ref.set(sharedToolbarData(menu)))) return;
    const menus = toolbarMenus.filter(item => isPremiumToolbarId(item.id) && item.id !== menu.id);
    updatePremiumToolbarMenus([...menus, menu]);
    await selectToolbarMenuForEditing(menu.id);
});

document.getElementById('btnToolbarMenuSave').addEventListener('click', async () => {
    if (toolbarSavePending || !canEditToolbarPreset(editingToolbarMenu)) return;
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
    const draftId = editingToolbarMenu.id;
    const publishing = toolbarShareRequested && isPersonalToolbarMenu(editingToolbarMenu) && window.hasAdminAccess?.();
    const saved = sanitizeToolbarMenu(editingToolbarMenu, publishing ? `shared-${crypto.randomUUID()}` : draftId, name);
    if (isPremiumToolbarId(saved.id) && !await writePremiumToolbarMenu(saved, ref => ref.set(sharedToolbarData(saved)))) return;
    if (isBuiltInToolbarMenu(saved)) {
        const attempt = { uid: toolbarAccountUid };
        toolbarSavePending = attempt;
        updateToolbarMenuEditorStatus();
        try {
            const db = await window.getFirebaseDatabase();
            if (toolbarSavePending !== attempt || !window.hasAdminAccess?.()) return;
            await sharedToolbarRef(db, saved).set(sharedToolbarData(saved));
            if (toolbarSavePending !== attempt || toolbarAccountUid !== attempt.uid || !window.hasAdminAccess?.()) return;
            sharedToolbarMenus[saved.id] = saved;
        } catch {
            if (toolbarSavePending === attempt) showAppAlert(tr('Sdílenou nabídku nelze uložit. Zkontrolujte připojení a pravidla Firebase.'), tr('Ошибка сохранения'));
            return;
        } finally {
            if (toolbarSavePending === attempt) {
                toolbarSavePending = false;
                updateToolbarMenuEditorStatus();
            }
        }
    }
    if (publishing) toolbarMenus = toolbarMenus.filter(menu => menu.id !== draftId);
    toolbarShareRequested = false;
    const index = toolbarMenus.findIndex(menu => menu.id === saved.id);
    if (index < 0) toolbarMenus.push(saved);
    else toolbarMenus[index] = saved;
    editingToolbarMenu = JSON.parse(JSON.stringify(saved));
    editingToolbarMenuIsNew = false;
    toolbarMenuPreviousActiveId = null;
    if (!saveToolbarMenus()) return;
    applyToolbarMenu(saved, false);
    updateProjectLegendsFromMenu(saved);
    toolbarMenuEditorOriginal = JSON.stringify(saved);
    renderToolbarMenuEditor();
    if (isSystemReady) {
        saveStateToHistory();
        triggerAutoSave();
    }
});
let isToolbarMenuCycling = false;
document.getElementById('toolbarMenuShare').addEventListener('change', event => {
    toolbarShareRequested = Boolean(event.target.checked && window.hasAdminAccess?.());
    updateToolbarMenuEditorStatus();
});
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

let lastToolbarAccess = false;
let lastToolbarAdmin = false;
function updateToolbarAccount() {
    const uid = window.getFirebaseUser?.()?.uid || null;
    const accountChanged = uid !== toolbarAccountUid;
    const allowed = canEditToolbarMenus();
    const admin = Boolean(window.hasAdminAccess?.());
    const accessChanged = allowed !== lastToolbarAccess;
    if (!accountChanged && !accessChanged && admin === lastToolbarAdmin && displayedToolbarMenu) return;
    const lostAdmin = lastToolbarAdmin && !admin;
    toolbarAccountUid = uid;
    lastToolbarAccess = allowed;
    lastToolbarAdmin = admin;
    if (accountChanged || !allowed || lostAdmin) {
        toolbarSavePending = false;
        editingToolbarMenu = null;
        editingToolbarMenuIsNew = false;
        toolbarMenuPreviousActiveId = null;
        iconEditorModal.style.display = 'none';
    }
    if (accountChanged) {
        sharedToolbarMenus = {};
        toolbarMenus = [];
        displayedToolbarMenu = null;
    }
    if (!allowed) delete sharedToolbarMenus.pro;
    if (accountChanged || accessChanged || lostAdmin || !displayedToolbarMenu) {
        loadToolbarMenus();
        applyToolbarMenu(getActiveToolbarMenu(), false);
    } else if (iconEditorModal.style.display === 'flex') {
        redrawIconEditor();
        renderToolbarMenuEditor();
    }
    if (accountChanged || accessChanged) void watchSharedToolbarMenus(uid, allowed);
}
updateToolbarAccount();
document.addEventListener('goom-account-changed', updateToolbarAccount);
