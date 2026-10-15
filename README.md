# Vega Sports Academy: website and CMS

A dynamic website for a multi-sport academy (fictional client: Vega Sports Academy, Jagatpura, Jaipur), with a full admin panel. It runs on Node.js and Express and stores data in a JSON file. There is no build step, and the browser code is plain JavaScript.

## Run

```bash
npm install
npm start            # http://localhost:3000   admin: http://localhost:3000/admin/
npm test             # API, auth and rendering checks
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

Home · About (story, values, timeline, facilities) · Programs (index with hover previews, plus cards) · Program detail (facts bar, overview, curriculum stages, batches with seats left, coaches, free-trial form, next program) · Coaches (filter by sport) · Schedule (weekly timetable with day tabs on phones, filter by sport, full batch list) · Gallery (filter and lightbox) · Stories & events (featured story, upcoming events, archive, article pages) · Admissions (steps, fee plans, a 3-step admission form, free-trial form, FAQ) · Contact (details, form, map) · custom pages created in the admin (`/<slug>`) · photo credits · 404. It also serves `sitemap.xml`, `robots.txt` and Schema.org `SportsActivityLocation` data.

## Admin panel (CMS)

- **Dashboard**: new trials, admissions and enquiries; subscribers; seats left; a 14-day submissions chart; latest leads; content counts; recent activity.
- **Leads & forms**: free trials, admissions, enquiries and newsletter sign-ups. Each list has search and a status filter (new, contacted, scheduled, enrolled, closed). Opening a lead gives internal notes and one-click call, WhatsApp and email. Every list exports to CSV.
- **Content**: programs, schedule and batches, coaches, facilities, fee plans, news and stories, events, gallery, testimonials, numbers, timeline, pathway steps, FAQs and custom pages. You can add, edit, delete, hide or show, and drag to reorder. Program and story pages have a "view on site" link. Images are picked from the media library.
- **Page text**: every heading, paragraph and button on every page, grouped by page, with the default shown and "reset to default".
- **Home sections**: show or hide any home section.
- **Media library**: drag-and-drop upload (JPG, PNG, WebP, GIF, AVIF, up to 8 MB), alt text, copy URL. Deleting an image that is still in use asks you first.
- **Settings**: name, contact details, WhatsApp, hours, map, social links, accent colours, intro animation, announcement bar, opening and closing the admission and trial forms, SEO and share image, footer note.
- **Users and roles**: Admin (everything), Editor (content and leads), Front desk (leads only). There is also an activity log.

The forms and lists are generated from `server/schema.js`. To add a field or a whole content type, describe it there and the admin panel picks it up. The page copy and its defaults are in `server/texts.js`.

## Security

- Passwords are hashed with scrypt.
- Sessions use an HttpOnly, SameSite=Strict cookie, and every admin write needs a CSRF header.
- Sign-in and the public forms are rate limited, and the forms have a honeypot field.
- All output is escaped, and Markdown is sanitised.
- Uploads are limited to image types, and their file signatures are checked.
- CSV export is protected against formula injection.
- The site sends a Content Security Policy and other security headers.

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

- `server/index.js`: routes, form API and admin API
- `server/schema.js`: content types and settings (this drives the admin)
- `server/texts.js`: page copy with defaults
- `server/seed.js`: demo content for the first start
- `server/views/`: server-rendered pages (`html` tagged template with auto-escaping)
- `server/store.js`, `server/auth.js`, `server/content.js`: storage, auth and validation
- `public/css/site.css`: the design (tokens at the top)
- `public/js/boot.js`, `public/js/site.js`: motion and interactions
- `admin/`: the admin panel (no build step)
- `scripts/vendor.js`: copies GSAP and Lenis from `node_modules` into `public/vendor`
