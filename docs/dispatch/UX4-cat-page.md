# UX4：小貓頁（配件格預設一個部位、任務與獎勵點得到去處）

執行者：agy `gemini-4-neon-medium`；工作資料夾 `C:\Git\_wt_civic_ux_cat`（分支 `ux4-cat`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
她說「任務引導沒有正確引導到要按的按鈕」「全部攤開、滑動太長」。小貓頁有 4,459px（5.3 個螢幕），任務、題數獎勵、成就、鎖住的配件都只有字、點了沒有去處。背景：`docs/plans/ux-cleanup.md` §1.1（G2、G4、G5、G9、G11）、§2.2 目的地表、§3 小貓那一列；引導架構 `docs/adr/0019-guide-targets-single-go.md`。小貓頁的設計來由在 `docs/plans/cat-house.md`（試衣間黏在上方是刻意的，不改）。

## 已經有的（主席放好了，直接用，不要改）
- `src/ui/useGuide.ts`：`useGo()` 拿到 `go(target)`；`guideAnchor(id)` 標落點（`<section {...guideAnchor('cat-wardrobe')}>`）；`useGuidePreset(preset, apply)` 接預選。
- `src/core/constants/guide.ts`：`GUIDE`（`questDone`、`fishBonus`、`stampsItem`、`achievementItem`、`fishShort`）、`ACHIEVEMENT_GO`（成就依 `metric` 去哪）。任務自己的目的地在 `QUESTS` 每列的 `go`（`quest.quest.go`）。**不改這兩個檔**。
- 落點 `cat-wardrobe`（換裝那一節）、`cat-achievements`（成就那一節）；預選 `all-achievements`（成就改成顯示全部）。

## 要做的（全在 `src/ui/screens/WardrobeScreen.tsx` 與 `src/ui/house/AdoptSheet.tsx`）
1. **落點與預選**
   - 「換裝」那一節（`cb-wd-dress`）標 `guideAnchor('cat-wardrobe')`；「成就」那一節（`cb-house-ach`）標 `guideAnchor('cat-achievements')`。
   - `useGuidePreset('all-achievements', () => setShowAllAch(true))`。
2. **點得到去處**（每一處都用 `go(...)`，不自己換分頁）
   - 今日任務那一列（`cb-wd-quest`，現在是 `div`）改成按鈕：沒做完 `go(quest.quest.go)`；做完 `go(GUIDE.questDone)`（就是捲到換裝）。今日特價那一列不動。
   - 題數獎勵：「今天刷了 N 題」那一行改成「題數獎勵・今天刷了 N 題」，5／15／30 題關卡下面加一顆小按鈕「去刷題」→ `go(GUIDE.fishBonus)`（全部達標就不顯示）。這張卡的 `data-cat-perch`、`data-cat-burn="cat-today"` 原樣留著，**不放進收合區**。
   - 成就卡：還沒解鎖的那幾張點了 `go(ACHIEVEMENT_GO[a.achievement.metric])`（用 `Card` 的 `onClick`，它會變成按鈕）；解鎖的不能點。`data-cat-perch` 留著。
   - 試衣間：「還差 N 條小魚乾，再刷幾題…」那句旁邊加「去刷題」→ `go(GUIDE.fishShort)`。試穿的是集章或成就送的配件時（`nonShopHint` 那句），旁邊加「去拿」：集章的 `go(GUIDE.stampsItem)`、成就的 `go(GUIDE.achievementItem)`（判斷沿用 `nonShopCondition` 用的那個 `state`，不另寫一份）。
   - 領養抽屜（`AdoptSheet.tsx`）「還差 N 條小魚乾，再刷幾題就能帶牠回家！」旁邊加「去刷題」：先關抽屜（`onClose()`）再 `go(GUIDE.fishShort)`。
3. **配件格預設只顯示一個部位**：`filter` 的預設值從 `'all'` 改成 `SLOTS` 的第一個部位（`SLOTS[0].id`；不要寫死 `'bg'`）。「全部」籤照舊在。

樣式只改 `src/ui/styles/wardrobe.css`、`src/ui/styles/house.css`。

## 可以改的檔（只有這些）
`src/ui/screens/WardrobeScreen.tsx`、`src/ui/house/AdoptSheet.tsx`、`src/ui/styles/wardrobe.css`、`src/ui/styles/house.css`。其他檔一律不改；覺得非改不可就停下回報。

## 不能碰壞的
- 試衣間黏在上方（`cb-wd-room`、`useStuck`）的結構不改。
- `data-cat-burn="cat-today"` 與所有 `data-cat-perch` 原樣留著。
- 存檔零新欄位：新的狀態只放元件狀態。不改 `src/testing/golden/**`、`src/core/**`。
- 不在 `src/` 寫科目名稱或考試名稱字樣（引擎邊界 lint）。不用瀏覽器彈窗。

## 紅色驗收（主席整合後重跑；你也跑）
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過（`src/ui/guide.test.ts` 會檢查落點只用 `guideAnchor('…')`、不重複）。
- 主席會在預覽 390×844 量：小貓頁空白存檔 ≤ 2,400px（現 4,459）；從今日頁點「今日任務」做完的那一張，落在換裝；成就卡點了到對的分頁。

## 指令
只能跑這三個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（測試、驗收腳本、`guide.ts` 不准改）。
- 不新增耦合（「哪種鎖住的配件去哪裡」只判斷一次；目的地只從 `GUIDE`／`ACHIEVEMENT_GO`／`quest.go` 取）。

## 什麼時候停下來回報
規格互相矛盾、同一個驗收失敗兩次、需要改「可以改的檔」以外的檔、需要新增存檔欄位或目的地。

## 回報
每個完成項附 `檔案:行號`；三個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
