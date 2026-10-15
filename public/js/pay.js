/* Online payment for invoices: Razorpay Checkout when keys are configured,
   otherwise a clearly labelled demo checkout. Binds every [data-pay-invoice]. */
(function () {
  'use strict';
  if (window.VegaPay) return;

  function post(url, body) {
    var csrf = document.querySelector('meta[name="csrf"]');
    var headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['x-csrf'] = csrf.content;
    return fetch(url, { method: 'POST', headers: headers, credentials: 'same-origin', body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Something went wrong.');
        return j;
      });
    });
  }

  var rzpLoading = null;
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    if (rzpLoading) return rzpLoading;
    rzpLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      s.onerror = function () { rzpLoading = null; reject(new Error('Could not load the payment window. Check your connection.')); };
      document.head.appendChild(s);
    });
    return rzpLoading;
  }

  function rupees(paise) { return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

  // A stand-in for Razorpay Checkout while the academy has no keys yet.
  function demoCheckout(o) {
    return new Promise(function (resolve, reject) {
      var wrap = document.createElement('div');
      wrap.className = 'demo-pay';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.innerHTML =
        '<div class="demo-pay__box"><span class="demo-pay__tag">Demo checkout</span>' +
        '<p class="demo-pay__name"></p><p class="demo-pay__amt">' + rupees(o.amount) + '</p>' +
        '<div class="demo-pay__methods" role="radiogroup" aria-label="Method">' +
        ['UPI', 'Card', 'Netbanking'].map(function (m, i) { return '<label><input type="radio" name="m" value="' + m + '"' + (i ? '' : ' checked') + '> ' + m + '</label>'; }).join('') + '</div>' +
        '<button type="button" class="demo-pay__ok">' + (o.subscription ? 'Approve mandate (demo)' : 'Pay ' + rupees(o.amount) + ' (demo)') + '</button>' +
        '<button type="button" class="demo-pay__cancel">Cancel</button>' +
        '<p class="demo-pay__note">No money moves. Add Razorpay keys on the server to take real payments.</p></div>';
      wrap.querySelector('.demo-pay__name').textContent = o.name + (o.description ? ' · ' + o.description : '');
      document.body.appendChild(wrap);
      var ok = wrap.querySelector('.demo-pay__ok');
      ok.focus();
      function close() { wrap.remove(); document.removeEventListener('keydown', esc); }
      function esc(e) { if (e.key === 'Escape') { close(); reject(new Error('Payment cancelled.')); } }
      document.addEventListener('keydown', esc);
      ok.addEventListener('click', function () {
        var m = wrap.querySelector('input:checked').value;
        close();
        resolve(m);
      });
      wrap.querySelector('.demo-pay__cancel').addEventListener('click', function () { close(); reject(new Error('Payment cancelled.')); });
    });
  }

  function openRazorpay(o, extra) {
    return loadRazorpay().then(function () {
      return new Promise(function (resolve, reject) {
        var opts = Object.assign({
          key: o.keyId,
          name: o.name,
          description: o.description || '',
          prefill: o.prefill || {},
          theme: { color: '#0e0e0d' },
          handler: resolve,
          modal: { ondismiss: function () { reject(new Error('Payment cancelled.')); } },
        }, extra);
        var r = new window.Razorpay(opts);
        r.on('payment.failed', function (resp) { reject(new Error((resp.error && resp.error.description) || 'Payment failed.')); });
        r.open();
      });
    });
  }

  function payInvoice(invoiceId, token) {
    return post('/api/pay/order', { invoiceId: invoiceId, token: token }).then(function (o) {
      if (o.provider === 'demo') {
        return demoCheckout(o).then(function (method) { return post('/api/pay/demo', { paymentId: o.paymentId, method: method }); });
      }
      return openRazorpay(o, { amount: o.amount, currency: o.currency, order_id: o.orderId }).then(function (resp) {
        return post('/api/pay/verify', Object.assign({ paymentId: o.paymentId }, resp));
      });
    });
  }

  function startAutopay() {
    return post('/portal/api/autopay/start').then(function (o) {
      if (o.provider === 'demo') {
        return demoCheckout({ name: o.name, description: 'UPI AutoPay · monthly', amount: o.amount * 100, subscription: true }).then(function () { return post('/portal/api/autopay/demo'); });
      }
      return openRazorpay(o, { subscription_id: o.subscriptionId, recurring: 1 }).then(function (resp) { return post('/portal/api/autopay/verify', resp); });
    });
  }

  function msgNear(el, text, kind) {
    var scope = el.closest('form, .bezel__core, .doc, .pbox, body');
    var m = scope && scope.querySelector('.form-msg');
    if (!m) { if (kind === 'err') alert(text); return; }
    m.textContent = text;
    m.className = 'form-msg' + (kind ? ' is-' + kind : '');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pay-invoice]');
    if (!b) return;
    e.preventDefault();
    b.disabled = true;
    payInvoice(b.getAttribute('data-pay-invoice'), b.getAttribute('data-token'))
      .then(function (r) {
        msgNear(b, 'Payment received. Thank you! Opening your receipt…', 'ok');
        setTimeout(function () { location.href = '/invoice/' + r.invoiceId + '?t=' + r.token; }, 900);
      })
      .catch(function (err) { b.disabled = false; msgNear(b, err.message, 'err'); });
  });

  window.VegaPay = { payInvoice: payInvoice, startAutopay: startAutopay, post: post, msgNear: msgNear };
})();
