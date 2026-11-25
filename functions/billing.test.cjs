const { test } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { fixture } = require('./billing-fixture.cjs');
const license = f => f.documents.get('cloudLicenses/owner');
async function buy(f, offer = 'monthly', application = 'PZTS') {
    const result = offer === 'suite' ? await f.legacyCheckout('owner', offer, application) : await f.service.createCheckout('owner', { offer, application }); f.pay(result.id);
    await f.service.confirmCheckout('owner', result.id); return result.id;
}
test('990 CZK checkout creates a monthly subscription anchored at purchase, with a server price and UID', async () => {
    const f = fixture(); const { id } = await f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS', uid: 'attacker', price: 1 });
    const session = f.sessions.get(id);
    assert.equal(session.mode, 'subscription'); assert.equal(session.amount_total, 99000);
    assert.equal(session.client_reference_id, 'owner'); assert.equal(session.subscription_data.metadata.uid, 'owner');
    assert.equal(session.subscription_data.trial_period_days, undefined); assert.equal(session.subscription_data.billing_cycle_anchor, undefined);
});
test('unverified accounts cannot start checkout', async () => {
    const f = fixture(); f.setVerified(false);
    await assert.rejects(f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' }), { code: 'failed-precondition' });
});

test('checkout returns to the configured editor path on the main domain', async () => {
    const f = fixture({ appOrigin: 'https://goom.cz/pzts/?old=1#old' });
    const { id } = await f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' });
    assert.equal(f.sessions.get(id).success_url, 'https://goom.cz/pzts/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    assert.equal(f.sessions.get(id).cancel_url, 'https://goom.cz/pzts/?checkout=cancel');
});
test('checkout accepts German and Russian and defaults to English for an unsupported language', async () => {
    const f = fixture();
    for (const [language, expected] of [['de', 'de'], ['ru', 'ru'], ['invalid', 'en']]) {
        const { id } = await f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS', language });
        assert.equal(f.sessions.get(id).locale, expected);
    }
});
test('configuration rejects one-time, yearly, multi-month, metered and incorrect prices', async () => {
    for (const patch of [{ recurring: null }, { recurring: { interval: 'year', interval_count: 1 } },
        { recurring: { interval: 'month', interval_count: 2 } }, { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }, { unit_amount: 1 }, {currency:'eur'}]) {
        const f = fixture(); Object.assign(f.prices.price_monthly, patch);
        await assert.rejects(f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' }), { code: 'failed-precondition' });
    }
});
test('unpaid checkout never grants PRO', async () => {
    const f = fixture(); const { id } = await f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' });
    assert.deepEqual(await f.service.confirmCheckout('owner', id), { active: false }); assert.equal(f.documents.size, 0);
});
test('990 CZK grants the complete suite until the paid invoice period end', async () => {
    const f = fixture(); const id = await buy(f, 'monthly', 'EPS');
    assert.deepEqual(license(f).applications, ['CCTV','EPS','PZTS','SK']); assert.equal(license(f).billingMode, 'monthly');
    assert.equal(license(f).applicationExpiresAt.EPS.getTime(), f.invoices.get(f.subscriptions.get(f.sessions.get(id).subscription).latest_invoice).lines.data[0].period.end * 1000);
    assert.match(license(f).licenseId, /^PZTS-PRO-[A-F0-9]{24}$/);
});
test('legacy 99 EUR monthly suite still grants all four applications', async () => {
    const f = fixture(); await buy(f, 'suite');
    assert.deepEqual(license(f).applications, ['CCTV', 'EPS', 'PZTS', 'SK']);
});
test('annual checkout costs 10454 CZK and grants the full paid year', async () => {
    const f = fixture();
    const id = await buy(f, 'annual');
    const session = f.sessions.get(id);
    const invoice = f.invoices.get(f.subscriptions.get(session.subscription).latest_invoice);
    assert.equal(session.amount_total, 1045400);
    assert.equal(session.adaptive_pricing.enabled, false);
    assert.equal(license(f).applicationBillingModes.PZTS, 'annual');
    assert.equal(license(f).expiresAt.getTime(), invoice.lines.data[0].period.end * 1000);
    await assert.rejects(f.service.createCheckout('legacy', { offer: 'suite', application: 'PZTS' }), { code: 'invalid-argument' });
});
test('paid company seats follow the owner expiry, renewal, removal and cancellation', async () => {
    const f = fixture();
    f.documents.set('users/owner', { accountType: 'company' });
    await assert.rejects(f.seats.save('owner', ['employee@example.test']), { code: 'permission-denied' });
    const id = await buy(f, 'companyMonthly');
    assert.equal(f.sessions.get(id).amount_total, 148500);
    await assert.rejects(f.seats.save('owner', ['a@company.test', 'b@company.test', 'c@company.test', 'd@company.test']), { code: 'invalid-argument' });
    await f.seats.save('owner', ['Employee@example.test', 'colleague@example.test', 'replacement@example.test']);
    await assert.rejects(f.seats.save('owner', ['owner@example.test']), { code: 'invalid-argument' });
    assert.deepEqual(await f.seats.claim('outsider'), { linked: false });
    f.setVerified(false);
    await assert.rejects(f.seats.claim('employee'), { code: 'failed-precondition' });
    f.setVerified(true);
    assert.deepEqual(await f.seats.claim('employee'), { linked: true });
    assert.deepEqual(await f.seats.claim('colleague'), { linked: true });
    await assert.rejects(f.seats.save('employee', ['outsider@example.test']), { code: 'permission-denied' });
    const seat = uid => f.documents.get(`cloudLicenses/${uid}`).companySeat;
    assert.equal(seat('employee').ownerUid, 'owner');
    assert.deepEqual(seat('employee').applicationExpiresAt, license(f).applicationExpiresAt);
    const renewal = f.renew(id);
    await f.service.processEvent({ type: 'invoice.paid', data: { object: renewal } });
    assert.deepEqual(seat('colleague').applicationExpiresAt, license(f).applicationExpiresAt);
    await f.seats.save('owner', ['colleague@example.test']);
    assert.equal(seat('employee'), null);
    assert.deepEqual(await f.seats.claim('employee'), { linked: false });
    const subscription = f.subscriptions.get(f.sessions.get(id).subscription);
    subscription.status = 'canceled';
    await f.service.processEvent({ type: 'customer.subscription.deleted', data: { object: subscription } });
    assert.deepEqual(seat('colleague').applicationExpiresAt, {});
});
test('company annual billing requires a company profile and verifies 15681 CZK for a year', async () => {
    const f = fixture();
    await assert.rejects(f.service.createCheckout('owner', { offer: 'companyAnnual', application: 'PZTS' }), { code: 'permission-denied' });
    f.documents.set('users/owner', { accountType: 'company' });
    const id = await buy(f, 'companyAnnual');
    assert.equal(f.sessions.get(id).amount_total, 1568100);
    assert.equal(license(f).applicationBillingModes.PZTS, 'annual');
    assert.equal(license(f).applicationPlans.PZTS, 'company');
    assert.equal(license(f).companyApplicationExpiresAt.PZTS.getTime(), license(f).expiresAt.getTime());
});
test('new standard PRO does not create team seats and legacy annual subscribers retain their seats', async () => {
    const f = fixture();
    f.documents.set('users/owner', { accountType: 'company' });
    await buy(f);
    assert.equal(license(f).applicationPlans.PZTS, 'pro');
    await assert.rejects(f.seats.save('owner', ['employee@example.test']), { code: 'permission-denied' });
    const older = fixture();
    older.documents.set('users/owner', { accountType: 'company' });
    const session = await older.legacyCheckout('owner', 'annual', 'PZTS');
    older.pay(session.id);
    await older.service.confirmCheckout('owner', session.id);
    await older.seats.save('owner', ['employee@example.test']);
    assert.deepEqual(await older.seats.claim('employee'), { linked: true });
});
test('another account cannot claim a paid Checkout session', async () => {
    const f = fixture(); const id = await buy(f);
    await assert.rejects(f.service.confirmCheckout('other', id), { code: 'permission-denied' });
});
test('mismatched paid invoice amounts or product cannot activate a subscription', async () => {
    const f = fixture(); const { id } = await f.service.createCheckout('owner', { offer: 'annual', application: 'PZTS' }); f.pay(id);
    f.invoices.get(f.subscriptions.get(f.sessions.get(id).subscription).latest_invoice).amount_paid = 690;
    await assert.rejects(f.service.confirmCheckout('owner', id), { code: 'permission-denied' }); assert.equal(f.documents.size, 0);
});
test('duplicate and stale deliveries preserve the license and current subscription state', async () => {
    const f = fixture(); const id = await buy(f); const key = license(f).licenseId;
    await f.service.processEvent({ type: 'checkout.session.completed', data: { object: { id } } });
    assert.equal(f.documents.size, 3); assert.equal(license(f).licenseId, key);
});
test('invoice.paid extends access to the exact Stripe monthly period, including short months', async () => {
    const f = fixture(); const id = await buy(f);
    const invoice = f.renew(id, { start: Date.UTC(2027, 0, 31) / 1000, end: Date.UTC(2027, 1, 28) / 1000 });
    await f.service.processEvent({ type: 'invoice.paid', data: { object: invoice } });
    assert.equal(license(f).applicationExpiresAt.PZTS.toISOString(), '2027-02-28T00:00:00.000Z');
});
test('failed renewal never extends the already-paid month, and expiration removes access', async () => {
    const f = fixture(); const id = await buy(f); const expiry = license(f).expiresAt.getTime();
    const invoice = f.renew(id, { paid: false });
    await f.service.processEvent({ type: 'invoice.payment_failed', data: { object: invoice } });
    assert.equal(license(f).expiresAt.getTime(), expiry);
    f.setNow(expiry + 1);
    await f.service.processEvent({ type: 'invoice.payment_failed', data: { object: invoice } });
    assert.equal(license(f).status, 'inactive');
});
test('cancellation at period end retains paid access, subscription deletion revokes it', async () => {
    const f = fixture(); const id = await buy(f), sub = f.subscriptions.get(f.sessions.get(id).subscription);
    sub.cancel_at_period_end = true;
    await f.service.processEvent({ type: 'customer.subscription.updated', data: { object: sub } });
    assert.equal(license(f).status, 'active'); assert.equal(license(f).cancelAtPeriodEnd, true);
    sub.status = 'canceled'; await f.service.processEvent({ type: 'customer.subscription.deleted', data: { object: sub } });
    assert.equal(license(f).status, 'inactive');
});
test('refund cannot be revived by stale success, but a new paid month restores access', async () => {
    const f = fixture(); const id = await buy(f), sub = f.subscriptions.get(f.sessions.get(id).subscription);
    const invoice = f.invoices.get(sub.latest_invoice);
    await f.service.processEvent({ type: 'charge.refunded', data: { object: { payment_intent: invoice.paymentIntent, refunded: true } } });
    await f.service.confirmCheckout('owner', id); assert.equal(license(f).status, 'inactive');
    const renewal = f.renew(id); await f.service.processEvent({ type: 'invoice.paid', data: { object: renewal } });
    assert.equal(license(f).status, 'active');
});
test('one suite subscription prevents a second purchase from another program',async()=>{const f=fixture();await buy(f,'monthly','PZTS');await assert.rejects(f.service.createCheckout('owner',{offer:'monthly',application:'CCTV'}),{code:'already-exists'});});
test('an active overlapping purchase is rejected to prevent accidental duplicate subscriptions', async () => {
    const f = fixture(); await buy(f);
    await assert.rejects(f.service.createCheckout('owner', { offer: 'annual', application: 'PZTS' }), { code: 'already-exists' });
    const id = [...f.sessions.keys()][0], invoice = f.renew(id, { paid: false });
    f.setNow(invoice.lines.data[0].period.start * 1000 + 1000);
    await f.service.processEvent({ type: 'invoice.payment_failed', data: { object: invoice } });
    await assert.rejects(f.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' }), { code: 'already-exists' });
});
test('billing portal uses the authenticated owner customer only', async () => {
    const f = fixture(); await buy(f); await f.service.createPortal('owner'); assert.equal(f.portalCustomer, 'cus_owner');
    await assert.rejects(f.service.createPortal('other'), { code: 'not-found' });
});
test('Stripe signatures reject modified payloads', () => {
    const stripe = new Stripe('sk_test_unit_test'); const body = JSON.stringify({ id: 'evt_test', type: 'invoice.paid' });
    const secret = 'whsec_unit_test', signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    assert.equal(stripe.webhooks.constructEvent(body, signature, secret).id, 'evt_test');
    assert.throws(() => stripe.webhooks.constructEvent(body + ' ', signature, secret));
});
test('production mode rejects Stripe sandbox objects before issuing a license', async () => {
    const sandbox = fixture({ expectedLivemode: true });
    await assert.rejects(sandbox.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' }), { code: 'permission-denied' });
    const billing = fixture({ expectedLivemode: true, livemode: true });
    const session = await billing.service.createCheckout('owner', { offer: 'monthly', application: 'PZTS' });
    billing.pay(session.id);
    const event = { type: 'checkout.session.completed', data: { object: { id: session.id } } };
    await assert.rejects(billing.service.processEvent({ ...event, livemode: false }), { code: 'permission-denied' });
    billing.sessions.get(session.id).livemode = false;
    await assert.rejects(billing.service.confirmCheckout('owner', session.id), { code: 'permission-denied' });
    assert.equal(billing.documents.has('cloudLicenses/owner'), false);
    billing.sessions.get(session.id).livemode = true;
    assert.equal((await billing.service.processEvent({ ...event, livemode: true })).active, true);
});

test('paid receipt names all programs and is sent once across checkout and webhook retries',async()=>{
 const f=fixture();const id=await buy(f,'monthly','SK');assert.equal(f.receipts.size,1);const receipt=[...f.receipts.values()][0];assert.equal(receipt.receipt_email,'owner@example.test');assert.match(receipt.description,/PZTS, EPS, CCTV, SK/);
 await f.service.confirmCheckout('owner',id);await f.service.processEvent({type:'checkout.session.completed',data:{object:{id}}});assert.equal(f.receipts.size,1);
 const invoice=f.renew(id);await f.service.processEvent({type:'invoice.paid',data:{object:invoice}});assert.equal(f.receipts.size,2);
});
test('mail failure preserves paid access and retries the missing receipt',async()=>{
 const f=fixture();const{id}=await f.service.createCheckout('owner',{offer:'annual',application:'EPS'});f.pay(id);const send=f.stripe.charges.update;f.stripe.charges.update=async()=>{throw Error('temporary mail failure');};
 await assert.rejects(f.service.confirmCheckout('owner',id),/temporary/);assert.equal(license(f).status,'active');assert.equal(f.receipts.size,0);f.stripe.charges.update=send;await f.service.confirmCheckout('owner',id);assert.equal(f.receipts.size,1);
});
test('unpaid, refunded and historical payments never generate a new receipt',async()=>{
 const f=fixture();const{id}=await f.service.createCheckout('owner',{offer:'monthly',application:'EPS'});await f.service.confirmCheckout('owner',id);assert.equal(f.receipts.size,0);f.pay(id);const sub=f.subscriptions.get(f.sessions.get(id).subscription);const invoice=f.invoices.get(sub.latest_invoice);f.payments.get(invoice.paymentIntent).latest_charge.refunded=true;await f.service.confirmCheckout('owner',id);assert.equal(f.receipts.size,0);
 const older=fixture();older.setNow(Date.UTC(2026,0,1));const old=await older.legacyCheckout('owner','annual','PZTS');older.pay(old.id);await older.service.confirmCheckout('owner',old.id);assert.equal(older.receipts.size,0);assert.deepEqual(license(older).applications,['CCTV','EPS','PZTS','SK']);
});
test('checkout returns to the program selected while paying for the suite',async()=>{const f=fixture({appOrigin:'https://goom.cz/pzts/'});const{id}=await f.service.createCheckout('owner',{offer:'monthly',application:'SK'});assert.match(f.sessions.get(id).success_url,/goom.cz\/sk\//);});

test('a refunded old invoice cannot send a receipt while a different legacy subscription remains active',async()=>{const f=fixture();const a=await f.legacyCheckout('owner','annual','EPS'),b=await f.legacyCheckout('owner','annual','SK');f.pay(a.id);f.pay(b.id);await f.service.confirmCheckout('owner',a.id);await f.service.confirmCheckout('owner',b.id);const sub=f.subscriptions.get(a.subscription),invoice=f.invoices.get(sub.latest_invoice);await f.service.processEvent({type:'charge.refunded',data:{object:{payment_intent:invoice.paymentIntent,refunded:true}}});f.receipts.clear();f.documents.delete('proPaymentReceipts/'+invoice.id);await f.service.confirmCheckout('owner',a.id);assert.equal(license(f).status,'active');assert.equal(f.receipts.size,0);});
