# 派工單 P1e-1：App 核心與 System（不含畫面）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **包 ID／開案書章節**：P1e-1／`docs/plans/civic-bunko.md` §4「App 架構：ECS＋SSOT」
- **目標**：做出刷題 App 的資料與邏輯層：載入題庫、依設定組題、推進回合、記錄進度、存到裝置。全部可以不開瀏覽器用 `node:test` 測。下一包（畫面）只會透過這一包的 `selectors` 與 `dispatch` 讀寫狀態。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_core`，分支 `p1e-core`。只准改這個資料夾內的檔案。

## 成品（三組）

### 1. 核心 `src/core/`

- `bus.ts`：`createBus()` → `{ on(type, handler): () => void; emit(event: AppEvent): void }`。`on` 回傳取消訂閱的函式；handler 依訂閱順序同步呼叫。
- `world.ts`：`World` 介面與 `createWorld(): World`。欄位：
  `banks: Bank[]`、`papers: Map<PaperId, Paper>`、`questions: Map<QuestionId, OfficialQuestion>`、`groups: Map<string, PassageGroup>`、`enrich: Map<QuestionId, Enrich>`、`progress: Map<QuestionId, Progress>`、`round: RoundState | null`、`lastRound: RoundState | null`（剛結束的那一回合，給結果畫面用）、`settings: Settings`、`bus`。
- `store.ts`：給 React `useSyncExternalStore` 用的訂閱層：`subscribe(world, listener): () => void`、`getVersion(world): number`。任何事件發出後版本號加一並通知 listener。
- `commands.ts`：`dispatch(world, cmd: UICommand, deps?: { now?: () => Date; rng?: () => number }): void`，把指令轉給對應的 System。這是畫面寫入狀態的唯一入口。

### 2. System `src/systems/`（純邏輯，不碰 DOM、不直接用 `localStorage`、不直接用 `Date.now()`／`Math.random()`，一律由參數注入）

| 檔案 | 擁有的欄位 | 行為 |
| :-- | :-- | :-- |
| `bankLoader.ts` | `banks`、`papers`、`questions`、`groups`、`enrich` | `loadBank(world, banks, files: PaperFile[])` 把資料放進 world 並發 `bankLoaded`。`parseStatus !== 'ok'` 的題目仍放進 `questions`，但選題時要排除。 |
| `selection.ts` | 無（純函式） | `buildQueue(world, config, now, rng): QuestionId[]`。依 `bankId`、`subjectKeys`（空陣列＝全部）篩題；`mode`：`new`＝沒作答過的；`wrong`＝上次答錯的；`due`＝`progress.due` 已到期的；`mixed`＝到期 → 上次答錯 → 沒作答過 → 其餘，依此優先序補滿。每一層內用 `rng` 洗牌。回傳不重複、最多 `config.count` 題；題不夠就回傳實際數量。 |
| `round.ts` | `round`、`lastRound` | 處理 `startRound`、`answer`、`next`、`quitRound`、`retryWrong`。`answer`：同一題只能答一次；判定對錯（`pick` 在 `answer` 陣列內）；更新 `combo`（答錯歸零）；發 `answered`。`next`：還沒作答不動；最後一題之後 `finished`，把回合搬到 `lastRound`、`round` 設 `null`，發 `roundFinished`。`quitRound`：只保留已作答的結果後結束；一題都沒答就直接丟棄不發事件。`retryWrong`：用 `lastRound` 答錯的題目開新回合（沿用原設定，`count` 為錯題數）。 |
| `scheduling.ts` | `progress` | 訂閱 `answered`：更新 `seen`、`correct`、`streak`、`lastPick`、`lastAt`、`due`。答錯：`streak` 歸零、`due` 為 `REVIEW_INTERVAL_DAYS[0]` 天後。答對：`streak` 加一；`streak` 達 `GRADUATE_STREAK` 則 `due = null`；否則 `due` 為 `REVIEW_INTERVAL_DAYS[streak]` 天後（超出陣列用最後一個）。第一次就答對的新題直接 `due = null`。之後發 `progressChanged`。 |
| `settings.ts` | `settings` | 處理 `setTheme`；訂閱 `roundStarted` 記下 `lastRound` 設定（`settings.lastRound`）；發 `settingsChanged`。 |
| `persistence.ts` | 無（只序列化） | `attachPersistence(world, storage: { getItem(k): string \| null; setItem(k, v): void })`：啟動時從 `STORAGE_KEY` 讀回 `progress` 與 `settings`（資料壞掉就當作沒有，不丟例外）；訂閱 `progressChanged`、`settingsChanged` 後寫回。`exportProgress(world): string`、處理 `importProgress`（格式不對就不動現有資料並回報失敗）與 `resetProgress`。 |

規則：一個欄位只有上表那個 System 能寫；其他 System 要改就發事件。數值一律從 `src/core/constants/round.ts` 取，不寫魔術數字。型別一律從 `src/core/types.ts` import，不重複宣告；`types.ts` 缺什麼就停下回報，不要自己加。

### 3. Selector 與資料來源

- `src/selectors/index.ts`（唯讀，畫面讀取狀態的唯一入口）：
  `currentQuestion(world)` → `{ question, group, enrich, index, total, pick, isCorrect, combo } | null`；
  `roundSummary(world)` → 剛結束回合的 `{ total, correct, wrongIds } | null`；
  `subjectStats(world, bankId)` → 每科 `{ key, name, short, total, seen, correctRate }`；
  `dueCount(world, bankId, now)`；`wrongCount(world, bankId)`；
  `daysLeft(bank, now)`（以當地日期計，考試當天為 0，過了不為負）；
  `availableCount(world, config, now)`（這個設定最多能出幾題）。
- `src/data/source.ts`：用 `import.meta.glob` 載入 `data/banks.json`、`data/official/index.json` 與各 `data/official/*.json`，回傳 `{ banks, files }`。`data/official` 目前還不存在（另一包正在產生），所以 glob 找不到檔案時要回傳空陣列而不是出錯。這個檔案不必寫測試。

### 測試

`src/systems/*.test.ts`、`src/selectors/*.test.ts`，用 `node:test` 與 `node:assert/strict`。測試資料放 `src/testing/fixture.ts`，內容用明顯的假題（例如「測試題 1」），不要編造看起來像真考題的文字。至少涵蓋：四種選題模式與題數不足、同一題不能答兩次、中途結束、錯題重刷、連對與歸零、複習到期日的每個分支、更正題（`answer` 有兩個選項時兩個都算對）、存檔往返與壞資料。

## 可修改檔案

- 新增：`src/core/bus.ts`、`src/core/world.ts`、`src/core/store.ts`、`src/core/commands.ts`、`src/systems/**`、`src/selectors/**`、`src/data/**`、`src/testing/**`
- 其他一律不准改，包含 `src/core/types.ts`、`src/core/constants/**`、`package.json`、`tsconfig.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md`、`src/core/types.ts`、`src/core/constants/round.ts`、`docs/plans/civic-bunko.md` §3–§4。

## 驗收指令（只能跑這兩個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
```

逾時：各 180 秒。及格：兩個都退出碼 0。`npm run lint` 包含 `tsc --noEmit`（strict、`noUncheckedIndexedAccess`、`noUnusedLocals`）與禁用彈窗、`as any` 的檢查。

## 韁繩

- `types.ts`、常數、lint 腳本、`tsconfig.json` 不准改；覺得不合理就停下回報。
- 不准用 `as any`、`@ts-ignore`、`@ts-expect-error`；不准為了過測試而弱化斷言或跳過測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報現況。
- 不准 commit 或做任何 git 操作。不要寫任何畫面元件（`.tsx`）。

## 回報格式

照 `AGENTS.md` §6。另外列出每個檔案匯出的函式簽章（下一包要照這個接畫面），以及兩個驗收指令的退出碼與最後幾行輸出。
