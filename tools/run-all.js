/* Runs every test suite in this folder and stops the build if any fails.
   `npm test` runs the fast jsdom suites; `npm run test:all` adds the
   real-browser smoke test (needs Chromium: `npx playwright install chromium`). */
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = ['gtest', 'g2test', 'g3test', 'g4test', 'newtest', 'revtest', 'looktest',
  'clocktest', 'writetest', 'storetest', 'pptest', 'picktest', 'protest', 'a11ytest'];
if (process.argv.includes('--browser')) SUITES.push('smoke');

let failed = [];
for (const s of SUITES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, s + '.js')], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const summary = (out.trim().split('\n').pop() || '').trim();
  const good = r.status === 0;
  console.log((good ? 'ok   ' : 'FAIL ') + s.padEnd(10) + summary);
  if (!good) { failed.push(s); console.log(out.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 10).join('\n')); }
}
console.log(failed.length ? '\n' + failed.length + ' suite(s) failed: ' + failed.join(', ') : '\nAll ' + SUITES.length + ' suites passed');
process.exit(failed.length ? 1 : 0);
