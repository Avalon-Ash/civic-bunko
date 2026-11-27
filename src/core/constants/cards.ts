// SSOT：卡片的字數上限。tools/validate/cards.mjs 經 tsx 直接讀這裡（npm run validate 帶 --import tsx），只有這一份。
export const CARD_TITLE_MAX = 16;
export const CARD_HOOK_MAX = 30;
export const CARD_HEADING_MAX = 10;
export const CARD_LINE_MAX = 30;
export const CARD_FACE_LINES_MAX = 3;
export const CARD_FACES_MAX = 5;
/** 卡片 visual（流程圖、表格）每一格的字數上限 */
export const CARD_VISUAL_TEXT_MAX = 14;
