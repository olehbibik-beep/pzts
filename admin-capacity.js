(() => {
    const section = document.getElementById('adminCapacitySection');
    const status = document.getElementById('adminCapacityStatus');
    const dataNode = document.getElementById('adminCapacityData');
    const reposNode = document.getElementById('adminCapacityRepos');
    const estimate = document.getElementById('adminCapacityEstimate');
    const proposal = document.getElementById('adminCapacityProposal');
    const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
    const mib = 1024 * 1024;
    const formatBytes = bytes => number.format(bytes / mib) + ' МиБ';
    let generation = 0;
    let capacity = null;

    function node(tag, text) {
        const element = document.createElement(tag);
        element.textContent = text;
        return element;
    }

    function renderEstimate() {
        if (!capacity) { estimate.textContent = ''; return; }
        const requested = proposal.valueAsNumber;
        if (!proposal.validity.valid || !Number.isInteger(requested)) { estimate.textContent = ''; return; }
        const maximum = requested * capacity.editors.length * capacity.maxProjectBytes;
        const current = capacity.projectLimit * capacity.editors.length * capacity.maxProjectBytes;
        estimate.textContent = `До ${formatBytes(maximum)} на аккаунт во всех редакторах. `
            + (maximum >= current ? `Рост потолка на ${formatBytes(maximum - current)}.` : `Снижение потолка на ${formatBytes(current - maximum)}.`);
    }

    function renderCapacity(data) {
        capacity = data;
        const usage = data.usage
            ? `${formatBytes(data.usage.bytes)} в бакете ${data.bucketName}. Данные Monitoring на ${new Date(data.usage.reportedAt).toLocaleString('ru')}.`
            : 'Объём бакета не получен из Cloud Monitoring. Откройте «Использование Storage».';
        const list = node('ul', '');
        for (const editor of data.editors) {
            const measured = editor.unmeasured ? `, без размера у ${editor.unmeasured}` : '';
            list.append(node('li', `${editor.application} · занято ${editor.used} из ${data.projectLimit} · свободно ${editor.available} · ${formatBytes(editor.bytes)}${measured}`));
        }
        dataNode.replaceChildren(node('p', usage), node('h3', 'Мои проекты GooM'), list,
            node('p', `Ограничение файла ${formatBytes(data.maxProjectBytes)}. Слоты учитывают и незавершённые загрузки.`));
        renderEstimate();
    }

    async function repoSize(repo) {
        const response = await fetch(`https://api.github.com/repos/olehbibik-beep/${repo}`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error('GitHub API unavailable');
        const { size } = await response.json();
        if (!Number.isFinite(size) || size < 0) throw Error('Missing repository size');
        return size * 1024;
    }

    window.clearGoomInfrastructureCapacity = () => {
        generation++;
        capacity = null;
        dataNode.replaceChildren();
        reposNode.replaceChildren();
        estimate.textContent = '';
        section.hidden = true;
    };

    window.loadGoomInfrastructureCapacity = async user => {
        const request = ++generation;
        status.textContent = 'Запрашиваем данные…';
        const repos = ['goom', 'pzts', 'cctv'];
        const results = await Promise.allSettled([(async () => {
            const token = await user.getIdToken();
            const response = await fetch('https://europe-west1-pztsepscctv.cloudfunctions.net/goomAdmin', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ data: { action: 'capacity' } }), signal: AbortSignal.timeout(20000)
            });
            const { result } = await response.json();
            if (!response.ok || !Array.isArray(result?.editors)) throw Error('Capacity unavailable');
            return result;
        })(), ...repos.map(repoSize)]);
        if (request !== generation) return;
        const [firebase, ...github] = results;
        if (firebase.status === 'fulfilled') renderCapacity(firebase.value);
        else {
            capacity = null;
            dataNode.replaceChildren(node('p', 'Не удалось получить данные проекта Firebase. Откройте консоль или обновите этот раздел.'));
            renderEstimate();
        }
        reposNode.replaceChildren(...github.map((result, index) => {
            if (result.status !== 'fulfilled') return node('li', `${repos[index]} · размер недоступен`);
            const bytes = result.value;
            return node('li', `${repos[index]} · ${formatBytes(bytes)} · ${formatBytes(Math.max(0, 1024 * mib - bytes))} до ориентира 1 ГиБ`);
        }));
        status.textContent = '';
    };
    proposal.addEventListener('input', renderEstimate);
})();
