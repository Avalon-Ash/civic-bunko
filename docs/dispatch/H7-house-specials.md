# 派工單 H7-house-specials：小屋裡的小貓也有套裝效果

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：使用者要小屋房間裡的小貓也照穿著動：企鵝站著搖擺、偶爾肚子滑過房間；青蛙、兔子一蹦一蹦；乳牛站起來走；穿披風的偶爾飛過房間；睡衣全套特別愛睡。房間裡沒有卡片，所以改卡片的效果（噴火、劈斧頭、虎撲抓痕、結冰）不做。
- **模型與強度**：`gemini-4-neon-medium`（紅色驗收已寫好；邏輯在一個純函式檔，畫面只改接線）。
- **工作區**：`C:\Git\_wt_civic_hfx`，分支 `housefx`，base 是 `git log -1` 的那一筆。只准改這個資料夾內的檔案。

## 已由主代理寫好（不准改）
- `src/core/constants/house.ts`：`HOUSE_SCENE` 新增 `zoomSpeed`、`flySpeed`、`flyChance`、`flyLift`、`napBoost`、`weights.zoom`（註解寫了意思）。
- `src/ui/house/houseSpecials.test.ts`：紅色驗收。

## 要做的（2 件）

### 1. `src/ui/house/houseLogic.ts`（純函式）
- `HouseAction` 加 `'zoom' | 'fly'`；可挑的動作加 `zoom`（排在最後，權重 `HOUSE_SCENE.weights.zoom`）。
- `HouseOptions` 加選填 `specials?: ReadonlyMap<CatId, ReadonlySet<OutfitSpecial>>`（每隻的套裝效果；畫面用 `outfitSpecials(cat.outfit)` 算好傳進來）。
- `decideNextAction`：
  - `zoom`：目標在房間另一側（離現在比較遠的那一邊，地板範圍內）。
  - 那隻有 `fly` 且挑到 `walk` 或 `zoom` 時，再擲一次骰子，小於 `HOUSE_SCENE.flyChance` 就改成 `fly`：飛到房間另一側。
  - 那隻有 `dream` 時，`loaf` 的權重乘 `HOUSE_SCENE.napBoost`。
  - `reducedMotion` 照舊只挑原地動作（不走、不暴衝、不飛）。
  - 蹭蹭照舊只找原地動作中的對象（暴衝、飛行中的不算）。
- `stepHouse`：`zoom` 用 `zoomSpeed`、`fly` 用 `flySpeed` 往目標移動，抵達後跟走路一樣結束；其他動作不變。
- `actorPose(actor, gait = PET_GAIT_DEFAULT)`：`walk`→`gait.walk`、`zoom`→`gait.zoom`、`sit`→`gait.rest`、`fly`→`'fly'`、`groom`／`loaf`／`hop` 照舊。步態只用 `src/ui/pet/petLogic.ts` 的 `gaitFor`（`PET_GAITS`），不准另寫一份「哪件衣服怎麼走」。
- 飛行時的高度（拋物線，最高 `HOUSE_SCENE.flyLift`）、一蹦一蹦（`gait.hop` 時走路的上下起伏，可沿用 `PET_PLAY.hop` 的 stride、lift）算成一個純函式（例如 `actorLift(actor, gait)`），畫面只讀它。

### 2. `src/ui/house/HouseScene.tsx`
- 每隻算 `outfitSpecials(cat.outfit)`（`src/selectors/wardrobe.ts` 已 export）與 `gaitFor(...)`：`specials` 傳進 `decideNextAction`／`stepHouse` 的 options，`gait` 傳進 `actorPose`；腳的 y 減掉 `actorLift`。
- 計時器：有小貓在 `walk`／`zoom`／`fly` 時跟走路一樣用連續影格（`nextTickDelayMs` 要把這兩個動作算進去）。

## 不做
- 不做改卡片的效果、聲音（哞、夢話）、泡泡、腳印。不改其他畫面、存檔。
- 不加更新紀錄（主代理整合時加）。

## 必讀
- `src/ui/house/houseLogic.ts`（全檔）、`src/ui/house/HouseScene.tsx`、`src/ui/house/houseLogic.test.ts`、`src/ui/house/houseSpecials.test.ts`、`src/core/constants/house.ts`、`src/ui/pet/petLogic.ts` 的 `gaitFor`、`src/core/constants/pet.ts` 的 `PET_GAITS`、`PET_GAIT_DEFAULT`、`PET_PLAY.hop`、`src/selectors/wardrobe.ts` 的 `outfitSpecials`。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）

## 韁繩
- 只讀、只改 `C:\Git\_wt_civic_hfx` 裡面的檔案：不讀家目錄、全域 skill、`node_modules`；被拒一次整個執行就會結束。
- 既有測試與驗收腳本不准改；不准 mock、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報。
- 只改這兩個檔：`src/ui/house/houseLogic.ts`、`src/ui/house/HouseScene.tsx`（樣式真的需要時可以改 `src/ui/styles/house.css`）。
- 不新增耦合：步態只讀 `gaitFor`、數字只讀 `HOUSE_SCENE`。
- 不 commit、不切分支；只結束自己啟動的行程。
- 每個完成項附 `檔案:行號`。

## 回報格式（`AGENTS.md` §6）
```text
包 ID：完成／部分完成／阻塞
請求模型與強度；實際設定：工具確認值或「未確認」
變更檔案與行為（檔案:行號）：
檢查：指令、退出碼、ERROR/WARN 數
未確認項：
```
