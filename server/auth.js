// Password hashing, sessions, CSRF and roles for the admin panel.
const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'vega_admin';
const SESSION_DAYS = 7;
const ROLES = {
  admin: { label: 'Admin', can: ['content', 'submissions', 'settings', 'users'] },
  editor: { label: 'Editor', can: ['content', 'submissions'] },
  staff: { label: 'Front desk', can: ['submissions'] },
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieAttrs(maxAge) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function createSession(res, user) {
  const db = store.get();
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  db.sessions = (db.sessions || []).filter((s) => s.expires > now);
  db.sessions.push({ id: sha(token), userId: user.id, csrf, expires: now + SESSION_DAYS * 864e5 });
  store.save();
  res.setHeader('Set-Cookie', `${COOKIE}=${token}${cookieAttrs(SESSION_DAYS * 86400)}`);
  return csrf;
}

function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE];
  const db = store.get();
  if (token) db.sessions = (db.sessions || []).filter((s) => s.id !== sha(token));
  store.save();
  res.setHeader('Set-Cookie', `${COOKIE}=${cookieAttrs(0)}`);
}

function currentSession(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const db = store.get();
  const s = (db.sessions || []).find((x) => x.id === sha(token));
  if (!s || s.expires < Date.now()) return null;
  const user = db.users.find((u) => u.id === s.userId && !u.disabled);
  return user ? { session: s, user } : null;
}

// Every admin API call needs a session; anything that changes data also
// needs the CSRF token the login response handed to the admin page.
function requireAuth(req, res, next) {
  const cur = currentSession(req);
  if (!cur) return res.status(401).json({ error: 'Please sign in.' });
  if (req.method !== 'GET' && req.get('x-csrf') !== cur.session.csrf) {
    return res.status(403).json({ error: 'Your session expired. Reload the page.' });
  }
  req.user = cur.user;
  req.session = cur.session;
  next();
}

function can(user, perm) {
  return (ROLES[user.role] || { can: [] }).can.includes(perm);
}

function requirePerm(perm) {
  return (req, res, next) => {
    if (!can(req.user, perm)) return res.status(403).json({ error: 'Your role cannot do that.' });
    next();
  };
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, mustChange: !!u.mustChange, disabled: !!u.disabled, perms: (ROLES[u.role] || { can: [] }).can };
}

// Tiny in-memory rate limiter keyed by IP + bucket.
const hits = new Map();
function rateLimit(bucket, max, windowMs) {
  return (req, res, next) => {
    const key = bucket + ':' + req.ip;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k);
}, 600e3).unref();

module.exports = { ROLES, hashPassword, verifyPassword, createSession, destroySession, currentSession, requireAuth, requirePerm, can, publicUser, rateLimit };
