# 0011 題庫拆分為內容包並以引擎邊界腳本守門

狀態：採用
日期：2026-11-17
取代：0007

## 背景

原扁平目錄與登記檔設計將特定考試名稱、科目與 `ExamKind` 寫死在引擎與工具中；使用者於 2026-11-17 同意拆分內容包，使引擎不認識任何單一題庫，多放一個資料夾即可新增題庫，同時保證現有使用者的題目、進度、同步與畫面行為維持不變。

## 決定

- 每個題庫獨立為 `data/packs/<packId>/` 資料夾，內含 `pack.json`（登記 `id`、`title`、`examDate`、`subjects[]`、`exams[]`）、`official/`、`enrich/`、`zh/`、`cards/`、`topics.json`；包與包之間不互相引用，共用參考法規維持於 `data/laws/`，中譯來源放 `tools/zh/src/<packId>/`。
- App 取得題庫清單與資料的唯一入口為 `src/data/source.ts`（掃描 `data/packs/*/pack.json`）；Node 工具取得內容包與共用路徑的唯一入口為 `tools/paths.mjs`（`listPacks`、`packPaths`、`resolvePack`），其他檔案不得自行拼接內容路徑。
- `ExamKind` 改為字串 key，顯示名稱從 `pack.json` 的 `exams` 讀取。
- 新增 `tools/lint/engine-boundary.mjs` 掛入 `npm run lint`：讀取所有 `data/packs/*/pack.json`，禁止 `src/**/*.ts(x)`（排除測試與 fixture）出現任何包的 id、資料夾名、科目 key／名稱／短名、考試別 key／顯示名稱字面值，且只允許 `src/data/**` 引用 `data/`。

## 放棄的做法

`docs/plans/content-packs.md` §1 將「執行時下載題庫（真正的 DLC）」列為不在範圍；其餘方案，原紀錄沒有寫。

## 後果

- 引擎與單一考試分離，新增題庫時只須新增 `data/packs/<packId>/` 與對應驗證資料。
- 由 `tools/lint/engine-boundary.mjs`、`tools/paths.test.mjs` 與逐包執行的 `tools/validate/*.mjs` 守門。
- 代價是所有新功能（含小貓台詞 `src/core/constants/catLines.ts`）皆不得寫入具體考試名稱、年度或科目，且多包切換介面（PK3）留待第二個題庫到位後再實作。

## 證據

- `AGENTS.md` §2「架構（ECS＋SSOT）」
- `docs/HANDOFF.md`「使用者已決定」
- `docs/plans/content-packs.md` §§1–4
- `src/data/source.ts`、`src/core/types.ts`、`tools/paths.mjs`、`tools/paths.test.mjs`、`tools/lint/engine-boundary.mjs`、`data/packs/local4-civil/pack.json`、`package.json`
