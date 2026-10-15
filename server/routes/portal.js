// Parent portal: sign-in, password setup, and the JSON actions behind the
// portal pages (consents, AutoPay, password). Pages are in views/portal.js.
const crypto = require('crypto');
const express = require('express');
const store = require('../store');
const auth = require('../auth');
const notify = require('../notify');
const academy = require('../academy');
const billing = require('../billing');
const payments = require('../payments');
const views = require('../views/portal');

const COOKIE = 'vega_parent';
const DAYS = 30;
const db = () => store.get();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const attrs = (age) => `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`;

// Sets req.parent / req.parentSession on every request that carries a valid cookie.
function attach(req, res, next) {
  const token = cookies(req)[COOKIE];
  if (token) {
    const s = (db().portalSessions || []).find((x) => x.id === sha(token));
    if (s && s.expires > Date.now()) {
      const f = (db().families || []).find((x) => x.id === s.familyId && !x.deleted);
      if (f) {
        req.parent = f;
        req.parentSession = s;
      }
    }
  }
  next();
}

function startSession(res, family) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(20).toString('hex');
  db().portalSessions = (db().portalSessions || []).filter((s) => s.expires > Date.now());
  db().portalSessions.push({ id: sha(token), familyId: family.id, csrf, expires: Date.now() + DAYS * 864e5 });
  family.lastLogin = new Date().toISOString();
  store.save();
  res.setHeader('Set-Cookie', `${COOKIE}=${token}${attrs(DAYS * 86400)}`);
}

const router = express.Router();
const limiter = auth.rateLimit('portal', 10, 15 * 60e3);

function need(req, res, next) {
  if (!req.parent) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in again.' });
    return res.redirect('/portal/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}
function csrf(req, res, next) {
  if (req.get('x-csrf') !== req.parentSession.csrf) return res.status(403).json({ error: 'Session expired. Reload the page.' });
  next();
}

/* ---------------------------------------------------------- sign in */

router.get('/login', (req, res) => {
  if (req.parent) return res.redirect('/portal');
  res.type('html').send(String(views.login(req)));
});

router.post('/api/login', limiter, express.json(), (req, res) => {
  const { contact, password } = req.body || {};
  const c = String(contact || '').trim();
  const f = c.includes('@') ? academy.findFamilyByContact('', c) : academy.findFamilyByContact(c, '');
  if (!f || !f.passwordHash || !auth.verifyPassword(password || '', f.passwordHash)) {
    return res.status(401).json({ error: 'Wrong phone/email or password. First time here? Use the link we sent on WhatsApp, or tap “Forgot password”.' });
  }
  startSession(res, f);
  res.json({ ok: true });
});

router.post('/api/forgot', limiter, express.json(), (req, res) => {
  const c = String((req.body || {}).contact || '').trim();
  const f = c.includes('@') ? academy.findFamilyByContact('', c) : academy.findFamilyByContact(c, '');
  if (f) academy.sendInvite(f, req, 'portal.reset');
  // Same answer either way, so the form can't be used to discover accounts.
  res.json({ ok: true, message: 'If this number or email is registered, we have sent a reset link on WhatsApp/email.' });
});

router.get('/set-password', (req, res) => {
  res.type('html').send(String(views.setPassword(req, String(req.query.t || ''))));
});

router.post('/api/set-password', limiter, express.json(), (req, res) => {
  const { t, password } = req.body || {};
  const f = (db().families || []).find((x) => x.inviteHash && x.inviteHash === sha(String(t || '')) && x.inviteExpires > Date.now());
  if (!f) return res.status(400).json({ error: 'This link has expired. Ask the front desk for a new one, or use “Forgot password”.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  f.passwordHash = auth.hashPassword(password);
  f.inviteHash = '';
  f.inviteExpires = 0;
  db().portalSessions = (db().portalSessions || []).filter((s) => s.familyId !== f.id);
  startSession(res, f);
  res.json({ ok: true });
});

router.post('/api/logout', (req, res) => {
  const token = cookies(req)[COOKIE];
  if (token) db().portalSessions = (db().portalSessions || []).filter((s) => s.id !== sha(token));
  store.save();
  res.setHeader('Set-Cookie', `${COOKIE}=${attrs(0)}`);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ pages */

const page = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out == null) return next();
    res.type('html').send(String(out));
  } catch (e) {
    next(e);
  }
};

router.get('/', need, page((req) => views.home(req)));
router.get('/child/:id', need, page((req) => views.child(req, req.params.id)));
router.get('/report/:id', need, page((req) => views.report(req, req.params.id)));
router.get('/fees', need, page((req) => views.fees(req)));
router.get('/schedule', need, page((req) => views.schedule(req)));
router.get('/account', need, page((req) => views.account(req)));
router.get('/qr/:id.svg', need, async (req, res) => {
  const st = (db().students || []).find((s) => s.id === req.params.id && s.familyId === req.parent.id);
  if (!st) return res.status(404).end();
  const svg = await require('qrcode').toString(st.code, { type: 'svg', margin: 1, color: { dark: '#0e0e0d', light: '#ffffff' } });
  res.type('image/svg+xml').send(svg);
});

/* ------------------------------------------------------- portal API */

router.post('/api/consent', need, csrf, express.json(), (req, res) => {
  const { studentId, type, granted } = req.body || {};
  const f = req.parent;
  const entry = { type, version: db().settings.consentVersion, granted: !!granted, method: 'portal', at: new Date().toISOString(), ip: req.ip };
  if (type === 'photo') {
    const st = (db().students || []).find((s) => s.id === studentId && s.familyId === f.id);
    if (!st) return res.status(404).json({ error: 'Not found.' });
    st.photoConsent = !!granted;
    entry.studentId = st.id;
  } else if (type !== 'marketing') {
    return res.status(400).json({ error: 'Unknown consent.' });
  } else {
    f.marketingConsent = !!granted;
  }
  f.consents = f.consents || [];
  f.consents.push(entry);
  db().activity.unshift({ at: entry.at, user: 'parent:' + f.phone, action: `${granted ? 'Gave' : 'Withdrew'} ${type} consent`, detail: f.guardian });
  store.save();
  res.json({ ok: true });
});

router.post('/api/password', need, csrf, express.json(), (req, res) => {
  const { current, next } = req.body || {};
  if (!auth.verifyPassword(current || '', req.parent.passwordHash)) return res.status(400).json({ error: 'Current password is wrong.' });
  if (typeof next !== 'string' || next.length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  req.parent.passwordHash = auth.hashPassword(next);
  store.save();
  res.json({ ok: true });
});

router.post('/api/profile', need, csrf, express.json(), (req, res) => {
  const email = String((req.body || {}).email || '').trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  req.parent.email = email;
  store.save();
  res.json({ ok: true });
});

// UPI AutoPay: a monthly mandate for the family's current monthly fee.
router.post('/api/autopay/start', need, csrf, async (req, res) => {
  const f = req.parent;
  const amount = billing.monthlyFor(f.id);
  if (!amount) return res.status(400).json({ error: 'There is no monthly fee to set up yet.' });
  try {
    const sub = await payments.createSubscription(amount, f);
    f.autopay = { status: sub.demo ? 'demo-pending' : 'pending', subscriptionId: sub.id, amount, startedAt: new Date().toISOString() };
    store.save();
    res.json({ ...payments.publicConfig(), subscriptionId: sub.id, amount, name: db().settings.name, prefill: { name: f.guardian, contact: f.phone, email: f.email } });
  } catch (e) {
    res.status(502).json({ error: 'Could not start AutoPay: ' + e.message });
  }
});

router.post('/api/autopay/verify', need, csrf, express.json(), (req, res) => {
  const f = req.parent;
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
  if (!f.autopay || f.autopay.subscriptionId !== razorpay_subscription_id) return res.status(400).json({ error: 'AutoPay not found.' });
  if (!payments.verifySubscription({ subscriptionId: razorpay_subscription_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) return res.status(400).json({ error: 'Could not verify the mandate.' });
  f.autopay.status = 'active';
  f.autopay.activatedAt = new Date().toISOString();
  store.save();
  res.json({ ok: true });
});

router.post('/api/autopay/demo', need, csrf, (req, res) => {
  if (payments.provider() !== 'demo') return res.status(403).json({ error: 'Demo mode is off.' });
  const f = req.parent;
  if (!f.autopay || f.autopay.status !== 'demo-pending') return res.status(400).json({ error: 'Start AutoPay first.' });
  f.autopay.status = 'active';
  f.autopay.activatedAt = new Date().toISOString();
  store.save();
  res.json({ ok: true });
});

router.post('/api/autopay/cancel', need, csrf, async (req, res) => {
  const f = req.parent;
  try {
    await payments.cancelSubscription(f.autopay && f.autopay.subscriptionId);
  } catch (e) {
    return res.status(502).json({ error: 'Could not cancel with the bank: ' + e.message });
  }
  f.autopay = { status: 'off', endedAt: new Date().toISOString(), reason: 'cancelled by parent' };
  store.save();
  res.json({ ok: true });
});

module.exports = { router, attach };
