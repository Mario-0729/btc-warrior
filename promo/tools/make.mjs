// 一鍵重做宣傳影片：產生 promo.html → 逐格錄影 → 合成配樂 → 輸出 mp4
// 用法：node promo/tools/make.mjs        （約 20～40 分鐘，3D 逐格算比較慢）
//       node promo/tools/make.mjs --skip-rec   （已經錄好畫面，只重做配樂與輸出）
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const promo = path.resolve(here, '..');
const work = path.join(os.tmpdir(), 'mama2000-promo');
const frames = path.join(work, 'frames');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
run('node', [path.join(here, 'build-promo.mjs')]);
if (!process.argv.includes('--skip-rec')) run('node', [path.join(here, 'rec.mjs'), frames]);
run('node', [path.join(here, 'audio.mjs'), path.join(frames, 'marks.json'), path.join(work, 'soundtrack.wav')]);
const out = path.join(promo, '韭菜戰士_宣傳影片_有聲.mp4');
run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, 'f%05d.jpg'), '-i', path.join(work, 'soundtrack.wav'),
  '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
// 封面：結尾卡那一格
run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-sseof', '-1', '-i', out, '-frames:v', '1', path.join(promo, 'endcard.png')]);
console.log('完成：', out);
