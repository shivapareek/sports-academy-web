const store = require('../store');
const content = require('../content');
const { html, raw, esc, icon, title, inline, btn } = require('./html');

const t = content.text;
const VERSION = Date.now().toString(36);

const NAV = [
  ['/programs', 'Programs'],
  ['/schedule', 'Schedule'],
  ['/coaches', 'Coaches'],
  ['/about', 'About'],
  ['/news', 'Stories'],
];
const MENU = [
  ['/', 'Home'],
  ['/programs', 'Programs'],
  ['/schedule', 'Schedule'],
  ['/coaches', 'Coaches'],
  ['/about', 'About'],
  ['/gallery', 'Gallery'],
  ['/news', 'Stories'],
  ['/admissions', 'Admissions'],
  ['/book', 'Book a court'],
  ['/contact', 'Contact'],
  ['/portal', 'Parent login'],
];

function logo(s) {
  return html`<a class="logo" href="/" aria-label="${s.name}, home">
    <svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 6h6.2L16 21.4 22.8 6H29L18.6 27h-5.2z" fill="currentColor"/><path d="M22.8 6H29l-2.2 4.4h-6z" class="logo__cut"/></svg>
    <span class="logo__word">${s.shortName || s.name}</span>
  </a>`;
}

function social(s) {
  const items = [['instagram', s.instagram], ['youtube', s.youtube], ['facebook', s.facebook], ['x', s.x]].filter(([, u]) => u);
  return html`<div class="social">${items.map(([k, u]) => html`<a href="${u}" target="_blank" rel="noopener" aria-label="${k}">${icon(k)}</a>`)}</div>`;
}

function layout(req, { title: pageTitle, description, body, name = 'page', image, head, noindex }) {
  const db = store.get();
  const s = db.settings;
  const full = pageTitle ? `${pageTitle} · ${s.name}` : s.seoTitle || s.name;
  const desc = description || s.seoDescription;
  const og = image || s.ogImage;
  const path = req.path;
  const isActive = (href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const wa = s.whatsapp ? `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}` : '';
  const footerPages = content.list('pages').filter((p) => p.inFooter);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: s.name,
    description: s.seoDescription,
    telephone: s.phone,
    email: s.email,
    address: { '@type': 'PostalAddress', streetAddress: String(s.address || '').split('\n')[0], addressLocality: s.city, addressCountry: 'IN' },
  };

  return html`<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${full}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${full}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
${og ? html`<meta property="og:image" content="${og}">` : ''}
<meta name="theme-color" content="#0E0E0D">
${noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ''}
${head || ''}
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<script src="/js/boot.js?v=${VERSION}"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/css/site.css?v=${VERSION}">
<link rel="stylesheet" href="/css/ops.css?v=${VERSION}">
<style>:root{--track:${raw(safeColor(s.accent, '#E0482B'))};--volt:${raw(safeColor(s.volt, '#D4F53C'))}}</style>
<script type="application/ld+json">${raw(JSON.stringify(ld).replace(/</g, '\\u003c'))}</script>
</head>
<body class="p-${name}" data-preloader="${s.preloader && name === 'home' ? '1' : '0'}">
<a class="skip" href="#main">Skip to content</a>
${s.preloader && name === 'home'
  ? html`<div class="preloader" aria-hidden="true"><div class="preloader__lights"><i></i><i></i><i></i></div><div class="preloader__words"><span>On your marks</span><span>Set</span><span>Go</span></div></div>`
  : ''}
${s.announceOn && s.announceText
  ? html`<div class="announce"><div class="announce__in">${icon('bolt')}<span>${s.announceText}</span>${s.announceLink ? html`<a href="${s.announceLink}">Know more ${icon('right')}</a>` : ''}</div></div>`
  : ''}
<header class="nav" data-nav>
  <div class="nav__pill">
    ${logo(s)}
    <nav class="nav__links" aria-label="Main">
      ${NAV.map(([href, label]) => html`<a href="${href}"${isActive(href) ? raw(' aria-current="page"') : ''}>${label}</a>`)}
    </nav>
    <a class="nav__cta" href="/admissions#trial">${t('nav.cta')}<span class="nav__cta-dot"></span></a>
    <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu" data-burger><span></span><span></span></button>
  </div>
</header>
<div class="menu" id="menu" hidden data-menu>
  <div class="menu__in wrap">
    <nav class="menu__links" aria-label="All pages">
      ${MENU.map(([href, label], i) => html`<a href="${href}" style="--d:${i}"${isActive(href) ? raw(' aria-current="page"') : ''}><span class="menu__no">${String(i + 1).padStart(2, '0')}</span><span class="menu__label">${label}</span></a>`)}
    </nav>
    <div class="menu__side">
      <p class="menu__kicker">${s.tagline}</p>
      <a href="tel:${String(s.phone).replace(/\s/g, '')}">${icon('phone')} ${s.phone}</a>
      <a href="mailto:${s.email}">${icon('mail')} ${s.email}</a>
      ${wa ? html`<a href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp us</a>` : ''}
      ${social(s)}
    </div>
  </div>
</div>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="wrap footer__top">
    <div class="footer__news">
      <h2 class="footer__h">${t('footer.newsletter.title')}</h2>
      <p>${t('footer.newsletter.text')}</p>
      <form class="inline-form" data-form="subscribers" novalidate>
        <label class="sr" for="nl-email">Email</label>
        <input id="nl-email" name="email" type="email" placeholder="you@email.com" autocomplete="email" required>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn--volt btn--sm" type="submit"><span class="btn__label">Subscribe</span><span class="btn__ic">${icon('arrow')}</span></button>
        <p class="form-msg" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="footer__cols">
      <div>
        <h3 class="footer__label">Academy</h3>
        <ul>${MENU.slice(1, 8).filter(([h]) => h !== '/admissions').map(([h, l]) => html`<li><a href="${h}">${l}</a></li>`)}</ul>
      </div>
      <div>
        <h3 class="footer__label">Join</h3>
        <ul>
          <li><a href="/admissions">Admissions</a></li>
          <li><a href="/admissions#trial">Free trial</a></li>
          <li><a href="/admissions#fees">Fees</a></li>
          <li><a href="/book">Book a facility</a></li>
          <li><a href="/portal">Parent portal</a></li>
          <li><a href="/contact">Contact</a></li>
          ${footerPages.map((p) => html`<li><a href="/${p.slug}">${p.title}</a></li>`)}
        </ul>
      </div>
      <div>
        <h3 class="footer__label">Visit</h3>
        <address>${String(s.address || '').split('\n').map((l) => html`${l}<br>`)}</address>
        <p><a href="tel:${String(s.phone).replace(/\s/g, '')}">${s.phone}</a><br><a href="mailto:${s.email}">${s.email}</a></p>
        ${social(s)}
      </div>
    </div>
  </div>
  <div class="footer__mark" aria-hidden="true"><span data-stretch>${s.shortName || s.name}</span></div>
  <div class="wrap footer__bottom">
    <span>© ${new Date().getFullYear()} ${s.name}${s.founded ? ` · Since ${s.founded}` : ''}</span>
    <span class="footer__note">${s.footerNote}</span>
    <a href="/credits">Photo credits</a>
  </div>
</footer>
${wa ? html`<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${icon('whatsapp')}</a>` : ''}
<div class="grain" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><span class="cursor__label"></span></div>
<script src="/vendor/gsap.min.js" defer></script>
<script src="/vendor/ScrollTrigger.min.js" defer></script>
<script src="/vendor/SplitText.min.js" defer></script>
<script src="/vendor/lenis.min.js" defer></script>
<script src="/js/pay.js?v=${VERSION}" defer></script>
<script src="/js/ops.js?v=${VERSION}" defer></script>
<script src="/js/site.js?v=${VERSION}" defer></script>
</body>
</html>`;
}

function safeColor(c, fallback) {
  return /^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback;
}

// Header used by every inner page.
function pageHead({ eyebrow, heading, intro, no, image, alt, extra }) {
  return html`<section class="phead${image ? ' phead--image' : ''}">
  <div class="phead__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="wrap phead__in">
    <div class="phead__top">
      <span class="eyebrow">${eyebrow}</span>
      ${no ? html`<span class="phead__no mono">${no}</span>` : ''}
    </div>
    <h1 class="display phead__title" data-split>${title(heading)}</h1>
    ${intro ? html`<p class="phead__intro" data-reveal>${inline(intro)}</p>` : ''}
    ${extra || ''}
  </div>
  ${image ? html`<div class="phead__media" data-clip>${require('./html').img(image, alt || '', { eager: true, sizes: '100vw' })}</div>` : ''}
</section>`;
}

module.exports = { layout, pageHead, btn, VERSION };
