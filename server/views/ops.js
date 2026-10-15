// Public pages for operations: GST invoice/receipt, facility booking, privacy
// request; plus the trust sections (affiliations, alumni, reviews, press).
const store = require('../store');
const content = require('../content');
const academy = require('../academy');
const billing = require('../billing');
const payments = require('../payments');
const reviews = require('../reviews');
const { html, raw, esc, icon, img, date: fmtDate, title, btn, pad } = require('./html');
const { layout, pageHead } = require('./layout');

const db = () => store.get();
const money = billing.money;

/* ---------------------------------------------------------- invoice */

function words(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  n = Math.floor(n);
  if (!n) return 'Zero';
  const parts = [];
  const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (cr) parts.push(three(cr) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (rest) parts.push(three(rest));
  return parts.join(' ');
}

function invoice(req, inv) {
  const s = db().settings;
  const paid = inv.status === 'paid';
  const hasGst = inv.gst && inv.gst.rate;
  const cfg = payments.publicConfig();
  return html`<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${hasGst ? 'Tax invoice' : 'Invoice'} ${inv.number}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/css/print.css">
</head><body>
<div class="doc">
  <div class="doc__bar noprint">
    <a href="${req.parent ? '/portal/fees' : '/'}">← Back</a>
    <span>
      ${inv.status === 'unpaid' ? html`<button type="button" class="pay" data-pay-invoice="${inv.id}" data-token="${inv.token}">Pay ${money(inv.total)} online</button>` : ''}
      <a class="docbtn" href="/invoice/${inv.id}.pdf?t=${inv.token}" download>Download PDF</a>
      <button type="button" class="ghost" data-print>Print</button>
    </span>
  </div>
  ${inv.status === 'unpaid' && cfg.provider === 'demo' ? html`<p class="doc__demo noprint">Demo mode: the payment is simulated until Razorpay keys are configured.</p>` : ''}
  <p class="form-msg noprint" role="status" aria-live="polite"></p>
  <header class="doc__head">
    <div>
      <b class="doc__brand">${s.shortName || s.name}</b>
      <span>${s.legalName || s.name}</span>
      <span>${String(s.address || '').replace(/\n/g, ', ')}</span>
      <span>${s.phone} · ${s.email}</span>
      ${s.gstin ? html`<span>GSTIN: <b>${s.gstin}</b></span>` : ''}
    </div>
    <div class="doc__right">
      <span class="doc__kicker">${hasGst ? 'Tax invoice' : 'Invoice'}${paid ? ' · Receipt' : ''}</span>
      <span>No. <b>${inv.number}</b></span>
      <span>Date: ${fmtDate(inv.date)}</span>
      ${paid ? html`<span>Paid: ${fmtDate(inv.paidAt)}</span>` : html`<span>Due: ${fmtDate(inv.dueDate)}</span>`}
      ${hasGst ? html`<span>Place of supply: ${s.stateName}</span>` : ''}
    </div>
  </header>
  <section class="doc__athlete">
    <span class="doc__label">Bill to</span>
    <h1 class="doc__to">${inv.billTo.name}</h1>
    <p>${inv.billTo.phone}${inv.billTo.email ? ` · ${inv.billTo.email}` : ''}</p>
    ${inv.status === 'void' ? html`<p class="doc__void">This invoice was cancelled.</p>` : paid ? html`<p class="doc__paid">PAID · ${inv.payment && inv.payment.method ? inv.payment.method : ''}${inv.payment && inv.payment.id ? ` · Ref ${inv.payment.id}` : ''}</p>` : ''}
  </section>
  <table class="doc__table">
    <thead><tr><th>#</th><th>Description</th>${hasGst ? html`<th>SAC</th>` : ''}<th class="r">Amount</th></tr></thead>
    <tbody>
      ${inv.lines.map((l, i) => html`<tr><td>${i + 1}</td><td>${l.label}${inv.period && inv.kind === 'fee' ? html`<br><small>${billing.periodLabel(inv.period)}</small>` : ''}</td>${hasGst ? html`<td>${s.sac}</td>` : ''}<td class="r">${money(l.amount)}</td></tr>`)}
      ${inv.discount ? html`<tr><td></td><td>${inv.discount.label}</td>${hasGst ? html`<td></td>` : ''}<td class="r">− ${money(inv.discount.amount)}</td></tr>` : ''}
    </tbody>
    <tfoot>
      ${hasGst
        ? html`<tr><td colspan="${hasGst ? 3 : 2}" class="r">Taxable value</td><td class="r">${money(inv.gst.taxable)}</td></tr>
          <tr><td colspan="3" class="r">CGST @ ${inv.gst.rate / 2}%</td><td class="r">${money(inv.gst.cgst)}</td></tr>
          <tr><td colspan="3" class="r">SGST @ ${inv.gst.rate / 2}%</td><td class="r">${money(inv.gst.sgst)}</td></tr>`
        : ''}
      <tr class="doc__total"><td colspan="${hasGst ? 3 : 2}" class="r">Total</td><td class="r">${money(inv.total)}</td></tr>
    </tfoot>
  </table>
  <p class="doc__words">Amount in words: <b>Rupees ${words(inv.total)} only</b></p>
  ${!s.gstin ? html`<p class="doc__note">Not registered under GST.</p>` : ''}
  <footer class="doc__foot">This is a computer-generated document and needs no signature. · <a href="/refund-policy">Refund policy</a></footer>
</div>
<script src="/js/print.js"></script>
${inv.status === 'unpaid' ? html`<script src="/js/pay.js"></script>` : ''}
</body></html>`;
}

/* ---------------------------------------------------------- booking */

function book(req) {
  const rs = content.list('resources');
  const s = db().settings;
  const cfg = payments.publicConfig();
  const body = html`
${pageHead({ eyebrow: 'Book a facility', heading: 'Your court.\nYour *hour*.', intro: `Book badminton courts, cricket nets, the football turf or a swimming lane by the hour. Pay online; the slot is yours the moment payment goes through. Bookings open ${s.bookingDaysAhead || 14} days ahead.` })}
<section class="section section--tight">
  <div class="wrap">
    ${cfg.provider === 'demo' ? html`<p class="demo-note">${icon('bolt')} Demo mode: payment is simulated until Razorpay keys are configured.</p>` : ''}
    <div class="booker" data-booker data-today="${academy.today()}" data-days="${Number(s.bookingDaysAhead) || 14}" data-hold="${Number(s.bookingHoldMinutes) || 10}">
      <div class="booker__step">
        <span class="mono booker__no">01 · Facility</span>
        <div class="rgrid">${rs.map(
          (r, i) => html`<label class="rcard"><input type="radio" name="resource" value="${r.id}" data-rate="${r.rate}" data-name="${r.name}"${i === 0 ? raw(' checked') : ''}>
          <span class="rcard__in">${r.image ? img(r.image, '', { sizes: '200px' }) : ''}<span class="rcard__body"><b>${r.name}</b><span>${money(r.rate)} / ${Number(r.slotMinutes) || 60} min</span><small>${r.capacity}</small></span></span></label>`
        )}</div>
      </div>
      <div class="booker__step">
        <span class="mono booker__no">02 · Date</span>
        <div class="dates" data-dates role="radiogroup" aria-label="Date"></div>
      </div>
      <div class="booker__step">
        <span class="mono booker__no">03 · Time <small>(pick up to 4 slots in a row)</small></span>
        <div class="slots" data-slots aria-live="polite"><p class="muted">Pick a date.</p></div>
      </div>
      <form class="bezel form-shell booker__form" data-book-form novalidate>
        <div class="bezel__core form-card">
          <div class="booker__summary" data-summary><span class="muted">No slots selected.</span></div>
          <div class="form-grid">
            <div class="field"><label for="bk-n">Your name</label><input id="bk-n" name="name" autocomplete="name" required><span class="field__err" data-err="name"></span></div>
            <div class="field"><label for="bk-p">Phone / WhatsApp</label><input id="bk-p" name="phone" type="tel" autocomplete="tel" required><span class="field__err" data-err="phone"></span></div>
            <div class="field field--full"><label for="bk-e">Email <small>(optional)</small></label><input id="bk-e" name="email" type="email" autocomplete="email"><span class="field__err" data-err="email"></span></div>
          </div>
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="form-foot">
            <button class="btn btn--primary" type="submit" disabled data-book-submit><span class="btn__label">Book & pay</span><span class="btn__ic">${icon('arrow')}</span></button>
            <p class="form-msg" role="status" aria-live="polite"></p>
          </div>
          <p class="fineprint">By booking you accept the <a href="/refund-policy">refund & cancellation policy</a>. Unpaid holds are released after ${Number(s.bookingHoldMinutes) || 10} minutes.</p>
        </div>
      </form>
    </div>
  </div>
</section>`;
  return layout(req, { name: 'book', title: 'Book a facility', description: 'Book courts, nets, turf and pool lanes by the hour.', body, head: html`<meta name="pay-provider" content="${cfg.provider}">` });
}

/* ---------------------------------------------------- privacy request */

function dataRequest(req) {
  const s = db().settings;
  const body = html`
${pageHead({ eyebrow: 'Your data, your rights', heading: 'Privacy\n*request*.', intro: 'Under the Digital Personal Data Protection Act, 2023 you can ask for a summary of your data, correct it, have it erased, withdraw consent or nominate someone. We verify your phone number first, then respond within 30 days.' })}
<section class="section section--tight">
  <div class="wrap apply">
    <div class="apply__copy">
      <span class="eyebrow">Grievance officer</span>
      <p><b>${s.grievanceName}</b><br>${s.grievanceEmail ? html`<a href="mailto:${s.grievanceEmail}">${s.grievanceEmail}</a><br>` : ''}${String(s.address || '').split('\n').map((l) => html`${l}<br>`)}</p>
      <p class="muted">Read the <a href="/privacy-policy">privacy policy</a>. If you are not satisfied with our response you can approach the Data Protection Board of India.</p>
    </div>
    <form class="bezel form-shell" data-privacy-form novalidate>
      <div class="bezel__core form-card">
        <div class="form-grid">
          <div class="field field--full"><label for="pq-t">What would you like to do?</label>
            <select id="pq-t" name="type" required><option value="">Select…</option><option value="access">Get a summary of my data</option><option value="correction">Correct my data</option><option value="erasure">Erase my data</option><option value="withdraw-consent">Withdraw consent</option><option value="nominate">Nominate someone to act for me</option><option value="grievance">Raise a grievance</option></select>
            <span class="field__err" data-err="type"></span></div>
          <div class="field"><label for="pq-n">Your name</label><input id="pq-n" name="name" autocomplete="name" required><span class="field__err" data-err="name"></span></div>
          <div class="field"><label for="pq-e">Email <small>(optional)</small></label><input id="pq-e" name="email" type="email" autocomplete="email"></div>
          <div class="field field--full"><label for="pq-d">Details</label><textarea id="pq-d" name="details" rows="4" placeholder="Which athlete, what should change, who you nominate…"></textarea></div>
          ${otpBlock('privacy', String(req.query.phone || ''))}
        </div>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-foot">
          <button class="btn btn--primary" type="submit"><span class="btn__label">Send request</span><span class="btn__ic">${icon('arrow')}</span></button>
          <p class="form-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </form>
  </div>
</section>`;
  return layout(req, { name: 'data-request', title: 'Privacy request', body });
}

// Phone + one-time code block used by the admission and privacy forms.
function otpBlock(purpose, phone = '', label = 'Registered mobile number') {
  return html`<div class="otp field--full" data-otp="${purpose}">
    <div class="field"><label for="otp-p-${purpose}">${label}</label><div class="otp__row"><input id="otp-p-${purpose}" name="phone" type="tel" autocomplete="tel" value="${phone}" required><button class="btn btn--ink btn--sm" type="button" data-otp-send><span class="btn__label">Send code</span><span class="btn__ic">${icon('arrow')}</span></button></div><span class="field__err" data-err="phone"></span></div>
    <div class="field otp__code" hidden><label for="otp-c-${purpose}">6-digit code</label><div class="otp__row"><input id="otp-c-${purpose}" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button class="btn btn--ink btn--sm" type="button" data-otp-verify><span class="btn__label">Verify</span><span class="btn__ic">${icon('check')}</span></button></div></div>
    <input type="hidden" name="otpToken">
    <p class="otp__msg" role="status" aria-live="polite"></p><span class="field__err" data-err="otp"></span>
  </div>`;
}

/* ------------------------------------------------------ trust blocks */

function stars(n) {
  const full = Math.round(Number(n) || 0);
  return raw(`<span class="stars" aria-label="${full} out of 5 stars">${'★'.repeat(full)}<i>${'★'.repeat(5 - full)}</i></span>`);
}

function trustStrip() {
  const items = content.list('affiliations');
  if (!items.length) return '';
  const one = html`${items.map((a) => html`<span class="aff">${a.logo ? img(a.logo, a.name, { sizes: '120px' }) : html`<b>${a.name}</b>`}<small>${a.note}</small></span><i class="aff__sep">✦</i>`)}`;
  return html`<section class="trust" aria-label="Affiliations and recognition">
  <div class="wrap trust__head"><span class="mono">Affiliated & recognised</span></div>
  <div class="trust__marquee"><div class="trust__track">${one}${raw('<span aria-hidden="true" class="trust__dup">')}${one}${raw('</span>')}</div></div>
</section>`;
}

function alumniSection() {
  const items = content.list('alumni').filter((a) => a.consent);
  if (!items.length) return '';
  return html`<section class="alumni section">
  <div class="wrap">
    <div class="shead"><div class="shead__l"><span class="eyebrow">Alumni</span><h2 class="display shead__title" data-split>${title('Started here.\n*Selected* there.')}</h2></div>
    <div class="shead__r"><p data-reveal>Athletes who trained at Vega and went on to district, state and national teams.</p></div></div>
    <div class="alumni__grid">${items.map(
      (a, i) => html`<article class="alum" data-reveal style="--d:${i % 4}">
      <div class="alum__media">${a.photo ? img(a.photo, '', { sizes: '(max-width: 760px) 92vw, 25vw' }) : ''}<span class="alum__level mono">${a.level}</span></div>
      <div class="alum__body"><span class="mono">${a.sport} · ${a.year}</span><h3>${a.name}</h3><p>${a.achievement}</p></div>
    </article>`
    )}</div>
  </div>
</section>`;
}

function reviewsSection() {
  const r = reviews.get();
  if (!r || !r.items.length) return '';
  return html`<section class="greviews section section--dark">
  <div class="wrap">
    <div class="greviews__head">
      <div><span class="eyebrow eyebrow--light">${r.live ? 'Live from Google' : 'Google reviews'}</span>
      <p class="greviews__score"><b class="display">${Number(r.rating).toFixed(1)}</b>${stars(r.rating)}<span>${r.count} reviews</span></p></div>
      ${r.url ? btn(r.url, 'See all on Google', 'glass', 'arrow', 'target="_blank" rel="noopener"') : ''}
    </div>
    <div class="greviews__grid">${r.items.map(
      (v, i) => html`<figure class="grev" data-reveal style="--d:${i % 3}">${stars(v.rating)}<blockquote>${v.text}</blockquote><figcaption><b>${v.name}</b><span class="mono">${/^\d{4}-\d{2}-\d{2}$/.test(v.when) ? fmtDate(v.when) : v.when}</span></figcaption></figure>`
    )}</div>
  </div>
</section>`;
}

function pressSection() {
  const press = content.list('press');
  const partners = content.list('partners');
  if (!press.length && !partners.length) return '';
  return html`<section class="press section">
  <div class="wrap">
    <div class="shead"><div class="shead__l"><span class="eyebrow">In the news</span><h2 class="display shead__title" data-split>${title('Press, awards\n& *partners*.')}</h2></div></div>
    ${press.length
      ? html`<ul class="press__list">${press.map(
          (p) => html`<li data-reveal><a class="press__row" href="${p.url || '#'}"${p.url ? raw(' target="_blank" rel="noopener"') : raw(' aria-disabled="true"')}>
          <span class="mono press__kind">${p.kind}</span><span class="press__title">${p.title}</span><span class="press__outlet">${p.outlet}</span><span class="mono">${p.date ? fmtDate(p.date) : ''}</span></a></li>`
        )}</ul>`
      : ''}
    ${partners.length
      ? html`<div class="partners">${['Partner school', 'Sponsor', 'Kit partner', 'Health partner'].map((k) => {
          const xs = partners.filter((p) => p.kind === k);
          return xs.length ? html`<div class="partners__group"><span class="mono">${k}${xs.length > 1 ? 's' : ''}</span><div class="partners__row">${xs.map((p) => html`<a class="partner" href="${p.url || '#'}"${p.url ? raw(' target="_blank" rel="noopener"') : ''}>${p.logo ? img(p.logo, p.name, { sizes: '160px' }) : html`<b>${p.name}</b>`}</a>`)}</div></div>` : '';
        })}</div>`
      : ''}
  </div>
</section>`;
}

module.exports = { invoice, book, dataRequest, otpBlock, trustStrip, alumniSection, reviewsSection, pressSection, stars };
