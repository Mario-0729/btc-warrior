import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/claude-0/-home-claude/eaac89d7-213c-52c0-9572-b3c7e304c279/scratchpad/promo/frames2';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///tmp/claude-0/-home-claude/eaac89d7-213c-52c0-9572-b3c7e304c279/scratchpad/promo/promo.html');
await p.evaluate(() => { window.__noGold = true; });
await p.click('#enterBtn');
await p.waitForTimeout(400);
const cdp = await p.context().newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async f => {
  const i = frames.length;
  fs.writeFileSync(OUT + '/f' + String(i).padStart(5, '0') + '.jpg', Buffer.from(f.data, 'base64'));
  frames.push(f.metadata.timestamp);
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
});
const cap = (t, dark) => p.evaluate(([t, dark]) => { const c = document.getElementById('promoCap'); c.classList.toggle('dark', !!dark); c.querySelector('b').innerHTML = t; c.classList.remove('show'); void c.offsetWidth; if (t) c.classList.add('show'); }, [t, dark]);
const W = ms => p.waitForTimeout(ms);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
const T0 = Date.now(); const mark = (n) => console.log(n, ((Date.now()-T0)/1000).toFixed(1));
// 1) cute intro
await cap('這是一個<br>超可愛的 K 線遊戲 🌸');
await p.evaluate(() => { window.__force = 650; });
await p.click('[data-stake="0.3"]', { force: true });
await W(1300); mark('intro');
await p.click('#btnLong', { force: true });
await W(1600);
await cap('漲的時候<br>你一路往上爬 💗');
await W(4200); mark('rise');
// 2) the drop
await cap('但是跌的時候……', true);
await W(900);
await p.evaluate(() => { window.__force = -7200; });
await W(2600); mark('crash');
await p.evaluate(() => { window.__force = -300; });
await cap('💀 強制平倉', true);
await W(1600);
// 3) dad
await p.evaluate(() => document.getElementById('promoCap').classList.add('low')); await cap('還會被爸爸抓包 😱', true);
await p.evaluate(() => window.__promo.caught());
await W(2600); mark('dad');
// 4) end card
await p.evaluate(() => document.getElementById('promoCap').classList.remove('low')); await cap('');
await p.evaluate(() => { document.getElementById('dadAlert').hidden = true; document.getElementById('promoEnd').classList.add('show'); });
await W(3200); mark('end');
await cdp.send('Page.stopScreencast');
await W(300);
fs.writeFileSync(OUT + '/times.json', JSON.stringify(frames));
console.log('frames', frames.length, 'span', (frames[frames.length-1]-frames[0]).toFixed(2), 'errors', errs);
await b.close();
