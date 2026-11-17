// 自由亂跑的小貓：在不在家、有沒有人要放牠出來或叫牠回來。只在記憶體，不存檔（每次打開 App 都在家）。
import { useSyncExternalStore } from 'react';

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
  | { kind: 'recall' };

export interface PetState {
  out: boolean;
  request: PetRequest | null;
  /** 每個新請求遞增，PetLayer 用它判斷是不是新的 */
  seq: number;
}

let state: PetState = { out: false, request: null, seq: 0 };
const listeners = new Set<() => void>();

function set(next: PetState): void {
  state = next;
  for (const fn of listeners) fn();
}

export function getPet(): PetState {
  return state;
}

export function subscribePet(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePet(): PetState {
  return useSyncExternalStore(subscribePet, getPet, getPet);
}

export function releasePet(from: PetRect): void {
  if (state.out) return;
  set({ out: true, request: { kind: 'release', from }, seq: state.seq + 1 });
}

export function recallPet(): void {
  if (!state.out) return;
  set({ out: true, request: { kind: 'recall' }, seq: state.seq + 1 });
}

/** 小貓進家門了（動畫跑完，或要立刻收回時） */
export function petHome(): void {
  if (!state.out) return;
  set({ out: false, request: null, seq: state.seq + 1 });
}
