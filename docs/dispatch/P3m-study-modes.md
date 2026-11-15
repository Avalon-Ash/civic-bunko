# 派工單 P3m：看答案模式、先刷正向題

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：使用者（零法學基礎、無法快速分辨對錯）需要兩件事：
  1. **看答案模式**：題目和正解一起出現，不用作答，一批題目看 N 遍記起來。
  2. **先刷正向題**：預設只出「何者正確」這類正向問法的題，等她建立知識脈絡後才加入「何者錯誤」的反向題。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_modes`，分支 `p3m`。只准改這個資料夾內的檔案。

## 已由主代理改好（在你的工作區，尚未提交）

- `src/core/types.ts`：`AskType`、`AskFilter`、`StudyMode`；`RoundConfig` 多了 `study`、`ask`、`passes`；`RoundState` 多了 `pass`；`Progress` 多了 `views`；`AppEvent` 多了 `viewed`；`UICommand` 多了 `quizSameSet`。
- `src/core/constants/study.ts`：反向問法的判斷式 `NEGATIVE_ASK`、遍數選項、解鎖提示門檻。
- **改完後 `npm run lint` 目前會失敗，修好它是你的工作之一。** 讀回舊存檔時缺的欄位要補預設值（`views: 0`、`study: 'quiz'`、`ask: 'positive'`、`passes: READ_PASSES_DEFAULT`）。

## 邏輯層

- `src/systems/askType.ts`：`askTypeOf(stem: string): AskType`，用 `NEGATIVE_ASK` 判斷；純函式，寫測試（至少 8 個正反例，例如「下列何者錯誤？」「何者非屬」「下列何者正確？」「應以何機關為…」）。
- `selection.ts`：`buildQueue` 依 `config.ask` 篩題（`all` 不篩）。`mixed` 模式的優先序改為：到期 → 上次答錯 → **看過但還沒作答過**（`views > 0 && seen === 0`）→ 沒看過也沒作答 → 其餘。
- `round.ts`：
  - `study: 'read'`：不接受 `answer`。`next` 時對目前這題發 `viewed`，再往下一題；到最後一題時，若 `pass < passes` 則 `pass + 1`、用注入的 `rng` 重新洗牌、回到第一題；否則結束回合（`roundFinished` 的 `results` 為空陣列）。`quitRound` 直接結束。
  - `quizSameSet`：用 `lastRound.queue` 同一批題目開一個 `study: 'quiz'` 的新回合（去除重複、順序洗牌，其餘設定沿用）。
- `scheduling.ts`：訂閱 `viewed`，該題 `views + 1`、更新 `lastAt`，不動 `seen`／`correct`／`streak`／`due`；發 `progressChanged`。沒有進度紀錄的題要先建立一筆（`seen: 0`、`due: null`）。
- `selectors`：新增 `askCounts(world, config)` → `{ positive, negative }`（依目前科目篩選）；`positiveCoverage(world, bankId, subjectKeys)` → 正向題中「看過或作答過」的比例；`readView(world)` → 看答案畫面要的資料（題目、題組、加工內容、問法、目前第幾遍、共幾遍、第幾題、共幾題、這題看過幾遍）。

## 畫面

### 回合設定
- 最上方「怎麼刷」二選一（`Segmented`）：**自己作答**／**看答案**。
- 「題型」三選一：**正向題**（預設）／**全部**／**反向題**，各自顯示題數。下面一行小字解釋：「正向題＝問『哪個對』；反向題＝問『哪個錯』，等熟了再加。」
- 看答案模式時：多一個「看幾遍」選擇（`READ_PASSES_PRESETS`），並隱藏「快刷」開關與「只刷錯題／到期複習」。
- `positiveCoverage ≥ POSITIVE_UNLOCK_RATIO` 且目前選的是正向題時，顯示一張提示卡（貓 `yay` 表情）：「正向題已經看過六成，可以試試加入反向題了」，附一顆「加入反向題」按鈕（把題型切成全部）。不自動切換。
- 今日畫面的三個快速任務一律用 `ask: 'positive'`、`study: 'quiz'`。

### 看答案畫面 `src/ui/screens/ReadScreen.tsx`
- 上方：進度條、「第 2 遍・7 / 20」、結束鈕。題幹照常顯示紅藍標記；右上角小圓點顯示這題看過幾遍（最多畫 5 點，超過顯示數字）。
- **正向題**：正解選項直接以綠色大卡顯示（含選項字母）；另外三個收在一列「另外三個是錯的（點開看）」，點開才顯示，顯示時為淡色並標「錯」。
- **反向題**：題幹下方先放一行提示「這題問的是哪一句錯」。把官方答案**以外**的三個選項排在「這 3 句是對的，可以記」區塊，各自綠色勾勾；官方答案那一句放在最下面的「這句是錯的」區塊，文字加刪除線。有加工內容時，錯的那句下面顯示它的 `why`。
- 有官方更正（多個答案）的反向題：所有官方答案都放「這句是錯的」，其餘放「對的」。
- 下方：有加工內容就顯示口訣卡（口訣、小圖、陷阱，沿用既有元件，不顯示「答對／差一點」字樣）；沒有就不顯示。
- 操作：整張畫面下方一顆大的「下一題」；左滑也是下一題。每換一題，卡片有一個輕微的滑入動畫（只動 `transform`／`opacity`，尊重 `prefers-reduced-motion`）。
- 一遍看完進入下一遍時，中間閃一下「第 N 遍」的橫幅。

### 結果
- 看答案回合結束：章的文字「看完了」，顯示「N 題 × M 遍」；按鈕「換我作答這批」（`quizSameSet`）、「再看一批」、「回今日」。

## 可修改檔案

`src/systems/**`、`src/selectors/**`、`src/core/commands.ts`、`src/ui/**`、`src/main.tsx`、`src/testing/**` 及測試。其他一律不准改，包含 `src/core/types.ts`、`src/core/constants/**`、`src/theme.css`、`package.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/study.ts`、`src/systems/selection.ts`、`src/systems/round.ts`、`src/systems/scheduling.ts`、`src/systems/persistence.ts`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS 小於 320 kB。新邏輯都要有測試：問法判斷、依題型篩題、看答案回合的多遍流程與洗牌、`viewed` 只加 `views`、`quizSameSet`、舊存檔補預設值。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM，時間與亂數由參數注入。
- 不准改 `types.ts` 與常數、不准安裝套件、不准弱化或刪除既有測試（因介面改變而必須調整的斷言要在回報裡逐一列出）。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小與被調整的既有測試清單。
