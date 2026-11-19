# 派工單 T1-tryon：試衣間可以同時試穿好幾個部位

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-wardrobe.md` §3（衣櫥頁 W2-ui）。
- **目標**：她在「小貓」分頁可以一次試穿好幾個部位（例如頭套＋連身裝＋嘴邊，看套裝效果），試衣間列出試穿中的每一件和合計價格，一鍵全部買下來；錢不夠時說還差多少。現在一次只能試一件，換一件前一件就脫掉。
- **模型與強度**：`gemini-4-neon-medium`（規格明確、紅色驗收已寫好、只動一個畫面檔加一個純函式檔）。
- **工作區**：`C:\Git\_wt_civic_catplay`，分支 `tryon`（base 是主代理已提交的那一筆，`git log -1` 看得到「T1-tryon 紅色驗收」）。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不要再改）
- `src/core/types.ts`：`TryOn` 型別（每個部位最多一件，跟 `Outfit` 同形狀）。
- `src/selectors/tryOn.test.ts`：紅色驗收。**不准改**；有你認為錯的斷言就停下回報。

## 要做的（3 件）

### 1. 純函式：`src/selectors/wardrobe.ts`（新增並 export，介面照測試）
- `toggleTryOn(tryOn, item): TryOn`：回傳新物件。那個部位試穿的就是這件→拿掉那個部位；不然把那個部位設成這件（同部位互換）。
- `tryOnPreview(outfit, tryOn): Outfit`：試穿的疊在目前穿著上。
- `tryOnBasket(statuses, tryOn, raw): TryOnBasketView`（介面也 export）：
  - `items`：還有效的試穿（配件認得、部位對得上、狀態不是 `owned`／`off`），照 `SLOTS` 陣列順序。
  - `shop`：`items` 裡狀態是 `buyable` 或 `short` 的（要花小魚乾買的）。
  - `total`：`shop` 的 `price` 合計（今天的價格，特價算特價）。`base`：`shop` 的原價合計（有 `base` 用 `base`，沒有用 `price`）。
  - `short`：`Math.max(0, total - raw)`。`raw` 是 `fishBalance().raw`（可以是負的，不要先夾成 0）。
  - `tryOn`：只留 `items` 那幾件的 `TryOn`（給 `tryOnPreview` 用）。
  - **買不買得起只在這裡判一次**：畫面不准再拿每件的 `buyable`／`short` 自己判整籃。
- `tryOnEffects(outfit, tryOn)`：回傳 `{ active: Array<OutfitSpecialView & { pending: boolean }>, near }`。`active`、`near` 都照 `outfitSpecialHints(tryOnPreview(outfit, tryOn))` 算；`pending` ＝ 這個效果不在 `outfitSpecialHints(outfit).active` 裡（要把試穿的拿到手才有）。重用 `outfitSpecialHints`，不准另寫一份套裝判斷。

### 2. 畫面：`src/ui/screens/WardrobeScreen.tsx`
- 試穿狀態改成 `useState<TryOn>({})`。每次渲染用 `tryOnBasket(statuses, tryOn, fish.raw)` 導出有效的籃子；預覽小貓與套裝效果都用 `basket.tryOn`（買完、成就剛好送到的那件會自動消失，不靠手動清）。
- 點配件格：
  - 已擁有：照舊穿上／脫掉（`wear` 指令），並把那個部位的試穿拿掉（看得到真的穿上去的樣子）。
  - 沒擁有：`toggleTryOn`。格子的 `is-trying` 與 `aria-pressed` 看 `tryOn[slot] === id`。
- 試衣間（`.cb-wd-room-info`），籃子有東西時：
  - 一列試穿籤：每件一顆按鈕（小圖示 `ItemIcon` size 20 左右＋名稱＋價格或「再 N 個章」「成就獎勵」），點了就脫掉那件，`aria-label` 寫「脫掉 XXX」。特價的照舊標 `今日特價`、考前限定標 `考前限定`（用現有的 `Chip` 或同樣的小標，挑一種，不要兩種都放）。
  - **試衣間是黏在上方的，高度不能跟著件數長**：籤那一列 `flex-wrap: nowrap`＋`overflow-x: auto`（橫向捲動、隱藏捲軸也可），不換行。
  - `shop` 有東西時：`short === 0` 顯示按鈕「🐟圖示 total 全部買下來」（只有一件時文字是「買下來」），`base > total` 時照舊用 `<s className="cb-wd-was">` 帶原價；`short > 0` 時不顯示買的按鈕，改一句「還差 N 條小魚乾，再刷幾題、或先脫掉幾件就買得起！」。
  - 「不試了」清空整籃。
  - 只有集章、成就配件時照舊顯示那件的取得條件（現有的「再蓋 N 個章就會送你」「解鎖成就…」文字），沒有買的按鈕。
- 全部買下來：照 `basket.shop` 的順序逐件 `dispatch(world, { type: 'buyItem', id })`，再逐件 `dispatch(world, { type: 'wear', slot, item: id })`，最後清空試穿、`setHappy` 加一次。不另寫扣款邏輯（`buyItem` 自己會重算餘額與特價）。
- 套裝效果列表改用 `tryOnEffects(outfit, basket.tryOn)`：`pending` 的那幾條後面加一小段「（買下來才有）」，用現有 `.cb-wd-fx-near` 的淡色字樣式或新增一個 class。沒有試穿時的那句「這身有套裝效果，把小貓放出來玩就看得到：」照舊。
- 沒有試穿時的說明改成「點下面的配件，小貓先穿給你看，可以同時試好幾個部位；買過的點一下就換上。」

### 3. 樣式與更新紀錄
- 樣式只加在 `src/ui/styles/wardrobe.css`；顏色只用 `src/theme.css` 的 token，不寫色碼。
- `src/core/constants/changelog.ts` 最前面加一則：`id: '2026-11-20-multi-try'`、`date: '2026-11-20'`、標題「試衣間可以一次試穿好幾件」、2–3 條她感受得到的說明（同時試穿頭頂、身上、嘴邊看套裝效果；合計價格一鍵買下；錢不夠會說還差多少）。

## 不做
- 不改存檔、同步、`src/systems/**`、`src/core/constants/wardrobe.ts`；試穿不進 `settings`。
- 不加「一鍵試穿整套」，不改配件格的版面。

## 必讀
- `AGENTS.md`（§2 架構與介面）、`src/ui/screens/WardrobeScreen.tsx`（全檔）、`src/selectors/wardrobe.ts`、`src/systems/wardrobe.ts` 的 `outfitSpecialHints`、`buyItem`、`src/ui/styles/wardrobe.css` 的 `.cb-wd-room*`、`.cb-wd-fx*`。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）

三個都要退出碼 0。`src/selectors/tryOn.test.ts` 與其他測試檔、`src/testing/golden/**` 一律不准改。

## 韁繩
- 驗收腳本與測試不准改；不准 mock 被驗證的對象、不准空的 `catch`、不准用 `?? 預設值` 讓缺欄位通過、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只改工作資料夾內這幾個檔：`src/selectors/wardrobe.ts`、`src/ui/screens/WardrobeScreen.tsx`、`src/ui/styles/wardrobe.css`、`src/core/constants/changelog.ts`。
- 不 commit、不切分支。
- 每個完成項附 `檔案:行號`。

## 回報格式（`AGENTS.md` §6）
```text
包 ID：完成／部分完成／阻塞
請求模型與強度；實際設定：工具確認值或「未確認」
工作區／base SHA：
變更檔案與行為（檔案:行號）：
檢查：指令、退出碼、ERROR/WARN 數
未確認項：
剩餘工作：
```
