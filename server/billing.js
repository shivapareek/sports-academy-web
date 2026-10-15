// Fee invoices with GST, sibling discount, monthly billing, reminders and
// applying payments. Also the hourly scheduler.
const crypto = require('crypto');
const store = require('./store');
const notify = require('./notify');
const academy = require('./academy');

const db = () => store.get();
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function fy(ymd) {
  const [y, m] = ymd.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// Sequential numbers per financial year, as GST rules expect.
function nextNumber(date) {
  const d = db();
  d.counters = d.counters || {};
  const key = fy(date);
  d.counters[key] = (d.counters[key] || 0) + 1;
  const prefix = (d.settings.invoicePrefix || 'VSA').replace(/[^A-Z0-9-]/gi, '').slice(0, 8);
  return `${prefix}/${key}/${String(d.counters[key]).padStart(4, '0')}`;
}

function gstFor(total) {
  const s = db().settings;
  const rate = Number(s.gstRate) || 0;
  if (!rate || !s.gstin) return { rate: 0, taxable: r2(total), cgst: 0, sgst: 0, igst: 0 };
  const taxable = s.pricesIncludeGst !== false ? r2((total * 100) / (100 + rate)) : r2(total);
  const tax = s.pricesIncludeGst !== false ? r2(total - taxable) : r2((taxable * rate) / 100);
  // Customers are assumed to be in the academy's state (CGST + SGST).
  return { rate, taxable, cgst: r2(tax / 2), sgst: r2(tax - r2(tax / 2)), igst: 0 };
}

function createInvoice({ kind, familyId = null, billTo, period = '', lines, discount = null, dueDate, bookingId = null }) {
  const subtotal = r2(lines.reduce((n, l) => n + Number(l.amount || 0), 0));
  const disc = discount && discount.amount ? r2(discount.amount) : 0;
  const s = db().settings;
  let total = r2(subtotal - disc);
  const gst = gstFor(total);
  if (s.pricesIncludeGst === false && gst.rate) total = r2(total + gst.cgst + gst.sgst + gst.igst);
  const date = academy.today();
  const inv = {
    id: store.id('in_'),
    number: nextNumber(date),
    kind,
    familyId,
    billTo,
    period,
    lines,
    discount: disc ? { label: discount.label, amount: disc } : null,
    subtotal,
    gst,
    total,
    status: 'unpaid',
    date,
    dueDate: dueDate || date,
    bookingId,
    token: crypto.randomBytes(16).toString('hex'),
    reminders: [],
    createdAt: new Date().toISOString(),
  };
  db().invoices = db().invoices || [];
  db().invoices.unshift(inv);
  store.save();
  return inv;
}

function invoiceLink(inv, req) {
  return `${notify.publicUrl(req)}/invoice/${inv.id}?t=${inv.token}`;
}

function programsById() {
  return new Map((db().programs || []).map((p) => [p.id, p]));
}

// Monthly fee for one student: each distinct program they train in.
function studentLines(student) {
  const progs = programsById();
  const seen = new Set();
  const lines = [];
  for (const bid of student.batchIds || []) {
    const b = (db().batches || []).find((x) => x.id === bid);
    if (!b || seen.has(b.program)) continue;
    seen.add(b.program);
    const p = progs.get(b.program);
    if (p && p.feeMonthly) lines.push({ studentId: student.id, label: `${student.name} · ${p.name} (${b.name})`, amount: Number(p.feeMonthly) });
  }
  return lines;
}

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Bill every family with active students for a month (YYYY-MM). Families
// already billed for that month are skipped, so it is safe to run twice.
function generateMonth(period, req) {
  const d = db();
  const s = d.settings;
  const pct = Number(s.siblingDiscount) || 0;
  const dueDate = `${period}-${String(Math.min(28, (Number(s.billingDay) || 1) + (Number(s.dueDays) || 7))).padStart(2, '0')}`;
  const created = [];
  for (const f of d.families || []) {
    if (f.deleted) continue;
    if ((d.invoices || []).some((i) => i.kind === 'fee' && i.familyId === f.id && i.period === period && i.status !== 'void')) continue;
    const kids = (d.students || []).filter((st) => st.familyId === f.id && st.status === 'active');
    const perKid = kids.map((k) => ({ kid: k, lines: studentLines(k) })).filter((x) => x.lines.length);
    if (!perKid.length) continue;
    // Sibling discount on every child except the one with the highest fee.
    perKid.sort((a, b) => b.lines.reduce((n, l) => n + l.amount, 0) - a.lines.reduce((n, l) => n + l.amount, 0));
    const lines = perKid.flatMap((x) => x.lines);
    let discount = null;
    if (pct && perKid.length > 1) {
      const base = perKid.slice(1).reduce((n, x) => n + x.lines.reduce((m, l) => m + l.amount, 0), 0);
      discount = { label: `Sibling discount ${pct}%`, amount: r2((base * pct) / 100) };
    }
    const inv = createInvoice({ kind: 'fee', familyId: f.id, billTo: { name: f.guardian, phone: f.phone, email: f.email }, period, lines, discount, dueDate });
    created.push(inv);
    if (f.autopay && f.autopay.status === 'active') continue; // charged by the mandate
    notify.send('invoice.created', { phone: f.phone, email: f.email }, { name: f.guardian, number: inv.number, amount: money(inv.total), period: periodLabel(period), due: academy.humanDate(dueDate), link: `${notify.publicUrl(req)}/portal/fees` });
  }
  return created;
}

function applyPayment(inv, payment, req) {
  if (!inv || inv.status === 'paid') return inv;
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString();
  inv.payment = payment;
  if (inv.kind === 'booking') {
    const bk = (db().bookings || []).find((b) => b.id === inv.bookingId);
    if (bk) {
      bk.status = 'confirmed';
      const r = (db().resources || []).find((x) => x.id === bk.resourceId);
      notify.send('booking.confirmed', { phone: bk.phone, email: bk.email }, { name: bk.name, resource: r ? r.name : 'Facility', when: `${academy.humanDate(bk.date)}, ${academy.time12(bk.start)} – ${academy.time12(bk.end)}`, ref: bk.ref });
    }
  }
  store.save();
  notify.send('payment.received', { phone: inv.billTo && inv.billTo.phone, email: inv.billTo && inv.billTo.email }, { name: inv.billTo && inv.billTo.name, amount: money(inv.total), number: inv.number, link: invoiceLink(inv, req) });
  return inv;
}

// Reminder three days before the due date, and an overdue notice a few days after.
function sendReminders(req) {
  const d = db();
  const t = academy.today();
  const overdueAfter = Number(d.settings.overdueDays) || 3;
  for (const inv of d.invoices || []) {
    if (inv.kind !== 'fee' || inv.status !== 'unpaid') continue;
    const f = (d.families || []).find((x) => x.id === inv.familyId);
    if (!f || f.deleted || (f.autopay && f.autopay.status === 'active')) continue;
    const vars = { name: f.guardian, number: inv.number, amount: money(inv.total), period: periodLabel(inv.period), due: academy.humanDate(inv.dueDate), link: `${notify.publicUrl(req)}/portal/fees` };
    if (t >= academy.addDays(inv.dueDate, -3) && t < inv.dueDate && !inv.reminders.includes('before')) {
      inv.reminders.push('before');
      notify.send('invoice.reminder', { phone: f.phone, email: f.email }, vars);
    }
    if (t >= academy.addDays(inv.dueDate, overdueAfter) && !inv.reminders.includes('overdue')) {
      inv.reminders.push('overdue');
      notify.send('invoice.overdue', { phone: f.phone, email: f.email }, vars);
    }
  }
  store.save();
}

function dueFor(familyId) {
  return r2((db().invoices || []).filter((i) => i.familyId === familyId && i.status === 'unpaid').reduce((n, i) => n + i.total, 0));
}

function monthlyFor(familyId) {
  const d = db();
  const kids = (d.students || []).filter((s) => s.familyId === familyId && s.status === 'active');
  const per = kids.map((k) => studentLines(k).reduce((n, l) => n + l.amount, 0)).sort((a, b) => b - a);
  const pct = Number(d.settings.siblingDiscount) || 0;
  const total = per.reduce((n, x, i) => n + (i === 0 ? x : x * (1 - pct / 100)), 0);
  return r2(total);
}

/* --------------------------------------------------------- scheduler */

let ticking = false;
function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const d = db();
    const t = academy.today();
    academy.expireHolds();
    if (d.settings.autoBilling && Number(t.slice(8)) >= (Number(d.settings.billingDay) || 1)) {
      const period = t.slice(0, 7);
      d.billingRuns = d.billingRuns || [];
      if (!d.billingRuns.includes(period)) {
        d.billingRuns.push(period);
        const made = generateMonth(period);
        d.activity.unshift({ at: new Date().toISOString(), user: 'system', action: 'Generated monthly invoices', detail: `${periodLabel(period)}: ${made.length} invoices` });
      }
    }
    sendReminders();
    academy.promoteWaitlist();
    store.save();
  } catch (e) {
    console.error('scheduler', e);
  } finally {
    ticking = false;
  }
}

function startScheduler() {
  setTimeout(tick, 5000).unref();
  setInterval(tick, 3600e3).unref();
}

module.exports = { createInvoice, invoiceLink, generateMonth, applyPayment, sendReminders, dueFor, monthlyFor, periodLabel, gstFor, money, startScheduler, tick, studentLines };
