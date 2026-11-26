// 四格漫畫看圖用：每個道具、每張有漫畫的卡（一般與遮起來想）畫成一張靜態 HTML，給人或代理在瀏覽器裡看。
// 用法：npx tsx tools/gallery/comic-gallery.mts <輸出.html> [light|dark] [漫畫欄寬 px，預設 390]
// 不進 App、不進測試；輸出放 .gallery/（已列入 .gitignore）。頁尾列出每樣道具被哪幾張卡用到、資料檢查結果。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMIC_PROPS } from '../../src/core/constants/comic';
import type { ComicPropId, StudyCard } from '../../src/core/types';
import { comicProblems } from '../../src/systems/comic';
import { ComicStrip } from '../../src/ui/kit/comic/ComicStrip';
import { ComicProp } from '../../src/ui/kit/comic/props';

const out = process.argv[2];
if (!out) throw new Error('用法：npx tsx tools/gallery/comic-gallery.mts <輸出.html> [light|dark] [欄寬]');
const mode = process.argv[3] === 'dark' ? 'dark' : 'light';
const colWidth = Number(process.argv[4]) || 390;
const css = ['src/theme.css', 'src/ui/styles/pet.css', 'src/ui/styles/wardrobe.css', 'src/ui/styles/comic.css']
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

const packsDir = 'data/packs';
const cards: StudyCard[] = [];
for (const pack of readdirSync(packsDir)) {
  const dir = join(packsDir, pack, 'cards');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    continue;
  }
  for (const f of files) cards.push(...(JSON.parse(readFileSync(join(dir, f), 'utf8')).cards as StudyCard[]));
}
const comics = cards.filter((c): c is StudyCard & { comic: NonNullable<StudyCard['comic']> } => Boolean(c.comic));

const propIds = Object.keys(COMIC_PROPS) as ComicPropId[];
const props = propIds
  .map(
    (id) =>
      `<figure class="prop"><div class="stage">${renderToStaticMarkup(h(ComicProp, { id }))}</div><figcaption>${COMIC_PROPS[id]}<br><small>${id}</small></figcaption></figure>`,
  )
  .join('');

const strips = comics
  .map((card) => {
    const all = new Set(card.comic.panels.map((_, i) => i));
    return `<section class="card"><h3>${card.title} <small>${card.id}・${card.comic.layout}</small></h3>
      <div class="pair">
        <div class="col">${renderToStaticMarkup(h(ComicStrip, { card }))}</div>
        <div class="col">${renderToStaticMarkup(h(ComicStrip, { card, hidden: true, revealed: new Set([0]) }))}<p class="note">遮起來想（第 1 格已揭曉）</p></div>
      </div>${all.size ? '' : ''}</section>`;
  })
  .join('');

const usage = propIds
  .map((id) => {
    const users = comics.filter((c) => c.comic.panels.some((p) => p.props.includes(id))).map((c) => c.id);
    return `<li>${COMIC_PROPS[id]}（${id}）：${users.length ? users.join('、') : '<b>沒人用</b>'}</li>`;
  })
  .join('');
const problems = comics.flatMap((c) => comicProblems(c).map((p) => `<li>${c.id}：${p}</li>`));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `<!doctype html><html data-theme="${mode}"><meta charset="utf-8"><title>四格漫畫看圖 ${mode}</title><style>${css}
  body{margin:16px;background:var(--bg,#fbf6ef);color:var(--ink);font-family:system-ui,"Noto Sans TC",sans-serif}
  .props{display:flex;flex-wrap:wrap;gap:12px}.prop{margin:0;width:110px;text-align:center}
  .prop .stage{width:96px;height:96px;margin:auto;background:var(--surface-sunken);border-radius:12px}
  .prop svg{width:96px;height:96px}
  .pair{display:flex;flex-wrap:wrap;gap:24px}.col{width:${colWidth}px}
  .card{margin:24px 0;padding-top:8px;border-top:2px dashed var(--line)} .note{font-size:12px;color:var(--ink-soft)}
  </style><body><h2>道具（${propIds.length} 樣）</h2><div class="props">${props}</div>
  <h2>漫畫（${comics.length} 張）</h2>${strips}
  <h2>道具用在哪</h2><ul>${usage}</ul>
  <h2>資料檢查</h2>${problems.length ? `<ul>${problems.join('')}</ul>` : '<p>沒有問題</p>'}</body></html>`,
);
console.log(`寫出 ${out}：道具 ${propIds.length}、漫畫 ${comics.length}、問題 ${problems.length}`);
