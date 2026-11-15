// SSOT：看答案模式與問法分類的常數。
// 注意：tools/validate/enrich.mjs 有一份相同的反向問法判斷式（那邊是 .mjs，無法 import）；改這裡時要一起改。

/** 題幹出現這些用詞就是反向問法（問「哪個錯／哪個不是」） */
export const NEGATIVE_ASK =
  /何者(?:有誤|錯誤|不正確|為非|非屬|不屬|不是|不在|不包括|不得|不適用|不符|無法|不能|不須|不必|未)|下列(?:敘述)?何者.{0,12}(?:錯誤|不正確)|非屬|不屬於|不包括|不正確|有誤/;

/** 看答案模式：一批題目看幾遍 */
export const READ_PASSES_PRESETS = [1, 2, 3, 5] as const;
export const READ_PASSES_DEFAULT = 3;

/** 正向題看過或作答過的比例達到這個值，就提示可以加入反向題 */
export const POSITIVE_UNLOCK_RATIO = 0.6;
