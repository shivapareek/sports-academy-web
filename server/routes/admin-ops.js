// Admin API for academy operations: students and families, attendance (manual
// and QR), fitness tests, coach feedback, invoices, bookings, messages,
// privacy requests and enrolment from an admission.
const store = require('../store');
const auth = require('../auth');
const schema = require('../schema');
const notify = require('../notify');
const academy = require('../academy');
const billing = require('../billing');
const payments = require('../payments');

const db = () => store.get();
const perm = auth.requirePerm;
const nowIso = () => new Date().toISOString();
const r1 = (n) => Math.round(n * 10) / 10;

function log(user, action, detail = '') {
  db().activity.unshift({ at: nowIso(), user: user ? user.email : 'system', action, detail: String(detail).slice(0, 200) });
  db().activity.length = Math.min(db().activity.length, 500);
}

function attendancePct(studentId, days = 56) {
  const from = academy.addDays(academy.today(), -days);
  const recs = db().attendance.filter((a) => a.studentId === studentId && a.date >= from);
  return recs.length ? Math.round((recs.filter((a) => a.status !== 'absent').length / recs.length) * 100) : null;
}

function studentView(s) {
  const f = db().families.find((x) => x.id === s.familyId) || {};
  return {
    ...s,
    family: { id: f.id, guardian: f.guardian, phone: f.phone, email: f.email, portal: !!f.passwordHash, autopay: f.autopay ? f.autopay.status : 'off' },
    batches: (s.batchIds || []).map((id) => db().batches.find((b) => b.id === id)).filter(Boolean).map((b) => ({ id: b.id, name: b.name, program: (db().programs.find((p) => p.id === b.program) || {}).name })),
    attendance: attendancePct(s.id),
    due: billing.dueFor(s.familyId),
  };
}

// Coaches only see their own batches.
function batchesFor(user) {
  const all = db().batches.filter((b) => b.published !== false);
  if (user.role !== 'coach') return all;
  return all.filter((b) => b.coach && b.coach === user.coachId);
}

function cleanStudent(body) {
  const out = {};
  if (body.name != null) out.name = String(body.name).trim().slice(0, 80);
  if (body.dob != null) out.dob = /^\d{4}-\d{2}-\d{2}$/.test(body.dob) ? body.dob : '';
  if (body.gender != null) out.gender = String(body.gender).slice(0, 20);
  if (body.status != null) out.status = ['active', 'paused', 'left'].includes(body.status) ? body.status : 'active';
  if (body.medical != null) out.medical = String(body.medical).slice(0, 600);
  if (body.notes != null) out.notes = String(body.notes).slice(0, 2000);
  if (body.photoConsent != null) out.photoConsent = !!body.photoConsent;
  if (Array.isArray(body.batchIds)) out.batchIds = body.batchIds.filter((id) => db().batches.some((b) => b.id === id));
  return out;
}

module.exports = function mount(admin, req0) {
  /* ------------------------------------------------- overview stats */
  admin.get('/ops/summary', (req, res) => {
    const d = db();
    const t = academy.today();
    const month = t.slice(0, 7);
    const paidThisMonth = d.invoices.filter((i) => i.status === 'paid' && String(i.paidAt).slice(0, 7) === month).reduce((n, i) => n + i.total, 0);
    const due = d.invoices.filter((i) => i.status === 'unpaid' && i.kind === 'fee');
    res.json({
      students: d.students.filter((s) => s.status === 'active').length,
      families: d.families.filter((f) => !f.deleted).length,
      collected: Math.round(paidThisMonth),
      dueAmount: Math.round(due.reduce((n, i) => n + i.total, 0)),
      dueCount: due.length,
      overdue: due.filter((i) => i.dueDate < t).length,
      bookingsToday: d.bookings.filter((b) => b.date === t && b.status === 'confirmed').length,
      autopay: d.families.filter((f) => f.autopay && f.autopay.status === 'active').length,
      waitlist: d.admissions.filter((a) => a.status === 'waitlist').length,
      privacyOpen: d.privacyRequests.filter((p) => p.status !== 'closed').length,
      attendanceToday: d.attendance.filter((a) => a.date === t).length,
      channels: notify.channels(),
      payments: payments.provider(),
    });
  });

  /* ------------------------------------------------------ students */
  admin.get('/ops/students', perm('students'), (req, res) => {
    res.json(db().students.map(studentView));
  });

  admin.get('/ops/students/:id', perm('students'), (req, res) => {
    const s = db().students.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    const d = db();
    res.json({
      student: studentView(s),
      family: (({ passwordHash, inviteHash, inviteExpires, ...rest }) => rest)(d.families.find((f) => f.id === s.familyId) || {}),
      siblings: d.students.filter((x) => x.familyId === s.familyId && x.id !== s.id).map((x) => ({ id: x.id, name: x.name })),
      attendance: d.attendance.filter((a) => a.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60),
      fitness: d.fitness.filter((x) => x.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date)),
      feedback: d.feedback.filter((x) => x.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)),
      invoices: d.invoices.filter((i) => i.familyId === s.familyId).slice(0, 24),
    });
  });

  admin.get('/ops/students/:id/report.pdf', perm('attendance'), (req, res) => {
    const st = db().students.find((x) => x.id === req.params.id);
    if (!st) return res.status(404).end();
    require('../pdf').send(res, require('../pdf').reportDoc(st), `8-week-report-${st.name}-${academy.today()}.pdf`);
  });

  admin.post('/ops/students', perm('students'), (req, res) => {
    const b = req.body || {};
    const data = cleanStudent(b);
    if (!data.name || data.name.length < 2) return res.status(400).json({ error: 'Student name is required.' });
    let fam = b.familyId ? db().families.find((f) => f.id === b.familyId) : academy.findFamilyByContact(b.phone, b.email);
    if (!fam) {
      if (!/^[+\d][\d\s-]{7,18}$/.test(String(b.phone || ''))) return res.status(400).json({ error: 'Parent phone is required for a new family.' });
      fam = academy.createFamily({ guardian: String(b.guardian || '').slice(0, 80), phone: String(b.phone).trim(), email: String(b.email || '').trim() });
    }
    for (const bid of data.batchIds || []) {
      const batch = db().batches.find((x) => x.id === bid);
      if (academy.seatsLeft(batch) <= 0 && !b.overbook) return res.status(409).json({ error: `${batch.name} is full. Tick “allow over capacity” to add anyway, or add them to the waiting list.`, full: true });
    }
    const st = academy.createStudent(fam, data);
    academy.adjustSeats(null, st);
    let link = null;
    if (b.invite && !fam.passwordHash) link = academy.sendInvite(fam, req);
    log(req.user, 'Added student', st.name);
    store.save();
    res.json({ student: studentView(st), inviteLink: link });
  });

  admin.put('/ops/students/:id', perm('students'), (req, res) => {
    const s = db().students.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    const data = cleanStudent(req.body || {});
    const added = (data.batchIds || []).filter((id) => !(s.batchIds || []).includes(id));
    for (const bid of added) {
      const batch = db().batches.find((x) => x.id === bid);
      if (academy.seatsLeft(batch) <= 0 && !req.body.overbook) return res.status(409).json({ error: `${batch.name} is full.`, full: true });
    }
    const before = { status: s.status, batchIds: (s.batchIds || []).slice() };
    Object.assign(s, data, { updatedAt: nowIso() });
    academy.adjustSeats(before, s);
    academy.promoteWaitlist(req); // a seat may have opened
    log(req.user, 'Edited student', s.name);
    store.save();
    res.json(studentView(s));
  });

  admin.put('/ops/families/:id', perm('students'), (req, res) => {
    const f = db().families.find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    if (b.guardian != null) f.guardian = String(b.guardian).slice(0, 80);
    if (b.phone != null) f.phone = String(b.phone).slice(0, 20);
    if (b.email != null) f.email = String(b.email).slice(0, 120);
    log(req.user, 'Edited family', f.guardian);
    store.save();
    const { passwordHash, inviteHash, inviteExpires, ...safe } = f;
    res.json(safe);
  });

  admin.post('/ops/families/:id/invite', perm('students'), (req, res) => {
    const f = db().families.find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Not found.' });
    const link = academy.sendInvite(f, req, f.passwordHash ? 'portal.reset' : 'portal.invite');
    log(req.user, 'Sent portal link', f.guardian);
    res.json({ ok: true, link });
  });

  admin.post('/ops/admissions/:id/enroll', perm('students'), (req, res) => {
    const a = db().admissions.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found.' });
    if (a.studentId) return res.status(400).json({ error: 'Already enrolled.' });
    const r = academy.enrollFromAdmission(a, req);
    log(req.user, 'Enrolled from admission', `${a.student}${r.waitlisted ? ' (waiting list)' : ''}`);
    store.save();
    res.json({ ok: true, studentId: r.student.id, joinedBatch: r.joinedBatch, waitlisted: r.waitlisted, inviteLink: r.link, status: a.status });
  });

  /* ---------------------------------------------------- attendance */
  admin.get('/ops/attendance', perm('attendance'), (req, res) => {
    const batches = batchesFor(req.user);
    const batch = batches.find((b) => b.id === req.query.batch);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : academy.today();
    const out = { batches: batches.map((b) => ({ id: b.id, name: b.name, program: (db().programs.find((p) => p.id === b.program) || {}).name, days: b.days, start: b.start, count: db().students.filter((s) => s.status === 'active' && (s.batchIds || []).includes(b.id)).length })), date, students: [] };
    if (batch) {
      out.students = db().students
        .filter((s) => s.status === 'active' && (s.batchIds || []).includes(batch.id))
        .map((s) => {
          const a = db().attendance.find((x) => x.studentId === s.id && x.batchId === batch.id && x.date === date);
          return { id: s.id, name: s.name, code: s.code, status: a ? a.status : '', method: a ? a.method : '', medical: s.medical, pct: attendancePct(s.id) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    res.json(out);
  });

  function mark(studentId, batchId, date, status, method, user) {
    const d = db();
    let a = d.attendance.find((x) => x.studentId === studentId && x.batchId === batchId && x.date === date);
    if (!status) {
      if (a) d.attendance = d.attendance.filter((x) => x !== a);
      return null;
    }
    if (!a) {
      a = { id: store.id('at_'), studentId, batchId, date };
      d.attendance.push(a);
    }
    Object.assign(a, { status, method, by: user.name, at: nowIso() });
    return a;
  }

  admin.post('/ops/attendance', perm('attendance'), (req, res) => {
    const { batchId, date, marks } = req.body || {};
    if (!batchesFor(req.user).some((b) => b.id === batchId)) return res.status(403).json({ error: 'Not your batch.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > academy.today()) return res.status(400).json({ error: 'Pick today or an earlier date.' });
    for (const m of Array.isArray(marks) ? marks : []) {
      if (!['present', 'late', 'absent', ''].includes(m.status)) continue;
      const st = db().students.find((s) => s.id === m.studentId && (s.batchIds || []).includes(batchId));
      if (st) mark(st.id, batchId, date, m.status, 'manual', req.user);
    }
    log(req.user, 'Marked attendance', `${(db().batches.find((b) => b.id === batchId) || {}).name} · ${date}`);
    store.save();
    res.json({ ok: true });
  });

  // QR check-in: the code printed on the athlete's card.
  admin.post('/ops/attendance/scan', perm('attendance'), (req, res) => {
    const code = String((req.body || {}).code || '').trim().toUpperCase();
    const st = db().students.find((s) => s.code === code && s.status === 'active');
    if (!st) return res.status(404).json({ error: `No active athlete with code ${code || '(empty)'}.` });
    const date = academy.today();
    const mine = batchesFor(req.user).filter((b) => (st.batchIds || []).includes(b.id));
    let batch = mine.find((b) => b.id === req.body.batchId);
    if (!batch) batch = mine.find((b) => (b.days || []).includes(academy.weekday(date))) || mine[0];
    if (!batch) return res.status(400).json({ error: `${st.name} is not in any of your batches.` });
    const late = academy.toMin(batch.start) + 10 < (() => { const d = new Date(Date.now() + 330 * 60e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();
    const already = db().attendance.find((x) => x.studentId === st.id && x.batchId === batch.id && x.date === date);
    const a = already || mark(st.id, batch.id, date, late ? 'late' : 'present', 'qr', req.user);
    store.save();
    res.json({ ok: true, student: { id: st.id, name: st.name, medical: st.medical }, batch: batch.name, status: a.status, already: !!already });
  });

  /* ------------------------------------------- fitness & feedback */
  admin.post('/ops/fitness', perm('attendance'), (req, res) => {
    const b = req.body || {};
    const st = db().students.find((s) => s.id === b.studentId);
    if (!st) return res.status(404).json({ error: 'Athlete not found.' });
    const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
    const rec = { id: store.id('ft_'), studentId: st.id, date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : academy.today(), sprint20: num(b.sprint20), broadJump: num(b.broadJump), plank: num(b.plank), beep: num(b.beep), notes: String(b.notes || '').slice(0, 600), by: req.user.name };
    if ([rec.sprint20, rec.broadJump, rec.plank, rec.beep].every((v) => v == null)) return res.status(400).json({ error: 'Enter at least one result.' });
    db().fitness.push(rec);
    log(req.user, 'Added fitness test', st.name);
    store.save();
    res.json(rec);
  });
  admin.delete('/ops/fitness/:id', perm('attendance'), (req, res) => {
    db().fitness = db().fitness.filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  admin.post('/ops/feedback', perm('attendance'), (req, res) => {
    const b = req.body || {};
    const st = db().students.find((s) => s.id === b.studentId);
    if (!st) return res.status(404).json({ error: 'Athlete not found.' });
    const text = String(b.text || '').trim().slice(0, 2000);
    if (text.length < 5) return res.status(400).json({ error: 'Write a little more feedback.' });
    const effort = Math.max(0, Math.min(5, Number(b.effort) || 0));
    const coach = db().coaches.find((c) => c.id === req.user.coachId);
    const rec = { id: store.id('fb_'), studentId: st.id, coachId: req.user.coachId || '', by: coach ? coach.name : req.user.name, date: academy.today(), text, effort, visible: b.visible !== false };
    db().feedback.push(rec);
    log(req.user, 'Added coach feedback', st.name);
    store.save();
    res.json(rec);
  });
  admin.delete('/ops/feedback/:id', perm('attendance'), (req, res) => {
    db().feedback = db().feedback.filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  /* ------------------------------------------------------ invoices */
  admin.get('/ops/invoices', perm('billing'), (req, res) => {
    const fam = new Map(db().families.map((f) => [f.id, f]));
    res.json(db().invoices.map((i) => ({ ...i, family: i.familyId ? (fam.get(i.familyId) || {}).guardian : null })));
  });

  admin.post('/ops/invoices/generate', perm('billing'), (req, res) => {
    const period = /^\d{4}-\d{2}$/.test((req.body || {}).period || '') ? req.body.period : academy.today().slice(0, 7);
    const made = billing.generateMonth(period, req);
    log(req.user, 'Generated invoices', `${billing.periodLabel(period)}: ${made.length}`);
    store.save();
    res.json({ ok: true, count: made.length });
  });

  admin.post('/ops/invoices', perm('billing'), (req, res) => {
    const b = req.body || {};
    const f = db().families.find((x) => x.id === b.familyId);
    const amount = Number(b.amount);
    if (!f) return res.status(400).json({ error: 'Pick a family.' });
    if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount.' });
    const label = String(b.label || 'Fee').slice(0, 160);
    const inv = billing.createInvoice({ kind: 'manual', familyId: f.id, billTo: { name: f.guardian, phone: f.phone, email: f.email }, lines: [{ label, amount }], dueDate: /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '') ? b.dueDate : academy.addDays(academy.today(), 7) });
    if (b.notify) notify.send('invoice.created', { phone: f.phone, email: f.email }, { name: f.guardian, number: inv.number, amount: billing.money(inv.total), period: label, due: academy.humanDate(inv.dueDate), link: billing.invoiceLink(inv, req) });
    log(req.user, 'Created invoice', `${inv.number} · ${f.guardian}`);
    res.json(inv);
  });

  admin.post('/ops/invoices/:id/paid', perm('billing'), (req, res) => {
    const inv = db().invoices.find((i) => i.id === req.params.id);
    if (!inv || inv.status !== 'unpaid') return res.status(400).json({ error: 'Only unpaid invoices can be marked paid.' });
    const method = ['Cash', 'UPI (offline)', 'Bank transfer', 'Cheque', 'Card (POS)'].includes(req.body.method) ? req.body.method : 'Cash';
    billing.applyPayment(inv, { provider: 'offline', id: String(req.body.ref || '').slice(0, 60), method, by: req.user.email }, req);
    log(req.user, 'Recorded payment', `${inv.number} · ${method}`);
    store.save();
    res.json(inv);
  });

  admin.post('/ops/invoices/:id/void', perm('billing'), (req, res) => {
    const inv = db().invoices.find((i) => i.id === req.params.id);
    if (!inv || inv.status !== 'unpaid') return res.status(400).json({ error: 'Only unpaid invoices can be cancelled. Paid ones need a refund.' });
    inv.status = 'void';
    inv.voidedAt = nowIso();
    log(req.user, 'Cancelled invoice', inv.number);
    store.save();
    res.json(inv);
  });

  admin.post('/ops/invoices/:id/remind', perm('billing'), (req, res) => {
    const inv = db().invoices.find((i) => i.id === req.params.id);
    if (!inv || inv.status !== 'unpaid') return res.status(400).json({ error: 'Only unpaid invoices.' });
    const to = inv.billTo || {};
    notify.send(inv.dueDate < academy.today() ? 'invoice.overdue' : 'invoice.reminder', { phone: to.phone, email: to.email }, { name: to.name, number: inv.number, amount: billing.money(inv.total), period: inv.period ? billing.periodLabel(inv.period) : inv.lines[0].label, due: academy.humanDate(inv.dueDate), link: billing.invoiceLink(inv, req) });
    inv.reminders.push('manual:' + academy.today());
    log(req.user, 'Sent fee reminder', inv.number);
    store.save();
    res.json({ ok: true });
  });

  /* ------------------------------------------------------ bookings */
  admin.get('/ops/bookings', perm('billing'), (req, res) => {
    academy.expireHolds();
    const rs = new Map(db().resources.map((r) => [r.id, r]));
    res.json({ bookings: db().bookings.map((b) => ({ ...b, resource: (rs.get(b.resourceId) || {}).name })), resources: db().resources.map((r) => ({ id: r.id, name: r.name })) });
  });

  admin.post('/ops/bookings/:id/cancel', perm('billing'), (req, res) => {
    const bk = db().bookings.find((b) => b.id === req.params.id);
    if (!bk || !['pending', 'confirmed'].includes(bk.status)) return res.status(400).json({ error: 'This booking cannot be cancelled.' });
    bk.status = 'cancelled';
    bk.cancelledAt = nowIso();
    bk.refund = String((req.body || {}).refund || '').slice(0, 120);
    const inv = db().invoices.find((i) => i.id === bk.invoiceId);
    if (inv && inv.status === 'unpaid') inv.status = 'void';
    log(req.user, 'Cancelled booking', `${bk.ref}${bk.refund ? ' · refund: ' + bk.refund : ''}`);
    store.save();
    res.json(bk);
  });

  // Block a slot for maintenance or an event.
  admin.post('/ops/blocks', perm('billing'), (req, res) => {
    const { resourceId, date, start, end, reason } = req.body || {};
    if (!db().resources.some((r) => r.id === resourceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '') || end <= start) return res.status(400).json({ error: 'Pick a facility, date and a valid time range.' });
    const blk = { id: store.id('bl_'), resourceId, date, start, end, reason: String(reason || '').slice(0, 120), by: req.user.email };
    db().blocks.push(blk);
    store.save();
    res.json(blk);
  });

  /* ------------------------------------------------------ messages */
  admin.get('/ops/outbox', perm('settings'), (req, res) => res.json({ items: db().outbox.slice(0, 300), channels: notify.channels() }));
  admin.get('/ops/templates', perm('settings'), (req, res) => {
    const custom = db().templates || {};
    res.json(Object.entries(notify.TEMPLATES).map(([k, v]) => ({ key: k, label: v.label, defaultSubject: v.subject, defaultBody: v.body, subject: (custom[k] || {}).subject || '', body: (custom[k] || {}).body || '', waTemplate: (custom[k] || {}).waTemplate || '' })));
  });
  admin.put('/ops/templates/:key', perm('settings'), (req, res) => {
    if (!notify.TEMPLATES[req.params.key]) return res.status(404).json({ error: 'Unknown template.' });
    const b = req.body || {};
    db().templates[req.params.key] = { subject: String(b.subject || '').slice(0, 200), body: String(b.body || '').slice(0, 1500), waTemplate: String(b.waTemplate || '').slice(0, 200) };
    log(req.user, 'Edited message template', req.params.key);
    store.save();
    res.json({ ok: true });
  });
  admin.post('/ops/test-message', perm('settings'), (req, res) => {
    const { phone, email } = req.body || {};
    notify.send('notice', { phone, email }, { title: 'Test message', text: 'If you can read this, messaging works.' });
    res.json({ ok: true });
  });
  admin.get('/ops/integrations', perm('settings'), (req, res) => {
    const c = notify.channels();
    res.json({
      payments: { provider: payments.provider(), webhook: !!process.env.RAZORPAY_WEBHOOK_SECRET, webhookUrl: notify.publicUrl(req) + '/api/pay/webhook' },
      email: c.email,
      whatsapp: c.whatsapp,
      googleReviews: !!(process.env.GOOGLE_PLACES_KEY && db().settings.googlePlaceId),
      publicUrl: notify.publicUrl(req),
    });
  });

  // Broadcast a notice to every family (or the families of one program).
  admin.post('/ops/notices/:id/broadcast', perm('content'), (req, res) => {
    const n = db().notices.find((x) => x.id === req.params.id);
    if (!n) return res.status(404).json({ error: 'Notice not found.' });
    const famIds = new Set(
      db().students.filter((s) => s.status === 'active' && (!n.program || (s.batchIds || []).some((bid) => (db().batches.find((b) => b.id === bid) || {}).program === n.program))).map((s) => s.familyId)
    );
    const fams = db().families.filter((f) => famIds.has(f.id) && !f.deleted);
    const when = n.until ? `${academy.humanDate(n.date)} – ${academy.humanDate(n.until)}` : academy.humanDate(n.date);
    for (const f of fams) notify.send('notice', { phone: f.phone, email: f.email }, { title: n.title, text: `${when}. ${n.text || ''}` });
    n.broadcastAt = nowIso();
    log(req.user, 'Broadcast notice', `${n.title} → ${fams.length} families`);
    store.save();
    res.json({ ok: true, count: fams.length });
  });

  /* ---------------------------------------------- privacy requests */
  admin.get('/ops/privacy', perm('privacy'), (req, res) => res.json(db().privacyRequests));
  admin.patch('/ops/privacy/:id', perm('privacy'), (req, res) => {
    const p = db().privacyRequests.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    if (['new', 'in progress', 'closed'].includes(req.body.status)) p.status = req.body.status;
    if (typeof req.body.notes === 'string') p.notes = req.body.notes.slice(0, 4000);
    p.updatedAt = nowIso();
    log(req.user, 'Updated privacy request', `${p.type} · ${p.status}`);
    store.save();
    res.json(p);
  });

  // Export everything held about a family (right to access).
  admin.get('/ops/privacy/:id/export', perm('privacy'), (req, res) => {
    const p = db().privacyRequests.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).end();
    const f = academy.findFamilyByContact(p.phone, p.email);
    const d = db();
    const kids = f ? d.students.filter((s) => s.familyId === f.id) : [];
    const ids = new Set(kids.map((k) => k.id));
    const phone = academy.normPhone(p.phone);
    const out = {
      exportedAt: nowIso(),
      family: f ? { guardian: f.guardian, phone: f.phone, email: f.email, consents: f.consents, autopay: f.autopay && f.autopay.status } : null,
      students: kids,
      attendance: d.attendance.filter((a) => ids.has(a.studentId)),
      fitness: d.fitness.filter((a) => ids.has(a.studentId)),
      feedback: d.feedback.filter((a) => ids.has(a.studentId)),
      invoices: f ? d.invoices.filter((i) => i.familyId === f.id).map(({ token, ...i }) => i) : [],
      formSubmissions: ['trials', 'admissions', 'enquiries'].flatMap((k) => d[k].filter((x) => academy.normPhone(x.phone) === phone).map((x) => ({ form: k, ...x }))),
      bookings: d.bookings.filter((b) => academy.normPhone(b.phone) === phone),
    };
    res.setHeader('Content-Disposition', `attachment; filename="data-export-${p.id.slice(-6)}.json"`);
    res.json(out);
  });

  // Right to erasure: remove personal data; keep invoices (tax law) with the name masked.
  admin.post('/ops/privacy/:id/erase', perm('privacy'), (req, res) => {
    const p = db().privacyRequests.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    const d = db();
    const phone = academy.normPhone(p.phone);
    const f = academy.findFamilyByContact(p.phone, p.email);
    let summary = [];
    if (f) {
      const kids = d.students.filter((s) => s.familyId === f.id);
      kids.forEach((k) => academy.adjustSeats(k, null));
      const ids = new Set(kids.map((s) => s.id));
      d.attendance = d.attendance.filter((a) => !ids.has(a.studentId));
      d.fitness = d.fitness.filter((a) => !ids.has(a.studentId));
      d.feedback = d.feedback.filter((a) => !ids.has(a.studentId));
      d.students = d.students.filter((s) => !ids.has(s.id));
      for (const inv of d.invoices.filter((i) => i.familyId === f.id)) {
        inv.billTo = { name: 'Erased (DPDP request)', phone: '', email: '' };
        inv.lines = inv.lines.map((l) => ({ ...l, label: l.label.replace(/^[^·]+·/, 'Athlete ·') }));
      }
      d.portalSessions = d.portalSessions.filter((s) => s.familyId !== f.id);
      Object.assign(f, { guardian: 'Erased', phone: '', email: '', passwordHash: '', consents: [], deleted: true, erasedAt: nowIso() });
      summary.push(`${ids.size} athlete record(s)`);
    }
    for (const k of ['trials', 'admissions', 'enquiries']) {
      const before = d[k].length;
      d[k] = d[k].filter((x) => academy.normPhone(x.phone) !== phone);
      if (d[k].length !== before) summary.push(`${before - d[k].length} ${k}`);
    }
    for (const b of d.bookings.filter((x) => academy.normPhone(x.phone) === phone)) Object.assign(b, { name: 'Erased', phone: '', email: '' });
    p.status = 'closed';
    p.notes = (p.notes ? p.notes + '\n' : '') + `Erased on ${academy.today()}: ${summary.join(', ') || 'no matching records'}. Invoices kept with names removed (tax records).`;
    academy.syncSeats();
    log(req.user, 'Erased personal data (DPDP)', summary.join(', '));
    store.save();
    res.json({ ok: true, summary });
  });
};
