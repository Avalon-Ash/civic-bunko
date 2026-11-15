// SSOT：每日目標、蓋章與集章獎勵。
import type { AccessoryId } from '../types';

/** 一個小任務的題數 */
export const MISSION_SIZE = 5;
/** 當天刷滿幾題（作答或看答案都算）才蓋章；等於三個小任務 */
export const DAILY_GOAL_QUESTIONS = 15;
/** 每累積幾個章解鎖一個配件 */
export const STAMPS_PER_REWARD = 3;

/** 配件依解鎖順序排列：第 N 個在累積 N × STAMPS_PER_REWARD 個章時解鎖 */
export const ACCESSORIES: ReadonlyArray<{ id: AccessoryId; name: string }> = [
  { id: 'bow', name: '蝴蝶結' },
  { id: 'straw-hat', name: '草帽' },
  { id: 'scarf', name: '圍巾' },
  { id: 'flower', name: '小花' },
  { id: 'glasses', name: '圓眼鏡' },
  { id: 'crown', name: '皇冠' },
];
