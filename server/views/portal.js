// Parent portal pages: overview, child (attendance, fitness, feedback, QR),
// 8-week report, fees and AutoPay, schedule and notices, account and consents.
const store = require('../store');
const academy = require('../academy');
const billing = require('../billing');
const payments = require('../payments');
const { DAYS } = require('../schema');
const { html, raw, esc, icon, pad, initials, date: fmtDate } = require('./html');
const { layout } = require('./layout');

const db = () => store.get();
const money = billing.money;

function shell(req, { title, active, body }) {
  const f = req.parent;
  const tabs = [
    ['/portal', 'Overview', 'home'],
    ['/portal/schedule', 'Schedule & notices', 'schedule'],
    ['/portal/fees', 'Fees', 'fees'],
    ['/portal/account', 'Account & privacy', 'account'],
  ];
  return layout(req, {
    name: 'portal',
    title: title + ' · Parent portal',
    noindex: true,
    head: html`<meta name="csrf" content="${req.parentSession.csrf}">`,
    body: html`<section class="portal">
  <div class="portal__head">
    <div class="wrap portal__head-in">
      <div><span class="eyebrow eyebrow--light">Parent portal</span><h1 class="display portal__title">${title}</h1></div>
      <div class="portal__who"><span>${f.guardian}</span><button class="btn btn--glass btn--sm" type="button" data-portal-logout><span class="btn__label">Sign out</span><span class="btn__ic">${icon('right')}</span></button></div>
    </div>
    <nav class="wrap portal__tabs" aria-label="Portal">${tabs.map(([href, label, key]) => html`<a href="${href}"${key === active ? raw(' aria-current="page"') : ''}>${label}</a>`)}</nav>
  </div>
  <div class="wrap portal__body">${body}</div>
</section>`,
  });
}

function kids(f) {
  return (db().students || []).filter((s) => s.familyId === f.id && s.status !== 'left');
}
function batchesOf(st) {
  return (st.batchIds || []).map((id) => db().batches.find((b) => b.id === id)).filter(Boolean);
}
function programOf(b) {
  return db().programs.find((p) => p.id === b.program);
}
function coachOf(b) {
  return db().coaches.find((c) => c.id === b.coach);
}

function attendanceStats(st, days = 56) {
  const from = academy.addDays(academy.today(), -days);
  const recs = (db().attendance || []).filter((a) => a.studentId === st.id && a.date >= from);
  const present = recs.filter((a) => a.status !== 'absent').length;
  return { total: recs.length, present, pct: recs.length ? Math.round((present / recs.length) * 100) : null, recs };
}

function nextSession(st) {
  const t = academy.today();
  const nowMin = (() => {
    const d = new Date(Date.now() + 330 * 60e3);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  })();
  for (let i = 0; i < 14; i++) {
    const date = academy.addDays(t, i);
    const wd = academy.weekday(date);
    if (onHoliday(date, null)) continue;
    const opts = batchesOf(st)
      .filter((b) => (b.days || []).includes(wd) && !(i === 0 && academy.toMin(b.start) <= nowMin) && !onHoliday(date, b.program))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (opts.length) return { date, batch: opts[0] };
  }
  return null;
}

function notices(programIds) {
  const t = academy.today();
  return (db().notices || [])
    .filter((n) => n.published !== false && (n.until || n.date) >= academy.addDays(t, -2))
    .filter((n) => !n.program || programIds.includes(n.program))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function onHoliday(date, programId) {
  return (db().notices || []).some((n) => n.published !== false && n.type === 'Holiday' && date >= n.date && date <= (n.until || n.date) && (!n.program || n.program === programId));
}

function noticeCard(n) {
  return html`<article class="notice notice--${String(n.type || '').toLowerCase().replace(/\s+/g, '-')}">
    <span class="mono">${n.type} · ${fmtDate(n.date)}${n.until ? html` – ${fmtDate(n.until)}` : ''}</span>
    <h3>${n.title}</h3>${n.text ? html`<p>${n.text}</p>` : ''}
  </article>`;
}

/* ---------------------------------------------------------- sign in */

function authPage(req, { title, body }) {
  return layout(req, {
    name: 'portal-auth',
    title,
    noindex: true,
    body: html`<section class="pauth">
  <div class="phead__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="wrap pauth__in">
    <div class="pauth__copy">
      <span class="eyebrow eyebrow--light">Parent portal</span>
      <h1 class="display phead__title">Every session,<br><em>in your pocket</em>.</h1>
      <ul class="ticks ticks--light">
        <li>${icon('check')} Attendance and the QR check-in card</li>
        <li>${icon('check')} Fitness test graphs and the 8-week report</li>
        <li>${icon('check')} Coach feedback after sessions</li>
        <li>${icon('check')} Fees, receipts and UPI AutoPay</li>
      </ul>
    </div>
    ${body}
  </div>
</section>`,
  });
}

function login(req) {
  return authPage(req, {
    title: 'Parent portal sign in',
    body: html`<form class="bezel form-shell pauth__form" data-portal-login data-next="${String(req.query.next || '/portal').startsWith('/portal') ? req.query.next || '/portal' : '/portal'}" novalidate>
      <div class="bezel__core form-card">
        <h2 class="form-title">Sign in</h2>
        <div class="form-grid form-grid--one">
          <div class="field"><label for="pl-c">Registered mobile or email</label><input id="pl-c" name="contact" autocomplete="username" required></div>
          <div class="field"><label for="pl-p">Password</label><input id="pl-p" name="password" type="password" autocomplete="current-password" required></div>
        </div>
        <div class="form-foot">
          <button class="btn btn--primary" type="submit"><span class="btn__label">Sign in</span><span class="btn__ic">${icon('arrow')}</span></button>
          <button class="link-btn" type="button" data-portal-forgot>Forgot password?</button>
          <p class="form-msg" role="status" aria-live="polite"></p>
        </div>
        <p class="pauth__note">No account yet? You get a portal invite on WhatsApp when your child’s admission is confirmed.</p>
      </div>
    </form>`,
  });
}

function setPassword(req, token) {
  return authPage(req, {
    title: 'Set your password',
    body: html`<form class="bezel form-shell pauth__form" data-portal-setpw data-token="${token}" novalidate>
      <div class="bezel__core form-card">
        <h2 class="form-title">Set your password</h2>
        <div class="form-grid form-grid--one">
          <div class="field"><label for="sp-p">New password</label><input id="sp-p" name="password" type="password" autocomplete="new-password" minlength="8" required><span class="field__hint">At least 8 characters.</span></div>
        </div>
        <div class="form-foot">
          <button class="btn btn--primary" type="submit"><span class="btn__label">Save and open portal</span><span class="btn__ic">${icon('arrow')}</span></button>
          <p class="form-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </form>`,
  });
}

/* --------------------------------------------------------- overview */

function home(req) {
  const f = req.parent;
  const children = kids(f);
  const due = billing.dueFor(f.id);
  const programIds = [...new Set(children.flatMap((c) => batchesOf(c).map((b) => b.program)))];
  const ns = notices(programIds).slice(0, 3);
  const body = html`
  <div class="pgrid-portal">
    <div class="pcards">
      ${children.length
        ? children.map((c) => {
            const st = attendanceStats(c);
            const next = nextSession(c);
            const bs = batchesOf(c);
            return html`<a class="bezel kidcard" href="/portal/child/${c.id}"><div class="bezel__core">
              <div class="kidcard__top">
                <span class="kidcard__mono display">${initials(c.name)}</span>
                <div><h2>${c.name}</h2><p>${bs.map((b) => `${(programOf(b) || {}).name} · ${b.name}`).join(', ') || 'Not in a batch yet'}</p></div>
                <span class="kidcard__go">${icon('arrow')}</span>
              </div>
              <div class="kidcard__stats">
                <div><span class="mono">Attendance · 8 wks</span><b>${st.pct == null ? '–' : st.pct + '%'}</b></div>
                <div><span class="mono">Next session</span><b>${next ? `${academy.humanDate(next.date).split(',')[0]} ${academy.time12(next.batch.start)}` : '–'}</b></div>
                <div><span class="mono">Check-in code</span><b class="mono">${c.code}</b></div>
              </div>
            </div></a>`;
          })
        : html`<div class="bezel"><div class="bezel__core form-card"><p>No athletes are linked to this account yet. Please contact the front desk.</p></div></div>`}
    </div>
    <aside class="pside">
      <a class="bezel duecard${due ? ' duecard--due' : ''}" href="/portal/fees"><div class="bezel__core">
        <span class="mono">${due ? 'Amount due' : 'Fees'}</span>
        <b class="display">${due ? money(due) : 'All paid'}</b>
        <span>${f.autopay && f.autopay.status === 'active' ? 'UPI AutoPay is on' : due ? 'Pay online in a few taps' : 'Thank you!'}</span>
      </div></a>
      <div class="pside__box"><h2 class="mono">Notices</h2>${ns.length ? ns.map(noticeCard) : html`<p class="muted">No notices right now.</p>`}<a class="link-arrow" href="/portal/schedule">Schedule & all notices ${icon('arrow')}</a></div>
    </aside>
  </div>`;
  return shell(req, { title: `Hello, ${String(f.guardian).split(' ')[0]}`, active: 'home', body });
}

/* ------------------------------------------------------------ child */

const METRICS = [
  { key: 'sprint20', label: '20 m sprint', unit: 's', lowerBetter: true },
  { key: 'broadJump', label: 'Standing broad jump', unit: 'cm' },
  { key: 'plank', label: 'Plank hold', unit: 's' },
  { key: 'beep', label: 'Beep test', unit: 'level' },
];

function sparkline(points, m) {
  if (!points.length) return '';
  const W = 280, H = 90, P = 14;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xy = points.map((p, i) => [P + (points.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (points.length - 1)), H - P - ((m.lowerBetter ? max - p.v : p.v - min) / span) * (H - 2 * P)]);
  const d = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return raw(`<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.label)} over time: ${esc(points.map((p) => p.v + ' ' + m.unit).join(', '))}">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === xy.length - 1 ? 5 : 3.5}" class="${i === xy.length - 1 ? 'spark__last' : ''}"/><text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle">${esc(points[i].v)}</text>`).join('')}
  </svg>`);
}

function fitnessFor(st) {
  return (db().fitness || []).filter((x) => x.studentId === st.id).sort((a, b) => a.date.localeCompare(b.date));
}
function feedbackFor(st) {
  return (db().feedback || []).filter((x) => x.studentId === st.id && x.visible !== false).sort((a, b) => b.date.localeCompare(a.date));
}

function attendanceCalendar(st) {
  const stats = attendanceStats(st, 56);
  const byDate = new Map(stats.recs.map((r) => [r.date, r.status]));
  const t = academy.today();
  const start = academy.addDays(t, -55);
  // Align to Monday.
  const wdIdx = (ymd) => (new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const first = academy.addDays(start, -wdIdx(start));
  const cells = [];
  for (let d = first; d <= t; d = academy.addDays(d, 1)) cells.push(d);
  return html`<div class="cal" role="img" aria-label="Attendance for the last 8 weeks: ${stats.present} of ${stats.total} sessions">
    ${DAYS.map((d) => html`<span class="cal__h mono">${d[0]}</span>`)}
    ${cells.map((d) => {
      const s = byDate.get(d);
      return html`<span class="cal__d${s ? ' is-' + s : ''}${d < start ? ' is-out' : ''}" title="${d}${s ? ': ' + s : ''}">${Number(d.slice(8))}</span>`;
    })}
  </div>
  <div class="cal__legend mono"><span><i class="is-present"></i>Present</span><span><i class="is-late"></i>Late</span><span><i class="is-absent"></i>Absent</span></div>`;
}

function child(req, id) {
  const f = req.parent;
  const st = kids(f).find((s) => s.id === id);
  if (!st) return null;
  const stats = attendanceStats(st);
  const fit = fitnessFor(st);
  const fb = feedbackFor(st);
  const bs = batchesOf(st);
  const body = html`
  <a class="crumb crumb--dark mono" href="/portal">${icon('left')} Overview</a>
  <div class="child">
    <div class="child__main">
      <section class="pbox">
        <div class="pbox__head"><h2 class="pbox__title">Attendance</h2><span class="mono">${stats.pct == null ? 'No sessions yet' : `${stats.present}/${stats.total} sessions · ${stats.pct}%`}</span></div>
        ${attendanceCalendar(st)}
      </section>
      <section class="pbox">
        <div class="pbox__head"><h2 class="pbox__title">Fitness tests</h2><span class="actions"><a class="btn btn--ink btn--sm" href="/portal/report/${st.id}"><span class="btn__label">8-week report</span><span class="btn__ic">${icon('arrow')}</span></a><a class="btn btn--primary btn--sm" href="/portal/report/${st.id}.pdf" download><span class="btn__label">PDF</span><span class="btn__ic">${icon('arrow')}</span></a></span></div>
        ${fit.length
          ? html`<div class="metrics">${METRICS.map((m) => {
              const pts = fit.filter((x) => x[m.key] != null && x[m.key] !== '').map((x) => ({ v: x[m.key], d: x.date }));
              const last = pts[pts.length - 1], prev = pts[pts.length - 2];
              const better = last && prev ? (m.lowerBetter ? last.v < prev.v : last.v > prev.v) : null;
              return html`<div class="metric"><div class="metric__top"><span>${m.label}</span>${last ? html`<b>${last.v} <small>${m.unit}</small></b>` : ''}</div>${sparkline(pts, m)}${better != null ? html`<span class="metric__delta ${better ? 'up' : 'down'}">${better ? '▲ Improved' : '▼ Slower than last test'} since ${fmtDate(prev.d)}</span>` : ''}</div>`;
            })}</div>`
          : html`<p class="muted">The first fitness test happens in the athlete’s first fortnight.</p>`}
      </section>
      <section class="pbox">
        <div class="pbox__head"><h2 class="pbox__title">Coach feedback</h2></div>
        ${fb.length
          ? html`<ol class="feed-list">${fb.map((x) => html`<li><div class="feed-list__meta mono"><span>${x.by}</span><span>${fmtDate(x.date)}</span>${x.effort ? html`<span title="Effort">${'●'.repeat(x.effort)}${'○'.repeat(5 - x.effort)}</span>` : ''}</div><p>${x.text}</p></li>`)}</ol>`
          : html`<p class="muted">No feedback yet.</p>`}
      </section>
    </div>
    <aside class="child__side">
      <div class="bezel qrcard"><div class="bezel__core">
        <span class="mono">Check-in card</span>
        <h2 class="qrcard__name">${st.name}</h2>
        <img src="/portal/qr/${st.id}.svg" alt="QR code for check-in, code ${st.code}" width="200" height="200">
        <b class="mono qrcard__code">${st.code}</b>
        <p>Show this at the gate or to your coach to mark attendance.</p>
      </div></div>
      <div class="pbox">
        <h2 class="pbox__title pbox__title--sm">Batches</h2>
        ${bs.length
          ? bs.map((b) => {
              const c = coachOf(b);
              return html`<div class="mini-batch"><b>${(programOf(b) || {}).name} · ${b.name}</b><span class="days">${DAYS.map((d) => html`<i class="${(b.days || []).includes(d) ? 'on' : ''}">${d[0]}</i>`)}</span><span>${academy.time12(b.start)} – ${academy.time12(b.end)} · ${b.venue}</span>${c ? html`<span>Coach: ${c.name}</span>` : ''}</div>`;
            })
          : html`<p class="muted">Not in a batch yet.</p>`}
      </div>
    </aside>
  </div>`;
  return shell(req, { title: st.name, active: 'home', body });
}

/* ----------------------------------------------------------- report */

function report(req, id) {
  const f = req.parent;
  const st = kids(f).find((s) => s.id === id);
  if (!st) return null;
  const s = db().settings;
  const stats = attendanceStats(st, 56);
  const fit = fitnessFor(st);
  const last = fit[fit.length - 1], prev = fit[fit.length - 2];
  const fb = feedbackFor(st).filter((x) => x.date >= academy.addDays(academy.today(), -56));
  const bs = batchesOf(st);
  return html`<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>8-week report · ${st.name}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/css/print.css">
</head><body>
<div class="doc">
  <div class="doc__bar noprint"><a href="/portal/child/${st.id}">← Back</a><span><a class="docbtn" href="/portal/report/${st.id}.pdf" download>Download PDF</a><button type="button" class="ghost" data-print>Print</button></span></div>
  <header class="doc__head">
    <div><b class="doc__brand">${s.shortName || s.name}</b><span>${s.name}</span></div>
    <div class="doc__right"><span class="doc__kicker">8-week progress report</span><span>${fmtDate(academy.addDays(academy.today(), -56))} – ${fmtDate(academy.today())}</span></div>
  </header>
  <section class="doc__athlete">
    <h1>${st.name}</h1>
    <p>${bs.map((b) => `${(programOf(b) || {}).name} · ${b.name}`).join(' · ')}${st.dob ? ` · Born ${fmtDate(st.dob)}` : ''} · ID ${st.code}</p>
  </section>
  <section class="doc__kpis">
    <div><span>Attendance</span><b>${stats.pct == null ? '–' : stats.pct + '%'}</b><small>${stats.present} of ${stats.total} sessions</small></div>
    <div><span>Tests taken</span><b>${fit.length}</b><small>${last ? 'Latest ' + fmtDate(last.date) : ''}</small></div>
    <div><span>Coach notes</span><b>${fb.length}</b><small>in this period</small></div>
  </section>
  <h2>Fitness</h2>
  <table class="doc__table">
    <thead><tr><th>Test</th><th>Previous${prev ? html`<br><small>${fmtDate(prev.date)}</small>` : ''}</th><th>Latest${last ? html`<br><small>${fmtDate(last.date)}</small>` : ''}</th><th>Change</th></tr></thead>
    <tbody>${METRICS.map((m) => {
      const a = prev && prev[m.key], b = last && last[m.key];
      const diff = a != null && b != null ? Math.round((b - a) * 100) / 100 : null;
      const good = diff != null && (m.lowerBetter ? diff < 0 : diff > 0);
      return html`<tr><td>${m.label}</td><td>${a != null ? `${a} ${m.unit}` : '–'}</td><td><b>${b != null ? `${b} ${m.unit}` : '–'}</b></td><td class="${diff == null ? '' : good ? 'good' : 'bad'}">${diff == null ? '–' : `${diff > 0 ? '+' : ''}${diff} ${m.unit}`}</td></tr>`;
    })}</tbody>
  </table>
  ${last && last.notes ? html`<p class="doc__note"><b>Tester’s note:</b> ${last.notes}</p>` : ''}
  <h2>Coach feedback</h2>
  ${fb.length ? fb.map((x) => html`<div class="doc__fb"><span>${fmtDate(x.date)} · ${x.by}</span><p>${x.text}</p></div>`) : html`<p>No feedback in this period.</p>`}
  <footer class="doc__foot">${s.name} · ${String(s.address || '').replace(/\n/g, ', ')} · ${s.phone} · Generated ${fmtDate(academy.today())}</footer>
</div>
<script src="/js/print.js"></script>
</body></html>`;
}

/* ------------------------------------------------------------- fees */

function fees(req) {
  const f = req.parent;
  const invs = (db().invoices || []).filter((i) => i.familyId === f.id && i.status !== 'void');
  const due = invs.filter((i) => i.status === 'unpaid');
  const paid = invs.filter((i) => i.status === 'paid');
  const monthly = billing.monthlyFor(f.id);
  const ap = f.autopay || { status: 'off' };
  const cfg = payments.publicConfig();
  const body = html`
  ${cfg.provider === 'demo' ? html`<p class="demo-note">${icon('bolt')} Demo mode: payments are simulated until Razorpay keys are added on the server.</p>` : ''}
  <div class="fees">
    <section class="pbox">
      <div class="pbox__head"><h2 class="pbox__title">To pay</h2><span class="mono">${due.length ? money(billing.dueFor(f.id)) : 'Nothing due'}</span></div>
      ${due.length
        ? html`<div class="inv-list">${due.map((i) => invRow(i, true))}</div>`
        : html`<p class="paid-all">${icon('check')} All fees are paid. Thank you!</p>`}
    </section>
    <aside class="bezel autopay${ap.status === 'active' ? ' autopay--on' : ''}"><div class="bezel__core">
      <span class="mono">UPI AutoPay</span>
      <h2 class="display">${ap.status === 'active' ? 'AutoPay is on' : 'Never miss a due date'}</h2>
      <p>${ap.status === 'active'
        ? `Your monthly fee of ${money(ap.amount)} is collected automatically from your UPI app or card. You can cancel any time.`
        : `Approve a mandate once in your UPI app (GPay, PhonePe, Paytm, BHIM) and your monthly fee${monthly ? ` of ${money(monthly)}` : ''} is paid automatically.`}</p>
      ${ap.status === 'active'
        ? html`<button class="btn btn--ghost btn--sm" type="button" data-autopay-cancel><span class="btn__label">Cancel AutoPay</span><span class="btn__ic">${icon('close')}</span></button>`
        : monthly
          ? html`<button class="btn btn--volt" type="button" data-autopay-start><span class="btn__label">Set up AutoPay</span><span class="btn__ic">${icon('arrow')}</span></button>`
          : ''}
      <p class="form-msg" role="status" aria-live="polite"></p>
    </div></aside>
  </div>
  <section class="pbox">
    <div class="pbox__head"><h2 class="pbox__title">Payment history</h2><span class="mono">${paid.length} receipts</span></div>
    ${paid.length ? html`<div class="inv-list">${paid.map((i) => invRow(i, false))}</div>` : html`<p class="muted">No payments yet.</p>`}
  </section>
  <p class="fineprint">Monthly fee: ${monthly ? money(monthly) : '–'}${db().settings.siblingDiscount ? ` (includes the ${db().settings.siblingDiscount}% sibling discount where it applies)` : ''}. Questions about fees? Call ${db().settings.phone}. See the <a href="/refund-policy">refund & cancellation policy</a>.</p>`;
  return shell(req, { title: 'Fees', active: 'fees', body });
}

function invRow(i, payable) {
  return html`<div class="inv">
    <div class="inv__main"><b>${i.period ? billing.periodLabel(i.period) : i.lines[0] ? i.lines[0].label : 'Invoice'}</b><span class="mono">${i.number} · ${i.status === 'paid' ? `Paid ${fmtDate(i.paidAt)}${i.payment && i.payment.method ? ' · ' + i.payment.method : ''}` : `Due ${fmtDate(i.dueDate)}`}</span></div>
    <b class="inv__amt">${money(i.total)}</b>
    <a class="btn btn--ink btn--sm" href="/invoice/${i.id}.pdf?t=${i.token}" download><span class="btn__label">${i.status === 'paid' ? 'Receipt PDF' : 'Invoice PDF'}</span><span class="btn__ic">${icon('arrow')}</span></a>
    ${payable ? html`<button class="btn btn--primary btn--sm" type="button" data-pay-invoice="${i.id}" data-token="${i.token}"><span class="btn__label">Pay ${money(i.total)}</span><span class="btn__ic">${icon('arrow')}</span></button>` : ''}
  </div>`;
}

/* --------------------------------------------------------- schedule */

function schedule(req) {
  const f = req.parent;
  const children = kids(f);
  const programIds = [...new Set(children.flatMap((c) => batchesOf(c).map((b) => b.program)))];
  const ns = notices(programIds);
  const t = academy.today();
  const week = Array.from({ length: 7 }, (_, i) => academy.addDays(t, i));
  const body = html`
  <div class="fees">
    <section class="pbox">
      <div class="pbox__head"><h2 class="pbox__title">Next 7 days</h2></div>
      <div class="agenda">${week.map((d) => {
        const wd = academy.weekday(d);
        const items = children.flatMap((c) => batchesOf(c).filter((b) => (b.days || []).includes(wd)).map((b) => ({ c, b }))).sort((a, b) => a.b.start.localeCompare(b.b.start));
        const hol = onHoliday(d, null);
        return html`<div class="agenda__day${hol ? ' is-holiday' : ''}"><span class="agenda__date"><b class="display">${Number(d.slice(8))}</b><span class="mono">${wd}</span></span><div>${hol
          ? html`<p class="agenda__hol">Holiday: no training</p>`
          : items.length
            ? items.map(({ c, b }) => html`<div class="agenda__item"><b>${academy.time12(b.start)}</b> ${c.name.split(' ')[0]} · ${(programOf(b) || {}).name} ${b.name} <span class="muted">· ${b.venue}</span>${onHoliday(d, b.program) ? html` <span class="badge">Off</span>` : ''}</div>`)
            : html`<p class="muted">Rest day</p>`}</div></div>`;
      })}</div>
    </section>
    <aside class="pbox"><h2 class="pbox__title">Notices</h2>${ns.length ? ns.map(noticeCard) : html`<p class="muted">No notices right now.</p>`}</aside>
  </div>`;
  return shell(req, { title: 'Schedule & notices', active: 'schedule', body });
}

/* ---------------------------------------------------------- account */

function account(req) {
  const f = req.parent;
  const children = kids(f);
  const s = db().settings;
  const dataConsent = (f.consents || []).filter((c) => c.type === 'data').slice(-1)[0];
  const body = html`
  <div class="fees">
    <section class="pbox">
      <h2 class="pbox__title">Consents</h2>
      <p class="muted">Under the Digital Personal Data Protection Act, 2023 you control how your family’s data is used. Changes are saved immediately and recorded.</p>
      <div class="consent">
        <div><b>Processing my child’s data for training</b><span>${dataConsent ? `Given ${fmtDate(dataConsent.at)} · version ${dataConsent.version} · verified by ${dataConsent.method === 'otp' ? 'one-time code' : dataConsent.method}` : 'Recorded at admission'}. To withdraw it (this ends training), use a privacy request below.</span></div>
      </div>
      ${children.map((c) => html`<label class="consent consent--toggle"><div><b>Photos & videos of ${c.name.split(' ')[0]} on the website and social media</b><span>Optional. Coaching videos inside the academy are not affected. <a href="/photo-consent">Read more</a></span></div><input type="checkbox" class="toggle" data-consent="photo" data-student="${c.id}"${c.photoConsent ? raw(' checked') : ''}></label>`)}
      <label class="consent consent--toggle"><div><b>Academy news and offers on WhatsApp/email</b><span>Optional. Fee reminders and safety notices are always sent.</span></div><input type="checkbox" class="toggle" data-consent="marketing"${f.marketingConsent ? raw(' checked') : ''}></label>
    </section>
    <aside class="grid-gap">
      <form class="pbox" data-portal-profile novalidate>
        <h2 class="pbox__title pbox__title--sm">Contact</h2>
        <div class="field"><label>Mobile</label><input value="${f.phone}" disabled></div>
        <div class="field"><label for="ac-e">Email</label><input id="ac-e" name="email" type="email" value="${f.email || ''}"></div>
        <div class="form-foot"><button class="btn btn--ink btn--sm" type="submit"><span class="btn__label">Save</span><span class="btn__ic">${icon('check')}</span></button><p class="form-msg" role="status"></p></div>
      </form>
      <form class="pbox" data-portal-password novalidate>
        <h2 class="pbox__title pbox__title--sm">Password</h2>
        <div class="field"><label for="ac-c">Current</label><input id="ac-c" name="current" type="password" autocomplete="current-password"></div>
        <div class="field"><label for="ac-n">New</label><input id="ac-n" name="next" type="password" autocomplete="new-password"></div>
        <div class="form-foot"><button class="btn btn--ink btn--sm" type="submit"><span class="btn__label">Change</span><span class="btn__ic">${icon('check')}</span></button><p class="form-msg" role="status"></p></div>
      </form>
    </aside>
  </div>
  <section class="pbox">
    <h2 class="pbox__title">Your data rights</h2>
    <p class="muted">Ask for a copy of your data, a correction, deletion, or to withdraw consent. We respond within 30 days. Grievance Officer: ${s.grievanceName}${s.grievanceEmail ? html` · <a href="mailto:${s.grievanceEmail}">${s.grievanceEmail}</a>` : ''}.</p>
    <a class="btn btn--ink" href="/data-request?phone=${encodeURIComponent(f.phone)}"><span class="btn__label">Make a privacy request</span><span class="btn__ic">${icon('arrow')}</span></a>
  </section>`;
  return shell(req, { title: 'Account & privacy', active: 'account', body });
}

module.exports = { login, setPassword, home, child, report, fees, schedule, account };
