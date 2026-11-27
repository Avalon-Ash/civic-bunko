// 卡片架構圖的資料檢查（ADR 0025）：流程、對照、樹狀圖、表格四種形狀與字數，只在這裡判斷。
// tools/validate/cards.mjs 經 tsx 呼叫它；畫法在 ui/kit/Visual.tsx。
import {
  CARD_FLOW_STEPS,
  CARD_TABLE_COLUMNS_MAX,
  CARD_TABLE_ROWS_MAX,
  CARD_TREE_DEPTH_MAX,
  CARD_TREE_NODES_MAX,
  CARD_VERSUS_POINTS_MAX,
  CARD_VISUAL_TEXT_MAX,
  CARD_VISUAL_VIA_MAX,
} from '../core/constants/cards';
import type { CardVisual, VisualNode, VisualTone } from '../core/types';

const TONES: ReadonlySet<VisualTone> = new Set(['plain', 'hot', 'key']);
const len = (s: string) => [...s].length;

/** 這個節點底下（含自己）有幾層 */
export function treeDepth(node: VisualNode): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(treeDepth));
}

/** 這棵樹（含自己）有幾個節點 */
export function treeSize(node: VisualNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + treeSize(child), 0);
}

/** 架構圖哪裡不對（空陣列＝沒問題） */
export function cardVisualProblems(v: CardVisual): string[] {
  const out: string[] = [];
  const text = (t: unknown, what: string, max = CARD_VISUAL_TEXT_MAX) => {
    if (typeof t !== 'string' || !t.trim()) out.push(`${what}是空的`);
    else if (len(t) > max) out.push(`${what}「${t}」${len(t)} 字，上限 ${max}`);
  };
  const tone = (t: unknown) => {
    if (t !== undefined && !TONES.has(t as VisualTone)) out.push(`tone 不合法：${String(t)}`);
  };

  switch (v.kind) {
    case 'flow':
      if (!Array.isArray(v.lanes) || v.lanes.length === 0) out.push('flow 至少要一列');
      for (const lane of v.lanes ?? []) {
        const n = lane.steps?.length ?? 0;
        if (n < CARD_FLOW_STEPS.min || n > CARD_FLOW_STEPS.max) {
          out.push(`flow 每列要 ${CARD_FLOW_STEPS.min}–${CARD_FLOW_STEPS.max} 步`);
        }
        for (const s of lane.steps ?? []) {
          tone(s.tone);
          text(s.text, '流程的一步');
        }
      }
      break;
    case 'versus':
      for (const side of [v.left, v.right]) {
        if (!side) {
          out.push('versus 要有左右兩邊');
          continue;
        }
        text(side.title, '對照的標題');
        const n = side.points?.length ?? 0;
        if (n === 0 || n > CARD_VERSUS_POINTS_MAX) out.push(`versus 每邊要 1–${CARD_VERSUS_POINTS_MAX} 點`);
        for (const p of side.points ?? []) text(p, '對照的一點');
      }
      break;
    case 'tree': {
      if (!Array.isArray(v.roots) || v.roots.length === 0) out.push('tree 至少要一個最上層');
      if (v.legend !== undefined) text(v.legend, '圖例', CARD_VISUAL_TEXT_MAX);
      const walk = (node: VisualNode, depth: number, isRoot: boolean) => {
        text(node.text, '節點');
        if (node.note !== undefined) text(node.note, `「${node.text}」的補充`);
        if (node.via !== undefined) {
          if (isRoot) out.push(`最上層「${node.text}」不能有 via（沒有線連到它）`);
          text(node.via, `連到「${node.text}」的線`, CARD_VISUAL_VIA_MAX);
        }
        tone(node.tone);
        for (const child of node.children ?? []) walk(child, depth + 1, false);
      };
      for (const root of v.roots ?? []) {
        walk(root, 1, true);
        if (treeDepth(root) > CARD_TREE_DEPTH_MAX) out.push(`「${root.text}」底下超過 ${CARD_TREE_DEPTH_MAX} 層`);
      }
      const size = (v.roots ?? []).reduce((sum, root) => sum + treeSize(root), 0);
      if (size > CARD_TREE_NODES_MAX) out.push(`tree 有 ${size} 個節點，上限 ${CARD_TREE_NODES_MAX}`);
      break;
    }
    case 'table': {
      text(v.corner, '表格左上角');
      const cols = v.columns?.length ?? 0;
      if (cols === 0 || cols > CARD_TABLE_COLUMNS_MAX) out.push(`table 要 1–${CARD_TABLE_COLUMNS_MAX} 欄`);
      for (const c of v.columns ?? []) text(c, '欄名');
      const rows = v.rows?.length ?? 0;
      if (rows === 0 || rows > CARD_TABLE_ROWS_MAX) out.push(`table 要 1–${CARD_TABLE_ROWS_MAX} 列`);
      for (const row of v.rows ?? []) {
        text(row.head, '列名');
        if (row.cells?.length !== cols) out.push(`「${row.head}」那列有 ${row.cells?.length ?? 0} 格，要跟欄數 ${cols} 一樣`);
        for (const cell of row.cells ?? []) text(cell, `「${row.head}」的一格`);
      }
      break;
    }
    default:
      out.push(`visual.kind 不認得：${String((v as { kind?: unknown }).kind)}`);
  }
  return out;
}
