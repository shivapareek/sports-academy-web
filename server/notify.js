// Outgoing messages: email (SMTP) and WhatsApp (Meta WhatsApp Business Cloud API).
// Every message is logged in db.outbox. Without credentials the channel runs in
// demo mode: messages are logged but not sent, so the flows can be tested.
//
// Env: SMTP_URL (smtps://user:pass@host:465), MAIL_FROM,
//      WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, PUBLIC_URL
const store = require('./store');

const TEMPLATES = {
  'lead.staff': {
    label: 'New lead → staff',
    subject: 'New {{type}}: {{name}}',
    body: 'New {{type}} on the website.\nName: {{name}}\nPhone: {{phone}}\nProgram: {{program}}\n{{details}}\nOpen the admin panel: {{link}}',
  },
  'trial.confirm': {
    label: 'Free trial confirmed → parent',
    subject: 'Your free trial at {{academy}} is confirmed',
    body: 'Namaste {{name}}! Aapka free {{program}} trial {{when}} ko confirm hai. Venue: {{venue}}. Sports kit aur paani ki bottle saath laayein. Reference: {{ref}}. — {{academy}}',
  },
  'admission.received': {
    label: 'Admission received → parent',
    subject: 'We received your application',
    body: 'Namaste {{name}}, {{student}} ka admission form humein mil gaya hai ({{program}}). Hamari team 1 working day me call karegi. Reference: {{ref}}. — {{academy}}',
  },
  'waitlist.joined': {
    label: 'Added to waiting list → parent',
    subject: 'You are on the waiting list',
    body: 'Namaste {{name}}, {{batch}} batch abhi full hai. {{student}} waiting list me #{{position}} par hai. Seat khulte hi hum aapko message karenge. — {{academy}}',
  },
  'waitlist.seat': {
    label: 'Seat opened → waiting parent',
    subject: 'A seat is open in {{batch}}',
    body: 'Good news {{name}}! {{batch}} me ek seat khuli hai. 48 ghante me confirm karne ke liye call karein {{phone}} ya reply karein. — {{academy}}',
  },
  'portal.invite': {
    label: 'Parent portal invite',
    subject: 'Your {{academy}} parent portal',
    body: 'Namaste {{name}}, aapka parent portal ready hai: attendance, fitness reports, fees aur coach feedback ek jagah. Password set karein: {{link}} (link 7 din valid hai). — {{academy}}',
  },
  'portal.reset': {
    label: 'Portal password reset',
    subject: 'Reset your portal password',
    body: 'Password reset karne ke liye ye link kholein: {{link}} (1 ghante ke liye valid). Agar aapne request nahi ki to is message ko ignore karein. — {{academy}}',
  },
  'otp': {
    label: 'One-time code',
    subject: 'Your verification code',
    body: '{{code}} aapka {{academy}} verification code hai. Ye 10 minute ke liye valid hai. Kisi ke saath share na karein.',
  },
  'invoice.created': {
    label: 'New fee invoice → parent',
    subject: 'Fee invoice {{number}} · {{amount}}',
    body: 'Namaste {{name}}, {{period}} ki fees {{amount}} due hai {{due}} tak. Online pay karein: {{link}} — {{academy}}',
  },
  'invoice.reminder': {
    label: 'Fee reminder → parent',
    subject: 'Reminder: fee due {{due}}',
    body: 'Reminder: {{period}} ki fees {{amount}} {{due}} ko due hai. Pay karein: {{link}} (UPI AutoPay on karke har mahine ki tension khatam karein.) — {{academy}}',
  },
  'invoice.overdue': {
    label: 'Fee overdue → parent',
    subject: 'Fee overdue: {{number}}',
    body: 'Namaste {{name}}, {{period}} ki fees {{amount}} {{due}} se pending hai. Kripya jaldi pay karein: {{link}}. Koi problem ho to front desk se baat karein {{phone}}. — {{academy}}',
  },
  'payment.received': {
    label: 'Payment received → payer',
    subject: 'Payment received · {{amount}}',
    body: 'Dhanyavaad! {{amount}} ka payment mil gaya ({{number}}). Receipt: {{link}} — {{academy}}',
  },
  'booking.confirmed': {
    label: 'Facility booking confirmed',
    subject: 'Booking confirmed: {{resource}}',
    body: 'Booking confirmed! {{resource}}, {{when}}. Reference {{ref}}. Entry gate par ye message dikhayein. — {{academy}}',
  },
  'notice': {
    label: 'Notice / holiday broadcast',
    subject: '{{title}}',
    body: '{{title}}\n{{text}}\n— {{academy}}',
  },
};

function channels() {
  return {
    email: !!process.env.SMTP_URL,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
  };
}

function render(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

function template(event) {
  const db = store.get();
  const custom = (db.templates || {})[event] || {};
  const base = TEMPLATES[event] || { subject: event, body: '' };
  return { subject: custom.subject || base.subject, body: custom.body || base.body, waTemplate: custom.waTemplate || '' };
}

// Indian numbers without a country code get +91.
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
  return d.length >= 11 ? d : '';
}

let transport = null;
function mailer() {
  if (!transport && process.env.SMTP_URL) transport = require('nodemailer').createTransport(process.env.SMTP_URL);
  return transport;
}

function log(entry) {
  const db = store.get();
  db.outbox = db.outbox || [];
  db.outbox.unshift({ id: store.id('o_'), at: new Date().toISOString(), ...entry });
  db.outbox.length = Math.min(db.outbox.length, 2000);
  store.save();
}

async function sendEmail(to, subject, body, event) {
  if (!to) return;
  if (!channels().email) return log({ channel: 'email', to, event, subject, body, status: 'demo' });
  try {
    await mailer().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_FROM || 'no-reply@localhost', to, subject, text: body });
    log({ channel: 'email', to, event, subject, body, status: 'sent' });
  } catch (e) {
    log({ channel: 'email', to, event, subject, body, status: 'failed', error: String(e.message).slice(0, 300) });
  }
}

// Business-initiated WhatsApp messages need a template approved by Meta.
// Put the approved template's name in Admin → Messages; its body parameters are
// filled with the message variables in the order listed there. Without a
// template name a plain text message is sent, which WhatsApp only delivers
// inside the 24-hour window after the customer last wrote to you.
async function sendWhatsApp(phone, body, event, tpl, vars) {
  const to = waNumber(phone);
  if (!to) return;
  if (!channels().whatsapp) return log({ channel: 'whatsapp', to, event, body, status: 'demo' });
  const payload = tpl.waTemplate
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: tpl.waTemplate.split('|')[0].trim(),
          language: { code: 'en' },
          components: [{ type: 'body', parameters: (tpl.waTemplate.split('|')[1] || '').split(',').map((k) => k.trim()).filter(Boolean).map((k) => ({ type: 'text', text: String(vars[k] ?? '') })) }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || `HTTP ${r.status}`);
    log({ channel: 'whatsapp', to, event, body, status: 'sent' });
  } catch (e) {
    log({ channel: 'whatsapp', to, event, body, status: 'failed', error: String(e.message).slice(0, 300) });
  }
}

// send('trial.confirm', { phone, email }, vars)
function send(event, to, vars = {}) {
  const db = store.get();
  const s = db.settings;
  const all = { academy: s.name, phone: s.phone, ...vars };
  const tpl = template(event);
  const subject = render(tpl.subject, all);
  const body = render(tpl.body, all);
  const jobs = [];
  if (to.email) jobs.push(sendEmail(to.email, subject, body, event));
  if (to.phone) jobs.push(sendWhatsApp(to.phone, body, event, tpl, all));
  // Never let a failed message break the request that triggered it.
  return Promise.all(jobs).catch((e) => console.error('notify', e));
}

function staff(event, vars) {
  const s = store.get().settings;
  return send(event, { email: s.staffEmail, phone: s.staffWhatsapp }, vars);
}

// Links in messages need the site's address. PUBLIC_URL wins; otherwise the
// address of the last request is remembered for messages sent by the scheduler.
let lastOrigin = '';
function remember(req) {
  lastOrigin = `${req.protocol}://${req.get('host')}`;
}
function publicUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  if (req) return `${req.protocol}://${req.get('host')}`;
  return lastOrigin || `http://localhost:${process.env.PORT || 3000}`;
}

module.exports = { TEMPLATES, channels, send, staff, render, publicUrl, remember, waNumber };
