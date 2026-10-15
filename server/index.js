// Vega Sports Academy: public site, form API and admin CMS in one Express app.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const store = require('./store');
const { seed } = require('./seed');
const auth = require('./auth');
const schema = require('./schema');
const texts = require('./texts');
const content = require('./content');
const views = require('./views');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'));
const PORT = Number(process.env.PORT) || 3000;

store.load(seed);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const staticOpts = { maxAge: '7d', index: false };
app.use('/css', express.static(path.join(ROOT, 'public', 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(ROOT, 'public', 'js'), { maxAge: '1h' }));
app.use('/img', express.static(path.join(ROOT, 'public', 'img'), { ...staticOpts, maxAge: '30d' }));
app.use('/vendor', express.static(path.join(ROOT, 'public', 'vendor'), { ...staticOpts, maxAge: '30d' }));
app.use('/uploads', express.static(UPLOAD_DIR, { ...staticOpts, maxAge: '30d', setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'") }));
app.use('/admin', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('Cache-Control', 'no-store');
  next();
}, express.static(path.join(ROOT, 'admin'), { index: 'index.html' }));
app.get('/favicon.ico', (req, res) => res.redirect(301, '/img/favicon.svg'));

app.use(express.json({ limit: '1mb' }));

function log(user, action, detail = '') {
  const db = store.get();
  db.activity.unshift({ at: new Date().toISOString(), user: user ? user.email : 'website', action, detail: String(detail).slice(0, 200) });
  db.activity.length = Math.min(db.activity.length, 500);
}

// ---------------------------------------------------------------- forms ---

const FORM_LIMITS = { name: 80, student: 80, guardian: 80, phone: 20, email: 120, age: 10, program: 80, batch: 120, plan: 60, date: 10, dob: 10, gender: 20, topic: 60, experience: 400, medical: 600, message: 2000 };
const formLimiter = auth.rateLimit('form', 12, 15 * 60e3);

function readForm(type, body) {
  const out = {};
  for (const key of schema.submissions[type].fields) {
    out[key] = String(body[key] == null ? '' : body[key]).replace(/\s+/g, key === 'message' || key === 'medical' ? ' ' : ' ').trim().slice(0, FORM_LIMITS[key] || 200);
  }
  return out;
}

function validPhone(p) {
  return /^[+\d][\d\s-]{7,18}$/.test(p);
}
function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

app.post('/api/forms/:type', formLimiter, (req, res) => {
  const type = req.params.type;
  if (!schema.submissions[type]) return res.status(404).json({ error: 'Unknown form.' });
  const body = req.body || {};
  // Honeypot: real people never fill the hidden "website" field.
  if (body.website) return res.json({ ok: true });
  const db = store.get();
  const s = db.settings;
  if (type === 'admissions' && !s.admissionsOpen) return res.status(400).json({ error: 'Admissions are closed right now.' });
  if (type === 'trials' && !s.trialsOpen) return res.status(400).json({ error: 'Trial booking is paused right now.' });
  const data = readForm(type, body);
  const errors = {};
  if (type === 'subscribers') {
    if (!validEmail(data.email)) errors.email = 'Enter a valid email address.';
    if (db.subscribers.some((x) => x.email.toLowerCase() === data.email.toLowerCase())) return res.json({ ok: true, message: 'You are already subscribed. Thank you!' });
  } else {
    const nameKey = type === 'admissions' ? 'student' : 'name';
    if (data[nameKey].length < 2) errors[nameKey] = 'Please enter a name.';
    if (!validPhone(data.phone)) errors.phone = 'Enter a valid phone number.';
    if (data.email && !validEmail(data.email)) errors.email = 'Enter a valid email address.';
    if (type === 'admissions') {
      if (data.guardian.length < 2 && !isAdult(data.dob)) errors.guardian = 'A parent or guardian name is needed for athletes under 18.';
      if (!data.program) errors.program = 'Choose a program.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) errors.dob = 'Enter the date of birth.';
      if (body.consent !== true && body.consent !== 'on') errors.consent = 'Please accept the terms to continue.';
    }
    if (type === 'trials' && !data.program) errors.program = 'Choose a sport.';
    if (type === 'enquiries' && data.message.length < 5) errors.message = 'Please write a short message.';
  }
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors });
  const record = { id: store.id(type[0] + '_'), ...data, status: 'new', notes: '', createdAt: new Date().toISOString() };
  db[type].unshift(record);
  log(null, `New ${schema.submissions[type].label.toLowerCase()} submission`, data.name || data.student || data.email);
  store.save();
  res.json({ ok: true, message: content.text('form.success'), ref: record.id.slice(-6).toUpperCase() });
});

function isAdult(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return false;
  const eighteen = new Date(d);
  eighteen.setFullYear(d.getFullYear() + 18);
  return eighteen <= new Date();
}

// ---------------------------------------------------------------- admin ---

const admin = express.Router();
const loginLimiter = auth.rateLimit('login', 8, 15 * 60e3);

admin.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const db = store.get();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase().trim() && !u.disabled);
  if (!user || !auth.verifyPassword(password || '', user.passwordHash)) return res.status(401).json({ error: 'Wrong email or password.' });
  const csrf = auth.createSession(res, user);
  log(user, 'Signed in');
  store.save();
  res.json({ user: auth.publicUser(user), csrf });
});

admin.get('/me', (req, res) => {
  const cur = auth.currentSession(req);
  if (!cur) return res.status(401).json({ error: 'Please sign in.' });
  res.json({ user: auth.publicUser(cur.user), csrf: cur.session.csrf });
});

admin.use(auth.requireAuth);

admin.post('/logout', (req, res) => {
  auth.destroySession(req, res);
  res.json({ ok: true });
});

admin.post('/password', (req, res) => {
  const { current, next } = req.body || {};
  if (!auth.verifyPassword(current || '', req.user.passwordHash)) return res.status(400).json({ error: 'Your current password is wrong.' });
  if (!strongEnough(next)) return res.status(400).json({ error: 'Use at least 10 characters with a letter and a number.' });
  req.user.passwordHash = auth.hashPassword(next);
  req.user.mustChange = false;
  log(req.user, 'Changed password');
  store.save();
  res.json({ ok: true });
});

function strongEnough(p) {
  return typeof p === 'string' && p.length >= 10 && /[a-z]/i.test(p) && /\d/.test(p);
}

admin.get('/schema', (req, res) => {
  res.json({
    collections: schema.collections,
    submissions: schema.submissions,
    statuses: schema.STATUSES,
    settings: schema.settingsFields,
    sections: schema.sections,
    texts: texts.groups,
    roles: Object.fromEntries(Object.entries(auth.ROLES).map(([k, v]) => [k, v.label])),
  });
});

admin.get('/dashboard', (req, res) => {
  const db = store.get();
  const since = Date.now() - 7 * 864e5;
  const count = (k) => ({ total: db[k].length, new: db[k].filter((x) => x.status === 'new').length, week: db[k].filter((x) => Date.parse(x.createdAt) > since).length });
  const recent = ['trials', 'admissions', 'enquiries']
    .flatMap((k) => db[k].slice(0, 8).map((x) => ({ type: k, id: x.id, name: x.name || x.student, program: x.program || x.topic || '', status: x.status, createdAt: x.createdAt })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);
  // Submissions per day for the last 14 days.
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ day: d, count: ['trials', 'admissions', 'enquiries'].reduce((n, k) => n + db[k].filter((x) => x.createdAt.slice(0, 10) === d).length, 0) });
  }
  const seatsLeft = db.batches.filter((b) => b.published !== false).reduce((n, b) => n + (Number(b.seatsLeft) || 0), 0);
  res.json({
    trials: count('trials'),
    admissions: count('admissions'),
    enquiries: count('enquiries'),
    subscribers: db.subscribers.length,
    content: Object.fromEntries(Object.keys(schema.collections).map((k) => [k, (db[k] || []).length])),
    seatsLeft,
    recent,
    days,
    activity: db.activity.slice(0, 12),
  });
});

// Collections
admin.get('/c/:name', auth.requirePerm('content'), (req, res) => {
  const def = schema.collections[req.params.name];
  if (!def) return res.status(404).json({ error: 'Unknown collection.' });
  res.json(store.get()[req.params.name] || []);
});

admin.post('/c/:name', auth.requirePerm('content'), (req, res) => {
  const name = req.params.name;
  if (!schema.collections[name]) return res.status(404).json({ error: 'Unknown collection.' });
  const { item, errors } = content.clean(name, req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  item.id = store.id(name.slice(0, 2) + '_');
  item.updatedAt = new Date().toISOString();
  store.get()[name].push(item);
  log(req.user, `Added ${schema.collections[name].singular.toLowerCase()}`, titleOf(name, item));
  store.save();
  res.json(item);
});

admin.put('/c/:name/:id', auth.requirePerm('content'), (req, res) => {
  const name = req.params.name;
  if (!schema.collections[name]) return res.status(404).json({ error: 'Unknown collection.' });
  const arr = store.get()[name];
  const i = arr.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found. It may have been deleted.' });
  const { item, errors } = content.clean(name, req.body || {}, arr[i]);
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  item.updatedAt = new Date().toISOString();
  arr[i] = item;
  log(req.user, `Edited ${schema.collections[name].singular.toLowerCase()}`, titleOf(name, item));
  store.save();
  res.json(item);
});

admin.delete('/c/:name/:id', auth.requirePerm('content'), (req, res) => {
  const name = req.params.name;
  if (!schema.collections[name]) return res.status(404).json({ error: 'Unknown collection.' });
  const db = store.get();
  const item = db[name].find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found.' });
  if (name === 'programs' && db.batches.some((b) => b.program === item.id)) {
    return res.status(400).json({ error: 'This program still has batches. Delete or move them first.' });
  }
  db[name] = db[name].filter((x) => x.id !== item.id);
  if (name === 'coaches') db.batches.forEach((b) => b.coach === item.id && (b.coach = ''));
  log(req.user, `Deleted ${schema.collections[name].singular.toLowerCase()}`, titleOf(name, item));
  store.save();
  res.json({ ok: true });
});

admin.post('/c/:name/reorder', auth.requirePerm('content'), (req, res) => {
  const name = req.params.name;
  if (!schema.collections[name]) return res.status(404).json({ error: 'Unknown collection.' });
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const db = store.get();
  const byId = new Map(db[name].map((x) => [x.id, x]));
  const ordered = ids.map((i) => byId.get(i)).filter(Boolean);
  const rest = db[name].filter((x) => !ids.includes(x.id));
  db[name] = ordered.concat(rest);
  store.save();
  res.json({ ok: true });
});

function titleOf(name, item) {
  return item[schema.collections[name].titleField] || item.id;
}

// Page text, sections, settings
admin.get('/texts', auth.requirePerm('content'), (req, res) => res.json(store.get().texts));
admin.put('/texts', auth.requirePerm('content'), (req, res) => {
  const db = store.get();
  const body = req.body || {};
  for (const key of Object.keys(body)) {
    if (!(key in texts.defaults)) continue;
    const v = String(body[key] ?? '').slice(0, 4000);
    if (v === '' || v === texts.defaults[key]) delete db.texts[key];
    else db.texts[key] = v;
  }
  log(req.user, 'Edited page text', Object.keys(body).slice(0, 4).join(', '));
  store.save();
  res.json(db.texts);
});

admin.get('/sections', auth.requirePerm('content'), (req, res) => res.json(store.get().sections));
admin.put('/sections', auth.requirePerm('content'), (req, res) => {
  const db = store.get();
  for (const [k] of schema.sections) if (k in (req.body || {})) db.sections[k] = !!req.body[k];
  log(req.user, 'Changed home page sections');
  store.save();
  res.json(db.sections);
});

admin.get('/settings', auth.requirePerm('settings'), (req, res) => res.json(store.get().settings));
admin.put('/settings', auth.requirePerm('settings'), (req, res) => {
  const db = store.get();
  const body = req.body || {};
  for (const f of schema.settingsFields) {
    if (!(f.key in body)) continue;
    let v = body[f.key];
    if (f.type === 'bool') v = !!v;
    else if (f.type === 'lines') v = (Array.isArray(v) ? v : String(v || '').split('\n')).map((s) => String(s).trim()).filter(Boolean);
    else if (f.type === 'color') v = /^#[0-9a-f]{6}$/i.test(v) ? v : db.settings[f.key];
    else v = String(v ?? '').slice(0, 1000);
    if (/^(instagram|youtube|facebook|x|mapEmbed|announceLink)$/.test(f.key) && v && !/^(https:\/\/|\/)/.test(v)) {
      return res.status(400).json({ error: `${f.label} must start with https:// or /` });
    }
    db.settings[f.key] = v;
  }
  log(req.user, 'Changed settings');
  store.save();
  res.json(db.settings);
});

// Submissions
admin.get('/s/:type', auth.requirePerm('submissions'), (req, res) => {
  if (!schema.submissions[req.params.type]) return res.status(404).json({ error: 'Unknown list.' });
  res.json(store.get()[req.params.type]);
});

admin.patch('/s/:type/:id', auth.requirePerm('submissions'), (req, res) => {
  const list = store.get()[req.params.type];
  if (!schema.submissions[req.params.type]) return res.status(404).json({ error: 'Unknown list.' });
  const item = list.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found.' });
  if (req.body.status && schema.STATUSES.includes(req.body.status)) item.status = req.body.status;
  if (typeof req.body.notes === 'string') item.notes = req.body.notes.slice(0, 4000);
  item.updatedAt = new Date().toISOString();
  log(req.user, `Updated ${req.params.type.slice(0, -1)}`, `${item.name || item.student || item.email} → ${item.status}`);
  store.save();
  res.json(item);
});

admin.delete('/s/:type/:id', auth.requirePerm('submissions'), (req, res) => {
  const db = store.get();
  const type = req.params.type;
  if (!schema.submissions[type]) return res.status(404).json({ error: 'Unknown list.' });
  const before = db[type].length;
  db[type] = db[type].filter((x) => x.id !== req.params.id);
  if (db[type].length === before) return res.status(404).json({ error: 'Not found.' });
  log(req.user, `Deleted ${type.slice(0, -1)}`);
  store.save();
  res.json({ ok: true });
});

admin.get('/s/:type/export.csv', auth.requirePerm('submissions'), (req, res) => {
  const type = req.params.type;
  if (!schema.submissions[type]) return res.status(404).end();
  const cols = ['createdAt', ...schema.submissions[type].fields, 'status', 'notes'];
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [cols.join(',')].concat(store.get()[type].map((r) => cols.map((c) => cell(r[c])).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + rows.join('\n'));
});

// Media library
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, !!IMAGE_TYPES[file.mimetype]),
});

// Check the first bytes too, so a renamed file can't pose as an image.
function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(16);
  fs.readSync(fd, b, 0, 16, 0);
  fs.closeSync(fd);
  const hex = b.toString('hex');
  return hex.startsWith('ffd8ff') || hex.startsWith('89504e47') || hex.startsWith('47494638') || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') || b.toString('ascii', 4, 12).startsWith('ftypavi');
}

admin.get('/media', auth.requirePerm('content'), (req, res) => {
  const db = store.get();
  let bundled = [];
  try {
    bundled = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'img', 'manifest.json'), 'utf8')).map((m) => ({ url: '/img/' + m.file, name: m.file, alt: m.alt, bundled: true, credit: m.credit ? `${m.credit.author} · ${m.credit.license}` : '' }));
  } catch {}
  res.json(db.media.concat(bundled));
});

admin.post('/media', auth.requirePerm('content'), (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Images must be under 8 MB.' : 'Upload failed.' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Choose JPG, PNG, WebP, GIF or AVIF images.' });
    const db = store.get();
    const added = [];
    for (const f of files) {
      if (!looksLikeImage(f.path)) {
        fs.unlinkSync(f.path);
        continue;
      }
      const m = { id: store.id('md_'), url: '/uploads/' + f.filename, name: f.originalname.slice(0, 120), alt: '', size: f.size, uploadedAt: new Date().toISOString(), by: req.user.email };
      db.media.unshift(m);
      added.push(m);
    }
    if (!added.length) return res.status(400).json({ error: 'Those files are not valid images.' });
    log(req.user, 'Uploaded media', added.map((m) => m.name).join(', '));
    store.save();
    res.json(added);
  });
});

admin.patch('/media/:id', auth.requirePerm('content'), (req, res) => {
  const m = store.get().media.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found.' });
  m.alt = String(req.body.alt || '').slice(0, 300);
  store.save();
  res.json(m);
});

admin.delete('/media/:id', auth.requirePerm('content'), (req, res) => {
  const db = store.get();
  const m = db.media.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found.' });
  const usedIn = JSON.stringify({ ...db, media: [], activity: [] }).includes(m.url);
  if (usedIn && req.query.force !== '1') return res.status(409).json({ error: 'This image is used on the site. Delete anyway?', inUse: true });
  db.media = db.media.filter((x) => x.id !== m.id);
  const file = path.join(UPLOAD_DIR, path.basename(m.url));
  if (file.startsWith(UPLOAD_DIR) && fs.existsSync(file)) fs.unlinkSync(file);
  log(req.user, 'Deleted media', m.name);
  store.save();
  res.json({ ok: true });
});

// Users
admin.get('/users', auth.requirePerm('users'), (req, res) => res.json(store.get().users.map(auth.publicUser)));
admin.post('/users', auth.requirePerm('users'), (req, res) => {
  const db = store.get();
  const { name, email, role, password } = req.body || {};
  if (!name || !/^[^\s@]+@[^\s@]+$/.test(email || '')) return res.status(400).json({ error: 'Name and a valid email are required.' });
  if (!auth.ROLES[role]) return res.status(400).json({ error: 'Pick a role.' });
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'A user with this email exists.' });
  if (!strongEnough(password)) return res.status(400).json({ error: 'Temporary password: at least 10 characters with a letter and a number.' });
  const u = { id: store.id('u_'), name: String(name).slice(0, 80), email: email.trim(), role, passwordHash: auth.hashPassword(password), mustChange: true, createdAt: new Date().toISOString() };
  db.users.push(u);
  log(req.user, 'Added user', u.email);
  store.save();
  res.json(auth.publicUser(u));
});
admin.put('/users/:id', auth.requirePerm('users'), (req, res) => {
  const db = store.get();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found.' });
  const { name, role, disabled, password } = req.body || {};
  const admins = db.users.filter((x) => x.role === 'admin' && !x.disabled);
  if (u.role === 'admin' && admins.length === 1 && ((role && role !== 'admin') || disabled)) return res.status(400).json({ error: 'Keep at least one active admin.' });
  if (name) u.name = String(name).slice(0, 80);
  if (role && auth.ROLES[role]) u.role = role;
  if (typeof disabled === 'boolean') u.disabled = disabled;
  if (password) {
    if (!strongEnough(password)) return res.status(400).json({ error: 'Password: at least 10 characters with a letter and a number.' });
    u.passwordHash = auth.hashPassword(password);
    u.mustChange = true;
  }
  if (u.disabled || password) db.sessions = db.sessions.filter((s) => s.userId !== u.id || s.id === req.session.id);
  log(req.user, 'Edited user', u.email);
  store.save();
  res.json(auth.publicUser(u));
});
admin.delete('/users/:id', auth.requirePerm('users'), (req, res) => {
  const db = store.get();
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself.' });
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found.' });
  if (u.role === 'admin' && db.users.filter((x) => x.role === 'admin' && !x.disabled).length === 1) return res.status(400).json({ error: 'Keep at least one active admin.' });
  db.users = db.users.filter((x) => x.id !== u.id);
  db.sessions = db.sessions.filter((s) => s.userId !== u.id);
  log(req.user, 'Deleted user', u.email);
  store.save();
  res.json({ ok: true });
});

admin.get('/activity', auth.requirePerm('users'), (req, res) => res.json(store.get().activity));

app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------------------------------------------------------------- pages ---

app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/about', '/programs', '/coaches', '/schedule', '/gallery', '/news', '/admissions', '/contact']
    .concat(content.list('programs').map((p) => '/programs/' + p.slug))
    .concat(content.list('posts').map((p) => '/news/' + p.slug))
    .concat(content.list('pages').map((p) => '/' + p.slug));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${origin(req)}${u}</loc></url>`).join('')}</urlset>`);
});

function origin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-src https://www.google.com https://maps.google.com; connect-src 'self'; base-uri 'self'; form-action 'self'");
  next();
});

const page = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out == null) return next();
    res.type('html').send(String(out));
  } catch (e) {
    next(e);
  }
};

app.get('/', page((req) => views.home(req)));
app.get('/about', page((req) => views.about(req)));
app.get('/programs', page((req) => views.programs(req)));
app.get('/programs/:slug', page((req) => views.program(req, req.params.slug)));
app.get('/coaches', page((req) => views.coaches(req)));
app.get('/schedule', page((req) => views.schedule(req)));
app.get('/gallery', page((req) => views.gallery(req)));
app.get('/news', page((req) => views.news(req)));
app.get('/news/:slug', page((req) => views.post(req, req.params.slug)));
app.get('/admissions', page((req) => views.admissions(req)));
app.get('/contact', page((req) => views.contact(req)));
app.get('/credits', page((req) => views.credits(req)));
app.get('/:slug', page((req) => views.customPage(req, req.params.slug)));

app.use((req, res) => res.status(404).type('html').send(String(views.notFound(req))));
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Something went wrong.' });
  res.status(500).type('html').send('<h1>Something went wrong</h1><p>Please try again in a minute.</p>');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Vega Sports Academy on http://localhost:${PORT}  ·  admin: http://localhost:${PORT}/admin/`));
}

module.exports = app;
