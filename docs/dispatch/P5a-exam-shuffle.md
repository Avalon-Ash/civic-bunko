# 派工單 P5a：模擬考模式、選項打亂

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：(1) 她可以挑一份官方考卷，照考場的方式計時寫完整份，交卷後才看分數與錯題；(2) 平常刷題可以打開「選項打亂」，避免只記得答案在第幾個。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p5a`，分支 `p5a`。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不要再改）

- `src/core/types.ts`：`RoundConfig.exam?: { paperId, minutes } | null`；`RoundState.startedAt?`、`RoundState.optionOrder?: Record<QuestionId, Choice[]>`；`Settings.shuffleOptions?`；`UICommand` 的 `setShuffleOptions`。
- `src/core/constants/exam.ts`：`EXAM_SECONDS_PER_QUESTION`、`EXAM_WARN_SECONDS`。
- `src/systems/settings.ts` 的 `setShuffleOptions`、`src/core/commands.ts` 的分派、`persistence.ts` 對 `settings.shuffleOptions` 的存取都已完成。

## 1. 模擬考

### 邏輯
- `startRound` 收到 `config.exam` 時：題目序列＝該試卷所有 `parseStatus === 'ok'` 的題目，**照題號由小到大**，不洗牌、不受 `count`／`mode`／`ask` 影響；`study` 視為 `quiz`；記下 `startedAt`（由注入的 `now`）；不產生 `optionOrder`。試卷不存在或沒有題目就不開回合。
- 作答沿用 `answerQuestion`（照常發 `answered`，進度與每日題數照算）。模擬考中 `combo` 不必顯示。
- 交卷：題目全部答完時照既有流程結束；中途按「交卷」或時間到，都走既有的 `quitRound`（已答的保留）。一題都沒答就離開＝丟棄。
- `retryWrong`、`quizSameSet` 產生的新回合不帶 `exam`（變成一般回合）。
- `persistence.ts`：回合續接要保留 `config.exam`、`startedAt`、`optionOrder`（形狀不合法就丟棄整個回合）。計時照牆上時鐘：App 關掉期間時間照走。
- 新 selector（`src/selectors/exam.ts`）：
  - `examPapers(world, bankId)` → 依科目順序（`bank.subjects` 的順序）、年度新到舊列出每份試卷 `{ paperId, subjectKey, subjectName, year, exam, count, minutes }`；`minutes = ceil(count × EXAM_SECONDS_PER_QUESTION / 60)`；只列有題目的試卷。
  - `examClock(world, now)` → 不是模擬考回合回傳 `null`；否則 `{ remainingSeconds, totalSeconds, warn, expired }`（`remainingSeconds` 最小為 0；`warn` 是剩餘 ≤ `EXAM_WARN_SECONDS`）。
  - `examResult(world)` → 上一回合（`world.lastRound`）是模擬考時回傳 `{ paperId, total（整份題數）, answered, correct, score（round(correct / total × 100)）, wrong: Array<{ id, no, pick, answer }> }`，否則 `null`。

### 畫面
- 「刷題」分頁（`DrillSetupScreen`）最上方加一張入口卡：「模擬考：整份考卷、計時、交卷才看答案」。點了開抽屜（`Sheet`）：依科目分組列出試卷，每列顯示「115 年普考・50 題・60 分鐘」這類文字（考試名稱：`general`＝普考、`local4`＝地特四等；沿用專案裡既有的顯示方式，有就重用）。點一列再按「開始」才開考。
- 作答畫面（`QuestionScreen`）在模擬考回合時：
  - 上方顯示倒數（`mm:ss`，每秒更新；`warn` 時換提醒樣式）、「第 7 / 50 題」、「交卷」按鈕。
  - 點選項＝作答，**不顯示對錯、不顯示口訣卡、不噴特效**，短暫標示選中的選項後自動進下一題。
  - 「交卷」先跳自製 `Dialog` 確認（顯示還有幾題沒寫）；時間到直接交卷並用 `Toast` 說「時間到，已交卷」。
  - 白話版、逐選項抽屜在模擬考中不提供。
- 結果畫面（`ResultScreen`）在 `examResult` 有值時：大字分數、「答對 38 / 50，沒寫 2 題」、錯題清單（題號＋題幹前段＋你選的與正解）。點一題開抽屜看完整題目、口訣、陷阱、圖、逐選項說明（重用作答畫面既有的回饋元件；需要時把共用部分抽到 `src/ui/components/`）。保留既有的「錯題重刷」。

## 2. 選項打亂

- 回合設定抽屜／畫面加一個 `Switch`：「選項打亂」，說明一行「每題四個選項換位置，代號不變」。切換時 `dispatch({ type: 'setShuffleOptions', on })`，狀態讀 `getSettings`。
- `startRound`、`retryWrong`、`quizSameSet` 開出的**作答**回合：`settings.shuffleOptions` 為真且不是模擬考時，用注入的 `rng` 為序列裡每一題產生 `optionOrder`（四個代號的排列，用 `selection.ts` 既有的 `shuffle`）。看答案模式不打亂。
- `currentQuestion` 多回傳 `optionOrder: Choice[]`（沒打亂就是 `['A','B','C','D']`）。作答畫面照這個順序畫選項，**代號維持官方的 A–D**（口訣與官方更正說明會提到代號，所以不重新編號）。作答的 `pick` 仍是官方代號。
- 作答後的回饋、逐選項抽屜照官方 A–D 順序顯示即可。

## 可修改檔案

`src/systems/round.ts`、`src/systems/selection.ts`、`src/systems/persistence.ts`、`src/selectors/index.ts`、`src/selectors/exam.ts`（新增）、`src/ui/App.tsx`、`src/ui/app.css`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/components/**`（`cards/` 子資料夾除外）、`src/testing/**`，以及上述檔案的測試。其他一律不准改，特別是 `src/core/**`、`src/systems/settings.ts`、`src/ui/screens/CardsScreen.tsx`、`src/ui/components/cards/**`、`src/main.tsx`、`src/theme.css`、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/exam.ts`、`src/systems/round.ts`、`src/systems/selection.ts`、`src/systems/persistence.ts`、`src/selectors/index.ts`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/kit/Sheet.tsx`、`src/ui/kit/Dialog.tsx`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS（`dist/assets/index-*.js`）小於 380 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。
新邏輯都要有測試：模擬考序列照題號且不洗牌、`startedAt`、交卷與時間到保留已答、`examPapers` 排序與分鐘數、`examClock`（含跨過期）、`examResult` 分數以整份題數為分母、`optionOrder` 只在開關開啟的作答回合產生且是四個代號的排列、模擬考不打亂、存檔往返保留三個新欄位、壞資料丟棄。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM，時間與亂數由參數注入（畫面上的每秒更新用 `setInterval` 觸發重畫即可，剩餘時間一律由 `examClock` 算）。
- 觸控區至少 44pt；抽屜與對話框用 `src/ui/kit/`；動態效果尊重 `prefers-reduced-motion`；手機 320pt 寬到 iPad 都不能破版。
- 不准改 `types.ts` 與常數、不准安裝套件、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
