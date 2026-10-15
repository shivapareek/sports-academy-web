// Version 2 data: students, families, attendance, fitness, fees, bookings,
// notices, trust content and legal pages. Runs on a fresh database and once on
// an existing version 1 database (only filling what is missing).
// All people, numbers and bodies here are fictional demo content.
const store = require('./store');
const { hashPassword } = require('./auth');

const SETTINGS_V2 = {
  staffEmail: 'frontdesk@vegasports.in',
  staffWhatsapp: '919829012345',
  legalName: 'Vega Sports Academy Pvt. Ltd.',
  gstin: '',
  gstRate: 18,
  sac: '999723',
  pricesIncludeGst: true,
  stateName: 'Rajasthan',
  invoicePrefix: 'VSA',
  siblingDiscount: 10,
  autoBilling: true,
  billingDay: 1,
  dueDays: 7,
  overdueDays: 3,
  autoSeats: false,
  trialsPerSession: 2,
  bookingHoldMinutes: 10,
  bookingDaysAhead: 14,
  grievanceName: 'Ritu Sharma (Grievance Officer)',
  grievanceEmail: 'privacy@vegasports.in',
  consentVersion: '2026-10',
  verifyParentConsent: true,
  googlePlaceId: '',
  googleReviewsUrl: '',
};

const LEGAL = [
  {
    title: 'Privacy policy',
    slug: 'privacy-policy',
    intro: 'How Vega Sports Academy collects, uses and protects personal data, in line with the Digital Personal Data Protection Act, 2023.',
    body: `## Who we are

Vega Sports Academy ("we") is the Data Fiduciary for personal data collected through this website, our admission forms and the parent portal.

## What we collect

- **Parents and guardians:** name, phone, email, address.
- **Athletes:** name, date of birth, gender, sport, batch, attendance, fitness test results, coach feedback, and medical information you choose to share for safety.
- **Payments:** invoice and payment references. Card and UPI details are handled by our payment gateway (Razorpay) and are never stored by us.
- **Photos and videos:** only with separate, specific consent (see below).

## Children's data

Most of our athletes are under 18. Under Section 9 of the DPDP Act we process a child's data only with **verifiable consent from a parent or lawful guardian**. On admission we verify the parent's phone number with a one-time code and record the consent, its version and time. We do not track children for advertising, profile them for marketing or send them targeted ads.

## Why we use it

To run admissions and trials, place athletes in the right batch, keep them safe, track progress, bill fees, send reminders and notices, and meet legal obligations (tax, accounting).

## How long we keep it

While the athlete trains with us, then for up to 3 years for records and disputes, and longer only where tax law requires (invoices). After that it is deleted or anonymised.

## Sharing

With service providers that help us run the academy (hosting, payments, messaging) under contract, and with authorities when the law requires. We never sell personal data.

## Your rights

You can ask to **access, correct or erase** your data, **withdraw consent** at any time (this does not affect processing already done), and **nominate** someone to exercise your rights. Use the [data request form](/data-request) or the parent portal. We reply within 30 days.

## Grievances

Contact our Grievance Officer at the email on the [contact page](/contact). If you are not satisfied, you may complain to the Data Protection Board of India.

*Template text. Have it reviewed by a lawyer before going live.*`,
  },
  {
    title: 'Terms of training',
    slug: 'terms',
    intro: 'The rules that keep training safe, fair and fun for everyone.',
    body: `## Enrolment

A place is confirmed after the assessment, the admission form and the first payment. Batches and coaches may change for operational reasons; we tell you in advance.

## Fees

Fees are billed monthly in advance (or per your plan) and are due within the period on the invoice. Late payment may pause training after a reminder. The one-time registration fee is non-refundable.

## Conduct and safety

Athletes follow coaches' instructions, wear proper kit and respect teammates, opponents and staff. Parents tell us about any medical condition. We may pause training for safety reasons.

## Liability

Sport has inherent risks. We follow safety and first-aid procedures, but we are not liable for injuries that occur despite reasonable care.

*Template text. Have it reviewed by a lawyer before going live.*`,
  },
  {
    title: 'Refund & cancellation policy',
    slug: 'refund-policy',
    intro: 'Clear rules for fees, facility bookings and cancellations.',
    body: `## Monthly fees

- To stop training, tell us **before the 25th** and the next month will not be billed.
- Fees for a month already started are not refunded, but missed sessions can be made up in the same month (subject to seats).
- Medical breaks of 4 weeks or more (with a doctor's note): the unused part is carried forward.

## Quarterly and annual plans

Cancel within 7 days of payment for a full refund minus any sessions attended. After that, the unused full months are refunded minus a 10% admin charge.

## Facility bookings

- Cancel **24 hours or more** before the slot: full refund.
- Less than 24 hours: 50% refund. No-show: no refund.
- If we cancel (weather, maintenance), you get a full refund or a free reschedule.

## How refunds are paid

To the original payment method within 7 working days of approval.

*Template text. Have it reviewed before going live.*`,
  },
  {
    title: 'Photo & video consent',
    slug: 'photo-consent',
    intro: 'When and how we use photos and videos of athletes.',
    body: `We take photos and videos during training and events to coach better (video analysis) and to share the academy's story.

- **Coaching video** is used only inside the academy and in the parent portal.
- **Publishing** photos or videos of an athlete on our website or social media needs **separate, optional consent** from a parent (for under-18s) or the athlete.
- You can give or withdraw this consent any time in the parent portal or by writing to us. Withdrawn images are removed from our website and our active social posts within 7 days.
- We never publish a child's full name together with their school or location.

*Template text. Have it reviewed before going live.*`,
  },
];

function applyV2(db, { demo, people }) {
  const id = store.id;
  for (const k of ['families', 'students', 'attendance', 'fitness', 'feedback', 'invoices', 'payments', 'bookings', 'blocks', 'outbox', 'otps', 'privacyRequests', 'notices', 'resources', 'affiliations', 'alumni', 'press', 'partners', 'reviews', 'billingRuns']) {
    if (!Array.isArray(db[k])) db[k] = [];
  }
  db.templates = db.templates || {};
  db.counters = db.counters || {};
  db.portalSessions = db.portalSessions || [];
  for (const [k, v] of Object.entries(SETTINGS_V2)) if (!(k in db.settings)) db.settings[k] = v;
  for (const k of ['trust', 'alumni', 'reviews', 'press']) if (!(k in db.sections)) db.sections[k] = true;

  // Legal pages: add the missing ones; replace the v1 privacy template if untouched.
  for (const page of LEGAL) {
    const cur = db.pages.find((p) => p.slug === page.slug);
    if (!cur) db.pages.push({ id: id('pg_'), published: true, inFooter: true, ...page });
    else if (page.slug === 'privacy-policy' && /This is template text/.test(cur.body || '')) Object.assign(cur, page);
  }

  if (!demo) return db;
  const day = (offset) => {
    const d = new Date(Date.now() + 330 * 60e3);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const batchBy = (name) => (db.batches.find((b) => b.name === name) || {}).id;
  const progBy = (slug) => (db.programs.find((p) => p.slug === slug) || {}).id;
  const coachBy = (name) => (db.coaches.find((c) => c.name.startsWith(name)) || {}).id;

  if (!db.resources.length) {
    const img = (slot, sport) => (db.facilities.find((f) => f.image && f.image.includes(sport)) || {}).image || '';
    db.resources.push(
      { id: id('rs_'), published: true, name: 'Badminton court', sport: 'Badminton', rate: 400, slotMinutes: 60, openFrom: '06:00', openTo: '22:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], capacity: 'Up to 4 players · rackets on hire', image: img('', 'court'), description: 'Synthetic-mat wooden court with LED lighting.' },
      { id: id('rs_'), published: true, name: 'Cricket turf net', sport: 'Cricket', rate: 900, slotMinutes: 60, openFrom: '06:00', openTo: '21:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], capacity: 'Batter + up to 3 bowlers', image: img('', 'ground'), description: 'Turf net with bowling machine on request (₹300 extra).' },
      { id: id('rs_'), published: true, name: 'Football turf (5-a-side)', sport: 'Football', rate: 1800, slotMinutes: 60, openFrom: '06:00', openTo: '23:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], capacity: 'Up to 12 players · floodlit', image: img('', 'ground'), description: 'FIFA-quality artificial turf, floodlit until 11 PM.' },
      { id: id('rs_'), published: true, name: 'Swimming lane', sport: 'Swimming', rate: 250, slotMinutes: 60, openFrom: '06:00', openTo: '20:00', days: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], capacity: '1 swimmer · lifeguard on deck', image: img('', 'pool'), description: 'Heated 25 m lane for lap swimming.' }
    );
  }

  if (!db.notices.length) {
    db.notices.push(
      { id: id('nt_'), published: true, title: 'Diwali break: academy closed', type: 'Holiday', date: day(14), until: day(17), program: '', text: 'All batches are off for Diwali. The facility booking desk stays open on the last day. Happy Diwali!' },
      { id: id('nt_'), published: true, title: 'Fitness testing week', type: 'Notice', date: day(5), until: day(10), program: '', text: 'Every athlete is tested this week (20 m sprint, broad jump, plank, beep test). Results appear in the portal within 3 days.' },
      { id: id('nt_'), published: true, title: 'U-16 Development moves to the main ground', type: 'Schedule change', date: day(2), until: '', program: progBy('cricket'), text: 'From Monday the U-16 batch trains on the main ground; nets 1–3 are being re-laid.' }
    );
  }

  if (!db.affiliations.length) {
    db.affiliations.push(
      { id: id('af_'), published: true, name: 'District Cricket Association', note: 'Affiliated club · league fixtures', logo: '', url: '' },
      { id: id('af_'), published: true, name: 'State Football Association', note: 'Registered grassroots centre', logo: '', url: '' },
      { id: id('af_'), published: true, name: 'State Badminton Association', note: 'Ranking events host', logo: '', url: '' },
      { id: id('af_'), published: true, name: 'Swimming Federation', note: 'Certified coaches', logo: '', url: '' },
      { id: id('af_'), published: true, name: 'Khelo India', note: 'Talent identification partner', logo: '', url: '' },
      { id: id('af_'), published: true, name: 'Sports Authority', note: 'Recognised academy', logo: '', url: '' }
    );
  }
  if (!db.alumni.length) {
    const g = (sport) => (db.gallery.find((x) => (x.sport || '').toLowerCase() === sport) || {}).image || '';
    db.alumni.push(
      { id: id('al_'), published: true, consent: true, name: 'Aditya R.', sport: 'Cricket', achievement: 'State U-19 squad, fast bowler', level: 'State', year: '2025', photo: g('cricket') },
      { id: id('al_'), published: true, consent: true, name: 'Sana K.', sport: 'Badminton', achievement: 'National ranking event quarter-finalist (U-17)', level: 'National', year: '2025', photo: g('badminton') },
      { id: id('al_'), published: true, consent: true, name: 'Harsh M.', sport: 'Athletics', achievement: 'State gold, 400 m (U-18)', level: 'State', year: '2024', photo: g('athletics') },
      { id: id('al_'), published: true, consent: true, name: 'Ishita P.', sport: 'Swimming', achievement: 'National aquatics meet finalist', level: 'National', year: '2024', photo: g('swimming') }
    );
  }
  if (!db.press.length) {
    db.press.push(
      { id: id('pr_'), published: true, kind: 'Press', outlet: 'City daily (demo)', title: 'How a Jagatpura academy is building fast bowlers who stay fit', date: day(-40), url: '', logo: '' },
      { id: id('pr_'), published: true, kind: 'Award', outlet: 'State sports awards (demo)', title: 'Best Grassroots Academy, 2025', date: day(-300), url: '', logo: '' },
      { id: id('pr_'), published: true, kind: 'Press', outlet: 'Regional TV (demo)', title: 'Girls’ football batch doubles in a year', date: day(-25), url: '', logo: '' }
    );
  }
  if (!db.partners.length) {
    db.partners.push(
      { id: id('pt_'), published: true, name: 'Greenfield Public School', kind: 'Partner school', logo: '', url: '' },
      { id: id('pt_'), published: true, name: 'St. Anselm’s (demo)', kind: 'Partner school', logo: '', url: '' },
      { id: id('pt_'), published: true, name: 'PeakFuel Nutrition', kind: 'Health partner', logo: '', url: '' },
      { id: id('pt_'), published: true, name: 'Stride Sportswear', kind: 'Kit partner', logo: '', url: '' }
    );
  }
  if (!db.reviews.length) {
    db.reviews.push(
      { id: id('rv_'), published: true, name: 'Mohit Jain', rating: 5, text: 'Coaches actually know every kid by name. My son’s footwork in badminton has changed completely in 4 months.', date: day(-9) },
      { id: id('rv_'), published: true, name: 'Pooja Saxena', rating: 5, text: 'Very clean pool, lifeguard always present, and the 8-week report is genuinely useful.', date: day(-21) },
      { id: id('rv_'), published: true, name: 'Arjun Singh', rating: 4, text: 'Great turf and floodlights. Booking online is easy. Parking gets busy on weekends.', date: day(-33) }
    );
  }

  // Families, students and their records (fresh demo databases only).
  if (people && !db.families.length) {
    const fam = (guardian, phone, email, pass) => {
      const f = { id: id('fa_'), guardian, phone, email, passwordHash: pass ? hashPassword(pass) : '', consents: [{ type: 'data', version: db.settings.consentVersion, granted: true, method: 'otp', at: new Date(Date.now() - 80 * 864e5).toISOString() }, { type: 'photo', version: db.settings.consentVersion, granted: true, method: 'portal', at: new Date(Date.now() - 80 * 864e5).toISOString() }], autopay: { status: 'off' }, createdAt: new Date(Date.now() - 90 * 864e5).toISOString() };
      db.families.push(f);
      return f;
    };
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const code = () => 'V' + Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('');
    const kid = (f, name, dob, gender, batches, photoConsent = true) => {
      const s = { id: id('st_'), familyId: f.id, name, dob, gender, batchIds: batches.filter(Boolean), status: 'active', joined: day(-90), code: code(), photoConsent, medical: '', notes: '', createdAt: new Date(Date.now() - 90 * 864e5).toISOString() };
      db.students.push(s);
      return s;
    };
    const f1 = fam('Neha Agarwal', '+91 98765 00001', 'parent@vega.local', 'Parent@12345');
    const f2 = fam('Rajesh Saini', '+91 98765 00002', 'rajesh.saini@example.com', '');
    const f3 = fam('Priya Sharma', '+91 98765 00003', 'priya.sharma@example.com', '');
    const kids = [
      kid(f1, 'Myra Agarwal', '2014-03-12', 'Female', [batchBy('Juniors Foundation')]),
      kid(f1, 'Vivaan Agarwal', '2016-08-02', 'Male', [batchBy('Learn to Swim')]),
      kid(f2, 'Rohit Saini', '2008-01-20', 'Male', [batchBy('High Performance')]),
      kid(f3, 'Aarav Sharma', '2012-11-05', 'Male', [batchBy('U-14 Squad')], false),
      kid(f3, 'Anaya Sharma', '2015-06-17', 'Female', [batchBy('Learn to Swim')]),
    ];

    // Six weeks of attendance on each batch's training days.
    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const s of kids) {
      for (const bid of s.batchIds) {
        const b = db.batches.find((x) => x.id === bid);
        for (let i = 42; i >= 1; i--) {
          const date = day(-i);
          if (!(b.days || []).includes(DAY_KEYS[new Date(date + 'T00:00:00Z').getUTCDay()])) continue;
          const r = Math.random();
          db.attendance.push({ id: id('at_'), studentId: s.id, batchId: bid, date, status: r < 0.86 ? 'present' : r < 0.93 ? 'late' : 'absent', by: 'Coach', method: Math.random() < 0.5 ? 'qr' : 'manual', at: date + 'T07:00:00.000Z' });
        }
      }
    }
    // Three rounds of fitness tests, improving a little each time.
    const base = { 'Myra Agarwal': [4.4, 152, 45, 5.2], 'Vivaan Agarwal': [4.9, 128, 30, 3.8], 'Rohit Saini': [3.3, 238, 140, 10.6], 'Aarav Sharma': [3.9, 186, 70, 7.4], 'Anaya Sharma': [4.8, 131, 34, 4.1] };
    for (const s of kids) {
      const [sp, bj, pl, be] = base[s.name];
      [-112, -56, -4].forEach((off, i) => {
        db.fitness.push({ id: id('ft_'), studentId: s.id, date: day(off), sprint20: +(sp - i * 0.12).toFixed(2), broadJump: Math.round(bj + i * 6), plank: Math.round(pl + i * 12), beep: +(be + i * 0.6).toFixed(1), notes: i === 2 ? 'Good progress. Keep working on core strength.' : '', by: 'Dr. Kavita Jain' });
      });
    }
    const fb = (s, coach, off, text, effort) => db.feedback.push({ id: id('fb_'), studentId: s.id, coachId: coachBy(coach), by: coach, date: day(off), text, effort, visible: true });
    fb(kids[0], 'Ananya', -3, 'Myra’s six-corner footwork is much sharper. Next block: backhand clears from the rear court. Please make sure she sleeps by 10 on school nights.', 5);
    fb(kids[0], 'Ananya', -24, 'Excellent attitude in the doubles drill. Needs to bend the knees more on net shots.', 4);
    fb(kids[1], 'Meera', -6, 'Vivaan swam a full 25 m freestyle without stopping today! Breathing to both sides is next.', 5);
    fb(kids[2], 'Rakesh', -2, 'Workload this week: 3 sessions × 36 balls. Front-foot landing is more stable. Strength sessions are paying off.', 4);
    fb(kids[3], 'Imran', -5, 'Good first touch, needs to scan before receiving. Watch one full match this week and note how the midfielders turn.', 4);
    fb(kids[4], 'Meera', -8, 'Anaya is now comfortable putting her face in the water. Floating on her back next.', 5);

    // Fee history: last three months for every family; the latest one unpaid for the Sharmas.
    const billing = require('./billing');
    const academy = require('./academy');
    const thisMonth = academy.today().slice(0, 7);
    const months = [-2, -1, 0].map((m) => {
      const d = new Date(thisMonth + '-01T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + m);
      return d.toISOString().slice(0, 7);
    });
    for (const period of months) {
      const made = billing.generateMonth(period);
      for (const inv of made) {
        inv.date = `${period}-01`;
        inv.dueDate = `${period}-08`;
        inv.createdAt = `${period}-01T04:00:00.000Z`;
        const lastAndSharma = period === thisMonth && inv.familyId === f3.id;
        if (!lastAndSharma) {
          inv.status = 'paid';
          inv.paidAt = `${period}-0${3 + (inv.number.length % 4)}T10:00:00.000Z`;
          inv.payment = { provider: 'demo', id: 'pay_demo_' + inv.id.slice(-6), method: 'UPI' };
        }
      }
    }
    db.billingRuns.push(thisMonth);
    db.outbox = [];
  }
  return db;
}

// Bring any database up to the current version.
function migrate(db, { fresh }) {
  if ((db.version || 1) < 2) {
    applyV2(db, { demo: true, people: fresh });
    db.version = 2;
  }
}

module.exports = { applyV2, migrate, SETTINGS_V2 };
