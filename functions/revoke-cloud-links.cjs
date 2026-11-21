const { parseArgs } = require('node:util');
const { initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

async function revokeCloudLinks(bucket, apply) {
    let query = { prefix: 'users/', autoPaginate: false, maxResults: 500 };
    const summary = { cloudFiles: 0, oldLinks: 0, revoked: 0, failed: 0 };
    while (query) {
        const [files, next] = await bucket.getFiles(query);
        for (const file of files) {
            if (!/^users\/[^/]+\/(?:apps\/(?:PZTS|EPS|CCTV|SK)\/)?projects\/[^/]+\/[^/]+$/.test(file.name)) continue;
            summary.cloudFiles++;
            try {
                const [metadata] = await file.getMetadata();
                if (!metadata.metadata?.firebaseStorageDownloadTokens) continue;
                summary.oldLinks++;
                if (!apply) continue;
                const [updated] = await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null }, cacheControl: 'private, no-store' },
                    { ifMetagenerationMatch: metadata.metageneration, ifGenerationMatch: metadata.generation });
                if (updated.metadata?.firebaseStorageDownloadTokens) throw new Error('Storage retained an old download token.');
                summary.revoked++;
            } catch (error) {
                summary.failed++;
                console.error('Cloud link metadata operation failed', { code: error.code || 'unknown' });
            }
        }
        query = next;
    }
    return summary;
}

if (require.main === module) {
    Promise.resolve().then(async () => {
        const { values } = parseArgs({ options: { project: { type: 'string' }, bucket: { type: 'string' }, apply: { type: 'boolean' } } });
        if (!values.project || !values.bucket) throw new Error('Specify --project and --bucket explicitly. Omit --apply for a dry run.');
        const app = initializeApp({ projectId: values.project, storageBucket: values.bucket });
        const summary = await revokeCloudLinks(getStorage(app).bucket(), Boolean(values.apply));
        console.log({ mode: values.apply ? 'apply' : 'dry-run', ...summary });
        if (summary.failed) process.exitCode = 1;
    }).catch(error => {
        console.error('Cloud link revocation could not finish:', error.code || error.message);
        process.exitCode = 1;
    });
}

module.exports = { revokeCloudLinks };
