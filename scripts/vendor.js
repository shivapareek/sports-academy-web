// Copies the browser libraries from node_modules into public/vendor.
// The copies are committed, so the site runs without the dev dependencies.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'vendor');
const files = [
  ['gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['gsap/dist/SplitText.min.js', 'SplitText.min.js'],
  ['lenis/dist/lenis.min.js', 'lenis.min.js'],
];

fs.mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, 'node_modules', from), path.join(out, to));
  console.log('vendored', to);
}
