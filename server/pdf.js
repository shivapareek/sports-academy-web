// Real PDF files (not the browser's print dialog) for GST invoices/receipts and
// the 8-week progress report. Built with PDFKit and embedded Archivo, which has
// the rupee sign.
const path = require('path');
const PDFDocument = require('pdfkit');
const store = require('./store');
const academy = require('./academy');

const FONTS = path.join(__dirname, 'fonts');
const INK = '#0e0e0d';
const MUTE = '#75726a';
const LINE = '#e3e0d8';
const TRACK = '#e0482b';
const GREEN = '#2f7a43';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function date(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[m[2] - 1]} ${m[1]}` : '';
}
function periodLabel(p) {
  const [y, m] = String(p).split('-').map(Number);
  return y ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}` : '';
}

function words(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  const parts = [];
  const cr = Math.floor(rupees / 1e7), lk = Math.floor((rupees % 1e7) / 1e5), th = Math.floor((rupees % 1e5) / 1e3), rest = rupees % 1e3;
  if (cr) parts.push(three(cr) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (rest) parts.push(three(rest));
  return `Rupees ${parts.join(' ') || 'Zero'}${paise ? ` and ${two(paise)} Paise` : ''} only`;
}

function newDoc(title) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: title, Author: store.get().settings.name, Creator: store.get().settings.name } });
  doc.registerFont('R', path.join(FONTS, 'Archivo_400Regular.ttf'));
  doc.registerFont('M', path.join(FONTS, 'Archivo_500Medium.ttf'));
  doc.registerFont('SB', path.join(FONTS, 'Archivo_600SemiBold.ttf'));
  doc.registerFont('XB', path.join(FONTS, 'Archivo_800ExtraBold.ttf'));
  doc.registerFont('MONO', path.join(FONTS, 'JetBrainsMono_500Medium.ttf'));
  doc.font('R').fontSize(10).fillColor(INK);
  return doc;
}

const W = 595.28; // A4 width in points
const L = 48;
const R = W - 48;

function label(doc, text, x, y, opts = {}) {
  doc.font('MONO').fontSize(7).fillColor(opts.color || MUTE).text(String(text).toUpperCase(), x, y, { characterSpacing: 0.8, ...opts });
  doc.fillColor(INK);
}

function header(doc, kicker, rightLines) {
  const s = store.get().settings;
  doc.font('XB').fontSize(30).fillColor(INK).text(s.shortName || s.name, L, 48, { characterSpacing: 0.5 });
  doc.font('R').fontSize(8.5).fillColor('#3a3935');
  const left = [s.legalName || s.name, String(s.address || '').replace(/\n/g, ', '), `${s.phone} · ${s.email}`];
  if (s.gstin && kicker !== 'report') left.push(`GSTIN: ${s.gstin}`);
  let y = 86;
  for (const l of left) {
    doc.text(l, L, y, { width: 290 });
    y = doc.y + 1;
  }
  doc.font('XB').fontSize(15).fillColor(TRACK).text(String(rightLines.kicker).toUpperCase(), 300, 52, { width: R - 300, align: 'right' });
  doc.font('R').fontSize(9).fillColor(INK);
  let ry = 74;
  for (const l of rightLines.lines) {
    doc.text(l, 300, ry, { width: R - 300, align: 'right' });
    ry = doc.y + 2;
  }
  const bottom = Math.max(y, ry) + 12;
  doc.moveTo(L, bottom).lineTo(R, bottom).lineWidth(1.6).strokeColor(INK).stroke();
  return bottom + 18;
}

function footer(doc, text) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing below the margin must not add a page
    doc.moveTo(L, 800).lineTo(R, 800).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('R').fontSize(7.5).fillColor(MUTE).text(text, L, 806, { width: R - L - 60, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, R - 60, 806, { width: 60, align: 'right', lineBreak: false });
  }
}

function stamp(doc, text, x, y, color) {
  doc.save();
  doc.rotate(-3, { origin: [x, y] });
  doc.font('MONO').fontSize(9);
  const w = doc.widthOfString(text) + 16;
  doc.roundedRect(x, y, w, 20, 4).lineWidth(1.6).strokeColor(color).stroke();
  doc.fillColor(color).text(text, x + 8, y + 5.5, { lineBreak: false });
  doc.restore();
  doc.fillColor(INK);
}

/* ----------------------------------------------------------- invoice */

function invoiceDoc(inv) {
  const s = store.get().settings;
  const hasGst = inv.gst && inv.gst.rate;
  const paid = inv.status === 'paid';
  const doc = newDoc(`${hasGst ? 'Tax invoice' : 'Invoice'} ${inv.number}`);
  const lines = [`No. ${inv.number}`, `Date: ${date(inv.date)}`, paid ? `Paid: ${date(inv.paidAt)}` : `Due: ${date(inv.dueDate)}`];
  if (hasGst) lines.push(`Place of supply: ${s.stateName}`);
  let y = header(doc, 'invoice', { kicker: `${hasGst ? 'Tax invoice' : 'Invoice'}${paid ? ' · Receipt' : ''}`, lines });

  label(doc, 'Bill to', L, y);
  doc.font('XB').fontSize(18).text(String(inv.billTo.name || '').toUpperCase(), L, y + 12, { width: 320 });
  doc.font('R').fontSize(9.5).fillColor('#3a3935').text([inv.billTo.phone, inv.billTo.email].filter(Boolean).join(' · '), L, doc.y + 2);
  doc.fillColor(INK);
  y = doc.y + 10;
  if (inv.status === 'void') stamp(doc, 'CANCELLED', L, y, TRACK);
  else if (paid) stamp(doc, `PAID · ${(inv.payment && inv.payment.method) || ''}${inv.payment && inv.payment.id ? ` · Ref ${inv.payment.id}` : ''}`, L, y, GREEN);
  y += inv.status === 'unpaid' ? 8 : 36;

  // Table
  const cols = hasGst ? { n: L, d: L + 22, sac: 400, amt: R } : { n: L, d: L + 22, amt: R };
  doc.moveTo(L, y + 14).lineTo(R, y + 14).lineWidth(0.8).strokeColor(INK).stroke();
  label(doc, '#', cols.n, y + 3);
  label(doc, 'Description', cols.d, y + 3);
  if (hasGst) label(doc, 'SAC', cols.sac, y + 3);
  label(doc, 'Amount', R - 100, y + 3, { width: 100, align: 'right' });
  y += 22;
  const row = (n, desc, sub, sac, amt, bold) => {
    doc.font(bold ? 'SB' : 'R').fontSize(9.5).fillColor(INK);
    doc.text(n, cols.n, y, { width: 18 });
    doc.text(desc, cols.d, y, { width: (hasGst ? cols.sac : R - 110) - cols.d - 10 });
    let bottom = doc.y;
    if (sub) {
      doc.font('R').fontSize(8).fillColor(MUTE).text(sub, cols.d, bottom + 1, { width: 300 });
      bottom = doc.y;
      doc.fillColor(INK);
    }
    doc.font(bold ? 'SB' : 'R').fontSize(9.5);
    if (hasGst && sac) doc.text(sac, cols.sac, y);
    doc.text(amt, R - 110, y, { width: 110, align: 'right' });
    y = Math.max(bottom, doc.y) + 7;
    doc.moveTo(L, y - 3).lineTo(R, y - 3).lineWidth(0.5).strokeColor(LINE).stroke();
  };
  inv.lines.forEach((l, i) => row(String(i + 1), l.label, inv.kind === 'fee' && inv.period ? periodLabel(inv.period) : '', s.sac, money(l.amount)));
  if (inv.discount) row('', inv.discount.label, '', '', '− ' + money(inv.discount.amount));

  // Totals
  y += 6;
  const total = (k, v, bold) => {
    doc.font(bold ? 'XB' : 'R').fontSize(bold ? 13 : 9.5).fillColor(INK);
    doc.text(k, 300, y, { width: R - 300 - 120, align: 'right' });
    doc.text(v, R - 120, y, { width: 120, align: 'right' });
    y = doc.y + 5;
  };
  if (hasGst) {
    total('Taxable value', money(inv.gst.taxable));
    total(`CGST @ ${inv.gst.rate / 2}%`, money(inv.gst.cgst));
    total(`SGST @ ${inv.gst.rate / 2}%`, money(inv.gst.sgst));
  }
  doc.moveTo(330, y + 2).lineTo(R, y + 2).lineWidth(1.4).strokeColor(INK).stroke();
  y += 9;
  total('Total', money(inv.total), true);

  y += 10;
  doc.font('R').fontSize(9).text('Amount in words: ', L, y, { continued: true }).font('SB').text(words(inv.total));
  if (!s.gstin) doc.font('R').fillColor(MUTE).text('Not registered under GST.', L, doc.y + 6);
  if (hasGst) doc.font('R').fillColor(MUTE).fontSize(8).text(`Tax is ${s.pricesIncludeGst !== false ? 'included in the fee' : 'added to the fee'}. Reverse charge: No.`, L, doc.y + 6);
  doc.fillColor(INK);
  footer(doc, `${s.name} · This is a computer-generated document and needs no signature.`);
  return doc;
}

/* ------------------------------------------------------------ report */

const METRICS = [
  { key: 'sprint20', label: '20 m sprint', unit: 's', lowerBetter: true },
  { key: 'broadJump', label: 'Standing broad jump', unit: 'cm' },
  { key: 'plank', label: 'Plank hold', unit: 's' },
  { key: 'beep', label: 'Beep test', unit: 'level' },
];

function reportDoc(st) {
  const d = store.get();
  const s = d.settings;
  const from = academy.addDays(academy.today(), -56);
  const att = d.attendance.filter((a) => a.studentId === st.id && a.date >= from);
  const present = att.filter((a) => a.status !== 'absent').length;
  const pct = att.length ? Math.round((present / att.length) * 100) : null;
  const fit = d.fitness.filter((x) => x.studentId === st.id).sort((a, b) => a.date.localeCompare(b.date));
  const last = fit[fit.length - 1], prev = fit[fit.length - 2];
  const fb = d.feedback.filter((x) => x.studentId === st.id && x.visible !== false && x.date >= from).sort((a, b) => b.date.localeCompare(a.date));
  const batches = (st.batchIds || []).map((id) => d.batches.find((b) => b.id === id)).filter(Boolean);
  const prog = (b) => (d.programs.find((p) => p.id === b.program) || {}).name;

  const doc = newDoc(`8-week report · ${st.name}`);
  let y = header(doc, 'report', { kicker: '8-week progress report', lines: [`${date(from)} – ${date(academy.today())}`] });
  doc.font('XB').fontSize(24).text(st.name.toUpperCase(), L, y);
  doc.font('R').fontSize(9.5).fillColor('#3a3935').text([batches.map((b) => `${prog(b)} · ${b.name}`).join(' · '), st.dob ? `Born ${date(st.dob)}` : '', `ID ${st.code}`].filter(Boolean).join(' · '), L, doc.y + 2);
  doc.fillColor(INK);
  y = doc.y + 16;

  // KPI tiles
  const tiles = [
    ['Attendance', pct == null ? '–' : `${pct}%`, `${present} of ${att.length} sessions`],
    ['Tests taken', String(fit.length), last ? `Latest ${date(last.date)}` : ''],
    ['Coach notes', String(fb.length), 'in this period'],
  ];
  const tw = (R - L - 20) / 3;
  tiles.forEach(([k, v, sub], i) => {
    const x = L + i * (tw + 10);
    doc.roundedRect(x, y, tw, 66, 8).fill('#f3f1ec');
    doc.fillColor(INK);
    label(doc, k, x + 12, y + 10);
    doc.font('XB').fontSize(24).text(v, x + 12, y + 22);
    doc.font('R').fontSize(8).fillColor(MUTE).text(sub, x + 12, y + 50, { width: tw - 24 });
    doc.fillColor(INK);
  });
  y += 88;

  // Attendance strip: one square per session, oldest first.
  if (att.length) {
    label(doc, 'Sessions (oldest → latest)', L, y);
    y += 12;
    att.sort((a, b) => a.date.localeCompare(b.date)).forEach((a, i) => {
      const col = a.status === 'present' ? INK : a.status === 'late' ? '#c8e43a' : TRACK;
      doc.roundedRect(L + (i % 40) * 12.4, y + Math.floor(i / 40) * 12.4, 9.5, 9.5, 2).fill(col);
    });
    y += Math.ceil(att.length / 40) * 12.4 + 8;
    doc.fillColor(INK);
  }

  // Fitness table + sparklines
  doc.font('XB').fontSize(13).text('FITNESS', L, y + 6);
  y = doc.y + 6;
  const c = [L, L + 160, L + 250, L + 340, L + 410];
  doc.moveTo(L, y + 13).lineTo(R, y + 13).lineWidth(0.8).strokeColor(INK).stroke();
  ['Test', 'Previous', 'Latest', 'Change', 'Trend'].forEach((h, i) => label(doc, h, c[i], y + 2, { width: (c[i + 1] || R) - c[i] - 6 }));
  y += 20;
  for (const m of METRICS) {
    const a = prev && prev[m.key], b = last && last[m.key];
    const diff = a != null && b != null ? Math.round((b - a) * 100) / 100 : null;
    const good = diff != null && (m.lowerBetter ? diff < 0 : diff > 0);
    doc.font('R').fontSize(9.5).fillColor(INK).text(m.label, c[0], y);
    doc.text(a != null ? `${a} ${m.unit}` : '–', c[1], y);
    doc.font('SB').text(b != null ? `${b} ${m.unit}` : '–', c[2], y);
    doc.font('SB').fillColor(diff == null ? MUTE : good ? GREEN : TRACK).text(diff == null ? '–' : `${diff > 0 ? '+' : ''}${diff} ${m.unit}`, c[3], y);
    // Sparkline of every test so far.
    const pts = fit.map((x) => x[m.key]).filter((v) => v != null && v !== '');
    if (pts.length > 1) {
      const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
      const sx = c[4], sw = R - c[4] - 4, sy = y - 2, sh = 14;
      pts.forEach((v, i) => {
        const px = sx + (i * sw) / (pts.length - 1);
        const py = sy + sh - ((m.lowerBetter ? max - v : v - min) / span) * sh;
        if (i === 0) doc.moveTo(px, py);
        else doc.lineTo(px, py);
      });
      doc.lineWidth(1.2).strokeColor(INK).stroke();
      const lx = sx + sw, lv = pts[pts.length - 1];
      doc.circle(lx, sy + sh - ((m.lowerBetter ? max - lv : lv - min) / span) * sh, 2.4).fill(TRACK);
    }
    doc.fillColor(INK);
    y += 22;
    doc.moveTo(L, y - 6).lineTo(R, y - 6).lineWidth(0.5).strokeColor(LINE).stroke();
  }
  if (last) {
    doc.font('R').fontSize(8).fillColor(MUTE).text(`${prev ? `Previous test ${date(prev.date)} · ` : ''}Latest test ${date(last.date)} · Trend shows every test so far; a higher line is better.`, L, y - 2, { width: R - L });
    doc.fillColor(INK);
    y = doc.y + 6;
  }
  if (last && last.notes) {
    doc.font('SB').fontSize(9).text('Tester’s note: ', L, y + 2, { continued: true }).font('R').text(last.notes, { width: R - L });
    y = doc.y + 6;
  }

  // Coach feedback
  doc.font('XB').fontSize(13).fillColor(INK).text('COACH FEEDBACK', L, y + 10);
  y = doc.y + 6;
  if (!fb.length) doc.font('R').fontSize(9.5).fillColor(MUTE).text('No feedback in this period.', L, y);
  for (const x of fb) {
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
    label(doc, `${date(x.date)} · ${x.by}${x.effort ? ' · effort ' + '●'.repeat(x.effort) : ''}`, L, y, { color: TRACK });
    doc.font('R').fontSize(9.5).fillColor(INK).text(x.text, L, y + 11, { width: R - L });
    y = doc.y + 10;
  }
  footer(doc, `${s.name} · ${s.phone} · Generated ${date(academy.today())}`);
  return doc;
}

// Stream a PDF to an HTTP response.
function send(res, doc, filename, inline) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/[^\w.-]+/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.pipe(res);
  doc.end();
}

// Build a PDF in memory (for email attachments).
function buffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = { invoiceDoc, reportDoc, send, buffer };
