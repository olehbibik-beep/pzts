const { projectLimit, maxProjectBytes } = require('./cloud-projects.cjs');

function createCapacityService({ db, projectId, bucketName, credential, now = Date.now, fetchMetric = fetch }) {
    let lastMetric = null;

    async function bucketUsage() {
        if (lastMetric?.expiresAt > now()) return lastMetric.value;
        if (!projectId || !/^[a-z0-9._-]+$/.test(bucketName)) return null;
        try {
            const { access_token } = await credential.getAccessToken();
            const url = new URL(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries`);
            url.search = new URLSearchParams({
                filter: `metric.type="storage.googleapis.com/storage/v2/total_bytes" AND resource.type="gcs_bucket" AND resource.labels.bucket_name="${bucketName}"`,
                'interval.startTime': new Date(now() - 48 * 60 * 60 * 1000).toISOString(),
                'interval.endTime': new Date(now()).toISOString(),
                'aggregation.alignmentPeriod': '3600s',
                'aggregation.perSeriesAligner': 'ALIGN_NEXT_OLDER',
                pageSize: '1000'
            });
            const response = await fetchMetric(url, {
                headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) return null;
            const { timeSeries, nextPageToken } = await response.json();
            if (nextPageToken || !timeSeries?.length) return null;
            const points = timeSeries.map(series => series.points?.[0]);
            const counts = points.map(point => Number(point?.value?.int64Value ?? point?.value?.doubleValue));
            const times = points.map(point => Date.parse(point?.interval?.endTime));
            if (!counts.every(count => Number.isFinite(count) && count >= 0) || !times.every(Number.isFinite)) return null;
            const value = { bytes: counts.reduce((sum, count) => sum + count, 0), reportedAt: Math.min(...times) };
            lastMetric = { expiresAt: now() + 300_000, value };
            return value;
        } catch { return null; }
    }

    return async (uid, applications) => {
        const user = db.collection('users').doc(uid);
        const [usage, ...editors] = await Promise.all([
            bucketUsage(),
            ...applications.map(async application => {
                const parent = application === 'PZTS' ? user : user.collection('apps').doc(application);
                const { docs } = await parent.collection('projects').get();
                const projects = docs.filter(doc => doc.id !== '!goom-cloud-list').map(doc => doc.data());
                const measured = projects.filter(row => Number.isSafeInteger(row.sizeBytes) && row.sizeBytes >= 0);
                return {
                    application, used: projects.length, available: Math.max(0, projectLimit - projects.length),
                    bytes: measured.reduce((sum, row) => sum + row.sizeBytes, 0), unmeasured: projects.length - measured.length
                };
            })
        ]);
        return { bucketName, usage, projectLimit, maxProjectBytes, editors };
    };
}

module.exports = { createCapacityService };
