const onboardingSteps = [
    ['Nahrajte výkres', 'V horní liště otevřete nabídku GooM a zvolte Nahrát výkres. Můžete použít PDF, obrázek nebo DXF.'],
    APP_PRODUCT === 'CCTV' ? ['Umístěte první kameru', 'Vyberte skupinu a typ kamery a klikněte na výkres.'] :
        ['Umístěte první detektor', 'Rozbalte panel nástrojů, vyberte sběrnici a detektor a klepněte nebo klikněte na výkres.'],
    ['Upravte polohu a směr', APP_PRODUCT === 'CCTV' ? 'Kameru otočte klávesami S a D nebo šipkami na tabletu. Dvojím kliknutím nastavíte úhel a dosah.' :
        'Detektor přetáhněte na nové místo. Otočíte ho klávesami S a D nebo šipkami u vybraného detektoru na tabletu.'],
    ['Pracujte s podlažími', APP_PRODUCT === 'CCTV' ? 'Každé podlaží má vlastní výkres a kamery.' :
        'Dole otevřete Řez budovou a vyberte podlaží. Každé podlaží má vlastní výkres a detektory.'],
    ['Uložte nebo vytiskněte projekt', 'V nabídce GooM vyberte Uložit / Export pro soubor .TECH nebo Tisk pro otevření dialogu tiskárny.']
];

const onboardingPanel = document.getElementById('onboardingBackdrop');
const onboardingNext = document.getElementById('onboardingNext');
const completedOnboarding = new Set();
let onboardingIndex = 0;
let onboardingUid = null;

function renderOnboardingStep() {
    const [title, message] = onboardingSteps[onboardingIndex];
    document.getElementById('onboardingStep').textContent = tr`Шаг ${onboardingIndex + 1} из ${onboardingSteps.length}`;
    document.getElementById('onboardingTitle').textContent = tr(title);
    document.getElementById('onboardingMessage').textContent = tr(message);
    onboardingNext.textContent = tr(onboardingIndex === onboardingSteps.length - 1 ? 'Готово' : 'Далее');
}

function onboardingStorageKey(uid) {
    return `${productStorageKey('goom-first-project-v1')}:${uid}`;
}

function hideOnboarding() {
    onboardingPanel.hidden = true;
    onboardingUid = null;
}

function finishOnboarding() {
    if (onboardingUid) {
        completedOnboarding.add(onboardingUid);
        try { localStorage.setItem(onboardingStorageKey(onboardingUid), '1'); } catch {}
    }
    hideOnboarding();
}

window.startGoomOnboarding = () => {
    if (window.isGoomReadOnly?.()) return;
    const uid = window.getFirebaseUser?.()?.uid;
    if (!uid || onboardingUid === uid || completedOnboarding.has(uid)) return;
    try { if (localStorage.getItem(onboardingStorageKey(uid))) return; } catch {}
    onboardingUid = uid;
    onboardingIndex = 0;
    renderOnboardingStep();
    onboardingPanel.hidden = false;
};

onboardingNext.addEventListener('click', () => {
    if (onboardingIndex + 1 === onboardingSteps.length) finishOnboarding();
    else { onboardingIndex++; renderOnboardingStep(); }
});
document.getElementById('onboardingSkip').addEventListener('click', finishOnboarding);
window.addEventListener('goom-language-changed', () => {
    if (!onboardingPanel.hidden) renderOnboardingStep();
});
document.addEventListener('goom-auth-state-changed', event => {
    if (onboardingUid && event.detail.user?.uid !== onboardingUid) hideOnboarding();
});
