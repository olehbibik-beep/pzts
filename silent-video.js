// GooM videos are intentionally silent, including new camera previews and repeated playback.
(() => {
    function silence(video) {
        if (!(video instanceof HTMLVideoElement)) return;
        if (!video.defaultMuted) video.defaultMuted = true;
        if (!video.muted) video.muted = true;
        if (video.volume !== 0) video.volume = 0;
    }
    function scan(root) {
        silence(root);
        root.querySelectorAll?.('video').forEach(silence);
    }
    for (const event of ['play', 'playing', 'loadstart', 'loadedmetadata', 'volumechange']) {
        document.addEventListener(event, event => silence(event.target), true);
    }
    new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) scan(node);
    }).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
    document.addEventListener('visibilitychange', () => scan(document));
    scan(document);
})();
