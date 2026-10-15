// Demo content for the first start. Names, numbers and stories are fictional
// placeholders for the academy to replace in the admin panel.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { hashPassword } = require('./auth');

const MANIFEST = path.join(__dirname, '..', 'public', 'img', 'manifest.json');

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return [];
  }
}

function seed() {
  const manifest = loadManifest();
  const used = new Set();
  // Pick an image by slot (and sport), preferring ones not used yet.
  const pick = (slot, sport) => {
    const pool = manifest.filter((m) => m.slot === slot && (!sport || m.sport === sport));
    const item = pool.find((m) => !used.has(m.file)) || pool[0];
    if (!item) return '';
    used.add(item.file);
    return '/img/' + item.file;
  };
  const any = (sport) => pick('program', sport) || pick('hero', sport) || pick('gallery', sport) || pick('gallery') || '';
  const id = store.id;
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const P = (o) => ({ id: id('p_'), published: true, featured: false, ...o });
  const programs = [
    P({ name: 'Cricket', slug: 'cricket', sport: 'Cricket', tagline: 'Turf wickets, bowling machines and video analysis.', summary: 'Batting, bowling, keeping and match craft on six turf nets and a full-size ground.', ages: '7–19 yrs · Adults', level: 'All levels', sessions: '5 sessions / week · 2 hrs', feeMonthly: 3200, featured: true,
      highlights: ['Six turf and two astro nets', 'Bowling machine and side-arm sessions', 'Video analysis every fortnight', 'Weekend practice matches and league fixtures'],
      curriculum: ['Foundations: Grip, stance, backlift, bowling action and safe fielding', 'Development: Shot selection, line and length, running between wickets', 'Performance: Match scenarios, pace handling, spin variations, fitness blocks', 'Elite: Trial preparation, mental skills, workload management'],
      description: 'Our cricket program is built around **turf time**. Every batter faces real bowling every session, and every bowler bowls to a plan with a target.\n\nBatches are split by age and level after a free assessment. Seniors play weekend fixtures in the Jaipur district league, and selected athletes join the high-performance squad that trains with strength and conditioning coaches three times a week.' }),
    P({ name: 'Football', slug: 'football', sport: 'Football', tagline: 'Possession, pressing and a lot of touches.', summary: 'Small-sided games and positional play on a FIFA-quality artificial pitch under floodlights.', ages: '6–18 yrs · Adults', level: 'All levels', sessions: '4 sessions / week · 90 min', feeMonthly: 2600, featured: true,
      highlights: ['FIFA Quality artificial turf with floodlights', 'AIFF licensed coaches', 'Monthly inter-academy fixtures', 'Separate girls’ batches'],
      curriculum: ['Foundations: Ball mastery, coordination, 1v1 confidence', 'Development: Passing patterns, receiving on the half-turn, rondos', 'Performance: Pressing triggers, transitions, set pieces', 'Elite: Position-specific work, match analysis, trials'],
      description: 'More touches, more decisions, more fun. Sessions are game-based: players spend most of their time with a ball at their feet solving real football problems.\n\nWe run separate girls’ batches and play monthly fixtures against academies across Rajasthan.' }),
    P({ name: 'Badminton', slug: 'badminton', sport: 'Badminton', tagline: 'Eight wooden courts. Zero excuses.', summary: 'Footwork, stroke play and match tactics on synthetic-mat wooden courts.', ages: '6–18 yrs · Adults', level: 'All levels', sessions: '5 sessions / week · 2 hrs', feeMonthly: 2800, featured: true,
      highlights: ['8 BWF-spec synthetic-mat courts', 'Multi-feed and shadow footwork drills', 'Ranking tournaments every quarter', 'Adult evening batches'],
      curriculum: ['Foundations: Grip, ready position, basic clears and serves', 'Development: Six-corner footwork, net play, smash and defence', 'Performance: Doubles rotations, deception, tactical patterns', 'Elite: Periodised training, tournament travel, video scouting'],
      description: 'Badminton is a footwork sport disguised as a racquet sport. Every batch starts with structured movement work before a single shuttle is hit.\n\nAthletes are ranked internally every quarter, and our top juniors compete in district and state ranking events.' }),
    P({ name: 'Swimming', slug: 'swimming', sport: 'Swimming', tagline: 'Learn to swim. Then learn to race.', summary: 'Learn-to-swim through competitive squads in a heated 25 m, 8-lane pool.', ages: '5–18 yrs · Adults', level: 'All levels', sessions: '5 sessions / week · 60–90 min', feeMonthly: 3000, featured: true,
      highlights: ['Heated 25 m, 8-lane pool, open all year', 'Lifeguard on deck for every session', 'Stroke correction with underwater video', 'Learn-to-swim for adults'],
      curriculum: ['Foundations: Water confidence, floating, kicking, breathing', 'Development: All four strokes, turns and starts', 'Performance: Interval training, pacing, race skills', 'Elite: Dry-land strength, taper planning, state meets'],
      description: 'From a child’s first float to a sub-minute 100 m freestyle. Groups are small, lanes are coached separately, and a certified lifeguard is on deck for every session.' }),
    P({ name: 'Athletics', slug: 'athletics', sport: 'Athletics', tagline: 'Faster, higher, stronger, measured.', summary: 'Sprints, middle distance, jumps and throws on a 400 m synthetic track with electronic timing.', ages: '8–19 yrs', level: 'Beginner', sessions: '5 sessions / week · 2 hrs', feeMonthly: 2400, featured: true,
      highlights: ['400 m, 8-lane synthetic track', 'Electronic timing gates', 'Long jump, high jump and throws area', 'Monthly time trials'],
      curriculum: ['Foundations: Running mechanics, coordination, fun relays', 'Development: Event sampling across sprints, jumps and throws', 'Performance: Event specialisation, block starts, technique', 'Elite: Periodisation, competition calendar, recovery'],
      description: 'Athletics is the base of every sport. Younger athletes sample every event; older ones specialise with a coach who plans their whole season.\n\nTiming gates mean every rep has a number, and every number goes into the athlete’s progress report.' }),
    P({ name: 'Basketball', slug: 'basketball', sport: 'Basketball', tagline: 'Handles, IQ and a lot of conditioning.', summary: 'Fundamentals, team systems and 3x3 on two indoor maple courts.', ages: '8–18 yrs · Adults', level: 'All levels', sessions: '4 sessions / week · 90 min', feeMonthly: 2600, featured: true,
      highlights: ['Two indoor courts with FIBA hoops', '3x3 leagues every season', 'Shooting machine sessions', 'Strength block twice a week'],
      curriculum: ['Foundations: Dribbling, footwork, layups and form shooting', 'Development: Pick and roll, help defence, spacing', 'Performance: Team systems, press break, game management', 'Elite: Position work, film study, scouting'],
      description: 'We teach the game, not just the drills. Players learn to read the floor, communicate and compete, with a strong focus on fundamentals.' }),
    P({ name: 'Tennis', slug: 'tennis', sport: 'Tennis', tagline: 'Hard courts, clay court, real rallies.', summary: 'Technique and match play across four hard courts and one clay court.', ages: '6–18 yrs · Adults', level: 'All levels', sessions: '4 sessions / week · 90 min', feeMonthly: 3400,
      highlights: ['Four hard courts and one clay court', 'Ball machine and video analysis', 'AITA tournament guidance', 'Ladder matches every weekend'],
      curriculum: ['Foundations: Red and orange ball, rally skills, footwork', 'Development: Green ball, serve technique, consistency', 'Performance: Point construction, patterns of play', 'Elite: AITA tournament plan, fitness, mental skills'],
      description: 'Juniors start with red and orange balls on smaller courts, so they rally from the first day. Weekend ladder matches keep everyone competing.' }),
    P({ name: 'Table Tennis', slug: 'table-tennis', sport: 'Table Tennis', tagline: 'Reflexes, spin and nerve.', summary: 'Multi-ball training and match play on twelve ITTF-approved tables.', ages: '7–18 yrs · Adults', level: 'All levels', sessions: '4 sessions / week · 90 min', feeMonthly: 2000,
      highlights: ['12 ITTF-approved tables', 'Robot and multi-ball sessions', 'Monthly in-house ranking', 'Adult recreational batch'],
      curriculum: ['Foundations: Grip, stance, push and drive', 'Development: Loops, serve variations, footwork', 'Performance: Third-ball attack, tactics', 'Elite: Tournament preparation, mental routines'],
      description: 'A fast, technical sport where small improvements show up immediately. Multi-ball training gives players hundreds of quality reps every session.' }),
    P({ name: 'Strength & Conditioning', slug: 'strength-conditioning', sport: 'Fitness', tagline: 'The engine behind every sport.', summary: 'Age-appropriate strength, speed and injury-prevention work for athletes and adults.', ages: '12+ yrs · Adults', level: 'All levels', sessions: '3 sessions / week · 60 min', feeMonthly: 2200,
      highlights: ['Fully equipped performance gym', 'Movement screening on day one', 'Physio on campus three days a week', 'Adult fitness batches'],
      curriculum: ['Foundations: Movement quality, bodyweight strength, mobility', 'Development: Technique with load, plyometrics, speed', 'Performance: Sport-specific power, conditioning', 'Elite: Periodised blocks, testing, return-to-play'],
      description: 'Strong athletes get injured less and improve faster. Every athlete is screened on day one and follows a program written for their age, sport and season.' }),
  ];
  for (const p of programs) {
    const key = p.slug === 'strength-conditioning' ? 'fitness' : p.slug === 'table-tennis' ? 'table tennis' : p.slug;
    p.laneImage = p.featured ? pick('hero', key) : '';
    p.image = pick('program', key) || any(key);
    p.heroImage = '';
  }
  const pid = (slug) => programs.find((p) => p.slug === slug).id;

  const C = (o) => ({ id: id('c_'), published: true, photo: '', ...o });
  const coaches = [
    C({ name: 'Rakesh Choudhary', role: 'Head Coach, Cricket', program: pid('cricket'), experience: 19, credentials: ['BCCI Level 2 coach', 'Former Ranji Trophy fast bowler', 'NCA high-performance course'], bio: 'Played nine seasons of first-class cricket before turning to coaching. Known for building fast bowlers who stay fit.', quote: 'Bowl to a plan, every single ball.' }),
    C({ name: 'Ananya Bhatt', role: 'Head Coach, Badminton', program: pid('badminton'), experience: 12, credentials: ['BAI Level 2 coach', 'Former state champion (U-19)', 'Sports science graduate'], bio: 'A former national-ranked junior who coaches footwork first and smashes later.', quote: 'Win the footwork and the shot takes care of itself.' }),
    C({ name: 'Imran Qureshi', role: 'Head Coach, Football', program: pid('football'), experience: 14, credentials: ['AIFF C Licence', 'Former I-League midfielder', 'Grassroots instructor'], bio: 'Runs our boys’ and girls’ football programs with a big focus on game-based learning.', quote: 'The ball is the best teacher. Give it to them.' }),
    C({ name: 'Meera Rathore', role: 'Head Coach, Swimming', program: pid('swimming'), experience: 11, credentials: ['SFI certified coach', 'Lifeguard and first-aid instructor', 'National Games finalist'], bio: 'Teaches everyone from nervous five-year-olds to state-level age-groupers.', quote: 'Calm in the water is fast in the water.' }),
    C({ name: 'Vikram Shekhawat', role: 'Head Coach, Athletics', program: pid('athletics'), experience: 16, credentials: ['World Athletics Level 2', 'Former 400 m national medallist', 'Strength and conditioning certified'], bio: 'Builds sprinters and jumpers with patient, data-led training blocks.', quote: 'Measure everything. Celebrate the small numbers.' }),
    C({ name: 'Sarah D’Souza', role: 'Head Coach, Basketball', program: pid('basketball'), experience: 9, credentials: ['FIBA Level 1', 'Former Rajasthan state captain'], bio: 'Teaches the game through spacing, communication and relentless defence.', quote: 'Talk on defence. Every possession.' }),
    C({ name: 'Arjun Mehta', role: 'Head Coach, Tennis', program: pid('tennis'), experience: 13, credentials: ['AITA certified coach', 'ITF Play Tennis tutor'], bio: 'Plays the long game with juniors: technique, temperament, then tournaments.', quote: 'Make one more ball than your opponent.' }),
    C({ name: 'Dr. Kavita Jain', role: 'Lead, Strength & Physio', program: pid('strength-conditioning'), experience: 10, credentials: ['MPT (Sports)', 'NSCA-CSCS', 'Return-to-play specialist'], bio: 'Screens every new athlete and leads injury prevention across all sports.', quote: 'Strong is the best injury prevention there is.' }),
  ];
  const cid = (name) => coaches.find((c) => c.name.startsWith(name)).id;

  const B = (program, name, days, start, end, ages, level, coach, venue, seats, seatsLeft) => ({ id: id('b_'), published: true, program: pid(program), name, days, start, end, ages, level, coach: coach ? cid(coach) : '', venue, seats, seatsLeft });
  const MWF = ['Mon', 'Wed', 'Fri'];
  const TTS = ['Tue', 'Thu', 'Sat'];
  const WK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const batches = [
    B('cricket', 'U-12 Foundation', TTS, '06:30', '08:30', '7–12 yrs', 'Beginner', 'Rakesh', 'Nets 1–3', 24, 6),
    B('cricket', 'U-16 Development', WK, '16:00', '18:00', '12–16 yrs', 'Intermediate', 'Rakesh', 'Main ground', 24, 3),
    B('cricket', 'High Performance', WK, '06:00', '08:30', '15–19 yrs', 'Elite', 'Rakesh', 'Main ground', 16, 1),
    B('football', 'Mini Kickers', ['Sat', 'Sun'], '08:00', '09:00', '6–9 yrs', 'Beginner', 'Imran', 'Turf pitch', 20, 8),
    B('football', 'U-14 Squad', MWF, '17:00', '18:30', '10–14 yrs', 'Intermediate', 'Imran', 'Turf pitch', 22, 5),
    B('football', 'Girls’ Football', TTS, '17:00', '18:30', '10–17 yrs', 'All levels', 'Imran', 'Turf pitch', 20, 9),
    B('badminton', 'Juniors Foundation', MWF, '16:00', '17:30', '6–11 yrs', 'Beginner', 'Ananya', 'Indoor hall A', 16, 4),
    B('badminton', 'Competitive Juniors', WK, '05:30', '07:30', '11–18 yrs', 'Advanced', 'Ananya', 'Indoor hall A', 16, 2),
    B('badminton', 'Adults Evening', TTS, '19:30', '21:00', 'Adults', 'All levels', 'Ananya', 'Indoor hall A', 16, 7),
    B('swimming', 'Learn to Swim', TTS, '07:00', '08:00', '5–10 yrs', 'Beginner', 'Meera', 'Aquatic centre', 12, 3),
    B('swimming', 'Age-group Squad', WK, '05:30', '07:00', '10–18 yrs', 'Advanced', 'Meera', 'Aquatic centre', 18, 4),
    B('swimming', 'Adult Learn to Swim', ['Sat', 'Sun'], '07:30', '08:30', 'Adults', 'Beginner', 'Meera', 'Aquatic centre', 10, 5),
    B('athletics', 'Junior Athletics', MWF, '06:30', '08:00', '8–12 yrs', 'Beginner', 'Vikram', 'Synthetic track', 25, 10),
    B('athletics', 'Sprint & Jumps Squad', WK, '16:30', '18:30', '13–19 yrs', 'Advanced', 'Vikram', 'Synthetic track', 20, 3),
    B('basketball', 'Hoops Foundation', TTS, '16:00', '17:30', '8–12 yrs', 'Beginner', 'Sarah', 'Indoor court 1', 20, 6),
    B('basketball', 'U-17 Team', MWF, '18:00', '19:30', '13–17 yrs', 'Intermediate', 'Sarah', 'Indoor court 1', 18, 4),
    B('tennis', 'Red & Orange Ball', ['Sat', 'Sun'], '07:00', '08:30', '6–10 yrs', 'Beginner', 'Arjun', 'Courts 1–2', 12, 4),
    B('tennis', 'Junior Performance', WK, '16:00', '17:30', '11–18 yrs', 'Advanced', 'Arjun', 'Courts 3–5', 12, 2),
    B('table-tennis', 'TT All Levels', TTS, '17:30', '19:00', '7+ yrs', 'All levels', '', 'TT hall', 24, 11),
    B('strength-conditioning', 'Athlete Strength', MWF, '19:00', '20:00', '12–19 yrs', 'All levels', 'Dr. Kavita', 'Performance gym', 15, 5),
    B('strength-conditioning', 'Adult Fitness', TTS, '06:30', '07:30', 'Adults', 'All levels', 'Dr. Kavita', 'Performance gym', 15, 6),
  ];

  const F = (name, description, key, specs) => ({ id: id('f_'), published: true, name, description, image: pick('facility', key) || pick('facility') || any(), specs });
  const facilities = [
    F('Main cricket ground', 'A full-size ground with a centre square of seven turf wickets and a pavilion.', 'ground', ['70 m boundaries', '7 turf wickets', '6 turf + 2 astro nets']),
    F('Aquatic centre', 'Heated, filtered and covered, so the season never stops.', 'pool', ['25 m · 8 lanes', 'Heated year-round', 'Lifeguard on deck']),
    F('Indoor sports hall', 'Eight badminton courts and two basketball courts under one sprung roof.', 'court', ['8 badminton courts', '2 basketball courts', 'LED sports lighting']),
    F('Performance gym', 'Olympic lifting platforms, sleds, and a physio room next door.', 'gym', ['6 lifting platforms', 'Physio & recovery room', 'Movement screening lab']),
    F('Synthetic track', 'World Athletics-spec surface with timing gates and a jumps and throws area.', 'track', ['400 m · 8 lanes', 'Electronic timing', 'Jumps & throws area']),
  ];

  const plans = [
    { id: id('pl_'), published: true, name: 'Monthly', price: 2800, period: '/ month', note: 'Average across sports. See each program for exact fees.', features: ['4–5 coached sessions a week', 'Fitness baseline test', 'Parent WhatsApp updates'], featured: false },
    { id: id('pl_'), published: true, name: 'Quarterly', price: 7600, period: '/ quarter', note: 'Save about 10%', features: ['Everything in Monthly', 'Video analysis every fortnight', '8-week progress report', 'Priority for tournaments'], featured: true },
    { id: id('pl_'), published: true, name: 'Annual', price: 27000, period: '/ year', note: 'Save about 20%', features: ['Everything in Quarterly', 'Two free summer camp weeks', 'Annual sports-science assessment', 'Academy kit set'], featured: false },
  ];

  const posts = [
    { id: id('n_'), published: true, title: 'Four Vega cricketers picked for the Rajasthan U-16 camp', slug: 'four-cricketers-rajasthan-u16-camp', category: 'Achievement', date: day(-6), author: 'Academy desk', cover: pick('gallery', 'cricket') || any('cricket'),
      excerpt: 'Two fast bowlers, a keeper and an opening batter from our High Performance batch made the 30-player probables list.',
      body: 'Four athletes from our High Performance cricket batch have been named in the Rajasthan U-16 probables for the winter camp.\n\n## What made the difference\n\nHead coach Rakesh Choudhary credits the workload plan introduced last season: every bowler had a written weekly ball count, and strength sessions twice a week.\n\n> "None of them is the most talented kid we have ever coached. All of them are the most consistent."\n\nThe camp begins next month in Jaipur. We wish all four the very best.' },
    { id: id('n_'), published: true, title: 'Why we test fitness every eight weeks', slug: 'why-we-test-fitness-every-eight-weeks', category: 'Training', date: day(-15), author: 'Dr. Kavita Jain', cover: pick('gallery', 'athletics') || pick('gallery') || any(),
      excerpt: 'Sprint times, jumps and a simple beep test tell us more about a young athlete than any match score.',
      body: 'Every eight weeks, every athlete at Vega goes through the same short battery of tests: a 20 m sprint, a standing broad jump, a plank hold and a beep test.\n\n## Why it matters\n\n- **It is honest.** Match results depend on the opponent. A sprint time does not.\n- **It is motivating.** Children love seeing their own numbers improve.\n- **It keeps them safe.** Sudden drops often show fatigue or an injury coming.\n\nParents receive the results in the 8-week report along with the coach’s notes.' },
    { id: id('n_'), published: true, title: 'Girls’ football batch doubles in its first year', slug: 'girls-football-batch-doubles', category: 'News', date: day(-27), author: 'Imran Qureshi', cover: pick('gallery', 'football') || any('football'),
      excerpt: 'Started with eleven players last October. Twenty-four now train three evenings a week.',
      body: 'When we started a dedicated girls’ football batch last October, eleven players turned up. Today there are twenty-four, and a waiting list.\n\nThe batch plays its first inter-academy tournament next month. Trials for new players are open every Saturday.' },
    { id: id('n_'), published: true, title: 'Summer swim meet: 31 personal bests in one morning', slug: 'summer-swim-meet-personal-bests', category: 'Event recap', date: day(-48), author: 'Meera Rathore', cover: pick('gallery', 'swimming') || any('swimming'),
      excerpt: 'Our annual in-house meet saw 86 swimmers race, from first-time 25 m finishers to state qualifiers.',
      body: 'Eighty-six swimmers, four strokes and thirty-one personal bests. Our annual summer meet is the morning the whole academy comes to watch.\n\nThe loudest cheer of the day went to the Learn to Swim group, who swam their first full length without stopping.' },
  ];

  const events = [
    { id: id('e_'), published: true, title: 'Open trials: High Performance cricket', date: day(12), time: '7:00 AM', venue: 'Main ground', sport: 'Cricket', description: 'Selection trials for the 15–19 High Performance squad. Bring whites and your own kit.', link: '' },
    { id: id('e_'), published: true, title: 'Vega Winter Badminton Open', date: day(26), time: '8:30 AM', venue: 'Indoor hall A', sport: 'Badminton', description: 'U-11, U-13, U-15 and U-17 singles. Open to players from all academies.', link: '' },
    { id: id('e_'), published: true, title: 'Parents’ workshop: nutrition for young athletes', date: day(40), time: '10:00 AM', venue: 'Seminar room', sport: 'All sports', description: 'A practical session with our sports nutritionist. Free for Vega families.', link: '' },
  ];

  const galleryItems = manifest
    .filter((m) => m.slot === 'gallery' || m.slot === 'about')
    .map((m, i) => ({ id: id('g_'), published: true, image: '/img/' + m.file, caption: m.caption || capitalise(m.sport || 'Training day'), alt: m.alt || '', sport: capitalise(m.sport || 'Academy'), shape: i % 5 === 0 ? 'tall' : i % 7 === 3 ? 'wide' : 'normal' }));

  const testimonials = [
    { id: id('t_'), published: true, name: 'Neha Agarwal', role: 'Parent of an U-12 badminton player', quote: 'The 8-week reports are the best thing. For the first time I actually understand what my daughter is working on and why.' },
    { id: id('t_'), published: true, name: 'Rohit Saini', role: 'U-19 cricketer, High Performance batch', quote: 'Coach planned my bowling workload for the whole season. Zero injuries and fifteen wickets more than last year.' },
    { id: id('t_'), published: true, name: 'Priya & Anil Sharma', role: 'Parents of two swimmers', quote: 'Our son was scared of water. A year later he is swimming in the age-group squad. The coaches are patient and incredibly safe.' },
    { id: id('t_'), published: true, name: 'Kunal Verma', role: 'Adult badminton batch', quote: 'I joined at 38 to get fit. I stayed because the evenings are the best part of my week.' },
  ];

  const stats = [
    { id: id('s_'), published: true, value: 1200, suffix: '+', label: 'Athletes training every week' },
    { id: id('s_'), published: true, value: 38, suffix: '', label: 'Certified coaches' },
    { id: id('s_'), published: true, value: 64, suffix: '', label: 'State & national selections' },
    { id: id('s_'), published: true, value: 7, suffix: ' acres', label: 'Of fields, courts and pools' },
  ];

  const milestones = [
    { id: id('m_'), published: true, year: '2011', title: 'One net, eleven kids', text: 'Vega starts as a weekend cricket clinic on a borrowed ground in Mansarovar.' },
    { id: id('m_'), published: true, year: '2014', title: 'A home of our own', text: 'The first three acres: a cricket ground, four nets and a clubhouse.' },
    { id: id('m_'), published: true, year: '2017', title: 'Indoor hall opens', text: 'Badminton and basketball arrive, and so do our first state-level medals.' },
    { id: id('m_'), published: true, year: '2020', title: 'Pool and track', text: 'The aquatic centre and synthetic track complete the seven-acre campus.' },
    { id: id('m_'), published: true, year: '2024', title: 'Sports-science lab', text: 'Movement screening, timing gates and a full-time physio team.' },
  ];

  const method = [
    { id: id('w_'), published: true, title: 'Foundation', ages: '5–9 yrs', text: 'Movement, coordination and love for the game. Lots of play, very little standing in lines.' },
    { id: id('w_'), published: true, title: 'Development', ages: '9–13 yrs', text: 'Technique in every core skill, first competitions and the habit of training well.' },
    { id: id('w_'), published: true, title: 'Performance', ages: '13–16 yrs', text: 'Specialisation, strength training and a full competition calendar.' },
    { id: id('w_'), published: true, title: 'Elite', ages: '16+ yrs', text: 'Individual plans, trials, sports science and the mental side of high-level sport.' },
  ];

  const Q = (category, question, answer) => ({ id: id('q_'), published: true, category, question, answer });
  const faqs = [
    Q('Admissions', 'What is the right age to start?', 'Most programs start at 6. Swimming starts at 5. Strength & conditioning starts at 12. Adults are welcome in every sport.'),
    Q('Admissions', 'Does my child need prior experience?', 'No. Every new athlete has a free assessment and is placed in a batch that matches their level.'),
    Q('Fees', 'What does the registration fee cover?', 'A one-time ₹1,500 that includes a kit bag, a training tee and the baseline fitness test.'),
    Q('Fees', 'Is there a sibling discount?', 'Yes, 10% off the second and every additional child’s monthly fee.'),
    Q('Training', 'What happens if we miss sessions?', 'Missed sessions can be made up in another batch of the same level within the same month, subject to seats.'),
    Q('Training', 'How do parents track progress?', 'You receive an 8-week report with fitness numbers and coach notes, plus regular WhatsApp updates.'),
    Q('Safety', 'Are coaches background verified?', 'Yes. Every coach and staff member is police verified and trained in first aid and safeguarding.'),
    Q('General', 'Can I visit before joining?', 'Of course. Walk in any morning between 6 and 11 or book a free trial online.'),
  ];

  const pages = [
    { id: id('pg_'), published: true, inFooter: true, title: 'Privacy policy', slug: 'privacy-policy', intro: 'How we collect and use the information you share with us.', body: '## What we collect\n\nWhen you fill a form on this website we collect the details you type in: names, phone numbers, email, age and the sport you are interested in.\n\n## How we use it\n\nOnly to reply to you, arrange trials and manage admissions. We never sell your data.\n\n## Your choices\n\nWrite to us any time to see, correct or delete your information.\n\n*This is template text. Have it reviewed before going live.*' },
    { id: id('pg_'), published: true, inFooter: true, title: 'Safeguarding', slug: 'safeguarding', intro: 'Keeping every child safe is our first responsibility.', body: '## Our commitments\n\n- Every coach and staff member is police verified.\n- First-aid trained staff at every session.\n- Two-adult rule for all one-to-one coaching of minors.\n- A named safeguarding officer parents can contact directly.\n\n*This is template text. Have it reviewed before going live.*' },
  ];

  const settings = {
    name: 'Vega Sports Academy',
    shortName: 'VEGA',
    tagline: 'Train for the final whistle.',
    founded: '2011',
    city: 'Jaipur',
    address: 'Plot 14, Sports Enclave, Jagatpura\nJaipur, Rajasthan 302017',
    phone: '+91 98290 12345',
    whatsapp: '919829012345',
    email: 'hello@vegasports.in',
    hours: ['Mon–Sat · 5:30 AM – 9:30 PM', 'Sun · 7:00 AM – 12:00 PM'],
    mapEmbed: 'https://www.google.com/maps?q=Jagatpura,Jaipur&output=embed',
    instagram: 'https://instagram.com/',
    youtube: 'https://youtube.com/',
    facebook: '',
    x: '',
    accent: '#E0482B',
    volt: '#D4F53C',
    preloader: true,
    announceOn: true,
    announceText: 'Winter term admissions are open. Free trial for every sport.',
    announceLink: '/admissions',
    admissionsOpen: true,
    trialsOpen: true,
    seoTitle: 'Vega Sports Academy, Jaipur · Cricket, Football, Badminton, Swimming & more',
    seoDescription: 'A multi-sport academy in Jaipur for kids, teens and adults. Certified coaches, world-class facilities and a free first session.',
    ogImage: '',
    footerNote: 'Demo content: names, numbers and stories are placeholders for the academy to replace.',
  };

  const sections = {};
  for (const [k] of require('./schema').sections) sections[k] = true;

  const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';
  return {
    version: 1,
    settings,
    texts: {},
    sections,
    programs, batches, coaches, facilities, plans, posts, events,
    gallery: galleryItems, testimonials, stats, milestones, method, faqs, pages,
    trials: [], admissions: [], enquiries: [], subscribers: [],
    media: [],
    users: [{ id: id('u_'), name: 'Administrator', email: 'admin@vega.local', role: 'admin', passwordHash: hashPassword(password), mustChange: !process.env.ADMIN_PASSWORD, createdAt: new Date().toISOString() }],
    sessions: [],
    activity: [],
  };
}

function capitalise(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { seed };
