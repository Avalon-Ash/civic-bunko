// 有身體的小貓：把看圖頁（tools/gallery/cat-gallery.mts）的靜態檢查搬進 npm test。
// 量的是幾何（不含線寬）。帶 CSS 動畫時的位置（例如被拎著搖晃）這裡量不到，仍要看看圖頁。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PET_POSES, PET_VIEW_H, PET_VIEW_W } from '../../core/constants/pet';
import { ITEMS } from '../../core/constants/wardrobe';
import type { Outfit, PetPose } from '../../core/types';
import { svgBounds, type Bounds } from '../../testing/svgBounds';
import { CatBody } from './CatBody';
import { frontalBuild, torsoShape, type Cubic, type Pt } from './petShape';

const POSES = Object.keys(PET_POSES) as PetPose[];
/** 幾何誤差的容許值（身體座標） */
const EPS = 0.05;
/** 一段貝茲曲線取幾個點 */
const STEPS = 32;

/** 每件配件單穿，加上幾套疊穿（跟看圖頁同一批全套） */
const OUTFITS: Array<[string, Outfit]> = [
  ['素', {}],
  ...ITEMS.map((it): [string, Outfit] => [it.id, { [it.slot]: it.id }]),
  ['全套 A', { 'head-top': 'beanie', neck: 'bell', bg: 'cushion', 'face-mid': 'glasses' }],
  ['全套 B', { 'head-top': 'grad-cap', body: 'sailor', back: 'wings', fur: 'fur-orange' }],
  ['全套 C', { 'head-top': 'hachimaki', neck: 'exam-pass', bg: 'moon', fur: 'fur-black', 'face-low': 'fish-snack' }],
];

/** 整隻貓畫到哪（身體座標）；被身體輪廓剪掉的布面不算 */
function reach(pose: PetPose, outfit: Outfit, facing: 'left' | 'right' = 'right'): Bounds {
  const markup = renderToStaticMarkup(h(CatBody, { pose, outfit, facing, backdrop: true }));
  const bounds = svgBounds(markup, { within: 'cb-pet', skipClasses: ['cb-pet-wrap'] });
  assert.ok(bounds, `${pose} 沒有畫出任何東西`);
  return bounds;
}

function cubicPoints(c: Cubic): Pt[] {
  return Array.from({ length: STEPS + 1 }, (_, i): Pt => {
    const t = i / STEPS;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    return [
      w[0] * c[0][0] + w[1] * c[1][0] + w[2] * c[2][0] + w[3] * c[3][0],
      w[0] * c[0][1] + w[1] * c[1][1] + w[2] * c[2][1] + w[3] * c[3][1],
    ];
  });
}

/** 點到多邊形有多遠：在裡面回 0，在外面回到最近一邊的距離 */
function outsideBy(p: Pt, polygon: readonly Pt[]): number {
  let inside = false;
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as Pt;
    const b = polygon[(i + 1) % polygon.length] as Pt;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2));
    nearest = Math.min(nearest, Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t)));
  }
  return inside ? 0 : nearest;
}

describe('cat body', () => {
  it('nothing is drawn outside the body coordinates, for every pose and every item', () => {
    const over: string[] = [];
    for (const [name, outfit] of OUTFITS) {
      for (const pose of POSES) {
        const b = reach(pose, outfit);
        const parts = [
          b.minX < -EPS ? `左 ${(-b.minX).toFixed(1)}` : '',
          b.minY < -EPS ? `上 ${(-b.minY).toFixed(1)}` : '',
          b.maxX > PET_VIEW_W + EPS ? `右 ${(b.maxX - PET_VIEW_W).toFixed(1)}` : '',
          b.maxY > PET_VIEW_H + EPS ? `下 ${(b.maxY - PET_VIEW_H).toFixed(1)}` : '',
        ].filter(Boolean);
        if (parts.length > 0) over.push(`${name} × ${pose}：${parts.join('、')}`);
      }
    }
    assert.deepEqual(over, []);
  });

  it('the fur patch on the back stays inside the body outline, including the mirrored one when sitting front-on', () => {
    for (const pose of POSES) {
      const spec = PET_POSES[pose];
      const shape = torsoShape(spec.torso, spec.frontal ? frontalBuild(spec.build) : spec.build);
      const outline = shape.curves.outline.flatMap(cubicPoints);
      const saddle = shape.curves.saddle.flatMap(cubicPoints);
      const sides = spec.frontal ? [1, -1] : [1];
      for (const side of sides) {
        const worst = Math.max(...saddle.map(([x, y]) => outsideBy([x, y * side], outline)));
        assert.ok(worst <= EPS, `${pose}${side < 0 ? '（鏡像那一側）' : ''} 的花紋超出身體 ${worst.toFixed(2)}`);
      }
    }
  });

  it('facing left is the mirror image of facing right', () => {
    const outfit: Outfit = { 'head-top': 'party-hat', body: 'sweater', back: 'balloon' };
    for (const pose of POSES) {
      const right = reach(pose, outfit, 'right');
      const left = reach(pose, outfit, 'left');
      assert.ok(Math.abs(left.minX - (PET_VIEW_W - right.maxX)) <= EPS, `${pose} 左緣`);
      assert.ok(Math.abs(left.maxX - (PET_VIEW_W - right.minX)) <= EPS, `${pose} 右緣`);
      assert.ok(Math.abs(left.minY - right.minY) <= EPS && Math.abs(left.maxY - right.maxY) <= EPS, `${pose} 上下`);
    }
  });

  it('the flip lives on its own wrapper, not on the animated group', () => {
    // 動作的 CSS 動畫掛在 .cb-pet（transform-box: fill-box）；翻面放在同一個元素時支點會跑掉、還會被動畫蓋掉
    const markup = renderToStaticMarkup(h(CatBody, { pose: 'walk', outfit: {}, facing: 'left' }));
    assert.match(markup, new RegExp(`<g transform="translate\\(${PET_VIEW_W} 0\\) scale\\(-1 1\\)"><g class="cb-pet `));
    assert.doesNotMatch(markup, /<g[^>]*class="cb-pet [^"]*"[^>]*transform=/);
    assert.doesNotMatch(markup, /<g[^>]*transform=[^>]*class="cb-pet /);
  });
});
