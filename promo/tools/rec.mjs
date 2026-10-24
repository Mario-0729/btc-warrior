// 自動操作 promo.html 並逐格錄影（1080×1920、30fps）。
// 用「虛擬時間」：每拍一格就讓頁面時間前進 1/30 秒，所以就算 3D 算得很慢，影片也是流暢的。
// 用法：node promo/tools/rec.mjs [輸出資料夾]　→ 產生 f00000.jpg… 與 marks.json（各段落的秒數，給配樂對時）
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'mama2000-promo', 'frames');
const FPS = 30;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

// Three.js 是 ES 模組，file:// 載不進來，所以開一個本機小伺服器
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
}).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;

const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
// 錄影版不連任何外部服務（排行榜、瀏覽數）
await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/promo/promo.html');
await p.waitForFunction(() => document.fonts.ready.then(() => true));
await p.waitForTimeout(2500);   // let Three.js load
await p.evaluate(() => { window.__vt = true; window.__liqMs = 3000; window.__force = { pct: 0.06 }; });

const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
let n = 0;
async function shot() {
  const done = new Promise(r => cdp.once('Emulation.virtualTimeBudgetExpired', r));
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS });
  await done;
  await p.screenshot({ path: path.join(OUT, 'f' + String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  if (n % 60 === 0) console.log('…已拍', n, '格');
}
const hold = async sec => { for (let i = Math.round(sec * FPS); i > 0; i--) await shot(); };
async function until(fn, maxSec) {
  for (let i = Math.round(maxSec * FPS); i > 0; i--) { if (await p.evaluate(fn)) return true; await shot(); }
  console.log('等不到：', fn.toString()); return false;
}
const js = fn => p.evaluate(fn);
const click = sel => p.evaluate(s => document.querySelector(s).click(), sel);
const cap = (t, cls) => p.evaluate(([t, cls]) => {
  const c = document.getElementById('promoCap');
  c.className = cls || ''; c.querySelector('b').innerHTML = t;
  void c.offsetWidth; if (t) c.classList.add('show');
}, [t, cls]);
const marks = {};
const mark = k => { marks[k] = +(n / FPS).toFixed(3); console.log(k, marks[k]); };

// 1) 開場：媽媽賠掉的 2000 萬（遊戲自己的劇情特寫）
await click('#enterBtn');
mark('enter');
await until(() => !document.getElementById('faceBig').hidden, 2);
mark('story');
await hold(2.6);
await js(() => window.__promo.closeStory());
// 2) 梭哈 102 倍做多，一路往上
await js(() => window.__promo.unlock());
await cap('梭哈！102 倍！🚀');
await hold(0.35);
await click('[data-stake="all"]'); mark('chip1');
await hold(0.35);
await click('[data-lev="102"]'); mark('chip2');
await hold(0.4);
await js(() => { window.__force = { pct: 0.3 }; });
await click('#btnLong'); mark('long');
await hold(1.0);
await cap('💗 錢一直長出來 💗');
await until(() => window.__promo.eq() >= 4000000, 8);
mark('rise_end');
await cap('');
await until(() => !document.getElementById('faceBig').hidden, 2);
mark('s400');
await hold(2.3);
// 3) 插針爆倉（定格）
await js(() => { window.__force = { pct: -0.25, pin: 2.6 }; window.__promo.closeStory(); });
await cap('下一秒……', 'dark');
mark('tease');
await until(() => !!document.querySelector('.leek-boom, #liqScreen:not([hidden])') || window.__promo.eq() < 100000, 3);
mark('liq');
await hold(0.4);
await cap('被插針，一秒歸零 💀', 'dark low');
await until(() => !document.getElementById('liqScreen').hidden, 4);
await cap('');
// 4) 強制平倉登場畫面
mark('liqScreen');
await js(() => { window.__force = { pct: -0.05 }; });
await hold(3.0);
await js(() => window.__promo.closeLiq());
// 5) 結局台詞：跟媽媽一模一樣
await until(() => !document.getElementById('faceBig').hidden, 2);
mark('broke');
await hold(2.6);
// 6) 結尾卡
await js(() => { document.getElementById('promoFace').innerHTML = window.__promo.face('cry'); document.getElementById('promoEnd').classList.add('show'); });
mark('end');
await hold(3.8);
mark('stop');
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ fps: FPS, frames: n, ...marks }, null, 1));
console.log('frames', n, 'seconds', (n / FPS).toFixed(2), 'errors', errs);
await b.close(); srv.close();
