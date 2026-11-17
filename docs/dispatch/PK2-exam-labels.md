# 派工單 PK2：考試別顯示名稱從題庫登記讀

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。
**探索只用檔案工具（讀檔、搜尋）；終端機只能跑下面「驗收指令」清單裡的指令，跑了清單外的指令整個執行會被終止。**

- **對應開案書**：`docs/plans/content-packs.md` §3 的 PK2。
- **目標**：引擎不再認識任何一個題庫的考試別。畫面上「普考／地特四等」這些顯示名稱改成讀題庫登記（`pack.json` 的 `exams`，載入後在 `world.banks[i].exams`），行為與畫面和現在完全相同。
- **模型與強度**：`gemini-4-hydrogen-high`（機械性改動，規格明確）。
- **工作區**：`C:\Git\_wt_civic_packs`，分支 `packs`，base SHA 見最後一行。只准改這個資料夾內的檔案。

## 已由主代理做好（不要再動）

- `src/core/types.ts`：`ExamKind` 已改成 `string`；新增 `ExamInfo { key, label }`；`Bank` 多了必填欄位 `exams: ExamInfo[]`。
- `data/packs/local4-civil/pack.json` 已有 `exams: [{ key: "general", label: "普考" }, { key: "local4", label: "地特四等" }]`，載入流程（`src/data/source.ts`）直接把整個 `pack.json` 當 `Bank`，所以 App 這邊 `exams` 已經在 `world.banks` 裡，不需要改載入。
- 守門腳本 `tools/lint/engine-boundary.mjs`（已掛進 `npm run lint`）：現在紅燈，列出引擎裡還寫死的字面值。你的工作就是讓它變綠。

## 要做的事

1. 新增 selector `examLabel(world: World, paper: Paper | { bankId: string; exam: ExamKind }): string`（放 `src/selectors/` 底下，從 `src/selectors/index.ts` 匯出，跟其他 selector 同一風格）：找 `world.banks` 裡 `id === paper.bankId` 的那一包，回傳 `exams` 裡 `key === paper.exam` 的 `label`；找不到時回傳 `paper.exam`（key 本身），不要丟例外、不要寫死任何名稱。
2. 三處寫死的顯示名稱改用它：
   - `src/ui/components/QuestionParts.tsx` 的 `formatExamLabel`（和用它的 `formatQuestionSource`）：兩者都要能拿到 `world` 或已算好的標籤——選最小的改法（例如 `formatExamLabel(world, paper)`、`formatQuestionSource(world, paper, …)`），並改好所有呼叫端（`DrillSetupScreen.tsx`、`ResultScreen.tsx`、其他用到的檔案，用搜尋找全部）。
   - `src/selectors/cards.ts` 的 `formatEssayPaperLabel`（`paper.exam === 'general' ? …`）。
3. 修好測試與夾具：`src/testing/fixture.ts` 的 `testBank`、`otherBank` 補上 `exams`（key 要對應夾具試卷用到的 `general`、`local4`；label 用測試用的名字，例如「測試甲考」「測試乙考」，**不要用真實的「普考」「地特四等」**）。新增 `examLabel` 的單元測試（登記有的 key、找不到 key 回傳 key、找不到題庫）。既有測試如果因為簽名改變而編譯失敗，只准改呼叫方式，斷言強度不得降低；原本斷言出現「普考／地特四等」字樣的測試，改成斷言夾具的 label。
4. 做完跑驗收指令，`npm run lint` 的 `engine-boundary ERROR` 必須是 0。

## 可修改檔案

- `src/selectors/**`（含新增 `examLabel` 與它的測試檔）
- `src/ui/**`
- `src/testing/fixture.ts`
- 其他 `src/**/*.test.ts(x)`：只准改呼叫方式與夾具引用，不准降低斷言
- 不准改：`tools/**`、`src/testing/golden/**`、`src/systems/persistenceGolden.test.ts`、`data/**`、`docs/**`、`package.json`、`src/core/types.ts`、`src/data/**`、`AGENTS.md`、`CLAUDE.md`

## 必讀檔案

`docs/plans/content-packs.md`、`tools/lint/engine-boundary.mjs`、`src/core/types.ts`、`src/selectors/cards.ts`、`src/selectors/index.ts`、`src/ui/components/QuestionParts.tsx`、`src/testing/fixture.ts`、`data/packs/local4-civil/pack.json`。

## 驗收指令（只能跑這些；每個單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）

- `npm run lint`
- `npm test`

全部通過的標準：`npm run lint` 結束碼 0（含 `engine-boundary ... ERROR=0`）；`npm test` 全過且測試數不少於 145。

## 韁繩

- 守門腳本、測試斷言的強度不准降低；不為了通過檢查改資料或改腳本。
- 不新增耦合：考試別的顯示名稱只從 `pack.json` 登記讀（透過 `examLabel`），不要在別處再寫一份對照表或 `if (exam === …)`。
- 不准吞錯誤、不准 mock 被驗證的對象。
- 只結束自己啟動的行程（記下 PID；不用名稱或萬用條件結束行程）。
- 不准 commit、push、切分支、安裝套件。
- 規格互相矛盾，或同一個驗收失敗兩次：停下來回報，不要再想辦法讓它過。

## 什麼時候停下來問

- 需要改「可修改檔案」以外的檔案。
- 守門腳本報出的項目不是考試別字面值（回報檔案:行號，不要自己處理）。

## 回報格式

```text
完成項（每項附 檔案:行號）：
驗收結果（每個指令一行：指令、結束碼、關鍵輸出）：
沒做或有疑慮的：
```
- base SHA: 8aac15b（加上本工單、型別與守門腳本的提交）
