// 自由亂跑的小貓：在不在家、有沒有人要放牠出來或叫牠回來。只在記憶體，不存檔（每次打開 App 都在家）。
import { useCallback, useSyncExternalStore } from 'react';
import type { CatId } from '../../core/types';

export interface PetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type PetRequest =
  /** 從這個頭像放出來 */
  | { kind: 'release'; from: PetRect }
  /** 叫牠回家（跑回去、跳進頭像） */
  | { kind: 'recall' }
  /**
   * 想太久的提示：跳到這個選項上。right＝牠猜的是不是正確答案；
   * auto＝牠本來在家、為了提示自己跑出來的（提示完自己回家），from＝那時家的位置
   */
  | { kind: 'hint'; el: Element; right: boolean; auto: boolean; from: PetRect };

export interface PetState {
  out: boolean;
  request: PetRequest | null;
  /** 每個新請求遞增，PetLayer 用它判斷是不是新的 */
  seq: number;
}

const IDLE: PetState = { out: false, request: null, seq: 0 };
const states = new Map<CatId, PetState>();
const listeners = new Set<() => void>();

function set(cat: CatId, next: PetState): void {
  states.set(cat, next);
  for (const fn of listeners) fn();
}

export function getPet(cat: CatId): PetState {
  return states.get(cat) ?? IDLE;
}

export function subscribePet(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePet(cat: CatId): PetState {
  const get = useCallback(() => getPet(cat), [cat]);
  return useSyncExternalStore(subscribePet, get, get);
}

export function releasePet(cat: CatId, from: PetRect): void {
  const cur = getPet(cat);
  if (cur.out) return;
  set(cat, { out: true, request: { kind: 'release', from }, seq: cur.seq + 1 });
}

export function recallPet(cat: CatId): void {
  const cur = getPet(cat);
  if (!cur.out) return;
  set(cat, { out: true, request: { kind: 'recall' }, seq: cur.seq + 1 });
}

/** 想太久的提示：小貓跳到選項 el 上。牠在家的話會自己從 from 跑出來 */
export function hintPet(cat: CatId, el: Element, right: boolean, from: PetRect): void {
  const cur = getPet(cat);
  set(cat, { out: true, request: { kind: 'hint', el, right, auto: !cur.out, from }, seq: cur.seq + 1 });
}

/** 小貓進家門了（動畫跑完，或要立刻收回時） */
export function petHome(cat: CatId): void {
  const cur = getPet(cat);
  if (!cur.out) return;
  set(cat, { out: false, request: null, seq: cur.seq + 1 });
}
