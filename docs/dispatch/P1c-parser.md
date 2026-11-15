# 派工單 P1c：官方 PDF 解析器

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **包 ID／開案書章節**：P1c／`docs/plans/civic-bunko.md` §4
- **目標**：把 `data/raw/` 的 55 個考選部 PDF 轉成 App 可用的官方題庫 JSON。題目文字與答案必須和官方 PDF 完全一致。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_parser`，分支 `p1c-parser`。只准改這個資料夾內的檔案。

## 成品

1. `tools/parser/parse.mjs`（可拆成同資料夾的其他 `.mjs`）。只用 Node 內建模組與已安裝的 `pdfjs-dist`（`import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'`）。不要安裝其他套件、不要改 `package.json`。
2. `data/official/<PaperId>.json`，每份試卷一檔，形狀是 `src/core/types.ts` 的 `PaperFile`。
3. `data/official/index.json`，形狀是 `PaperIndex`。
4. `tools/parser/parse.test.mjs`：針對純函式的 `node:test` 測試（至少涵蓋答案表對位、更正備註解析、選項切分）。

`PaperId` = `<year>-<exam>-<subjectKey>`（取自 `data/raw/manifest.json`），例 `115-general-admin-law`。`bankId` 一律 `local4-civil`。共 25 份試卷。

## 可修改檔案

- 新增：`tools/parser/**`、`data/official/**`
- 其他一律不准改，包含 `tools/validate/**`、`tools/crawler/**`、`data/raw/**`、`src/core/types.ts`、`package.json`、`docs/**`。

## 必讀檔案

`AGENTS.md`、`src/core/types.ts`（輸出形狀）、`tools/validate/validate.mjs`（及格條件）、`data/raw/manifest.json`。

## 已確認事實（主代理用 pdfjs 實測）

- `getTextContent()` 的每個 item 有 `str`、`transform[4]`（x）、`transform[5]`（y，往上遞增）、`fontName`。同一行的字 y 相同或相差 1–2；要自己依 y 分行、依 x 排序再接起來。
- 試題 PDF 表頭有「代號」「頁次」「考試別／等別／類科／科目／考試時間／座號／※注意」等欄位，每頁上方還有頁首（代號、頁次）。這些不屬於題目。
- 項目符號與**選項標記 (A)(B)(C)(D) 是私用區字元**（U+E000–U+F8FF，例如注意事項的 U+E129、U+E12A），字型名稱和內文不同。請用 `--dump` 看每個碼位對應什麼，建立對照表；輸出的文字不得殘留私用區字元。
- 題號是行首的阿拉伯數字（不帶「題」字），後面接題幹；選項有時四個各一行，有時兩個一行，有時四個擠同一行，要靠選項標記字元切分。
- 題幹與選項會跨行、跨頁；跨行接起來時中文之間不加空白。
- 混合題型（地方自治概要、國文）：先是「甲、申論題部分」（國文是作文），再是「乙、測驗題部分」。申論題放進 `essays`，測驗題才進 `questions`。
- 國文與英文有題組（一段文章配數題）：文章放進 `groups`，相關題目的 `groupId` 指向它；不是題組的題目 `groupId` 為 `null`。
- 答案 PDF（`-S.pdf`）：有一行「單選題數：50題」。答案表每列 10 題：「第N題」在 (x, y)，它的答案字母在同一欄、下方約 19 單位（x 約多 12）。**用座標把每個字母配到最近的「第N題」**，不要靠順序。
- 更正答案 PDF（`-M.pdf`）：同樣的表，有更正的題答案格是 `#`，底部「備註：第32題答Ａ或Ｂ者均給分。」（全形字母）。更正題：`answer` 填更正後給分的選項，`correction.original` 填 `-S.pdf` 的原答案，`correction.note` 填備註原文，一律給分時 `answer` 填四個選項且 `allCredit: true`。沒有更正的題 `correction` 為 `null`。

## 行為要求

- `node tools/parser/parse.mjs`：解析全部試卷並寫出 JSON，結束時印一行摘要（試卷數、題數、`needs_review` 數）。
- `node tools/parser/parse.mjs --dump`：把每個 PDF 的文字項目（頁、x、y、字型、文字、私用區碼位）寫到 `tools/parser/.dump/<examCode>-<檔名>.txt` 供你用檔案工具閱讀，不寫 `data/official`。`.dump` 不提交。
- 某題切不出四個選項、或文字可疑：`parseStatus: "needs_review"` 並在 `reviewNote` 寫原因，盡量保留已解析到的文字。**不准猜、不准用模型補寫或改寫題目文字。**
- 每題 `id` = `<PaperId>-q<兩位數題號>`；超過 99 題不會發生。

## 驗收指令（只能跑這五個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
node tools/parser/parse.mjs --dump
node tools/parser/parse.mjs
node tools/validate/validate.mjs
node --test tools/parser/parse.test.mjs
npm run lint
```

逾時：各 300 秒。及格：`validate.mjs` 退出碼 0 且 `ERROR=0`、測試全過。

## 韁繩

- 驗收腳本、黃金答案、`types.ts` 不准改；覺得它們有錯就停下回報。
- 不准為了過驗收而把壞題標成 `ok`、塞假選項、刪題、寫死答案。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報現況。
- 不准 commit 或做任何 git 操作。

## 什麼時候停下來問

- 任一份試卷 `needs_review` 超過 5%，而且原因不是你能從 dump 看懂的版面問題。
- 發現試卷不是單選四選一（例如複選題）。

## 回報格式

照 `AGENTS.md` §6。另外附：每份試卷的題數、申論題數、題組數、`needs_review` 數；私用區碼位對照表；五個驗收指令的退出碼與最後一行輸出。
