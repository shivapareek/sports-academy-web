// Every fixed piece of copy on the public pages. The admin "Page text" screen
// lists these fields; an empty or missing edit falls back to the default here.
// In titles, a line break starts a new line and *word* gets the highlight colour.

const T = (key, label, def, type = 'text') => ({ key, label, default: def, type });

const groups = [
  {
    id: 'home',
    label: 'Home',
    fields: [
      T('home.hero.eyebrow', 'Hero: small label', 'Multi-sport academy · Jaipur'),
      T('home.hero.title', 'Hero: headline', 'Train for\nthe *final*\nwhistle.', 'textarea'),
      T('home.hero.text', 'Hero: paragraph', 'Nine sports, thirty-eight coaches and one honest system for getting better every single week. From a first catch at six to a state trial at sixteen.', 'textarea'),
      T('home.hero.cta1', 'Hero: main button', 'Book a free trial'),
      T('home.hero.cta2', 'Hero: second button', 'Explore programs'),
      T('home.hero.clock', 'Hero: clock label', 'Session clock'),
      T('home.hero.ticker', 'Hero: ticker words', 'Cricket · Football · Badminton · Swimming · Athletics · Basketball · Tennis · Table tennis · Strength & conditioning', 'textarea'),
      T('home.manifesto.eyebrow', 'Manifesto: label', 'Our approach'),
      T('home.manifesto.text', 'Manifesto: text', 'Talent gets you noticed. Habits get you selected. We coach the boring things brilliantly: footwork, recovery, sleep, nerve. Every athlete gets a plan, a coach who knows their name, and a number that tells them if they are actually getting better.', 'textarea'),
      T('home.stats.eyebrow', 'Numbers: label', 'The scoreboard'),
      T('home.programs.eyebrow', 'Programs: label', 'Programs'),
      T('home.programs.title', 'Programs: title', 'Pick your *game*.', 'textarea'),
      T('home.programs.text', 'Programs: text', 'Structured batches for every age and level, coached by people who have played at the level you want to reach.', 'textarea'),
      T('home.method.eyebrow', 'Pathway: label', 'The Vega pathway'),
      T('home.method.title', 'Pathway: title', 'Four stages.\nOne *direction*.', 'textarea'),
      T('home.method.text', 'Pathway: text', 'Every athlete is assessed in their first fortnight and placed on the pathway. Progress is reviewed every 8 weeks with parents.', 'textarea'),
      T('home.facilities.eyebrow', 'Facilities: label', 'The grounds'),
      T('home.facilities.title', 'Facilities: title', 'Seven acres built\nfor *repetition*.', 'textarea'),
      T('home.coaches.eyebrow', 'Coaches: label', 'Coaches'),
      T('home.coaches.title', 'Coaches: title', 'People who have\n*been there*.', 'textarea'),
      T('home.testimonials.eyebrow', 'Testimonials: label', 'From the stands'),
      T('home.trial.eyebrow', 'Trial: label', 'Free trial'),
      T('home.trial.title', 'Trial: title', 'Your first session\nis *on us*.', 'textarea'),
      T('home.trial.text', 'Trial: text', 'Pick a sport and a day. A coach will assess your child (or you), walk you through the batch and answer every question. No fee, no pressure.', 'textarea'),
      T('home.news.eyebrow', 'Stories: label', 'From the academy'),
      T('home.news.title', 'Stories: title', 'Latest *stories*.', 'textarea'),
      T('home.cta.title', 'Closing: title', 'Ready when\nyou *are*.', 'textarea'),
      T('home.cta.text', 'Closing: text', 'Admissions for the new term are open across all nine sports.', 'textarea'),
      T('home.cta.button', 'Closing: button', 'Start admission'),
    ],
  },
  {
    id: 'about',
    label: 'About',
    fields: [
      T('about.eyebrow', 'Header: label', 'About Vega'),
      T('about.title', 'Header: title', 'We build\n*athletes*, not\njust players.', 'textarea'),
      T('about.intro', 'Header: intro', 'Vega started in 2011 with one cricket net, two coaches and eleven kids on a borrowed ground in Mansarovar. Today it is a seven-acre campus where more than a thousand athletes train every week.', 'textarea'),
      T('about.story.title', 'Story: title', 'Why *Vega*?', 'textarea'),
      T('about.story.text', 'Story: text', '*Vega* is Sanskrit for speed, but what we really chase is momentum: the small, repeatable gains that add up over a season. Our coaches plan every session against a written curriculum, measure what matters, and talk to parents like partners.\n\nWe care as much about how a child loses as how they win. Sport is the best school for character we know of, and we take that responsibility seriously.', 'textarea'),
      T('about.values.title', 'Values: title', 'What we *stand for*.', 'textarea'),
      T('about.values', 'Values (one per line, "Title: text")', 'Show up: Consistency beats intensity. We reward attendance, effort and preparation.\nCoach the person: Every athlete is a person first, an athlete second and a scorecard last.\nMeasure honestly: Fitness tests every 8 weeks, video reviews and written reports. No guessing.\nPlay fair: Respect for opponents, officials and teammates is non-negotiable.', 'textarea'),
      T('about.timeline.title', 'Timeline: title', 'The *journey* so far.', 'textarea'),
    ],
  },
  {
    id: 'programs',
    label: 'Programs',
    fields: [
      T('programs.eyebrow', 'Header: label', 'Programs'),
      T('programs.title', 'Header: title', 'Nine sports.\nOne *standard*.', 'textarea'),
      T('programs.intro', 'Header: intro', 'Every program follows the Vega pathway, from foundation skills to competition prep. Pick a sport to see batches, coaches and fees.', 'textarea'),
      T('program.batches.title', 'Program page: batches title', 'Batches & timings'),
      T('program.coaches.title', 'Program page: coaches title', 'Your coaches'),
      T('program.cta', 'Program page: button', 'Book a free trial'),
    ],
  },
  {
    id: 'coaches',
    label: 'Coaches',
    fields: [
      T('coaches.eyebrow', 'Header: label', 'Coaches'),
      T('coaches.title', 'Header: title', 'The people\nbehind the *progress*.', 'textarea'),
      T('coaches.intro', 'Header: intro', 'Certified, background-verified and still obsessed with their sport. Our coach-to-athlete ratio never goes above 1:12.', 'textarea'),
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    fields: [
      T('schedule.eyebrow', 'Header: label', 'Schedule'),
      T('schedule.title', 'Header: title', 'Find your\n*batch*.', 'textarea'),
      T('schedule.intro', 'Header: intro', 'Morning and evening batches, six days a week. Seats are limited so every athlete gets real attention.', 'textarea'),
    ],
  },
  {
    id: 'gallery',
    label: 'Gallery',
    fields: [
      T('gallery.eyebrow', 'Header: label', 'Gallery'),
      T('gallery.title', 'Header: title', 'Sweat, in\n*high resolution*.', 'textarea'),
      T('gallery.intro', 'Header: intro', 'Training days, match days and everything in between.', 'textarea'),
    ],
  },
  {
    id: 'news',
    label: 'News',
    fields: [
      T('news.eyebrow', 'Header: label', 'Stories & events'),
      T('news.title', 'Header: title', 'Notes from\nthe *sidelines*.', 'textarea'),
      T('news.intro', 'Header: intro', 'Results, selections, training ideas and what is coming up on the calendar.', 'textarea'),
      T('news.events.title', 'Events title', 'Upcoming *events*', 'textarea'),
    ],
  },
  {
    id: 'admissions',
    label: 'Admissions',
    fields: [
      T('admissions.eyebrow', 'Header: label', 'Admissions'),
      T('admissions.title', 'Header: title', 'Join the\n*squad*.', 'textarea'),
      T('admissions.intro', 'Header: intro', 'Three steps and you are on the field. Fill the form, attend a short assessment, pick your batch.', 'textarea'),
      T('admissions.steps', 'Steps (one per line, "Title: text")', 'Apply online: Takes four minutes. Tell us about the athlete and the sport.\nAssessment: A free 45-minute session with a coach to find the right level.\nPick a batch: Choose timings and a fee plan. Kit list arrives on WhatsApp.\nFirst whistle: Welcome pack, fitness baseline and your first real session.', 'textarea'),
      T('admissions.plans.title', 'Fees title', 'Simple, honest *fees*.', 'textarea'),
      T('admissions.plans.text', 'Fees text', 'One-time registration of ₹1,500 includes kit bag, training tee and the baseline fitness test. Sibling discount of 10%.', 'textarea'),
      T('admissions.form.title', 'Form title', 'Admission form'),
      T('admissions.closed', 'Message when admissions are closed', 'Admissions for this term are full. Leave your details on the contact page and we will call you when seats open.', 'textarea'),
      T('admissions.faq.title', 'FAQ title', 'Questions parents *ask*.', 'textarea'),
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    fields: [
      T('contact.eyebrow', 'Header: label', 'Contact'),
      T('contact.title', 'Header: title', 'Come say\n*hello*.', 'textarea'),
      T('contact.intro', 'Header: intro', 'Visit the campus any morning, call the front desk or drop us a message. We reply within one working day.', 'textarea'),
    ],
  },
  {
    id: 'common',
    label: 'Header & footer',
    fields: [
      T('nav.cta', 'Header button', 'Free trial'),
      T('footer.newsletter.title', 'Newsletter title', 'Training notes, once a month.'),
      T('footer.newsletter.text', 'Newsletter text', 'Drills, nutrition tips and academy news. No spam.', 'textarea'),
      T('form.success', 'Form success message', 'Thank you! Our team will call you within one working day.', 'textarea'),
    ],
  },
];

const defaults = {};
for (const g of groups) for (const f of g.fields) defaults[f.key] = f.default;

module.exports = { groups, defaults };
