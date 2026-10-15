const fs = require('fs');
const path = require('path');
const store = require('../store');
const content = require('../content');
const { DAYS } = require('../schema');
const { html, raw, title, inline, paras, pairs, img, money, date, time12, pad, initials, icon, btn } = require('./html');
const { layout, pageHead } = require('./layout');

const t = content.text;
const list = content.list;

const programById = (id) => list('programs').find((p) => p.id === id);
const coachById = (id) => list('coaches').find((c) => c.id === id);
const settings = () => store.get().settings;
const on = (k) => store.get().sections[k] !== false;

function eyebrow(text, light) {
  return html`<span class="eyebrow${light ? ' eyebrow--light' : ''}">${text}</span>`;
}

function sectionHead(eb, heading, text, { light, link } = {}) {
  return html`<div class="shead">
    <div class="shead__l">${eyebrow(eb, light)}<h2 class="display shead__title" data-split>${title(heading)}</h2></div>
    ${text || link ? html`<div class="shead__r">${text ? html`<p data-reveal>${inline(text)}</p>` : ''}${link || ''}</div>` : ''}
  </div>`;
}

function programCard(p, i, { big } = {}) {
  return html`<a class="pcard${big ? ' pcard--big' : ''}" href="/programs/${p.slug}" data-cursor="View">
    <div class="bezel"><div class="bezel__core">
      <div class="pcard__media">${img(p.image, '', { sizes: big ? '(max-width: 760px) 92vw, 46vw' : '(max-width: 760px) 80vw, 30vw' })}<span class="pcard__lane mono">Lane ${pad(i + 1)}</span></div>
      <div class="pcard__body">
        <div class="pcard__row"><h3 class="pcard__name">${p.name}</h3><span class="pcard__go">${icon('arrow')}</span></div>
        <p class="pcard__sum">${p.summary}</p>
        <div class="pcard__meta"><span>${p.ages}</span>${p.feeMonthly ? html`<span>from <b>${money(p.feeMonthly)}</b>/mo</span>` : ''}</div>
      </div>
    </div></div>
  </a>`;
}

function formField({ name, label, type = 'text', required, options, placeholder, autocomplete, value, full, min, max }) {
  const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 6);
  const control =
    type === 'select'
      ? html`<select id="${id}" name="${name}"${required ? raw(' required') : ''}><option value="">Select…</option>${options.map((o) => html`<option${o === value ? raw(' selected') : ''}>${o}</option>`)}</select>`
      : type === 'textarea'
        ? html`<textarea id="${id}" name="${name}" rows="4" placeholder="${placeholder || ''}"${required ? raw(' required') : ''}></textarea>`
        : html`<input id="${id}" name="${name}" type="${type}" placeholder="${placeholder || ''}"${autocomplete ? raw(` autocomplete="${autocomplete}"`) : ''}${required ? raw(' required') : ''}${value ? raw(` value="${require('./html').esc(value)}"`) : ''}${min ? raw(` min="${min}"`) : ''}${max ? raw(` max="${max}"`) : ''}>`;
  return html`<div class="field${full ? ' field--full' : ''}"><label for="${id}">${label}${required ? '' : html` <small>(optional)</small>`}</label>${control}<span class="field__err" data-err="${name}"></span></div>`;
}

function trialForm({ program } = {}) {
  const programs = list('programs');
  const today = new Date().toISOString().slice(0, 10);
  if (!settings().trialsOpen) return html`<div class="bezel"><div class="bezel__core form-card"><p>Trial booking is paused right now. Please <a href="/contact">contact us</a>.</p></div></div>`;
  return html`<form class="bezel form-shell" data-form="trials" novalidate>
    <div class="bezel__core form-card">
      <div class="form-grid">
        ${formField({ name: 'name', label: 'Athlete’s name', required: true, autocomplete: 'name' })}
        ${formField({ name: 'age', label: 'Age', type: 'number', min: 4, max: 80 })}
        ${formField({ name: 'phone', label: 'Phone / WhatsApp', type: 'tel', required: true, autocomplete: 'tel' })}
        ${formField({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
        ${formField({ name: 'program', label: 'Sport', type: 'select', required: true, options: programs.map((p) => p.name), value: program })}
        ${formField({ name: 'date', label: 'Preferred day', type: 'date', min: today })}
      </div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-foot">
        <button class="btn btn--primary" type="submit"><span class="btn__label">Book my free session</span><span class="btn__ic">${icon('arrow')}</span></button>
        <p class="form-msg" role="status" aria-live="polite"></p>
      </div>
    </div>
  </form>`;
}

// ------------------------------------------------------------------ home ---

function home(req) {
  const s = settings();
  const programs = list('programs');
  const lanes = programs.filter((p) => p.featured && p.laneImage).slice(0, 6);
  const featured = programs.filter((p) => p.featured);
  const carousel = featured.length >= 3 ? featured : programs;
  const ticker = t('home.hero.ticker').split('·').map((w) => w.trim()).filter(Boolean);
  const stats = list('stats');
  const method = list('method');
  const facilities = list('facilities').slice(0, 5);
  const coaches = list('coaches').slice(0, 6);
  const testimonials = list('testimonials');
  const posts = list('posts').slice(0, 3);

  const body = html`
${on('hero')
  ? html`<section class="hero" data-hero>
  <div class="hero__lanes" style="--lanes:${Math.max(lanes.length, 1)}">
    ${lanes.map(
      (p, i) => html`<a class="lane" href="/programs/${p.slug}" style="--i:${i}" data-lane>
      <span class="lane__media">${img(p.laneImage, '', { eager: i < 3, sizes: '(max-width: 760px) 34vw, 17vw' })}</span>
      <span class="lane__sport">${p.name}</span>
      <span class="lane__meta mono">${p.ages}</span>
      <span class="lane__no">${i + 1}</span>
    </a>`
    )}
  </div>
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="hero__content wrap">
    <div class="hero__top">
      ${eyebrow(t('home.hero.eyebrow'), true)}
      <div class="hero__clock" aria-hidden="true"><span class="mono hero__clock-label">${t('home.hero.clock')}</span><span class="hero__clock-time" data-clock>00:00.00</span></div>
    </div>
    <h1 class="display hero__title" data-hero-title>${title(t('home.hero.title'))}</h1>
    <div class="hero__bottom">
      <p class="hero__text" data-hero-fade>${t('home.hero.text')}</p>
      <div class="actions" data-hero-fade>
        ${btn('/admissions#trial', t('home.hero.cta1'), 'volt')}
        ${btn('/programs', t('home.hero.cta2'), 'glass', 'right')}
      </div>
    </div>
  </div>
  <div class="ticker" aria-hidden="true"><div class="ticker__track">${[0, 1].map(() => html`<span class="ticker__group">${ticker.map((w) => html`<span>${w}</span><i>✦</i>`)}</span>`)}</div></div>
</section>`
  : ''}

${on('manifesto')
  ? html`<section class="manifesto section">
  <div class="wrap manifesto__in">
    <div class="manifesto__side">${eyebrow(t('home.manifesto.eyebrow'))}<span class="mono manifesto__est">Est. ${s.founded} · ${s.city}</span></div>
    <p class="manifesto__text" data-words>${t('home.manifesto.text')}</p>
  </div>
</section>`
  : ''}

${on('stats') && stats.length
  ? html`<section class="stats" aria-label="${t('home.stats.eyebrow')}">
  <div class="wrap">
    <div class="stats__head">${eyebrow(t('home.stats.eyebrow'))}<span class="mono">Updated ${date(new Date().toISOString())}</span></div>
    <div class="stats__grid">
      ${stats.map(
        (st, i) => html`<div class="stat" data-reveal style="--d:${i}">
        <span class="stat__lane mono">${pad(i + 1)}</span>
        <span class="stat__num"><span data-count="${st.value}">${Number(st.value).toLocaleString('en-IN')}</span><span class="stat__suf">${st.suffix}</span></span>
        <span class="stat__label">${st.label}</span>
      </div>`
      )}
    </div>
  </div>
</section>`
  : ''}

${on('programs') && carousel.length
  ? html`<section class="hscroll section--dark" data-hscroll>
  <div class="hscroll__pin">
    <div class="wrap hscroll__head">
      ${sectionHead(t('home.programs.eyebrow'), t('home.programs.title'), t('home.programs.text'), { light: true, link: btn('/programs', 'All programs', 'glass', 'right') })}
    </div>
    <div class="hscroll__track" data-hscroll-track>
      ${carousel.map((p, i) => programCard(p, i))}
      <a class="hscroll__end" href="/programs" data-cursor="Open"><span class="display">${programs.length} sports.<br><em>See all</em></span>${icon('arrow', 'i i--xl')}</a>
    </div>
    <div class="wrap hscroll__bar"><span class="mono">Scroll</span><div class="hscroll__progress"><i data-hscroll-progress></i></div><span class="mono">${pad(carousel.length)}</span></div>
  </div>
</section>`
  : ''}

${on('method') && method.length
  ? html`<section class="method section">
  <div class="wrap method__in">
    <div class="method__sticky">
      ${eyebrow(t('home.method.eyebrow'))}
      <h2 class="display shead__title" data-split>${title(t('home.method.title'))}</h2>
      <p data-reveal>${t('home.method.text')}</p>
      ${btn('/about', 'How we coach', 'ink', 'right')}
    </div>
    <ol class="method__track" data-method>
      <span class="method__rail" aria-hidden="true"><i data-method-progress></i></span>
      ${method.map(
        (m, i) => html`<li class="method__step" data-step>
        <span class="method__no">${pad(i + 1)}</span>
        <div><span class="mono method__ages">${m.ages}</span><h3>${m.title}</h3><p>${m.text}</p></div>
      </li>`
      )}
    </ol>
  </div>
</section>`
  : ''}

${on('facilities') && facilities.length
  ? html`<section class="facilities section">
  <div class="wrap">
    ${sectionHead(t('home.facilities.eyebrow'), t('home.facilities.title'), '', { link: btn('/about#facilities', 'Tour the campus', 'ink', 'right') })}
    <div class="bento">
      ${facilities.map(
        (f, i) => html`<figure class="bento__item bento__item--${i + 1}" data-clip>
        ${img(f.image, '', { sizes: i === 0 ? '(max-width: 760px) 92vw, 58vw' : '(max-width: 760px) 92vw, 40vw' })}
        <figcaption><span class="bento__name">${f.name}</span><span class="chips">${(f.specs || []).slice(0, 3).map((x) => html`<span class="chip">${x}</span>`)}</span></figcaption>
      </figure>`
      )}
    </div>
  </div>
</section>`
  : ''}

${on('coaches') && coaches.length
  ? html`<section class="roster section--dark">
  <div class="wrap">
    ${sectionHead(t('home.coaches.eyebrow'), t('home.coaches.title'), '', { light: true, link: btn('/coaches', 'Meet every coach', 'glass', 'right') })}
    <ul class="roster__list" data-roster>
      ${coaches.map((c, i) => {
        const p = programById(c.program);
        const picture = c.photo || (p && p.image) || '';
        return html`<li><a class="roster__row" href="/coaches#${c.id}" data-roster-img="${picture}" data-roster-tag="${c.photo ? '' : p ? p.name : ''}">
          <span class="roster__no mono">${pad(i + 1)}</span>
          <span class="roster__name">${c.name}</span>
          <span class="roster__role">${c.role}</span>
          <span class="roster__exp mono">${c.experience} yrs</span>
          <span class="roster__go">${icon('arrow')}</span>
        </a></li>`;
      })}
    </ul>
  </div>
  <div class="roster__float" aria-hidden="true"><img alt=""><span class="roster__tag mono"></span></div>
</section>`
  : ''}

${on('testimonials') && testimonials.length
  ? html`<section class="voices" data-voices>
  <div class="wrap voices__in">
    <div class="voices__head">${eyebrow(t('home.testimonials.eyebrow'))}<span class="voices__count mono"><span data-voices-index>01</span> / ${pad(testimonials.length)}</span></div>
    <div class="voices__stage">
      ${testimonials.map(
        (v, i) => html`<figure class="voice${i === 0 ? ' is-active' : ''}" data-voice>
        <blockquote class="display voice__q">“${v.quote}”</blockquote>
        <figcaption><b>${v.name}</b><span>${v.role}</span></figcaption>
      </figure>`
      )}
    </div>
    <div class="voices__nav">
      <button class="round" type="button" data-voices-prev aria-label="Previous testimonial">${icon('left')}</button>
      <button class="round" type="button" data-voices-next aria-label="Next testimonial">${icon('right')}</button>
      <div class="voices__bar"><i data-voices-bar></i></div>
    </div>
  </div>
</section>`
  : ''}

${on('trial')
  ? html`<section class="trial section" id="trial">
  <div class="wrap trial__in">
    <div class="trial__copy">
      ${eyebrow(t('home.trial.eyebrow'))}
      <h2 class="display shead__title" data-split>${title(t('home.trial.title'))}</h2>
      <p data-reveal>${t('home.trial.text')}</p>
      <ul class="ticks" data-reveal>
        <li>${icon('check')} 45-minute coached session</li>
        <li>${icon('check')} Level assessment and batch advice</li>
        <li>${icon('check')} Campus tour for parents</li>
      </ul>
    </div>
    ${trialForm()}
  </div>
</section>`
  : ''}

${on('news') && posts.length
  ? html`<section class="news section">
  <div class="wrap">
    ${sectionHead(t('home.news.eyebrow'), t('home.news.title'), '', { link: btn('/news', 'All stories', 'ink', 'right') })}
    <div class="news__grid">${posts.map((p, i) => postCard(p, i))}</div>
  </div>
</section>`
  : ''}

${on('cta')
  ? html`<section class="cta section--dark">
  <div class="cta__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="wrap cta__in">
    <h2 class="display cta__title" data-split>${title(t('home.cta.title'))}</h2>
    <div class="cta__side"><p data-reveal>${t('home.cta.text')}</p>${btn('/admissions', t('home.cta.button'), 'volt')}</div>
  </div>
</section>`
  : ''}
`;
  return layout(req, { name: 'home', body, image: lanes[0] && lanes[0].laneImage });
}

function postCard(p, i) {
  return html`<a class="post" href="/news/${p.slug}" data-reveal style="--d:${i}" data-cursor="Read">
    <div class="bezel"><div class="bezel__core"><div class="post__media">${img(p.cover, '', { sizes: '(max-width: 760px) 92vw, 30vw' })}</div></div></div>
    <div class="post__meta mono"><span>${p.category}</span><span>${date(p.date)}</span></div>
    <h3 class="post__title">${p.title}</h3>
    <p class="post__ex">${p.excerpt}</p>
  </a>`;
}

// ----------------------------------------------------------------- about ---

function about(req) {
  const milestones = list('milestones');
  const facilities = list('facilities');
  const stats = list('stats');
  const values = pairs(t('about.values'));
  const aboutImgs = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'img', 'manifest.json'), 'utf8')).filter((m) => m.slot === 'wide' || m.slot === 'about');
    } catch {
      return [];
    }
  })();
  const wideImg = aboutImgs.find((m) => m.slot === 'wide') || aboutImgs[0];
  const wide = wideImg ? '/img/' + wideImg.file : (list('gallery')[0] || {}).image;
  const body = html`
${pageHead({ eyebrow: t('about.eyebrow'), heading: t('about.title'), intro: t('about.intro'), no: '04 / 09', image: wide })}
<section class="section story">
  <div class="wrap story__in">
    <h2 class="display shead__title" data-split>${title(t('about.story.title'))}</h2>
    <div class="prose prose--lead" data-reveal>${paras(t('about.story.text'))}</div>
  </div>
  ${stats.length
    ? html`<div class="wrap stats__grid stats__grid--compact">${stats.map(
        (st, i) => html`<div class="stat" data-reveal style="--d:${i}"><span class="stat__lane mono">${pad(i + 1)}</span><span class="stat__num"><span data-count="${st.value}">${Number(st.value).toLocaleString('en-IN')}</span><span class="stat__suf">${st.suffix}</span></span><span class="stat__label">${st.label}</span></div>`
      )}</div>`
    : ''}
</section>
<section class="section values section--dark">
  <div class="wrap">
    ${sectionHead('Values', t('about.values.title'), '', { light: true })}
    <div class="values__grid">${values.map(
      ([h, p], i) => html`<div class="value" data-reveal style="--d:${i}"><span class="value__no mono">${pad(i + 1)}</span><h3>${h}</h3><p>${p}</p></div>`
    )}</div>
  </div>
</section>
${milestones.length
  ? html`<section class="section timeline">
  <div class="wrap">
    ${sectionHead('Since ' + settings().founded, t('about.timeline.title'))}
    <ol class="timeline__list" data-timeline>
      <span class="timeline__rail" aria-hidden="true"><i data-timeline-progress></i></span>
      ${milestones.map(
        (m) => html`<li class="timeline__item" data-reveal><span class="timeline__year display">${m.year}</span><div><h3>${m.title}</h3><p>${m.text}</p></div></li>`
      )}
    </ol>
  </div>
</section>`
  : ''}
<section class="section" id="facilities">
  <div class="wrap">
    ${sectionHead(t('home.facilities.eyebrow'), t('home.facilities.title'))}
    <div class="facility-list">${facilities.map(
      (f, i) => html`<article class="facility${i % 2 ? ' facility--flip' : ''}">
      <div class="bezel facility__media" data-clip><div class="bezel__core">${img(f.image, '', { sizes: '(max-width: 760px) 92vw, 50vw' })}</div></div>
      <div class="facility__copy" data-reveal><span class="mono">${pad(i + 1)} / ${pad(facilities.length)}</span><h3 class="display">${f.name}</h3><p>${f.description}</p><ul class="specs">${(f.specs || []).map((x) => html`<li>${x}</li>`)}</ul></div>
    </article>`
    )}</div>
  </div>
</section>
${ctaBand()}`;
  return layout(req, { name: 'about', title: 'About', description: t('about.intro'), body });
}

function ctaBand() {
  return html`<section class="cta section--dark">
  <div class="cta__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="wrap cta__in">
    <h2 class="display cta__title" data-split>${title(t('home.cta.title'))}</h2>
    <div class="cta__side"><p data-reveal>${t('home.cta.text')}</p>${btn('/admissions', t('home.cta.button'), 'volt')}</div>
  </div>
</section>`;
}

// -------------------------------------------------------------- programs ---

function programs(req) {
  const items = list('programs');
  const body = html`
${pageHead({ eyebrow: t('programs.eyebrow'), heading: t('programs.title'), intro: t('programs.intro'), no: '01 / 09' })}
<section class="section section--tight">
  <div class="wrap">
    <div class="pindex" data-pindex>
      ${items.map(
        (p, i) => html`<a class="pindex__row" href="/programs/${p.slug}" data-pindex-img="${p.image}">
        <span class="mono pindex__no">${pad(i + 1)}</span>
        <span class="display pindex__name">${p.name}</span>
        <span class="pindex__tag">${p.tagline}</span>
        <span class="mono pindex__ages">${p.ages}</span>
        <span class="pindex__fee">${p.feeMonthly ? html`${money(p.feeMonthly)}<small>/mo</small>` : ''}</span>
      </a>`
      )}
      <div class="pindex__float" aria-hidden="true"><img alt=""></div>
    </div>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    <div class="pgrid">${items.map((p, i) => programCard(p, i, { big: true }))}</div>
  </div>
</section>
${ctaBand()}`;
  return layout(req, { name: 'programs', title: 'Programs', description: t('programs.intro'), body });
}

function program(req, slug) {
  const p = list('programs').find((x) => x.slug === slug);
  if (!p) return null;
  const all = list('programs');
  const idx = all.indexOf(p);
  const batches = list('batches').filter((b) => b.program === p.id);
  const coaches = list('coaches').filter((c) => c.program === p.id || batches.some((b) => b.coach === c.id));
  const next = all[(idx + 1) % all.length];
  const curriculum = (p.curriculum || []).map((l) => {
    const i = l.indexOf(':');
    return i > 0 ? [l.slice(0, i), l.slice(i + 1).trim()] : [l, ''];
  });
  const body = html`
<section class="phero">
  <div class="phero__media" data-parallax>${img(p.heroImage || p.image, '', { eager: true, sizes: '100vw' })}</div>
  <div class="phero__shade" aria-hidden="true"></div>
  <div class="wrap phero__in">
    <a class="crumb mono" href="/programs">${icon('left')} All programs</a>
    <span class="eyebrow eyebrow--light">${p.sport} · Lane ${pad(idx + 1)}</span>
    <h1 class="display phero__title" data-split>${title(p.name)}</h1>
    <p class="phero__tag" data-reveal>${p.tagline}</p>
  </div>
</section>
<section class="facts">
  <div class="wrap facts__in">
    <div><span class="mono">Ages</span><b>${p.ages}</b></div>
    <div><span class="mono">Level</span><b>${p.level}</b></div>
    <div><span class="mono">Sessions</span><b>${p.sessions}</b></div>
    <div><span class="mono">Fee</span><b>${p.feeMonthly ? html`${money(p.feeMonthly)} / month` : 'On request'}</b></div>
    ${btn('#trial', t('program.cta'), 'primary')}
  </div>
</section>
<section class="section">
  <div class="wrap overview">
    <div class="prose prose--lead" data-reveal>${raw(content.md(p.description || p.summary))}</div>
    ${p.highlights && p.highlights.length
      ? html`<div class="bezel overview__card" data-reveal><div class="bezel__core"><h2 class="mono overview__h">What you get</h2><ul class="ticks">${p.highlights.map((h) => html`<li>${icon('check')} ${h}</li>`)}</ul></div></div>`
      : ''}
  </div>
</section>
${curriculum.length
  ? html`<section class="section section--dark">
  <div class="wrap">
    ${sectionHead('Curriculum', 'The *pathway* in ' + p.name.toLowerCase() + '.', '', { light: true })}
    <div class="stages">${curriculum.map(
      ([h, d], i) => html`<div class="stage" data-reveal style="--d:${i}"><span class="stage__bar"><i style="width:${(i + 1) * 25}%"></i></span><span class="mono">Stage ${pad(i + 1)}</span><h3>${h}</h3><p>${d}</p></div>`
    )}</div>
  </div>
</section>`
  : ''}
${batches.length
  ? html`<section class="section">
  <div class="wrap">
    ${sectionHead('Schedule', t('program.batches.title'), '', { link: btn('/schedule', 'Full timetable', 'ink', 'right') })}
    <div class="btable" role="table" aria-label="${p.name} batches">
      <div class="btable__row btable__row--head mono" role="row"><span role="columnheader">Batch</span><span role="columnheader">Days</span><span role="columnheader">Time</span><span role="columnheader">Coach</span><span role="columnheader">Seats</span></div>
      ${batches.map((b) => batchRow(b))}
    </div>
  </div>
</section>`
  : ''}
${coaches.length
  ? html`<section class="section section--tight">
  <div class="wrap">
    ${sectionHead('Coaches', t('program.coaches.title'))}
    <div class="cgrid">${coaches.map((c, i) => coachCard(c, i))}</div>
  </div>
</section>`
  : ''}
<section class="trial section" id="trial">
  <div class="wrap trial__in">
    <div class="trial__copy">
      ${eyebrow(t('home.trial.eyebrow'))}
      <h2 class="display shead__title" data-split>${title(t('home.trial.title'))}</h2>
      <p data-reveal>${t('home.trial.text')}</p>
    </div>
    ${trialForm({ program: p.name })}
  </div>
</section>
${next && next !== p
  ? html`<a class="nextp section--dark" href="/programs/${next.slug}" data-cursor="Next">
  <div class="wrap nextp__in"><span class="mono">Next lane</span><span class="display nextp__name">${next.name}</span>${icon('arrow', 'i i--xl')}</div>
  <div class="nextp__media">${img(next.image, '', { sizes: '40vw' })}</div>
</a>`
  : ''}`;
  return layout(req, { name: 'program', title: p.name, description: p.summary, body, image: p.image });
}

function seatsInfo(b) {
  const seats = Number(b.seats) || 0;
  const left = Math.max(0, Number(b.seatsLeft) || 0);
  const pct = seats ? Math.round(((seats - left) / seats) * 100) : 0;
  const label = left === 0 ? 'Full' : left <= 3 ? `${left} left` : `${left} open`;
  return { seats, left, pct, label, hot: left <= 3 };
}

function batchRow(b) {
  const c = coachById(b.coach);
  const si = seatsInfo(b);
  return html`<div class="btable__row" role="row">
    <span role="cell"><b>${b.name}</b><small>${b.ages} · ${b.level}</small></span>
    <span role="cell" class="days">${DAYS.map((d) => html`<i class="${(b.days || []).includes(d) ? 'on' : ''}" title="${d}">${d[0]}</i>`)}</span>
    <span role="cell" class="mono">${time12(b.start)} – ${time12(b.end)}<small>${b.venue}</small></span>
    <span role="cell">${c ? c.name : 'TBA'}</span>
    <span role="cell"><span class="seats${si.hot ? ' seats--hot' : ''}"><span class="seats__bar"><i style="width:${si.pct}%"></i></span>${si.label}</span></span>
  </div>`;
}

// --------------------------------------------------------------- coaches ---

function coachCard(c, i) {
  const p = programById(c.program);
  return html`<article class="coach" id="${c.id}" data-reveal style="--d:${i % 4}" data-filter-item="${p ? p.slug : ''}">
    <div class="bezel"><div class="bezel__core">
      <div class="coach__media${c.photo ? '' : ' coach__media--mono'}">
        ${c.photo ? img(c.photo, c.name, { sizes: '(max-width: 760px) 92vw, 25vw' }) : html`<span class="coach__initials display" aria-hidden="true">${initials(c.name)}</span><span class="coach__lanes" aria-hidden="true"><i></i><i></i><i></i></span>`}
        <span class="coach__exp mono">${c.experience} yrs</span>
      </div>
      <div class="coach__body">
        <span class="mono coach__sport">${p ? p.name : ''}</span>
        <h3 class="coach__name">${c.name}</h3>
        <p class="coach__role">${c.role}</p>
        ${c.quote ? html`<p class="coach__quote">“${c.quote}”</p>` : ''}
        ${c.credentials && c.credentials.length ? html`<ul class="coach__creds">${c.credentials.map((x) => html`<li>${x}</li>`)}</ul>` : ''}
      </div>
    </div></div>
  </article>`;
}

function filterBar(items, label) {
  return html`<div class="filters" role="group" aria-label="${label}" data-filters>
    <button type="button" class="chip-btn is-on" data-filter="*">All</button>
    ${items.map(([v, l]) => html`<button type="button" class="chip-btn" data-filter="${v}">${l}</button>`)}
  </div>`;
}

function coaches(req) {
  const items = list('coaches');
  const used = list('programs').filter((p) => items.some((c) => c.program === p.id));
  const body = html`
${pageHead({ eyebrow: t('coaches.eyebrow'), heading: t('coaches.title'), intro: t('coaches.intro'), no: '03 / 09' })}
<section class="section section--tight">
  <div class="wrap">
    ${filterBar(used.map((p) => [p.slug, p.name]), 'Filter coaches by sport')}
    <div class="cgrid" data-filter-list>${items.map((c, i) => coachCard(c, i))}</div>
  </div>
</section>
${ctaBand()}`;
  return layout(req, { name: 'coaches', title: 'Coaches', description: t('coaches.intro'), body });
}

// -------------------------------------------------------------- schedule ---

function schedule(req) {
  const batches = list('batches');
  const progs = list('programs').filter((p) => batches.some((b) => b.program === p.id));
  const byDay = DAYS.map((d) =>
    batches.filter((b) => (b.days || []).includes(d)).sort((a, b) => String(a.start).localeCompare(String(b.start)))
  );
  const body = html`
${pageHead({ eyebrow: t('schedule.eyebrow'), heading: t('schedule.title'), intro: t('schedule.intro'), no: '02 / 09' })}
<section class="section section--tight">
  <div class="wrap">
    ${filterBar(progs.map((p) => [p.slug, p.name]), 'Filter batches by sport')}
    <div class="week" data-filter-list data-week>
      <div class="week__tabs" role="tablist" aria-label="Day">
        ${DAYS.map((d, i) => html`<button type="button" role="tab" class="week__tab" data-day-tab="${i}" aria-selected="${i === 0 ? 'true' : 'false'}">${d}</button>`)}
      </div>
      ${DAYS.map(
        (d, i) => html`<div class="week__col${i === 0 ? ' is-on' : ''}" data-day="${i}">
        <h3 class="week__day mono">${d}</h3>
        ${byDay[i].length
          ? byDay[i].map((b) => {
              const p = programById(b.program);
              const si = seatsInfo(b);
              return html`<a class="slot" href="/programs/${p ? p.slug : ''}" data-filter-item="${p ? p.slug : ''}">
              <span class="slot__time mono">${time12(b.start)}</span>
              <b class="slot__name">${b.name}</b>
              <span class="slot__prog">${p ? p.name : ''} · ${b.ages}</span>
              <span class="seats${si.hot ? ' seats--hot' : ''}"><span class="seats__bar"><i style="width:${si.pct}%"></i></span>${si.label}</span>
            </a>`;
            })
          : html`<p class="week__empty">Rest day</p>`}
      </div>`
      )}
    </div>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    ${sectionHead('All batches', 'Every batch, *one list*.')}
    <div class="btable" role="table" aria-label="All batches" data-filter-list>
      <div class="btable__row btable__row--head mono" role="row"><span role="columnheader">Batch</span><span role="columnheader">Days</span><span role="columnheader">Time</span><span role="columnheader">Coach</span><span role="columnheader">Seats</span></div>
      ${progs.map((p) =>
        batches
          .filter((b) => b.program === p.id)
          .map((b) => html`<div data-filter-item="${p.slug}" class="btable__group">${batchRow({ ...b, name: `${p.name} · ${b.name}` })}</div>`)
      )}
    </div>
  </div>
</section>
${ctaBand()}`;
  return layout(req, { name: 'schedule', title: 'Schedule', description: t('schedule.intro'), body });
}

// --------------------------------------------------------------- gallery ---

function gallery(req) {
  const items = list('gallery');
  const tags = [...new Set(items.map((g) => g.sport).filter(Boolean))];
  const body = html`
${pageHead({ eyebrow: t('gallery.eyebrow'), heading: t('gallery.title'), intro: t('gallery.intro'), no: '06 / 09' })}
<section class="section section--tight">
  <div class="wrap">
    ${filterBar(tags.map((x) => [x.toLowerCase(), x]), 'Filter photos')}
    <div class="masonry" data-filter-list data-lightbox>
      ${items.map(
        (g, i) => html`<figure class="tile tile--${g.shape || 'normal'}" data-filter-item="${(g.sport || '').toLowerCase()}" data-reveal style="--d:${i % 3}">
        <button type="button" class="tile__btn" data-lightbox-item="${g.image}" data-caption="${g.caption}" data-cursor="Zoom" aria-label="Open photo: ${g.caption || g.alt}">
          ${img(g.image, g.alt, { sizes: '(max-width: 760px) 92vw, 33vw' })}
        </button>
        ${g.caption ? html`<figcaption><span>${g.caption}</span><span class="mono">${g.sport}</span></figcaption>` : ''}
      </figure>`
      )}
    </div>
  </div>
</section>
<div class="lightbox" hidden data-lightbox-view role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button class="round lightbox__close" type="button" data-lightbox-close aria-label="Close">${icon('close')}</button>
  <button class="round lightbox__prev" type="button" data-lightbox-prev aria-label="Previous photo">${icon('left')}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="round lightbox__next" type="button" data-lightbox-next aria-label="Next photo">${icon('right')}</button>
</div>`;
  return layout(req, { name: 'gallery', title: 'Gallery', description: t('gallery.intro'), body });
}

// ------------------------------------------------------------------ news ---

function news(req) {
  const posts = list('posts');
  const today = new Date().toISOString().slice(0, 10);
  const events = list('events').filter((e) => e.date >= today);
  const [first, ...rest] = posts;
  const body = html`
${pageHead({ eyebrow: t('news.eyebrow'), heading: t('news.title'), intro: t('news.intro'), no: '07 / 09' })}
${first
  ? html`<section class="section section--tight">
  <div class="wrap">
    <a class="feature" href="/news/${first.slug}" data-cursor="Read">
      <div class="bezel feature__media" data-clip><div class="bezel__core">${img(first.cover, '', { sizes: '(max-width: 760px) 92vw, 60vw' })}</div></div>
      <div class="feature__copy" data-reveal>
        <div class="post__meta mono"><span>${first.category}</span><span>${date(first.date)}</span></div>
        <h2 class="display feature__title">${first.title}</h2>
        <p>${first.excerpt}</p>
        <span class="link-arrow">Read story ${icon('arrow')}</span>
      </div>
    </a>
  </div>
</section>`
  : ''}
${events.length
  ? html`<section class="section section--dark">
  <div class="wrap">
    ${sectionHead('Calendar', t('news.events.title'), '', { light: true })}
    <ul class="events">${events.map((e) => {
      const d = date(e.date, 'parts');
      return html`<li class="event" data-reveal>
        <span class="event__date"><b class="display">${d.day}</b><span class="mono">${d.month} ${d.year}</span></span>
        <div class="event__body"><span class="mono">${e.sport} · ${e.time} · ${e.venue}</span><h3>${e.title}</h3><p>${e.description}</p></div>
        ${e.link ? btn(e.link, 'Register', 'volt', 'arrow', 'target="_blank" rel="noopener"') : btn('/contact', 'Ask about it', 'glass', 'right')}
      </li>`;
    })}</ul>
  </div>
</section>`
  : ''}
${rest.length
  ? html`<section class="section">
  <div class="wrap">
    ${sectionHead('Archive', 'More *stories*.')}
    <div class="news__grid">${rest.map((p, i) => postCard(p, i))}</div>
  </div>
</section>`
  : ''}`;
  return layout(req, { name: 'news', title: 'Stories & events', description: t('news.intro'), body });
}

function post(req, slug) {
  const p = list('posts').find((x) => x.slug === slug);
  if (!p) return null;
  const more = list('posts').filter((x) => x.id !== p.id).slice(0, 3);
  const body = html`
<article>
  <section class="phead phead--post">
    <div class="phead__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="wrap phead__in phead__in--narrow">
      <a class="crumb mono" href="/news">${icon('left')} All stories</a>
      <div class="post__meta mono"><span>${p.category}</span><span>${date(p.date)}</span>${p.author ? html`<span>By ${p.author}</span>` : ''}</div>
      <h1 class="display phead__title phead__title--post" data-split>${title(p.title)}</h1>
      <p class="phead__intro" data-reveal>${p.excerpt}</p>
    </div>
  </section>
  ${p.cover ? html`<div class="wrap"><div class="bezel post__cover" data-clip><div class="bezel__core">${img(p.cover, '', { eager: true, sizes: '(max-width: 760px) 92vw, 1100px' })}</div></div></div>` : ''}
  <div class="wrap section section--tight"><div class="prose prose--article">${raw(content.md(p.body))}</div></div>
</article>
${more.length
  ? html`<section class="section section--tight">
  <div class="wrap">${sectionHead('Keep reading', 'More *stories*.')}<div class="news__grid">${more.map((x, i) => postCard(x, i))}</div></div>
</section>`
  : ''}`;
  return layout(req, { name: 'post', title: p.title, description: p.excerpt, body, image: p.cover });
}

// ------------------------------------------------------------ admissions ---

function admissions(req) {
  const s = settings();
  const steps = pairs(t('admissions.steps'));
  const plans = list('plans');
  const programs = list('programs');
  const batches = list('batches');
  const faqs = list('faqs');
  const today = new Date().toISOString().slice(0, 10);
  const body = html`
${pageHead({ eyebrow: t('admissions.eyebrow'), heading: t('admissions.title'), intro: t('admissions.intro'), no: '08 / 09' })}
<section class="section section--tight">
  <div class="wrap">
    <ol class="steps">${steps.map(
      ([h, p], i) => html`<li class="step" data-reveal style="--d:${i}"><span class="step__no display">${pad(i + 1)}</span><h3>${h}</h3><p>${p}</p></li>`
    )}</ol>
  </div>
</section>
${plans.length
  ? html`<section class="section section--dark" id="fees">
  <div class="wrap">
    ${sectionHead('Fees', t('admissions.plans.title'), t('admissions.plans.text'), { light: true })}
    <div class="plans">${plans.map(
      (p, i) => html`<div class="plan${p.featured ? ' plan--featured' : ''}" data-reveal style="--d:${i}">
      <div class="bezel"><div class="bezel__core">
        <div class="plan__top"><h3>${p.name}</h3>${p.featured ? html`<span class="badge">Most picked</span>` : ''}</div>
        <p class="plan__price"><span class="display">${money(p.price)}</span><span>${p.period}</span></p>
        <p class="plan__note mono">${p.note}</p>
        <ul class="ticks">${(p.features || []).map((f) => html`<li>${icon('check')} ${f}</li>`)}</ul>
        <a class="btn ${p.featured ? 'btn--volt' : 'btn--glass'} btn--block" href="#apply"><span class="btn__label">Choose ${p.name.toLowerCase()}</span><span class="btn__ic">${icon('arrow')}</span></a>
      </div></div>
    </div>`
    )}</div>
  </div>
</section>`
  : ''}
<section class="section" id="apply">
  <div class="wrap apply">
    <div class="apply__copy">
      ${eyebrow('Apply')}
      <h2 class="display shead__title" data-split>${title(t('admissions.form.title'))}</h2>
      <p data-reveal>Three short steps. We call you within one working day to schedule the assessment.</p>
      <ol class="apply__progress mono" data-steps-nav>
        <li class="is-on">01 · Athlete</li><li>02 · Contact</li><li>03 · Program</li>
      </ol>
    </div>
    ${s.admissionsOpen
      ? html`<form class="bezel form-shell" data-form="admissions" data-stepped novalidate>
      <div class="bezel__core form-card">
        <fieldset class="fstep is-on" data-fstep>
          <legend class="mono">Step 1 of 3 · Athlete</legend>
          <div class="form-grid">
            ${formField({ name: 'student', label: 'Athlete’s full name', required: true, autocomplete: 'name', full: true })}
            ${formField({ name: 'dob', label: 'Date of birth', type: 'date', required: true, max: today })}
            ${formField({ name: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Prefer not to say'] })}
            ${formField({ name: 'experience', label: 'Experience so far', type: 'textarea', placeholder: 'e.g. School team for 2 years, district U-14', full: true })}
          </div>
        </fieldset>
        <fieldset class="fstep" data-fstep>
          <legend class="mono">Step 2 of 3 · Contact</legend>
          <div class="form-grid">
            ${formField({ name: 'guardian', label: 'Parent / guardian name', autocomplete: 'name', full: true })}
            ${formField({ name: 'phone', label: 'Phone / WhatsApp', type: 'tel', required: true, autocomplete: 'tel' })}
            ${formField({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
            ${formField({ name: 'medical', label: 'Medical conditions or allergies', type: 'textarea', full: true })}
          </div>
        </fieldset>
        <fieldset class="fstep" data-fstep>
          <legend class="mono">Step 3 of 3 · Program</legend>
          <div class="form-grid">
            ${formField({ name: 'program', label: 'Program', type: 'select', required: true, options: programs.map((p) => p.name) })}
            ${formField({ name: 'batch', label: 'Preferred batch', type: 'select', options: batches.map((b) => `${(programById(b.program) || {}).name} · ${b.name} (${time12(b.start)})`) })}
            ${formField({ name: 'plan', label: 'Fee plan', type: 'select', options: plans.map((p) => p.name) })}
            ${formField({ name: 'message', label: 'Anything else?', type: 'textarea', full: true })}
            <label class="check field--full"><input type="checkbox" name="consent"> <span>I agree to the <a href="/privacy-policy" target="_blank">privacy policy</a> and confirm the details are correct.</span></label>
            <span class="field__err" data-err="consent"></span>
          </div>
        </fieldset>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-foot">
          <button class="btn btn--ghost" type="button" data-step-prev hidden><span class="btn__label">Back</span><span class="btn__ic">${icon('left')}</span></button>
          <button class="btn btn--primary" type="button" data-step-next><span class="btn__label">Continue</span><span class="btn__ic">${icon('right')}</span></button>
          <button class="btn btn--primary" type="submit" hidden data-step-submit><span class="btn__label">Submit application</span><span class="btn__ic">${icon('arrow')}</span></button>
          <p class="form-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </form>`
      : html`<div class="bezel"><div class="bezel__core form-card"><p>${t('admissions.closed')}</p>${btn('/contact', 'Contact us', 'primary')}</div></div>`}
  </div>
</section>
<section class="trial section section--alt" id="trial">
  <div class="wrap trial__in">
    <div class="trial__copy">
      ${eyebrow(t('home.trial.eyebrow'))}
      <h2 class="display shead__title" data-split>${title(t('home.trial.title'))}</h2>
      <p data-reveal>${t('home.trial.text')}</p>
    </div>
    ${trialForm()}
  </div>
</section>
${faqs.length
  ? html`<section class="section">
  <div class="wrap faq">
    ${sectionHead('FAQ', t('admissions.faq.title'))}
    <div class="faq__list">${faqs.map(
      (q) => html`<details class="faq__item" data-reveal><summary><span>${q.question}</span><span class="faq__ic">${icon('plus')}</span></summary><div class="faq__a"><p>${q.answer}</p></div></details>`
    )}</div>
  </div>
</section>`
  : ''}`;
  return layout(req, { name: 'admissions', title: 'Admissions', description: t('admissions.intro'), body });
}

// --------------------------------------------------------------- contact ---

function contact(req) {
  const s = settings();
  const wa = s.whatsapp ? `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}` : '';
  const body = html`
${pageHead({ eyebrow: t('contact.eyebrow'), heading: t('contact.title'), intro: t('contact.intro'), no: '09 / 09' })}
<section class="section section--tight">
  <div class="wrap contact">
    <div class="contact__info">
      <a class="cinfo" href="tel:${String(s.phone).replace(/\s/g, '')}" data-reveal>${icon('phone')}<span class="mono">Call</span><b>${s.phone}</b></a>
      <a class="cinfo" href="mailto:${s.email}" data-reveal>${icon('mail')}<span class="mono">Email</span><b>${s.email}</b></a>
      ${wa ? html`<a class="cinfo" href="${wa}" target="_blank" rel="noopener" data-reveal>${icon('whatsapp')}<span class="mono">WhatsApp</span><b>Chat with the front desk</b></a>` : ''}
      <div class="cinfo" data-reveal>${icon('pin')}<span class="mono">Visit</span><b>${String(s.address || '').split('\n').map((l) => html`${l}<br>`)}</b></div>
      <div class="cinfo" data-reveal>${icon('clock')}<span class="mono">Hours</span><b>${(s.hours || []).map((h) => html`${h}<br>`)}</b></div>
    </div>
    <form class="bezel form-shell" data-form="enquiries" novalidate>
      <div class="bezel__core form-card">
        <h2 class="form-title">Send a message</h2>
        <div class="form-grid">
          ${formField({ name: 'name', label: 'Your name', required: true, autocomplete: 'name' })}
          ${formField({ name: 'phone', label: 'Phone', type: 'tel', required: true, autocomplete: 'tel' })}
          ${formField({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
          ${formField({ name: 'topic', label: 'Topic', type: 'select', options: ['Admissions', 'Fees', 'Free trial', 'Events', 'Coaching jobs', 'Something else'] })}
          ${formField({ name: 'message', label: 'Message', type: 'textarea', required: true, full: true })}
        </div>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-foot">
          <button class="btn btn--primary" type="submit"><span class="btn__label">Send message</span><span class="btn__ic">${icon('arrow')}</span></button>
          <p class="form-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </form>
  </div>
</section>
${s.mapEmbed ? html`<section class="map"><div class="wrap"><div class="bezel"><div class="bezel__core"><iframe title="Map to ${s.name}" src="${s.mapEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div></div></section>` : ''}`;
  return layout(req, { name: 'contact', title: 'Contact', description: t('contact.intro'), body });
}

// ------------------------------------------------------- custom & misc ---

function customPage(req, slug) {
  const p = list('pages').find((x) => x.slug === slug);
  if (!p) return null;
  const body = html`
${pageHead({ eyebrow: settings().name, heading: p.title, intro: p.intro })}
<section class="section section--tight"><div class="wrap"><div class="prose prose--article">${raw(content.md(p.body))}</div></div></section>`;
  return layout(req, { name: 'custom', title: p.title, description: p.intro, body });
}

function credits(req) {
  let items = [];
  try {
    items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'img', 'manifest.json'), 'utf8'));
  } catch {}
  const body = html`
${pageHead({ eyebrow: 'Colophon', heading: 'Photo *credits*.', intro: 'Every photograph on this site is a real photo shared under a Creative Commons licence. Thank you to the photographers.' })}
<section class="section section--tight"><div class="wrap">
  <div class="credits">${items.map(
    (m) => html`<div class="credit">${img('/img/' + m.file, m.alt, { sizes: '120px' })}<div><b>${m.credit && m.credit.title ? m.credit.title : m.alt}</b><span>Photo: ${m.credit ? m.credit.author : ''} · <a href="${m.credit ? m.credit.licenseUrl : '#'}" target="_blank" rel="noopener">${m.credit ? m.credit.license : ''}</a> · <a href="${m.credit ? m.credit.url : '#'}" target="_blank" rel="noopener">Source</a></span><small class="mono">${m.credit ? m.credit.modified : ''}</small></div></div>`
  )}</div>
  <p class="credits__note">Images uploaded through the admin panel belong to the academy.</p>
</div></section>`;
  return layout(req, { name: 'credits', title: 'Photo credits', body });
}

function notFound(req) {
  const body = html`<section class="nf section--dark">
  <div class="cta__lanes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="wrap nf__in">
    <span class="eyebrow eyebrow--light">Error 404</span>
    <h1 class="display nf__title" data-split>${title('Out of\n*bounds*.')}</h1>
    <p>The page you were looking for has left the field.</p>
    <div class="actions">${btn('/', 'Back to home', 'volt', 'left')}${btn('/programs', 'See programs', 'glass', 'right')}</div>
  </div>
</section>`;
  return layout(req, { name: 'notfound', title: 'Page not found', body });
}

module.exports = { home, about, programs, program, coaches, schedule, gallery, news, post, admissions, contact, customPage, credits, notFound };
