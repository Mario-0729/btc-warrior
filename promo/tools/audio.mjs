import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/claude-0/-home-claude/eaac89d7-213c-52c0-9572-b3c7e304c279/scratchpad/promo/soundtrack.wav';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('about:blank');
const b64 = await p.evaluate(async () => {
  const SR = 48000, LEN = 15;
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

  // ---------- A: cute (0 → 5.85) — 128 BPM music box + bouncy beat ----------
  const e8 = 60 / 128 / 2; // eighth
  const mel = ['C6','E6','G6','E6','A6','G6','E6','G6', 'F6','A6','G6','E6','D6','E6','C6','D6', 'C6','E6','G6','E6','A6','G6','A6','C6' ];
  const melT = (i) => 0.05 + i * e8;
  for (let i = 0; i < 24 && melT(i) < 5.8; i++) bell(N[mel[i]] || 2093, melT(i), 0.45, 0.11, musicA, rev);
  // counter-melody sparkle on top during the rise
  for (let i = 0; i < 12; i++) { const t = 2.4 + i * e8 * 2 + e8; if (t < 5.8) bell([2093, 2637, 3136, 2637][i % 4], t, 0.25, 0.035, musicA, rev); }
  // beat drops when the long button is pressed (1.1s)
  const bassLine = ['C3','C3','A2','A2','F2','F2','G2','G2'];
  for (let k = 0; ; k++) {
    const t = 1.1 + k * e8 * 2; if (t > 5.8) break;
    kick(t, 0.42, musicA);
    hat(t + e8, 0.05, musicA);
    pluck(N[bassLine[k % 8]] , t, e8 * 1.8, 0.09, musicA);
  }
  // SFX: stake chip tap + long press
  bell(1318.5, 0.6, 0.16, 0.1); // chip
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, 1.1 + i * 0.06, 0.5, 0.14 - i * 0.015)); // playCute (long)
  // coin pings while climbing
  [2.6, 3.4, 4.2, 5.0].forEach(t => { bell(1975.5, t, 0.18, 0.12); bell(2637, t + 0.08, 0.5, 0.12); });

  // ---------- record-scratch power-down at 5.85 ----------
  musicA.gain.setValueAtTime(1, 5.82); musicA.gain.linearRampToValueAtTime(0, 5.9);
  {
    const t0 = 5.85, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(35, t0 + 0.55);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.55);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.6);
    o.connect(lp).connect(g).connect(master); o.start(t0); o.stop(t0 + 0.65);
  }
  // tension: rising high whine + heartbeat before the crash
  {
    const t0 = 6.0, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(4200, 6.9);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, 6.88); g.gain.linearRampToValueAtTime(0, 6.9);
    o.connect(g).connect(master); o.start(t0); o.stop(6.92);
  }
  heartbeat(6.15, 0.5); heartbeat(6.55, 0.6);

  // ---------- B: crash + horror bed (6.9 → 11.6) ----------
  scream(6.9, 1.0); thud(6.9, 0.9); scary(7.05, 1.2, 0.22); noiseBurst(6.9, 0.35, 0.35, 4000, 200);
  {
    // detuned low drone through distortion with slow tremolo
    const bus = c.createGain(), sh = dist(2.2), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    bus.connect(sh).connect(lp).connect(musicB); lp.connect(bigRev);
    [55, 58.27, 82.4, 110.6].forEach(fq => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.connect(bus); o.start(7.0); o.stop(12.6); });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 3.2; lg.gain.value = 0.04; lfo.connect(lg).connect(bus.gain); lfo.start(7.0); lfo.stop(12.6);
    bus.gain.value = 0.09;
    // dissonant high cluster (tritone) — ghostly
    [1244.5, 1760, 1864.7].forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = fq; o.detune.value = (i - 1) * 14;
      g.gain.setValueAtTime(0.0001, 7.4); g.gain.exponentialRampToValueAtTime(0.018, 9.6); g.gain.exponentialRampToValueAtTime(0.0001, 11.8);
      o.connect(g); pan(g, (i - 1) * 0.7).connect(musicB); g.connect(bigRev); o.start(7.4); o.stop(11.9); });
    musicB.gain.setValueAtTime(0, 6.95); musicB.gain.linearRampToValueAtTime(1, 7.6);
    musicB.gain.setValueAtTime(1, 11.4); musicB.gain.linearRampToValueAtTime(0, 12.4);
  }
  // heartbeat speeds up toward dad
  [7.9, 8.6, 9.2].forEach(t => heartbeat(t, 0.5));
  // "強制平倉" caption hit
  thud(8.65, 0.55); bell(233, 8.65, 1.2, 0.1, master, bigRev);
  // ---------- dad caught at 9.95 ----------
  // sneaky footsteps first
  bell(392, 9.35, 0.22, 0.1); bell(466.2, 9.55, 0.22, 0.09);
  thud(9.95, 1.0); scary(10.2, 1.1, 0.24); noiseBurst(9.95, 0.25, 0.3, 2500, 150);
  scream(10.05, 0.7);

  // ---------- C: end card (11.6 → 15) creepy music box returns ----------
  {
    const t0 = 11.65, q = 0.3;
    const endMel = ['A5','C6','E6','A6','G6','E6','D6','E6','C6','B5','A5'];
    endMel.forEach((n, i) => bell(N[n], t0 + i * q, 0.9, 0.1, musicC, bigRev, 18));
    // final cute chord, slightly off
    [880, 1046.5, 1318.5, 1760].forEach((f, i) => bell(f, t0 + 11 * q + 0.1 + i * 0.03, 1.4, 0.07, musicC, bigRev, 22));
    musicC.gain.setValueAtTime(1, 14.2); musicC.gain.linearRampToValueAtTime(0, 14.95);
  }
  master.gain.setValueAtTime(0.8, 14.5); master.gain.linearRampToValueAtTime(0, 15);

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
});
fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
console.log('wrote', OUT);
await b.close();
