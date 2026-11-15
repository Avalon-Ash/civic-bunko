import { NEGATIVE_ASK } from '../core/constants/study';
import type { AskType } from '../core/types';

/** 依題幹文字判斷問法為正向（問哪個對）或反向（問哪個錯）。 */
export function askTypeOf(stem: string): AskType {
  return NEGATIVE_ASK.test(stem) ? 'negative' : 'positive';
}
