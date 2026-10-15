// End-to-end checks of the public form API, admin auth and rendering.
// Runs the app against a throwaway data directory.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vega-test-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.ADMIN_PASSWORD = 'TestPassword123';

const app = require('../server/index.js');
let server, base, cookie = '', csrf = '';

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  require('../server/store').flush();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const req = (method, url, body, headers = {}) =>
  fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', cookie, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

test('every public page renders', async () => {
  for (const p of ['/', '/about', '/programs', '/programs/cricket', '/coaches', '/schedule', '/gallery', '/news', '/admissions', '/contact', '/privacy-policy', '/credits', '/sitemap.xml']) {
    const r = await fetch(base + p);
    assert.strictEqual(r.status, 200, p);
  }
  assert.strictEqual((await fetch(base + '/no-such-page')).status, 404);
});

test('trial form validates and saves', async () => {
  let r = await req('POST', '/api/forms/trials', { name: 'A', phone: 'abc' });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.ok(j.fields.phone && j.fields.name && j.fields.program);
  r = await req('POST', '/api/forms/trials', { name: 'Kabir', phone: '+91 98765 43210', program: 'Cricket' });
  assert.strictEqual(r.status, 200);
  assert.ok((await r.json()).ref);
});

test('honeypot submissions are dropped silently', async () => {
  const r = await req('POST', '/api/forms/enquiries', { name: 'Bot', phone: '9999999999', message: 'spam spam', website: 'http://x' });
  assert.strictEqual(r.status, 200);
});

test('admin API needs a session and a CSRF token', async () => {
  assert.strictEqual((await req('GET', '/api/admin/dashboard')).status, 401);
  let r = await req('POST', '/api/admin/login', { email: 'admin@vega.local', password: 'nope' });
  assert.strictEqual(r.status, 401);
  r = await req('POST', '/api/admin/login', { email: 'admin@vega.local', password: 'TestPassword123' });
  assert.strictEqual(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  csrf = (await r.json()).csrf;
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.strictEqual((await req('GET', '/api/admin/dashboard')).status, 200);
  // A write without the CSRF header is refused.
  assert.strictEqual((await req('PUT', '/api/admin/texts', { 'home.hero.eyebrow': 'x' })).status, 403);
});

test('admin edits show up on the site, escaped', async () => {
  const h = { 'x-csrf': csrf };
  let r = await req('PUT', '/api/admin/texts', { 'home.hero.eyebrow': '<script>alert(1)</script>Hello' }, h);
  assert.strictEqual(r.status, 200);
  const html = await (await fetch(base + '/')).text();
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;Hello'));
  assert.ok(!html.includes('<script>alert(1)</script>'));

  r = await req('POST', '/api/admin/c/pages', { title: 'Summer Camp', body: '## Dates\n\n<img src=x onerror=alert(1)> Hello', published: true }, h);
  assert.strictEqual(r.status, 200);
  const page = await (await fetch(base + '/summer-camp')).text();
  assert.ok(page.includes('<h2>Dates</h2>'));
  assert.ok(!page.includes('onerror'));

  r = await req('POST', '/api/admin/c/pages', { title: 'Admin', slug: 'admin', published: true }, h);
  assert.strictEqual(r.status, 400, 'reserved slugs are refused');
});

test('submissions can be updated and exported', async () => {
  const h = { 'x-csrf': csrf };
  const list = await (await req('GET', '/api/admin/s/trials')).json();
  assert.strictEqual(list.length, 1);
  const r = await req('PATCH', `/api/admin/s/trials/${list[0].id}`, { status: 'contacted', notes: 'Called' }, h);
  assert.strictEqual((await r.json()).status, 'contacted');
  const csv = await (await req('GET', '/api/admin/s/trials/export.csv')).text();
  assert.match(csv, /Kabir/);
});

/* ------------------------------------------------ operations (v2) */

const otpFor = async (phone, purpose) => {
  const s = await (await req('POST', '/api/otp/send', { phone, purpose })).json();
  const v = await (await req('POST', '/api/otp/verify', { otpId: s.otpId, code: s.demoCode })).json();
  return v.token;
};

test('trial booking picks a real session and confirms it', async () => {
  const { slots } = await (await req('GET', '/api/trial-slots?program=Cricket')).json();
  assert.ok(slots.length > 0);
  const r = await req('POST', '/api/forms/trials', { name: 'Slot Kid', phone: '9800000001', program: 'Cricket', batch: slots[0].batchId, date: slots[0].date });
  assert.strictEqual(r.status, 200);
  assert.match((await r.json()).message, /Booked!/);
  const bad = await req('POST', '/api/forms/trials', { name: 'Slot Kid', phone: '9800000001', program: 'Cricket', batch: slots[0].batchId, date: '2000-01-01' });
  assert.strictEqual(bad.status, 400);
});

test('admission for a minor needs a verified parent phone (DPDP)', async () => {
  const body = { student: 'Minor Kid', dob: '2014-05-05', guardian: 'Parent Kid', phone: '9800000002', program: 'Football', consent: true };
  let r = await req('POST', '/api/forms/admissions', body);
  assert.strictEqual(r.status, 400);
  assert.ok((await r.json()).fields.otp);
  const otpToken = await otpFor('9800000002', 'consent');
  r = await req('POST', '/api/forms/admissions', { ...body, otpToken });
  assert.strictEqual(r.status, 200);
  const list = await (await req('GET', '/api/admin/s/admissions')).json();
  assert.strictEqual(list[0].consent.method, 'otp');
});

test('a full batch puts the admission on the waiting list', async () => {
  const batches = await (await req('GET', '/api/admin/c/batches')).json();
  const b = batches[0];
  await req('PUT', `/api/admin/c/batches/${b.id}`, { ...b, seatsLeft: 0 }, { 'x-csrf': csrf });
  const otpToken = await otpFor('9800000003', 'consent');
  const r = await req('POST', '/api/forms/admissions', { student: 'Wait Kid', dob: '2013-01-01', guardian: 'Wait Parent', phone: '9800000003', program: 'Cricket', batch: b.id, consent: true, otpToken });
  assert.strictEqual((await r.json()).status, 'waitlist');
});

test('facility booking holds the slot, blocks double booking and confirms on payment', async () => {
  const page = await (await fetch(base + '/book')).text();
  const rid = /name="resource" value="([^"]+)"/.exec(page)[1];
  const d = new Date(Date.now() + 330 * 60e3 + 2 * 864e5).toISOString().slice(0, 10);
  const { slots } = await (await req('GET', `/api/booking/slots?resource=${rid}&date=${d}`)).json();
  const free = slots.filter((s) => s.free);
  let r = await req('POST', '/api/booking', { resourceId: rid, date: d, starts: [free[0].start, free[1].start], name: 'Court User', phone: '9800000004' });
  const bk = await r.json();
  assert.strictEqual(r.status, 200);
  r = await req('POST', '/api/booking', { resourceId: rid, date: d, starts: [free[1].start], name: 'Other User', phone: '9800000005' });
  assert.strictEqual(r.status, 409);
  r = await req('POST', '/api/booking', { resourceId: rid, date: d, starts: [free[4].start, free[6].start], name: 'Gap User', phone: '9800000006' });
  assert.strictEqual(r.status, 400, 'slots must be next to each other');
  const order = await (await req('POST', '/api/pay/order', { invoiceId: bk.invoiceId, token: bk.token })).json();
  assert.strictEqual(order.provider, 'demo');
  assert.strictEqual(order.amount, bk.amount * 100);
  r = await req('POST', '/api/pay/demo', { paymentId: order.paymentId });
  assert.strictEqual(r.status, 200);
  const all = await (await req('GET', '/api/admin/ops/bookings')).json();
  assert.strictEqual(all.bookings.find((x) => x.id === bk.bookingId).status, 'confirmed');
  // A forged Razorpay signature is rejected.
  r = await req('POST', '/api/pay/verify', { paymentId: order.paymentId, razorpay_order_id: order.orderId, razorpay_payment_id: 'x', razorpay_signature: 'y' });
  assert.strictEqual(r.status, 400);
});

test('GST and sibling discount on monthly invoices', async () => {
  const h = { 'x-csrf': csrf };
  await req('PUT', '/api/admin/settings', { gstin: '08ABCDE1234F1Z5', gstRate: 18, pricesIncludeGst: true }, h);
  const r = await req('POST', '/api/admin/ops/invoices/generate', { period: '2030-01' }, h);
  assert.ok((await r.json()).count >= 3);
  const invs = (await (await req('GET', '/api/admin/ops/invoices')).json()).filter((i) => i.period === '2030-01');
  const sib = invs.find((i) => i.discount);
  assert.ok(sib, 'a family with two children gets the sibling discount');
  assert.strictEqual(Math.round((sib.subtotal - sib.discount.amount) * 100) / 100, sib.total);
  assert.strictEqual(Math.round((sib.gst.taxable + sib.gst.cgst + sib.gst.sgst) * 100) / 100, sib.total);
  // Running it again does not double-bill.
  const again = await (await req('POST', '/api/admin/ops/invoices/generate', { period: '2030-01' }, h)).json();
  assert.strictEqual(again.count, 0);
});

test('parent portal: sign in, own data only, consent needs CSRF', async () => {
  let r = await fetch(base + '/portal/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: 'parent@vega.local', password: 'Parent@12345' }) });
  assert.strictEqual(r.status, 200);
  const pc = r.headers.get('set-cookie').split(';')[0];
  const home = await (await fetch(base + '/portal', { headers: { cookie: pc } })).text();
  const kid = /\/portal\/child\/([^"]+)"/.exec(home)[1];
  const pcsrf = /name="csrf" content="([^"]+)"/.exec(home)[1];
  assert.strictEqual((await fetch(base + '/portal/child/' + kid, { headers: { cookie: pc } })).status, 200);
  // Another family's child is not visible.
  const students = await (await req('GET', '/api/admin/ops/students')).json();
  const other = students.find((s) => s.family.email !== 'parent@vega.local');
  assert.strictEqual((await fetch(base + '/portal/child/' + other.id, { headers: { cookie: pc } })).status, 404);
  const post = (body, extra = {}) => fetch(base + '/portal/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: pc, ...extra }, body: JSON.stringify(body) });
  assert.strictEqual((await post({ type: 'photo', studentId: kid, granted: false })).status, 403);
  assert.strictEqual((await post({ type: 'photo', studentId: kid, granted: false }, { 'x-csrf': pcsrf })).status, 200);
});

test('QR check-in marks attendance', async () => {
  const students = await (await req('GET', '/api/admin/ops/students')).json();
  const st = students.find((s) => s.batchIds.length);
  const r = await req('POST', '/api/admin/ops/attendance/scan', { code: st.code }, { 'x-csrf': csrf });
  assert.strictEqual(r.status, 200);
  assert.ok(['present', 'late'].includes((await r.json()).status));
  assert.strictEqual((await req('POST', '/api/admin/ops/attendance/scan', { code: 'NOPE' }, { 'x-csrf': csrf })).status, 404);
});

test('privacy erasure removes personal data but keeps invoices anonymised', async () => {
  const otpToken = await otpFor('9876500003', 'privacy');
  let r = await req('POST', '/api/privacy-request', { type: 'erasure', name: 'Priya Sharma', phone: '+91 98765 00003', otpToken });
  assert.strictEqual(r.status, 200);
  const reqs = await (await req('GET', '/api/admin/ops/privacy')).json();
  r = await req('POST', `/api/admin/ops/privacy/${reqs[0].id}/erase`, {}, { 'x-csrf': csrf });
  assert.strictEqual(r.status, 200);
  const students = await (await req('GET', '/api/admin/ops/students')).json();
  assert.ok(!students.some((s) => s.family.phone === '+91 98765 00003'));
  const invs = await (await req('GET', '/api/admin/ops/invoices')).json();
  assert.ok(invs.some((i) => i.billTo.name === 'Erased (DPDP request)'));
});
