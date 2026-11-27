# 0025 卡片架構圖加樹狀圖與表格，形狀檢查只在 systems/cardVisual.ts

狀態：採用
日期：2026-11-28

## 背景

卡片的 `visual` 跟題目解析共用 `EnrichVisual`，只有流程（一條或幾條箭頭鏈）與左右對照兩種，每格 14 字。考生回饋（使用者 2026-11-28 轉述）：圖卡最大的問題是架構圖簡化過頭。例如「法律位階」只畫得出「憲法 → 法律 → 命令」；地方層級、救濟分流、各層級由誰監督這類有分支、有多項比較的架構，兩種形狀都畫不出來。

## 決定

- 卡片的圖改用 `CardVisual`＝`EnrichVisual`＋兩種卡片專用形狀：
  - `tree`：層級與分流。節點可帶補充小字 `note`，連下來那條線上可以寫字 `via`（例：「30 日內」「牴觸無效」）；`legend` 說明粗框代表什麼。
  - `table`：同一件事在各層級怎麼做（例：直轄市、縣（市）、鄉（鎮、市）各由誰監督）。
- 題目加工層（`Enrich.visual`）仍只用流程與對照，`tools/validate/enrich.mjs` 不變。
- 四種形狀的檢查（形狀、字數、樹的層數與節點數、表格欄列數）只寫在 `src/systems/cardVisual.ts` 的 `cardVisualProblems`。`tools/validate/cards.mjs` 經 tsx 呼叫它（照 0024 的做法），不再自己判斷。
- 上限常數在 `src/core/constants/cards.ts`：樹最多 4 層、16 個節點，`via` 最多 8 字；表格最多 3 欄、6 列。
- 顏色照四色語意：紅框（`hot`）只給問法陷阱，粗框（`key`）用奶油色，不借綠色。

## 放棄的做法

- 畫成 SVG 組織圖（上到下展開）：320 寬放不下三層以上的分支。縮排樹在手機上可以一直往下長。
- 一張卡放多張圖：卡片已經有漫畫、圖、文字三層，再多一張會更長；一張樹狀圖就能涵蓋整張卡的架構。

## 後果

- 卡片 JSON 的 `visual` 可以是四種之一；舊的流程與對照照常有效，不需要遷移。
- 畫法在 `src/ui/kit/Visual.tsx`，樣式在 `src/ui/styles/visual-law.css`（`cb-tree`、`cb-vtable`）。
- 沒有存檔欄位變動。

## 證據

- `src/core/types.ts`（`CardVisual`、`VisualNode`）
- `src/systems/cardVisual.ts`、`src/systems/cardVisual.test.ts`
- `tools/validate/cards.mjs`
- `docs/plans/card-diagrams.md`
- [0024 驗證腳本經 tsx 直接讀 src 的常數](0024-validators-read-ts-constants.md)
