/* Real-browser smoke test for both chess pages, on a phone-sized screen.
   jsdom (used by the other suites) cannot lay pages out, so anything about
   sizes, overflow or tap targets is checked here in Chromium.

   Run:   cd tools && npm install && npx playwright install chromium && node smoke.js
   Or point CHROME_PATH at any Chromium/Chrome binary to skip the download. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  { url: '/', name: 'Knight School' },
  { url: '/philip/', name: 'Touch Move', extra: true },
];

let pass = 0, fail = 0, warn = 0;
const ok = (label, cond, detail) => {
  if (cond) pass++;
  else { fail++; console.log('FAIL: ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const note = (label, detail) => { warn++; console.log('WARN: ' + label + '  -> ' + JSON.stringify(detail)); };

/* a tiny static server, so the test needs nothing but Node */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

/* the page's own errors count; a font that cannot be fetched offline does not */
const ignorable = t => /fonts\.(googleapis|gstatic)\.com|ERR_(TUNNEL|NAME|INTERNET|CONNECTION)|Failed to load resource/.test(t);

const PAGE_CHECKS = () => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; };
  const ctrls = [...document.querySelectorAll('button,[role=button],a[href],input:not([type=hidden]),select,textarea')].filter(vis);
  const seen = {}, dup = [];
  document.querySelectorAll('[id]').forEach(e => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; });
  const named = e => (e.textContent || '').trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') ||
    e.getAttribute('title') || (e.labels && e.labels.length) || e.placeholder || e.querySelector('img[alt],svg[aria-label]');
  return {
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    dupIds: dup,
    unnamed: ctrls.filter(e => !named(e)).map(e => e.outerHTML.slice(0, 90)),
    small: ctrls.filter(e => { const r = e.getBoundingClientRect(); return r.height < 36 || r.width < 36; })
      .map(e => ((e.textContent || e.getAttribute('aria-label') || e.tagName).trim()).slice(0, 16)),
    viewport: (document.querySelector('meta[name=viewport]') || {}).content || '',
    lang: document.documentElement.lang,
    doctype: !!document.doctype,
  };
};

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {});

  for (const pg of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await page.goto(base + pg.url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const m = await page.evaluate(PAGE_CHECKS);
    ok(pg.name + ': has a doctype (no quirks mode)', m.doctype);
    ok(pg.name + ': declares its language', !!m.lang, m.lang);
    ok(pg.name + ': has a phone viewport', /width=device-width/.test(m.viewport), m.viewport);
    ok(pg.name + ': fits a 375 px screen', !m.overflow);
    ok(pg.name + ': no two elements share an id', m.dupIds.length === 0, m.dupIds);
    ok(pg.name + ': every visible control has a name', m.unnamed.length === 0, m.unnamed);
    if (m.small.length) note(pg.name + ': controls under 36 px', m.small);

    if (pg.extra) {
      ok(pg.name + ': scrolling tab strips cannot stretch the page',
        await page.evaluate(() => getComputedStyle(document.querySelector('.btnrow')).minWidth) === '0px');
      ok(pg.name + ': board coordinates are at least 9 px',
        await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.co')).fontSize)) >= 9);
    }

    /* open every view the navigation offers and make sure none breaks the layout */
    const labels = await page.evaluate(() => [...document.querySelectorAll('nav button, [role=tab], .tabs button, .nav button')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; })
      .map(e => (e.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean));
    let opened = 0;
    for (const label of [...new Set(labels)].slice(0, 30)) {
      const clicked = await page.evaluate(l => {
        const b = [...document.querySelectorAll('nav button, [role=tab], .tabs button, .nav button')]
          .find(e => (e.textContent || '').trim().replace(/\s+/g, ' ') === l);
        if (!b || /reset|remove|delete|clear/i.test(l)) return false;
        b.click(); return true;
      }, label);
      if (!clicked) continue;
      opened++;
      await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      ok(pg.name + ': "' + label + '" view fits the screen', !over);
    }
    ok(pg.name + ': at least one view was opened', opened > 0 || labels.length === 0, labels.length);
    ok(pg.name + ': no script errors', errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (warn ? ', ' + warn + ' warnings' : ''));
  process.exit(fail ? 1 : 0);
})();
