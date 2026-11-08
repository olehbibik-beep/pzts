const toolbarMenuStorageKey = 'goom-toolbar-menus-v1';
const toolbarMenuLimit = 7;
const toolbarMenuDeviceButtons = [...document.querySelectorAll('#deviceSelector .device-btn[data-type]')];
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
    name: tr('Основное меню'),
    deviceTypes: toolbarMenuTypes.map(item => item.type)
};

let toolbarMenus = [defaultToolbarMenu];
let activeToolbarMenuId = defaultToolbarMenu.id;
let editingToolbarMenu = null;
let editingToolbarMenuIsNew = false;
let toolbarMenuPreviousActiveId = null;
let toolbarMenuEditorOriginal = '';

function sanitizeToolbarMenus(value) {
    if (!Array.isArray(value)) return [defaultToolbarMenu];
    const seenIds = new Set();
    const menus = value.slice(0, toolbarMenuLimit).filter(menu => menu && typeof menu === 'object').map((menu, index) => {
        let id = typeof menu.id === 'string' && menu.id.trim() ? menu.id.trim().slice(0, 80) : `menu-${index + 1}`;
        if (seenIds.has(id)) id = `${id}-${index + 1}`;
        seenIds.add(id);
        const deviceTypes = Array.isArray(menu.deviceTypes)
            ? [...new Set(menu.deviceTypes.filter(type => validToolbarMenuTypes.has(type)))]
            : [];
        const sanitizedMenu = {
            id,
            name: typeof menu.name === 'string' && menu.name.trim() ? menu.name.trim().slice(0, 32) : tr`Меню ${index + 1}`,
            deviceTypes
        };
        if (menu.icons && typeof menu.icons === 'object' && !Array.isArray(menu.icons)) {
            sanitizedMenu.icons = Object.fromEntries(
                Object.entries(menu.icons)
                    .filter(([type]) => iconEditorDeviceTypes.some(([iconType]) => iconType === type))
                    .map(([type, shapes]) => [type, sanitizeIconShapes(shapes)])
            );
        }
        return sanitizedMenu;
    });
    return menus.length ? menus : [defaultToolbarMenu];
}

function loadToolbarMenus() {
    try {
        const stored = localStorage.getItem(toolbarMenuStorageKey);
        if (!stored) return;
        const data = JSON.parse(stored);
        toolbarMenus = sanitizeToolbarMenus(data.menus);
        activeToolbarMenuId = toolbarMenus.some(menu => menu.id === data.activeMenuId)
            ? data.activeMenuId
            : toolbarMenus[0].id;
    } catch (error) {
        console.error('Не удалось загрузить сохранённые наборы меню:', error);
        toolbarMenus = [defaultToolbarMenu];
        activeToolbarMenuId = defaultToolbarMenu.id;
    }
}

function saveToolbarMenus() {
    try {
        localStorage.setItem(toolbarMenuStorageKey, JSON.stringify({
            version: 1,
            activeMenuId: activeToolbarMenuId,
            menus: toolbarMenus
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
    const menuChanged = activeToolbarMenuId !== menu.id;
    activeToolbarMenuId = menu.id;
    if (menuChanged && typeof customDeviceIcons !== 'undefined') {
        customDeviceIcons = menu.icons ? JSON.parse(JSON.stringify(menu.icons)) : {};
        if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    }
    const visibleTypes = new Set(menu.deviceTypes);
    toolbarMenuDeviceButtons.forEach(button => {
        button.hidden = !visibleTypes.has(button.dataset.type);
    });

    const selectorChildren = [...document.getElementById('deviceSelector').children];
    selectorChildren.forEach((element, index) => {
        if (!element.classList.contains('menu-divider')) return;
        const beforeHasDevice = selectorChildren.slice(0, index).some(child =>
            child.matches('.device-btn[data-type]') && !child.hidden);
        const afterHasDevice = selectorChildren.slice(index + 1).some(child =>
            child.matches('.device-btn[data-type]') && !child.hidden);
        element.hidden = !beforeHasDevice || !afterHasDevice;
    });

    if (!visibleTypes.has(selectedTool)) {
        selectedTool = 'select';
        document.querySelectorAll('#deviceSelector .device-btn').forEach(button => button.classList.remove('active'));
    }
    const cycleButton = document.getElementById('btnCycleToolbarMenu');
    cycleButton.title = tr`Текущий набор: ${menu.name}. Нажмите, чтобы переключить`;
    cycleButton.setAttribute('aria-label', tr`Текущий набор меню: ${menu.name}. Переключить набор`);

    if (persist) saveToolbarMenus();
    if (typeof requestRedraw === 'function') requestRedraw();
}

function toolbarMenuButtonContent(type, menu) {
    const iconDataUrl = menu.icons && Object.prototype.hasOwnProperty.call(menu.icons, type)
        ? getCustomDeviceIconDataUrl(type, menu.icons)
        : null;
    if (iconDataUrl) return `<img src="${iconDataUrl}" alt="" style="width:22px;height:22px;object-fit:contain;">`;
    return defaultDeviceButtonContent.get(type) || '';
}

function saveCustomIconsToActiveMenu() {
    const menu = getActiveToolbarMenu();
    if (!menu) return;
    menu.icons = JSON.parse(JSON.stringify(customDeviceIcons));
    if (editingToolbarMenu?.id === menu.id) editingToolbarMenu.icons = JSON.parse(JSON.stringify(menu.icons));
    if (toolbarMenuEditorOriginal) {
        const original = JSON.parse(toolbarMenuEditorOriginal);
        original.icons = JSON.parse(JSON.stringify(menu.icons));
        toolbarMenuEditorOriginal = JSON.stringify(original);
    }
    saveToolbarMenus();
    renderToolbarMenuPresets();
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
        name.setAttribute('aria-label', tr`Название меню: ${menu.name}`);
        name.addEventListener('focus', async () => { await selectToolbarMenuForEditing(menu.id, true); });
        name.addEventListener('input', () => {
            if (editingToolbarMenu?.id !== menu.id) return;
            editingToolbarMenu.name = name.value.slice(0, 32);
            updateToolbarMenuEditorStatus();
        });
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
            iconButton.innerHTML = toolbarMenuButtonContent(type, menu);
            iconButton.addEventListener('click', async event => {
                event.stopPropagation();
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
        removeMenu.disabled = toolbarMenus.length < 2;
        removeMenu.addEventListener('click', () => deleteToolbarMenu(menu.id));
        card.append(indicator, name, icons, removeMenu);
        container.append(card);
    });
    addMenuButton.disabled = toolbarMenus.length >= toolbarMenuLimit;
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
    editingToolbarMenu = JSON.parse(JSON.stringify(menu));
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    applyToolbarMenu(menu);
    const firstEditableType = menu.deviceTypes.find(type =>
        iconEditorDeviceTypes.some(([iconType]) => iconType === type));
    if (firstEditableType) selectIconEditorTarget(firstEditableType);
    renderToolbarMenuEditor();
    if (focusName) document.querySelector(`.toolbar-menu-preset[data-menu-id="${id}"] .toolbar-menu-preset-name`)?.focus();
    return true;
}

function openToolbarMenuEditor() {
    if (!window.hasProAccess?.()) { window.requestProUpgrade?.(); return; }
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
    if (toolbarMenus.length >= toolbarMenuLimit) {
        showAppAlert(tr('Достигнут лимит в 7 меню.'), tr('Лимит меню'));
        return;
    }
    if (editorHasUnsavedChanges() && !await showAppConfirm(tr('Сохранить текущие изменения перед созданием меню?'))) return;
    if (editorHasUnsavedChanges()) document.getElementById('btnToolbarMenuSave').click();
    const source = getActiveToolbarMenu();
    toolbarMenuPreviousActiveId = activeToolbarMenuId;
    editingToolbarMenu = {
        id: `menu-${Date.now()}`,
        name: tr`Меню ${toolbarMenus.length + 1}`,
        deviceTypes: [...source.deviceTypes],
        icons: JSON.parse(JSON.stringify(source.icons || customDeviceIcons))
    };
    editingToolbarMenuIsNew = true;
    toolbarMenuEditorOriginal = '';
    toolbarMenus.push(JSON.parse(JSON.stringify(editingToolbarMenu)));
    applyToolbarMenu(editingToolbarMenu, false);
    const firstEditableType = editingToolbarMenu.deviceTypes.find(type =>
        iconEditorDeviceTypes.some(([iconType]) => iconType === type));
    if (firstEditableType) selectIconEditorTarget(firstEditableType);
    renderToolbarMenuEditor();
    document.querySelector(`.toolbar-menu-preset[data-menu-id="${editingToolbarMenu.id}"] .toolbar-menu-preset-name`)?.focus();
});
async function deleteToolbarMenu(id) {
    const menu = toolbarMenus.find(item => item.id === id);
    if (!menu || toolbarMenus.length < 2 || !await showAppConfirm(tr`Удалить меню «${menu.name}»?`)) return;
    toolbarMenus = toolbarMenus.filter(item => item.id !== id);
    if (!toolbarMenus.length) toolbarMenus = [{ ...defaultToolbarMenu }];
    const activeMenuWasDeleted = activeToolbarMenuId === id;
    if (activeMenuWasDeleted) activeToolbarMenuId = id;
    if (editingToolbarMenu?.id === id) editingToolbarMenu = JSON.parse(JSON.stringify(getActiveToolbarMenu()));
    applyToolbarMenu(activeMenuWasDeleted ? toolbarMenus[0] : getActiveToolbarMenu(), false);
    editingToolbarMenuIsNew = false;
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    saveToolbarMenus();
    renderToolbarMenuEditor();
}
document.getElementById('btnToolbarMenuSave').addEventListener('click', () => {
    if (!editingToolbarMenu) return;
    const name = editingToolbarMenu.name.trim();
    if (!name) {
        showAppAlert(tr('Укажите название набора меню.'), tr('Название меню'));
        document.querySelector(`.toolbar-menu-preset[data-menu-id="${editingToolbarMenu.id}"] .toolbar-menu-preset-name`)?.focus();
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
    toolbarMenuEditorOriginal = JSON.stringify(editingToolbarMenu);
    renderToolbarMenuEditor();
});
let isToolbarMenuCycling = false;
document.getElementById('btnCycleToolbarMenu').addEventListener('click', () => {
    if (isToolbarMenuCycling) return;
    if (toolbarMenus.length < 2) {
        document.getElementById('btnCycleToolbarMenu').title = tr('Создайте дополнительные наборы в редакторе меню');
        return;
    }
    const activeIndex = toolbarMenus.findIndex(menu => menu.id === activeToolbarMenuId);
    const deviceSelector = document.getElementById('deviceSelector');
    isToolbarMenuCycling = true;
    deviceSelector.classList.add('menu-slide-out');
    setTimeout(() => {
        applyToolbarMenu(toolbarMenus[(activeIndex + 1) % toolbarMenus.length]);
        deviceSelector.classList.remove('menu-slide-out');
        deviceSelector.classList.add('menu-slide-in');
        setTimeout(() => {
            deviceSelector.classList.remove('menu-slide-in');
            isToolbarMenuCycling = false;
        }, 210);
    }, 140);
});

loadToolbarMenus();
applyToolbarMenu(getActiveToolbarMenu(), false);
