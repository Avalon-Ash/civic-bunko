# 派工單 H3-house-screen：小屋畫面（全家同框、各自換裝與取名、領養）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §4.1。
- **目標**：「小貓」分頁變成小貓之家：上面是全家在房間裡活動，點一隻就選牠；名牌列看全家、領養新的一隻；下面的衣櫥換的是選中的那隻、名字牌改的也是牠。
- **模型與強度**：`gemini-4-neon-high`（一個新畫面＋改衣櫥頁，含一段可測試的房間動作邏輯）。
- **工作區**：`C:\Git\_wt_civic_house`，分支 `house`，base 是 `git log -1` 的那一筆（H1 已併入）。只准改這個資料夾內的檔案。

## 已經有的（不准改）
- 讀：`src/selectors/house.ts` 的 `houseCats`、`nextAdoption`、`leaderCat`、`catOutfit`；寫：`dispatch` 的 `adoptCat`、`wear`（帶 `cat`）、`setCatName`（帶 `cat`）、`setLeader`。規則在 `src/systems/house.ts`，畫面不准自己判斷「這隻是不是原本那隻」、不准自己算領養價格或餘額。
- 數字在 `src/core/constants/house.ts`；這包可以在檔尾**新增** `HOUSE_SCENE`（房間的高度、小貓圖寬、走路速度、各動作停多久、兩隻湊在一起的距離與機率），不准改既有的常數。

## 要做的（3 件）

### 1. 房間：新資料夾 `src/ui/house/`
- `houseLogic.ts`（純函式，不碰 DOM）：給「每隻現在在哪、在做什麼」和亂數，算出下一個動作：走到地板某處、坐、理毛（`groom`）、睡（`loaf`）、兩隻靠近時一起坐下互看（蹭蹭，頭上冒一顆 ♥）。同一時間最多一對在蹭蹭。新領養的那隻從右邊的門口走進來。
- `houseLogic.test.ts`：新增測試（用固定亂數）：每個動作的目標在房間範圍內；蹭蹭只發生在兩隻距離小於門檻時、同時最多一對；走進來的那隻起點在門口；`prefers-reduced-motion` 時不走動（只坐、理毛、睡）。
- `HouseScene.tsx`：房間（牆、地板、窗戶、坐墊、貓抓板、右邊的門）。窗外照現在的時段畫白天、傍晚、晚上（時段界線讀 `constants/cat.ts` 的 `CAT_DAY_PARTS`，不另寫一份）。每隻用 `CatBody` 畫，面向跟著走的方向。點一隻：選牠（頭上出現名字牌）、跳一下、喵（`data-sound="meow"`）。選中的那隻名字牌一直顯示，其他隻不顯示。
  - 房間不在畫面上（`IntersectionObserver`）或 App 在背景（`visibilitychange`）時停止動作計時器。
  - 每隻都是 `button`，`aria-label` 寫「名字，點一下選牠」，`aria-pressed` 表示選中。
  - 顏色只用 `src/theme.css` 的 token，深淺色兩套都要能看（窗戶、牆、地板在深色模式下不刺眼）。
- 樣式放新檔 `src/ui/styles/house.css`，在 `src/ui/app.css` 照其他樣式檔的方式 `@import`。

### 2. 衣櫥頁：`src/ui/screens/WardrobeScreen.tsx`
- 標題改成「小貓之家」（底部分頁的名稱「小貓」不改）。
- 由上到下：房間 → 名牌列 → 選中那隻的卡片 → 今天的關卡卡片（現有的） → 換裝（現有的試衣間與配件格） → 成就（現有的）。
- 選中哪隻：畫面狀態 `useState<CatId>`，預設 `leaderCat(world)`；選中的那隻如果不在家裡（不會發生，但要守）就回到 `leaderCat`。換一隻時清空試穿籃。
- **名牌列**：橫向一排（320pt 寬也不換行，橫向捲動），每格是那隻的小頭像（`Cat`，穿著用 `catOutfit`）＋名字；選中的有外框、`aria-pressed`。最後一格是「＋ 領養」：`nextAdoption` 是 `null` 就不顯示；價格 0 顯示「免費」，其他顯示 🐟 價格。
- **選中那隻的卡片**：名字牌（`CatNameEditor` 改成收 `cat` 參數，取名寫進那隻；對話框的標題、提示用那隻的名字與預設名），「陪我刷題」：是牠就顯示「現在陪你刷題」的小標，不是就給一顆按鈕「換牠陪我刷題」（`setLeader`）。
- **換裝**：試衣間顯示選中的那隻；`outfit` 改用 `catOutfit(world, selected)`；穿脫、全部買下來後的穿上都帶 `cat: selected`。配件格的「已擁有」照舊是全家共用的。試衣間的說明句把「小貓」換成那隻的名字。
- **領養抽屜**（`src/ui/kit/Sheet.tsx`）：標題「領養第 N 隻小貓」（N＝家裡隻數＋1）。內容：牠坐著的樣子（`CatBody`，跟著挑的毛色變）、名字輸入（最多 `CAT_NAME_MAX` 字，留空＝預設名，placeholder 是預設名）、毛色挑選（「原本的樣子」＋她已經有的毛色，用 `ItemIcon`）、價格。錢夠：按鈕「帶牠回家」→ `adoptCat`（帶 `name`、`fur`）、關抽屜、選中新的那隻、房間播走進門的動作。錢不夠：不顯示按鈕，改一句「還差 N 條小魚乾，再刷幾題就能帶牠回家！」（N 讀 `nextAdoption().short`）。
- 版面：手機直向照上面的順序；iPad 寬版（≥ 768px）房間佔滿上方寬度，下面照現有的兩欄；手機橫放（高 ≤ 500px）房間改用 `HOUSE_SCENE` 的矮高度，試衣間照現有規則不黏住。

### 3. 更新紀錄
- `src/core/constants/changelog.ts` 最前面加一則：`id: '2026-11-24-cat-house'`、`date` 填你做完的日期、標題「小貓之家：可以養好幾隻了」、3 條她感受得到的說明（最多 5 隻、第 2 隻免費；每隻各自取名、換衣服；全家在房間裡走來走去）。

## 不做
- 不改 `src/ui/pet/**`（`CatNameEditor.tsx` 除外）、`src/systems/**`、`src/selectors/**`、`src/core/types.ts`、存檔與同步。
- 不做「帶出門」開關、其他頁多隻亂跑（下一包）。
- 不改配件格的版面、商店、成就。

## 必讀
- `AGENTS.md`（§2 介面、架構）、`docs/plans/cat-house.md` §4.1、`src/selectors/house.ts`、`src/core/constants/house.ts`、`src/ui/screens/WardrobeScreen.tsx`（全檔）、`src/ui/pet/CatNameEditor.tsx`、`src/ui/kit/CatBody.tsx` 的 props、`src/ui/kit/Sheet.tsx`、`src/ui/kit/Cat.tsx` 的 `Cat`、`ItemIcon`、`src/ui/styles/wardrobe.css`（`.cb-wd-room*`、黏住的寫法）、`src/theme.css` 的 token、`src/core/constants/pet.ts` 的姿勢名稱。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）

三個都要退出碼 0。畫面由主代理開瀏覽器在 320、390、820 寬、深淺色看。

## 韁繩
- 既有測試與驗收腳本不准改；不准 mock 被驗證的對象、不准空的 `catch`、不准 `as any`、不准 `alert`／`confirm`／`prompt`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只讀、只改 `C:\Git\_wt_civic_house` 裡面的檔案：不要讀工作資料夾以外的任何檔案（包括 AGENTS.md 提到的全域 web-guidance skill、使用者家目錄），也不要讀 `node_modules`；被拒一次整個執行就會結束。
- 只改這幾個檔：`src/ui/house/**`（新）、`src/ui/styles/house.css`（新）、`src/ui/app.css`（只加一行 import）、`src/ui/screens/WardrobeScreen.tsx`、`src/ui/pet/CatNameEditor.tsx`、`src/ui/styles/wardrobe.css`、`src/core/constants/house.ts`（只在檔尾新增 `HOUSE_SCENE`）、`src/core/constants/changelog.ts`。需要動別的檔就停下回報。
- 不新增耦合：數字只在 `HOUSE_SCENE`、顏色只在 `theme.css`、動作規則只在 `houseLogic.ts`。
- 不 commit、不切分支；只結束自己啟動的行程。
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
