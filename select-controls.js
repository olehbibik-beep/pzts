// Keep real selects for forms and existing change handlers; render one consistent, accessible list.
(() => {
    const widgets = new Map();
    let current = null;
    let serial = 0;
    let search = '';
    let searchTime = 0;
    function close(refocus = false) {
        if (!current) return;
        const { trigger, popup, widget } = current;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-activedescendant');
        widget.wrapper.classList.remove('is-open');
        if (window.dismissGoomPopup) window.dismissGoomPopup(popup); else popup.remove();
        current = null;
        if (refocus) trigger.focus({ preventScroll: true });
        window.clearGoomTooltips?.();
    }
    function sync(widget) {
        const { select, trigger } = widget;
        trigger.firstChild.textContent = select.selectedOptions[0]?.textContent || '';
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.closest('label')?.firstChild?.textContent?.trim() || trigger.firstChild.textContent);
        if (current?.widget === widget) close();
    }
    function highlight(index) {
        if (!current) return;
        const options = [...current.popup.children];
        const count = options.length;
        if (!count) return;
        index = (index + count) % count;
        for (let n = 0; n < count && options[index].getAttribute('aria-disabled') === 'true'; n++) index = (index + 1) % count;
        current.index = index;
        options.forEach((option, position) => option.classList.toggle('active', position === index));
        current.trigger.setAttribute('aria-activedescendant', options[index].id);
        options[index].scrollIntoView({ block: 'nearest' });
    }
    function choose(index) {
        if (!current) return;
        const { widget } = current;
        const option = widget.select.options[index];
        if (!option || option.disabled) return;
        widget.select.value = option.value;
        close(true);
        widget.select.dispatchEvent(new Event('input', { bubbles: true }));
        widget.select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(widget);
    }
    function open(widget) {
        if (widget.select.disabled) return;
        if (current?.widget === widget) { close(true); return; }
        close(); sync(widget);
        const popup = document.createElement('div');
        popup.id = `${widget.trigger.id}-list`;
        popup.className = 'ui-select-popup'; popup.setAttribute('role', 'listbox');
        const welcomeLanguage = Boolean(widget.select.closest('.welcome-controls')) && widget.select.hasAttribute('data-language-select');
        if (welcomeLanguage) popup.classList.add('welcome-language-popup');
        popup.setAttribute('aria-label', widget.trigger.getAttribute('aria-label'));
        [...widget.select.options].forEach((option, index) => {
            const row = document.createElement('div');
            row.id = `${popup.id}-${index}`;
            row.className = 'ui-select-option'; row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(option.selected));
            row.setAttribute('aria-disabled', String(option.disabled));
            row.textContent = option.textContent;
            row.addEventListener('pointerdown', event => event.preventDefault());
            row.addEventListener('click', () => choose(index));
            popup.appendChild(row);
        });
        document.body.appendChild(popup);
        const rect = widget.trigger.getBoundingClientRect();
        const height = Math.min(280, widget.select.options.length * 44 + 2);
        const below = window.innerHeight - rect.bottom - 8;
        const popupWidth = welcomeLanguage ? rect.width : Math.max(rect.width, 120);
        const popupLeft = widget.select.hasAttribute('data-language-select') ? rect.left + (rect.width - popupWidth) / 2 : rect.left;
        popup.style.width = `${popupWidth}px`;
        popup.style.left = `${Math.max(8, Math.min(popupLeft, window.innerWidth - popupWidth - 8))}px`;
        popup.style.maxHeight = `${Math.max(70, Math.min(height, below >= 120 ? below : rect.top - 8))}px`;
        if (welcomeLanguage) popup.style.top = `${rect.top}px`;
        else if (below >= 120 || rect.top < 140) popup.style.top = `${rect.bottom}px`;
        else popup.style.bottom = `${window.innerHeight - rect.top}px`;
        current = { widget, trigger: widget.trigger, popup, index: Math.max(0, widget.select.selectedIndex) };
        widget.trigger.setAttribute('aria-controls', popup.id);
        widget.trigger.setAttribute('aria-expanded', 'true');
        widget.wrapper.classList.add('is-open');
        highlight(current.index);
        window.clearGoomTooltips?.();
    }
    function enhance(select) {
        if (widgets.has(select) || select.style.display === 'none' || select.multiple || select.size > 1) return;
        const wrapper = document.createElement('span');
        wrapper.className = 'ui-select';
        if (select.hasAttribute('data-language-select')) wrapper.classList.add('language-select');
        if (select.classList.contains('account-input') || select.closest('label')) wrapper.classList.add('full-width');
        select.before(wrapper); wrapper.appendChild(select);
        const trigger = document.createElement('button');
        trigger.type = 'button'; trigger.id = `ui-select-${++serial}`;
        trigger.className = 'ui-select-trigger'; trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
        trigger.appendChild(document.createElement('span')); wrapper.appendChild(trigger);
        select.classList.add('select-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
        const widget = { select, trigger, wrapper };
        widgets.set(select, widget); sync(widget);
        trigger.addEventListener('click', () => open(widget));
        trigger.addEventListener('keydown', event => {
            if (event.key === 'Tab') { close(); return; }
            if (event.key === 'Escape') { if (current) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
                event.preventDefault(); event.stopPropagation();
                const wasOpen = current?.widget === widget;
                if (!wasOpen) open(widget);
                else if (event.key === 'Enter' || event.key === ' ') { choose(current.index); return; }
                if (event.key === 'ArrowDown' && wasOpen) highlight(current.index + 1);
                if (event.key === 'ArrowUp' && wasOpen) highlight(current.index - 1);
                if (event.key === 'Home') highlight(0);
                if (event.key === 'End') highlight(select.options.length - 1);
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                event.stopPropagation();
                if (Date.now() - searchTime > 700) search = '';
                search += event.key.toLocaleLowerCase(); searchTime = Date.now();
                if (current?.widget !== widget) open(widget);
                const match = [...select.options].findIndex(option => !option.disabled && option.textContent.toLocaleLowerCase().startsWith(search));
                if (match !== -1) highlight(match);
            }
        });
        select.addEventListener('change', () => sync(widget));
        new MutationObserver(() => sync(widget)).observe(select, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'aria-label'] });
    }
    document.querySelectorAll('select').forEach(enhance);
    new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('select')) enhance(node);
            node.querySelectorAll('select').forEach(enhance);
        }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointerdown', event => {
        if (current && !current.trigger.contains(event.target) && !current.popup.contains(event.target)) close();
    }, true);
    window.addEventListener('resize', () => close());
    document.addEventListener('scroll', event => { if (current && !current.popup.contains(event.target)) close(); }, true);
    window.addEventListener('blur', () => close());
    window.addEventListener('goom-language-changed', () => { close(); widgets.forEach(sync); });
    window.refreshGoomSelects = () => widgets.forEach(sync);
})();
