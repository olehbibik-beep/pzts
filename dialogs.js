const appDialogQueue = [];
let activeAppDialog = null;

window.addEventListener('keydown', event => {
    if (!activeAppDialog) return;
    const { type } = activeAppDialog.options;
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        activeAppDialog.finish(type === 'alert' ? undefined : type === 'confirm' ? false : null);
    } else if (event.key === 'Enter' && event.target.id === 'appDialogInput' && type === 'prompt') {
        event.preventDefault();
        event.stopImmediatePropagation();
        activeAppDialog.finish(event.target.value);
    }
}, true);

function showNextAppDialog() {
    if (activeAppDialog || !appDialogQueue.length) return;

    activeAppDialog = appDialogQueue.shift();
    const { type, message, title, defaultValue } = activeAppDialog.options;
    const backdrop = document.getElementById('appDialog');
    const input = document.getElementById('appDialogInput');
    const cancelButton = document.getElementById('appDialogCancel');
    const confirmButton = document.getElementById('appDialogConfirm');
    document.getElementById('appDialogTitle').textContent = title;
    document.getElementById('appDialogMessage').textContent = message;
    input.hidden = type !== 'prompt';
    input.value = type === 'prompt' ? defaultValue : '';
    cancelButton.hidden = type === 'alert';
    confirmButton.textContent = type === 'alert' ? tr('Понятно') : type === 'prompt' ? tr('Сохранить') : tr('Подтвердить');
    backdrop.hidden = false;
    backdrop.setAttribute('role', type === 'alert' ? 'alertdialog' : 'dialog');

    const previousFocus = document.activeElement;
    const finish = value => {
        if (!activeAppDialog) return;
        const dialog = activeAppDialog;
        activeAppDialog = null;
        backdrop.hidden = true;
        input.onkeydown = null;
        backdrop.onclick = null;
        confirmButton.onclick = null;
        cancelButton.onclick = null;
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
        dialog.resolve(value);
        queueMicrotask(showNextAppDialog);
    };
    activeAppDialog.finish = finish;

    confirmButton.onclick = () => finish(type === 'prompt' ? input.value : type === 'confirm' ? true : undefined);
    cancelButton.onclick = () => finish(type === 'confirm' ? false : null);
    backdrop.onclick = event => {
        if (event.target === backdrop && type !== 'alert') finish(type === 'confirm' ? false : null);
    };
    (type === 'prompt' ? input : confirmButton).focus();
}

function showAppDialog(options) {
    return new Promise(resolve => {
        appDialogQueue.push({ options, resolve });
        showNextAppDialog();
    });
}

window.showAppAlert = (message, title = tr('Сообщение')) =>
    showAppDialog({ type: 'alert', title, message: String(message) });

window.showAppConfirm = (message, title = tr('Подтвердите действие')) =>
    showAppDialog({ type: 'confirm', title, message: String(message) });

window.showAppPrompt = (message, defaultValue = '', title = tr('Введите значение')) =>
    showAppDialog({ type: 'prompt', title, message: String(message), defaultValue: String(defaultValue) });
