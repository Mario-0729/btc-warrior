// 離線合成宣傳影片的配樂與音效（全部原創），時間點讀錄影產生的 marks.json，自動對拍。
// 用法：node promo/tools/audio.mjs <marks.json> <輸出.wav>
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const M = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('about:blank');
const b64 = await p.evaluate(async (M) => {
  const SR = 48000, LEN = Math.ceil(M.stop + 0.2);
  const c = new OfflineAudioContext(2, SR * LEN, SR);
  const master = c.createGain(); master.gain.value = 0.8;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp).connect(c.destination);
  function buildReverb(seconds, decay) {
    const len = Math.floor(SR * seconds), buf = c.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    const n = c.createConvolver(); n.buffer = buf; return n;
  }
  const rev = buildReverb(1.6, 2.2); const rg = c.createGain(); rg.gain.value = 0.35; rev.connect(rg).connect(master);
  const bigRev = buildReverb(3.2, 1.6); const brg = c.createGain(); brg.gain.value = 0.45; bigRev.connect(brg).connect(master);

  // music bus (can be cut / faded) vs sfx bus
  const musicA = c.createGain(); musicA.connect(master); // cute section
  const musicB = c.createGain(); musicB.connect(master); // horror section
  const musicC = c.createGain(); musicC.connect(master); // ending

  const pan = (node, v) => { const s = c.createStereoPanner(); s.pan.value = v; node.connect(s); return s; };

  function bell(freq, t0, dur, peak, out = master, rv = rev, detune = 0) {
    const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), g2 = c.createGain();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(freq, t0); o2.frequency.setValueAtTime(freq * 2, t0);
    o1.detune.value = detune; o2.detune.value = -detune;
    f.type = 'lowpass'; f.frequency.value = 5200; g2.gain.value = 0.22;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o1.connect(f); o2.connect(g2).connect(f); f.connect(g); g.connect(out); g.connect(rv);
    o1.start(t0); o1.stop(t0 + dur + 0.05); o2.start(t0); o2.stop(t0 + dur + 0.05);
  }
  function noise(dur) { const len = Math.floor(SR * dur), buf = c.createBuffer(1, len, SR), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = buf; return s; }
  function noiseBurst(t0, dur, peak, hzA, hzB, out = master) {
    const s = noise(dur), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(hzA, t0); bp.frequency.exponentialRampToValueAtTime(hzB, t0 + dur);
    g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(bp).connect(g); g.connect(out); g.connect(rev); s.start(t0); s.stop(t0 + dur);
  }
  function dist(a) { const s = c.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 255 * 2 - 1; cv[i] = Math.tanh(x * a); } s.curve = cv; s.oversample = '4x'; return s; }
  function kick(t0, peak = 0.55, out = master) {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.3);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.32);
  }
  function hat(t0, peak = 0.06, out = master) {
    const s = noise(0.06), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.05);
    s.connect(hp).connect(g); pan(g, 0.3).connect(out); s.start(t0); s.stop(t0 + 0.06);
  }
  function pluck(freq, t0, dur, peak, out = master) {
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'square';
    o.frequency.value = freq; f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t0); f.frequency.exponentialRampToValueAtTime(300, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(f).connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function thud(t0, peak = 0.8) {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.6);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.75);
    o.connect(g); g.connect(master); g.connect(bigRev); o.start(t0); o.stop(t0 + 0.8);
    noiseBurst(t0, 0.14, 0.3, 800, 120);
  }
  function scary(t0, dur = 0.9, peak = 0.2) {
    const sh = dist(3.2), lp = c.createBiquadFilter(), bus = c.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(220, t0 + dur);
    bus.gain.setValueAtTime(0.0001, t0); bus.gain.linearRampToValueAtTime(peak, t0 + 0.03); bus.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    bus.connect(sh).connect(lp).connect(master); lp.connect(bigRev);
    [116.5, 123.5, 61.7].forEach(fq => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fq, t0); o.frequency.exponentialRampToValueAtTime(fq * 0.55, t0 + dur); o.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05); });
    noiseBurst(t0, 0.2, 0.16, 3000, 500);
  }
  function scream(t0, dur = 0.9) {
    const sh = dist(5); sh.connect(master); sh.connect(bigRev);
    const s = noise(dur), bp = c.createBiquadFilter(), ng = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.setValueAtTime(650, t0); bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.16); bp.frequency.exponentialRampToValueAtTime(320, t0 + dur);
    ng.gain.setValueAtTime(0.0001, t0); ng.gain.linearRampToValueAtTime(0.5, t0 + 0.05); ng.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(bp).connect(ng).connect(sh); s.start(t0); s.stop(t0 + dur);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, t0); o.frequency.exponentialRampToValueAtTime(1150, t0 + 0.12); o.frequency.exponentialRampToValueAtTime(170, t0 + dur);
    og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(0.28, t0 + 0.05); og.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
    o.connect(og).connect(sh); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function heartbeat(t0, peak = 0.45) { kick(t0, peak, master); kick(t0 + 0.22, peak * 0.7, master); }

  const N = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
    C6: 1046.5, D6: 1174.66, E6: 1318.5, F6: 1396.9, G6: 1568, A6: 1760,
    A2: 110, F2: 87.31, G2: 98, C3: 130.81, A3: 220, E3: 164.81, D3: 146.83, Bb2: 116.54 };


  const e8 = 60 / 128 / 2;
  const T = M;
  // ---------- 開場：進場號角＋劇情叮 ----------
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.02 + i * 0.09, 0.6, 0.12));
  [1568, 2093].forEach((f, i) => bell(f, T.story + i * 0.12, 0.9, 0.09, master, bigRev));
  // ---------- A: 可愛八音盒（開場 → 下一秒） ----------
  const mel = ['C6','E6','G6','E6','A6','G6','E6','G6','F6','A6','G6','E6','D6','E6','C6','D6'];
  const cuteEnd = T.tease;
  for (let i = 0; ; i++) { const t = 0.4 + i * e8; if (t > cuteEnd - 0.05) break; bell(N[mel[i % 16]], t, 0.45, i < 16 ? 0.07 : 0.1, musicA, rev); }
  // 下注：籌碼叮
  bell(1318.5, T.chip1, 0.16, 0.12); bell(1568, T.chip2, 0.16, 0.12);
  // 做多：上行琶音＋節奏進來
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, T.long + i * 0.06, 0.5, 0.14 - i * 0.015));
  const bassLine = ['C3','C3','A2','A2','F2','F2','G2','G2'];
  for (let k = 0; ; k++) {
    const t = T.long + k * e8 * 2; if (t > cuteEnd - 0.1) break;
    kick(t, 0.42, musicA); hat(t + e8, 0.05, musicA);
    pluck(N[bassLine[k % 8]], t, e8 * 1.8, 0.09, musicA);
  }
  // 飛幣叮叮
  for (let i = 0; i < 5; i++) bell(2349, T.long + 0.15 + i * 0.07, 0.15, 0.06);
  // 每根上漲 K 線一聲錢幣
  for (let t = T.long + 0.6; t < T.rise_end + 0.1; t += 1.2) { bell(1975.5, t, 0.18, 0.12); bell(2637, t + 0.08, 0.5, 0.12); }
  // 400 萬劇情：閃亮和弦
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(f, T.s400 + i * 0.05, 1.2, 0.08, master, bigRev));
  musicA.gain.setValueAtTime(1, T.s400); musicA.gain.linearRampToValueAtTime(0.55, T.s400 + 0.3);
  // ---------- 下一秒：唱片急停＋心跳 ----------
  musicA.gain.setValueAtTime(0.55, cuteEnd - 0.03); musicA.gain.linearRampToValueAtTime(0, cuteEnd + 0.05);
  {
    const t0 = cuteEnd, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(35, t0 + 0.55);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.55);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.6);
    o.connect(lp).connect(g).connect(master); o.start(t0); o.stop(t0 + 0.65);
  }
  for (let t = cuteEnd + 0.25; t < T.liq - 0.2; t += 0.42) heartbeat(t, 0.55);
  {
    const t0 = cuteEnd + 0.2, t1 = T.liq, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(4200, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1);
    o.connect(g).connect(master); o.start(t0); o.stop(t1 + 0.02);
  }
  // ---------- B: 爆倉＋恐怖底噪（爆倉 → 結局台詞） ----------
  scream(T.liq, 1.0); thud(T.liq, 1.0); thud(T.liq + 0.42, 0.8); scary(T.liq + 0.1, 1.3, 0.22); noiseBurst(T.liq, 0.5, 0.4, 4000, 120);
  {
    const s0 = T.liq + 0.05, s1 = T.end + 0.4;
    const bus = c.createGain(), sh = dist(2.2), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    bus.connect(sh).connect(lp).connect(musicB); lp.connect(bigRev);
    [55, 58.27, 82.4, 110.6].forEach(fq => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.connect(bus); o.start(s0); o.stop(s1); });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 3.2; lg.gain.value = 0.04; lfo.connect(lg).connect(bus.gain); lfo.start(s0); lfo.stop(s1);
    bus.gain.value = 0.09;
    [1244.5, 1760, 1864.7].forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = fq; o.detune.value = (i - 1) * 14;
      g.gain.setValueAtTime(0.0001, s0 + 0.4); g.gain.exponentialRampToValueAtTime(0.018, s0 + 2.5); g.gain.exponentialRampToValueAtTime(0.0001, s1);
      o.connect(g); pan(g, (i - 1) * 0.7).connect(musicB); g.connect(bigRev); o.start(s0 + 0.4); o.stop(s1); });
    musicB.gain.setValueAtTime(0, s0); musicB.gain.linearRampToValueAtTime(1, s0 + 0.6);
    musicB.gain.setValueAtTime(1, T.end - 0.3); musicB.gain.linearRampToValueAtTime(0, s1);
  }
  for (let t = T.liq + 1.4; t < T.liqScreen - 0.2; t += 0.6) heartbeat(t, 0.45);
  // 強制平倉登場：重擊＋鐘聲
  thud(T.liqScreen, 1.0); noiseBurst(T.liqScreen, 0.3, 0.35, 2500, 150); thud(T.liqScreen + 0.35, 0.7);
  bell(233, T.liqScreen + 0.35, 1.6, 0.12, master, bigRev);
  scream(T.liqScreen + 0.1, 0.7);
  // 結局台詞：走音的八音盒下行
  ['E6','C6','A5','E5','D5','C5'].forEach((n, i) => bell(N[n], T.broke + 0.1 + i * 0.36, 1.0, 0.09, master, bigRev, 30));
  // ---------- C: 結尾卡 ----------
  {
    const t0 = T.end + 0.05, q = 0.28;
    bell(1046.5, T.end, 0.3, 0.12); bell(1568, T.end + 0.06, 0.4, 0.1);
    const endMel = ['A5','C6','E6','A6','G6','E6','D6','E6','C6','B5','A5'];
    endMel.forEach((n, i) => { const t = t0 + 0.25 + i * q; if (t < T.stop - 0.6) bell(N[n], t, 0.9, 0.1, musicC, bigRev, 18); });
    const tc = Math.min(t0 + 0.25 + 11 * q + 0.1, T.stop - 1.0);
    [880, 1046.5, 1318.5, 1760].forEach((f, i) => bell(f, tc + i * 0.03, 1.4, 0.07, musicC, bigRev, 22));
  }
  master.gain.setValueAtTime(0.8, T.stop - 0.6); master.gain.linearRampToValueAtTime(0, T.stop);

  const buf = await c.startRendering();
  // to 16-bit WAV
  const n = buf.length, ch = 2, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let off = 44;
  for (let i = 0; i < n; i++) { for (const d of [L, R]) { const v = Math.max(-1, Math.min(1, d[i])); out.setInt16(off, v * 32767, true); off += 2; } }
  const bytes = new Uint8Array(out.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, M);
fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
console.log('wrote', OUT);
await b.close();
