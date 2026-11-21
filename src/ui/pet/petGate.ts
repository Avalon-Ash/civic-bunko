// 多隻小貓同時出門時的共用節流（只在記憶體，不存檔）：
// 1. 自動出聲（哞、夢話、套裝台詞）：兩次之間至少間隔 HOUSE.voiceGapMs，被擋掉就不說、不排隊；點小貓不走這裡。
// 2. 改卡片的效果（燒焦、劈歪、爪痕、結冰）：同一張卡片同一時間只受一種效果，全家同一時間最多一隻在進行。
import { HOUSE } from '../../core/constants/house';
import type { CatId } from '../../core/types';

let lastVoiceAt: number | null = null;
let effectOwner: CatId | null = null;
const activeCards = new Set<Element>();

/** 嘗試取得自動出聲許可；距上一次出聲未滿 HOUSE.voiceGapMs 時回傳 false。 */
export function tryVoice(_cat: CatId, now: number = performance.now()): boolean {
  if (lastVoiceAt !== null && now - lastVoiceAt < HOUSE.voiceGapMs) {
    return false;
  }
  lastVoiceAt = now;
  return true;
}

/** 檢查這隻小貓目前能否進行改卡片的效果（選填 el 時一併檢查該卡片是否空著）。 */
export function canStartCardEffect(cat: CatId, el?: Element): boolean {
  if (effectOwner !== null && effectOwner !== cat) return false;
  if (el !== undefined && activeCards.has(el)) return false;
  return true;
}

/** 嘗試鎖定卡片效果；其他隻正在進行或該卡片已有效果時回傳 false。同一隻可同時鎖多張（例如企鵝結冰）。 */
export function tryCardEffect(cat: CatId, el: Element): boolean {
  if (!canStartCardEffect(cat, el)) return false;
  effectOwner = cat;
  activeCards.add(el);
  return true;
}

/** 結束這隻小貓在卡片 el 上的效果；全部結束後釋放全家鎖。非擁有者呼叫為 no-op。 */
export function endCardEffect(cat: CatId, el: Element): void {
  if (effectOwner !== cat) return;
  activeCards.delete(el);
  if (activeCards.size === 0) {
    effectOwner = null;
  }
}

/** 清掉這隻小貓名下所有卡片效果鎖（例如元件卸載或強制回家時避免殘留）。 */
export function clearCatEffects(cat: CatId): void {
  if (effectOwner !== cat) return;
  activeCards.clear();
  effectOwner = null;
}

/** 重設全部節流狀態（測試用）。 */
export function resetPetGate(): void {
  lastVoiceAt = null;
  effectOwner = null;
  activeCards.clear();
}
