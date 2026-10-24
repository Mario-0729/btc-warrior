// 從遊戲本體 index.html 產生錄影專用的 promo.html：
// 可以用 window.__force 強制下一根 K 線漲跌（百分比），關掉隨機事件與黑箱，
// 爆倉定格秒數可調，並加上字幕條與結尾卡。用法：node promo/tools/build-promo.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
let s = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function rep(a, b) { if (!s.includes(a)) throw new Error('找不到：' + a); s = s.replace(a, b); }

// 逐格錄影時（__vt），每 1/30 秒只讓畫面算一次，3D 不用白算兩遍
rep('<head>', `<head>
<script>(function () {
  const raf = window.requestAnimationFrame.bind(window);
  let curT = -1, ok = true, lastT = -1e9;
  window.requestAnimationFrame = function (cb) {
    return raf(function run(t) {
      if (!window.__vt) return cb(t);
      if (t !== curT) { curT = t; ok = t - lastT >= 30; if (ok) lastT = t; }
      if (ok) cb(t); else raf(run);
    });
  };
})();</script>`);
rep("import('./vendor/three.module.min.js')", "import('../vendor/three.module.min.js')");
// forced candles: __force = { pct, pin } ; random events, guru calls and the black box stay quiet
rep("    stepGuru();\n", "    if (window.__force == null) stepGuru();\n");
rep("    if (Math.random() < 1 / 12) c.gold = true;   // 黃金 K 線：走到它上面就能撿紅包\n    marketEvents(c, last);",
`    if (window.__force != null) {
      const f = window.__force, o = last.close, cl = o * (1 + f.pct / 100);
      c.open = o; c.close = cl;
      c.high = Math.max(o, cl) + o * 0.0012; c.low = Math.min(o, cl) - o * 0.0012;
      if (f.pin) { c.low = Math.min(o, cl) - o * f.pin / 100; c.pin = true; toast('📌 插針！一根長下影'); }
      rigTicks = 0; favorTicks = 0;
    } else {
    if (Math.random() < 1 / 12) c.gold = true;   // 黃金 K 線：走到它上面就能撿紅包
    marketEvents(c, last);
    }`);
rep("  function maybeTriggerNews() {\n", "  function maybeTriggerNews() {\n    if (window.__force != null) return;\n");
rep("  function maybeRig() {\n", "  function maybeRig() {\n    if (window.__force != null) return;\n");
rep("      showLiq(liqPos, wasDenial);\n    }, 5000);", "      showLiq(liqPos, wasDenial);\n    }, window.__liqMs || 5000);");
rep("  const SAVE_KEY = 'btc-warrior-save';",
`  window.__promo = {
    lev: function (v) { lev = v; refreshTradeUI(); },
    closeStory: function () { closeStory(); },
    closeLiq: function () { closeLiq(); },
    eq: function () { return liveEquity(); },
    face: faceSvg,
    unlock: function () { LEV_UNLOCK[102] = 0; refreshTradeUI(); }
  };
  const SAVE_KEY = 'btc-warrior-save';`);

const extra = fs.readFileSync(path.join(here, 'promo-overlay.html'), 'utf8');
s = s.replace(/<\/body>\s*<\/html>\s*$/, extra + '\n</body>\n</html>\n');
if (!s.includes('id="promoEnd"')) s += extra;
fs.writeFileSync(path.join(root, 'promo/promo.html'), s);
console.log('wrote promo/promo.html');
