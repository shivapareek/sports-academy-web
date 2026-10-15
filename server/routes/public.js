// Public JSON API: forms, trial slots, one-time codes, facility booking,
// payments (Razorpay + demo) and privacy requests.
const express = require('express');
const store = require('../store');
const schema = require('../schema');
const auth = require('../auth');
const content = require('../content');
const notify = require('../notify');
const academy = require('../academy');
const billing = require('../billing');
const payments = require('../payments');
const otp = require('../otp');

const router = express.Router();
const db = () => store.get();

const formLimiter = auth.rateLimit('form', 12, 15 * 60e3);
const otpLimiter = auth.rateLimit('otp', 6, 15 * 60e3);
const payLimiter = auth.rateLimit('pay', 30, 15 * 60e3);

const LIMITS = { name: 80, student: 80, guardian: 80, phone: 20, email: 120, age: 10, program: 80, batch: 40, plan: 60, date: 10, time: 5, dob: 10, gender: 20, topic: 60, experience: 400, medical: 600, message: 2000, photoConsent: 5 };

function readForm(type, body) {
  const out = {};
  for (const key of schema.submissions[type].fields) {
    out[key] = String(body[key] == null ? '' : body[key]).replace(/\s+/g, ' ').trim().slice(0, LIMITS[key] || 200);
  }
  return out;
}
const validPhone = (p) => /^[+\d][\d\s-]{7,18}$/.test(p);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function isAdult(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return false;
  d.setFullYear(d.getFullYear() + 18);
  return d <= new Date();
}

function log(action, detail) {
  db().activity.unshift({ at: new Date().toISOString(), user: 'website', action, detail: String(detail || '').slice(0, 200) });
  db().activity.length = Math.min(db().activity.length, 500);
}

/* ------------------------------------------------------------- forms */

router.post('/forms/:type', formLimiter, (req, res) => {
  const type = req.params.type;
  if (!schema.submissions[type]) return res.status(404).json({ error: 'Unknown form.' });
  const body = req.body || {};
  if (body.website) return res.json({ ok: true }); // honeypot
  const s = db().settings;
  if (type === 'admissions' && !s.admissionsOpen) return res.status(400).json({ error: 'Admissions are closed right now.' });
  if (type === 'trials' && !s.trialsOpen) return res.status(400).json({ error: 'Trial booking is paused right now.' });
  const data = readForm(type, body);
  const errors = {};
  let batch = null;

  if (type === 'subscribers') {
    if (!validEmail(data.email)) errors.email = 'Enter a valid email address.';
    else if (db().subscribers.some((x) => x.email.toLowerCase() === data.email.toLowerCase())) return res.json({ ok: true, message: 'You are already subscribed. Thank you!' });
  } else {
    const nameKey = type === 'admissions' ? 'student' : 'name';
    if (data[nameKey].length < 2) errors[nameKey] = 'Please enter a name.';
    if (!validPhone(data.phone)) errors.phone = 'Enter a valid phone number.';
    if (data.email && !validEmail(data.email)) errors.email = 'Enter a valid email address.';
    if (type === 'trials') {
      if (!data.program) errors.program = 'Choose a sport.';
      if (data.batch) {
        batch = db().batches.find((b) => b.id === data.batch);
        const slot = batch && academy.trialSlots(batch.program).find((x) => x.batchId === batch.id && x.date === data.date);
        if (!slot) errors.date = 'Pick one of the available sessions.';
        else if (!slot.left) errors.date = 'That session just filled up. Please pick another.';
        else data.time = batch.start;
      }
    }
    if (type === 'admissions') {
      const adult = isAdult(data.dob);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) errors.dob = 'Enter the date of birth.';
      if (data.guardian.length < 2 && !adult) errors.guardian = 'A parent or guardian name is needed for athletes under 18.';
      if (!data.program) errors.program = 'Choose a program.';
      if (body.consent !== true && body.consent !== 'on') errors.consent = 'Please accept the privacy policy to continue.';
      if (data.batch) batch = db().batches.find((b) => b.id === data.batch) || null;
      // DPDP: verifiable consent of the parent for a child's data.
      if (!adult && s.verifyParentConsent && !errors.phone && !otp.checkToken(body.otpToken, data.phone, 'consent')) {
        errors.otp = 'Please verify the parent’s mobile number with the code we send.';
      }
    }
    if (type === 'enquiries' && data.message.length < 5) errors.message = 'Please write a short message.';
  }
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors });

  const record = { id: store.id(type[0] + '_'), ...data, status: 'new', notes: '', createdAt: new Date().toISOString() };
  let message = content.text('form.success');
  if (type === 'trials' && batch) {
    record.batchId = batch.id;
    record.batch = batch.name;
    record.status = 'scheduled';
  }
  if (type === 'admissions') {
    record.photoConsent = body.photoConsent === true || body.photoConsent === 'on';
    record.consent = { type: 'data', version: s.consentVersion, granted: true, method: otp.checkToken(body.otpToken, data.phone, 'consent') ? 'otp' : 'checkbox', phone: data.phone, at: record.createdAt, ip: req.ip };
    if (batch) {
      record.batchId = batch.id;
      record.batch = batch.name;
      if (academy.seatsLeft(batch) === 0) record.status = 'waitlist';
    }
  }
  db()[type].unshift(record);
  log(`New ${schema.submissions[type].label.toLowerCase()} submission`, data.name || data.student || data.email);
  store.save();

  // Messages: staff get every lead; the parent gets a confirmation.
  const link = notify.publicUrl(req) + '/admin/#/s/' + type;
  const ref = record.id.slice(-6).toUpperCase();
  if (type === 'trials') {
    const when = batch ? `${academy.humanDate(record.date)}, ${academy.time12(batch.start)}` : record.date ? academy.humanDate(record.date) : 'a day that suits you (we will call to fix the time)';
    notify.staff('lead.staff', { type: 'free trial', name: data.name, phone: data.phone, program: data.program, details: `When: ${when}${batch ? ` · ${batch.name}` : ''}`, link });
    notify.send('trial.confirm', { phone: data.phone, email: data.email }, { name: data.name, program: data.program, when, venue: batch ? batch.venue : db().settings.city, ref });
    if (batch) message = `Booked! Your free ${data.program} trial is on ${when}. We have sent the details to your WhatsApp.`;
  } else if (type === 'admissions') {
    notify.staff('lead.staff', { type: record.status === 'waitlist' ? 'admission (waiting list)' : 'admission', name: data.student, phone: data.phone, program: data.program, details: `Guardian: ${data.guardian} · Batch: ${record.batch || 'any'}`, link });
    if (record.status === 'waitlist') {
      const position = academy.waitlistFor(batch.id).length;
      notify.send('waitlist.joined', { phone: data.phone, email: data.email }, { name: data.guardian || data.student, student: data.student, batch: batch.name, position });
      message = `${batch.name} is full right now, so ${data.student} is on the waiting list at #${position}. We will message you the moment a seat opens.`;
    } else {
      notify.send('admission.received', { phone: data.phone, email: data.email }, { name: data.guardian || data.student, student: data.student, program: data.program, ref });
    }
  } else if (type === 'enquiries') {
    notify.staff('lead.staff', { type: 'enquiry', name: data.name, phone: data.phone, program: data.topic, details: data.message, link });
  }
  res.json({ ok: true, message, ref, status: record.status });
});

/* -------------------------------------------------------- trial slots */

router.get('/trial-slots', (req, res) => {
  const p = content.list('programs').find((x) => x.name === req.query.program || x.slug === req.query.program || x.id === req.query.program);
  if (!p) return res.json({ slots: [] });
  res.json({ slots: academy.trialSlots(p.id) });
});

/* ------------------------------------------------------------- codes */

router.post('/otp/send', otpLimiter, (req, res) => {
  const { phone, email, purpose } = req.body || {};
  if (!['consent', 'privacy'].includes(purpose)) return res.status(400).json({ error: 'Unknown purpose.' });
  try {
    const r = otp.sendCode({ phone, email, purpose });
    res.json({ ok: true, otpId: r.otpId, demoCode: r.demoCode, message: r.demoCode ? `Demo mode (no WhatsApp/email configured): your code is ${r.demoCode}` : 'We sent a 6-digit code to your WhatsApp' + (email ? ' and email.' : '.') });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/otp/verify', otpLimiter, (req, res) => {
  try {
    const token = otp.verifyCode(req.body.otpId, req.body.code);
    res.json({ ok: true, token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ------------------------------------------------------------ booking */

router.get('/booking/slots', (req, res) => {
  const r = content.list('resources').find((x) => x.id === req.query.resource);
  const date = String(req.query.date || '');
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Pick a facility and a date.' });
  const max = academy.addDays(academy.today(), Number(db().settings.bookingDaysAhead) || 14);
  if (date < academy.today() || date > max) return res.json({ slots: [], note: 'Bookings open ' + (Number(db().settings.bookingDaysAhead) || 14) + ' days ahead.' });
  res.json({ slots: academy.slotsFor(r, date), rate: r.rate, slotMinutes: Number(r.slotMinutes) || 60 });
});

router.post('/booking', formLimiter, (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  const r = content.list('resources').find((x) => x.id === b.resourceId);
  if (!r) return res.status(400).json({ error: 'Pick a facility.' });
  const errors = {};
  const name = String(b.name || '').trim().slice(0, 80);
  const phone = String(b.phone || '').trim().slice(0, 20);
  const email = String(b.email || '').trim().slice(0, 120);
  if (name.length < 2) errors.name = 'Please enter your name.';
  if (!validPhone(phone)) errors.phone = 'Enter a valid phone number.';
  if (email && !validEmail(email)) errors.email = 'Enter a valid email address.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors });
  const date = String(b.date || '');
  const max = academy.addDays(academy.today(), Number(db().settings.bookingDaysAhead) || 14);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < academy.today() || date > max) return res.status(400).json({ error: 'Pick a date within the booking window.' });
  const starts = (Array.isArray(b.starts) ? b.starts : []).map(String).sort();
  if (!starts.length || starts.length > 4) return res.status(400).json({ error: 'Pick 1 to 4 slots.' });
  const slots = academy.slotsFor(r, date);
  const picked = starts.map((st) => slots.find((x) => x.start === st));
  if (picked.some((x) => !x || !x.free)) return res.status(409).json({ error: 'Someone just booked one of those slots. Please pick again.' });
  for (let i = 1; i < picked.length; i++) if (picked[i].start !== picked[i - 1].end) return res.status(400).json({ error: 'Pick slots next to each other.' });
  const amount = Number(r.rate) * picked.length;
  const ref = 'BK' + store.id('').slice(0, 6).toUpperCase();
  const bk = { id: store.id('bk_'), ref, resourceId: r.id, date, start: picked[0].start, end: picked[picked.length - 1].end, slots: picked.length, name, phone, email, amount, status: 'pending', holdUntil: Date.now() + (Number(db().settings.bookingHoldMinutes) || 10) * 60e3, createdAt: new Date().toISOString() };
  db().bookings.unshift(bk);
  const inv = billing.createInvoice({
    kind: 'booking',
    billTo: { name, phone, email },
    lines: [{ label: `${r.name} · ${academy.humanDate(date)} · ${academy.time12(bk.start)}–${academy.time12(bk.end)} (${picked.length} × ₹${r.rate})`, amount }],
    dueDate: date,
    bookingId: bk.id,
  });
  bk.invoiceId = inv.id;
  log('New facility booking (awaiting payment)', `${r.name} · ${date} ${bk.start}`);
  store.save();
  res.json({ ok: true, bookingId: bk.id, ref, invoiceId: inv.id, token: inv.token, amount, holdMinutes: Number(db().settings.bookingHoldMinutes) || 10 });
});

/* ----------------------------------------------------------- payments */

// Who may pay an invoice: anyone with its token, its family's portal session, or staff.
function invoiceFor(req) {
  const inv = (db().invoices || []).find((i) => i.id === (req.body.invoiceId || req.query.invoiceId));
  if (!inv) return null;
  if (req.body.token && req.body.token === inv.token) return inv;
  if (req.parent && req.parent.id === inv.familyId) return inv;
  return null;
}

router.post('/pay/order', payLimiter, async (req, res) => {
  const inv = invoiceFor(req);
  if (!inv) return res.status(404).json({ error: 'Invoice not found.' });
  if (inv.status !== 'unpaid') return res.status(400).json({ error: inv.status === 'paid' ? 'This invoice is already paid.' : 'This invoice can no longer be paid.' });
  if (inv.kind === 'booking') {
    const bk = db().bookings.find((x) => x.id === inv.bookingId);
    if (!bk || bk.status !== 'pending') return res.status(400).json({ error: 'This booking hold has expired. Please book again.' });
  }
  try {
    const rec = await payments.createOrder(inv.total, { kind: 'invoice', id: inv.id }, { number: inv.number });
    const s = db().settings;
    res.json({ ...payments.publicConfig(), paymentId: rec.id, orderId: rec.orderId, amount: Math.round(inv.total * 100), currency: 'INR', name: s.name, description: inv.number, prefill: { name: inv.billTo.name, contact: inv.billTo.phone, email: inv.billTo.email } });
  } catch (e) {
    res.status(502).json({ error: 'Could not start the payment: ' + e.message });
  }
});

function settle(rec, providerPaymentId, method, req) {
  rec.status = 'paid';
  rec.paymentId = providerPaymentId;
  rec.paidAt = new Date().toISOString();
  const inv = (db().invoices || []).find((i) => i.id === rec.purpose.id);
  billing.applyPayment(inv, { provider: rec.provider, id: providerPaymentId, orderId: rec.orderId, method }, req);
  log('Payment received', `${inv ? inv.number : ''} · ₹${rec.amount}`);
  store.save();
  return inv;
}

router.post('/pay/verify', payLimiter, (req, res) => {
  const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const rec = (db().payments || []).find((p) => p.id === paymentId && p.orderId === razorpay_order_id);
  if (!rec) return res.status(404).json({ error: 'Payment not found.' });
  if (!payments.verifyCheckout({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
    return res.status(400).json({ error: 'Payment could not be verified. If money was deducted, it will be confirmed automatically or refunded.' });
  }
  const inv = rec.status === 'paid' ? db().invoices.find((i) => i.id === rec.purpose.id) : settle(rec, razorpay_payment_id, 'Razorpay', req);
  res.json({ ok: true, invoiceId: inv.id, token: inv.token });
});

// Demo checkout, only when no Razorpay keys are configured.
router.post('/pay/demo', payLimiter, (req, res) => {
  if (payments.provider() !== 'demo') return res.status(403).json({ error: 'Demo payments are disabled.' });
  const rec = (db().payments || []).find((p) => p.id === req.body.paymentId);
  if (!rec) return res.status(404).json({ error: 'Payment not found.' });
  const inv = rec.status === 'paid' ? db().invoices.find((i) => i.id === rec.purpose.id) : settle(rec, 'pay_demo_' + store.id('').slice(0, 10), String(req.body.method || 'UPI').slice(0, 20), req);
  res.json({ ok: true, invoiceId: inv.id, token: inv.token });
});

// Razorpay webhook (set the URL to /api/pay/webhook in the Razorpay dashboard).
router.post('/pay/webhook', (req, res) => {
  if (!payments.verifyWebhook(req.rawBody, req.get('x-razorpay-signature'))) return res.status(400).end();
  const ev = req.body || {};
  const p = ev.payload || {};
  try {
    if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
      const pay = p.payment && p.payment.entity;
      const rec = pay && (db().payments || []).find((x) => x.orderId === pay.order_id);
      if (rec && rec.status !== 'paid') settle(rec, pay.id, pay.method || 'Razorpay', req);
    }
    if (ev.event === 'subscription.charged') {
      const sub = p.subscription && p.subscription.entity;
      const pay = p.payment && p.payment.entity;
      const fam = sub && (db().families || []).find((f) => f.autopay && f.autopay.subscriptionId === sub.id);
      if (fam && pay && !(db().payments || []).some((x) => x.paymentId === pay.id)) {
        fam.autopay.status = 'active';
        const inv = (db().invoices || []).filter((i) => i.familyId === fam.id && i.status === 'unpaid' && i.kind === 'fee').sort((a, b) => a.date.localeCompare(b.date))[0];
        const rec = { id: store.id('pay_'), provider: 'razorpay', amount: pay.amount / 100, purpose: { kind: 'invoice', id: inv ? inv.id : '' }, status: 'paid', paymentId: pay.id, createdAt: new Date().toISOString() };
        db().payments.unshift(rec);
        if (inv) billing.applyPayment(inv, { provider: 'razorpay', id: pay.id, method: 'UPI AutoPay' }, req);
      }
    }
    if (['subscription.activated', 'subscription.authenticated'].includes(ev.event)) {
      const sub = p.subscription && p.subscription.entity;
      const fam = sub && (db().families || []).find((f) => f.autopay && f.autopay.subscriptionId === sub.id);
      if (fam) fam.autopay.status = 'active';
    }
    if (['subscription.halted', 'subscription.cancelled', 'subscription.completed'].includes(ev.event)) {
      const sub = p.subscription && p.subscription.entity;
      const fam = sub && (db().families || []).find((f) => f.autopay && f.autopay.subscriptionId === sub.id);
      if (fam) fam.autopay = { status: 'off', endedAt: new Date().toISOString(), reason: ev.event };
    }
    store.save();
  } catch (e) {
    console.error('webhook', e);
  }
  res.json({ ok: true });
});

/* ----------------------------------------------------- privacy (DPDP) */

router.post('/privacy-request', formLimiter, (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  const types = ['access', 'correction', 'erasure', 'withdraw-consent', 'nominate', 'grievance'];
  const errors = {};
  if (!types.includes(b.type)) errors.type = 'Choose a request type.';
  if (String(b.name || '').trim().length < 2) errors.name = 'Please enter your name.';
  if (!validPhone(String(b.phone || ''))) errors.phone = 'Enter the phone number registered with us.';
  if (!otp.checkToken(b.otpToken, b.phone, 'privacy')) errors.otp = 'Please verify your phone number first.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors });
  const rec = { id: store.id('pq_'), type: b.type, name: String(b.name).trim().slice(0, 80), phone: String(b.phone).trim().slice(0, 20), email: String(b.email || '').trim().slice(0, 120), details: String(b.details || '').slice(0, 2000), verified: true, status: 'new', notes: '', createdAt: new Date().toISOString(), due: academy.addDays(academy.today(), 30) };
  db().privacyRequests.unshift(rec);
  log('New privacy request', `${rec.type} · ${rec.name}`);
  store.save();
  notify.staff('lead.staff', { type: 'privacy request (' + rec.type + ')', name: rec.name, phone: rec.phone, program: '', details: 'Reply within 30 days.', link: notify.publicUrl(req) + '/admin/#/privacy' });
  res.json({ ok: true, message: `Request received (reference ${rec.id.slice(-6).toUpperCase()}). We will respond within 30 days.` });
});

module.exports = router;
