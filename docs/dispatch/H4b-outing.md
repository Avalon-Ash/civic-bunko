# 派工單 H4b-outing：好幾隻一起出門

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §4.2。
- **目標**：她在小屋把幾隻設成「帶出門」（最多 `HOUSE.maxOut` 隻），在今日、集章頁按頭像角落的肉球，這幾隻**一起**跳出來各自亂跑、各自穿自己的衣服、各自的套裝效果；按「叫小貓回家」全部回家。答題、看答案頁照舊只有「陪我刷題」那隻；模擬考照舊不出來。好幾隻同時在外面時不能吵成一團。
- **模型與強度**：`gemini-4-neon-high`（H4a 已經把引擎改成依 ID，這包是在上面接多隻與共用的節流）。
- **工作區**：`C:\Git\_wt_civic_pet`，分支 `pet`，base 是 `git log -1` 的那一筆（`main`，含 H3 小屋與 H4a）。只准改這個資料夾內的檔案。

## 已經有的（不准改）
- `src/selectors/house.ts`：`houseCats`（每隻有 `out`）、`outingCats`、`leaderCat`、`catOutfit`；`dispatch` 的 `setCatOuting`。規則在 `src/systems/house.ts`，畫面不准自己判斷上限或「這隻是不是原本那隻」。
- `src/ui/pet/petStore.ts`（依 ID）、`PetLayer` 的 `cat` prop。
- `src/core/constants/house.ts` 既有常數；這包可以在檔尾**新增**常數（例如 `HOUSE_OUTING`：一起放出來時每隻間隔幾毫秒），不准改既有的。

## 要做的（3 件）

### 1. 帶出門的開關：`src/ui/screens/WardrobeScreen.tsx`
- 選中那隻的卡片加一列「帶出門」：`src/ui/kit/Switch.tsx`，開關讀 `houseCats` 的 `out`，切換 `dispatch({ type: 'setCatOuting', cat, on })`。已經帶了 `HOUSE.maxOut` 隻、這隻沒帶時，開關停用，旁邊一句「最多帶 {HOUSE.maxOut} 隻出門」。
- 名牌列每格在帶出門的那幾隻名字旁加一個小肉球記號（`aria-label` 寫「會一起出門」）。

### 2. 一起出門、一起回家
- `src/ui/App.tsx`：答題回合以外（`tab !== 'round'`）每隻 `outingCats(world)` 各掛一個 `PetLayer`（`key={cat}`）；答題回合中只掛 `leaderCat(world)` 那一個。陪我刷題那隻不在帶出門清單裡時，在今日、集章頁也不出來（以帶出門清單為準），但答題頁照舊是牠。
- `src/ui/pet/CatHome.tsx`：頭像照舊畫陪我刷題那隻。按肉球：把帶出門的每一隻依序 `releasePet`（每隻間隔 `HOUSE_OUTING` 的毫秒，從頭像的位置跳出來）。**任一隻在外面**時頭像換成「叫小貓回家」，按了 `recallPet` 每一隻在外面的。帶出門清單是空的時，肉球按了不動作，`aria-label` 改成「先在小貓之家選要帶出門的小貓」。
- `src/ui/pet/PetLayer.tsx`：每一隻各自獨立（各自的拎起、放下、亂跑）。

### 3. 不吵成一團（共用的節流，放新檔 `src/ui/pet/petGate.ts`，純邏輯＋測試 `petGate.test.ts`）
- **出聲**（自動的：哞、說夢話、亂跑時自己冒的說話泡泡、套裝效果的台詞）：同一時間只有一隻；上一次出聲後 `HOUSE.voiceGapMs` 內其他隻不出聲（被擋掉的就不說，不排隊）。**她點小貓**時一定回應，不受節流。
- **改卡片的效果**（燒焦、斧頭劈歪、爪痕、結冰）：同一張卡片同一時間只受一種效果；全家同一時間最多一隻在進行改卡片的效果（其他隻這時不開始，照常亂跑）。焦痕總數照舊是 `SCORCH.max`（本來就存在 world，全家共用）。
- `petGate.ts` 是模組層級的小狀態（像 `petStore.ts`），提供例如 `tryVoice(cat, now)`、`tryCardEffect(cat, el)`／`endCardEffect(cat, el)`；`PetLayer` 在原本出聲與開始改卡片的地方呼叫它。測試用固定時間：兩隻搶出聲只有一隻成功、間隔過了第二隻才成功；同一張卡片兩隻搶只有一隻成功、結束後別隻才能開始；點擊不受影響（點擊路徑不呼叫 gate）。

### 更新紀錄
- `src/core/constants/changelog.ts` 最前面加一則：`id: '2026-11-22-cat-outing'`、`date` 填你做完的日期、標題「小貓們可以一起出門了」、2 條（在小貓之家選最多 3 隻帶出門，按肉球一起跳出來各玩各的；叫回家時全部回家，刷題時還是只有陪你刷題的那隻）。

## 不做
- 不改存檔、同步、`src/systems/**`、`src/selectors/**`、`src/core/types.ts`。
- 不做小貓之間在外面的互動（追逐、蹭蹭只在小屋裡）。
- 不改答題頁（`PetRunner`、`useCatHint`）。

## 必讀
- `AGENTS.md`（§2 架構、介面）、`docs/plans/cat-house.md` §4.2、`src/selectors/house.ts`、`src/ui/pet/petStore.ts`、`src/ui/pet/PetLayer.tsx`（全檔；出聲在 `playSound`、`voice(`、`say(`，改卡片在 `prank`、`chopHit`、`markCard`、`PET_POUNCE`、`PET_SLIDE` 附近）、`src/ui/pet/CatHome.tsx`、`src/ui/App.tsx`（掛 `PetLayer` 那段）、`src/ui/screens/WardrobeScreen.tsx`（選中那隻的卡片、名牌列）、`src/ui/kit/Switch.tsx`、`src/core/constants/house.ts`。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）

三個都要退出碼 0。主代理會開瀏覽器實際放 3 隻出來、叫回家。

## 韁繩
- 既有測試與驗收腳本不准改；不准 mock 被驗證的對象、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只讀、只改 `C:\Git\_wt_civic_pet` 裡面的檔案：不要讀工作資料夾以外的任何檔案（包括 AGENTS.md 提到的全域 web-guidance skill、使用者家目錄），也不要讀 `node_modules`；被拒一次整個執行就會結束。
- 只改這幾個檔：`src/ui/screens/WardrobeScreen.tsx`、`src/ui/styles/house.css`、`src/ui/App.tsx`、`src/ui/pet/CatHome.tsx`、`src/ui/pet/PetLayer.tsx`、`src/ui/pet/petGate.ts`（新）、`src/ui/pet/petGate.test.ts`（新）、`src/core/constants/house.ts`（只在檔尾新增）、`src/core/constants/changelog.ts`。需要動別的檔就停下回報。
- 不新增耦合：上限只讀 `HOUSE.maxOut`、誰出門只讀 `outingCats`、節流只在 `petGate.ts`。
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
