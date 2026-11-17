# 派工單 PK1：內容包路徑

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/content-packs.md` §2、§3、§4。
- **目標**：題庫內容已經搬到 `data/packs/local4-civil/`，程式和工具還指著舊路徑，現在全部壞掉。做完後一切照舊運作，而且以後多放一個 `data/packs/<id>/` 資料夾就多一個題庫，不必再改程式或工具的路徑。
- **模型與強度**：`gemini-4-hydrogen-high`（機械性改動，規格明確）。
- **工作區**：`C:\Git\_wt_civic_packs`，分支 `packs`。只准改這個資料夾內的檔案。

## 已由主代理做好（已提交，不要再動）

- 搬動（只改名，內容沒變）：
  - `data/official/` → `data/packs/local4-civil/official/`
  - `data/enrich/` → `data/packs/local4-civil/enrich/`
  - `data/zh/` → `data/packs/local4-civil/zh/`
  - `data/cards/` → `data/packs/local4-civil/cards/`
  - `data/topics.json` → `data/packs/local4-civil/topics.json`
  - `tools/zh/src/*.json` → `tools/zh/src/local4-civil/*.json`
- `data/banks.json` 已刪除，改成 `data/packs/local4-civil/pack.json`：**一個物件**（不是陣列），欄位和原本的 `Bank` 相同，另外多一個 `exams`（這一包先不用它）。
- `data/laws/`、`data/raw/` 沒有動，路徑不變。

## 要做的事

1. **`src/data/source.ts`**：所有 `import.meta.glob` 改掃 `data/packs/*/…`。
   - 題庫清單：掃 `data/packs/*/pack.json`（eager），每個檔是一個 `Bank`，組成 `Bank[]`，依 `id` 排序。
   - 試卷索引：掃 `data/packs/*/official/index.json`（eager），把各包的 `papers` 合併成一份 `PaperIndex`。
   - 試卷、加工、圖卡、中譯、考點：掃各包底下對應的資料夾或檔案，維持延後載入；多包時把結果合併。
   - 對外匯出的函式名稱、參數、回傳型別都不變（`loadBankMeta`、`loadPapers`、`loadEnrichFiles`、`loadCardFiles`、`loadTopics`、`loadZhFiles`），所以 `src/main.tsx` 不用改。
2. **新增 `tools/paths.mjs`**：工具取得內容路徑的唯一來源。至少匯出：
   - `listPacks()`：`data/packs/` 底下有 `pack.json` 的資料夾 id，排序後回傳。
   - `packPaths(packId)`：回傳這一包的 `root`、`packFile`、`officialDir`、`officialIndex`、`enrichDir`、`zhDir`、`cardsDir`、`topicsFile`、`zhSrcDir`（`tools/zh/src/<packId>`）。
   - `resolvePack(argv)`：命令列有 `--pack <id>` 就用它；沒有而且只有一包就用那一包；沒有而且有多包就印出可用的 id 並以非零結束。
   - 共用路徑 `LAWS_DIR`、`RAW_DIR`。
3. **所有工具改用 `tools/paths.mjs`**，檔案裡不再出現 `data/official`、`data/enrich`、`data/zh`、`data/cards`、`data/topics.json`、`data/banks.json` 這些字串（註解也一起改）：
   - `tools/validate/validate.mjs`、`enrich.mjs`、`cards.mjs`、`zh.mjs`：**逐包檢查**（`listPacks()` 迴圈）。每一包印一行統計，格式和現在完全相同，只在最前面加上 `[<packId>] `。任何一包有 ERROR 就以非零結束。另外加一個跨包檢查：試卷 ID、題目 ID、卡片 ID 不得在不同包之間重複。
   - `tools/parser/parse.mjs`、`tools/zh/build.mjs`：寫入 `resolvePack()` 決定的那一包。
   - `tools/crawler/**`、`tools/laws/**`：只用到 `data/raw`、`data/laws` 的話，改成從 `tools/paths.mjs` 取 `RAW_DIR`、`LAWS_DIR`，行為不變。
   - 原本讀 `data/banks.json` 的地方改讀該包的 `pack.json`（現在是物件，不是陣列）。
4. **測試與註解**：`src/**/*.test.ts`、`tools/**/*.test.mjs` 裡讀舊路徑的地方改成新路徑；`src/core/types.ts`、`src/core/world.ts` 等檔案**註解**裡提到的舊路徑改成新路徑（這兩個檔只准改註解）。
5. `package.json` 的 `validate` 指令如果需要調整就調整，但指令名稱不變。

## 可修改檔案

- `src/data/**`
- `tools/**`（`tools/validate/golden/**` 不准改）
- `src/**/*.test.ts`：只准改路徑字串，不准改斷言
- `src/core/types.ts`、`src/core/world.ts`、其他 `src/**`：只准改註解裡的路徑
- `package.json`：只准改 `scripts.validate`

其他一律不准改，包含 `data/**`、`docs/**`、`AGENTS.md`、`CLAUDE.md`、`vite.config.ts`、`public/**`、`.github/**`。

## 必讀檔案

`AGENTS.md` §2、`docs/plans/content-packs.md`、`src/data/source.ts`、`src/data/sourceLoader.ts`、`src/data/source.test.ts`、`tools/validate/*.mjs`、`tools/zh/build.mjs`、`tools/parser/parse.mjs`、`data/packs/local4-civil/pack.json`。

## 驗收指令（只能跑這些；每個單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）

- `npm run lint`
- `npm run validate`
- `npm test`
- `npm run build`
- `node tools/zh/build.mjs`

全部通過的標準：

- `npm run lint` 結束碼 0。
- `npm run validate` 印出這四行（順序不拘），結束碼 0：
  - `[local4-civil] papers=25 questions=925 needs_review=0 ERROR=0 WARN=0`
  - `[local4-civil] enrich files=25 items=925 low_confidence=0 law_changed=1 ERROR=0`
  - `[local4-civil] cards files=7 cards=57 essays=16 ERROR=0`
  - `[local4-civil] zh files=5 items=100 segments=155 ERROR=0`
- `npm test`：測試數不少於 131，全部通過。
- `npm run build` 成功，`dist/precache.json` 的 `files` 是 92 個。
- `node tools/zh/build.mjs` 跑完後，`data/packs/local4-civil/zh/` 的檔案內容沒有任何變動。

## 韁繩

- 驗收腳本的檢查強度不准降低：原本會報錯的情況，改完還是要報錯。測試只准改路徑字串。
- 不為了通過檢查改資料：`data/**` 一個字都不准動。
- 不新增耦合：內容路徑只定義在 `tools/paths.mjs`（工具）與 `src/data/source.ts`（App）兩處，其他地方一律從這兩處取，不要再各自拼路徑字串。
- 不准吞錯誤、不准 mock 被驗證的對象。
- 只結束自己啟動的行程（記下 PID；不用名稱或萬用條件結束行程）。
- 不准 commit、push、切分支、安裝套件。
- 規格互相矛盾，或同一個驗收失敗兩次：停下來回報，不要再想辦法讓它過。

## 什麼時候停下來問

- 驗收數字和上面不同，而且原因不是路徑。
- 需要改「可修改檔案」以外的檔案。
- 發現有工具把題庫 id、科目或考試別寫死在程式裡（列出檔案與行號回報，這一包不處理）。

## 回報格式

最後的回覆用這個格式，不要寫效果形容詞：

```text
完成項（每項附 檔案:行號）：
驗收結果（每個指令一行：指令、結束碼、關鍵輸出）：
沒做或有疑慮的：
發現但沒處理的寫死內容（檔案:行號）：
```
