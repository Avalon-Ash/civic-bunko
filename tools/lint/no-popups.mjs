// 韁繩（主代理維護）：src/ 內不得使用瀏覽器彈窗與另開視窗。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BANNED = [
  [/\balert\s*\(/, 'alert()'],
  [/\bconfirm\s*\(/, 'confirm()'],
  [/\bprompt\s*\(/, 'prompt()'],
  [/window\.open\s*\(/, 'window.open()'],
  [/target\s*=\s*["'{]\s*["']?_blank/, 'target="_blank"'],
  [/\bas any\b/, 'as any'],
];
const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|css)$/.test(name)) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const [re, label] of BANNED) if (re.test(line)) hits.push(`${p.slice(root.length + 1)}:${i + 1} ${label}`);
      });
    }
  }
};
if (existsSync(join(root, 'src'))) walk(join(root, 'src'));
for (const h of hits) console.error('ERROR ' + h);
console.log(`no-popups ERROR=${hits.length}`);
process.exit(hits.length ? 1 : 0);
