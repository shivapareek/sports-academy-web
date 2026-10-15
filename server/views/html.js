// HTML helpers. `html` is a tagged template that escapes every value unless it
// is wrapped in raw() (or is the result of another html`` call).
const fs = require('fs');
const path = require('path');

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
const raw = (s) => new Raw(String(s ?? ''));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function fmt(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return esc(v);
}

function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += fmt(vals[i]);
  });
  return new Raw(out);
}

// Titles: a newline starts a new masked line, *word* gets the highlight.
function title(src, { tag = 'span' } = {}) {
  const lines = String(src || '').split('\n').filter((l) => l.trim());
  return raw(
    lines
      .map((l) => `<${tag} class="ln"><span class="ln__in">${esc(l).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</span></${tag}>`)
      .join(' ')
  );
}

// Inline emphasis only (for paragraphs written in page text).
function inline(src) {
  return raw(esc(src).replace(/\*([^*]+)\*/g, '<em>$1</em>'));
}

function paras(src) {
  return raw(
    String(src || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${inline(p.trim())}</p>`)
      .join('')
  );
}

// "Title: text" lines to pairs.
function pairs(src) {
  return String(src || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ''];
    });
}

// Bundled photos have several sizes listed in public/img/manifest.json.
const MANIFEST = path.join(__dirname, '..', '..', 'public', 'img', 'manifest.json');
let manifest = null;
let manifestMtime = 0;
function lookup(src) {
  try {
    const m = fs.statSync(MANIFEST).mtimeMs;
    if (!manifest || m !== manifestMtime) {
      manifest = new Map();
      manifestMtime = m;
      for (const item of JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))) {
        const files = Object.values(item.sizes || {}).concat(item.file);
        for (const f of files) manifest.set('/img/' + f, item);
      }
    }
  } catch {
    manifest = manifest || new Map();
  }
  return manifest.get(src);
}

function img(src, alt, opts = {}) {
  if (!src) return raw('');
  const info = lookup(src);
  const sizes = opts.sizes || '100vw';
  let srcset = '';
  let w = opts.width;
  let h = opts.height;
  if (info && info.sizes) {
    srcset = Object.entries(info.sizes)
      .map(([px, f]) => `/img/${f} ${px}w`)
      .join(', ');
    w = w || info.width;
    h = h || info.height;
  }
  const focal = opts.focal || (info && info.focal);
  const altText = alt != null && alt !== '' ? alt : (info && info.alt) || '';
  return html`<img src="${src}"${srcset ? raw(` srcset="${esc(srcset)}" sizes="${esc(sizes)}"`) : ''} alt="${altText}"${w ? raw(` width="${Number(w)}" height="${Number(h)}"`) : ''}${opts.eager ? raw(' fetchpriority="high"') : raw(' loading="lazy"')} decoding="async"${focal ? raw(` style="object-position:${esc(focal)}"`) : ''}${opts.cls ? raw(` class="${esc(opts.cls)}"`) : ''}>`;
}

const money = (n) => (n == null || n === '' ? '' : '₹' + Number(n).toLocaleString('en-IN'));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function date(d, style = 'long') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return '';
  const [, y, mo, da] = m;
  if (style === 'parts') return { day: da, month: MONTHS[mo - 1], year: y };
  return `${Number(da)} ${MONTHS[mo - 1]} ${y}`;
}

function time12(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  if (!m) return '';
  let h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

const pad = (n) => String(n).padStart(2, '0');

function initials(name) {
  return String(name || '')
    .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Thin-line icons (1.25 stroke), drawn on a 24px grid.
const ICONS = {
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  facebook: '<path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7h1.8V2.7A24 24 0 0 0 15 2.5c-2.6 0-4.3 1.6-4.3 4.4v2.6H8V13h2.7v8"/>',
  x: '<path d="M4 4l16 16M20 4 4 20"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
};
function icon(name, cls = 'i') {
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`);
}

// Pill button with the arrow nested in its own circle.
function btn(href, label, variant = 'primary', ic = 'arrow', attrs = '') {
  return html`<a class="btn btn--${variant}" href="${href}"${raw(attrs ? ' ' + attrs : '')}><span class="btn__label">${label}</span><span class="btn__ic">${icon(ic)}</span></a>`;
}

module.exports = { html, raw, esc, title, inline, paras, pairs, img, money, date, time12, pad, initials, icon, btn, lookup };
