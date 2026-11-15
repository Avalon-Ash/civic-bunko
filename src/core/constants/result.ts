export type ResultCatMood = 'yay' | 'idle' | 'oops';

export interface ResultTier {
  /** 最低答對率門檻（0 到 1，含） */
  readonly minRate: number;
  /** 印章完整文字 */
  readonly stampLabel: string;
  /** 印章顯示行（每行最多兩到三字） */
  readonly stampLines: readonly [string] | readonly [string, string];
  /** 結果頁小貓表情 */
  readonly catMood: ResultCatMood;
}

/** 回合結果依答對率分級的印章文案與小貓表情（SSOT）。 */
export const RESULT_TIERS: readonly ResultTier[] = [
  {
    minRate: 1,
    stampLabel: '全對！',
    stampLines: ['全對！'],
    catMood: 'yay',
  },
  {
    minRate: 0.8,
    stampLabel: '過關成功',
    stampLines: ['過關', '成功'],
    catMood: 'yay',
  },
  {
    minRate: 0.5,
    stampLabel: '再接再厲',
    stampLines: ['再接', '再厲'],
    catMood: 'idle',
  },
  {
    minRate: 0,
    stampLabel: '明天再戰',
    stampLines: ['明天', '再戰'],
    catMood: 'oops',
  },
] as const;

const FALLBACK_TIER: ResultTier = RESULT_TIERS[RESULT_TIERS.length - 1]!;

/** 依答對題數與總題數取得對應的結果分級。 */
export function getResultTier(correct: number, total: number): ResultTier {
  if (total <= 0) {
    return FALLBACK_TIER;
  }
  const rate = correct / total;
  for (const tier of RESULT_TIERS) {
    if (rate >= tier.minRate) {
      return tier;
    }
  }
  return FALLBACK_TIER;
}
