# Vega Sports Academy: website and CMS

A dynamic website for a multi-sport academy (fictional client: Vega Sports Academy, Jagatpura, Jaipur), with a full admin panel. It runs on Node.js and Express and stores data in a JSON file. There is no build step, and the browser code is plain JavaScript.

## Run

```bash
npm install
npm start            # http://localhost:3000   admin: http://localhost:3000/admin/
npm test             # 15 end-to-end checks: forms, auth/CSRF, escaping, booking, payments, GST, portal, QR, erasure, PDFs
```

First sign-in: **admin@vega.local / ChangeMe@123**. You can also set `ADMIN_PASSWORD` before the first start. With the default password, the panel asks you to change it straight away.

Environment variables: `PORT` (3000), `DATA_DIR` (./data), `UPLOAD_DIR` (./uploads), `ADMIN_PASSWORD` (used on the first run only), `COOKIE_SECURE=1` (when served over HTTPS), `TRUST_PROXY=1` (behind Nginx, Render or Railway).

Data lives in `data/cms.json`, and a daily backup goes to `data/backups/` (the last 14 days are kept). Keep `data/` and `uploads/` on persistent storage and out of git.

## The design

- **Palette**: chalk `#EEEAE2`, ink `#0E0E0D`, track red `#E0482B` and volt `#D4F53C`. Both accent colours can be changed in Admin → Settings → Look.
- **Type**: Archivo with a variable width axis for display. Headlines are set condensed (62%), and the highlighted word (`*word*` in any title) is set expanded and light (125%). Body text is Instrument Sans, and timing and labels use JetBrains Mono.
- **Hero ("the lanes")**: six running-lane strips, one per featured sport, each with its lane number painted at the bottom. On load the lanes open like runners leaving the blocks, the headline rises line by line, and the highlighted word stretches from condensed to expanded. A live session clock ticks in the corner and a sports ticker runs along the bottom. Hovering a lane brings its photo to colour and shows the sport. As you scroll, the lanes "race" away at different speeds.
- **Motion** uses GSAP 3.13, ScrollTrigger, SplitText and Lenis, vendored in `public/vendor/`. It includes:
  - an "On your marks / Set / Go" starting-lights intro (once per visit, can be switched off)
  - masked line reveals and blurred fade-ups
  - a manifesto whose words light up as you scroll
  - count-up numbers
  - a pinned horizontal programs carousel
  - a pathway rail that fills as you scroll
  - clip-path image reveals
  - floating images that follow the cursor on the coach and program lists
  - magnetic buttons and a custom cursor
  - a footer wordmark that stretches as you reach it

  `prefers-reduced-motion` turns all of it off. Without JavaScript every element is still visible.
- **Layout**: a floating island nav that hides on scroll and turns dark over dark sections, a full-screen menu with staggered links, double-bezel cards, a bento grid for facilities, and pill buttons with the arrow nested in its own circle. Layouts collapse to one column on phones.

## Pages

Home · About (story, values, timeline, facilities) · Programs (index with hover previews, plus cards) · Program detail (facts bar, overview, curriculum stages, batches with seats left, coaches, free-trial form, next program) · Coaches (filter by sport) · Schedule (weekly timetable with day tabs on phones, filter by sport, full batch list) · Gallery (filter and lightbox) · Stories & events (featured story, upcoming events, archive, article pages) · Admissions (steps, fee plans, a 3-step admission form, free-trial form, FAQ) · Contact (details, form, map) · Book a facility (`/book`) · Parent portal (`/portal`) · Privacy request (`/data-request`) · GST invoice/receipt pages · legal pages · custom pages created in the admin (`/<slug>`) · photo credits · 404. It also serves `sitemap.xml`, `robots.txt` and Schema.org `SportsActivityLocation` data.

## Admin panel (CMS)

- **Dashboard**: new leads; active athletes; fees collected and due (with overdue count); today's check-ins and bookings; waiting list; open privacy requests; a 14-day chart; activity.
- **Leads & forms**: free trials (with the booked session), admissions (with the consent record), enquiries and newsletter. Each has a status (new, contacted, scheduled, waiting list, enrolled, closed), notes, one-click call/WhatsApp/email and CSV export. **Enrol & invite** turns an admission into a student and a family and sends the parent-portal invite.
- **Operations**: students and families, attendance with QR, fees and invoices, facility bookings (see below).
- **Content**: programs, batches, coaches, facilities, fee plans, notices and holidays, bookable facilities, news, events, gallery, testimonials, affiliations, alumni, press and awards, partners and sponsors, Google reviews (manual), numbers, timeline, pathway, FAQs and custom pages. You can add, edit, hide and drag to reorder. A notice can be sent to parents on WhatsApp/email.
- **Page text**, **home sections**, **media library**, **settings**, **messages & integrations**, **users and roles**, **privacy requests**, **activity log**.

Roles: **Admin** (everything); **Editor** (content, leads, students, attendance); **Front desk** (leads, students, attendance, fees, bookings); **Coach** (attendance, fitness tests and feedback, only for the batches of the coach linked to their login).

## Academy operations

### Fees, GST invoices and payments
- Every family with active athletes gets a monthly invoice on the billing day (Settings → Fees & GST), with a WhatsApp/email payment link.
- Each child is billed for each program they train in. The **sibling discount** (default 10%) applies automatically to every child except the one with the highest fee.
- Invoices are **GST tax invoices** once you enter your GSTIN. They have sequential numbers per financial year (`VSA/2026-27/0001`), SAC code, taxable value, CGST/SGST and the amount in words. Without a GSTIN they say "Not registered under GST".
- Parents pay online through **Razorpay** (UPI, cards, netbanking, wallets) from the portal or the invoice link. The paid invoice becomes the **receipt**: a PDF download, also attached to the confirmation email.
- **UPI AutoPay**: in the portal, a parent approves a monthly mandate once (Razorpay Subscriptions). Each charge pays the oldest unpaid invoice automatically, and families on AutoPay get no reminders.
- **Reminders**: three days before the due date, then an overdue notice (default 3 days after). Staff can also send one by hand.
- **Offline payments**: record cash, offline UPI, bank transfer, cheque or card (POS) against an invoice. The receipt is sent automatically.
- **One-off invoices**: camps, registration, tournament entry.
- You can generate a month's invoices by hand; running it twice never double-bills.

### Parent portal (`/portal`)
Parents sign in with their mobile number or email and a password. The first link arrives on WhatsApp/email when an admission is enrolled, and "Forgot password" sends a reset link. In the portal they find:
- Every child: attendance calendar (8 weeks), next session, the **QR check-in card**, fitness test graphs (20 m sprint, broad jump, plank, beep test) and coach feedback with an effort rating.
- The **8-week progress report** (view, or download as a PDF).
- Fees: amount due, Pay buttons, payment history and receipts, and UPI AutoPay on/off.
- Schedule for the next 7 days (holidays marked) and notices.
- Account: photo/video consent per child, marketing consent, email, password, and a link to privacy requests.

### Attendance, fitness and feedback
- **Attendance & QR** (admin, works on a phone):
  - pick the batch and date
  - tap Present, Late or Absent, or "Mark rest present"
  - **scan the QR** on the child's portal card: live camera in any modern browser, a photo of the card, or type the code. A scan after the start time + 10 min is marked late. Each card counts once per scanning session.
  - medical notes show next to the athlete
- On the student page, coaches add fitness tests and feedback. Parents see them immediately.

### Seats, waiting list and bookings
- **Seats**: enrolling an athlete in a batch takes a seat, and leaving gives it back. With Settings → Bookings → "Calculate seats left from enrolled students", seats are always worked out from the student list. Turn that on once every student is entered.
- **Waiting list**: an admission for a full batch goes on its waiting list (the parent is told their position). When a seat opens, the first family and the staff are messaged.
- **Free-trial calendar**: the trial form shows the real sessions of the chosen sport for the next 14 days, with a cap per session (default 2). The parent gets a confirmation like "Aapka free Cricket trial Friday, 16 Oct, 6:00 AM ko confirm hai".
- **Facility booking (`/book`)**: courts, nets, turf and pool lanes by the hour.
  - The visitor picks up to 4 slots next to each other, and the slot is held for 10 minutes while they pay.
  - Double booking is impossible: a slot is checked again on the server.
  - The booking is confirmed when the payment succeeds, and a GST invoice/receipt is issued.
  - Admins see bookings by day, cancel them with a refund note, and block slots for maintenance.

### WhatsApp and email
- Messages sent automatically:
  - staff: every new lead
  - parent: trial confirmation, admission received, waiting list position, seat offer, portal invite and reset, one-time codes, invoices, reminders, overdue notices, payment receipts, booking confirmations, notices
- Every template is editable in **Messages & integrations**, and every message is logged there.

### Legal compliance (DPDP Act 2023)
- **Verifiable parental consent**: for an athlete under 18, the admission form verifies the parent's mobile with a one-time code before it can be sent. The consent version, method, time and IP are stored.
- **Photo/video consent** is separate and optional, per child, and can be changed in the portal. The admin shows "No photos" on those athletes. Alumni are only published with consent.
- **Privacy requests (`/data-request`)**: access, correction, erasure, withdraw consent, nomination and grievance, verified by a one-time code. Each has a 30-day due date.
  - Admins can **export a family's data (JSON)** and **erase** it.
  - Erasing removes athletes, attendance, fitness, feedback, form submissions and the portal account. Invoices are kept with the name removed, because tax law requires them.
- **Grievance officer** details are in Settings and shown on the privacy pages.
- Pages: privacy policy (DPDP-oriented), terms of training, refund & cancellation policy, photo & video consent, and safeguarding. **All of them are templates. Have a lawyer review them.**

### Trust signals
- An affiliations strip (logos, or text badges until you have permission to use a logo).
- Alumni cards (district → international level).
- Google reviews: live from the Places API when a key and Place ID are set, otherwise the reviews you enter.
- Press and awards, and partner schools, sponsors, kit and health partners.
- Each has its own home section (switch on/off) and also appears on About.

## Integrations (switch off demo mode)

Set these as environment variables on the server (see `.env.example`). Without them, each part runs in **demo mode**:
- the payment window is a clearly labelled simulation
- messages are logged but not sent
- one-time codes are shown on screen (unless `NODE_ENV=production`)

| What | Variables | Where to get it | Notes |
|---|---|---|---|
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Account & Settings → API keys and Webhooks | Webhook URL: `https://your-site/api/pay/webhook`. Events: `payment.captured`, `order.paid`, `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`. Enable **Subscriptions** (and UPI AutoPay) on your account for mandates. Process refunds in the Razorpay dashboard. |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Meta Business Manager → WhatsApp → API setup | Messages the academy starts must use **templates approved by Meta**. Create them there, then enter `template_name|var1,var2` per message in Admin → Messages. Plain text is only delivered within 24 hours of the parent's last message. |
| Email | `SMTP_URL`, `MAIL_FROM` | Any SMTP service (Zoho, Google Workspace, SES, Brevo) | Set SPF/DKIM for your domain so mail isn't marked spam. |
| Google reviews | `GOOGLE_PLACES_KEY` + Place ID in Settings → Trust | Google Cloud → Places API (New) | Cached for 6 hours. |
| Links in messages | `PUBLIC_URL` | Your site address | |

Other notes:
- Confirm your **GST rate and SAC code with your CA**. The defaults are 18% and SAC 999723.
- **PDFs** are real files made on the server (PDFKit, with the Archivo font embedded so ₹ prints correctly): GST invoices and receipts (`/invoice/<id>.pdf`), and the 8-week report (parent portal and admin). The payment receipt PDF is also attached to the confirmation email.
- **QR check-in** works in every modern browser. It uses the native BarcodeDetector where it exists, and otherwise the bundled jsQR decoder on the camera video. Live camera needs HTTPS (or localhost). Without it, or on an old phone, **"Scan from a photo"** takes a picture with the phone camera and decodes that. Typing the code always works too.

## Demo logins (fresh database)

- **Admin**: `admin@vega.local` / `ChangeMe@123` (or `ADMIN_PASSWORD`)
- **Parent portal**: `parent@vega.local` or `98765 00001` / `Parent@12345`. Neha Agarwal, with two children, 6 weeks of attendance, 3 rounds of fitness tests, feedback and 3 months of paid invoices.
- Two more demo families: the Sainis, and the Sharmas (with an unpaid, overdue invoice). They have no portal password; send them an invite from Students.

Upgrading a version-1 database adds the new settings, legal pages, facilities, notices and trust content. It does **not** add the demo families or invoices.

## Security

- Passwords are hashed with scrypt.
- Sessions use an HttpOnly, SameSite=Strict cookie, and every admin write needs a CSRF header.
- Sign-in and the public forms are rate limited, and the forms have a honeypot field.
- All output is escaped, and Markdown is sanitised.
- Uploads are limited to image types, and their file signatures are checked.
- CSV export is protected against formula injection.
- The site sends a Content Security Policy and other security headers.
- Payments are confirmed only after the Razorpay signature checks out, on checkout and on webhooks (the raw body is verified). Demo payments are refused once real keys are set.
- The parent portal has its own HttpOnly session, a CSRF token on every change, and strict ownership checks: a parent only ever sees their own children and invoices.
- Invoice links carry a random token. One-time codes are hashed, expire after 10 minutes and allow 5 attempts.
- The admin never receives password hashes.

## Photos

Every bundled photo (`public/img/`, 35 images) is a real photograph from the Open Images dataset (originally on Flickr), licensed **CC BY 2.0**. The images were cropped, resized and re-encoded to WebP. The authors, sources and licences are listed in `public/img/CREDITS.md`, on the `/credits` page and in `manifest.json`, and the footer links to the credits page.

Things to know before going live:

- The source files are at most 1024 px wide, so full-width headers look soft on large screens. Replace them with the academy's own photos (1600 px or wider) through the media library.
- Some photos show other organisations' kit, such as a West Point vest, sponsor boards and small brand logos. A few show named athletes at competitions. Swap these for the academy's own photos when you can.
- Coach cards show a monogram until you upload a real, consented photo. Don't use stock photos of strangers as coaches.

> All names, numbers, fees, testimonials and stories are demo placeholders. The privacy and safeguarding pages are templates that need review. Replace both before launch.

## Hosting

Any Node 18+ host works, for example a VPS with PM2 and Nginx, Render, Railway or DigitalOcean. Put it behind HTTPS and set `COOKIE_SECURE=1` and `TRUST_PROXY=1`.

## Files

- `server/index.js`: app setup, admin content API
- `server/routes/public.js`: forms, trial slots, one-time codes, booking, payments, webhook, privacy requests
- `server/routes/portal.js`, `server/views/portal.js`: parent portal
- `server/routes/admin-ops.js`: students, attendance, fitness, feedback, invoices, bookings, messages, privacy
- `server/billing.js` (invoices, GST, sibling discount, reminders, scheduler), `server/payments.js` (Razorpay), `server/notify.js` (WhatsApp/email), `server/academy.js` (seats, waiting list, slots), `server/otp.js`, `server/reviews.js`
- `server/seed-ops.js`: version-2 demo data and migration
- `server/pdf.js`, `server/fonts/`: PDF invoices/receipts and reports (fonts under the SIL Open Font License)
- `server/schema.js`: content types and settings (this drives the admin)
- `server/texts.js`: page copy with defaults
- `server/seed.js`: demo content for the first start
- `server/views/`: server-rendered pages (`html` tagged template with auto-escaping)
- `server/store.js`, `server/auth.js`, `server/content.js`: storage, auth and validation
- `public/css/site.css`: the design (tokens at the top)
- `public/js/boot.js`, `public/js/site.js`: motion and interactions
- `admin/`: the admin panel (no build step); `admin/ops.js` has the operations screens
- `public/js/ops.js`, `public/js/pay.js`: booking, trial picker, one-time codes, portal actions, checkout
- `public/css/ops.css`, `public/css/print.css`: portal/booking styles and the printable documents
- `scripts/vendor.js`: copies GSAP and Lenis from `node_modules` into `public/vendor`
