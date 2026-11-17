// 小八喵看圖用：把每件配件穿在頭像、每種姿勢（含背飾、背景）畫成一張靜態 HTML，給人或代理在瀏覽器裡比對。
// 用法：npx tsx tools/gallery/cat-gallery.mts <輸出.html> [light|dark]
// 不進 App、不進測試；輸出放 .gallery/（已列入 .gitignore）。
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cat, ItemIcon } from '../../src/ui/kit/Cat';
import { CatBody } from '../../src/ui/kit/CatBody';
import { ITEMS } from '../../src/core/constants/wardrobe';
import { PET_POSES } from '../../src/core/constants/pet';
import type { Outfit, PetPose } from '../../src/core/types';

const out = process.argv[2];
if (!out) throw new Error('用法：npx tsx tools/gallery/cat-gallery.mts <輸出.html> [light|dark]');
const mode = process.argv[3] === 'dark' ? 'dark' : 'light';
const css = ['src/theme.css', 'src/ui/styles/pet.css', 'src/ui/styles/wardrobe.css']
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

const cell = (label: string, node: ReactElement) =>
  `<figure><div class="stage">${renderToStaticMarkup(node)}</div><figcaption>${label}</figcaption></figure>`;

/** 頭像：每件單穿 */
const heads = [
  cell('原本', h(Cat, { size: 150, interactive: false })),
  ...ITEMS.map((it) => cell(`${it.name}<br><small>${it.slot}</small>`, h(Cat, { size: 150, interactive: false, outfit: { [it.slot]: it.id } }))),
].join('');

/** 圖示 */
const icons = ITEMS.map((it) => cell(it.name, h(ItemIcon, { id: it.id, size: 44 }))).join('');

/** 身體：每種姿勢 × 背飾、背景、幾套全身穿搭（backdrop＝試衣間的畫法） */
const poses = Object.keys(PET_POSES) as PetPose[];
const bodyOutfits: Array<[string, Outfit]> = [
  ['素', {}],
  ...ITEMS.filter((it) => it.slot === 'back' || it.slot === 'bg' || it.slot === 'body').map(
    (it): [string, Outfit] => [it.name, { [it.slot]: it.id }],
  ),
  ['全套 A', { 'head-top': 'beanie', neck: 'bell', bg: 'cushion', 'face-mid': 'glasses' }],
  ['全套 B', { 'head-top': 'grad-cap', body: 'sailor', back: 'wings', fur: 'fur-orange' }],
  ['全套 C', { 'head-top': 'hachimaki', neck: 'exam-pass', bg: 'moon', fur: 'fur-black', 'face-low': 'fish-snack' }],
];
const bodies = bodyOutfits
  .map(
    ([name, outfit]) =>
      `<h4>${name}</h4><div class="row">` +
      poses.map((pose) => cell(pose, h(CatBody, { pose, outfit, width: 150, backdrop: true }))).join('') +
      '</div>',
  )
  .join('');

writeFileSync(
  out,
  `<!doctype html><html data-theme="${mode}"><meta charset="utf-8"><title>小八喵看圖 ${mode}</title><style>${css}
body{background:var(--surface);color:var(--ink);font-family:sans-serif;padding:12px;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.icons{grid-template-columns:repeat(auto-fill,minmax(76px,1fr))}
.row{display:flex;flex-wrap:wrap;gap:6px}h4{margin:10px 0 4px}
figure{margin:0;text-align:center;font-size:12px}.stage{background:var(--surface-raised);border:2px solid var(--line);border-radius:12px;padding:8px;display:flex;justify-content:center}</style>
<h3>頭像（每件單穿）</h3><div class="grid">${heads}</div>
<h3>圖示</h3><div class="grid icons">${icons}</div>
<h3>身體姿勢（含背景，試衣間的畫法）</h3>${bodies}`,
);
console.log(`ok ${out}`);
