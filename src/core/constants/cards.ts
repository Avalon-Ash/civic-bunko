// SSOT：卡片的字數上限。tools/validate/cards.mjs 經 tsx 直接讀這裡（npm run validate 帶 --import tsx），只有這一份。
export const CARD_TITLE_MAX = 16;
export const CARD_HOOK_MAX = 30;
export const CARD_HEADING_MAX = 10;
export const CARD_LINE_MAX = 30;
export const CARD_FACE_LINES_MAX = 3;
export const CARD_FACES_MAX = 5;
/** 卡片 visual（流程圖、表格）每一格的字數上限 */
export const CARD_VISUAL_TEXT_MAX = 14;
/** 架構圖（ADR 0025）：樹狀圖線上的字（via）上限；手機上線旁只放得下幾個字 */
export const CARD_VISUAL_VIA_MAX = 8;
/** 樹狀圖最多幾層：320 寬每往下一層縮排約 18px，四層後格子只剩一半寬 */
export const CARD_TREE_DEPTH_MAX = 4;
/** 樹狀圖最多幾個節點：再多就超過一個手機畫面，該拆成兩張卡 */
export const CARD_TREE_NODES_MAX = 16;
/** 流程圖每列幾步、對照每邊幾點 */
export const CARD_FLOW_STEPS = { min: 2, max: 5 } as const;
export const CARD_VERSUS_POINTS_MAX = 3;
/** 表格：最多幾欄（不含列名）、幾列；320 寬四欄（含列名）每欄約 65px */
export const CARD_TABLE_COLUMNS_MAX = 3;
export const CARD_TABLE_ROWS_MAX = 6;
