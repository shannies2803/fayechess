# Chess practice sites

Two chess training pages for the children. Each one is a single HTML file with
no build step and no dependencies: open it in a browser and it works, including
offline once it has loaded. Progress is kept in the browser's own storage, per
device.

| File | Who it is for | Lives at |
| --- | --- | --- |
| `index.html` | Faye — *Knight School*, ages ~7–9, complete beginner through club player | https://fayechess.netlify.app |
| `philip/index.html` | Philip — *Touch Move*, a stronger player | https://fayechess.netlify.app/philip/ |

The two pages use different storage keys (`knightschool:*` and
`touchmove:progress`), so sharing one domain does not mix up their progress.

## Deploying

Netlify is connected to this repository. Every push to `main` is published
automatically — there is nothing to click. `netlify.toml` holds the settings
(no build command, publish the repository root).

## Editing

Edit the HTML file directly and push. Keep each page a single file: no external
CSS, JS, images or fonts, so the pages keep working on a school iPad with no
signal.

## Checks

`tools/` holds the test suites and audits. They are not part of the site and
are not needed to deploy it. GitHub runs all of them on every push and pull
request (`.github/workflows/checks.yml`); a red cross there means something broke.

```bash
cd tools
npm install
npm test                          # the 14 fast suites (jsdom)
npx playwright install chromium   # once, for the real-browser test
npm run test:all                  # the 14 suites + smoke.js on a 375 px phone screen
node audit_new.js                 # structural
node audit_expert.js              # chess content is correct
node audit_gm.js                  # content is worth learning
node audit_child.js               # readable and tappable for a 7-year-old (needs playwright)
node audit_pro.js                 # Philip's page
```

Every suite should finish with `0 failed`, and every audit with no gaps.
