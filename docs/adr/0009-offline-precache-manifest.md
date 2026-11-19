# 0009 離線快取採自寫 Service Worker 搭配 precache.json 清單

狀態：採用
日期：2026-11-16

## 背景

使用者於 iPhone／iPad 主畫面以 PWA 離線刷題，但法規全文（27 部法規）與動態模組是點開才延後載入的 chunk，僅靠瀏覽過才快取會導致沒點過的法條在離線時查不到（決定日期原文未單獨記載，採 `docs/plans/civic-bunko.md` §9 更新日期 2026-11-16）。

## 決定

- 以自寫的 `public/sw.js` 實作快取策略（`CACHE_NAME = 'civic-bunko-v1'`）：頁面與導覽請求採 network-first（3 秒逾時退回快取），靜態資產採 cache-first，帶有 `Authorization` 標頭的請求一律不快取。
- `vite.config.ts` 的 `versionFile()` 外掛於打包時產出 `version.json`（含建置版本 `__APP_VERSION__`）與 `precache.json`（含 `version` 與所有 `assets/*` 檔案清單）。
- App 啟動並載入題庫後延遲 5 秒（`OFFLINE_WARM_DELAY_MS`）執行 `src/data/offline.ts`（`refreshOfflineCache`），以 `cache: 'no-store'` 讀取 `precache.json`：僅在清單版本與目前頁面 `__APP_VERSION__` 一致時補抓缺少的 `assets/*`，且必須全部補抓成功才刪除舊版殘留的 `assets/*`。

## 放棄的做法

`docs/plans/civic-bunko.md` §4 記載沒有使用 `vite-plugin-pwa`（未記載放棄理由；其他離線方案評估，原紀錄沒有寫。）。

## 後果

- 開啟 App 一次後即可將整版試卷、加工、卡片、中譯、音檔與全部法規補進離線快取，且補抓失敗時不刪舊檔。
- 由 `src/data/offline.test.ts` 守門，驗證 `public/sw.js` 的 `CACHE_NAME` 與 `src/core/constants/offline.ts` 的 `OFFLINE_CACHE_NAME` 相同，並測試清單比對與失敗不清舊邏輯。
- 代價是 `public/sw.js` 不經打包，修改快取名稱時須與常數檔同步，且非 `assets/` 資源（如對外天氣 API）不在預先快取範圍內。

## 證據

- `docs/plans/civic-bunko.md` §4「架構」、§9「已上線」
- `docs/HANDOFF.md`「目前狀態」
- `vite.config.ts`、`public/sw.js`、`src/core/constants/offline.ts`、`src/data/offline.ts`、`src/data/offline.test.ts`
