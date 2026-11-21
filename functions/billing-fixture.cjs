// Local test fixture; never contacts Stripe or charges a card.
const { createBillingService, AMOUNTS, PRODUCT } = require('./billing-core.cjs');
const { createCompanySeatService } = require('./company-seats.cjs');
function fixture(overrides = {}) {
    const documents = new Map();
    const snapshot = path => ({ id: path.split('/').at(-1), exists: documents.has(path), data: () => documents.get(path) });
    const query = (name, field, value) => ({ query: true, async get() {
        return { docs: [...documents].filter(([path, data]) => path.startsWith(name + '/') && data[field] === value).map(([path]) => snapshot(path)) };
    } });
    const db = overrides.db || {
        collection(name) { return { doc: id => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`) }), where: (field, operator, value) => query(name, field, value) }; },
        async runTransaction(callback) {
            const writes = [];
            const result = await callback({ get: async ref => ref.query ? ref.get() : snapshot(ref.path),
                set(ref, data, options) { writes.push([ref.path, data, options]); },
                delete(ref) { writes.push([ref.path, null]); } });
            for (const [path, data, options] of writes) {
                if (data === null) documents.delete(path);
                else documents.set(path, structuredClone(options?.mergeFields ? { ...documents.get(path), ...data } : data));
            }
            return result;
        }
    };
    const sessions = new Map(), subscriptions = new Map(), invoices = new Map(), payments = new Map();
    const livemode = overrides.livemode ?? false;
    const prices = Object.fromEntries(Object.entries(AMOUNTS).map(([offer, amount]) => [`price_${offer}`, {
        id: `price_${offer}`, active: true, livemode, currency: 'eur', unit_amount: amount, recurring: { interval: ['annual', 'companyAnnual'].includes(offer) ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' }
    }]));
    let clock = Date.now(), verified = true, portalCustomer;
    const receipts=new Map();
    const stripe = {
        charges:{update:async(id,data,options)=>{if(!receipts.has(options.idempotencyKey))receipts.set(options.idempotencyKey,{id,...data});return {...receipts.get(options.idempotencyKey),receipt_url:"https://pay.stripe.test/receipt/"+id};}},
        prices: { retrieve: async id => prices[id] },
        subscriptions: { retrieve: async id => subscriptions.get(id) },
        invoices: { retrieve: async id => invoices.get(id), listLineItems: async id => ({ data: invoices.get(id).lines.data, has_more: false }) },
        invoicePayments: { list: async filter => ({ data: [...invoices.values()].filter(invoice => filter.invoice ? invoice.id === filter.invoice : invoice.paymentIntent === filter.payment.payment_intent)
            .filter(invoice => invoice.status === 'paid').map(invoice => ({ invoice: invoice.id, payment: { type: 'payment_intent', payment_intent: invoice.paymentIntent } })), has_more: false }) },
        paymentIntents: { retrieve: async id => payments.get(id) },
        billingPortal: { sessions: { create: async data => { portalCustomer = data.customer; return { url: 'https://billing.stripe.com/p/session/test' }; } } },
        checkout: { sessions: {
            async create(data) {
                const id = `cs_test_checkout_${sessions.size + 1}`, subId = `sub_test_${sessions.size + 1}`;
                const price = prices[data.line_items[0].price], customer = data.customer || `cus_${data.client_reference_id}`;
                const start = Math.floor(clock / 1000), end = start + (price.recurring.interval === 'year' ? 365 : 30) * 86400;
                const invoice = { id: `in_${subId}_1`, customer, livemode, parent: { subscription_details: { subscription: subId } },
                    created:Math.floor(clock/1000), status: 'open', currency: 'eur', amount_paid: 0, total: price.unit_amount,
                    lines: { data: [{ pricing: { price_details: { price: price.id } }, quantity: 1, amount: price.unit_amount, period: { start, end } }] } };
                invoices.set(invoice.id, invoice);
                subscriptions.set(subId, { id: subId, customer, livemode, metadata: data.subscription_data.metadata, status: 'incomplete', cancel_at_period_end: false,
                    latest_invoice: invoice.id, items: { data: [{ price, quantity: 1, current_period_start: start, current_period_end: end }], has_more: false } });
                const session = { ...data, id, livemode, currency: 'eur', amount_total: price.unit_amount, payment_status: 'unpaid', subscription: subId, url: `https://checkout.stripe.com/c/pay/${id}` };
                sessions.set(id, session); return session;
            }, retrieve: async id => sessions.get(id)
        } }
    };
    const getUser = overrides.getUser || (async uid => ({ uid, email: `${uid}@example.test`, emailVerified: verified }));
    const priceIds = Object.fromEntries(Object.keys(AMOUNTS).map(offer => [offer, `price_${offer}`]));
    const service = createBillingService({ stripe, db, priceIds, appOrigin: overrides.appOrigin || 'https://pzts.example.test', getUser,
        serverTimestamp: overrides.serverTimestamp || (() => 'test-timestamp'), now: () => clock, expectedLivemode: overrides.expectedLivemode });
    const seats = createCompanySeatService({ db, getUser, now: () => clock });
    const legacyCheckout = (uid, offer, application) => {
        const metadata = { uid, offer, application, product: PRODUCT };
        return stripe.checkout.sessions.create({ mode: 'subscription', client_reference_id: uid,
            metadata, subscription_data: { metadata }, line_items: [{ price: priceIds[offer] }] });
    };
    function pay(id) {
        const session = sessions.get(id), sub = subscriptions.get(session.subscription), invoice = invoices.get(sub.latest_invoice);
        session.payment_status = 'paid'; sub.status = 'active'; invoice.status = 'paid'; invoice.amount_paid = invoice.total;
        invoice.paymentIntent = `pi_${invoice.id}`;
        payments.set(invoice.paymentIntent, { status: 'succeeded', livemode, currency: 'eur', amount_received: invoice.total,
            latest_charge: { id:'ch_'+invoice.id, amount: invoice.total, amount_refunded: 0, refunded: false } });
    }
    function renew(id, { paid = true, start, end } = {}) {
        const session = sessions.get(id), sub = subscriptions.get(session.subscription), old = invoices.get(sub.latest_invoice);
        const invoice = structuredClone(old);invoice.created=Math.floor(clock/1000); invoice.id = `in_${sub.id}_${invoices.size + 1}`;
        const period = invoice.lines.data[0].period;
        period.start = start ?? period.end; period.end = end ?? period.start + 30 * 86400;
        invoice.status = 'open'; invoice.amount_paid = 0; delete invoice.paymentIntent;
        invoices.set(invoice.id, invoice); sub.latest_invoice = invoice.id; sub.status = paid ? 'active' : 'past_due';
        sub.items.data[0].current_period_start = period.start; sub.items.data[0].current_period_end = period.end;
        if (paid) pay(id); return invoice;
    }
    return { service, seats, legacyCheckout, documents, receipts, sessions, subscriptions, invoices, prices, payments, stripe, pay, renew,
        setVerified(value) { verified = value; }, setNow(value) { clock = value; }, get portalCustomer() { return portalCustomer; } };
}
module.exports = { fixture };
