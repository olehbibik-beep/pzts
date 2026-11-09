(() => {
    const toolbar = document.getElementById('tabletDeviceTools');
    let tabletInput = matchMedia('(pointer: coarse)').matches;
    let previousState = '';
    const labels = {
        select: 'Výběr detektoru', pan: 'Posun plánu', duplicate: 'Duplikovat',
        note: 'Poznámka', address: 'Adresa prvku', delete: 'Odstranit vybrané', undo: 'Vrátit akci'
    };
    function selected() { return floors[currentFloorIndex]?.devices.filter(device => activeDeviceIds.has(device.id)) || []; }
    window.updateTabletTools = () => {
        const items = selected();
        const modal = [...document.querySelectorAll('.modal')].some(element => element.style.display === 'flex' || element.style.display === 'block');
        const visible = tabletInput && isSystemReady && !isOverviewMode && !modal;
        updateDeviceRotationHandles(visible,items);
        const state = `${visible}:${items.map(item => item.id).join(',')}:${selectedTool}:${window.tabletPanMode}:${historyIndex}:${getGoomLanguage()}`;
        if (previousState === state) return;
        previousState = state; toolbar.hidden = !visible;
        for (const button of toolbar.querySelectorAll('button')) {
            const action = button.dataset.tabletAction;
            button.setAttribute('aria-label', tr(labels[action]));
            button.setAttribute('data-tooltip', tr(labels[action]));
            button.disabled = ['rotate', 'duplicate', 'delete'].includes(action) ? !items.length
                : action === 'address' ? items.length !== 1 || ['panel', 'textNode', 'ramen', 'deactivated'].includes(items[0]?.type)
                    : action === 'note' ? items.length !== 1
                    : action === 'undo' ? historyIndex <= 0 : false;
            if (action === 'select') button.setAttribute('aria-pressed', String(selectedTool === 'select' && !window.tabletPanMode));
            if (action === 'pan') button.setAttribute('aria-pressed', String(Boolean(window.tabletPanMode)));
        }
    };
    document.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') tabletInput = true;
        window.updateTabletTools();
    }, true);
    toolbar.addEventListener('pointerdown', event => { event.stopPropagation(); clearCanvasDrag(); });
    toolbar.addEventListener('click', async event => {
        const button = event.target.closest('[data-tablet-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.tabletAction;
        const items = selected();
        const floor = floors[currentFloorIndex];
        clearCanvasDrag();
        window.clearGoomTooltips(event);
        if (action === 'select' || action === 'pan') {
            window.tabletPanMode = action === 'pan'; selectedTool = 'select';
            document.querySelectorAll('#deviceSelector .device-btn').forEach(item => item.classList.remove('active'));
        } else if (action === 'undo') await undo();
        else if (action === 'note') openTextModal(items[0]);
        else if (action === 'address') openNumberModal(items[0]);
        else {
            if (action === 'delete') {
                floor.devices = floor.devices.filter(item => !activeDeviceIds.has(item.id));
                floor.cables = floor.cables.filter(cable => !activeDeviceIds.has(cable.fromId) && !activeDeviceIds.has(cable.toId));
                activeDeviceIds.clear();
            }
            if (action === 'duplicate') {
                activeDeviceIds.clear();
                for (const item of items) {
                    const copy = { ...JSON.parse(JSON.stringify(item)), id: genId(), x: item.x + 35, y: item.y + 35, manualNumber: null };
                    floor.devices.push(copy); activeDeviceIds.add(copy.id);
                }
            }
            calculateDynamicNumbersGlobal(floors);
            saveStateToHistory(); triggerAutoSave();
        }
        previousState = ''; requestRedraw(); window.updateTabletTools();
    });
    new MutationObserver(() => window.updateTabletTools()).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    window.addEventListener('resize', () => { previousState = ''; window.updateTabletTools(); });
    window.addEventListener('goom-language-changed', () => { previousState = ''; window.updateTabletTools(); });
    window.updateTabletTools();
})();
