(() => {
    const welcome = document.getElementById('welcomeModal');
    const intro = document.getElementById('welcomeIntro');
    const play = document.getElementById('btnIntroPlay');
    const close = document.getElementById('btnIntroClose');
    const video = document.getElementById('welcomeIntroVideo');
    const status = document.getElementById('welcomeIntroStatus');

    function stop(restoreFocus = false) {
        if (video.hidden) return;
        video.pause();
        video.hidden = true;
        video.removeAttribute('src');
        video.load();
        welcome.classList.remove('is-intro-playing');
        close.hidden = true;
        play.hidden = false;
        if (restoreFocus) play.focus();
    }

    function playbackFailed() {
        if (video.hidden) return;
        stop(true);
        status.textContent = tr('Úvodní video se nepodařilo přehrát.');
        status.hidden = false;
    }

    play.addEventListener('click', () => {
        status.hidden = true;
        welcome.classList.add('is-intro-playing');
        video.hidden = false;
        close.hidden = false;
        play.hidden = true;
        video.src = 'Intro.mp4?v=20261117';
        close.focus();
        video.play().catch(error => { if (error.name !== 'AbortError') playbackFailed(); });
    });
    close.addEventListener('click', () => stop(true));
    video.addEventListener('ended', () => stop(true));
    video.addEventListener('error', playbackFailed);
    intro.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || video.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        stop(true);
    });
    new MutationObserver(() => {
        if (welcome.dataset.step !== 'auth' || welcome.style.display === 'none') {
            stop();
            status.hidden = true;
        }
    }).observe(welcome, { attributes: true, attributeFilter: ['data-step', 'style'] });
})();
