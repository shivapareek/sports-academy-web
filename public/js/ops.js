/* Trial session picker, one-time codes, facility booking, privacy requests
   and parent-portal actions. */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(url, body) { return window.VegaPay.post(url, body); }
  function setMsg(scope, text, kind) {
    var m = $('.form-msg', scope);
    if (!m) return;
    m.textContent = text || '';
    m.className = 'form-msg' + (kind ? ' is-' + kind : '');
  }
  function showErrors(form, fields) {
    $$('[data-err]', form).forEach(function (e) { e.textContent = ''; });
    $$('.has-err', form).forEach(function (e) { e.classList.remove('has-err'); });
    Object.keys(fields || {}).forEach(function (k) {
      var e = $('[data-err="' + k + '"]', form);
      if (e) e.textContent = fields[k];
      var i = form.elements[k];
      if (i && i.closest && i.closest('.field')) i.closest('.field').classList.add('has-err');
    });
  }

  /* ------------------------------------------------ trial slot picker */
  $$('[data-trial-slots]').forEach(function (box) {
    var form = box.closest('form');
    var sel = form.elements.program;
    var list = $('.slotpick__list', box);
    function load() {
      form.elements.batch.value = '';
      form.elements.date.value = '';
      if (!sel.value) { list.innerHTML = '<p class="muted">Choose a sport to see open sessions.</p>'; return; }
      list.innerHTML = '<p class="muted">Loading sessions…</p>';
      fetch('/api/trial-slots?program=' + encodeURIComponent(sel.value)).then(function (r) { return r.json(); }).then(function (j) {
        var slots = (j.slots || []).filter(function (s) { return s.left > 0; }).slice(0, 12);
        if (!slots.length) { list.innerHTML = '<p class="muted">No open trial sessions in the next two weeks. Send the form and we will call you to fix a time.</p>'; return; }
        list.innerHTML = slots.map(function (s, i) {
          return '<label class="slotchip"><input type="radio" name="_slot" value="' + i + '"><span><b>' + esc(s.label) + '</b><small>' + esc(s.batch) + ' · ' + esc(s.ages) + ' · ' + (s.left === 1 ? '1 spot left' : s.left + ' spots') + '</small></span></label>';
        }).join('');
        $$('input[name="_slot"]', list).forEach(function (r) {
          r.addEventListener('change', function () {
            var s = slots[Number(r.value)];
            form.elements.batch.value = s.batchId;
            form.elements.date.value = s.date;
          });
        });
      }).catch(function () { list.innerHTML = '<p class="muted">Could not load sessions. You can still send the form.</p>'; });
    }
    sel.addEventListener('change', load);
    if (sel.value) load();
    form.addEventListener('reset', function () { setTimeout(load, 0); });
  });

  /* --------------------------------------------------- one-time codes */
  $$('[data-otp]').forEach(function (box) {
    var purpose = box.getAttribute('data-otp');
    var phone = $('input[name="phone"]', box);
    var codeWrap = $('.otp__code', box);
    var code = $('input', codeWrap);
    var token = $('input[name="otpToken"]', box);
    var msg = $('.otp__msg', box);
    var otpId = null;
    var form = box.closest('form');
    function say(t, kind) { msg.textContent = t; msg.className = 'otp__msg' + (kind ? ' is-' + kind : ''); }
    $('[data-otp-send]', box).addEventListener('click', function (e) {
      var b = e.currentTarget;
      b.disabled = true;
      var email = form.elements.email ? form.elements.email.value : '';
      post('/api/otp/send', { phone: phone.value, email: email, purpose: purpose })
        .then(function (r) {
          otpId = r.otpId;
          codeWrap.hidden = false;
          say(r.message, r.demoCode ? 'demo' : 'ok');
          code.focus();
          setTimeout(function () { b.disabled = false; b.querySelector('.btn__label').textContent = 'Resend'; }, 30000);
        })
        .catch(function (err) { b.disabled = false; say(err.message, 'err'); });
    });
    $('[data-otp-verify]', box).addEventListener('click', function () {
      post('/api/otp/verify', { otpId: otpId, code: code.value })
        .then(function (r) {
          token.value = r.token;
          codeWrap.hidden = true;
          phone.readOnly = true;
          box.classList.add('is-verified');
          say('✓ Number verified', 'ok');
          var err = $('[data-err="otp"]', box);
          if (err) err.textContent = '';
        })
        .catch(function (err) { say(err.message, 'err'); });
    });
    code.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-otp-verify]', box).click(); } });
    if (form) form.addEventListener('reset', function () { token.value = ''; phone.readOnly = false; box.classList.remove('is-verified'); say(''); });
  });

  // Adults don't need the parent's code: mark the form so the step check skips it.
  $$('form[data-form="admissions"]').forEach(function (form) {
    var dob = form.elements.dob;
    if (!dob) return;
    dob.addEventListener('change', function () {
      var d = new Date(dob.value);
      if (isNaN(d)) return;
      d.setFullYear(d.getFullYear() + 18);
      form.setAttribute('data-adult', d <= new Date() ? '1' : '0');
    });
  });

  /* ------------------------------------------------- facility booking */
  var booker = $('[data-booker]');
  if (booker) {
    var datesEl = $('[data-dates]', booker);
    var slotsEl = $('[data-slots]', booker);
    var form = $('[data-book-form]', booker);
    var summary = $('[data-summary]', booker);
    var submit = $('[data-book-submit]', booker);
    var today = booker.getAttribute('data-today');
    var days = Number(booker.getAttribute('data-days')) || 14;
    var state = { resource: null, rate: 0, rname: '', date: today, picked: [], slots: [] };
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function addDays(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function label(ymd) { var d = new Date(ymd + 'T00:00:00Z'); return DOW[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
    function t12(t) { var h = Number(t.slice(0, 2)), m = t.slice(3); return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM'); }

    datesEl.innerHTML = Array.from({ length: days + 1 }, function (_, i) {
      var d = addDays(today, i), dt = new Date(d + 'T00:00:00Z');
      return '<button type="button" role="radio" class="datechip" data-date="' + d + '" aria-checked="' + (i === 0) + '"><span class="mono">' + (i === 0 ? 'Today' : DOW[dt.getUTCDay()]) + '</span><b>' + dt.getUTCDate() + '</b><span class="mono">' + MON[dt.getUTCMonth()] + '</span></button>';
    }).join('');

    function renderSummary() {
      var n = state.picked.length;
      if (!n) { summary.innerHTML = '<span class="muted">No slots selected.</span>'; submit.disabled = true; return; }
      var first = state.slots.find(function (s) { return s.start === state.picked[0]; });
      var last = state.slots.find(function (s) { return s.start === state.picked[n - 1]; });
      summary.innerHTML = '<div><b>' + esc(state.rname) + '</b><span>' + label(state.date) + ' · ' + t12(first.start) + ' – ' + t12(last.end) + '</span></div><b class="display">₹' + (state.rate * n).toLocaleString('en-IN') + '</b>';
      submit.disabled = false;
      submit.querySelector('.btn__label').textContent = 'Book & pay ₹' + (state.rate * n).toLocaleString('en-IN');
    }
    function loadSlots() {
      state.picked = [];
      renderSummary();
      slotsEl.innerHTML = '<p class="muted">Loading…</p>';
      fetch('/api/booking/slots?resource=' + encodeURIComponent(state.resource) + '&date=' + state.date).then(function (r) { return r.json(); }).then(function (j) {
        state.slots = j.slots || [];
        if (!state.slots.length) { slotsEl.innerHTML = '<p class="muted">' + esc(j.note || j.error || 'Not open for booking on this day.') + '</p>'; return; }
        slotsEl.innerHTML = state.slots.map(function (s) {
          return '<button type="button" class="slot-btn" data-start="' + s.start + '"' + (s.free ? '' : ' disabled') + ' aria-pressed="false">' + esc(s.label) + (s.free ? '' : '<small>' + (s.past ? 'Past' : 'Booked') + '</small>') + '</button>';
        }).join('');
      });
    }
    function pickResource() {
      var r = $('input[name="resource"]:checked', booker);
      if (!r) return;
      state.resource = r.value;
      state.rate = Number(r.getAttribute('data-rate'));
      state.rname = r.getAttribute('data-name');
      loadSlots();
    }
    $$('input[name="resource"]', booker).forEach(function (r) { r.addEventListener('change', pickResource); });
    datesEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-date]');
      if (!b) return;
      $$('[data-date]', datesEl).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      state.date = b.getAttribute('data-date');
      loadSlots();
    });
    // Slots must be next to each other: clicking extends or restarts the run.
    slotsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-start]');
      if (!b || b.disabled) return;
      var st = b.getAttribute('data-start');
      var idx = state.slots.findIndex(function (s) { return s.start === st; });
      var p = state.picked;
      var firstIdx = p.length ? state.slots.findIndex(function (s) { return s.start === p[0]; }) : -1;
      var lastIdx = p.length ? firstIdx + p.length - 1 : -1;
      if (p.indexOf(st) >= 0) {
        state.picked = idx === firstIdx ? p.slice(1) : idx === lastIdx ? p.slice(0, -1) : [st];
      } else if (p.length && (idx === lastIdx + 1 || idx === firstIdx - 1) && p.length < 4) {
        state.picked = idx < firstIdx ? [st].concat(p) : p.concat(st);
      } else {
        state.picked = [st];
      }
      $$('[data-start]', slotsEl).forEach(function (x) { x.setAttribute('aria-pressed', String(state.picked.indexOf(x.getAttribute('data-start')) >= 0)); });
      renderSummary();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErrors(form, {});
      submit.disabled = true;
      setMsg(form, 'Holding your slot…');
      post('/api/booking', { resourceId: state.resource, date: state.date, starts: state.picked, name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value, website: form.elements.website.value })
        .then(function (r) {
          setMsg(form, 'Slot held for ' + r.holdMinutes + ' minutes. Complete the payment…', 'ok');
          return window.VegaPay.payInvoice(r.invoiceId, r.token).then(function (p) {
            setMsg(form, 'Booking confirmed! Reference ' + r.ref + '. Details sent to your WhatsApp. Opening your receipt…', 'ok');
            setTimeout(function () { location.href = '/invoice/' + p.invoiceId + '?t=' + p.token; }, 1500);
          }).catch(function (err) {
            submit.disabled = false;
            setMsg(form, err.message + ' Your slot stays held for a few minutes. Press the button to try again.', 'err');
            loadSlots();
          });
        })
        .catch(function (err) {
          submit.disabled = false;
          setMsg(form, err.message, 'err');
          loadSlots();
        });
    });
    pickResource();
  }

  /* ------------------------------------------------- privacy requests */
  $$('[data-privacy-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name) data[el.name] = el.value; });
      post('/api/privacy-request', data)
        .then(function (r) { form.reset(); showErrors(form, {}); setMsg(form, r.message, 'ok'); })
        .catch(function (err) { setMsg(form, err.message, 'err'); });
    });
  });

  /* ----------------------------------------------------- parent portal */
  var loginForm = $('[data-portal-login]');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      post('/portal/api/login', { contact: loginForm.elements.contact.value, password: loginForm.elements.password.value })
        .then(function () { location.href = loginForm.getAttribute('data-next') || '/portal'; })
        .catch(function (err) { setMsg(loginForm, err.message, 'err'); });
    });
    $('[data-portal-forgot]', loginForm).addEventListener('click', function () {
      var c = loginForm.elements.contact.value;
      if (!c) { setMsg(loginForm, 'Enter your registered mobile or email first.', 'err'); loginForm.elements.contact.focus(); return; }
      post('/portal/api/forgot', { contact: c }).then(function (r) { setMsg(loginForm, r.message, 'ok'); });
    });
  }
  var setPw = $('[data-portal-setpw]');
  if (setPw) {
    setPw.addEventListener('submit', function (e) {
      e.preventDefault();
      post('/portal/api/set-password', { t: setPw.getAttribute('data-token'), password: setPw.elements.password.value })
        .then(function () { location.href = '/portal'; })
        .catch(function (err) { setMsg(setPw, err.message, 'err'); });
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-portal-logout]')) post('/portal/api/logout').then(function () { location.href = '/portal/login'; });
  });
  $$('[data-consent]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      post('/portal/api/consent', { type: cb.getAttribute('data-consent'), studentId: cb.getAttribute('data-student'), granted: cb.checked })
        .then(function () { cb.closest('.consent').classList.add('is-saved'); setTimeout(function () { cb.closest('.consent').classList.remove('is-saved'); }, 1600); })
        .catch(function (err) { cb.checked = !cb.checked; alert(err.message); });
    });
  });
  $$('[data-portal-profile], [data-portal-password]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var isPw = form.hasAttribute('data-portal-password');
      var body = isPw ? { current: form.elements.current.value, next: form.elements.next.value } : { email: form.elements.email.value };
      post(isPw ? '/portal/api/password' : '/portal/api/profile', body)
        .then(function () { if (isPw) form.reset(); setMsg(form, 'Saved', 'ok'); })
        .catch(function (err) { setMsg(form, err.message, 'err'); });
    });
  });
  var apStart = $('[data-autopay-start]');
  if (apStart) apStart.addEventListener('click', function () {
    apStart.disabled = true;
    window.VegaPay.startAutopay()
      .then(function () { location.reload(); })
      .catch(function (err) { apStart.disabled = false; window.VegaPay.msgNear(apStart, err.message, 'err'); });
  });
  var apCancel = $('[data-autopay-cancel]');
  if (apCancel) apCancel.addEventListener('click', function () {
    if (!confirm('Cancel UPI AutoPay? You will then pay each month yourself.')) return;
    post('/portal/api/autopay/cancel').then(function () { location.reload(); }).catch(function (err) { window.VegaPay.msgNear(apCancel, err.message, 'err'); });
  });
})();
