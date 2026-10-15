// Online payments through Razorpay (orders, checkout, signature checks, webhooks
// and UPI AutoPay subscriptions). Without keys the site runs in demo mode: the
// checkout is simulated so every flow can be tested end to end.
//
// Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
const crypto = require('crypto');
const store = require('./store');

const API = 'https://api.razorpay.com/v1';

function provider() {
  return process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'demo';
}

async function rzp(method, path, body) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.description) || `Razorpay error ${r.status}`);
  return j;
}

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// purpose = { kind: 'invoice' | 'booking', id }
async function createOrder(amountRupees, purpose, notes = {}) {
  const db = store.get();
  db.payments = db.payments || [];
  const paise = Math.round(Number(amountRupees) * 100);
  if (!(paise >= 100)) throw new Error('Amount must be at least ₹1.');
  const record = { id: store.id('pay_'), provider: provider(), amount: paise / 100, purpose, status: 'created', createdAt: new Date().toISOString() };
  if (provider() === 'razorpay') {
    const order = await rzp('POST', '/orders', { amount: paise, currency: 'INR', receipt: record.id, notes: { kind: purpose.kind, ref: purpose.id, ...notes } });
    record.orderId = order.id;
  } else {
    record.orderId = 'demo_order_' + crypto.randomBytes(6).toString('hex');
  }
  db.payments.unshift(record);
  store.save();
  return record;
}

function verifyCheckout({ orderId, paymentId, signature }) {
  if (provider() !== 'razorpay') return false;
  return safeEqual(hmac(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET), signature);
}

function verifySubscription({ subscriptionId, paymentId, signature }) {
  if (provider() !== 'razorpay') return false;
  return safeEqual(hmac(`${paymentId}|${subscriptionId}`, process.env.RAZORPAY_KEY_SECRET), signature);
}

function verifyWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody) return false;
  return safeEqual(hmac(rawBody, secret), signature);
}

// UPI AutoPay / card mandate: a monthly Razorpay subscription for a fixed amount.
async function createSubscription(amountRupees, family) {
  const paise = Math.round(Number(amountRupees) * 100);
  if (provider() !== 'razorpay') {
    return { id: 'demo_sub_' + crypto.randomBytes(6).toString('hex'), demo: true };
  }
  const db = store.get();
  db.rzpPlans = db.rzpPlans || {};
  let planId = db.rzpPlans[paise];
  if (!planId) {
    const plan = await rzp('POST', '/plans', { period: 'monthly', interval: 1, item: { name: `Monthly fee ₹${paise / 100}`, amount: paise, currency: 'INR' } });
    planId = db.rzpPlans[paise] = plan.id;
    store.save();
  }
  const sub = await rzp('POST', '/subscriptions', { plan_id: planId, total_count: 24, customer_notify: 1, notes: { familyId: family.id } });
  return { id: sub.id, shortUrl: sub.short_url };
}

async function cancelSubscription(id) {
  if (provider() !== 'razorpay' || !id || id.startsWith('demo_')) return;
  await rzp('POST', `/subscriptions/${id}/cancel`, { cancel_at_cycle_end: 0 });
}

function publicConfig() {
  return { provider: provider(), keyId: provider() === 'razorpay' ? process.env.RAZORPAY_KEY_ID : '' };
}

module.exports = { provider, createOrder, verifyCheckout, verifySubscription, verifyWebhook, createSubscription, cancelSubscription, publicConfig };
