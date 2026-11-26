# UX1：今日頁與集章頁（引導、收合、改叫法）

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_ux_today`（分支 `ux1-today`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
她說「任務引導沒有正確引導到要按的按鈕」「全部攤開、滑動太長」。這一包修今日頁與集章頁：叫法統一、設定收起來、每個「叫她去做某件事」的地方點了會到對的按鈕。背景：`docs/plans/ux-cleanup.md` §1、§2、§3（今日、集章兩列）；引導的架構在 `docs/adr/0019-guide-targets-single-go.md`。

## 已經有的（主席放好了，直接用，不要改）
- `src/ui/useGuide.ts`：`useGo()` 拿到 `go(target)`；`guideAnchor(id)` 標落點（展開在元素上：`<div {...guideAnchor('today-quick')}>`）；`useGuidePreset(preset, apply)` 接預選。
- `src/core/constants/guide.ts`：目的地表 `GUIDE`、`GO_*`。**不改這個檔**；需要新的目的地或落點就停下回報。
- `src/ui/kit/Collapse.tsx`：原地收合（`title`、`summary`、`open`／`onOpenChange` 受控或 `defaultOpen` 不受控；其他屬性會放到外層 `section`）。樣式在 `styles/kit.css`，**不改 kit.css**。

## 要做的（三件）
1. **今日頁**（`src/ui/screens/TodayScreen.tsx`）
   - 「今天的 3 個小任務」改叫「今天的 3 回快刷」；`aria-label` 的「個小任務」改「回快刷」；第 430 行左右的「三個任務都做完（15 題）才會蓋今天的章」改成「三回都刷完（…題）才會蓋今天的章」（題數照舊用 `DAILY_GOAL_QUESTIONS`）。
   - 三回快刷的**第一張**卡（行政法 5 題那一類的第一顆）標 `guideAnchor('today-quick')`。
   - 底部三塊設定（音效 Card、天氣天空 Card、檢查更新／更新紀錄／版本那一列）**原地**收進一個 `Collapse`，標題「設定」，預設收起；收起時的 `summary` 一行寫目前狀態，例如「音效開・天氣關」（從 `soundOn`、`weatherOn` 讀，不另存）。三塊內容與行為一律不變（天氣的定位詢問時機不能變：只有她當場打開開關、按「問天氣」才會問）。
   - 同步出錯的橫幅（`sync.status === 'error'` 那張卡）改成 `onClick={() => go(GUIDE.syncError)}`，不再用 `onGoStamps`；顯示條件拿掉 `onGoStamps &&`。
2. **集章頁**（`src/ui/screens/StampsScreen.tsx`、`src/ui/components/SyncBackupSection.tsx`）
   - 「幫小貓換裝」按鈕改 `go(GUIDE.dressCat)`。
   - 弱點考點的空狀態卡（「再多刷幾題，我就能找出你常錯的考點」）下面加一顆按鈕「去刷題」，`go(GUIDE.weakEmpty)`。卡片的 `data-cat-perch` 留著。
   - 高頻考點現在用 `Button` 自己做的收合（`freqOpen`）改用 `Collapse`：標題「高頻考點」，收起時 `summary` 寫「每科最常考的 N 個」；展開後內容照舊（`TopicList`）。外面那層 `<h2>高頻考點</h2>` 拿掉（標題已在 Collapse 上）。
   - 同步與備份整塊用 `Collapse` 包起來，預設收起，標 `guideAnchor('stamps-sync')`；標題「同步與備份」，收起時 `summary` 寫同步狀態（`getSyncState(world)` 的狀態翻成一句話：還沒開啟／已同步／同步中／出錯了）。**出錯時自動展開**；被引導來時展開：`useGuidePreset('open-sync', () => setSyncOpen(true))`。`SyncBackupSection` 裡原本的 `<h2>同步與備份</h2>` 拿掉或改成只在沒被包的時候顯示（擇一，寫在報告）。同步碼、備份、還原的按鈕與流程一律不變。
3. **樣式**：只改 `src/ui/styles/today.css`、`src/ui/styles/daily-stamps.css`、`src/ui/styles/sync.css`。

## 可以改的檔（只有這些）
`src/ui/screens/TodayScreen.tsx`、`src/ui/screens/StampsScreen.tsx`、`src/ui/components/SyncBackupSection.tsx`、`src/ui/styles/today.css`、`src/ui/styles/daily-stamps.css`、`src/ui/styles/sync.css`。其他檔一律不改；覺得非改不可就停下回報。

## 不能碰壞的
- `data-cat-burn` 的 `today-countdown`、`today-quest`、`stamps-hero` 三張卡與所有 `data-cat-perch` 原樣留著，**不放進收合區**、id 不改。
- 存檔零新欄位：收合開關只放元件狀態（`useState`），換頁回到預設。不改 `src/testing/golden/**`、`src/core/**`。
- 不在 `src/` 寫科目名稱或考試名稱字樣（引擎邊界 lint）。
- 不用瀏覽器彈窗（`alert`／`confirm`）。

## 紅色驗收（主席整合後重跑；你也跑）
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過。`src/ui/guide.test.ts` 會檢查你標的落點：只能用 `guideAnchor('…')`，同一個 id 只標一次。
- 主席會在預覽 390×844 量：今日頁空白存檔 ≤ 1,150px（現 1,410）；集章頁空白存檔 ≤ 1,350px（現 1,751）。

## 指令
只能跑這三個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（測試、驗收腳本、`guide.ts` 不准改）。
- 不新增耦合（同一個判斷不在多處重複；狀態翻成文字的對照放一處）。

## 什麼時候停下來回報
規格互相矛盾、同一個驗收失敗兩次、需要改「可以改的檔」以外的檔、需要新增存檔欄位或目的地。

## 回報
每個完成項附 `檔案:行號`；三個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
