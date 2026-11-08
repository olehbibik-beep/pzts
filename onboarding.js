const onboardingSteps = [
    {
        target: '#btnLogo',
        title: tr('Откройте меню GOOM'),
        message: tr('Чтобы загрузить план этажа, нажмите на значок GOOM в верхней панели.'),
        modal: null
    },
    {
        target: '#btnMenuLoadImg',
        title: tr('Загрузите план'),
        message: tr('Выберите изображение или PDF с планом. После загрузки можно будет размещать на нём датчики.'),
        modal: '#mainMenuModal'
    },
    {
        target: '#arrowTabBtn',
        title: tr('Выберите датчик'),
        message: tr('Разверните панель инструментов, выберите датчик, затем щёлкните по плану, чтобы его поставить.'),
        modal: null
    },
    {
        target: '#blueprintCanvas',
        title: tr('Работайте с планом'),
        message: tr('Перетаскивайте датчики мышью. Чтобы выделить несколько, зажмите левую кнопку и протяните рамку.'),
        modal: null
    }
];

let onboardingIndex = 0;
let onboardingTarget = null;

function positionOnboarding() {
    if (!onboardingTarget || document.getElementById('onboardingBackdrop').hidden) return;
    const targetRect = onboardingTarget.getBoundingClientRect();
    const highlight = document.getElementById('onboardingHighlight');
    const card = document.getElementById('onboardingCard');
    const padding = 6;
    highlight.style.left = `${targetRect.left - padding}px`;
    highlight.style.top = `${targetRect.top - padding}px`;
    highlight.style.width = `${targetRect.width + padding * 2}px`;
    highlight.style.height = `${targetRect.height + padding * 2}px`;

    const cardRect = card.getBoundingClientRect();
    const left = Math.max(16, Math.min(targetRect.left, window.innerWidth - cardRect.width - 16));
    const below = targetRect.bottom + 18;
    const top = below + cardRect.height <= window.innerHeight - 16
        ? below
        : Math.max(16, targetRect.top - cardRect.height - 18);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
}

function renderOnboardingStep() {
    const step = onboardingSteps[onboardingIndex];
    if (!step) {
        finishOnboarding();
        return;
    }

    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.id !== step.modal) modal.style.display = 'none';
    });
    if (step.modal) document.querySelector(step.modal).style.display = 'flex';

    onboardingTarget = document.querySelector(step.target);
    if (!onboardingTarget) {
        finishOnboarding();
        return;
    }

    document.getElementById('onboardingStep').textContent = tr`Шаг ${onboardingIndex + 1} из ${onboardingSteps.length}`;
    document.getElementById('onboardingTitle').textContent = step.title;
    document.getElementById('onboardingMessage').textContent = step.message;
    document.getElementById('onboardingNext').textContent = onboardingIndex === onboardingSteps.length - 1 ? tr('Готово') : tr('Далее');
    document.getElementById('onboardingBackdrop').hidden = false;
    requestAnimationFrame(positionOnboarding);
}

function finishOnboarding() {
    document.getElementById('onboardingBackdrop').hidden = true;
    document.getElementById('mainMenuModal').style.display = 'none';
    onboardingTarget = null;
}

window.startGoomOnboarding = () => {
    onboardingIndex = 0;
    renderOnboardingStep();
};

document.getElementById('onboardingNext').addEventListener('click', () => {
    if (onboardingIndex === 2) document.getElementById('arrowTabBtn').click();
    onboardingIndex++;
    renderOnboardingStep();
});
document.getElementById('onboardingSkip').addEventListener('click', finishOnboarding);
window.addEventListener('resize', positionOnboarding);
