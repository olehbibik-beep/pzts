const { randomUUID } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const applications = new Set(['PZTS', 'EPS', 'CCTV', 'SK']);
const projectLimit = 5;
const maxProjectBytes = 24 * 1024 * 1024;
const downloadChunkBytes = 8 * 1024 * 1024;
const uploadTimeoutMs = 10 * 60 * 1000;
const legacyLock = '!goom-cloud-list';
const millis = timestamp => timestamp?.toMillis?.() ?? 0;

function hasCloudEntitlement(uid, email, application, license, grant, now) {
    const seat = license?.companySeat;
    const companySeat = typeof email === 'string' && seat?.email === email.toLowerCase()
        && [...applications].some(app=>millis(seat?.applicationExpiresAt?.[app])>now);
    const paid = license?.uid === uid && license.plan === 'pro' && license.source === 'stripe'
        && license.status === 'active' && license.paymentStatus === 'paid'
        && ['monthly', 'annual'].includes(license.billingMode) && (license.applications||[]).some(app=>applications.has(app)&&millis(license.applicationExpiresAt?.[app])>now);
    return companySeat || paid || millis(grant?.expiresAt?.[application]) > now;
}

function storedProjectPath(collection, id, row) {
    const prefix = `${collection.path}/${id}/`;
    const path = row.storagePath;
    return typeof path === 'string' && path.startsWith(prefix) && /^[^/]+$/.test(path.slice(prefix.length)) ? path : null;
}

function createCloudProjectService({ db, bucket, timestamp, serverTimestamp, now = Date.now, logError = () => {} }) {
    async function verifyAccess(transaction, auth, application) {
        const deleted=db.collection('goomDeletedAccounts').doc(auth.uid);if((await (transaction?transaction.get(deleted):deleted.get())).exists)throw new HttpsError('permission-denied','Account is deleted.');
        const [license, grant, administrator] = await Promise.all(['cloudLicenses', 'goomProgramGrants', 'goomAdmins'].map(name => {
            const ref = db.collection(name).doc(auth.uid);
            return transaction ? transaction.get(ref) : ref.get();
        }));
        const administrativeAccess = ['owner', 'admin'].includes(administrator.data()?.role);
        if (!administrativeAccess && !hasCloudEntitlement(auth.uid, auth.token.email, application, license.data(), grant.data(), now())) {
            throw new HttpsError('permission-denied', 'An active PROJECT license is required.');
        }
    }

    async function removeFileAndRow(collection, snapshot) {
        const path = storedProjectPath(collection, snapshot.id, snapshot.data());
        if (path) await bucket.file(path).delete({ ignoreNotFound: true });
        await snapshot.ref.delete({ lastUpdateTime: snapshot.updateTime });
    }

    async function cleanExpiredUploads(collection) {
        const expired = await collection.where('state', '==', 'uploading').limit(projectLimit).get();
        for (const snapshot of expired.docs) {
            if (millis(snapshot.data().uploadExpiresAt) > now()) continue;
            try { await removeFileAndRow(collection, snapshot); }
            catch (error) { logError(error); }
        }
    }

    async function save(collection, auth, application, payload) {
        if (!payload || !Array.isArray(payload.floors) || !payload.floors.length || typeof payload.projectName !== 'string') {
            throw new HttpsError('invalid-argument', 'Invalid project data.');
        }
        const serialized = JSON.stringify(payload);
        const sizeBytes = Buffer.byteLength(serialized);
        if (sizeBytes > maxProjectBytes) throw new HttpsError('resource-exhausted', 'The cloud file exceeds 24 MiB.', { reason: 'project-size' });
        await verifyAccess(null, auth, application);
        await cleanExpiredUploads(collection);

        const id = randomUUID();
        const ref = collection.doc(id);
        const storagePath = `${collection.path}/${id}/project.json`;
        const file = bucket.file(storagePath);
        const listLock = collection.doc(legacyLock);
        await db.runTransaction(async transaction => {
            await verifyAccess(transaction, auth, application);
            await transaction.get(listLock);
            const projects = await transaction.get(collection.limit(projectLimit + 1));
            if (projects.docs.filter(doc => doc.id !== legacyLock).length >= projectLimit) {
                throw new HttpsError('resource-exhausted', 'The cloud has reached its project limit.', { reason: 'project-limit' });
            }
            transaction.create(ref, { name: payload.projectName.trim().slice(0, 200) || 'Project', storagePath,
                revision: 1, sizeBytes, state: 'uploading', uploadExpiresAt: timestamp(now() + uploadTimeoutMs),
                createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            transaction.set(listLock, { nonce: id });
        });
        try {
            await file.save(Buffer.from(serialized), { resumable: false, contentType: 'application/json',
                metadata: { cacheControl: 'private, no-store' }, preconditionOpts: { ifGenerationMatch: 0 } });
        } catch (error) {
            const snapshot = await ref.get();
            if (snapshot.exists) await removeFileAndRow(collection, snapshot).catch(logError);
            throw error;
        }
        await ref.update({ state: 'ready', uploadExpiresAt: null, updatedAt: serverTimestamp() });
        return { id };
    }

    async function download(collection, snapshot, offset, expectedGeneration) {
        if (!snapshot.exists || snapshot.data().state === 'uploading') throw new HttpsError('not-found', 'Cloud project not found.');
        const path = storedProjectPath(collection, snapshot.id, snapshot.data());
        if (!path) throw new HttpsError('not-found', 'Cloud project file not found.');
        if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpsError('invalid-argument', 'Invalid download offset.');
        const [metadata] = await bucket.file(path).getMetadata();
        const size = Number(metadata.size);
        const generation = String(metadata.generation);
        if (expectedGeneration != null && expectedGeneration !== generation) throw new HttpsError('aborted', 'The project changed during download.');
        if (!Number.isSafeInteger(size) || offset >= size) throw new HttpsError('out-of-range', 'Invalid project file size.');
        const end = Math.min(offset + downloadChunkBytes, size) - 1;
        const [chunk] = await bucket.file(path, { generation }).download({ start: offset, end, validation: false });
        if (chunk.length !== end - offset + 1) throw new HttpsError('data-loss', 'Incomplete project data.');
        return { data: chunk.toString('base64'), size, generation };
    }

    return async function handle({ auth, data }) {
        if (!auth) throw new HttpsError('unauthenticated', 'Sign in first.');
        if (auth.token?.email_verified !== true) throw new HttpsError('permission-denied', 'Verify your email first.');
        const { action, application, id, payload, offset, generation } = data || {};
        if (!applications.has(application)) throw new HttpsError('invalid-argument', 'Unknown application.');
        const user = db.collection('users').doc(auth.uid);
        const collection = application === 'PZTS' ? user.collection('projects') : user.collection('apps').doc(application).collection('projects');
        if (action === 'save') return save(collection, auth, application, payload);
        if (!['delete', 'download'].includes(action) || typeof id !== 'string' || id === legacyLock || !id || id.length > 180 || id.includes('/')) {
            throw new HttpsError('invalid-argument', 'Invalid project operation.');
        }
        await verifyAccess(null, auth, application);
        const snapshot = await collection.doc(id).get();
        if (action === 'download') {
            try { return await download(collection, snapshot, offset, generation); }
            catch (error) {
                if (error.code === 404) throw new HttpsError('not-found', 'Cloud project file not found.');
                throw error;
            }
        }
        if (!snapshot.exists) return { deleted: true };
        if (snapshot.data().state === 'uploading' && millis(snapshot.data().uploadExpiresAt) > now()) {
            throw new HttpsError('failed-precondition', 'The project upload is in progress.');
        }
        await removeFileAndRow(collection, snapshot);
        return { deleted: true };
    };
}

module.exports = { createCloudProjectService, projectLimit, maxProjectBytes };
