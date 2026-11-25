const { HttpsError } = require('firebase-functions/v2/https');
const APPLICATIONS = ['PZTS','EPS','CCTV','SK'];

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

function createAdminService({ auth, db, timestamp, serverTimestamp, deleteAccount, capacity, now = Date.now }) {
    const roles = db.collection('goomAdmins');
    const grants = db.collection('goomProgramGrants');
    const licenses = db.collection('cloudLicenses');
    const audit = db.collection('goomAdminAudit');

    function roleOf(snapshot) {
        const role = snapshot.data()?.role;
        return role === 'owner' || role === 'admin' ? role : 'user';
    }

    function requireAdmin(role) {
        if (role === 'user') throw new HttpsError('permission-denied', 'Administrator access required.');
    }

    function targetUid(value) {
        if (typeof value !== 'string' || !value || value.length > 128 || /[\/\x00-\x1f]/.test(value) || ['.', '..'].includes(value)) {
            throw new HttpsError('invalid-argument', 'Invalid user ID.');
        }
        return value;
    }

    async function findUser(lookup) {
        try { return await lookup(); }
        catch (error) {
            if (error.code === 'auth/user-not-found') throw new HttpsError('not-found', 'User not found.');
            throw error;
        }
    }

    function subscriptionExpiry(license, application, uid) {
        const active = license?.uid === uid && license.status === 'active' && license.plan === 'pro'
            && license.source === 'stripe' && license.paymentStatus === 'paid' && ['monthly', 'annual'].includes(license.billingMode)
            && license.applications?.includes(application);
        return active ? license.applicationExpiresAt?.[application]?.toMillis?.() || null : null;
    }

    async function listUsers(data) {
        const query = typeof data.query === 'string' ? data.query.trim() : '';
        const pageToken = typeof data.pageToken === 'string' ? data.pageToken : undefined;
        if (query.length > 320 || (pageToken?.length || 0) > 2048) throw new HttpsError('invalid-argument', 'Invalid search.');
        const result = query
            ? { users: [await findUser(() => query.includes('@') ? auth.getUserByEmail(query) : auth.getUser(targetUid(query)))] }
            : await auth.listUsers(PAGE_SIZE, pageToken);
        if (!result.users.length) return { users: [], nextPage: null };
        const documents = await db.getAll(...result.users.flatMap(user => [roles.doc(user.uid), grants.doc(user.uid), licenses.doc(user.uid)]));
        return {
            nextPage: result.pageToken || null,
            users: result.users.map((user, index) => {
                const [role, grant, license] = documents.slice(index * 3, index * 3 + 3);
                const expiresAt = grant.data()?.expiresAt;
                return {
                    uid: user.uid, email: user.email || '', name: user.displayName || '', role: roleOf(role),
                    disabled: user.disabled, verified: user.emailVerified, lastSignIn: user.metadata.lastSignInTime || null,
                    programs: Object.fromEntries(APPLICATIONS.map(application => [application, {
                        manualUntil: expiresAt?.[application]?.toMillis?.() || null,
                        stripeUntil: subscriptionExpiry(license.data(), application, user.uid)
                    }]))
                };
            })
        };
    }

    async function changeAccess(actor, data, action) {
        const uid = targetUid(data.uid);
        if (uid === actor.uid) throw new HttpsError('permission-denied', 'You cannot edit your own access.');
        if (action === 'role' && !['admin', 'user'].includes(data.role)) throw new HttpsError('invalid-argument', 'Invalid role.');
        if (action === 'grant' && (!APPLICATIONS.includes(data.application) || !Number.isInteger(data.days) || data.days < 0 || data.days > 365)) {
            throw new HttpsError('invalid-argument', 'Invalid program or duration.');
        }
        const target = await findUser(() => auth.getUser(uid));
        const roleRef = roles.doc(uid);
        const grantRef = grants.doc(uid);
        return db.runTransaction(async transaction => {
            const actorRole = roleOf(await transaction.get(roles.doc(actor.uid)));
            requireAdmin(actorRole);
            const previousRole = roleOf(await transaction.get(roleRef));
            if ((action === 'role' && actorRole !== 'owner') || previousRole === 'owner' || (previousRole === 'admin' && actorRole !== 'owner')) {
                throw new HttpsError('permission-denied', 'Only the owner can manage administrator access.');
            }
            let changes;
            if (action === 'role') {
                if (data.role === 'admin' && (!target.emailVerified || target.disabled)) {
                    throw new HttpsError('failed-precondition', 'An administrator must have a verified email and an active account.');
                }
                if (previousRole === data.role) return { changed: false };
                if (data.role === 'user') transaction.delete(roleRef);
                else transaction.set(roleRef, { role: 'admin', updatedBy: actor.uid, updatedAt: serverTimestamp() });
                changes = { before: previousRole, after: data.role };
            } else {
                if (data.days && (!target.emailVerified || target.disabled)) {
                    throw new HttpsError('failed-precondition', 'Program access requires a verified email and an active account.');
                }
                const current = (await transaction.get(grantRef)).data()?.expiresAt || {};
                const before = current[data.application]?.toMillis?.() || null;
                if (!data.days && !before) return { changed: false };
                const after = data.days ? now() + data.days * DAY_MS : null;
                const expiresAt = { ...current };
                if (after) expiresAt[data.application] = timestamp(after);
                else delete expiresAt[data.application];
                transaction.set(grantRef, { expiresAt, updatedAt: serverTimestamp() });
                changes = { application: data.application, before, after };
            }
            transaction.set(audit.doc(), {
                action, actorUid: actor.uid, actorEmail: actor.email || '', targetUid: uid, targetEmail: target.email || '',
                ...changes, createdAt: serverTimestamp()
            });
            return { changed: true };
        });
    }

    return async function handle(request) {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
        const header = request.rawRequest.get('Authorization') || '';
        let actor;
        try { actor = await auth.verifyIdToken(header.replace(/^Bearer\s+/i, ''), true); }
        catch { throw new HttpsError('unauthenticated', 'Sign in again.'); }
        if (actor.uid !== request.auth.uid || actor.email_verified !== true) throw new HttpsError('permission-denied', 'Verified administrator account required.');
        const role = roleOf(await roles.doc(actor.uid).get());
        requireAdmin(role);

        const data = request.data || {};
        switch (data.action) {
            case 'session': return { uid: actor.uid, role, programs: APPLICATIONS };
            case 'capacity':
                if (role !== 'owner') throw new HttpsError('permission-denied', 'Only the owner can view capacity.');
                if (!capacity) throw new HttpsError('unavailable', 'Capacity data is unavailable.');
                return capacity(actor.uid, APPLICATIONS);
            case 'users': return listUsers(data);
            case 'audit': {
                const result = await audit.orderBy('createdAt', 'desc').limit(PAGE_SIZE).get();
                return { events: result.docs.map(doc => {
                    const event = doc.data();
                    return { ...event, createdAt: event.createdAt?.toMillis?.() || null };
                }) };
            }
            case 'role':
                if (role !== 'owner') throw new HttpsError('permission-denied', 'Only the owner can manage roles.');
                return changeAccess(actor, data, 'role');
            case 'grant': return changeAccess(actor, data, 'grant');
            case 'delete': if(!deleteAccount)throw new HttpsError('failed-precondition','Account deletion is unavailable.');return deleteAccount(actor,data);
            default: throw new HttpsError('invalid-argument', 'Unknown administrator operation.');
        }
    };
}

module.exports = { createAdminService };
