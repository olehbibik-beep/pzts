// Keep this check before application loading so phones never initialize the editor or Firebase.
(() => {
    function getDeviceSupport() {
        const ua = navigator.userAgent;
        const explicitTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
        const phoneUA = /iPhone|iPod|Windows Phone|Android.*Mobile/i.test(ua);
        const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
        const screenShortSide = Math.min(screen.width, screen.height);
        const phone = phoneUA || (!explicitTablet && touch && screenShortSide > 0 && screenShortSide < 600);
        return { phone, supported: !phone && window.innerWidth >= 600 };
    }

    let previousSupport;
    function updateDeviceSupport() {
        const support = getDeviceSupport();
        document.documentElement.classList.toggle('device-blocked', !support.supported);
        document.documentElement.dataset.device = support.phone ? 'phone' : 'computer-or-tablet';
        const title = document.getElementById('deviceSupportTitle');
        const message = document.getElementById('deviceSupportMessage');
        if (title) title.textContent = support.phone ? 'Откройте GOOM на планшете или ПК' : 'Увеличьте ширину окна';
        if (message) message.textContent = support.phone
            ? 'Версия для телефонов недоступна. Для работы с проектами используйте планшет, ноутбук или компьютер.'
            : 'Для работы с планом нужна ширина окна от 600 пикселей. Разверните окно или поверните планшет.';
        if (previousSupport !== support.supported) {
            previousSupport = support.supported;
            window.dispatchEvent(new CustomEvent('goom-device-support-changed', { detail: support }));
        }
    }

    window.isGoomDeviceSupported = () => getDeviceSupport().supported;
    window.addEventListener('resize', updateDeviceSupport);
    document.addEventListener('DOMContentLoaded', updateDeviceSupport);
    window.addEventListener('keydown', event => {
        if (!window.isGoomDeviceSupported()) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    updateDeviceSupport();
})();
