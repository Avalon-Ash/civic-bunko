# 派工單 H6-perch-down：小貓跳上卡片後會自己跳回地面

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：使用者回報「企鵝都沒看到肚子滑行」。主代理量到原因：小貓一旦跳上卡片（`e.surface.kind === 'perch'`），除非卡片捲出畫面，永遠不會自己下來；在卡片上時 `zoom`（暴衝）和 `perch` 都被停用，所以企鵝的滑行（只在暴衝時出現）再也不會發生。5 隻一起出門時幾分鐘內全部困在卡片上。做完後：在卡片上挑到 `perch` 就跳回地面，回到地面照常可以暴衝、企鵝會滑。
- **模型與強度**：`gemini-4-neon-medium`（範圍小、紅色驗收已寫好）。
- **工作區**：`C:\Git\_wt_civic_perch`，分支 `perchdown`，base 是 `git log -1` 的那一筆。只准改這個資料夾內的檔案。

## 已由主代理寫好（不准改）
- `src/ui/pet/petRoam.test.ts`：紅色驗收，要求 `src/ui/pet/petLogic.ts` export `roamUnavailable(surface: 'floor' | 'perch', perchCount: number): Set<RoamBehavior>`。

## 要做的（2 件）
1. `src/ui/pet/petLogic.ts`：新增 `roamUnavailable`（純函式）：在地面＝沒有看得到的卡片時 `perch` 不能用；在卡片上＝只有 `zoom` 不能用（`perch` 留著，意思是跳回地面）。
2. `src/ui/pet/PetLayer.tsx` 的 `next()`：
   - 用 `roamUnavailable(e.surface.kind, perches.length)` 取代現在手寫的 `unavailable` 判斷（那段只留一份，不要兩邊都判）。
   - 在卡片上挑到 `perch`：跳回地面。落點在地面範圍（`xRange()`）內、離現在的 x 不太遠、腳下沒有按鈕（用現有的 `pickWalkTarget` 加 `blockedAt(x, floor)`，找不到就原地 `x` 往下跳）。用現有的 `jump` 模式、`land: { kind: 'floor' }`、姿勢 `hop`，跟從卡片上起飛、撲下來的寫法一致。
   - 在地面挑到 `perch` 照舊跳上卡片。其他動作不動。

## 不做
- 不改動線權重（`ROAM_ROUTES`）、套裝效果、其他檔案。不加更新紀錄（主代理整合時加）。

## 必讀
- `src/ui/pet/PetLayer.tsx` 的 `next()`（約 482–640 行）、`src/ui/pet/petLogic.ts`、`src/ui/pet/petRoam.test.ts`、`src/ui/pet/petLogic.test.ts`。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）

## 韁繩
- 只讀、只改 `C:\Git\_wt_civic_perch` 裡面的檔案：不讀家目錄、全域 skill、`node_modules`；被拒一次整個執行就會結束。
- 既有測試與驗收腳本不准改；不准 mock、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報。
- 只改這兩個檔：`src/ui/pet/petLogic.ts`、`src/ui/pet/PetLayer.tsx`。
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
