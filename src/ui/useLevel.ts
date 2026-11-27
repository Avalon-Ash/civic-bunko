// 圖卡闖關的畫面狀態（docs/plans/level-mode.md §4）：開著哪一關、在第幾步、目前的回合是不是從關卡開的。
// 全部只在記憶體（App 持有）：切分頁回來還在，重開 App 就回到圖卡列表。不存檔。
import { createContext, useContext } from 'react';

/** 關卡的三步：看圖 → 配對 → 實戰 */
export type LevelStep = 'look' | 'match' | 'quiz';

export interface LevelState {
  cardId: string;
  step: LevelStep;
}

export interface LevelApi {
  level: LevelState | null;
  /** 打開一關（預設從看圖開始） */
  open: (cardId: string, step?: LevelStep) => void;
  setStep: (step: LevelStep) => void;
  close: () => void;
  /** 從關卡開這張卡的作答回合（回合結束時不跳刷題頁的結果頁） */
  startQuiz: (cardId: string) => void;
  /** 目前進行中的回合是從關卡開的 */
  quizFromLevel: boolean;
}

const LevelContext = createContext<LevelApi>({
  level: null,
  open: () => {},
  setStep: () => {},
  close: () => {},
  startQuiz: () => {},
  quizFromLevel: false,
});

export const LevelProvider = LevelContext.Provider;

export function useLevel(): LevelApi {
  return useContext(LevelContext);
}
