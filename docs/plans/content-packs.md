# 開案書：內容包（引擎與題庫分開）

開案：2026-11-17，Claude Fable 5.2。使用者 2026-11-17 同意動手。
主計畫 `docs/plans/civic-bunko.md` 不變；本檔只管「把題庫變成可抽換的內容包」。

## 1. 目標

- 引擎（`src/**`、`tools/**`）不認識任何一個題庫的名稱、科目、考試別。
- 一個題庫＝`data/packs/<packId>/` 一個資料夾，自帶登記檔與全部內容；多放一個資料夾，App 就多一個題庫。
- **行為不變**：她現在用的 App，題目、進度、同步、離線、畫面完全一樣。考試是 2026-12-05，12-02 起只修錯；這條線上的每一包都要能單獨回退。

不在範圍：執行時下載題庫（真正的 DLC）、題型擴充（見 §6）。

## 2. 內容包的形狀

```text
data/packs/<packId>/
  pack.json        登記檔：id、title、examDate、subjects[]、exams[]（考試別的 key 與顯示名稱）
  official/        官方題目（index.json＋每份試卷一檔），只由流水線產生
  enrich/          AI 加工，每份試卷一檔
  zh/              中英對照，由 tools/zh 產生
  cards/           圖卡
  topics.json      考點清單
data/laws/         法規副本：共用的參考資料庫，不屬於任何一包
data/raw/          官方 PDF 與下載紀錄：流水線的輸入，暫時不動
tools/zh/src/<packId>/   中譯來源
```

規則：
- 題目 ID、試卷 ID 全站唯一（跨包不得重複），進度與同步只認 ID。
- 包與包之間不互相引用；包可以引用 `data/laws`。
- 引擎取得「有哪些包」的唯一方式是掃 `data/packs/*/pack.json`；工具取得路徑的唯一方式是 `tools/paths.mjs`。

## 3. 拆包表（依序，前一包併入本分支後才派下一包）

| 包 | 內容 | 執行者 | 驗收（數字） |
| :-- | :-- | :-- | :-- |
| PK0 | 資料搬進 `data/packs/local4-civil/`、寫 `pack.json`、本檔與派工單 | 主代理（已完成） | `git status` 只有改名 |
| PK1 | 路徑：`src/data/source.ts` 改掃 `data/packs/*`；新增 `tools/paths.mjs`，所有工具改用它；驗證腳本逐包檢查 | agy Hydrogen high（機械性、規格明確） | 見 `docs/dispatch/PK1-paths.md` |
| PK2 | 考試別：`ExamKind` 改成字串 key，顯示名稱從 `pack.json` 的 `exams` 讀；新增 `tools/lint/engine-boundary.mjs`（引擎裡不得出現任何包的 id、科目、考試別字面值）並掛進 `npm run lint` | agy Hydrogen high；守門腳本由主代理先寫好（紅燈），執行者只負責讓它變綠 | 守門腳本 ERROR=0；其餘同 PK1 |
| PK3 | 題庫切換：`Settings.activeBankId`、`setActiveBank` 指令、只載入目前題庫的檔案、有兩包以上才出現的選擇器 | Sonnet 子代理（跨系統，要判斷） | **等第二個題庫的內容進來才派**：沒有第二包就沒辦法在真的 App 裡驗 |

Orchestrator（Argon 規劃）這次不試：Argon 週池只剩 1%。Codex 到 11/21 才恢復。

## 4. 怎麼證明行為不變（每一包都要過）

1. `npm run lint`、`npm test`（不得少於 131 個、全過）。
2. `npm run validate` 的四行統計與搬動前相同：`papers=25 questions=925 needs_review=0 ERROR=0 WARN=0`、`enrich files=25 items=925 low_confidence=0 law_changed=1 ERROR=0`、`cards files=7 cards=57 essays=16 ERROR=0`、`zh files=5 items=100 segments=155 ERROR=0`（PK1 之後每行前面多 `[local4-civil] `）。
3. `npm run build` 後 `dist/precache.json` 仍是 92 個檔；其中資料檔（試卷、加工、圖卡、中譯、考點、法規）的檔名與 `main` 打包出來的**完全相同**（檔名含內容雜湊，相同＝內容沒變）。由主代理比對。
4. `node tools/zh/build.mjs` 重跑後 `git status` 沒有變動。
5. 主代理在正式版預覽裡走一次：今日、刷 5 題、圖卡、模擬考交卷、集章。

## 5. 回退

- 整條線在分支 `packs`（clone：`C:\Git\_wt_civic_packs`）上做；每一包一個合併提交。
- 併入 `main` 之後要退：`git revert -m 1 <合併提交>`。資料只是改名，沒有任何內容被改寫。
- 使用者裝置上的進度、同步檔格式都不變，不需要遷移，也不需要回退資料。

## 6. 題型擴充（之後再開）

現在「一題」寫死成四選一。要支援多選、是非、填空，得把題目改成帶 `kind` 的型別，作答畫面與計分依種類登記。
這一段等手上有第二種題型的真實內容再派工。做法照使用者另一個專案 Group-Battler-FFT-Final 已經驗證過的三件事（2026-11-17 由 Sonnet 子代理只讀調查，路徑是那個 repo 裡的）：

1. **一張定義表**：`Record<QuestionKind, KindDef>`，題型的性質（幾個選項、能不能複選、怎麼算對）只寫在這張表，核心只讀表。參考 `data/status/effect_defs.ts`、`engine/core/Effects.ts`。
2. **handler 表要求每一種都有實作**：作答畫面與計分各一張以題型為鍵的映射型別，漏寫一種就編譯失敗。參考 `engine/systems/combat/SkillActions.ts`。
3. **棘輪測試**：掃原始碼，`kind === '…'` 這種散落分支的出現次數只准減不准增，歸零後鎖死。參考 `tests/EffectFieldsRatchet.test.ts`。

另外兩條配套：把「新增一種題型要動哪幾個檔」寫成固定清單（參考 FFT `docs/SKILL_PIPELINE_DESIGN.md`）；驗證腳本擋下沒登記的題型與欄位（參考 Kyoto-Bunko `validate_data.js`）。
Kyoto-Bunko 只有資料層的登記表與驗證，沒有行為分派可抄。FFT 否決過「元件儲存」方案，題目維持純資料。

## 7. 什麼時候停下來問

- 任何一包的驗收數字和 §4 不同。
- 需要改 `data/packs/**` 裡任何檔案的內容（本線只改名、不改內容；`pack.json` 例外）。
- 需要動同步檔格式、進度存檔格式、題目 ID。
