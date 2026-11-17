// 把 tools/zh/src/<packId>/<paperId>.json（主代理寫的中譯）和官方題目組裝成該內容包的 zh/<paperId>.json。
// 題組文章依句切開，每句配一句中譯；英文原句一律取自該內容包的 official/，來源檔裡不寫英文。
import fs from 'node:fs';
import path from 'node:path';
import { packPaths, resolvePack } from '../paths.mjs';

const packId = resolvePack();
const paths = packPaths(packId);
const SRC = paths.zhSrcDir;
const OUT = paths.zhDir;
const CHOICES = ['A', 'B', 'C', 'D'];

/** 依句號、問號、驚嘆號切句；「U.S.」這類縮寫後面不切。 */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?][”"’']?)(?<!\bU\.S\.)\s+(?=[A-Z“"‘])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let errors = 0;
const fail = (msg) => {
  errors += 1;
  console.error('ERROR', msg);
};

fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
  const paperId = file.replace(/\.json$/, '');
  const src = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  const official = JSON.parse(fs.readFileSync(path.join(paths.officialDir, file), 'utf8'));

  const groups = [];
  for (const group of official.groups) {
    const key = group.id.slice(group.id.lastIndexOf('-') + 1);
    const g = src.groups[key];
    if (!g) {
      fail(`${paperId} 缺題組 ${key}`);
      continue;
    }
    const sentences = splitSentences(group.text);
    if (sentences.length !== g.zh.length) {
      fail(`${group.id} 英文 ${sentences.length} 句、中譯 ${g.zh.length} 句`);
      continue;
    }
    groups.push({
      id: group.id,
      segments: sentences.map((en, i) => ({ en, zh: g.zh[i] })),
      vocab: g.vocab.map(([en, zh]) => ({ en, zh })),
    });
  }

  const items = [];
  for (const [no, [stem, options, vocab]] of Object.entries(src.items)) {
    const q = official.questions.find((x) => x.no === Number(no));
    if (!q) {
      fail(`${paperId} 找不到第 ${no} 題`);
      continue;
    }
    if (options.length !== 4) fail(`${q.id} 選項不是 4 個`);
    items.push({
      id: q.id,
      stem,
      options: Object.fromEntries(CHOICES.map((c, i) => [c, options[i]])),
      vocab: vocab.map(([en, zh]) => ({ en, zh })),
    });
  }
  items.sort((a, b) => a.id.localeCompare(b.id));

  fs.writeFileSync(
    path.join(OUT, file),
    `${JSON.stringify({ paperId, groups, items }, null, 2)}\n`,
  );
  console.log(`${paperId} groups=${groups.length} items=${items.length}`);
}
if (errors > 0) {
  console.error(`zh build ERROR=${errors}`);
  process.exit(1);
}
