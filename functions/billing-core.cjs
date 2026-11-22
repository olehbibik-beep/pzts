const { randomBytes } = require('node:crypto');
const { syncCompanySeatPeriods } = require('./company-seats.cjs');
const APPLICATIONS = ['PZTS', 'EPS', 'CCTV', 'SK'];
const AMOUNTS = { monthly: 690, annual: 7286, companyMonthly: 890, companyAnnual: 9398, single: 3900, suite: 9900 };
const OFFER_TIERS = { monthly: 'pro', annual: 'pro', companyMonthly: 'company', companyAnnual: 'company' };
const PRODUCT = 'pzts_pro_monthly_v2';
class BillingError extends Error { constructor(code, message) { super(message); this.code = code; } }
const idOf = value => typeof value === 'string' ? value : value?.id;
const invoiceSubscription = invoice => idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription);
const checkoutLocale = language => ['cs', 'en', 'de', 'ru', 'pl'].includes(language) ? language : 'en';
const millis = value => value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : 0);

function createBillingService({ stripe, db, getUser, priceIds, appOrigin, serverTimestamp, now = Date.now, allowLocalHttp = false, expectedLivemode }) {
    const origin = new URL(appOrigin);
    const localHttp = allowLocalHttp && origin.protocol === 'http:' && origin.hostname === '127.0.0.1';
    if (origin.protocol !== 'https:' && !localHttp) throw new Error('APP_ORIGIN must use HTTPS');
    origin.search = ''; origin.hash = '';
    const applicationUrl = new URL(origin.pathname.replace(/\/?$/, '/'), origin).href;
    function checkMode(object) {
        if (expectedLivemode !== undefined && object?.livemode !== expectedLivemode) {
            throw new BillingError('permission-denied', 'Stripe environment mismatch.');
        }
    }
    async function verifiedUser(uid) {
        if (!uid || typeof uid !== 'string' || uid.includes('/') || uid.length > 128) throw new BillingError('unauthenticated', 'Sign in first.');
        const user = await getUser(uid);
        if (user.disabled || !user.emailVerified) throw new BillingError('failed-precondition', 'Verify your email before purchasing PRO.');
        return user;
    }
    function offerData(offer, application) {
        if (!Object.hasOwn(AMOUNTS, offer) || !APPLICATIONS.includes(application)) throw new BillingError('invalid-argument', 'Invalid product.');
        if (!priceIds[offer]?.startsWith('price_')) throw new BillingError('unavailable', 'Billing is not configured.');
        const annual = offer === 'annual' || offer === 'companyAnnual';
        return { amount: AMOUNTS[offer], priceId: priceIds[offer], interval: annual ? 'year' : 'month',
            mode: annual ? 'annual' : 'monthly', applications: APPLICATIONS };
    }
    function validPrice(price, expected) {
        return price && idOf(price) === expected.priceId && price.currency === 'eur' && price.unit_amount === expected.amount
            && price.recurring?.interval === expected.interval && price.recurring.interval_count === 1 && price.recurring.usage_type !== 'metered';
    }
    async function ownerSubscriptions(uid) { return db.collection('proSubscriptions').where('uid', '==', uid).get(); }
    async function createCheckout(uid, { offer, application, language }) {
        const user = await verifiedUser(uid);
        if (!Object.hasOwn(OFFER_TIERS, offer)) throw new BillingError('invalid-argument', 'Invalid product.');
        const tier = OFFER_TIERS[offer];
        if (tier === 'company' && (await db.collection('users').doc(uid).get()).data()?.accountType !== 'company') {
            throw new BillingError('permission-denied', 'A company account is required for company PRO.');
        }
        const expected = offerData(offer, application);
        const price = await stripe.prices.retrieve(expected.priceId);
        checkMode(price);
        if (!price?.active || !validPrice(price, expected)) throw new BillingError('failed-precondition', 'Configure the EUR price and billing interval matching the offer.');
        const owned = await ownerSubscriptions(uid);
        const records = owned.docs.map(doc => doc.data());
        if (records.some(record => ['active', 'past_due', 'incomplete', 'paused'].includes(record.status)
            && record.applications.some(app => expected.applications.includes(app)))) {
            throw new BillingError('already-exists', 'Manage your existing subscription before buying an overlapping plan.');
        }
        const customer = records.find(record => record.customerId)?.customerId;
        const metadata = { uid, offer, application, product: PRODUCT, tier, scope: 'suite-v1' };
        const returnUrl = /\/(pzts|eps|cctv|sk)\/$/i.test(new URL(applicationUrl).pathname) ? new URL('../'+application.toLowerCase()+'/',applicationUrl).href : applicationUrl;
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription', line_items: [{ price: expected.priceId, quantity: 1 }], adaptive_pricing: { enabled: false },
            client_reference_id: uid, ...(customer ? { customer } : { customer_email: user.email }),
            metadata, subscription_data: { metadata }, locale: checkoutLocale(language),
            success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?checkout=cancel`
        });
        // Stripe starts the selected billing cycle at purchase.
        return { id: session.id, url: session.url };
    }
    async function paidPeriod(subscription, expected) {
        const invoiceId = idOf(subscription.latest_invoice);
        if (!invoiceId) return null;
        const invoice = await stripe.invoices.retrieve(invoiceId);
        checkMode(invoice);
        if (invoiceSubscription(invoice) !== subscription.id || idOf(invoice.customer) !== idOf(subscription.customer)) throw new BillingError('permission-denied', 'Invoice ownership mismatch.');
        if (invoice.status !== 'paid') return null;
        const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 2 });
        const line = lines.data[0];
        const priceId = idOf(line?.pricing?.price_details?.price || line?.price);
        if (invoice.currency !== 'eur' || invoice.amount_paid !== expected.amount || invoice.total !== expected.amount
            || lines.has_more || lines.data.length !== 1 || priceId !== expected.priceId || line.quantity !== 1
            || line.amount !== expected.amount || !Number.isInteger(line.period?.start) || !Number.isInteger(line.period?.end)
            || line.period.end <= line.period.start) throw new BillingError('permission-denied', 'Invoice does not match the subscription.');
        const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid', limit: 2 });
        const paymentId = idOf(payments.data[0]?.payment?.payment_intent);
        if (payments.has_more || payments.data.length !== 1 || !paymentId) throw new BillingError('failed-precondition', 'A confirmed card payment is required.');
        const payment = await stripe.paymentIntents.retrieve(paymentId, { expand: ['latest_charge'] });
        checkMode(payment);
        if (payment.status !== 'succeeded' || payment.currency !== 'eur' || payment.amount_received !== expected.amount) return null;
        const charge = payment.latest_charge;
        const refunded = charge && typeof charge === 'object' && (charge.refunded || charge.amount_refunded >= charge.amount);
        return { invoiceId: invoice.id, paidThrough: new Date(line.period.end * 1000), periodStart: new Date(line.period.start * 1000), created: invoice.created || 0, chargeId: idOf(charge), refunded: Boolean(refunded) };
    }
    async function syncSubscription(subscriptionId, expectedUid, refundedInvoiceId) {
        if (typeof subscriptionId !== 'string' || !/^sub_[a-zA-Z0-9_]{3,240}$/.test(subscriptionId)) throw new BillingError('invalid-argument', 'Invalid subscription.');
        // Retrieve current Stripe state rather than applying potentially stale webhook snapshots.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        checkMode(subscription);
        const { uid, offer, application, product, tier } = subscription.metadata || {};
        if (product !== PRODUCT) return { ignored: true };
        if (expectedUid && uid !== expectedUid) throw new BillingError('permission-denied', 'This subscription belongs to another account.');
        const user = await verifiedUser(uid);
        const expected = offerData(offer, application);
        const item = subscription.items?.data?.[0];
        if (subscription.items.has_more || subscription.items.data.length !== 1 || item.quantity !== 1 || !validPrice(item.price, expected)) throw new BillingError('permission-denied', 'Subscription product mismatch.');
        const period = await paidPeriod(subscription, expected);
        const recordRef = db.collection('proSubscriptions').doc(subscription.id);
        const licenseRef = db.collection('cloudLicenses').doc(uid);
        const result = await db.runTransaction(async transaction => {
            const old = await transaction.get(recordRef);
            const oldLicense = await transaction.get(licenseRef);
            const all = await transaction.get(db.collection('proSubscriptions').where('uid', '==', uid));
            const previous = old.exists ? old.data() : {};
            const refunded = new Set(previous.refundedInvoices || []);
            if (refundedInvoiceId) refunded.add(refundedInvoiceId);
            if (period?.refunded) refunded.add(period.invoiceId);
            let paidThrough = previous.paidThrough || new Date(0);
            let paidInvoiceId = previous.paidInvoiceId || null;
            let periodStart = previous.periodStart || null;
            if (period && millis(period.paidThrough) >= millis(paidThrough)) {
                paidThrough = period.paidThrough; paidInvoiceId = period.invoiceId; periodStart = period.periodStart;
            }
            if (refunded.has(paidInvoiceId)) paidThrough = new Date(0);
            const status = previous.status === 'canceled' ? 'canceled' : subscription.status;
            const record = { uid, offer, application, applications: expected.applications, billingMode: expected.mode,
                tier: OFFER_TIERS[offer] === 'company' ? 'company' : tier === 'pro' ? 'pro' : 'legacy', subscriptionId, customerId: idOf(subscription.customer),
                status, cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end), paused: Boolean(subscription.pause_collection),
                paidThrough, paidInvoiceId, periodStart, refundedInvoices: [...refunded], updatedAt: serverTimestamp() };
            const records = all.docs.filter(doc => doc.id !== subscriptionId).map(doc => doc.data()); records.push(record);
            const applicationExpiresAt = {}, applicationBillingModes = {}, applicationPlans = {}, companyApplicationExpiresAt = {};
            for (const entry of records) if (['active', 'past_due'].includes(entry.status) && !entry.paused && millis(entry.paidThrough) > now()) {
                for (const app of ((entry.applications||[]).some(app=>APPLICATIONS.includes(app)) ? APPLICATIONS : [])) {
                    if (!APPLICATIONS.includes(app)) continue;
                    if (millis(entry.paidThrough) > millis(applicationExpiresAt[app])) {
                        applicationExpiresAt[app] = entry.paidThrough;
                        applicationBillingModes[app] = entry.billingMode || 'monthly';
                        applicationPlans[app] = entry.tier === 'company' ? 'company' : 'pro';
                    }
                    if (entry.tier !== 'pro' && millis(entry.paidThrough) > millis(companyApplicationExpiresAt[app])) {
                        companyApplicationExpiresAt[app] = entry.paidThrough;
                    }
                }
            }
            const applications = Object.keys(applicationExpiresAt).sort();
            const previousLicense = oldLicense.exists ? oldLicense.data() : {};
            const licenseId = previousLicense.source === 'stripe' && previousLicense.licenseId ? previousLicense.licenseId : `PZTS-PRO-${randomBytes(12).toString('hex').toUpperCase()}`;
            const license = { uid, plan: 'pro', billingMode: applicationBillingModes.PZTS || expected.mode, status: applications.length ? 'active' : 'inactive',
                paymentStatus: applications.length ? 'paid' : 'unpaid', source: 'stripe', applications, applicationExpiresAt, applicationBillingModes,
                applicationPlans, companyApplicationExpiresAt,
                expiresAt: new Date(Math.max(0, ...Object.values(applicationExpiresAt).map(millis))),
                subscriptionId, subscriptionStatus: status, cancelAtPeriodEnd: record.cancelAtPeriodEnd, billingCustomerId: record.customerId,
                licenseId, keySuffix: licenseId.slice(-8), issuedAt: previousLicense.issuedAt || serverTimestamp(), updatedAt: serverTimestamp() };
            if (previousLicense.companySeat) license.companySeat = previousLicense.companySeat;
            await syncCompanySeatPeriods(transaction, db, uid, companyApplicationExpiresAt);
            transaction.set(recordRef, record); transaction.set(licenseRef, license);
            return { active: applications.length > 0, applications, receiptEligible: Boolean(period && !refunded.has(period.invoiceId) && ['active','past_due'].includes(status) && !record.paused && millis(period.paidThrough)>now()) };
        });
        // Only new, verified successful payments receive a receipt. Access is committed first;
        // a mail error makes Stripe retry the webhook without revoking the paid entitlement.
        if (period && result.receiptEligible && !period.refunded && !refundedInvoiceId && result.active && period.chargeId
            && (subscription.metadata.scope === 'suite-v1' || period.created >= 1795297200)) {
            const receiptRef = db.collection('proPaymentReceipts').doc(period.invoiceId);
            if (!(await receiptRef.get()).exists) {
                const description = 'GooM ' + (OFFER_TIERS[offer] === 'company' ? 'COMPANY PROJECT' : 'PROJECT')
                    + ' — PZTS, EPS, CCTV, SK · ' + expected.interval + ' · '
                    + period.periodStart.toISOString().slice(0,10) + ' / ' + period.paidThrough.toISOString().slice(0,10);
                const receipt = await stripe.charges.update(period.chargeId, {receipt_email:user.email, description},
                    {idempotencyKey:'goom-suite-receipt-'+period.invoiceId});
                await db.runTransaction(async transaction => {
                    if (!(await transaction.get(receiptRef)).exists) transaction.set(receiptRef, {
                        uid, invoiceId:period.invoiceId, chargeId:period.chargeId, applications:APPLICATIONS,
                        amount:expected.amount, currency:'eur', description, receiptUrl:receipt.receipt_url||null,
                        sentAt:serverTimestamp(), livemode:Boolean(subscription.livemode)
                    });
                });
            }
        }
        delete result.receiptEligible;
        return result;
    }
    async function confirmCheckout(uid, sessionId) {
        await verifiedUser(uid);
        if (typeof sessionId !== 'string' || !/^cs_[a-zA-Z0-9_]{5,240}$/.test(sessionId)) throw new BillingError('invalid-argument', 'Invalid Checkout session.');
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        checkMode(session);
        if (session.metadata?.product !== PRODUCT || session.client_reference_id !== uid || session.metadata.uid !== uid || session.mode !== 'subscription') throw new BillingError('permission-denied', 'Checkout ownership mismatch.');
        if (session.payment_status !== 'paid' || !idOf(session.subscription)) return { active: false };
        return syncSubscription(idOf(session.subscription), uid);
    }
    async function createPortal(uid, language) {
        await verifiedUser(uid);
        const records = await ownerSubscriptions(uid);
        const customer = records.docs.map(doc => doc.data()).find(record => record.customerId)?.customerId;
        if (!customer) throw new BillingError('not-found', 'No billing account.');
        const session = await stripe.billingPortal.sessions.create({ customer, return_url: applicationUrl, locale: checkoutLocale(language) });
        return { url: session.url };
    }
    async function processEvent(event) {
        checkMode(event);
        const object = event.data.object;
        if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
            const session = await stripe.checkout.sessions.retrieve(object.id);
            if (session.metadata?.product !== PRODUCT) return { ignored: true };
            return confirmCheckout(session.metadata.uid, session.id);
        }
        if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed'].includes(event.type)) return syncSubscription(object.id);
        if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
            const invoice = await stripe.invoices.retrieve(object.id);
            const subscriptionId = invoiceSubscription(invoice);
            return subscriptionId ? syncSubscription(subscriptionId) : { ignored: true };
        }
        if (event.type === 'charge.refunded' && (object.refunded || object.amount_refunded >= object.amount)) {
            const paymentIntent = idOf(object.payment_intent);
            if (!paymentIntent) return { ignored: true };
            const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntent }, limit: 100 });
            for (const payment of payments.data) {
                const invoice = await stripe.invoices.retrieve(idOf(payment.invoice));
                const subscriptionId = invoiceSubscription(invoice);
                if (subscriptionId) await syncSubscription(subscriptionId, undefined, invoice.id);
            }
            return { refunded: true };
        }
        return { ignored: true };
    }
    return { createCheckout, confirmCheckout, createPortal, processEvent };
}
module.exports = { createBillingService, BillingError, APPLICATIONS, AMOUNTS, PRODUCT };
