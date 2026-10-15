/* Vega admin panel. A small hash-routed app; lists and forms are generated
   from the schema the server sends (server/schema.js). */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var S = { user: null, csrf: '', schema: null, cache: {}, counts: {} };

  /* ---------------------------------------------------------- helpers */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
  function ago(iso) {
    var s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
  var ICONS = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    toggle: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="3"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    pencil: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  };
  function icon(n) { return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
  var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 6h6.2L16 21.4 22.8 6H29L18.6 27h-5.2z" fill="currentColor"/><path d="M22.8 6H29l-2.2 4.4h-6z" fill="#d4f53c"/></svg>';

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast toast--' + (kind || 'ok');
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function api(method, url, body, isForm) {
    var opts = { method: method, headers: {}, credentials: 'same-origin' };
    if (method !== 'GET') opts.headers['x-csrf'] = S.csrf;
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (isForm) opts.body = body;
    return fetch('/api/admin' + url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && url !== '/login' && url !== '/me') { S.user = null; renderLogin(); throw new Error(j.error || 'Please sign in.'); }
        if (!r.ok) { var e = new Error(j.error || 'Something went wrong.'); e.data = j; e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function fail(e) { toast(e.message || 'Something went wrong.', 'err'); }
  function can(p) { return S.user && S.user.perms.indexOf(p) >= 0; }

  // Extra screens register themselves here (see ops.js).
  var EXTRA = {};
  window.VegaAdmin = {
    S: S, api: api, toast: toast, fail: fail, can: can, esc: esc, icon: icon, top: top, drawer: drawer, modal: modal, confirmBox: confirmBox, closeLayer: closeLayer,
    fmtDate: fmtDate, ago: ago, fieldHtml: function (f, v, p) { return fieldHtml(f, v, p); }, readFields: function (f, x) { return readFields(f, x); },
    register: function (name, fn) { EXTRA[name] = fn; },
    hooks: {},
  };

  /* -------------------------------------------------------------- boot */
  api('GET', '/me')
    .then(function (r) { S.user = r.user; S.csrf = r.csrf; return loadSchema(); })
    .then(start)
    .catch(function () { renderLogin(); });

  function loadSchema() {
    return api('GET', '/schema').then(function (s) { S.schema = s; });
  }

  function renderLogin() {
    app.innerHTML =
      '<div class="login">' +
      '<div class="login__art"><h1>Vega<br><em>Control</em><br>room.</h1><p>Programs, batches, coaches, admissions and every word on the website, in one place.</p></div>' +
      '<div class="login__form"><form class="login__box card card__pad" id="login" novalidate>' +
      '<h2>Sign in</h2>' +
      '<div class="f"><label for="le">Email</label><input id="le" type="email" name="email" autocomplete="username" required></div>' +
      '<div class="f"><label for="lp">Password</label><input id="lp" type="password" name="password" autocomplete="current-password" required></div>' +
      '<p class="err" id="lerr"></p>' +
      '<button class="btn btn--volt" type="submit">Sign in</button>' +
      '<p class="muted" style="font-size:13px">Forgot your password? Ask an admin to reset it from Users.</p>' +
      '</form></div></div>';
    $('#le').focus();
    $('#login').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      $('#lerr').textContent = '';
      api('POST', '/login', { email: f.email.value, password: f.password.value })
        .then(function (r) { S.user = r.user; S.csrf = r.csrf; return loadSchema(); })
        .then(start)
        .catch(function (err) { $('#lerr').textContent = err.message; });
    });
  }

  function start() {
    if (S.user.mustChange) return renderForceChange();
    renderShell();
    window.addEventListener('hashchange', route);
    route();
  }

  function renderForceChange() {
    app.innerHTML =
      '<div class="login"><div class="login__art"><h1>One<br><em>quick</em><br>thing.</h1><p>You are using a temporary password. Choose your own before you continue.</p></div>' +
      '<div class="login__form"><form class="login__box card card__pad" id="pw" novalidate><h2>New password</h2>' +
      '<div class="f"><label for="pc">Current password</label><input id="pc" type="password" name="current" autocomplete="current-password"></div>' +
      '<div class="f"><label for="pn">New password</label><input id="pn" type="password" name="next" autocomplete="new-password"><span class="help">At least 10 characters with a letter and a number.</span></div>' +
      '<p class="err" id="pwerr"></p><button class="btn btn--volt" type="submit">Save and continue</button></form></div></div>';
    $('#pw').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '/password', { current: e.target.current.value, next: e.target.next.value })
        .then(function () { S.user.mustChange = false; toast('Password changed'); start(); })
        .catch(function (err) { $('#pwerr').textContent = err.message; });
    });
  }

  /* ------------------------------------------------------------- shell */
  function renderShell() {
    var sc = S.schema;
    var groups = {};
    Object.keys(sc.collections).forEach(function (k) {
      var g = sc.collections[k].group;
      (groups[g] = groups[g] || []).push(k);
    });
    var nav = '<a class="brand" href="#/">' + LOGO + '<b>VEGA</b><span>CMS</span></a>';
    nav += '<div class="side__group"><a href="#/" data-r="dash">' + icon('dash') + 'Dashboard</a>';
    if (can('submissions')) nav += '<a href="#/s/trials" data-r="s">' + icon('inbox') + 'Leads & forms<span class="count" id="newcount" hidden></span></a>';
    nav += '</div>';
    var opsNav = '';
    if (can('students')) opsNav += '<a href="#/students" data-r="students">' + icon('users') + 'Students & families</a>';
    if (can('attendance')) opsNav += '<a href="#/attendance" data-r="attendance">' + icon('list') + 'Attendance & QR</a>';
    if (can('billing')) opsNav += '<a href="#/billing" data-r="billing">' + icon('grid') + 'Fees & invoices</a><a href="#/bookings" data-r="bookings">' + icon('grid') + 'Facility bookings</a>';
    if (opsNav) nav += '<div class="side__group"><span class="side__label mono">Operations</span>' + opsNav + '</div>';
    if (can('content')) {
      Object.keys(groups).forEach(function (g) {
        nav += '<div class="side__group"><span class="side__label mono">' + esc(g) + '</span>';
        groups[g].forEach(function (k) { nav += '<a href="#/c/' + k + '" data-r="c/' + k + '">' + icon(g === 'Site' ? 'list' : 'grid') + esc(sc.collections[k].label) + '</a>'; });
        nav += '</div>';
      });
      nav += '<div class="side__group"><span class="side__label mono">Website</span>' +
        '<a href="#/texts" data-r="texts">' + icon('text') + 'Page text</a>' +
        '<a href="#/sections" data-r="sections">' + icon('toggle') + 'Home sections</a>' +
        '<a href="#/media" data-r="media">' + icon('image') + 'Media library</a>' +
        (can('settings') ? '<a href="#/messages" data-r="messages">' + icon('inbox') + 'Messages & integrations</a><a href="#/settings" data-r="settings">' + icon('cog') + 'Settings</a>' : '') + '</div>';
    }
    if (can('users')) nav += '<div class="side__group"><span class="side__label mono">Team</span><a href="#/users" data-r="users">' + icon('users') + 'Users</a><a href="#/privacy" data-r="privacy">' + icon('eye') + 'Privacy requests</a><a href="#/activity" data-r="activity">' + icon('list') + 'Activity log</a></div>';
    nav += '<div class="side__foot"><span>' + esc(S.user.name) + '<br><small>' + esc(S.user.email) + ' · ' + esc(S.schema.roles[S.user.role]) + '</small></span>' +
      '<a href="/" target="_blank" rel="noopener">' + icon('ext') + 'View website</a>' +
      '<a href="#/account">' + icon('cog') + 'My password</a>' +
      '<a href="#" id="logout">' + icon('out') + 'Sign out</a></div>';
    app.innerHTML = '<div class="shell"><aside class="side" id="side">' + nav + '</aside><main class="main" id="main"></main></div>';
    $('#logout').addEventListener('click', function (e) {
      e.preventDefault();
      api('POST', '/logout').then(function () { location.hash = ''; S.user = null; renderLogin(); });
    });
    refreshCount();
  }

  function refreshCount() {
    if (!can('submissions')) return;
    api('GET', '/dashboard').then(function (d) {
      var n = d.trials.new + d.admissions.new + d.enquiries.new;
      var el = $('#newcount');
      if (el) { el.textContent = n; el.hidden = !n; }
    }).catch(function () {});
  }

  function top(title, sub, actions) {
    return '<div class="top"><div><button class="btn btn--ghost btn--sm menu-btn" type="button" data-menu>' + icon('menu') + 'Menu</button><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><div class="top__actions">' + (actions || '') + '</div></div>';
  }

  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    $$('.side a[data-r]').forEach(function (a) {
      var r = a.getAttribute('data-r');
      a.classList.toggle('is-on', r === 'dash' ? h === '' : h === r || h.indexOf(r + '/') === 0 || (r === 's' && parts[0] === 's'));
    });
    $('#side').classList.remove('is-open');
    closeLayer();
    var main = $('#main');
    main.innerHTML = '<p class="muted">Loading…</p>';
    window.scrollTo(0, 0);
    var view;
    if (h === '') view = can('content') || can('submissions') ? viewDashboard : can('attendance') ? EXTRA.attendance : viewAccount;
    else if (EXTRA[parts[0]]) view = function (m) { EXTRA[parts[0]](m, parts.slice(1)); };
    else if (parts[0] === 's') view = function (m) { viewSubmissions(m, parts[1] || 'trials'); };
    else if (parts[0] === 'c' && parts[2]) view = function (m) { viewEdit(m, parts[1], parts[2]); };
    else if (parts[0] === 'c') view = function (m) { viewCollection(m, parts[1]); };
    else view = { texts: viewTexts, sections: viewSections, settings: viewSettings, media: viewMedia, users: viewUsers, activity: viewActivity, account: viewAccount }[parts[0]];
    if (!view) { main.innerHTML = top('Not found') + '<p>That page does not exist.</p>'; return; }
    try { view(main); } catch (e) { console.error(e); main.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; }
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu]')) $('#side').classList.toggle('is-open');
  });

  /* ------------------------------------------------------- dashboard */
  function viewDashboard(main) {
    api('GET', '/dashboard').then(function (d) {
      var max = Math.max.apply(null, d.days.map(function (x) { return x.count; }).concat([1]));
      var kpi = function (label, v, sub, href, hot) {
        return '<a class="card kpi' + (hot ? ' kpi--hot' : '') + '" href="' + href + '"><span class="mono muted">' + label + '</span><b>' + v + '</b><span class="muted" style="font-size:13px">' + sub + '</span></a>';
      };
      var hello = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
      main.innerHTML = top(hello + ', ' + S.user.name.split(' ')[0], 'Here is what is happening at the academy.', '<a class="btn btn--volt" href="/" target="_blank" rel="noopener">' + icon('ext') + 'Open website</a>') +
        '<div class="kpis">' +
        kpi('New trials', d.trials.new, d.trials.week + ' this week · ' + d.trials.total + ' total', '#/s/trials', d.trials.new > 0) +
        kpi('New admissions', d.admissions.new, d.admissions.week + ' this week · ' + d.admissions.total + ' total', '#/s/admissions', d.admissions.new > 0) +
        kpi('New enquiries', d.enquiries.new, d.enquiries.week + ' this week · ' + d.enquiries.total + ' total', '#/s/enquiries') +
        kpi('Subscribers', d.subscribers, 'Newsletter list', '#/s/subscribers') +
        kpi('Seats left', d.seatsLeft, 'Across all batches', '#/c/batches') +
        '</div>' +
        '<div id="opsum"></div>' +
        '<div class="dash"><div class="grid">' +
        '<div class="card card__pad"><h2>Form submissions · 14 days</h2><div class="chart">' + d.days.map(function (x) {
          return '<div title="' + x.day + ': ' + x.count + '"><i style="height:' + Math.round((x.count / max) * 130) + 'px"></i><span>' + x.day.slice(8) + '</span></div>';
        }).join('') + '</div></div>' +
        '<div class="card card__pad"><h2>Latest leads</h2><div class="feed">' + (d.recent.length ? d.recent.map(function (r) {
          return '<a href="#/s/' + r.type + '"><span><b>' + esc(r.name) + '</b> <span class="muted">· ' + esc(r.program) + '</span></span><span><span class="tag tag--' + r.status + '">' + esc(r.status) + '</span> <span class="muted" style="font-size:12px">' + ago(r.createdAt) + '</span></span></a>';
        }).join('') : '<p class="muted">No submissions yet. They appear here as soon as someone fills a form on the site.</p>') + '</div></div>' +
        '</div><div class="grid">' +
        '<div class="card card__pad"><h2>Content</h2><div class="feed">' + Object.keys(d.content).map(function (k) {
          return '<a href="#/c/' + k + '"><span>' + esc(S.schema.collections[k].label) + '</span><b>' + d.content[k] + '</b></a>';
        }).join('') + '</div></div>' +
        '<div class="card card__pad"><h2>Recent activity</h2><div class="feed">' + d.activity.map(function (a) {
          return '<div><span>' + esc(a.action) + (a.detail ? ' <span class="muted">· ' + esc(a.detail) + '</span>' : '') + '</span><span class="muted" style="font-size:12px;white-space:nowrap">' + ago(a.at) + '</span></div>';
        }).join('') + '</div></div>' +
        '</div></div>';
      if (window.VegaAdmin.hooks.dashboard) window.VegaAdmin.hooks.dashboard($('#opsum'));
    }).catch(fail);
  }

  /* ----------------------------------------------------- submissions */
  var LABELS = { name: 'Name', student: 'Athlete', dob: 'Date of birth', gender: 'Gender', guardian: 'Guardian', phone: 'Phone', email: 'Email', age: 'Age', program: 'Program', batch: 'Batch', plan: 'Plan', experience: 'Experience', medical: 'Medical notes', topic: 'Topic', message: 'Message', date: 'Preferred day' };

  function viewSubmissions(main, type) {
    var defs = S.schema.submissions;
    if (!defs[type]) type = 'trials';
    var state = { q: '', status: '' };
    api('GET', '/s/' + type).then(function (rows) {
      function cols() {
        if (type === 'subscribers') return ['email'];
        if (type === 'admissions') return ['student', 'program', 'phone', 'guardian'];
        if (type === 'trials') return ['name', 'program', 'phone', 'date'];
        return ['name', 'topic', 'phone', 'email'];
      }
      function filtered() {
        var q = state.q.toLowerCase();
        return rows.filter(function (r) {
          if (state.status && r.status !== state.status) return false;
          if (!q) return true;
          return JSON.stringify(r).toLowerCase().indexOf(q) >= 0;
        });
      }
      function draw() {
        var list = filtered();
        $('#subtable').innerHTML = list.length
          ? '<table class="table"><thead><tr>' + cols().map(function (c) { return '<th>' + esc(LABELS[c] || c) + '</th>'; }).join('') + (type === 'subscribers' ? '' : '<th>Status</th>') + '<th>Received</th></tr></thead><tbody>' +
            list.map(function (r) {
              return '<tr data-id="' + r.id + '">' + cols().map(function (c, i) { return '<td>' + (i === 0 ? '<b>' + esc(r[c]) + '</b>' : esc(r[c])) + '</td>'; }).join('') +
                (type === 'subscribers' ? '' : '<td><span class="tag tag--' + r.status + '">' + esc(r.status) + '</span></td>') + '<td class="muted">' + fmtDate(r.createdAt) + '</td></tr>';
            }).join('') + '</tbody></table>'
          : '<div class="empty">' + (rows.length ? 'Nothing matches your filters.' : 'No ' + defs[type].label.toLowerCase() + ' yet.') + '</div>';
      }
      main.innerHTML = top('Leads & forms', 'Everything visitors send through the website.', '<a class="btn btn--ghost" href="/api/admin/s/' + type + '/export.csv">' + icon('down') + 'Export CSV</a>') +
        '<div class="tabs">' + Object.keys(defs).map(function (k) { return '<a href="#/s/' + k + '" class="' + (k === type ? 'is-on' : '') + '">' + esc(defs[k].label) + '</a>'; }).join('') + '</div>' +
        '<div class="toolbar"><input class="input search" type="search" placeholder="Search name, phone, program…" id="subq" aria-label="Search">' +
        (type === 'subscribers' ? '' : '<select class="input" id="subst" style="width:auto" aria-label="Status"><option value="">All statuses</option>' + S.schema.statuses.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>') +
        '<span class="muted" style="margin-left:auto;font-size:13px">' + rows.length + ' total</span></div>' +
        '<div class="card table-wrap" id="subtable"></div>';
      draw();
      $('#subq').addEventListener('input', function (e) { state.q = e.target.value; draw(); });
      var st = $('#subst');
      if (st) st.addEventListener('change', function (e) { state.status = e.target.value; draw(); });
      $('#subtable').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        var r = rows.find(function (x) { return x.id === tr.getAttribute('data-id'); });
        openSubmission(type, r, function (updated) {
          if (updated === null) rows = rows.filter(function (x) { return x.id !== r.id; });
          else Object.assign(r, updated);
          draw();
          refreshCount();
        });
      });
    }).catch(fail);
  }

  function openSubmission(type, r, onChange) {
    var fields = S.schema.submissions[type].fields;
    var phone = String(r.phone || '').replace(/[^\d+]/g, '');
    var wa = phone ? 'https://wa.me/' + phone.replace(/^\+/, '').replace(/^(\d{10})$/, '91$1') : '';
    var body = '<dl class="dl">' + fields.filter(function (f) { return r[f]; }).map(function (f) { return '<dt>' + esc(LABELS[f] || f) + '</dt><dd>' + esc(r[f]) + '</dd>'; }).join('') +
      '<dt>Received</dt><dd>' + fmtDate(r.createdAt) + '</dd><dt>Reference</dt><dd class="mono">' + esc(r.id.slice(-6).toUpperCase()) + '</dd></dl>';
    if (type !== 'subscribers') {
      body += '<div class="f"><label for="sst">Status</label><select id="sst">' + S.schema.statuses.map(function (s) { return '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="f"><label for="snotes">Internal notes</label><textarea id="snotes" placeholder="Called on Monday, coming for trial Saturday 7 AM…">' + esc(r.notes || '') + '</textarea></div>';
    }
    var actions = (phone ? '<a class="btn btn--ghost btn--sm" href="tel:' + esc(phone) + '">Call</a> <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(wa) + '">WhatsApp</a> ' : '') + (r.email ? '<a class="btn btn--ghost btn--sm" href="mailto:' + esc(r.email) + '">Email</a>' : '');
    if (type === 'admissions' && can('students')) {
      actions += r.studentId ? ' <a class="btn btn--ghost btn--sm" href="#/students/' + esc(r.studentId) + '">Open student</a>' : ' <button class="btn btn--volt btn--sm" type="button" data-enroll>Enrol & invite to portal</button>';
    }
    if (r.consent) body += '<p class="muted" style="font-size:13px">Consent: ' + esc(r.consent.method === 'otp' ? 'parent verified by one-time code' : 'checkbox') + ' · version ' + esc(r.consent.version) + ' · ' + fmtDate(r.consent.at) + '</p>';
    var d = drawer(r.name || r.student || r.email, '<div style="display:flex;gap:6px;flex-wrap:wrap">' + actions + '</div>' + body,
      '<button class="btn btn--danger btn--sm" data-del>' + icon('trash') + 'Delete</button>' + (type !== 'subscribers' ? '<button class="btn" data-save>Save</button>' : ''));
    var enroll = $('[data-enroll]', d);
    if (enroll) enroll.addEventListener('click', function () {
      enroll.disabled = true;
      api('POST', '/ops/admissions/' + r.id + '/enroll').then(function (x) {
        toast(x.waitlisted ? 'Student created and kept on the waiting list (batch full).' : x.joinedBatch ? 'Enrolled. Portal invite sent.' : 'Enrolled without a batch: pick one in Students. Portal invite sent.');
        onChange({ status: x.status, studentId: x.studentId });
        closeLayer();
      }).catch(function (e) { enroll.disabled = false; fail(e); });
    });
    var save = $('[data-save]', d);
    if (save) save.addEventListener('click', function () {
      api('PATCH', '/s/' + type + '/' + r.id, { status: $('#sst').value, notes: $('#snotes').value })
        .then(function (u) { toast('Saved'); onChange(u); closeLayer(); }).catch(fail);
    });
    $('[data-del]', d).addEventListener('click', function () {
      confirmBox('Delete this record?', 'This cannot be undone.', 'Delete').then(function (ok) {
        if (!ok) return;
        api('DELETE', '/s/' + type + '/' + r.id).then(function () { toast('Deleted'); onChange(null); closeLayer(); }).catch(fail);
      });
    });
  }

  /* ------------------------------------------------------- layers */
  function closeLayer() { $$('.overlay, .drawer, .modal').forEach(function (el) { el.remove(); }); }
  function drawer(title, body, foot) {
    closeLayer();
    var o = document.createElement('div'); o.className = 'overlay';
    var d = document.createElement('div'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="drawer__head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-x aria-label="Close">' + icon('close') + '</button></div><div class="drawer__body">' + body + '</div>' + (foot ? '<div class="drawer__foot">' + foot + '</div>' : '');
    document.body.appendChild(o); document.body.appendChild(d);
    o.addEventListener('click', closeLayer);
    $('[data-x]', d).addEventListener('click', closeLayer);
    $('[data-x]', d).focus();
    return d;
  }
  function modal(html, cls) {
    var o = document.createElement('div'); o.className = 'overlay';
    var m = document.createElement('div'); m.className = 'modal ' + (cls || ''); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = html;
    document.body.appendChild(o); document.body.appendChild(m);
    var close = function () { o.remove(); m.remove(); };
    o.addEventListener('click', close);
    return { el: m, close: close };
  }
  function confirmBox(title, text, okLabel) {
    return new Promise(function (resolve) {
      var m = modal('<div class="drawer__head"><h2>' + esc(title) + '</h2></div><div class="drawer__body"><p>' + esc(text) + '</p></div><div class="drawer__foot"><button class="btn btn--ghost" data-no>Cancel</button><button class="btn btn--danger" data-yes>' + esc(okLabel || 'OK') + '</button></div>', 'modal--sm');
      $('[data-no]', m.el).addEventListener('click', function () { m.close(); resolve(false); });
      $('[data-yes]', m.el).addEventListener('click', function () { m.close(); resolve(true); });
      $('[data-yes]', m.el).focus();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var modals = $$('.modal');
    if (modals.length) { var last = modals[modals.length - 1]; last.previousElementSibling && last.previousElementSibling.classList.contains('overlay') && last.previousElementSibling.remove(); last.remove(); return; }
    closeLayer();
  });

  /* ------------------------------------------------------- collections */
  function loadCollection(name) {
    return api('GET', '/c/' + name).then(function (rows) { S.cache[name] = rows; return rows; });
  }
  function refOptions(def) {
    var need = def.fields.filter(function (f) { return f.type === 'ref'; }).map(function (f) { return f.ref; });
    return Promise.all(need.map(function (n) { return S.cache[n] ? S.cache[n] : loadCollection(n); }));
  }
  function refLabel(f, v) {
    var rows = S.cache[f.ref] || [];
    var it = rows.find(function (x) { return x.id === v; });
    return it ? it[S.schema.collections[f.ref].titleField] : '';
  }
  function publicUrl(name, it) {
    if (name === 'programs') return '/programs/' + it.slug;
    if (name === 'posts') return '/news/' + it.slug;
    if (name === 'pages') return '/' + it.slug;
    return null;
  }

  function viewCollection(main, name) {
    var def = S.schema.collections[name];
    if (!def) { main.innerHTML = top('Not found'); return; }
    var q = '';
    Promise.all([loadCollection(name), refOptions(def)]).then(function (res) {
      var rows = res[0];
      var subtitle = function (it) {
        var f = def.fields.find(function (x) { return x.key === def.subtitleField; });
        if (!f) return '';
        var v = it[f.key];
        if (f.type === 'ref') return refLabel(f, v);
        if (f.type === 'number' && name === 'plans') return '₹' + Number(v || 0).toLocaleString('en-IN');
        return v;
      };
      function draw() {
        var list = rows.filter(function (it) { return !q || JSON.stringify(it).toLowerCase().indexOf(q) >= 0; });
        var sortable = !q && !def.sort;
        $('#items').innerHTML = list.length ? list.map(function (it) {
          var img = def.imageField && it[def.imageField];
          var title = it[def.titleField] || '(untitled)';
          var extra = name === 'batches' ? ' · ' + (it.days || []).join(' ') + ' · ' + (it.start || '') : '';
          var url = publicUrl(name, it);
          return '<div class="item" data-id="' + it.id + '"' + (sortable ? ' draggable="true"' : '') + '>' +
            '<span class="handle" title="' + (sortable ? 'Drag to reorder' : '') + '">' + (sortable ? icon('grip') : '') + '</span>' +
            (img ? '<img class="thumb" src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="thumb thumb--empty">' + esc(String(title).slice(0, 1)) + '</span>') +
            '<div class="item__main" data-edit><b>' + esc(title) + '</b><span>' + esc(subtitle(it)) + esc(extra) + '</span></div>' +
            '<span class="tag ' + (it.published === false ? 'tag--draft' : 'tag--enrolled') + '">' + (it.published === false ? 'Hidden' : 'Live') + '</span>' +
            '<span style="display:flex">' + (url ? '<a class="icon-btn" href="' + esc(url) + '" target="_blank" rel="noopener" title="View on site">' + icon('eye') + '</a>' : '') + '<button class="icon-btn" data-edit title="Edit">' + icon('pencil') + '</button></span>' +
            '</div>';
        }).join('') : '<div class="empty card">' + (rows.length ? 'Nothing matches.' : 'Nothing here yet. Add the first ' + esc(def.singular.toLowerCase()) + '.') + '</div>';
      }
      main.innerHTML = top(def.label, rows.length + ' items' + (def.sort ? ' · sorted by date' : ' · drag to reorder how they appear on the site'), '<a class="btn btn--volt" href="#/c/' + name + '/new">' + icon('plus') + 'Add ' + esc(def.singular.toLowerCase()) + '</a>') +
        '<div class="toolbar"><input class="input search" type="search" placeholder="Search ' + esc(def.label.toLowerCase()) + '…" id="cq" aria-label="Search"></div>' +
        '<div class="items card" id="items"></div>';
      draw();
      $('#cq').addEventListener('input', function (e) { q = e.target.value.toLowerCase(); draw(); });
      var box = $('#items');
      box.addEventListener('click', function (e) {
        if (!e.target.closest('[data-edit]')) return;
        var row = e.target.closest('.item');
        location.hash = '#/c/' + name + '/' + row.getAttribute('data-id');
      });
      // Drag and drop reordering.
      var dragging = null;
      box.addEventListener('dragstart', function (e) { dragging = e.target.closest('.item'); if (dragging) { dragging.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; } });
      box.addEventListener('dragover', function (e) {
        if (!dragging) return;
        e.preventDefault();
        var over = e.target.closest('.item');
        $$('.drop-above', box).forEach(function (x) { x.classList.remove('drop-above'); });
        if (over && over !== dragging) over.classList.add('drop-above');
      });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        var over = e.target.closest('.item');
        if (dragging && over && over !== dragging) box.insertBefore(dragging, over);
      });
      box.addEventListener('dragend', function () {
        if (!dragging) return;
        dragging.classList.remove('is-dragging');
        $$('.drop-above', box).forEach(function (x) { x.classList.remove('drop-above'); });
        dragging = null;
        var ids = $$('.item', box).map(function (x) { return x.getAttribute('data-id'); });
        rows.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
        api('POST', '/c/' + name + '/reorder', { ids: ids }).then(function () { toast('Order saved'); }).catch(fail);
      });
    }).catch(fail);
  }

  function fieldHtml(f, v, idp) {
    var id = (idp || 'f') + '-' + f.key;
    var help = f.help ? '<span class="help">' + esc(f.help) + '</span>' : '';
    var req = f.required ? ' <span style="color:var(--track)">*</span>' : '';
    var full = ['textarea', 'markdown', 'lines', 'image', 'multi'].indexOf(f.type) >= 0 ? ' f--full' : '';
    var lab = '<label for="' + id + '">' + esc(f.label) + req + '</label>';
    var c;
    switch (f.type) {
      case 'textarea':
        c = '<textarea id="' + id + '" name="' + f.key + '">' + esc(v) + '</textarea>'; break;
      case 'markdown':
        c = '<textarea class="md" id="' + id + '" name="' + f.key + '">' + esc(v) + '</textarea>';
        help = '<span class="help">Markdown: ## Heading, **bold**, - list, > quote, [link](https://…)</span>'; break;
      case 'lines':
        c = '<textarea id="' + id + '" name="' + f.key + '" rows="5">' + esc((v || []).join('\n')) + '</textarea>'; break;
      case 'number':
        c = '<input type="number" id="' + id + '" name="' + f.key + '" value="' + esc(v == null ? '' : v) + '">'; break;
      case 'bool':
        return '<div class="f"><label class="switch"><input type="checkbox" name="' + f.key + '"' + (v ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + help + '</div>';
      case 'select':
        c = '<select id="' + id + '" name="' + f.key + '">' + f.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; break;
      case 'multi':
        return '<div class="f f--full"><span class="label">' + esc(f.label) + '</span><div class="chips">' + f.options.map(function (o) {
          return '<label><input type="checkbox" name="' + f.key + '" value="' + esc(o) + '"' + ((v || []).indexOf(o) >= 0 ? ' checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div>' + help + '</div>';
      case 'ref':
        var rows = S.cache[f.ref] || [];
        var tf = S.schema.collections[f.ref].titleField;
        c = '<select id="' + id + '" name="' + f.key + '"><option value="">—</option>' + rows.map(function (r) { return '<option value="' + r.id + '"' + (r.id === v ? ' selected' : '') + '>' + esc(r[tf]) + '</option>'; }).join('') + '</select>'; break;
      case 'date': c = '<input type="date" id="' + id + '" name="' + f.key + '" value="' + esc(v) + '">'; break;
      case 'time': c = '<input type="time" id="' + id + '" name="' + f.key + '" value="' + esc(v) + '">'; break;
      case 'color': c = '<input type="color" id="' + id + '" name="' + f.key + '" value="' + esc(v || '#000000') + '">'; break;
      case 'image':
        return '<div class="f f--full"><span class="label">' + esc(f.label) + req + '</span><div class="imgfield" data-img="' + f.key + '">' +
          '<span class="imgfield__preview"' + (v ? ' style="background-image:url(\'' + esc(v) + '\')"' : '') + '></span>' +
          '<input type="hidden" name="' + f.key + '" value="' + esc(v) + '">' +
          '<div class="imgfield__btns"><button type="button" class="btn btn--ghost btn--sm" data-pick>' + (v ? 'Change' : 'Choose image') + '</button>' + (v ? '<button type="button" class="btn btn--ghost btn--sm" data-clear>Remove</button>' : '') + '</div></div>' + help + '</div>';
      default:
        c = '<input type="text" id="' + id + '" name="' + f.key + '" value="' + esc(v) + '"' + (f.type === 'slug' ? ' pattern="[a-z0-9-]*"' : '') + '>';
    }
    return '<div class="f' + full + '">' + lab + c + help + '</div>';
  }

  function readFields(form, fields) {
    var out = {};
    fields.forEach(function (f) {
      if (f.type === 'bool') out[f.key] = form.querySelector('[name="' + f.key + '"]').checked;
      else if (f.type === 'multi') out[f.key] = $$('[name="' + f.key + '"]:checked', form).map(function (x) { return x.value; });
      else if (f.type === 'lines') out[f.key] = form.querySelector('[name="' + f.key + '"]').value.split('\n');
      else { var el = form.querySelector('[name="' + f.key + '"]'); out[f.key] = el ? el.value : ''; }
    });
    return out;
  }

  function wireImageFields(form) {
    form.addEventListener('click', function (e) {
      var box = e.target.closest('[data-img]');
      if (!box) return;
      var input = $('input', box);
      var setVal = function (url) {
        input.value = url;
        $('.imgfield__preview', box).style.backgroundImage = url ? "url('" + url + "')" : '';
        $('.imgfield__btns', box).innerHTML = '<button type="button" class="btn btn--ghost btn--sm" data-pick>' + (url ? 'Change' : 'Choose image') + '</button>' + (url ? '<button type="button" class="btn btn--ghost btn--sm" data-clear>Remove</button>' : '');
        form.dispatchEvent(new Event('input'));
      };
      if (e.target.closest('[data-pick]')) pickMedia(input.value).then(function (url) { if (url) setVal(url); });
      if (e.target.closest('[data-clear]')) setVal('');
    });
  }

  function viewEdit(main, name, id) {
    var def = S.schema.collections[name];
    if (!def) { main.innerHTML = top('Not found'); return; }
    Promise.all([loadCollection(name), refOptions(def)]).then(function (res) {
      var isNew = id === 'new';
      var it = isNew ? {} : res[0].find(function (x) { return x.id === id; });
      if (!it) { main.innerHTML = top('Not found', 'This item may have been deleted.', '<a class="btn btn--ghost" href="#/c/' + name + '">Back</a>'); return; }
      if (isNew) def.fields.forEach(function (f) { if (f.default != null) it[f.key] = f.default; else if (f.type === 'bool') it[f.key] = false; });
      var side = def.fields.filter(function (f) { return f.type === 'bool' || f.type === 'image' || f.type === 'slug'; });
      var mainF = def.fields.filter(function (f) { return side.indexOf(f) < 0; });
      var url = !isNew && publicUrl(name, it);
      main.innerHTML = top(isNew ? 'New ' + def.singular.toLowerCase() : it[def.titleField] || def.singular, '<a href="#/c/' + name + '">← ' + esc(def.label) + '</a>' + (it.updatedAt ? ' · last saved ' + ago(it.updatedAt) : ''), url ? '<a class="btn btn--ghost" href="' + esc(url) + '" target="_blank" rel="noopener">' + icon('eye') + 'View on site</a>' : '') +
        '<form class="form" id="ef" novalidate><p class="err" id="eerr"></p><div class="form-cols">' +
        '<div class="card card__pad"><div class="fieldset">' + mainF.map(function (f) { return fieldHtml(f, it[f.key]); }).join('') + '</div></div>' +
        '<div class="card card__pad"><div class="fieldset" style="grid-template-columns:1fr">' + side.map(function (f) { return fieldHtml(f, it[f.key]); }).join('') + '</div></div>' +
        '</div><div class="sticky-save"><span id="dirty">' + (isNew ? 'Not saved yet' : 'All changes saved') + '</span><span style="display:flex;gap:8px">' +
        (isNew ? '' : '<button type="button" class="btn btn--danger btn--sm" id="edel">' + icon('trash') + 'Delete</button>') +
        '<a class="btn btn--ghost btn--sm" href="#/c/' + name + '">Cancel</a><button class="btn btn--volt btn--sm" type="submit">' + (isNew ? 'Create' : 'Save changes') + '</button></span></div></form>';
      var form = $('#ef');
      wireImageFields(form);
      form.addEventListener('input', function () { $('#dirty').textContent = 'Unsaved changes'; });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        $('#eerr').textContent = '';
        var data = readFields(form, def.fields);
        api(isNew ? 'POST' : 'PUT', '/c/' + name + (isNew ? '' : '/' + id), data).then(function (saved) {
          toast(isNew ? def.singular + ' created' : 'Saved');
          if (isNew) location.hash = '#/c/' + name + '/' + saved.id;
          else { $('#dirty').textContent = 'All changes saved'; }
        }).catch(function (err) { $('#eerr').textContent = err.message; window.scrollTo({ top: 0, behavior: 'smooth' }); });
      });
      if (name === 'notices' && !isNew && can('content')) {
        var bc = document.createElement('button');
        bc.type = 'button'; bc.className = 'btn btn--ghost btn--sm'; bc.textContent = it.broadcastAt ? 'Send again on WhatsApp/email' : 'Send to parents on WhatsApp/email';
        $('.sticky-save span:last-child').prepend(bc);
        bc.addEventListener('click', function () {
          confirmBox('Send this notice to parents?', it.program ? 'Families with an athlete in this program get it.' : 'Every family with an active athlete gets it.', 'Send').then(function (ok) {
            if (ok) api('POST', '/ops/notices/' + id + '/broadcast').then(function (x) { toast('Sent to ' + x.count + ' families'); }).catch(fail);
          });
        });
      }
      var del = $('#edel');
      if (del) del.addEventListener('click', function () {
        confirmBox('Delete "' + (it[def.titleField] || def.singular) + '"?', 'It disappears from the website straight away. This cannot be undone.', 'Delete').then(function (ok) {
          if (!ok) return;
          api('DELETE', '/c/' + name + '/' + id).then(function () { toast('Deleted'); location.hash = '#/c/' + name; }).catch(fail);
        });
      });
    }).catch(fail);
  }

  /* ---------------------------------------------------------- media */
  function uploadFiles(files) {
    var fd = new FormData();
    Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
    return api('POST', '/media', fd, true);
  }
  function dropZone(el, onDone) {
    var input = $('input[type=file]', el);
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('is-over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('is-over'); });
    el.addEventListener('drop', function (e) { e.preventDefault(); el.classList.remove('is-over'); go(e.dataTransfer.files); });
    input.addEventListener('change', function () { go(input.files); });
    function go(files) {
      if (!files.length) return;
      toast('Uploading ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…');
      uploadFiles(files).then(function (added) { toast('Uploaded'); onDone(added); }).catch(fail);
    }
  }
  var DROP = '<label class="drop" data-drop>' + icon('image') + '<b>Drop images here or click to upload</b><span style="font-size:13px">JPG, PNG, WebP, GIF or AVIF · up to 8 MB each. Landscape photos at least 1600 px wide look best.</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden></label>';

  function viewMedia(main) {
    var filter = 'all';
    api('GET', '/media').then(function (items) {
      function draw() {
        var list = items.filter(function (m) { return filter === 'all' || (filter === 'uploads' ? !m.bundled : m.bundled); });
        $('#mgrid').innerHTML = list.map(function (m) {
          return '<div class="media">' + (m.bundled ? '<span class="badge-b">Bundled</span>' : '') + '<img src="' + esc(m.url) + '" alt="' + esc(m.alt) + '" loading="lazy"><div class="media__meta"><b title="' + esc(m.name) + '">' + esc(m.name) + '</b><span class="muted">' + esc(m.bundled ? m.credit : (m.size ? Math.round(m.size / 1024) + ' KB · ' + ago(m.uploadedAt) : '')) + '</span></div>' +
            '<div class="media__actions"><button class="icon-btn" data-copy="' + esc(m.url) + '" title="Copy URL">' + icon('copy') + '</button>' +
            (m.bundled ? '' : '<button class="icon-btn" data-alt="' + m.id + '" title="Edit alt text">' + icon('pencil') + '</button><button class="icon-btn" data-del="' + m.id + '" title="Delete">' + icon('trash') + '</button>') + '</div></div>';
        }).join('') || '<div class="empty">No images yet.</div>';
      }
      main.innerHTML = top('Media library', 'Upload once, use anywhere: programs, coaches, gallery, stories.') + DROP +
        '<div class="tabs" style="margin-top:16px"><button class="is-on" data-f="all">All</button><button data-f="uploads">Uploaded</button><button data-f="bundled">Bundled photos</button></div><div class="media-grid" id="mgrid"></div>';
      draw();
      dropZone($('[data-drop]', main), function (added) { items = added.concat(items); draw(); });
      $('.tabs', main).addEventListener('click', function (e) {
        var b = e.target.closest('[data-f]'); if (!b) return;
        filter = b.getAttribute('data-f');
        $$('.tabs button', main).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        draw();
      });
      $('#mgrid').addEventListener('click', function (e) {
        var c = e.target.closest('[data-copy]');
        if (c) { navigator.clipboard.writeText(c.getAttribute('data-copy')).then(function () { toast('URL copied'); }); }
        var a = e.target.closest('[data-alt]');
        if (a) {
          var m = items.find(function (x) { return x.id === a.getAttribute('data-alt'); });
          var alt = prompt('Describe this image for screen readers:', m.alt || '');
          if (alt != null) api('PATCH', '/media/' + m.id, { alt: alt }).then(function (u) { m.alt = u.alt; toast('Saved'); }).catch(fail);
        }
        var d = e.target.closest('[data-del]');
        if (d) {
          var id = d.getAttribute('data-del');
          var remove = function (force) {
            return api('DELETE', '/media/' + id + (force ? '?force=1' : '')).then(function () { items = items.filter(function (x) { return x.id !== id; }); draw(); toast('Deleted'); });
          };
          confirmBox('Delete this image?', 'The file is removed from the server.', 'Delete').then(function (ok) {
            if (!ok) return;
            remove(false).catch(function (err) {
              if (err.status === 409) confirmBox('This image is in use', 'It is used somewhere on the site. Delete anyway? Those places will show no image.', 'Delete anyway').then(function (y) { if (y) remove(true).catch(fail); });
              else fail(err);
            });
          });
        }
      });
    }).catch(fail);
  }

  function pickMedia(current) {
    return new Promise(function (resolve) {
      var m = modal('<div class="drawer__head"><h2>Choose an image</h2><button class="icon-btn" data-x aria-label="Close">' + icon('close') + '</button></div><div class="drawer__body">' + DROP + '<div class="media-grid" id="pgrid"><p class="muted">Loading…</p></div></div>');
      var done = function (v) { m.close(); resolve(v); };
      $('[data-x]', m.el).addEventListener('click', function () { done(null); });
      var items = [];
      var draw = function () {
        $('#pgrid', m.el).innerHTML = items.map(function (it) {
          return '<button type="button" class="media media--pick' + (it.url === current ? ' is-on' : '') + '" data-url="' + esc(it.url) + '">' + (it.bundled ? '<span class="badge-b">Bundled</span>' : '') + '<img src="' + esc(it.url) + '" alt="" loading="lazy"><span class="media__meta"><b>' + esc(it.name) + '</b></span></button>';
        }).join('');
      };
      api('GET', '/media').then(function (r) { items = r; draw(); }).catch(fail);
      dropZone($('[data-drop]', m.el), function (added) { if (added.length === 1) return done(added[0].url); items = added.concat(items); draw(); });
      $('#pgrid', m.el).addEventListener('click', function (e) {
        var b = e.target.closest('[data-url]');
        if (b) done(b.getAttribute('data-url'));
      });
    });
  }

  /* ------------------------------------------------------ page text */
  function viewTexts(main) {
    var groups = S.schema.texts;
    var gi = 0;
    api('GET', '/texts').then(function (saved) {
      function draw() {
        var g = groups[gi];
        $('#tf').innerHTML = g.fields.map(function (f) {
          var v = saved[f.key] != null ? saved[f.key] : '';
          var id = 't-' + f.key.replace(/\W/g, '-');
          var control = f.type === 'textarea'
            ? '<textarea id="' + id + '" name="' + esc(f.key) + '" rows="3" placeholder="' + esc(f.default) + '">' + esc(v) + '</textarea>'
            : '<input type="text" id="' + id + '" name="' + esc(f.key) + '" value="' + esc(v) + '" placeholder="' + esc(f.default) + '">';
          return '<div class="f text-field' + (v ? ' is-edited' : '') + '"><label for="' + id + '">' + esc(f.label) + '</label>' + control +
            '<span class="help">Default: ' + esc(f.default.length > 140 ? f.default.slice(0, 140) + '…' : f.default) + (v ? ' · <button type="button" class="reset-link" data-reset="' + esc(f.key) + '">Reset to default</button>' : '') + '</span></div>';
        }).join('');
      }
      main.innerHTML = top('Page text', 'Every heading, paragraph and button on the site. Leave a field empty to use the default. In titles, a new line starts a new line on the page and <b>*word*</b> gets the highlight colour.') +
        '<div class="tabs" id="tg">' + groups.map(function (g, i) { return '<button type="button" data-g="' + i + '" class="' + (i === 0 ? 'is-on' : '') + '">' + esc(g.label) + '</button>'; }).join('') + '</div>' +
        '<form id="tform"><div class="card card__pad" id="tf"></div><div class="sticky-save"><span id="tdirty">Changes are saved per tab</span><button class="btn btn--volt btn--sm" type="submit">Save this tab</button></div></form>';
      draw();
      $('#tg').addEventListener('click', function (e) {
        var b = e.target.closest('[data-g]'); if (!b) return;
        gi = Number(b.getAttribute('data-g'));
        $$('#tg button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        draw();
      });
      var form = $('#tform');
      form.addEventListener('input', function () { $('#tdirty').textContent = 'Unsaved changes'; });
      form.addEventListener('click', function (e) {
        var r = e.target.closest('[data-reset]');
        if (!r) return;
        var el = form.querySelector('[name="' + r.getAttribute('data-reset') + '"]');
        el.value = '';
        $('#tdirty').textContent = 'Unsaved changes';
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {};
        groups[gi].fields.forEach(function (f) { data[f.key] = form.querySelector('[name="' + f.key + '"]').value; });
        api('PUT', '/texts', data).then(function (s) { saved = s; draw(); $('#tdirty').textContent = 'Saved'; toast('Page text saved'); }).catch(fail);
      });
    }).catch(fail);
  }

  /* -------------------------------------------------------- sections */
  function viewSections(main) {
    api('GET', '/sections').then(function (s) {
      main.innerHTML = top('Home sections', 'Show or hide parts of the home page. Content stays saved when a section is hidden.', '<a class="btn btn--ghost" href="/" target="_blank" rel="noopener">' + icon('eye') + 'Preview home</a>') +
        '<div class="card card__pad"><div class="grid">' + S.schema.sections.map(function (x, i) {
          return '<label class="switch" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span><span class="mono muted">' + String(i + 1).padStart(2, '0') + '</span> &nbsp;' + esc(x[1]) + '</span><input type="checkbox" data-k="' + x[0] + '"' + (s[x[0]] !== false ? ' checked' : '') + '></label>';
        }).join('') + '</div></div>';
      $('.card', main).addEventListener('change', function (e) {
        var k = e.target.getAttribute('data-k'); if (!k) return;
        var body = {}; body[k] = e.target.checked;
        api('PUT', '/sections', body).then(function () { toast(e.target.checked ? 'Section shown' : 'Section hidden'); }).catch(fail);
      });
    }).catch(fail);
  }

  /* -------------------------------------------------------- settings */
  function viewSettings(main) {
    api('GET', '/settings').then(function (s) {
      var groups = {};
      S.schema.settings.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
      main.innerHTML = top('Settings', 'Academy details, contact, colours, forms and SEO.') +
        '<form class="form" id="sf"><p class="err" id="serr"></p>' + Object.keys(groups).map(function (g) {
          return '<div class="card card__pad"><h2>' + esc(g) + '</h2><div class="fieldset">' + groups[g].map(function (f) { return fieldHtml(f, s[f.key], 's'); }).join('') + '</div></div>';
        }).join('') + '<div class="sticky-save"><span id="sdirty">All changes saved</span><button class="btn btn--volt btn--sm" type="submit">Save settings</button></div></form>';
      var form = $('#sf');
      wireImageFields(form);
      form.addEventListener('input', function () { $('#sdirty').textContent = 'Unsaved changes'; });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        $('#serr').textContent = '';
        api('PUT', '/settings', readFields(form, S.schema.settings)).then(function () { $('#sdirty').textContent = 'All changes saved'; toast('Settings saved'); })
          .catch(function (err) { $('#serr').textContent = err.message; window.scrollTo({ top: 0, behavior: 'smooth' }); });
      });
    }).catch(fail);
  }

  /* ----------------------------------------------------------- users */
  function viewUsers(main) {
    Promise.all([api('GET', '/users'), S.cache.coaches ? S.cache.coaches : loadCollection('coaches')]).then(function (res) {
      var users = res[0];
      var roles = S.schema.roles;
      main.innerHTML = top('Users', 'Admins manage everything. Editors manage content and leads. Front desk sees leads only.', '<button class="btn btn--volt" id="uadd">' + icon('plus') + 'Add user</button>') +
        '<div class="card table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>' + users.map(function (u) {
          return '<tr data-id="' + u.id + '"><td><b>' + esc(u.name) + '</b>' + (u.id === S.user.id ? ' <span class="muted">(you)</span>' : '') + '</td><td>' + esc(u.email) + '</td><td>' + esc(roles[u.role]) + '</td><td>' + (u.disabled ? '<span class="tag tag--closed">Disabled</span>' : u.mustChange ? '<span class="tag tag--contacted">Temp password</span>' : '<span class="tag tag--enrolled">Active</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      var coachSel = function (v) { return '<select name="coachId"><option value="">— Not a coach —</option>' + (S.cache.coaches || []).map(function (c) { return '<option value="' + c.id + '"' + (c.id === v ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>'; };
      var roleSel = function (v) { return '<select name="role">' + Object.keys(roles).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(roles[k]) + '</option>'; }).join('') + '</select>'; };
      $('#uadd').addEventListener('click', function () {
        var d = drawer('Add user', '<form id="uf" class="form"><div class="f"><label>Name</label><input type="text" name="name"></div><div class="f"><label>Email</label><input type="email" name="email"></div><div class="f"><label>Role</label>' + roleSel('editor') + '</div><div class="f"><label>Linked coach</label>' + coachSel('') + '<span class="help">For the Coach role: they see and mark attendance only for this coach’s batches.</span></div><div class="f"><label>Temporary password</label><input type="text" name="password" value="' + tempPass() + '"><span class="help">Share it privately. They will be asked to change it at first sign-in.</span></div><p class="err" id="uerr"></p></form>', '<span></span><button class="btn" data-save>Add user</button>');
        $('[data-save]', d).addEventListener('click', function () {
          var f = $('#uf');
          api('POST', '/users', { name: f.name.value, email: f.email.value, role: f.role.value, password: f.password.value, coachId: f.coachId.value }).then(function () { toast('User added'); closeLayer(); viewUsers(main); }).catch(function (err) { $('#uerr').textContent = err.message; });
        });
      });
      $('tbody', main).addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]'); if (!tr) return;
        var u = users.find(function (x) { return x.id === tr.getAttribute('data-id'); });
        var d = drawer(u.name, '<form id="uf" class="form"><div class="f"><label>Name</label><input type="text" name="name" value="' + esc(u.name) + '"></div><div class="f"><label>Email</label><input type="text" value="' + esc(u.email) + '" disabled></div><div class="f"><label>Role</label>' + roleSel(u.role) + '</div><div class="f"><label>Linked coach</label>' + coachSel(u.coachId) + '</div>' +
          '<label class="switch"><input type="checkbox" name="disabled"' + (u.disabled ? ' checked' : '') + '> Disable sign-in</label>' +
          '<div class="f"><label>Reset password</label><input type="text" name="password" placeholder="Leave empty to keep the current one"></div><p class="err" id="uerr"></p></form>',
          (u.id === S.user.id ? '<span></span>' : '<button class="btn btn--danger btn--sm" data-del>' + icon('trash') + 'Delete</button>') + '<button class="btn" data-save>Save</button>');
        $('[data-save]', d).addEventListener('click', function () {
          var f = $('#uf');
          var body = { name: f.name.value, role: f.role.value, disabled: f.disabled.checked, coachId: f.coachId.value };
          if (f.password.value) body.password = f.password.value;
          api('PUT', '/users/' + u.id, body).then(function () { toast('Saved'); closeLayer(); viewUsers(main); }).catch(function (err) { $('#uerr').textContent = err.message; });
        });
        var del = $('[data-del]', d);
        if (del) del.addEventListener('click', function () {
          confirmBox('Delete ' + u.name + '?', 'They lose access immediately.', 'Delete').then(function (ok) {
            if (ok) api('DELETE', '/users/' + u.id).then(function () { toast('Deleted'); closeLayer(); viewUsers(main); }).catch(fail);
          });
        });
      });
    }).catch(fail);
  }
  function tempPass() {
    var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var b = new Uint32Array(12); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return a[x % a.length]; }).join('') + '7';
  }

  function viewActivity(main) {
    api('GET', '/activity').then(function (rows) {
      main.innerHTML = top('Activity log', 'The last 500 changes and sign-ins.') +
        '<div class="card table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>' + rows.map(function (a) {
          return '<tr style="cursor:default"><td class="muted" style="white-space:nowrap">' + fmtDate(a.at) + '</td><td>' + esc(a.user) + '</td><td>' + esc(a.action) + (a.detail ? ' <span class="muted">· ' + esc(a.detail) + '</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(fail);
  }

  function viewAccount(main) {
    main.innerHTML = top('My password') +
      '<form class="card card__pad form" id="af" style="max-width:480px"><div class="f"><label for="ac">Current password</label><input id="ac" type="password" name="current" autocomplete="current-password"></div><div class="f"><label for="an">New password</label><input id="an" type="password" name="next" autocomplete="new-password"><span class="help">At least 10 characters with a letter and a number.</span></div><p class="err" id="aerr"></p><button class="btn" type="submit">Change password</button></form>';
    $('#af').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '/password', { current: e.target.current.value, next: e.target.next.value }).then(function () { toast('Password changed'); e.target.reset(); }).catch(function (err) { $('#aerr').textContent = err.message; });
    });
  }
})();
