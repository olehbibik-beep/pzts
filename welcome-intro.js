(() => {
    const welcome = document.getElementById('welcomeModal');
    const play = document.getElementById('btnIntroPlay');
    const video = document.getElementById('welcomeIntroVideo');
    const status = document.getElementById('welcomeIntroStatus');
    let playHadFocus = false;

    function stop(restoreFocus = false) {
        if (video.hidden) return;
        video.pause();
        video.hidden = true;
        video.removeAttribute('src');
        video.load();
        welcome.classList.remove('is-intro-playing');
        play.hidden = false;
        if (restoreFocus && playHadFocus && document.activeElement === document.body) play.focus();
    }

    function playbackFailed() {
        if (video.hidden) return;
        stop(true);
        status.textContent = tr('Úvodní video se nepodařilo přehrát.');
        status.hidden = false;
    }

    play.addEventListener('click', () => {
        status.hidden = true;
        playHadFocus = document.activeElement === play;
        play.hidden = true;
        video.hidden = false;
        video.src = 'Intro.mp4?v=20261117';
        video.play().catch(error => { if (error.name !== 'AbortError') playbackFailed(); });
    });
    video.addEventListener('playing', () => {
        if (!video.hidden) welcome.classList.add('is-intro-playing');
    });
    video.addEventListener('ended', () => stop(true));
    video.addEventListener('error', playbackFailed);
    new MutationObserver(() => {
        if (welcome.dataset.step !== 'auth' || welcome.style.display === 'none') {
            stop();
            status.hidden = true;
        }
    }).observe(welcome, { attributes: true, attributeFilter: ['data-step', 'style'] });
})();
