/* Operations screens for the admin panel: students & families, attendance with
   QR check-in, fees & invoices, facility bookings, messages & integrations,
   privacy (DPDP) requests, and the operations strip on the dashboard. */
(function () {
  'use strict';
  var A = window.VegaAdmin;
  var api = A.api, toast = A.toast, fail = A.fail, esc = A.esc, icon = A.icon, top = A.top;
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function d(ymd) {
    if (!ymd) return '';
    var x = new Date(String(ymd).length === 10 ? ymd + 'T00:00:00' : ymd);
    return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function todayIST() { return new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 10); }
  var STATUS_TAG = { active: 'tag--enrolled', paused: 'tag--contacted', left: 'tag--closed', unpaid: 'tag--new', paid: 'tag--enrolled', void: 'tag--closed', pending: 'tag--contacted', confirmed: 'tag--enrolled', cancelled: 'tag--closed', expired: 'tag--closed', new: 'tag--new', 'in progress': 'tag--scheduled', closed: 'tag--closed', sent: 'tag--enrolled', demo: 'tag--scheduled', failed: 'tag--new' };
  function tag(s, label) { return '<span class="tag ' + (STATUS_TAG[s] || '') + '">' + esc(label || s) + '</span>'; }

  /* ------------------------------------------------ dashboard strip */
  A.hooks.dashboard = function (el) {
    if (!el) return;
    api('GET', '/ops/summary').then(function (s) {
      var k = function (label, v, sub, href, hot) { return '<a class="card kpi' + (hot ? ' kpi--hot' : '') + '" href="' + href + '"><span class="mono muted">' + label + '</span><b>' + v + '</b><span class="muted" style="font-size:13px">' + sub + '</span></a>'; };
      el.innerHTML = '<div class="kpis">' +
        k('Active athletes', s.students, s.families + ' families', '#/students') +
        k('Collected this month', money(s.collected), s.autopay + ' on UPI AutoPay', '#/billing') +
        k('Fees due', money(s.dueAmount), s.dueCount + ' invoices · ' + s.overdue + ' overdue', '#/billing', s.overdue > 0) +
        k('Today', s.attendanceToday, 'check-ins · ' + s.bookingsToday + ' bookings', '#/attendance') +
        k('Waiting list', s.waitlist, s.privacyOpen + ' open privacy requests', '#/s/admissions', s.privacyOpen > 0) +
        '</div>' +
        ((!s.channels.whatsapp || !s.channels.email || s.payments === 'demo')
          ? '<div class="card card__pad ops-warn"><b>Demo mode for:</b> ' + [s.payments === 'demo' ? 'payments (Razorpay keys not set)' : '', !s.channels.whatsapp ? 'WhatsApp' : '', !s.channels.email ? 'email' : ''].filter(Boolean).join(', ') + '. Messages are logged in <a href="#/messages">Messages</a> instead of being sent. See README → Integrations.</div>'
          : '');
    }).catch(function () {});
  };

  /* --------------------------------------------- students & families */
  A.register('students', function (main, rest) {
    var q = '', status = 'active', batch = '';
    Promise.all([api('GET', '/ops/students'), api('GET', '/c/batches').catch(function () { return []; }), api('GET', '/c/programs').catch(function () { return []; })]).then(function (res) {
      var rows = res[0], batches = res[1], progs = res[2];
      var progName = function (id) { return (progs.find(function (p) { return p.id === id; }) || {}).name || ''; };
      function draw() {
        var list = rows.filter(function (r) {
          if (status && r.status !== status) return false;
          if (batch && (r.batchIds || []).indexOf(batch) < 0) return false;
          return !q || (r.name + ' ' + r.code + ' ' + r.family.guardian + ' ' + r.family.phone).toLowerCase().indexOf(q) >= 0;
        });
        $('#stable').innerHTML = list.length ? '<table class="table"><thead><tr><th>Athlete</th><th>Batches</th><th>Parent</th><th>Attendance</th><th>Fees due</th><th>Portal</th></tr></thead><tbody>' + list.map(function (r) {
          return '<tr data-id="' + r.id + '"><td><b>' + esc(r.name) + '</b><br><span class="mono muted">' + esc(r.code) + '</span> ' + (r.status !== 'active' ? tag(r.status) : '') + (r.photoConsent ? '' : ' <span class="tag tag--draft" title="No photo consent">No photos</span>') + '</td>' +
            '<td>' + (r.batches.map(function (b) { return esc(b.program + ' · ' + b.name); }).join('<br>') || '<span class="muted">—</span>') + '</td>' +
            '<td>' + esc(r.family.guardian) + '<br><span class="muted">' + esc(r.family.phone) + '</span></td>' +
            '<td>' + (r.attendance == null ? '—' : '<b' + (r.attendance < 75 ? ' style="color:var(--track)"' : '') + '>' + r.attendance + '%</b>') + '</td>' +
            '<td>' + (r.due ? '<b style="color:var(--track)">' + money(r.due) + '</b>' : '<span class="muted">—</span>') + (r.family.autopay === 'active' ? '<br><span class="tag tag--enrolled">AutoPay</span>' : '') + '</td>' +
            '<td>' + (r.family.portal ? tag('active', 'Active') : '<span class="tag tag--draft">Not set up</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No athletes match.</div>';
      }
      main.innerHTML = top('Students & families', 'Everyone enrolled. Seats in batches update automatically from this list.', '<button class="btn btn--volt" id="sadd">' + icon('plus') + 'Add student</button>') +
        '<div class="toolbar"><input class="input search" type="search" placeholder="Search name, code, parent, phone…" id="sq" aria-label="Search">' +
        '<select class="input" id="sst" style="width:auto" aria-label="Status"><option value="active">Active</option><option value="paused">Paused</option><option value="left">Left</option><option value="">All</option></select>' +
        '<select class="input" id="sbt" style="width:auto;max-width:280px" aria-label="Batch"><option value="">All batches</option>' + batches.map(function (b) { return '<option value="' + b.id + '">' + esc(progName(b.program) + ' · ' + b.name) + '</option>'; }).join('') + '</select>' +
        '<span class="muted" style="margin-left:auto;font-size:13px">' + rows.filter(function (r) { return r.status === 'active'; }).length + ' active</span></div>' +
        '<div class="card table-wrap" id="stable"></div>';
      draw();
      $('#sq').addEventListener('input', function (e) { q = e.target.value.toLowerCase(); draw(); });
      $('#sst').addEventListener('change', function (e) { status = e.target.value; draw(); });
      $('#sbt').addEventListener('change', function (e) { batch = e.target.value; draw(); });
      $('#stable').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) openStudent(tr.getAttribute('data-id'), batches, progName, function () { A.closeLayer(); route(); });
      });
      $('#sadd').addEventListener('click', function () { addStudent(batches, progName); });
      if (rest[0]) openStudent(rest[0], batches, progName, function () { A.closeLayer(); route(); });
    }).catch(fail);
    function route() { location.hash = '#/students'; window.dispatchEvent(new HashChangeEvent('hashchange')); }
  });

  function batchChecks(batches, progName, selected) {
    return '<div class="chips">' + batches.map(function (b) {
      return '<label><input type="checkbox" name="batchIds" value="' + b.id + '"' + ((selected || []).indexOf(b.id) >= 0 ? ' checked' : '') + '>' + esc(progName(b.program) + ' · ' + b.name) + ' <span class="muted" style="margin-left:4px">(' + (b.seatsLeft != null ? b.seatsLeft : '?') + ' left)</span></label>';
    }).join('') + '</div>';
  }

  function addStudent(batches, progName) {
    var dr = A.drawer('Add student', '<form class="form" id="naf">' +
      '<div class="fieldset"><div class="f f--full"><label>Athlete name</label><input type="text" name="name"></div>' +
      '<div class="f"><label>Date of birth</label><input type="date" name="dob"></div><div class="f"><label>Gender</label><select name="gender"><option></option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div>' +
      '<div class="f"><label>Parent / guardian</label><input type="text" name="guardian"></div><div class="f"><label>Parent phone</label><input type="text" name="phone"><span class="help">If this phone is already registered, the athlete joins that family (sibling discount applies).</span></div>' +
      '<div class="f f--full"><label>Parent email</label><input type="email" name="email"></div>' +
      '<div class="f f--full"><span class="label">Batches</span>' + batchChecks(batches, progName, []) + '</div>' +
      '<div class="f f--full"><label class="switch"><input type="checkbox" name="photoConsent"> Parent consented to photos on website/social</label></div>' +
      '<div class="f f--full"><label class="switch"><input type="checkbox" name="invite" checked> Send parent-portal invite on WhatsApp/email</label></div>' +
      '<div class="f f--full"><label class="switch"><input type="checkbox" name="overbook"> Allow over capacity</label></div></div><p class="err" id="naerr"></p></form>',
      '<span></span><button class="btn" data-save>Add student</button>');
    $('[data-save]', dr).addEventListener('click', function () {
      var f = $('#naf');
      var body = { name: f.name.value, dob: f.dob.value, gender: f.gender.value, guardian: f.guardian.value, phone: f.phone.value, email: f.email.value, photoConsent: f.photoConsent.checked, invite: f.invite.checked, overbook: f.overbook.checked, batchIds: $$('[name=batchIds]:checked', f).map(function (x) { return x.value; }) };
      api('POST', '/ops/students', body).then(function () { toast('Student added'); A.closeLayer(); location.hash = '#/students'; window.dispatchEvent(new HashChangeEvent('hashchange')); }).catch(function (e) { $('#naerr').textContent = e.message; });
    });
  }

  var METRICS = [['sprint20', '20 m sprint', 's'], ['broadJump', 'Broad jump', 'cm'], ['plank', 'Plank', 's'], ['beep', 'Beep test', 'level']];

  function openStudent(id, batches, progName, refresh) {
    api('GET', '/ops/students/' + id).then(function (x) {
      var s = x.student, f = x.family || {};
      var att = x.attendance;
      var pct = att.length ? Math.round(att.filter(function (a) { return a.status !== 'absent'; }).length / att.length * 100) : null;
      var tabs = ['Profile', 'Attendance', 'Fitness', 'Feedback', 'Fees'];
      var body =
        '<div class="tabs" id="stabs">' + tabs.map(function (t, i) { return '<button type="button" data-t="' + i + '" class="' + (i ? '' : 'is-on') + '">' + t + '</button>'; }).join('') + '</div>' +
        // Profile
        '<div data-p="0"><form class="form" id="spf"><div class="fieldset">' +
        '<div class="f f--full"><label>Name</label><input type="text" name="name" value="' + esc(s.name) + '"></div>' +
        '<div class="f"><label>Date of birth</label><input type="date" name="dob" value="' + esc(s.dob) + '"></div>' +
        '<div class="f"><label>Status</label><select name="status">' + ['active', 'paused', 'left'].map(function (o) { return '<option' + (o === s.status ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div class="f f--full"><span class="label">Batches</span>' + batchChecks(batches, progName, s.batchIds) + '</div>' +
        '<div class="f f--full"><label>Medical notes</label><textarea name="medical">' + esc(s.medical) + '</textarea></div>' +
        '<div class="f f--full"><label>Internal notes</label><textarea name="notes">' + esc(s.notes) + '</textarea></div>' +
        '<div class="f f--full"><label class="switch"><input type="checkbox" name="photoConsent"' + (s.photoConsent ? ' checked' : '') + '> Photo/video consent (website & social)</label></div>' +
        '</div><p class="err" id="sperr"></p><button class="btn btn--sm" type="submit">Save athlete</button></form>' +
        '<div class="card card__pad" style="margin-top:16px"><h2>Family</h2><form class="form" id="sff"><div class="fieldset">' +
        '<div class="f"><label>Guardian</label><input type="text" name="guardian" value="' + esc(f.guardian) + '"></div><div class="f"><label>Phone</label><input type="text" name="phone" value="' + esc(f.phone) + '"></div>' +
        '<div class="f f--full"><label>Email</label><input type="email" name="email" value="' + esc(f.email) + '"></div></div>' +
        '<p class="muted" style="font-size:13px">Portal: ' + (s.family.portal ? 'active' : 'not set up') + (f.lastLogin ? ' (last sign-in ' + d(f.lastLogin) + ')' : '') + ' · AutoPay: ' + esc(s.family.autopay) + (x.siblings.length ? ' · Siblings: ' + x.siblings.map(function (b) { return esc(b.name); }).join(', ') : '') + '</p>' +
        '<p class="muted" style="font-size:13px">Consents: ' + ((f.consents || []).map(function (c) { return esc(c.type + (c.granted ? ' ✓' : ' ✗') + ' (' + c.method + ', ' + d(c.at) + ')'); }).join(' · ') || 'none recorded') + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--ghost btn--sm" type="submit">Save family</button><button class="btn btn--ghost btn--sm" type="button" id="finv">' + (s.family.portal ? 'Send password reset link' : 'Send portal invite') + '</button></div></form></div></div>' +
        // Attendance
        '<div data-p="1" hidden><p><b>' + (pct == null ? 'No records' : pct + '% attendance') + '</b> <span class="muted">· last ' + att.length + ' records</span></p><div class="att-dots">' +
        att.map(function (a) { return '<span class="att-dot is-' + a.status + '" title="' + esc(a.date + ' · ' + a.status + ' · ' + (a.method || '')) + '"></span>'; }).join('') + '</div>' +
        '<table class="table"><tbody>' + att.slice(0, 20).map(function (a) { return '<tr style="cursor:default"><td>' + d(a.date) + '</td><td>' + esc(a.status) + '</td><td class="muted">' + esc(a.method || '') + ' · ' + esc(a.by || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        // Fitness
        '<div data-p="2" hidden><table class="table"><thead><tr><th>Date</th>' + METRICS.map(function (m) { return '<th>' + m[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
        x.fitness.map(function (t) { return '<tr style="cursor:default"><td>' + d(t.date) + '</td>' + METRICS.map(function (m) { return '<td>' + (t[m[0]] != null ? esc(t[m[0]]) + ' ' + m[2] : '—') + '</td>'; }).join('') + '<td><button class="icon-btn" data-delfit="' + t.id + '" title="Delete">' + icon('trash') + '</button></td></tr>'; }).join('') +
        '</tbody></table><form class="form card card__pad" id="fitf" style="margin-top:12px"><h2>Add test</h2><div class="fieldset"><div class="f"><label>Date</label><input type="date" name="date" value="' + todayIST() + '"></div>' +
        METRICS.map(function (m) { return '<div class="f"><label>' + m[1] + ' (' + m[2] + ')</label><input type="number" step="0.01" name="' + m[0] + '"></div>'; }).join('') +
        '<div class="f f--full"><label>Note for parents</label><input type="text" name="notes"></div></div><button class="btn btn--sm" type="submit">Save test</button></form></div>' +
        // Feedback
        '<div data-p="3" hidden><form class="form card card__pad" id="fbf"><div class="f"><label>Feedback (parents see this in the portal)</label><textarea name="text" placeholder="What went well, what to work on next, anything parents can help with…"></textarea></div>' +
        '<div class="f"><label>Effort today</label><select name="effort"><option value="0">—</option><option value="5">●●●●● Outstanding</option><option value="4">●●●● Great</option><option value="3">●●● Good</option><option value="2">●● Below usual</option><option value="1">● Needs a chat</option></select></div><button class="btn btn--sm" type="submit">Post feedback</button></form>' +
        '<div class="feed" style="margin-top:12px">' + x.feedback.map(function (fb) { return '<div style="display:block"><span class="mono muted">' + d(fb.date) + ' · ' + esc(fb.by) + '</span><p>' + esc(fb.text) + '</p><button class="reset-link" data-delfb="' + fb.id + '">Delete</button></div>'; }).join('') + '</div></div>' +
        // Fees
        '<div data-p="4" hidden><table class="table"><tbody>' + x.invoices.map(function (i) { return '<tr style="cursor:default"><td><a href="/invoice/' + i.id + '?t=' + i.token + '" target="_blank" rel="noopener">' + esc(i.number) + '</a></td><td>' + esc(i.period || i.lines[0].label) + '</td><td>' + money(i.total) + '</td><td>' + tag(i.status) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var dr = A.drawer(s.name + ' · ' + s.code, body);
      $('#stabs', dr).addEventListener('click', function (e) {
        var b = e.target.closest('[data-t]'); if (!b) return;
        $$('#stabs button', dr).forEach(function (y) { y.classList.toggle('is-on', y === b); });
        $$('[data-p]', dr).forEach(function (p) { p.hidden = p.getAttribute('data-p') !== b.getAttribute('data-t'); });
      });
      $('#spf', dr).addEventListener('submit', function (e) {
        e.preventDefault();
        var fm = e.target;
        var payload = { name: fm.name.value, dob: fm.dob.value, status: fm.status.value, medical: fm.medical.value, notes: fm.notes.value, photoConsent: fm.photoConsent.checked, batchIds: $$('[name=batchIds]:checked', fm).map(function (y) { return y.value; }) };
        api('PUT', '/ops/students/' + id, payload).then(function () { toast('Saved'); refresh(); }).catch(function (err) {
          if (err.data && err.data.full) A.confirmBox('Batch is full', err.message + ' Add anyway (over capacity)?', 'Add anyway').then(function (ok) { if (ok) api('PUT', '/ops/students/' + id, Object.assign(payload, { overbook: true })).then(function () { toast('Saved'); refresh(); }).catch(fail); });
          else $('#sperr').textContent = err.message;
        });
      });
      $('#sff', dr).addEventListener('submit', function (e) {
        e.preventDefault();
        api('PUT', '/ops/families/' + f.id, { guardian: e.target.guardian.value, phone: e.target.phone.value, email: e.target.email.value }).then(function () { toast('Family saved'); }).catch(fail);
      });
      $('#finv', dr).addEventListener('click', function () {
        api('POST', '/ops/families/' + f.id + '/invite').then(function (r) { toast('Link sent'); if (r.link) prompt('Link sent on WhatsApp/email. You can also copy it:', r.link); }).catch(fail);
      });
      $('#fitf', dr).addEventListener('submit', function (e) {
        e.preventDefault();
        var fm = e.target, b = { studentId: id, date: fm.date.value, notes: fm.notes.value };
        METRICS.forEach(function (m) { b[m[0]] = fm[m[0]].value; });
        api('POST', '/ops/fitness', b).then(function () { toast('Test saved'); openStudent(id, batches, progName, refresh); }).catch(fail);
      });
      $('#fbf', dr).addEventListener('submit', function (e) {
        e.preventDefault();
        api('POST', '/ops/feedback', { studentId: id, text: e.target.text.value, effort: e.target.effort.value }).then(function () { toast('Feedback posted'); openStudent(id, batches, progName, refresh); }).catch(fail);
      });
      dr.addEventListener('click', function (e) {
        var a = e.target.closest('[data-delfit]'), b = e.target.closest('[data-delfb]');
        if (a) api('DELETE', '/ops/fitness/' + a.getAttribute('data-delfit')).then(function () { openStudent(id, batches, progName, refresh); });
        if (b) api('DELETE', '/ops/feedback/' + b.getAttribute('data-delfb')).then(function () { openStudent(id, batches, progName, refresh); });
      });
    }).catch(fail);
  }

  /* ------------------------------------------------------ attendance */
  A.register('attendance', function (main) {
    var state = { batch: localStorage.getItem('vega-att-batch') || '', date: todayIST() };
    function load() {
      api('GET', '/ops/attendance?batch=' + encodeURIComponent(state.batch) + '&date=' + state.date).then(function (r) {
        if (!state.batch && r.batches.length) {
          var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(state.date + 'T00:00:00').getDay()];
          var byCount = function (a, b) { return b.count - a.count; };
          var todays = r.batches.filter(function (b) { return (b.days || []).indexOf(wd) >= 0 && b.count; }).sort(byCount);
          state.batch = (todays[0] || r.batches.slice().sort(byCount)[0]).id;
          return load();
        }
        render(r);
      }).catch(fail);
    }
    function render(r) {
      var counts = { present: 0, late: 0, absent: 0, '': 0 };
      r.students.forEach(function (s) { counts[s.status || '']++; });
      main.innerHTML = top('Attendance', 'Tap to mark, or scan the QR code on an athlete’s portal card.', '<button class="btn btn--volt" id="qrbtn">' + icon('eye') + 'Scan QR</button>') +
        '<div class="toolbar"><select class="input" id="ab" style="width:auto;max-width:320px" aria-label="Batch">' + r.batches.map(function (b) { return '<option value="' + b.id + '"' + (b.id === state.batch ? ' selected' : '') + '>' + esc(b.program + ' · ' + b.name + ' (' + (b.days || []).join(' ') + ') · ' + b.count + ' athletes') + '</option>'; }).join('') + '</select>' +
        '<input class="input" type="date" id="ad" value="' + state.date + '" max="' + todayIST() + '" style="width:auto" aria-label="Date">' +
        '<form id="codef" style="display:flex;gap:6px"><input class="input" id="codein" placeholder="Type code, e.g. V7K2QX" style="width:170px" aria-label="Athlete code"><button class="btn btn--ghost btn--sm" type="submit">Check in</button></form></div>' +
        '<div class="att-summary"><span>' + r.students.length + ' athletes</span><span class="tag tag--enrolled">' + counts.present + ' present</span><span class="tag tag--scheduled">' + counts.late + ' late</span><span class="tag tag--new">' + counts.absent + ' absent</span><span class="tag tag--draft">' + counts[''] + ' not marked</span>' +
        '<button class="btn btn--ghost btn--sm" id="allp" style="margin-left:auto">Mark rest present</button></div>' +
        '<div class="att-list">' + (r.students.length ? r.students.map(function (s) {
          return '<div class="att-row" data-id="' + s.id + '"><div><b>' + esc(s.name) + '</b><span class="mono muted"> ' + esc(s.code) + (s.pct != null ? ' · ' + s.pct + '%' : '') + (s.method === 'qr' ? ' · QR' : '') + '</span>' + (s.medical ? '<br><span class="att-med">⚕ ' + esc(s.medical) + '</span>' : '') + '</div>' +
            '<div class="att-btns" role="group" aria-label="Status for ' + esc(s.name) + '">' + ['present', 'late', 'absent'].map(function (st) { return '<button type="button" data-st="' + st + '" class="att-b att-b--' + st + (s.status === st ? ' is-on' : '') + '">' + st[0].toUpperCase() + st.slice(1) + '</button>'; }).join('') + '</div></div>';
        }).join('') : '<div class="empty card">No athletes in this batch yet.</div>') + '</div>';
        $('#ab').addEventListener('change', function (e) { state.batch = e.target.value; try { localStorage.setItem('vega-att-batch', state.batch); } catch (x) {} load(); });
        $('#ad').addEventListener('change', function (e) { state.date = e.target.value; load(); });
        $('.att-list', main).addEventListener('click', function (e) {
          var b = e.target.closest('[data-st]'); if (!b) return;
          var row = b.closest('[data-id]');
          var st = b.classList.contains('is-on') ? '' : b.getAttribute('data-st');
          api('POST', '/ops/attendance', { batchId: state.batch, date: state.date, marks: [{ studentId: row.getAttribute('data-id'), status: st }] }).then(load).catch(fail);
        });
        $('#allp').addEventListener('click', function () {
          var marks = r.students.filter(function (s) { return !s.status; }).map(function (s) { return { studentId: s.id, status: 'present' }; });
          if (!marks.length) return toast('Everyone is marked');
          api('POST', '/ops/attendance', { batchId: state.batch, date: state.date, marks: marks }).then(function () { toast(marks.length + ' marked present'); load(); }).catch(fail);
        });
        $('#codef').addEventListener('submit', function (e) { e.preventDefault(); checkIn($('#codein').value); $('#codein').value = ''; });
        $('#qrbtn').addEventListener('click', scanner);
    }
    function checkIn(code) {
      return api('POST', '/ops/attendance/scan', { code: code, batchId: state.batch }).then(function (r) {
        toast((r.already ? 'Already checked in: ' : '✓ ') + r.student.name + ' · ' + r.batch + ' · ' + r.status);
        if (r.student.medical) toast('⚕ ' + r.student.medical);
        if (state.date === todayIST()) load();
        return r;
      }).catch(function (e) { fail(e); throw e; });
    }
    // Camera scanning uses the browser's BarcodeDetector (Chrome/Edge/Android, Safari 17+).
    function scanner() {
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices) {
        toast('This browser cannot scan. Type the code instead, or use Chrome on Android.', 'err');
        $('#codein').focus();
        return;
      }
      var m = A.modal('<div class="drawer__head"><h2>Scan check-in QR</h2><button class="icon-btn" data-x aria-label="Close">' + icon('close') + '</button></div><div class="drawer__body"><video class="qr-video" playsinline muted></video><p class="muted" id="qrmsg">Point the camera at the QR code on the athlete’s card.</p></div>', 'modal--sm');
      var video = $('video', m.el), stream = null, stop = false, last = '', lastAt = 0;
      var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      function close() { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); m.close(); }
      $('[data-x]', m.el).addEventListener('click', close);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        stream = s; video.srcObject = s; video.play();
        (function loop() {
          if (stop) return;
          detector.detect(video).then(function (codes) {
            var c = codes[0] && codes[0].rawValue;
            if (c && (c !== last || Date.now() - lastAt > 4000)) {
              last = c; lastAt = Date.now();
              checkIn(c).then(function (r) { $('#qrmsg', m.el).textContent = '✓ ' + r.student.name + ' (' + r.status + '). Scan the next card.'; }).catch(function (e) { $('#qrmsg', m.el).textContent = e.message; });
            }
          }).catch(function () {}).then(function () { setTimeout(loop, 350); });
        })();
      }).catch(function () { $('#qrmsg', m.el).textContent = 'Camera permission was denied.'; });
    }
    load();
  });

  /* ---------------------------------------------------- fees & invoices */
  A.register('billing', function (main) {
    var filter = 'unpaid', q = '';
    Promise.all([api('GET', '/ops/invoices'), api('GET', '/ops/students').catch(function () { return []; })]).then(function (res) {
      var rows = res[0], students = res[1];
      var families = {};
      students.forEach(function (s) { families[s.family.id] = s.family; });
      function draw() {
        var list = rows.filter(function (i) { return (filter === 'all' || i.status === filter || (filter === 'overdue' && i.status === 'unpaid' && i.dueDate < todayIST())) && (!q || (i.number + ' ' + (i.billTo.name || '') + ' ' + (i.billTo.phone || '')).toLowerCase().indexOf(q) >= 0); });
        var total = list.reduce(function (n, i) { return n + i.total; }, 0);
        $('#itable').innerHTML = list.length ? '<table class="table"><thead><tr><th>Invoice</th><th>Billed to</th><th>For</th><th>Amount</th><th>Status</th><th>Due / paid</th></tr></thead><tbody>' + list.map(function (i) {
          var over = i.status === 'unpaid' && i.dueDate < todayIST();
          return '<tr data-id="' + i.id + '"><td><b class="mono">' + esc(i.number) + '</b><br><span class="muted">' + esc(i.kind) + '</span></td><td>' + esc(i.billTo.name) + '<br><span class="muted">' + esc(i.billTo.phone) + '</span></td><td>' + esc(i.period || (i.lines[0] || {}).label || '') + (i.discount ? '<br><span class="muted">' + esc(i.discount.label) + '</span>' : '') + '</td><td><b>' + money(i.total) + '</b></td><td>' + tag(i.status) + (over ? ' <span class="tag tag--new">Overdue</span>' : '') + '</td><td class="muted">' + (i.status === 'paid' ? d(i.paidAt) + '<br>' + esc((i.payment || {}).method || '') : d(i.dueDate)) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No invoices here.</div>';
        $('#itotal').textContent = list.length + ' invoices · ' + money(total);
      }
      var now = todayIST().slice(0, 7);
      main.innerHTML = top('Fees & invoices', 'GST invoices are created automatically each month (Settings → Fees & GST). Parents pay online, by UPI AutoPay, or you record cash here.',
        '<button class="btn btn--ghost" id="newinv">' + icon('plus') + 'One-off invoice</button><button class="btn btn--volt" id="gen">Generate ' + new Date(now + '-01').toLocaleDateString('en-IN', { month: 'long' }) + ' invoices</button>') +
        '<div class="tabs" id="itabs">' + [['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Cancelled'], ['all', 'All']].map(function (t) { return '<button type="button" data-f="' + t[0] + '" class="' + (t[0] === filter ? 'is-on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="toolbar"><input class="input search" type="search" id="iq" placeholder="Search number, name, phone…" aria-label="Search"><span class="muted" id="itotal" style="margin-left:auto;font-size:13px"></span></div><div class="card table-wrap" id="itable"></div>';
      draw();
      $('#itabs').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; filter = b.getAttribute('data-f'); $$('#itabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); draw(); });
      $('#iq').addEventListener('input', function (e) { q = e.target.value.toLowerCase(); draw(); });
      $('#gen').addEventListener('click', function () {
        A.confirmBox('Generate invoices for ' + now + '?', 'Every family with active athletes who has not been billed for this month gets an invoice and a WhatsApp/email with the payment link. Families on AutoPay are charged automatically.', 'Generate').then(function (ok) {
          if (ok) api('POST', '/ops/invoices/generate', { period: now }).then(function (r) { toast(r.count + ' invoices created'); location.reload(); }).catch(fail);
        });
      });
      $('#newinv').addEventListener('click', function () {
        var fams = Object.keys(families).map(function (k) { return families[k]; });
        var dr = A.drawer('One-off invoice', '<form class="form" id="oif"><div class="f"><label>Family</label><select name="familyId">' + fams.map(function (f) { return '<option value="' + f.id + '">' + esc(f.guardian + ' · ' + f.phone) + '</option>'; }).join('') + '</select></div><div class="f"><label>Description</label><input type="text" name="label" placeholder="e.g. Summer camp, 2 weeks / Registration fee / Tournament entry"></div><div class="f"><label>Amount (₹)</label><input type="number" name="amount"></div><div class="f"><label>Due date</label><input type="date" name="dueDate"></div><label class="switch"><input type="checkbox" name="notify" checked> Send payment link on WhatsApp/email</label></form>', '<span></span><button class="btn" data-save>Create invoice</button>');
        $('[data-save]', dr).addEventListener('click', function () {
          var f = $('#oif');
          api('POST', '/ops/invoices', { familyId: f.familyId.value, label: f.label.value, amount: f.amount.value, dueDate: f.dueDate.value, notify: f.notify.checked }).then(function () { toast('Invoice created'); location.reload(); }).catch(fail);
        });
      });
      $('#itable').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]'); if (!tr) return;
        var i = rows.find(function (x) { return x.id === tr.getAttribute('data-id'); });
        var lines = i.lines.map(function (l) { return '<tr style="cursor:default"><td>' + esc(l.label) + '</td><td style="text-align:right">' + money(l.amount) + '</td></tr>'; }).join('') + (i.discount ? '<tr style="cursor:default"><td>' + esc(i.discount.label) + '</td><td style="text-align:right">− ' + money(i.discount.amount) + '</td></tr>' : '') + (i.gst && i.gst.rate ? '<tr style="cursor:default"><td class="muted">Incl. GST ' + i.gst.rate + '% (CGST ' + money(i.gst.cgst) + ' + SGST ' + money(i.gst.sgst) + ')</td><td></td></tr>' : '') + '<tr style="cursor:default"><td><b>Total</b></td><td style="text-align:right"><b>' + money(i.total) + '</b></td></tr>';
        var foot = i.status === 'unpaid'
          ? '<button class="btn btn--danger btn--sm" data-void>Cancel invoice</button><span style="display:flex;gap:6px"><button class="btn btn--ghost btn--sm" data-remind>Send reminder</button><button class="btn btn--sm" data-paid>Record payment</button></span>'
          : '<span></span><a class="btn btn--ghost btn--sm" href="/invoice/' + i.id + '?t=' + i.token + '" target="_blank" rel="noopener">Open receipt</a>';
        var dr = A.drawer(i.number, '<p>' + tag(i.status) + ' · ' + esc(i.billTo.name) + ' · ' + esc(i.billTo.phone) + '</p><table class="table"><tbody>' + lines + '</tbody></table>' +
          '<p class="muted" style="font-size:13px">Issued ' + d(i.date) + ' · due ' + d(i.dueDate) + (i.reminders && i.reminders.length ? ' · reminders: ' + esc(i.reminders.join(', ')) : '') + (i.payment ? ' · paid via ' + esc(i.payment.method || i.payment.provider) + (i.payment.id ? ' (' + esc(i.payment.id) + ')' : '') : '') + '</p>' +
          '<p><a href="/invoice/' + i.id + '?t=' + i.token + '" target="_blank" rel="noopener">Open invoice page</a> · <button class="reset-link" data-copy="' + esc(location.origin + '/invoice/' + i.id + '?t=' + i.token) + '">Copy payment link</button></p>' +
          (i.status === 'unpaid' ? '<form class="form card card__pad" id="pmf"><h2>Record an offline payment</h2><div class="fieldset"><div class="f"><label>Method</label><select name="method"><option>Cash</option><option>UPI (offline)</option><option>Bank transfer</option><option>Cheque</option><option>Card (POS)</option></select></div><div class="f"><label>Reference</label><input type="text" name="ref" placeholder="UTR / cheque no."></div></div></form>' : ''), foot);
        dr.addEventListener('click', function (e2) {
          var c = e2.target.closest('[data-copy]'); if (c) navigator.clipboard.writeText(c.getAttribute('data-copy')).then(function () { toast('Link copied'); });
          if (e2.target.closest('[data-paid]')) { var f = $('#pmf', dr); api('POST', '/ops/invoices/' + i.id + '/paid', { method: f.method.value, ref: f.ref.value }).then(function () { toast('Payment recorded. Receipt sent.'); location.reload(); }).catch(fail); }
          if (e2.target.closest('[data-remind]')) api('POST', '/ops/invoices/' + i.id + '/remind').then(function () { toast('Reminder sent'); }).catch(fail);
          if (e2.target.closest('[data-void]')) A.confirmBox('Cancel ' + i.number + '?', 'The invoice stays in the records as cancelled.', 'Cancel invoice').then(function (ok) { if (ok) api('POST', '/ops/invoices/' + i.id + '/void').then(function () { toast('Cancelled'); location.reload(); }).catch(fail); });
        });
      });
    }).catch(fail);
  });

  /* ------------------------------------------------ facility bookings */
  A.register('bookings', function (main) {
    var date = todayIST();
    function load() {
      api('GET', '/ops/bookings').then(function (r) {
        var day = r.bookings.filter(function (b) { return b.date === date && b.status !== 'expired'; }).sort(function (a, b) { return a.start.localeCompare(b.start); });
        var upcoming = r.bookings.filter(function (b) { return b.date >= todayIST() && b.status === 'confirmed'; });
        var revenue = r.bookings.filter(function (b) { return b.status === 'confirmed' && b.date.slice(0, 7) === todayIST().slice(0, 7); }).reduce(function (n, b) { return n + b.amount; }, 0);
        main.innerHTML = top('Facility bookings', upcoming.length + ' upcoming confirmed · ' + money(revenue) + ' booked this month', '<a class="btn btn--ghost" href="/book" target="_blank" rel="noopener">' + icon('ext') + 'Booking page</a><button class="btn btn--volt" id="blk">Block a slot</button>') +
          '<div class="toolbar"><input class="input" type="date" id="bd" value="' + date + '" style="width:auto" aria-label="Date"></div>' +
          '<div class="card table-wrap">' + (day.length ? '<table class="table"><thead><tr><th>Time</th><th>Facility</th><th>Booked by</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + day.map(function (b) {
            return '<tr style="cursor:default"><td><b>' + esc(b.start + '–' + b.end) + '</b></td><td>' + esc(b.resource) + '</td><td>' + esc(b.name) + '<br><span class="muted">' + esc(b.phone) + ' · ' + esc(b.ref) + '</span></td><td>' + money(b.amount) + '</td><td>' + tag(b.status) + (b.refund ? '<br><span class="muted">' + esc(b.refund) + '</span>' : '') + '</td><td>' + (b.status === 'confirmed' || b.status === 'pending' ? '<button class="btn btn--danger btn--sm" data-cancel="' + b.id + '">Cancel</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<div class="empty">No bookings on this day.</div>') + '</div>';
        $('#bd').addEventListener('change', function (e) { date = e.target.value; load(); });
        main.querySelectorAll('[data-cancel]').forEach(function (b) {
          b.addEventListener('click', function () {
            var refund = prompt('Cancel this booking. Refund note (e.g. "Full refund via Razorpay", "50% refund", "No refund"):', 'Full refund');
            if (refund == null) return;
            api('POST', '/ops/bookings/' + b.getAttribute('data-cancel') + '/cancel', { refund: refund }).then(function () { toast('Booking cancelled. Process the refund in the Razorpay dashboard.'); load(); }).catch(fail);
          });
        });
        $('#blk').addEventListener('click', function () {
          var dr = A.drawer('Block a slot', '<form class="form" id="bkf"><div class="f"><label>Facility</label><select name="resourceId">' + r.resources.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div><div class="fieldset"><div class="f"><label>Date</label><input type="date" name="date" value="' + date + '"></div><div class="f"><label>Reason</label><input type="text" name="reason" placeholder="Maintenance / tournament"></div><div class="f"><label>From</label><input type="time" name="start"></div><div class="f"><label>To</label><input type="time" name="end"></div></div></form>', '<span></span><button class="btn" data-save>Block</button>');
          $('[data-save]', dr).addEventListener('click', function () {
            var f = $('#bkf');
            api('POST', '/ops/blocks', { resourceId: f.resourceId.value, date: f.date.value, start: f.start.value, end: f.end.value, reason: f.reason.value }).then(function () { toast('Slot blocked'); A.closeLayer(); }).catch(fail);
          });
        });
      }).catch(fail);
    }
    load();
  });

  /* -------------------------------------------- messages & integrations */
  A.register('messages', function (main) {
    Promise.all([api('GET', '/ops/outbox'), api('GET', '/ops/templates'), api('GET', '/ops/integrations')]).then(function (res) {
      var out = res[0], tpls = res[1], ig = res[2];
      var state = function (on, label) { return '<span class="tag ' + (on ? 'tag--enrolled' : 'tag--contacted') + '">' + (on ? 'Connected' : label || 'Demo mode') + '</span>'; };
      main.innerHTML = top('Messages & integrations', 'Automatic WhatsApp and email messages, their templates, and the log of everything sent.') +
        '<div class="kpis" style="grid-template-columns:repeat(4,1fr)">' +
        '<div class="card kpi"><span class="mono muted">Payments</span><b style="font-size:28px">Razorpay</b>' + state(ig.payments.provider === 'razorpay') + '<span class="muted" style="font-size:12px">Webhook: ' + esc(ig.payments.webhookUrl) + (ig.payments.webhook ? ' ✓' : ' (secret not set)') + '</span></div>' +
        '<div class="card kpi"><span class="mono muted">WhatsApp</span><b style="font-size:28px">Cloud API</b>' + state(ig.whatsapp) + '</div>' +
        '<div class="card kpi"><span class="mono muted">Email</span><b style="font-size:28px">SMTP</b>' + state(ig.email) + '</div>' +
        '<div class="card kpi"><span class="mono muted">Google reviews</span><b style="font-size:28px">Places API</b>' + state(ig.googleReviews, 'Manual reviews') + '</div></div>' +
        '<p class="muted" style="margin:-4px 0 18px;font-size:13px">Keys are set as server environment variables (never in the database). See README → Integrations.</p>' +
        '<div class="tabs" id="mt"><button class="is-on" data-v="log">Message log</button><button data-v="tpl">Templates</button><button data-v="test">Send a test</button></div><div id="mv"></div>';
      function view(v) {
        var mv = $('#mv');
        if (v === 'log') mv.innerHTML = '<div class="card table-wrap">' + (out.items.length ? '<table class="table"><thead><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead><tbody>' + out.items.map(function (m) { return '<tr style="cursor:default"><td class="muted" style="white-space:nowrap">' + A.fmtDate(m.at) + '</td><td>' + esc(m.channel) + '</td><td>' + esc(m.to) + '</td><td style="max-width:520px"><b>' + esc(m.event) + '</b><br><span class="muted" style="font-size:13px">' + esc(m.body).slice(0, 220) + '</span>' + (m.error ? '<br><span style="color:var(--track);font-size:12px">' + esc(m.error) + '</span>' : '') + '</td><td>' + tag(m.status) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">Nothing sent yet.</div>') + '</div>';
        if (v === 'tpl') {
          mv.innerHTML = '<p class="muted" style="font-size:13px;margin-bottom:12px">Use {{name}}, {{amount}}, {{link}} and the other words in double braces; they are filled in when the message goes out. Empty fields use the default. <b>WhatsApp:</b> business-initiated messages must use a template approved in Meta Business Manager. Enter it as <code>template_name|var1,var2</code> to send that template with those variables.</p>' +
            tpls.map(function (t) {
              return '<form class="card card__pad form" data-tpl="' + t.key + '" style="margin-bottom:12px"><h2 style="font-size:18px">' + esc(t.label) + ' <span class="mono muted" style="font-size:10px">' + esc(t.key) + '</span></h2>' +
                '<div class="f"><label>Email subject</label><input type="text" name="subject" value="' + esc(t.subject) + '" placeholder="' + esc(t.defaultSubject) + '"></div>' +
                '<div class="f"><label>Message</label><textarea name="body" rows="3" placeholder="' + esc(t.defaultBody) + '">' + esc(t.body) + '</textarea></div>' +
                '<div class="f"><label>Approved WhatsApp template (optional)</label><input type="text" name="waTemplate" value="' + esc(t.waTemplate) + '" placeholder="e.g. fee_reminder|name,amount,due,link"></div><button class="btn btn--sm" type="submit">Save</button></form>';
            }).join('');
          mv.querySelectorAll('[data-tpl]').forEach(function (f) {
            f.addEventListener('submit', function (e) { e.preventDefault(); api('PUT', '/ops/templates/' + f.getAttribute('data-tpl'), { subject: f.subject.value, body: f.body.value, waTemplate: f.waTemplate.value }).then(function () { toast('Template saved'); }).catch(fail); });
          });
        }
        if (v === 'test') {
          mv.innerHTML = '<form class="card card__pad form" id="tst" style="max-width:480px"><div class="f"><label>WhatsApp number</label><input type="text" name="phone" placeholder="98290 12345"></div><div class="f"><label>Email</label><input type="email" name="email"></div><button class="btn btn--sm" type="submit">Send test</button></form>';
          $('#tst').addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/ops/test-message', { phone: e.target.phone.value, email: e.target.email.value }).then(function () { toast('Sent. Check the log.'); }).catch(fail); });
        }
      }
      view('log');
      $('#mt').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; $$('#mt button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); view(b.getAttribute('data-v')); });
    }).catch(fail);
  });

  /* ---------------------------------------------- privacy requests */
  A.register('privacy', function (main) {
    api('GET', '/ops/privacy').then(function (rows) {
      var LABEL = { access: 'Access / summary', correction: 'Correction', erasure: 'Erasure', 'withdraw-consent': 'Withdraw consent', nominate: 'Nomination', grievance: 'Grievance' };
      main.innerHTML = top('Privacy requests', 'Requests under the DPDP Act 2023. The phone number was verified with a one-time code. Respond within 30 days.', '<a class="btn btn--ghost" href="/data-request" target="_blank" rel="noopener">' + icon('ext') + 'Request form</a>') +
        '<div class="card table-wrap" id="ptable">' + (rows.length ? '<table class="table"><thead><tr><th>Request</th><th>From</th><th>Received</th><th>Respond by</th><th>Status</th></tr></thead><tbody>' + rows.map(function (p) {
          var late = p.status !== 'closed' && p.due < todayIST();
          return '<tr data-id="' + p.id + '"><td><b>' + esc(LABEL[p.type] || p.type) + '</b></td><td>' + esc(p.name) + '<br><span class="muted">' + esc(p.phone) + '</span></td><td class="muted">' + d(p.createdAt) + '</td><td' + (late ? ' style="color:var(--track);font-weight:600"' : '') + '>' + d(p.due) + '</td><td>' + tag(p.status) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No privacy requests.</div>') + '</div>';
      $('#ptable').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]'); if (!tr) return;
        var p = rows.find(function (x) { return x.id === tr.getAttribute('data-id'); });
        var dr = A.drawer(LABEL[p.type] || p.type, '<dl class="dl"><dt>Name</dt><dd>' + esc(p.name) + '</dd><dt>Phone</dt><dd>' + esc(p.phone) + ' ✓ verified</dd><dt>Email</dt><dd>' + esc(p.email || '—') + '</dd><dt>Details</dt><dd>' + esc(p.details || '—') + '</dd><dt>Respond by</dt><dd>' + d(p.due) + '</dd></dl>' +
          '<div class="f"><label>Status</label><select id="pst">' + ['new', 'in progress', 'closed'].map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
          '<div class="f"><label>Notes (what was done, when the reply was sent)</label><textarea id="pnt">' + esc(p.notes || '') + '</textarea></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn--ghost btn--sm" href="/api/admin/ops/privacy/' + p.id + '/export">' + icon('down') + 'Export their data (JSON)</a>' + (p.type === 'erasure' || p.type === 'withdraw-consent' ? '<button class="btn btn--danger btn--sm" data-erase>Erase personal data</button>' : '') + '</div>',
          '<span></span><button class="btn" data-save>Save</button>');
        $('[data-save]', dr).addEventListener('click', function () { api('PATCH', '/ops/privacy/' + p.id, { status: $('#pst').value, notes: $('#pnt').value }).then(function () { toast('Saved'); A.closeLayer(); viewAgain(); }).catch(fail); });
        var er = $('[data-erase]', dr);
        if (er) er.addEventListener('click', function () {
          A.confirmBox('Erase all personal data for ' + p.phone + '?', 'Athlete records, attendance, fitness, feedback, form submissions and the portal account are deleted. Invoices are kept with the name removed, as tax law requires. This cannot be undone.', 'Erase').then(function (ok) {
            if (ok) api('POST', '/ops/privacy/' + p.id + '/erase').then(function (r) { toast('Erased: ' + (r.summary.join(', ') || 'no records found')); A.closeLayer(); viewAgain(); }).catch(fail);
          });
        });
      });
      function viewAgain() { window.dispatchEvent(new HashChangeEvent('hashchange')); }
    }).catch(fail);
  });
})();
