// Reading content for the public pages, plus validation of admin input.
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const store = require('./store');
const schema = require('./schema');
const texts = require('./texts');

marked.setOptions({ gfm: true, breaks: false });

function md(src) {
  const html = marked.parse(String(src || ''));
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'figure', 'figcaption']),
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'loading'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: { img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }) },
  });
}

function text(key) {
  const db = store.get();
  const v = db.texts && db.texts[key];
  return v != null && v !== '' ? v : texts.defaults[key] ?? '';
}

function list(name, opts = {}) {
  const db = store.get();
  let items = (db[name] || []).filter((x) => opts.all || x.published !== false);
  const def = schema.collections[name];
  if (def && def.sort === 'date-desc') items = items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (def && def.sort === 'date-asc') items = items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return items;
}

function find(name, pred) {
  return list(name).find(pred);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const RESERVED = new Set(['admin', 'api', 'img', 'css', 'js', 'vendor', 'uploads', 'programs', 'coaches', 'schedule', 'gallery', 'news', 'admissions', 'contact', 'about', 'credits', 'sitemap.xml', 'robots.txt']);

// Coerce admin input to the field types in schema.js. Unknown keys are dropped.
function clean(collection, input, existing = {}) {
  const def = schema.collections[collection];
  const out = { id: existing.id };
  const errors = [];
  for (const f of def.fields) {
    let v = input[f.key];
    switch (f.type) {
      case 'number':
        v = v === '' || v == null ? null : Number(v);
        if (v != null && !Number.isFinite(v)) errors.push(`${f.label} must be a number`);
        break;
      case 'bool':
        v = v === true || v === 'true' || v === 'on' || v === 1;
        break;
      case 'lines':
        v = (Array.isArray(v) ? v : String(v || '').split('\n')).map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
        break;
      case 'multi':
        v = (Array.isArray(v) ? v : []).filter((x) => f.options.includes(x));
        break;
      case 'select':
        v = f.options.includes(v) ? v : f.options[0];
        break;
      case 'date':
        v = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '';
        break;
      case 'time':
        v = /^\d{2}:\d{2}$/.test(String(v || '')) ? v : '';
        break;
      case 'color':
        v = /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : '';
        break;
      case 'image':
        v = String(v || '').trim();
        if (v && !/^\/(img|uploads)\/[\w./-]+$/.test(v) && !/^https:\/\/[^\s"'<>]+$/.test(v)) errors.push(`${f.label}: choose an image from the media library`);
        break;
      case 'ref':
        v = String(v || '');
        if (v && !(store.get()[f.ref] || []).some((x) => x.id === v)) v = '';
        break;
      case 'slug':
        v = slugify(v || input[def.slugFrom] || '');
        break;
      default:
        v = String(v == null ? '' : v).slice(0, f.type === 'markdown' ? 60000 : f.type === 'textarea' ? 4000 : 300);
        if (f.type === 'text') v = v.replace(/[\r\n]+/g, ' ').trim();
    }
    if (f.required && (v === '' || v == null || (Array.isArray(v) && !v.length))) errors.push(`${f.label} is required`);
    out[f.key] = v;
  }
  const slugField = def.fields.find((f) => f.type === 'slug');
  if (slugField) {
    if (!out.slug) errors.push('URL slug is required');
    const clash = (store.get()[collection] || []).some((x) => x.slug === out.slug && x.id !== existing.id);
    if (clash) errors.push(`Another ${def.singular.toLowerCase()} already uses the slug "${out.slug}"`);
    if (collection === 'pages' && RESERVED.has(out.slug)) errors.push(`"${out.slug}" is reserved. Pick another slug.`);
  }
  return { item: out, errors };
}

module.exports = { md, text, list, find, clean, slugify };
