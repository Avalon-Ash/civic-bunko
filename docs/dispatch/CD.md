# 派工單 CD1／CD2：圖卡架構圖重畫

開案書：`docs/plans/card-diagrams.md`（先讀 §3、§4）。決策：`docs/adr/0025-card-visual-tree-table.md`。

## 目標
考生說圖卡的架構圖「簡化過頭」。把每張卡的 `visual` 改成能看出**整張卡架構**的圖：有層級或分支就用 `tree`，比較 3 個以上對象或 2 個以上面向就用 `table`；真的是一條順序或兩邊對照才保留 `flow`／`versus`，但要比現在完整。

## 範圍
- **CD1**：`data/packs/local4-civil/cards/concept.json`、`concept_1-public-admin.json`、`concept_2-chinese.json`、`concept_3-high-freq.json` 裡的卡，**除了**已經改好的 4 張樣張（`concept-law-rank`、`concept-central-local`、`concept-remedy-route`、`concept-lg-supervision`）。
- **CD2**：`newlaw.json`、`essay-local-gov.json`、`essay_chinese.json` 裡的全部卡。
- 只改每張卡的 `"visual"` 那一段。`faces`、`hook`、`comic`、`questions`、`lawRefs`、其他檔案一律不動；檔案其他部分的排版、縮排、換行一個字都不能變。

## 先看樣張
`concept.json` 的 `concept-law-rank`、`concept-central-local`、`concept-remedy-route`，`concept_3-high-freq.json` 的 `concept-lg-supervision`。形狀與上限照 `src/core/types.ts` 的 `CardVisual`、`VisualNode`，以及 `src/core/constants/cards.ts`：
- 樹最多 4 層、16 個節點；節點 `text`、`note` 各最多 14 字；線上的字 `via` 最多 8 字，最上層不能有 `via`。
- 表格最多 3 欄、6 列，每格最多 14 字，每列格數要等於欄數。
- `tone`：`key`＝粗框（一定要寫 `legend` 說明粗框代表什麼）；`hot`＝紅框，只給「問法陷阱」（例：省不是自治團體）；其他不寫。

## 內容規則（最重要）
- 圖上的每個事實都要找得到出處：該卡的 `faces`，或該卡 `lawRefs` 指到的條文。條文在 `data/laws/<pcode>.json`（法規名稱對 pcode 查 `data/laws/index.json`；`articles[].no` 是條號、`text` 是條文）。
- 條文沒寫的不准自己補（年份、人數、機關名稱都一樣）。卡片原文是通說講法的（行政學的學者與理論），照卡片原文，不另外加新說法。
- 一張圖要涵蓋整張卡，不是只畫一面。
- 原本的圖已經完整而且適合（例：兩個概念各 2–3 點的對照），可以不改，但要在報告裡寫理由。

## 只能跑這些指令
`npm run validate`、`npm test`、`npx tsc --noEmit`。每個指令單獨一次呼叫，字串照抄，不加 `cd`，不用 `&&` 或 `;` 串接。讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。

## 韁繩
- 只准改工作資料夾內，上面範圍裡的卡片檔。`src/**`、`tools/**`、測試、驗收腳本一律不准改；需要改就停下回報。
- 不准 commit（主席審 diff 後代為提交）。
- 規格矛盾，或 `npm run validate` 同一個錯修兩次還在，就停下回報。
- 驗收：`npm run validate` 顯示 `ERROR=0`、`npm test` 全過。

## 報告（最後的回覆）
每張卡一行：卡片 ID｜選的形狀｜對照了哪幾條條文（或「只用卡片原文」）｜沒改的寫理由。最後貼 `npm run validate` 的 cards 那一行輸出。
