# 派工單 P4a：回合續接、離線可用、新版提示、兩個小修正

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：(1) iOS 把主畫面 App 收掉再打開時，刷到一半的回合不會不見；(2) 沒網路也能刷；(3) 部署新版後，使用者能很快用到新版，而且看得出目前是哪一版。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p4a`，分支 `p4a`。只准改這個資料夾內的檔案。

## 已由主代理準備好

- `vite.config.ts`：打包時注入全域常數 `__APP_VERSION__`（ISO 時間字串，型別宣告在 `src/vite-env.d.ts`），並在輸出資料夾產生 `version.json`（`{ "version": "…" }`）。開發模式下 `version.json` 不存在。
- `src/core/types.ts`：`UICommand` 多了 `resumeRound`、`discardSavedRound`；`AppEvent` 多了 `roundRestored`。`World` 要多一個 `savedRound: RoundState | null`（`src/core/world.ts` 可改）。

## 1. 回合續接

- `persistence.ts`：進行中的回合（`world.round`）有變動時存進同一份存檔的 `round` 欄位；回合結束或被丟棄時清掉。`exportProgress` 的輸出**不含** `round`。
- 啟動時讀到存檔裡的回合：**不要直接恢復**，先放在 `world.savedRound`。題庫載入完成後（`bankLoaded`）檢查它的 `queue` 每一題都還存在於題庫；有任何一題不存在就丟棄。
- `resumeRound`：把 `savedRound` 搬回 `world.round`，發 `roundRestored`。`discardSavedRound`：清掉。開始新回合時也清掉。
- 今日畫面最上方：有 `savedRound` 時顯示一張卡（貓 `idle`）：「上次刷到第 7 / 20 題，要繼續嗎？」（看答案模式顯示「第 2 遍・第 7 / 20 題」），按鈕「繼續」與「不用了」。
- 測試：存回合、重新建立 world 後還原、題目不存在時丟棄、匯出不含回合、結束後存檔裡沒有回合。

## 2. 離線可用（手寫 service worker，不裝套件）

- `public/sw.js`：
  - `install` 時 `skipWaiting()`；`activate` 時 `clients.claim()` 並刪除名稱不是目前版本的快取。
  - 頁面導覽請求（`request.mode === 'navigate'`）與 `version.json`：**網路優先**，3 秒內沒回應或失敗才用快取；成功時更新快取。
  - 同源的 `assets/`、`icons/`、`manifest.webmanifest`：**快取優先**（檔名帶雜湊，內容不會變），沒有才抓並存起來。
  - Google Fonts（`fonts.googleapis.com`、`fonts.gstatic.com`）：有快取先回快取，同時在背景更新。
  - 其他請求（例如 `api.github.com`）一律不攔截。
- `src/main.tsx`：只在正式環境（`import.meta.env.PROD`）且瀏覽器支援時註冊 `./sw.js`；註冊失敗不影響 App。
- 題庫與法規的分檔在第一次使用時才下載，所以要離線可用必須先預抓：App 載入完成且有網路時，在背景依序 `fetch` 所有題庫與加工分檔讓 service worker 存起來（沿用 `src/data/source.ts` 既有的載入函式即可，題庫本來就會全部載入）。法規分檔不預抓。

## 3. 新版提示與版本顯示

- `src/ui/useAppVersion.ts`：在正式環境，App 回到前景（`visibilitychange` 變成 visible）以及每 10 分鐘，`fetch('./version.json', { cache: 'no-store' })`；拿到的 `version` 和 `__APP_VERSION__` 不同就表示有新版。網路失敗就略過，不報錯。比對邏輯抽成純函式並寫測試。
- 有新版時，畫面最上方滑下一條提示（自製元件，不遮住操作）：「有新版本了」＋按鈕「更新」。按下後 `location.reload()`。回合進行中也可以按，因為有回合續接。
- 集章畫面最下方顯示小字「版本 2026/11/16 01:23」（把 `__APP_VERSION__` 轉成當地時間）。

## 4. 小修正

- 看答案畫面的進度文字「1 遍・1 / 10」改成「第 1 遍・1 / 10」；只有 1 遍時顯示「1 / 10」即可。
- 「看每個選項」抽屜的內容改成**打開時才渲染**（關閉時 DOM 裡不能有選項說明與法條文字）。若 `Sheet` 元件本身一律渲染子內容，就改 `Sheet`：關閉時不渲染 children，並保留關閉動畫（可在動畫結束後才卸載）。

## 可修改檔案

`public/sw.js`（新增）、`src/main.tsx`、`src/core/world.ts`、`src/core/commands.ts`、`src/systems/**`、`src/selectors/**`、`src/ui/**`、`src/testing/**` 及測試。其他一律不准改，包含 `src/core/types.ts`、`src/core/constants/**`、`src/theme.css`、`vite.config.ts`、`index.html`、`package.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/systems/persistence.ts`、`src/systems/round.ts`、`src/main.tsx`、`src/data/source.ts`、`src/ui/App.tsx`、`src/ui/kit/Sheet.tsx`、`src/ui/screens/TodayScreen.tsx`、`src/ui/screens/ReadScreen.tsx`、`src/ui/screens/StampsScreen.tsx`、`vite.config.ts`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；`dist/sw.js` 與 `dist/version.json` 存在；主程式 JS 小於 350 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- service worker 不得快取或攔截 `api.github.com` 的請求，也不得把任何帶 `Authorization` 標頭的請求存進快取。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM。
- 不准改 `types.ts` 與常數、不准安裝套件、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
