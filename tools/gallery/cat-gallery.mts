// 小八喵看圖用：把每件配件穿在頭像、每種姿勢（含背飾、背景）畫成一張靜態 HTML，給人或代理在瀏覽器裡比對。
// 用法：npx tsx tools/gallery/cat-gallery.mts <輸出.html> [light|dark] [身體姿勢區每格的寬度，預設 150]
// 不進 App、不進測試；輸出放 .gallery/（已列入 .gitignore）。
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cat, ItemIcon } from '../../src/ui/kit/Cat';
import { CatBody } from '../../src/ui/kit/CatBody';
import { ITEMS } from '../../src/core/constants/wardrobe';
import { PET_POSES, PET_VIEW_H, PET_VIEW_W, ROAM_WIDTH, RUNNER_WIDTH } from '../../src/core/constants/pet';
import type { Outfit, PetPose } from '../../src/core/types';

const out = process.argv[2];
if (!out) throw new Error('用法：npx tsx tools/gallery/cat-gallery.mts <輸出.html> [light|dark]');
const mode = process.argv[3] === 'dark' ? 'dark' : 'light';
const bodyWidth = Number(process.argv[4]) || 150;
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
      poses.map((pose) => cell(pose, h(CatBody, { pose, outfit, width: bodyWidth, backdrop: true }))).join('') +
      '</div>',
  )
  .join('');

/** 實際大小：她在 App 裡看到的尺寸（進度條跑者、跑出來玩、試衣間、頭像），線寬與小配件在這裡才看得出問題 */
const ROOM_WIDTH = 140; // 試衣間（WardrobeScreen 的 ROOM_CAT_WIDTH）
const realOutfits: Array<[string, Outfit]> = [
  ['素', {}],
  ['墨鏡＋毛衣＋翅膀', { 'face-mid': 'sunglasses', body: 'sweater', back: 'wings' }],
  ['學士帽＋口罩＋水手領＋披風', { 'head-top': 'grad-cap', 'face-low': 'mask', body: 'sailor', back: 'cape', fur: 'fur-orange' }],
  ['派對帽＋單片眼鏡＋領帶＋氣球', { 'head-top': 'party-hat', 'face-mid': 'monocle', neck: 'necktie', back: 'balloon', fur: 'fur-black' }],
];
const realSizes: Array<[string, number, PetPose[], boolean]> = [
  [`進度條跑者 ${RUNNER_WIDTH}px`, RUNNER_WIDTH, ['sit', 'run', 'hop', 'stumble', 'groom', 'loaf'], false],
  [`跑出來玩 ${ROAM_WIDTH}px`, ROAM_WIDTH, ['stand', 'walk', 'run', 'sit', 'groom', 'loaf', 'dangle', 'fall'], false],
  [`試衣間 ${ROOM_WIDTH}px`, ROOM_WIDTH, ['sit', 'hop'], true],
];
const real = realSizes
  .map(
    ([title, width, list, backdrop]) =>
      `<h4>${title}</h4>` +
      realOutfits
        .map(
          ([name, outfit]) =>
            `<div class="row real"><span class="tag">${name}</span>` +
            list.map((pose) => cell(pose, h(CatBody, { pose, outfit, width, backdrop }))).join('') +
            '</div>',
        )
        .join(''),
  )
  .join('');
const realHeads =
  '<h4>頭像 64px／40px</h4><div class="row real">' +
  realOutfits
    .flatMap(([name, outfit]) => [64, 40].map((size) => cell(`${name} ${size}`, h(Cat, { size, interactive: false, outfit }))))
    .join('') +
  '</div>';

/**
 * 自動檢查（用瀏覽器量，結果印在頁尾）：
 * 1. 超出身體座標的組合：頭放大或配件加高後，會不會被容器切到。
 * 2. 花紋有沒有貼在身體上：背上花色的外框必須落在身體輪廓的外框裡。
 * 3. 剪裁框的 id：同一個 id 只能對應同一個形狀（不同形狀共用 id，衣服會被別隻貓的身體裁到）。
 */
const checkScript = `<script>
addEventListener('load', () => {
  const W = ${PET_VIEW_W}, H = ${PET_VIEW_H}, EPS = 0.05;
  const over = [];
  document.querySelectorAll('#bodies .row').forEach((row) => {
    const name = row.previousElementSibling.textContent;
    row.querySelectorAll('figure').forEach((fig) => {
      const g = fig.querySelector('svg > g');
      if (!g) return;
      const b = g.getBBox();
      const o = [Math.min(0, b.x), Math.min(0, b.y), Math.max(0, b.x + b.width - W), Math.max(0, b.y + b.height - H)].map((n) => Math.round(n));
      if (o.some((n) => n !== 0)) over.push(name + ' / ' + fig.querySelector('figcaption').textContent + '：左 ' + o[0] + '　上 ' + o[1] + '　右 ' + o[2] + '　下 ' + o[3]);
    });
  });
  document.getElementById('overflow').textContent = over.length ? over.join('\\n') : '沒有超出';

  const loose = [];
  const saddles = document.querySelectorAll('.cb-pet-saddle');
  saddles.forEach((el) => {
    const body = el.parentNode.querySelector('.cb-pet-torso-shape');
    const a = el.getBBox(), b = body.getBBox();
    if (a.x < b.x - EPS || a.y < b.y - EPS || a.x + a.width > b.x + b.width + EPS || a.y + a.height > b.y + b.height + EPS) {
      loose.push(el.closest('figure').querySelector('figcaption').textContent);
    }
  });
  const shapes = new Map(), clash = new Set();
  document.querySelectorAll('clipPath').forEach((el) => {
    const d = el.innerHTML;
    if (shapes.has(el.id) && shapes.get(el.id) !== d) clash.add(el.id);
    shapes.set(el.id, d);
  });
  document.getElementById('attach').textContent =
    '花紋：檢查 ' + saddles.length + ' 隻，超出身體 ' + loose.length + ' 隻' + (loose.length ? '（' + loose.join('、') + '）' : '') +
    '\\n剪裁框：' + shapes.size + ' 個 id，形狀對不上的 ' + clash.size + ' 個' + (clash.size ? '（' + [...clash].join('、') + '）' : '');
});
</script>`;

writeFileSync(
  out,
  `<!doctype html><html data-theme="${mode}"><meta charset="utf-8"><title>小八喵看圖 ${mode}</title><style>${css}
body{background:var(--surface);color:var(--ink);font-family:sans-serif;padding:12px;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.icons{grid-template-columns:repeat(auto-fill,minmax(76px,1fr))}
.row{display:flex;flex-wrap:wrap;gap:6px}h4{margin:10px 0 4px}
.real{align-items:flex-end;margin-bottom:6px}.real .stage{padding:4px}.tag{font-size:12px;width:110px;align-self:center}pre{font-size:12px;white-space:pre-wrap}
figure{margin:0;text-align:center;font-size:12px}.stage{background:var(--surface-raised);border:2px solid var(--line);border-radius:12px;padding:8px;display:flex;justify-content:center}</style>
<h3>頭像（每件單穿）</h3><div class="grid">${heads}</div>
<h3>圖示</h3><div class="grid icons">${icons}</div>
<h3>實際大小</h3>${real}${realHeads}
<h3>身體姿勢（含背景，試衣間的畫法）</h3><div id="bodies">${bodies}</div>
<h3>超出身體座標 ${PET_VIEW_W}×${PET_VIEW_H} 的組合（單位：身體座標）</h3><pre id="overflow"></pre>
<h3>花紋與剪裁有沒有貼在身體上</h3><pre id="attach"></pre>${checkScript}`,
);
console.log(`ok ${out}`);
