# UX2：刷題設定頁（更多設定收合、落點、預選）

執行者：agy `gemini-4-neon-medium`；工作資料夾 `C:\Git\_wt_civic_ux_drill`（分支 `ux2-drill`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
她說「任務引導沒有正確引導到要按的按鈕」「滑動太長」。刷題設定頁有九塊全攤開（1,283px）。這一包把次要設定收起來，並讓「今日任務」引導過來時落在對的按鈕、先選好對的設定。背景：`docs/plans/ux-cleanup.md` §2.2、§3（刷題那一列）；引導架構 `docs/adr/0019-guide-targets-single-go.md`。

## 已經有的（主席放好了，直接用，不要改）
- `src/ui/useGuide.ts`：`guideAnchor(id)` 標落點（展開在元素上：`<div {...guideAnchor('quiz-start')}>`）；`useGuidePreset(preset, apply)` 接預選（每次引導只呼叫一次）。
- `src/core/constants/guide.ts`：落點 `quiz-start`、`quiz-topic`、`quiz-exam`，預選 `wrong-mode`、`exam-sheet`。**不改這個檔**。
- `src/ui/kit/Collapse.tsx`：原地收合（`title`、`summary`、`defaultOpen`；其他屬性放到外層 `section`）。樣式在 `styles/kit.css`，**不改 kit.css**。

## 要做的（三件，全在 `src/ui/screens/DrillSetupScreen.tsx`）
1. **落點**：
   - 模擬考入口那張卡（`cb-exam-entry`）標 `guideAnchor('quiz-exam')`。
   - 弱點回合＋高頻回合那一列（`cb-quick-rounds`）標 `guideAnchor('quiz-topic')`。
   - 開始刷那一條（`cb-start-dock`）標 `guideAnchor('quiz-start')`；它的 `data-cat-floor` 原樣留著（小貓站在上面）。
2. **預選**：
   - `useGuidePreset('wrong-mode', …)`：出題模式改成錯題（`'wrong'`）。錯題模式不能配「看答案」（第 172 行左右有這條規則），所以同時把「怎麼刷」切回自己作答；寫法沿用畫面裡現有的切換函式，不另寫第二份規則。
   - `useGuidePreset('exam-sheet', …)`：打開模擬考的選卷抽屜（沿用現在點模擬考入口時呼叫的那個函式，第 199 行左右）。
3. **更多設定收合**：「題型」「出題模式」「選項打亂」三塊原地收進一個 `Collapse`，標題「更多設定」，預設收起；收起時 `summary` 用一行寫出目前的選擇（例：「正向題・混合・不打亂」；名稱從畫面現有的選項表讀，不另寫一份文字對照）。**出題模式被預選成錯題時要看得到**：`wrong-mode` 預選時把這個收合打開（受控 `open`），或讓 summary 寫出「錯題」（擇一，寫在報告）。「加入反向題」那張提示卡跟著題型一起收。模擬考、弱點／高頻、怎麼刷、題數、科目、範圍提示、開始刷的位置與順序都不變。

樣式只改 `src/ui/styles/study-modes.css`、`src/ui/styles/topics.css`。

## 可以改的檔（只有這些）
`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/styles/study-modes.css`、`src/ui/styles/topics.css`。其他檔一律不改；覺得非改不可就停下回報。

## 不能碰壞的
- 「開始刷」維持 `position: sticky` 黏在畫面底部（`.cb-start-dock`），`data-cat-floor` 留著。
- 上次的設定（`lastRound`）照舊帶入；存檔零新欄位：收合開關只放元件狀態。不改 `src/testing/golden/**`、`src/core/**`。
- 不在 `src/` 寫科目名稱或考試名稱字樣（引擎邊界 lint）。不用瀏覽器彈窗。

## 紅色驗收（主席整合後重跑；你也跑）
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過。`src/ui/guide.test.ts` 檢查落點只用 `guideAnchor('…')`、同一個 id 只標一次。
- 主席會在預覽 390×844 量：刷題頁空白存檔 ≤ 1,000px（現 1,283），而且開始刷在首屏看得到；從今日任務「錯題重做」點過來，出題模式已經是錯題。

## 指令
只能跑這三個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（測試、驗收腳本、`guide.ts` 不准改）。
- 不新增耦合（同一個判斷不在多處重複；「錯題不能配看答案」只留一處）。

## 什麼時候停下來回報
規格互相矛盾、同一個驗收失敗兩次、需要改「可以改的檔」以外的檔、需要新增存檔欄位或目的地。

## 回報
每個完成項附 `檔案:行號`；三個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
