/* Vega Sports Academy: interactions and motion.
   Everything works without this file; with it, GSAP + ScrollTrigger + SplitText
   drive the motion and Lenis smooths scrolling. Reduced motion skips all of it. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var motion = root.classList.contains('js-motion') && window.gsap && window.ScrollTrigger;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var EASE = 'expo.out';
  window.__vegaReady = true;

  if (!motion) root.classList.remove('js-motion');

  var lenis = null;
  if (motion) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    if (window.Lenis) {
      lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }

  // Anchor links scroll smoothly (and past the floating nav).
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"], a[href*="#"]');
    if (!a || a.target) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    var target = document.getElementById(url.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -90 });
    else target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', url.hash);
  });

  /* ------------------------------------------------------------- nav */
  var nav = $('[data-nav]');
  var menu = $('[data-menu]');
  var burger = $('[data-burger]');
  var lastY = 0;
  var darkSel = '.announce, .hero, .section--dark, .phead, .phero, .footer, .nf, .menu';

  function updateNav() {
    var y = window.scrollY;
    var hide = y > 400 && y > lastY + 4 && !document.body.classList.contains('menu-open');
    if (y < lastY - 4 || y < 400) nav.classList.remove('is-hidden');
    else if (hide) nav.classList.add('is-hidden');
    lastY = y;
    // Light or dark pill depending on what is under it.
    var probe = document.elementsFromPoint(window.innerWidth / 2, 46).find(function (el) { return !nav.contains(el); });
    nav.classList.toggle('is-dark', !!(probe && probe.closest(darkSel)));
  }
  if (nav) {
    window.addEventListener('scroll', function () { requestAnimationFrame(updateNav); }, { passive: true });
    updateNav();
  }

  function openMenu() {
    menu.hidden = false;
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    if (lenis) lenis.stop();
    var first = $('a', menu);
    setTimeout(function () { first && first.focus(); }, 200);
  }
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    if (lenis) lenis.start();
    setTimeout(function () { menu.hidden = true; }, 500);
  }
  if (burger) burger.addEventListener('click', function () { menu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeMenu(); closeLightbox(); }
  });

  /* ---------------------------------------------------------- cursor */
  var cursor = $('.cursor');
  if (cursor && fine) {
    var label = $('.cursor__label', cursor);
    var cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('is-ready');
      var t = e.target.closest && e.target.closest('[data-cursor]');
      cursor.classList.toggle('is-label', !!t);
      label.textContent = t ? t.getAttribute('data-cursor') : '';
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('is-ready'); });
    (function loop() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* --------------------------------------------------- floating images */
  function floatingImage(list, rowSel, attr, floatEl, tagAttr) {
    if (!list || !floatEl || !fine) return;
    var img = $('img', floatEl);
    var tag = $('.roster__tag', floatEl);
    var x = 0, y = 0, fx = 0, fy = 0, running = false;
    function loop() {
      fx += (x - fx) * 0.14; fy += (y - fy) * 0.14;
      floatEl.style.transform = 'translate3d(' + (fx + 24) + 'px,' + (fy - 140) + 'px,0) rotate(' + Math.max(-8, Math.min(8, (x - fx) * 0.08)) + 'deg)';
      if (running) requestAnimationFrame(loop);
    }
    $$(rowSel, list).forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        var src = row.getAttribute(attr);
        if (!src) return;
        img.src = src;
        if (tag) tag.textContent = row.getAttribute(tagAttr) || '';
        floatEl.classList.add('is-on');
        if (!running) { running = true; fx = x; fy = y; loop(); }
      });
      row.addEventListener('pointerleave', function () { floatEl.classList.remove('is-on'); running = false; });
    });
    list.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; });
  }
  floatingImage($('[data-roster]'), '.roster__row', 'data-roster-img', $('.roster__float'), 'data-roster-tag');
  floatingImage($('[data-pindex]'), '.pindex__row', 'data-pindex-img', $('.pindex__float'));

  /* ------------------------------------------------------ hero clock */
  var clock = $('[data-clock]');
  if (clock) {
    var start = performance.now();
    var tick = function () {
      var ms = performance.now() - start;
      var m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, h = Math.floor(ms / 10) % 100;
      clock.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (h < 10 ? '0' : '') + h;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------------------------------------------------- testimonials */
  var voices = $('[data-voices]');
  if (voices) {
    var items = $$('[data-voice]', voices);
    var bar = $('[data-voices-bar]', voices);
    var idx = $('[data-voices-index]', voices);
    var cur = 0, timer = null, DUR = 7000;
    var show = function (n) {
      var prev = items[cur];
      cur = (n + items.length) % items.length;
      var next = items[cur];
      idx.textContent = (cur + 1 < 10 ? '0' : '') + (cur + 1);
      if (motion && prev !== next) {
        gsap.to(prev.querySelector('blockquote'), { yPercent: -12, opacity: 0, duration: 0.5, ease: 'power3.in', onComplete: function () { prev.classList.remove('is-active'); gsap.set(prev.querySelector('blockquote'), { clearProps: 'all' }); } });
        next.classList.add('is-active');
        gsap.fromTo(next.querySelector('blockquote'), { yPercent: 14, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, delay: 0.35, ease: EASE });
        gsap.fromTo(next.querySelector('figcaption'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.55, ease: EASE });
      } else {
        items.forEach(function (it, i) { it.classList.toggle('is-active', i === cur); });
      }
      restart();
    };
    var restart = function () {
      clearTimeout(timer);
      if (motion) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DUR / 1000, ease: 'none' });
      timer = setTimeout(function () { show(cur + 1); }, DUR);
    };
    $('[data-voices-next]', voices).addEventListener('click', function () { show(cur + 1); });
    $('[data-voices-prev]', voices).addEventListener('click', function () { show(cur - 1); });
    if (items.length > 1) restart();
  }

  /* --------------------------------------------------------- filters */
  $$('[data-filters]').forEach(function (bar) {
    var scope = bar.parentElement;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      $$('[data-filter]', bar).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var v = b.getAttribute('data-filter');
      $$('[data-filter-item]', scope).forEach(function (it) {
        it.classList.toggle('is-filtered-out', v !== '*' && it.getAttribute('data-filter-item') !== v);
      });
      if (motion) {
        var visible = $$('[data-filter-item]:not(.is-filtered-out)', scope).filter(function (el) { return el.offsetParent; });
        gsap.fromTo(visible.slice(0, 16), { opacity: 0, y: 24 }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, stagger: 0.04, ease: EASE, overwrite: true });
        ScrollTrigger.refresh();
      }
    });
  });

  /* ----------------------------------------------------- schedule tabs */
  var week = $('[data-week]');
  if (week) {
    var today = (new Date().getDay() + 6) % 7;
    var selectDay = function (i) {
      $$('[data-day-tab]', week).forEach(function (t) { t.setAttribute('aria-selected', String(Number(t.getAttribute('data-day-tab')) === i)); });
      $$('[data-day]', week).forEach(function (c) { c.classList.toggle('is-on', Number(c.getAttribute('data-day')) === i); });
    };
    week.addEventListener('click', function (e) {
      var t = e.target.closest('[data-day-tab]');
      if (t) selectDay(Number(t.getAttribute('data-day-tab')));
    });
    selectDay(today);
  }

  /* -------------------------------------------------------- lightbox */
  var lb = $('[data-lightbox-view]');
  var lbItems = [], lbIndex = 0, lbReturn = null;
  function openLightbox(i) {
    lbItems = $$('[data-lightbox-item]').filter(function (b) { return b.offsetParent; });
    lbIndex = (i + lbItems.length) % lbItems.length;
    var b = lbItems[lbIndex];
    var im = $('img', lb);
    im.src = b.getAttribute('data-lightbox-item');
    im.alt = (b.querySelector('img') || {}).alt || '';
    $('figcaption', lb).textContent = b.getAttribute('data-caption') || '';
    if (lb.hidden) {
      lbReturn = document.activeElement;
      lb.hidden = false;
      if (lenis) lenis.stop();
      $('[data-lightbox-close]', lb).focus();
      if (motion) gsap.fromTo(lb, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    }
    if (motion) gsap.fromTo(im, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: EASE });
  }
  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    if (lenis) lenis.start();
    if (lbReturn) lbReturn.focus();
  }
  if (lb) {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lightbox-item]');
      if (b) {
        var all = $$('[data-lightbox-item]').filter(function (x) { return x.offsetParent; });
        openLightbox(all.indexOf(b));
      }
    });
    $('[data-lightbox-close]', lb).addEventListener('click', closeLightbox);
    $('[data-lightbox-next]', lb).addEventListener('click', function () { openLightbox(lbIndex + 1); });
    $('[data-lightbox-prev]', lb).addEventListener('click', function () { openLightbox(lbIndex - 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
      if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
    });
  }

  /* ----------------------------------------------------------- forms */
  function setMsg(form, text, kind) {
    var m = $('.form-msg', form);
    if (!m) return;
    m.textContent = text || '';
    m.className = 'form-msg' + (kind ? ' is-' + kind : '');
  }
  function clearErrors(form) {
    $$('.field.has-err', form).forEach(function (f) { f.classList.remove('has-err'); });
    $$('[data-err]', form).forEach(function (e) { e.textContent = ''; });
  }
  function showErrors(form, fields) {
    var firstStep = null;
    Object.keys(fields || {}).forEach(function (k) {
      var err = $('[data-err="' + k + '"]', form);
      if (err) err.textContent = fields[k];
      var input = form.elements[k];
      if (input && input.closest) {
        var f = input.closest('.field');
        if (f) f.classList.add('has-err');
        var step = input.closest('[data-fstep]');
        if (step && firstStep === null) firstStep = $$('[data-fstep]', form).indexOf(step);
      }
    });
    return firstStep;
  }

  $$('form[data-form]').forEach(function (form) {
    var type = form.getAttribute('data-form');
    var stepped = form.hasAttribute('data-stepped');
    var steps = $$('[data-fstep]', form);
    var step = 0;

    function goStep(n) {
      step = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach(function (s, i) { s.classList.toggle('is-on', i === step); });
      $('[data-step-prev]', form).hidden = step === 0;
      $('[data-step-next]', form).hidden = step === steps.length - 1;
      $('[data-step-submit]', form).hidden = step !== steps.length - 1;
      $$('[data-steps-nav] li').forEach(function (li, i) {
        li.classList.toggle('is-on', i === step);
        li.classList.toggle('is-done', i < step);
      });
      setMsg(form, '');
      var first = steps[step].querySelector('input, select, textarea');
      if (first && document.activeElement && form.contains(document.activeElement)) first.focus();
      if (motion) ScrollTrigger.refresh();
    }
    // Client-side check of the required fields in the current step.
    function stepValid() {
      clearErrors(form);
      var errs = {};
      $$('[required]', steps[step]).forEach(function (el) {
        if (!String(el.value).trim()) errs[el.name] = 'This field is required.';
      });
      if (Object.keys(errs).length) { showErrors(form, errs); return false; }
      return true;
    }
    if (stepped) {
      $('[data-step-next]', form).addEventListener('click', function () { if (stepValid()) goStep(step + 1); });
      $('[data-step-prev]', form).addEventListener('click', function () { goStep(step - 1); });
      form.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && step < steps.length - 1) {
          e.preventDefault();
          if (stepValid()) goStep(step + 1);
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      });
      var btn = $('button[type="submit"]', form);
      btn.disabled = true;
      setMsg(form, 'Sending…');
      fetch('/api/forms/' + type, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok) {
            var s = showErrors(form, res.body.fields);
            if (stepped && s !== null) goStep(s);
            setMsg(form, res.body.error || 'Something went wrong.', 'err');
            return;
          }
          var msg = res.body.message || 'Thank you!';
          if (res.body.ref) msg += ' Your reference: ' + res.body.ref + '.';
          form.reset();
          if (stepped) goStep(0);
          setMsg(form, msg, 'ok');
        })
        .catch(function () {
          btn.disabled = false;
          setMsg(form, 'Network problem. Please check your connection and try again.', 'err');
        });
    });
  });

  /* ========================================================== MOTION */
  if (!motion) return;

  var mm = gsap.matchMedia();

  // Masked line reveals for headings.
  function revealLines(el, delay) {
    var lines = $$('.ln__in', el);
    if (!lines.length) return;
    gsap.to(lines, {
      y: 0, yPercent: 0, duration: 1.3, ease: EASE, stagger: 0.09, delay: delay || 0,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  }
  $$('[data-split]').forEach(function (el) { revealLines(el); });

  // Fade-up with blur for everything marked data-reveal, in batches.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: function (els) {
      gsap.to(els, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: EASE, stagger: 0.08, overwrite: true });
    },
  });

  // Images that open from an inset clip.
  $$('[data-clip]').forEach(function (el) {
    gsap.to(el, {
      clipPath: 'inset(0% 0% 0% 0% round 1.75rem)', duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
    var im = $('img', el);
    if (im) gsap.fromTo(im, { scale: 1.25 }, { scale: 1, duration: 2, ease: EASE, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
  // The page-header photo has no rounded corners.
  $$('.phead__media[data-clip]').forEach(function (el) { gsap.set(el, { clipPath: 'inset(18% 8% 18% 8% round 0rem)' }); gsap.to(el, { clipPath: 'inset(0% 0% 0% 0% round 0rem)', duration: 1.8, delay: 0.3, ease: 'expo.inOut' }); });

  // Parallax.
  $$('[data-parallax]').forEach(function (el) {
    gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: true } });
  });

  // Count-up numbers.
  $$('[data-count]').forEach(function (el) {
    var end = Number(el.getAttribute('data-count')) || 0;
    var o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, {
      v: end, duration: 2.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('en-IN'); },
    });
  });

  // Manifesto: words light up as you scroll through.
  $$('[data-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w.replace(/[&<>]/g, '') + '</span>'; }).join(' ');
    el.setAttribute('aria-label', words.join(' '));
    gsap.to($$('.w', el), {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
  });

  // Footer wordmark stretches from condensed to expanded.
  $$('[data-stretch]').forEach(function (el) {
    gsap.fromTo(el, { fontStretch: '62%', yPercent: 30 }, { fontStretch: '125%', yPercent: 8, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });

  // Pathway rail and timeline rail fill as you scroll.
  $$('[data-method]').forEach(function (list) {
    gsap.to($('[data-method-progress]', list), { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 60%', end: 'bottom 60%', scrub: true } });
    $$('[data-step]', list).forEach(function (s) {
      ScrollTrigger.create({ trigger: s, start: 'top 62%', end: 'bottom 62%', onToggle: function (self) { if (self.isActive || self.progress === 1) s.classList.add('is-on'); }, onLeaveBack: function () { s.classList.remove('is-on'); } });
    });
  });
  $$('[data-timeline]').forEach(function (list) {
    gsap.to($('[data-timeline-progress]', list), { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 70%', end: 'bottom 70%', scrub: true } });
  });

  // Sections with a lane background: lines draw in.
  $$('.cta__lanes, .phead__lanes').forEach(function (l) {
    gsap.fromTo(l.children, { scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: 1.6, stagger: 0.07, ease: 'expo.inOut', scrollTrigger: { trigger: l.parentElement, start: 'top 80%', once: true } });
  });

  // Horizontal programs carousel, pinned on desktop.
  mm.add('(min-width: 761px)', function () {
    $$('[data-hscroll]').forEach(function (sec) {
      var track = $('[data-hscroll-track]', sec);
      var bar = $('[data-hscroll-progress]', sec);
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: sec, pin: $('.hscroll__pin', sec), start: 'top top', end: function () { return '+=' + dist(); }, scrub: 0.8, invalidateOnRefresh: true,
          onUpdate: function (self) { gsap.set(bar, { scaleX: self.progress }); },
        },
      });
      // Cards tilt slightly while moving.
      gsap.fromTo($$('.pcard', track), { rotate: 2 }, { rotate: -2, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true } });
    });
  });

  // Magnetic pull on the primary buttons.
  if (fine) {
    $$('.btn--volt, .btn--primary, .nav__cta').forEach(function (b) {
      var xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3' });
      var yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.2);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      });
      b.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------ hero */
  var hero = $('[data-hero]');
  function heroIntro() {
    if (!hero) return;
    var lanes = $$('.lane__media', hero);
    var nos = $$('.lane__no', hero);
    var title = $('[data-hero-title]', hero);
    var tl = gsap.timeline({ defaults: { ease: EASE } });
    tl.to(lanes, { clipPath: 'inset(0% 0 0 0)', duration: 1.5, stagger: { each: 0.09, from: 'random' }, ease: 'expo.inOut' })
      .from(nos, { yPercent: 120, opacity: 0, duration: 1.1, stagger: 0.06 }, '-=0.9')
      .to($$('.ln__in', title), { y: 0, yPercent: 0, duration: 1.4, stagger: 0.1 }, '-=1.1')
      .fromTo($$('em', title), { fontStretch: '62%' }, { fontStretch: '125%', duration: 1.6, ease: 'expo.inOut' }, '-=1')
      .to($$('[data-hero-fade]', hero), { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, '-=1.2')
      .from($$('.hero__top > *, .ticker', hero), { opacity: 0, y: -12, duration: 0.9, stagger: 0.08 }, '-=1');

    // On scroll the lanes race away at different speeds and the copy lifts.
    var speeds = [-18, -34, -10, -28, -14, -38];
    lanes.forEach(function (l, i) {
      gsap.to(l, { yPercent: speeds[i % speeds.length], ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    });
    gsap.to($('.hero__content', hero), { y: -120, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  // "On your marks" intro, once per visit.
  var pre = $('.preloader');
  var seen = false;
  try { seen = sessionStorage.getItem('vega-intro') === '1'; } catch (e) {}
  if (pre && !seen && document.body.getAttribute('data-preloader') === '1') {
    try { sessionStorage.setItem('vega-intro', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    var lights = $$('.preloader__lights i', pre);
    var words = $$('.preloader__words span', pre);
    var p = gsap.timeline({ defaults: { ease: 'expo.out' } });
    gsap.set(words, { y: 0, yPercent: 110 });
    words.forEach(function (w, i) {
      p.to(w, { yPercent: 0, duration: 0.45 }, i * 0.42).to(w, { yPercent: -110, duration: 0.35, ease: 'expo.in' }, i * 0.42 + 0.32);
    });
    lights.forEach(function (l, i) {
      p.call(function () { l.classList.add('is-red'); }, null, i * 0.28);
    });
    p.call(function () { $('.preloader__lights', pre).classList.add('is-go'); }, null, 0.84)
      .to(pre, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 1.25)
      .call(function () { if (lenis) lenis.start(); heroIntro(); }, null, 1.55)
      .set(pre, { display: 'none' });
  } else {
    if (pre) pre.style.display = 'none';
    heroIntro();
  }

  // Inner page headers animate immediately.
  $$('.phead [data-split], .phero [data-split]').forEach(function (el) {
    gsap.to($$('.ln__in', el), { y: 0, yPercent: 0, duration: 1.4, ease: EASE, stagger: 0.1, delay: 0.15, overwrite: true });
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
