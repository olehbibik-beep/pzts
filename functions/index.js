const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const Stripe = require('stripe');
const { createBillingService, BillingError } = require('./billing-core.cjs');
const { CompanySeatError } = require('./company-seats.cjs');

initializeApp();
const stripeSecret = defineSecret('STRIPE_SECRET_KEY');
const webhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const monthlyPrice = defineString('STRIPE_MONTHLY_PRICE_ID');
const annualPrice = defineString('STRIPE_ANNUAL_PRICE_ID');
const companyMonthlyPrice = defineString('STRIPE_COMPANY_MONTHLY_PRICE_ID', { default: '' });
const companyAnnualPrice = defineString('STRIPE_COMPANY_ANNUAL_PRICE_ID', { default: '' });
const singlePrice = defineString('STRIPE_SINGLE_PRICE_ID', { default: '' });
const suitePrice = defineString('STRIPE_SUITE_PRICE_ID', { default: '' });
const appOrigin = defineString('APP_ORIGIN', { default: 'https://goom.cz/pzts/' });
const region = 'europe-west1';
function service() {
    const key = stripeSecret.value();
    const localSandbox = process.env.FUNCTIONS_EMULATOR === 'true' && process.env.GCLOUD_PROJECT === 'demo-goom';
    const mode = localSandbox ? 'test' : 'live';
    if (!key?.startsWith(`sk_${mode}_`) && !key?.startsWith(`rk_${mode}_`)) {
        throw new BillingError('failed-precondition', `Stripe ${mode} configuration is required in this environment.`);
    }
    return createBillingService({ stripe: new Stripe(key), db: getFirestore(), allowLocalHttp: localSandbox, expectedLivemode: !localSandbox,
        getUser: uid => getAuth().getUser(uid), priceIds: { monthly: monthlyPrice.value(), annual: annualPrice.value(),
            companyMonthly: companyMonthlyPrice.value(), companyAnnual: companyAnnualPrice.value(),
            single: singlePrice.value(), suite: suitePrice.value() },
        appOrigin: appOrigin.value(), serverTimestamp: () => FieldValue.serverTimestamp() });
}
function publicError(error) {
    if (error instanceof BillingError || error instanceof CompanySeatError) return new HttpsError(error.code, error.message);
    logger.error('PRO billing request failed', { code: error.code || 'unknown' });
    return new HttpsError('unavailable', 'Billing is temporarily unavailable.');
}
exports.createProCheckout = onCall({ region, secrets: [stripeSecret] }, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    try { return await service().createCheckout(request.auth.uid, request.data || {}); }
    catch (error) { throw publicError(error); }
});
exports.confirmProCheckout = onCall({ region, secrets: [stripeSecret] }, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    try { return await service().confirmCheckout(request.auth.uid, request.data?.sessionId); }
    catch (error) { throw publicError(error); }
});
exports.createProPortal = onCall({ region, secrets: [stripeSecret] }, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    try { return await service().createPortal(request.auth.uid, request.data?.language); }
    catch (error) { throw publicError(error); }
});
exports.stripeProWebhook = onRequest({ region, secrets: [stripeSecret, webhookSecret] }, async (request, response) => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    let event;
    try { event = new Stripe(stripeSecret.value()).webhooks.constructEvent(request.rawBody, request.get('stripe-signature'), webhookSecret.value()); }
    catch { response.status(400).send('Invalid webhook signature'); return; }
    try { await service().processEvent(event); response.status(200).json({ received: true }); }
    catch (error) { logger.error('PRO webhook failed', { eventId: event.id, code: error.code || 'unknown' }); response.status(500).send('Retry'); }
});
