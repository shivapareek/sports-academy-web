// Students, families, seats, the waiting list, trial slots and facility
// booking availability.
const crypto = require('crypto');
const store = require('./store');
const notify = require('./notify');

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const db = () => store.get();
const today = () => localDate(new Date());

// Dates are handled as YYYY-MM-DD in the academy's timezone (IST).
function localDate(d) {
  return new Date(d.getTime() + 330 * 60e3).toISOString().slice(0, 10);
}
function nowMinutesIST() {
  const d = new Date(Date.now() + 330 * 60e3);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(ymd) {
  return DAY_KEYS[new Date(ymd + 'T00:00:00Z').getUTCDay()];
}
const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function time12(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  if (!m) return '';
  let h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
function humanDate(ymd) {
  const d = new Date(ymd + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

/* ------------------------------------------------------------- seats */

function activeStudents() {
  return (db().students || []).filter((s) => s.status === 'active');
}

// With "auto seats" on, seats left = capacity minus enrolled active students.
// Off (the default until every student is in the system), the number typed
// in the admin is used.
function seatsLeft(batch) {
  if (!batch) return 0;
  const seats = Number(batch.seats) || 0;
  if (!seats || !db().settings.autoSeats) return Math.max(0, Number(batch.seatsLeft) || 0);
  const taken = activeStudents().filter((s) => (s.batchIds || []).includes(batch.id)).length;
  return Math.max(0, seats - taken);
}

// Keep the stored seatsLeft in step so the public pages and the admin agree.
function syncSeats() {
  if (!db().settings.autoSeats) return;
  for (const b of db().batches || []) {
    if (Number(b.seats)) b.seatsLeft = seatsLeft(b);
  }
}

// Manual-seat mode: enrolling takes a seat, leaving gives it back.
function adjustSeats(before, after) {
  if (db().settings.autoSeats) return syncSeats();
  const held = (x) => (x && x.status === 'active' ? x.batchIds || [] : []);
  const was = new Set(held(before));
  const now = new Set(held(after));
  for (const b of db().batches || []) {
    if (now.has(b.id) && !was.has(b.id)) b.seatsLeft = Math.max(0, (Number(b.seatsLeft) || 0) - 1);
    if (was.has(b.id) && !now.has(b.id) && Number(b.seats)) b.seatsLeft = Math.min(Number(b.seats), (Number(b.seatsLeft) || 0) + 1);
  }
}

/* ---------------------------------------------------------- waitlist */

function waitlistFor(batchId) {
  return (db().admissions || [])
    .filter((a) => a.status === 'waitlist' && a.batchId === batchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// When a batch has a free seat, tell the first family on its waiting list
// (once) and the staff. Staff then confirm the admission in the admin panel.
function promoteWaitlist(req) {
  syncSeats();
  for (const b of db().batches || []) {
    let free = seatsLeft(b);
    if (!free) continue;
    for (const a of waitlistFor(b.id)) {
      if (!free) break;
      if (a.seatOfferedAt) {
        free--;
        continue;
      }
      a.seatOfferedAt = new Date().toISOString();
      free--;
      notify.send('waitlist.seat', { phone: a.phone, email: a.email }, { name: a.guardian || a.student, student: a.student, batch: b.name });
      notify.staff('lead.staff', { type: 'seat offer (waiting list)', name: a.student, phone: a.phone, program: a.program, details: `Seat opened in ${b.name}. Confirm within 48 hours.`, link: notify.publicUrl(req) + '/admin/#/s/admissions' });
    }
  }
  store.save();
}

/* ---------------------------------------------------- families/students */

function studentCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = 'V' + Array.from(crypto.randomBytes(5), (b) => A[b % A.length]).join('');
  } while ((db().students || []).some((s) => s.code === code));
  return code;
}

function findFamilyByContact(phone, email) {
  const p = normPhone(phone);
  const e = String(email || '').toLowerCase();
  return (db().families || []).find((f) => !f.deleted && ((p && normPhone(f.phone) === p) || (e && String(f.email || '').toLowerCase() === e)));
}

function createFamily({ guardian, phone, email }) {
  const f = { id: store.id('fa_'), guardian: guardian || '', phone: phone || '', email: email || '', consents: [], autopay: { status: 'off' }, createdAt: new Date().toISOString() };
  db().families.push(f);
  return f;
}

function createStudent(family, data) {
  const s = {
    id: store.id('st_'),
    familyId: family.id,
    name: data.name,
    dob: data.dob || '',
    gender: data.gender || '',
    batchIds: data.batchIds || [],
    status: 'active',
    joined: today(),
    code: studentCode(),
    photoConsent: !!data.photoConsent,
    medical: data.medical || '',
    notes: '',
    createdAt: new Date().toISOString(),
  };
  db().students.push(s);
  return s;
}

function inviteToken(family, hours = 24 * 7) {
  const token = crypto.randomBytes(24).toString('hex');
  family.inviteHash = crypto.createHash('sha256').update(token).digest('hex');
  family.inviteExpires = Date.now() + hours * 3600e3;
  return token;
}

function sendInvite(family, req, kind = 'portal.invite') {
  const token = inviteToken(family, kind === 'portal.reset' ? 1 : 24 * 7);
  store.save();
  const link = `${notify.publicUrl(req)}/portal/set-password?t=${token}`;
  notify.send(kind, { phone: family.phone, email: family.email }, { name: family.guardian, link });
  return link;
}

// Admin action: turn an admission into a family + student and invite the
// parent to the portal. Joins the chosen batch if a seat is free, otherwise
// the admission stays on that batch's waiting list.
function enrollFromAdmission(a, req) {
  let family = findFamilyByContact(a.phone, a.email);
  const isNew = !family;
  if (!family) family = createFamily({ guardian: a.guardian || a.student, phone: a.phone, email: a.email });
  if (a.consent) family.consents.push(a.consent);
  const batch = (db().batches || []).find((b) => b.id === a.batchId);
  const hasSeat = batch ? seatsLeft(batch) > 0 : false;
  const student = createStudent(family, {
    name: a.student,
    dob: a.dob,
    gender: a.gender,
    medical: a.medical,
    photoConsent: a.photoConsent === true || a.photoConsent === 'on',
    batchIds: hasSeat ? [batch.id] : [],
  });
  a.status = batch && !hasSeat ? 'waitlist' : 'enrolled';
  a.studentId = student.id;
  adjustSeats(null, student);
  let link = null;
  if (isNew || !family.passwordHash) link = sendInvite(family, req);
  store.save();
  return { family, student, joinedBatch: hasSeat, waitlisted: !!batch && !hasSeat, link };
}

/* ------------------------------------------------------- trial slots */

function trialSlots(programId, days = 14) {
  const d = db();
  const cap = Number(d.settings.trialsPerSession) || 2;
  const out = [];
  const batches = (d.batches || []).filter((b) => b.program === programId && b.published !== false && b.start);
  const start = today();
  for (let i = 1; i <= days; i++) {
    const date = addDays(start, i);
    const wd = weekday(date);
    for (const b of batches) {
      if (!(b.days || []).includes(wd)) continue;
      const booked = (d.trials || []).filter((t) => t.batchId === b.id && t.date === date && t.status !== 'closed').length;
      out.push({ batchId: b.id, batch: b.name, ages: b.ages, level: b.level, venue: b.venue, date, start: b.start, label: `${humanDate(date)}, ${time12(b.start)}`, left: Math.max(0, cap - booked) });
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

/* -------------------------------------------------- facility booking */

function expireHolds() {
  const now = Date.now();
  let changed = false;
  for (const bk of db().bookings || []) {
    if (bk.status === 'pending' && bk.holdUntil < now) {
      bk.status = 'expired';
      const inv = (db().invoices || []).find((i) => i.id === bk.invoiceId);
      if (inv && inv.status === 'unpaid') inv.status = 'void';
      changed = true;
    }
  }
  if (changed) store.save();
}

function slotsFor(resource, date) {
  expireHolds();
  const step = Number(resource.slotMinutes) || 60;
  const open = toMin(resource.openFrom || '06:00');
  const close = toMin(resource.openTo || '21:00');
  const days = resource.days && resource.days.length ? resource.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (!days.includes(weekday(date))) return [];
  const taken = (db().bookings || []).filter((b) => b.resourceId === resource.id && b.date === date && (b.status === 'confirmed' || b.status === 'pending'));
  const blocked = (db().blocks || []).filter((b) => b.resourceId === resource.id && b.date === date);
  const isToday = date === today();
  const nowM = nowMinutesIST();
  const out = [];
  for (let m = open; m + step <= close; m += step) {
    const busy = taken.concat(blocked).some((b) => toMin(b.start) < m + step && toMin(b.end) > m);
    const past = isToday && m <= nowM;
    out.push({ start: toHHMM(m), end: toHHMM(m + step), label: time12(toHHMM(m)), free: !busy && !past, past });
  }
  return out;
}

module.exports = {
  today, addDays, weekday, humanDate, time12, toMin, toHHMM, normPhone,
  seatsLeft, syncSeats, adjustSeats, waitlistFor, promoteWaitlist,
  findFamilyByContact, createFamily, createStudent, sendInvite, enrollFromAdmission,
  trialSlots, slotsFor, expireHolds,
};
