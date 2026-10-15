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
