const { createHash } = require('node:crypto');

class CompanySeatError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
const normalizeEmail = email => email.trim().toLowerCase();
const emailKey = email => createHash('sha256').update(email).digest('hex');
const teamRef = (db, uid) => db.collection('proCompanyTeams').doc(uid);
const licenseRef = (db, uid) => db.collection('cloudLicenses').doc(uid);
const inviteRef = (db, email) => db.collection('proCompanyInvitations').doc(emailKey(email));
const millis = date => date?.toMillis?.() ?? (date instanceof Date ? date.getTime() : 0);

function paidPeriods(license, uid, now) {
    if (license?.uid !== uid || license.plan !== 'pro' || license.source !== 'stripe'
        || license.status !== 'active' || license.paymentStatus !== 'paid'
        || !['monthly', 'annual'].includes(license.billingMode)) return {};
    const periods = license.companyApplicationExpiresAt ?? license.applicationExpiresAt;
    const apps=['PZTS','EPS','CCTV','SK'];
    const expiry=(license.applications||[]).filter(app=>apps.includes(app)).map(app=>periods?.[app]).sort((a,b)=>millis(b)-millis(a))[0];
    return millis(expiry)>now ? Object.fromEntries(apps.map(app=>[app,expiry])) : {};
}

function belongsToTeam(license, ownerUid, email) {
    return license?.companySeat?.ownerUid === ownerUid && license.companySeat.email === email;
}

// Webhook updates the owner and all claimed seats in the same transaction.
async function syncCompanySeatPeriods(transaction, db, ownerUid, applicationExpiresAt) {
    const team = (await transaction.get(teamRef(db, ownerUid))).data();
    const claimed = (team?.members || []).filter(member => member.uid);
    const references = await Promise.all(claimed.map(async member => {
        const ref = licenseRef(db, member.uid);
        return { member, ref, license: (await transaction.get(ref)).data() };
    }));
    for (const { member, ref, license } of references) {
        if (belongsToTeam(license, ownerUid, member.email)) {
            transaction.set(ref, { companySeat: { ownerUid, email: member.email, applicationExpiresAt } }, { mergeFields: ['companySeat'] });
        }
    }
}

function createCompanySeatService({ db, getUser, now = Date.now }) {
    async function verifiedUser(uid) {
        const user = await getUser(uid);
        if (!user?.email || !user.emailVerified || user.disabled) {
            throw new CompanySeatError('failed-precondition', 'Verify the email on your account first.');
        }
        return user;
    }

    async function save(uid, input) {
        const user = await verifiedUser(uid);
        if (!Array.isArray(input) || input.length > 3 || input.some(email => typeof email !== 'string')) {
            throw new CompanySeatError('invalid-argument', 'Enter up to three email addresses.');
        }
        const emails = input.map(normalizeEmail).filter(Boolean);
        if (new Set(emails).size !== emails.length || emails.includes(normalizeEmail(user.email))
            || emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            throw new CompanySeatError('invalid-argument', 'Enter different valid employee email addresses.');
        }
        return db.runTransaction(async transaction => {
            const ref = teamRef(db, uid);
            const [teamSnapshot, profile, license] = await Promise.all([
                transaction.get(ref), transaction.get(db.collection('users').doc(uid)), transaction.get(licenseRef(db, uid))
            ]);
            if (profile.data()?.accountType !== 'company' || !Object.keys(paidPeriods(license.data(), uid, now())).length) {
                throw new CompanySeatError('permission-denied', 'An active paid company subscription is required.');
            }
            const previous = teamSnapshot.data()?.members || [];
            const removed = previous.filter(member => !emails.includes(member.email));
            const removedWithLicense = await Promise.all(removed.filter(member => member.uid).map(async member => ({
                member, license: (await transaction.get(licenseRef(db, member.uid))).data()
            })));
            const invitations = await Promise.all(emails.map(async email => (await transaction.get(inviteRef(db, email))).data()));
            if (invitations.some(invitation => invitation && invitation.ownerUid !== uid)) {
                throw new CompanySeatError('already-exists', 'An email address is already linked to another company.');
            }
            const members = emails.map(email => previous.find(member => member.email === email) || { email });
            for (const { member, license: memberLicense } of removedWithLicense) {
                if (belongsToTeam(memberLicense, uid, member.email)) {
                    transaction.set(licenseRef(db, member.uid), { companySeat: null }, { mergeFields: ['companySeat'] });
                }
            }
            for (const member of removed) transaction.delete(inviteRef(db, member.email));
            for (const { email } of members) transaction.set(inviteRef(db, email), { ownerUid: uid });
            transaction.set(ref, { members });
            return { members };
        });
    }

    async function claim(uid) {
        const user = await verifiedUser(uid);
        const email = normalizeEmail(user.email);
        const invitation = inviteRef(db, email);
        // Most accounts have no invitation. Recheck inside the transaction before granting anything.
        if (!(await invitation.get()).exists) return { linked: false };
        return db.runTransaction(async transaction => {
            const ownerUid = (await transaction.get(invitation)).data()?.ownerUid;
            if (!ownerUid || ownerUid === uid) return { linked: false };
            const team = teamRef(db, ownerUid), memberLicense = licenseRef(db, uid);
            const [roster, ownerLicense, ownLicense] = await Promise.all([
                transaction.get(team), transaction.get(licenseRef(db, ownerUid)), transaction.get(memberLicense)
            ]);
            const members = roster.data()?.members || [];
            const member = members.find(entry => entry.email === email);
            const applicationExpiresAt = paidPeriods(ownerLicense.data(), ownerUid, now());
            if (!member || !Object.keys(applicationExpiresAt).length) return { linked: false };
            if (member.uid === uid && belongsToTeam(ownLicense.data(), ownerUid, email)) return { linked: true };
            if (member.uid && member.uid !== uid) {
                const oldRef = licenseRef(db, member.uid);
                const oldLicense = (await transaction.get(oldRef)).data();
                if (belongsToTeam(oldLicense, ownerUid, email)) transaction.set(oldRef, { companySeat: null }, { mergeFields: ['companySeat'] });
            }
            transaction.set(memberLicense, { companySeat: { ownerUid, email, applicationExpiresAt } }, { mergeFields: ['companySeat'] });
            transaction.set(team, { members: members.map(entry => entry.email === email ? { email, uid } : entry) });
            return { linked: true };
        });
    }

    return { save, claim };
}

module.exports = { createCompanySeatService, syncCompanySeatPeriods, CompanySeatError };
