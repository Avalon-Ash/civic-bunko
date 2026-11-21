# 派工單 H5-outing-all：帶出門不設上限、每隻小貓各跑各的

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §4.2（使用者 2026-11-22 改規格）。
- **目標**：使用者說「有幾隻就可以帶幾隻，開關就是要不要帶」，以及「叫聲、台詞、改卡片的效果放開，每隻小貓自己跑隨機就好」。做完後：預設全家都帶出門；帶出門開關沒有隻數上限、不會停用；好幾隻在外面時各自照自己的隨機出聲、燒焦、劈歪、抓、結冰，沒有全家共用的節流。
- **模型與強度**：`gemini-4-neon-medium`（規格明確、紅色驗收已寫好，主要是刪除）。
- **工作區**：`C:\Git\_wt_civic_out`，分支 `outing`，base 是 `git log -1` 的那一筆。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不准改）
- `src/core/constants/house.ts`：拿掉了 `HOUSE`（`maxOut`、`voiceGapMs`）。不准加回來，也不准另外加隻數上限。
- `src/core/types.ts`：`wardrobe.outing` 與 `setCatOuting` 的註解。
- `src/systems/house.test.ts`：紅色驗收（預設全家出門、開關沒有上限、動過開關之後才領養的那隻也跟著出門）。

## 要做的（3 件）

### 1. `src/systems/house.ts`
- `outingCats`：沒有 `outing` 欄＝全家（照家裡順序）；有的話列出名單裡在家的、照家裡順序。不截斷。
- `setCatOuting`：開／關這一隻，沒有上限。第一次動開關時（還沒有 `outing` 欄），以「全家」為起點再加減。
- `adoptCat`：已經有 `outing` 欄時，把新領養的那隻加進名單（新來的預設跟著出門）。
- 拿掉 `HOUSE` 的 import 與相關註解。

### 2. 畫面：`src/ui/screens/WardrobeScreen.tsx`、`src/ui/styles/house.css`
- 帶出門開關不再停用：拿掉 `outingFull`、`fieldset` 停用、「最多帶 N 隻出門」那句；開關直接 `setCatOuting`。
- 拿掉只為停用而存在的樣式（`.cb-house-switch-field:disabled` 之類）；其他版面不動。

### 3. 拿掉共用節流：`src/ui/pet/PetLayer.tsx`
- 刪掉 `src/ui/pet/petGate.ts` 與 `src/ui/pet/petGate.test.ts`。
- `PetLayer` 裡呼叫 `tryVoice`、`tryCardEffect`、`canStartCardEffect`、`endCardEffect`、`clearCatEffects` 的地方，恢復成每隻自己判斷：出聲照原本的條件直接說；改卡片照原本的條件（例如 `CHOP_ATTR`、焦痕上限 `SCORCH.max`、牠自己正在進行的效果）。可以對照 H4b 之前的版本：`git show d51b852:src/ui/pet/PetLayer.tsx`。
- 保留 H4b 其他的改動：多隻各掛一個 `PetLayer`、從頭像依序跳出來散開（`HOUSE_OUTING`）、`blockedAt` 忽略其他小貓的圖層。

### 更新紀錄
- `src/core/constants/changelog.ts` 最前面加一則：`id: '2026-11-22-cat-outing-all'`、`date: '2026-11-22'`、標題「全家都可以一起出門了」、2 條（帶出門不限隻數，開關只管這隻要不要帶，新領養的也會跟著出門；每隻小貓各玩各的，叫聲、噴火、劈卡片都照自己的節奏）。

## 不做
- 不改存檔與同步的格式、`src/selectors/**`、其他畫面。

## 必讀
- `AGENTS.md` §2、`docs/plans/cat-house.md` §4.2、`src/systems/house.ts`、`src/systems/house.test.ts`、`src/ui/screens/WardrobeScreen.tsx`（帶出門那一列）、`src/ui/styles/house.css`、`src/ui/pet/PetLayer.tsx`、`src/ui/pet/petGate.ts`（要刪的）。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）
- `git show d51b852:src/ui/pet/PetLayer.tsx`（30 秒；只讀，對照用）

前三個要退出碼 0。

## 韁繩
- 只讀、只改 `C:\Git\_wt_civic_out` 裡面的檔案：不讀家目錄、全域 skill、`node_modules`；被拒一次整個執行就會結束。
- 既有測試與驗收腳本不准改（`petGate.test.ts` 是照本單刪掉，不是修改）；不准 mock、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報。
- 只改這幾個檔：`src/systems/house.ts`、`src/ui/screens/WardrobeScreen.tsx`、`src/ui/styles/house.css`、`src/ui/pet/PetLayer.tsx`、`src/ui/pet/petGate.ts`（刪）、`src/ui/pet/petGate.test.ts`（刪）、`src/core/constants/changelog.ts`。
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
