import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
await p.goto('file:///tmp/claude-0/-home-claude/eaac89d7-213c-52c0-9572-b3c7e304c279/scratchpad/promo/promo.html');
await p.evaluate(() => { document.getElementById('splash').hidden = true; document.getElementById('promoEnd').classList.add('show'); });
await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/claude-0/-home-claude/eaac89d7-213c-52c0-9572-b3c7e304c279/scratchpad/promo/endcard.png' });
await b.close();
