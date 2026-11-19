# 0008 跨裝置進度同步採私人 GitHub repo 與同步碼

狀態：採用
日期：2026-11-16

## 背景

本專案部署於 GitHub Pages 且禁止建置後端、帳號系統與追蹤碼，但使用者在 iPhone 與 iPad 之間需要自動同步刷題進度，且設定流程必須讓非工程背景的家人只貼一次即可啟用（決定日期原文未單獨記載，採 `docs/plans/civic-bunko.md` §9 更新日期 2026-11-16）。

## 決定

- 進度同步檔（`SYNC_REMOTE_PATH = 'progress.json'`）存於使用者自行建立的**私人** GitHub repo，由前端直連 GitHub Contents API（`SYNC_API_BASE`）讀寫；單一請求逾時 20 秒（`SYNC_FETCH_TIMEOUT_MS`）。
- 管理者建立僅限該單一 repo 且僅有 `Contents: Read and write` 權限的 Fine-grained PAT，在 App 內與帳號、repo 名稱組裝成 `cb1.<base64url>` 格式的「同步碼」（`src/systems/syncCode.ts`），家人僅需於各裝置貼上一次；主代理不經手權杖。
- 同步憑證獨立存於裝置 `localStorage` 鍵 `civic-bunko/sync`（`SYNC_STORAGE_KEY`），不與進度檔混存，亦不進備份匯出檔。
- 同步觸發時機：打開 App、每刷完一回合、App 切到背景或回到前景（兩次至少間隔 15 秒，`SYNC_VISIBILITY_MIN_INTERVAL_MS`）、手動按「立刻同步」。

## 放棄的做法

`AGENTS.md` §2 排除自建後端、帳號系統與追蹤碼（其他雲端儲存方案的評估比較，原紀錄沒有寫。）。

## 後果

- 無須後端伺服器與額外費用即可達成跨裝置同步，權杖外洩範圍亦限制於單一進度 repo 且可隨時於 GitHub 撤銷。
- 由 `src/systems/syncCode.test.ts` 與 `src/systems/sync.test.ts` 驗證編解碼與讀寫流程。
- 代價是管理者須依 `docs/sync-setup.zh-TW.md` 進行一次性設定，且 PAT 過期後須重新產生並轉傳同步碼。

## 證據

- `AGENTS.md` §2「介面」
- `docs/HANDOFF.md`「目前狀態」「使用者已決定」
- `docs/plans/civic-bunko.md` §4「架構」、§9「已上線」
- `docs/sync-setup.zh-TW.md`
- `src/core/constants/sync.ts`、`src/systems/syncCode.ts`、`src/systems/sync.ts`、`src/systems/syncCode.test.ts`、`src/systems/sync.test.ts`
