// A small JSON-file database. Everything lives in one object that is written
// atomically (temp file + rename) and copied to data/backups once a day.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const FILE = path.join(DATA_DIR, 'cms.json');
const BACKUPS = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 14;

let db = null;
let timer = null;

function id(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

// migrateFn(db, { fresh }) runs after loading, with the store already pointing
// at db, so it can use modules that read through store.get().
function load(seedFn, migrateFn) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const fresh = !fs.existsSync(FILE);
  db = fresh ? seedFn() : JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (migrateFn) migrateFn(db, { fresh });
  writeNow();
  return db;
}

function get() {
  return db;
}

function writeNow() {
  clearTimeout(timer);
  timer = null;
  const tmp = FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, FILE);
  backup();
}

// Coalesce bursts of writes (for example a drag-and-drop reorder).
function save() {
  if (timer) return;
  timer = setTimeout(writeNow, 150);
}

function backup() {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUPS, `cms-${day}.json`);
  if (fs.existsSync(target)) return;
  fs.copyFileSync(FILE, target);
  const old = fs.readdirSync(BACKUPS).filter((f) => f.startsWith('cms-')).sort();
  while (old.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUPS, old.shift()));
}

function flush() {
  if (timer) writeNow();
}

process.on('exit', flush);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush();
    process.exit(0);
  });
}

module.exports = { load, get, save, flush, id, DATA_DIR };
