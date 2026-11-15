# 派工單 P1e-2b：加到主畫面引導、進度備份、結果文案、題庫延後載入

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **包 ID**：P1e-2b
- **目標**：讓使用者的進度不會不見（iOS Safari 會清掉 7 天沒互動網站的本機資料；加到主畫面的 App 另外計算，而且兩邊資料不互通），並修掉第一版介面的三個已知問題。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_ui2`，分支 `p1e-2b`。只准改這個資料夾內的檔案。

## 已由主代理改好（在你的工作區，尚未提交）

`src/core/types.ts`：`Settings` 多了 `installHintDismissed?: boolean`；`UICommand` 多了 `{ type: 'dismissInstallHint' }`。你要在 `src/core/commands.ts` 與 `src/systems/settings.ts` 接上它（設為 `true` 並發 `settingsChanged`），並補測試。讀回舊存檔時沒有這個欄位要視為 `false`。

## 四項工作

### 1. 加到主畫面引導
- 判斷是否已是主畫面 App：`window.matchMedia('(display-mode: standalone)').matches` 或 iOS 的 `navigator.standalone === true`。判斷邏輯放 `src/ui/platform.ts`（純函式，參數注入，可測）。
- 不是主畫面 App 且 `installHintDismissed` 不為 `true`：第一次開啟時用自製 `Sheet` 顯示引導，三步驟各一張小圖卡（內嵌 SVG 圖示）：① 點 Safari 下方的分享鈕 ② 選「加入主畫面」③ 以後從主畫面的圖示打開。上方一句原因：「加到主畫面，刷題進度才不會被 Safari 清掉。」按鈕：「知道了」（關閉並 `dismissInstallHint`）、「等一下再說」（只關閉，下次開啟再出現）。
- 關掉引導後，今日畫面仍保留一條小提示列（可點開同一個 Sheet），直到已是主畫面 App 或按過「知道了」。
- 已是主畫面 App 時完全不顯示。

### 2. 進度備份（放在集章畫面最下方的「備份」區塊）
- 「匯出進度」：開 `Sheet`，顯示 `exportProgress(world)` 的 JSON 於唯讀 `textarea`，按鈕「複製」（`navigator.clipboard.writeText`，失敗就選取文字並用 `Toast` 提示手動複製）。
- 「匯入進度」：開 `Sheet`，`textarea` 貼上 → `dispatch({ type: 'importProgress', json })` → `Toast` 顯示成功或失敗。要知道成功與否，可在 `src/selectors/` 或既有 persistence 介面找可用的回傳；沒有就停下回報，不要自己繞過 `dispatch`。
- 「清除全部進度」：先開自製確認對話框（寫清楚會清掉什麼、不能復原），確認後 `resetProgress`。
- 顯示上次作答時間與已刷題數。

### 3. 結果頁文案
- 章上的字依答對率變化，門檻與文字放新檔 `src/core/constants/result.ts`：100%「全對！」、≥ 80%「過關成功」、≥ 50%「再接再厲」、其餘「明天再戰」。貓的表情跟著換（`yay`／`idle`／`oops`）。

### 4. 題庫延後載入
- 現況：`src/data/source.ts` 用 eager glob 把 25 份試卷全打進主程式（單一 JS 762 kB）。
- 改成：`banks.json` 與 `index.json` 仍 eager；各試卷改用非 eager 的 `import.meta.glob`，外殼先 render，再平行載入全部試卷後 `loadBank`。載入中今日畫面的題庫數字顯示「載入中…」與 `sleepy` 表情的貓，載入完才 `CountUp`；載入完成前「開始」鈕停用。
- `npm run build` 後主程式 JS（`dist/assets/index-*.js`）要小於 300 kB，且不再出現 chunk 過大的警告。

## 可修改檔案

- `src/main.tsx`、`src/ui/**`、`src/data/source.ts`、`src/core/commands.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`（只為相容舊存檔）及它們的測試；`src/selectors/**` 只能新增；新增 `src/core/constants/result.ts`。
- 其他一律不准改，包含 `src/core/types.ts`、`src/theme.css`、`package.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/ui/App.tsx`、`src/ui/kit/Sheet.tsx`、`src/ui/screens/TodayScreen.tsx`、`src/ui/screens/StampsScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/systems/persistence.ts`、`src/data/source.ts`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

逾時：各 240 秒。及格：三個都退出碼 0，且 build 輸出的主程式 JS 小於 300 kB。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`。
- 顏色只用 `src/theme.css` 的 token；元件只經 `selectors` 讀、`dispatch` 寫。
- 不准安裝套件、不准改 lint 與 tsconfig、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報現況。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 輸出的各檔大小。
