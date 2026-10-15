// One-time codes for verifying a parent's phone (DPDP verifiable consent,
// privacy requests). Codes go out on WhatsApp and email. When no channel is
// configured (demo mode) the code is returned to the page so flows can be tested.
const crypto = require('crypto');
const store = require('./store');
const notify = require('./notify');
const { normPhone } = require('./academy');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function demoMode() {
  const c = notify.channels();
  return !c.email && !c.whatsapp && process.env.NODE_ENV !== 'production';
}

function sendCode({ phone, email, purpose }) {
  const db = store.get();
  db.otps = (db.otps || []).filter((o) => o.expires > Date.now());
  const target = normPhone(phone);
  if (target.length !== 10) throw new Error('Enter a valid 10-digit mobile number.');
  const recent = db.otps.filter((o) => o.target === target && Date.now() - o.createdAt < 10 * 60e3);
  if (recent.length >= 4) throw new Error('Too many codes requested. Please wait 10 minutes.');
  const code = String(crypto.randomInt(100000, 1000000));
  const rec = { id: store.id('otp_'), target, purpose, codeHash: sha(code), tries: 0, createdAt: Date.now(), expires: Date.now() + 10 * 60e3 };
  db.otps.push(rec);
  store.save();
  notify.send('otp', { phone, email }, { code });
  return { otpId: rec.id, demoCode: demoMode() ? code : undefined };
}

function verifyCode(otpId, code) {
  const db = store.get();
  const rec = (db.otps || []).find((o) => o.id === otpId);
  if (!rec || rec.expires < Date.now()) throw new Error('This code has expired. Request a new one.');
  if (rec.tries >= 5) throw new Error('Too many wrong attempts. Request a new code.');
  rec.tries++;
  if (sha(String(code).trim()) !== rec.codeHash) {
    store.save();
    throw new Error('That code is not right.');
  }
  rec.token = crypto.randomBytes(18).toString('hex');
  rec.verifiedAt = Date.now();
  store.save();
  return rec.token;
}

// A verified token proves control of that phone for the given purpose.
function checkToken(token, phone, purpose) {
  if (!token) return null;
  const rec = (store.get().otps || []).find((o) => o.token === token);
  if (!rec || rec.purpose !== purpose || rec.target !== normPhone(phone)) return null;
  if (Date.now() - rec.verifiedAt > 60 * 60e3) return null;
  return rec;
}

module.exports = { sendCode, verifyCode, checkToken, demoMode };
