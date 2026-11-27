// 卡片架構圖的檢查（ADR 0025）：樹的層數、節點數、via 字數，表格的欄列對齊。
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CARD_TREE_DEPTH_MAX, CARD_TREE_NODES_MAX, CARD_VISUAL_VIA_MAX } from '../core/constants/cards';
import type { VisualNode } from '../core/types';
import { cardVisualProblems, treeDepth, treeSize } from './cardVisual';

const chain = (n: number): VisualNode => (n <= 1 ? { text: '葉' } : { text: `第${n}層`, children: [chain(n - 1)] });

test('樹：層數與節點數照常數擋', () => {
  assert.equal(treeDepth(chain(3)), 3);
  assert.equal(treeSize(chain(3)), 3);
  assert.deepEqual(cardVisualProblems({ kind: 'tree', roots: [chain(CARD_TREE_DEPTH_MAX)] }), []);
  assert.ok(cardVisualProblems({ kind: 'tree', roots: [chain(CARD_TREE_DEPTH_MAX + 1)] }).some((p) => p.includes('層')));
  const many = Array.from({ length: CARD_TREE_NODES_MAX + 1 }, (_, i) => ({ text: `節點${i}` }));
  assert.ok(cardVisualProblems({ kind: 'tree', roots: many }).some((p) => p.includes('節點')));
});

test('樹：最上層不能有 via，via 有字數上限', () => {
  assert.ok(cardVisualProblems({ kind: 'tree', roots: [{ text: '根', via: '線' }] }).some((p) => p.includes('via')));
  const longVia = '字'.repeat(CARD_VISUAL_VIA_MAX + 1);
  const problems = cardVisualProblems({ kind: 'tree', roots: [{ text: '根', children: [{ text: '子', via: longVia }] }] });
  assert.ok(problems.some((p) => p.includes('上限')));
});

test('表格：每列格數要跟欄數一樣', () => {
  const ok = { kind: 'table' as const, corner: '誰', columns: ['甲', '乙'], rows: [{ head: '一', cells: ['a', 'b'] }] };
  assert.deepEqual(cardVisualProblems(ok), []);
  const bad = { ...ok, rows: [{ head: '一', cells: ['a'] }] };
  assert.ok(cardVisualProblems(bad).some((p) => p.includes('欄數')));
});

test('流程與對照照舊檢查', () => {
  assert.ok(cardVisualProblems({ kind: 'flow', lanes: [{ steps: [{ text: '只有一步', tone: 'plain' }] }] }).length > 0);
  assert.deepEqual(cardVisualProblems({ kind: 'versus', left: { title: '甲', points: ['a'] }, right: { title: '乙', points: ['b'] } }), []);
});
