# 派工單 P3s：私人 repo 同步

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：使用者的刷題進度自動備份到她家人開的**私人** GitHub repo，並在 iPhone 與 iPad 之間合併。設定方式要連不懂技術的人也會：收到一串「同步碼」，在 App 裡貼一次就好。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_sync`，分支 `p3s`。只准改這個資料夾內的檔案。

## 已由主代理改好（在你的工作區，尚未提交）

- `src/core/types.ts`：`SyncCredentials`、`SyncStatus`、`SyncState`；`AppEvent` 多了 `syncChanged`；`UICommand` 多了 `setSyncCode`、`syncNow`、`disableSync`。
- `src/core/constants/sync.ts`：同步碼前綴、儲存鍵、遠端檔案路徑、API 位址。
- 改完後 `npm run lint` 目前可能失敗，修好它是你的工作之一。`World` 要多一個 `sync: SyncState` 欄位（`src/core/world.ts` 可改），預設 `{ status: 'off', lastSyncedAt: null, error: null }`。

## 邏輯層

### `src/systems/syncCode.ts`（純函式＋測試）
- `encodeSyncCode(cred: SyncCredentials): string`：`SYNC_CODE_PREFIX` + base64url(JSON `{ o, r, t }`)。
- `decodeSyncCode(code: string): SyncCredentials | null`：去掉前後空白與換行；前綴不對、解不開、缺欄位、`owner`／`repo` 含 `/` 或空白都回 `null`。
- base64url 要能處理非 ASCII（用 `TextEncoder`），不要用已棄用的 `escape`／`unescape`。

### `src/systems/syncMerge.ts`（純函式＋測試）
- `mergeProgress(local, remote): Map<QuestionId, Progress>`：逐題合併。只有一邊有就取那邊；兩邊都有時取 `lastAt` 較晚的整筆，但 `views` 取兩邊較大值。`lastAt` 相同取 `seen` 較大的。結果不得因合併順序不同而不同（寫測試驗證交換律）。

### `src/systems/sync.ts`
- `attachSync(world, deps: { fetch: typeof fetch; storage: StorageLike; now: () => Date })`：擁有 `world.sync`。
- 憑證存在 `storage` 的 `SYNC_STORAGE_KEY`（**獨立於進度存檔**，`exportProgress` 的輸出不得包含它）。
- 遠端是 GitHub Contents API：`GET {SYNC_API_BASE}/repos/{owner}/{repo}/contents/{SYNC_REMOTE_PATH}`（404 視為還沒有檔案）、`PUT` 同一路徑（body：`message`、`content`（base64 的 JSON）、有舊檔時帶 `sha`）。標頭：`Authorization: Bearer <token>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`。
- 遠端檔案內容：`{ version: 1, updatedAt, progress: { [id]: Progress } }`。
- 一次同步＝拉取 → `mergeProgress` → 合併結果寫回 `world.progress`（發 `progressChanged`）→ 合併結果和遠端不同才 `PUT`。`PUT` 回 409 或 422（`sha` 過期）：重新拉取再合併再試一次，仍失敗才報錯。
- 觸發時機：`attachSync` 時若已有憑證；`roundFinished` 之後；`syncNow` 指令。同一時間只跑一個同步，進行中再觸發就在結束後補跑一次。
- 狀態：開始時 `syncing`；成功 `idle` 並更新 `lastSyncedAt`；失敗 `error`，`error` 填給人看的短句：401／403「同步碼失效或權限不足」、404（repo 不存在）「找不到同步用的 repo」、網路錯誤「現在連不上網路，稍後會再試」。每次狀態改變發 `syncChanged`。
- `setSyncCode`：解不開就把狀態設為 `error`「同步碼格式不對」且不存；解得開就存起來並立刻同步一次。`disableSync`：刪除憑證、狀態回 `off`，不動本機進度。
- 不得把權杖寫進 `console`、錯誤訊息、URL 或任何事件。
- 測試用假的 `fetch` 涵蓋：第一次同步（遠端 404）、兩邊都有資料的合併、`sha` 過期重試、401、網路錯誤、`disableSync` 之後不再呼叫 `fetch`、`exportProgress` 不含權杖。

## 畫面（集章畫面的「備份」區塊改成「同步與備份」）

- **狀態列**：未設定「還沒開啟同步」；同步中（貓 `sleepy`＋轉圈）；正常「已同步・上次 hh:mm」；錯誤時顯示錯誤短句與「再試一次」。
- **貼上同步碼**（未設定時是主要按鈕）：開 `Sheet`，一句說明「把家人傳給你的同步碼貼在這裡」，一個大的多行輸入框，按鈕「貼上」（`navigator.clipboard.readText()`，失敗或被拒就提示手動長按貼上）與「開始同步」。成功後 `Toast`「同步開啟了」。
- **立即同步**、**停止同步**（先用自製 `Dialog` 確認：會從這台裝置移除同步碼，進度不會刪）。
- **給管理的人：產生同步碼**（預設收合）：三個欄位：GitHub 帳號或組織、repo 名稱、權杖（`type="password"`，旁邊有顯示／隱藏）。按「產生」後顯示同步碼於唯讀框，按鈕「複製」。下方一行提醒：「這串同步碼等於鑰匙，只傳給家人。」輸入的權杖只留在這個畫面的元件 state，不寫進儲存，除非使用者另外用它開啟同步。
- 原本的匯出／匯入／清除保留，移到「手動備份」小標下。
- 今日畫面：同步有錯誤時，在題庫卡下面顯示一條小提示可點到集章。

## 可修改檔案

`src/systems/**`、`src/selectors/**`、`src/core/commands.ts`、`src/core/world.ts`、`src/main.tsx`、`src/ui/**`、`src/testing/**` 及測試。其他一律不准改，包含 `src/core/types.ts`、`src/core/constants/**`、`src/theme.css`、`package.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/sync.ts`、`src/systems/persistence.ts`、`src/core/store.ts`、`src/ui/screens/StampsScreen.tsx`、`src/ui/kit/Sheet.tsx`、`src/ui/kit/Dialog.tsx`、`src/main.tsx`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS 小於 340 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 測試不准真的連線到網路；`fetch` 一律注入假的。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM。
- 不准改 `types.ts` 與常數、不准安裝套件、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
