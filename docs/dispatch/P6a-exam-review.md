# 派工單 P6a：模擬考可回頭改答案、題號總覽、歷次成績

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：模擬考像真的考試：交卷前可以回上一題、跳題、改答案；交卷後成績會留下來，下次看得到自己有沒有進步。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p6a`，分支 `p6a`。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不要再改）

- `src/core/types.ts`：`RoundState.examPicks?`、`ExamRecord`、`Settings.examHistory?`、事件 `examFinished`、指令 `examPick`、`examGoto`。
- `src/core/constants/exam.ts`：`EXAM_HISTORY_MAX`。
- `src/core/store.ts`：`examFinished` 已列入會觸發重畫的事件。

## 1. 作答改成「交卷才計分」

現況：模擬考每點一個選項就呼叫 `answerQuestion`，立刻發 `answered`、寫進 `results`，不能回頭。改成：

- 模擬考回合開始時 `examPicks = {}`。
- `examPick(world, pick)`（`src/systems/round.ts` 新增）：只在模擬考回合有效；把目前這題（`queue[index]`）的答案記進 `examPicks`（已有就覆蓋）。**不發 `answered`、不動 `results`、不換題**。
- `examGoto(world, index)`：只在模擬考回合有效；`index` 夾在 `0..queue.length-1`，改 `round.index`，`round.pick` 設成那題在 `examPicks` 裡的答案（沒有就是 `null`）。
- 模擬考回合裡，既有的 `answer`、`next` 指令不做事（回傳、不拋錯）。
- **交卷**（既有的 `quitRound`，按鈕與時間到都走它）在模擬考回合時：
  - `examPicks` 是空的 → 照舊丟棄回合（不留成績）。
  - 否則照題目序列順序，對每個有答案的題目：算對錯、推進 `results`、發 `answered`（`at` 用交卷時間）。然後照既有流程結束回合（`world.lastRound`、`roundFinished`），再發 `examFinished`，`record` 的 `total` 是整份題數（`queue.length`），`score = round(correct / total × 100)`。
- 寫完最後一題不自動交卷，要她自己按「交卷」。
- `src/systems/settings.ts`：在既有的 attach 函式裡訂閱 `examFinished`，把 `record` 加到 `settings.examHistory` 尾端，超過 `EXAM_HISTORY_MAX` 丟最舊的，照既有做法發 `settingsChanged`。
- `src/systems/persistence.ts`：回合續接保留 `examPicks`（鍵必須在 `queue` 裡、值必須是 A–D，否則丟棄整個回合）；設定保留 `examHistory`（逐筆驗形狀，壞的那筆丟掉，其餘留著）。
- `src/core/commands.ts`：只准加 `examPick`、`examGoto` 兩個 case（改了回合位置要 `bumpStore`）。
- `src/selectors/exam.ts`：
  - `examSheet(world)` → 不是模擬考回合回傳 `null`；否則 `{ index, total, answered, items: Array<{ index, no, picked: boolean, current: boolean }> }`。
  - `examHistory(world, paperId?)` → 新到舊的成績列表，每筆多附 `subjectName`、`year`、`exam`（從 `world.papers`／`world.banks` 查，試卷已不存在的那筆略過）；有給 `paperId` 就只回那份。
  - `examBest(world, paperId)` → 那份試卷的最高分，沒考過是 `null`。
  - `examResult` 維持現在的回傳形狀。

## 2. 畫面

- `QuestionScreen`（模擬考回合）：
  - 點選項 → `examPick`，選中的選項維持標示；回到已作答的題目時看得到之前選的，再點別的就是改答案。不顯示對錯。
  - 題目下方一排：「上一題」（第一題時停用）、「題號」（開題號總覽）、「下一題」（最後一題時換成「交卷」）。點選項後約 0.4 秒自動到下一題（最後一題不動；動態效果關閉時不延遲）。
  - 題號總覽用 `Sheet`：題號格子（一排 5–6 個，觸控區至少 44pt），已作答的填色、沒作答的空心、目前這題有外框；上方一行「已作答 12 / 50」。點格子 → `examGoto` 並關閉抽屜。
  - 上方既有的倒數、「第 7 / 50 題」、「交卷」按鈕保留；交卷對話框的未作答題數改用 `examSheet` 算。
- `DrillSetupScreen` 的模擬考試卷列表：考過的那份在右側顯示「最高 76 分」。
- `ResultScreen`（模擬考結果）：分數下方加一行和上一次同一份的比較（「比上次多 6 分」「和上次一樣」「比上次少 4 分」；第一次考不顯示）；再下面「這份的紀錄」列出最近 5 次（日期＋分數）。
- 顏色只用 token：已作答用粉彩或中性色，**不要用綠色**（綠色是正解的語意）。

## 可修改檔案

`src/systems/round.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/core/commands.ts`（只加兩個 case）、`src/selectors/exam.ts`、`src/ui/App.tsx`、`src/ui/app.css`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/components/**`（`cards/` 子資料夾除外）、`src/testing/**`，以及上述檔案的測試。其他一律不准改，特別是 `src/core/types.ts`、`src/core/constants/**`、`src/core/store.ts`、`src/ui/kit/**`、`src/ui/screens/CardsScreen.tsx`、`src/main.tsx`、`src/theme.css`、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/exam.ts`、`src/systems/round.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/core/commands.ts`、`src/selectors/exam.ts`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/kit/Sheet.tsx`、`src/ui/kit/Dialog.tsx`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS（`dist/assets/index-*.js`）小於 385 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

新邏輯都要有測試：`examPick` 不發 `answered`、可覆蓋；`examGoto` 夾範圍並帶回已選答案；模擬考中 `answer`／`next` 無效；交卷時才依序發 `answered` 且 `at` 是交卷時間；沒作答就交卷＝丟棄且不留成績；`examFinished` 的分數以整份題數為分母；`examHistory` 上限與新到舊排序；`examBest`；`examSheet`；存檔往返保留 `examPicks` 與 `examHistory`、壞資料的處理。既有測試裡假設「模擬考每答一題就發 `answered`」的要改成新行為（這是規格變更，不算弱化）；其他既有測試不准刪、不准弱化。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM，時間與亂數由參數注入。
- 觸控區至少 44pt；抽屜與對話框用 `src/ui/kit/`；動態效果尊重 `prefers-reduced-motion`；手機 320pt 寬到 iPad 都不能破版；日夜兩套都要能看。
- 不准改型別與常數、不准安裝套件。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
