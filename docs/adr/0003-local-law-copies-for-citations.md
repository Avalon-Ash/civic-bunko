# 0003 解析與卡片引用法條須對應本機法規副本

狀態：採用
日期：2026-11-15

## 背景

AI 產出逐選項解析與法學卡片時可能憑印象寫錯法規名稱或條號，且使用者在 App 內點擊條號時需要離線查閱條文原文（決定日期依 `AGENTS.md` 建立日與 `docs/plans/civic-bunko.md` 開案日 2026-11-15）。

## 決定

- 從全國法規資料庫抓取現行條文作為本機副本，存放於 `data/laws/`（`index.json` 與 `<pcode>.json`），由 `tools/laws/fetch.mjs` 在本機手動執行，不於 CI 抓取。
- `data/laws/` 是全站共用的參考資料庫，不屬於任何單一內容包，各內容包皆可引用。
- `enrich/**` 與 `cards/**` 引用法條時必須寫法規名稱與條號，且須能在 `data/laws/` 查到該條文；查不到時一律寫 `lawRef: null` 並在說明註記，不得憑印象填條號。
- App 執行期透過 `src/data/laws.ts` 同步讀取索引並依 `pcode` 延後載入單一法規全文。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 避免不存在或寫錯的條號進入題庫，並讓 App 內點條號查原文可離線運作。
- 由 `tools/validate/enrich.mjs` 與 `tools/validate/cards.mjs` 檢查每筆 `lawRef` 的法規名稱與條號存在於 `data/laws/`，缺條即報 ERROR。
- 代價是引用新法規前須先更新 `tools/laws/fetch.mjs` 的抓取清單並重抓法規副本，修法時也須手動重抓並以 `lawChanged` 標註異動題目。

## 證據

- `AGENTS.md` §2「加工層」「架構（ECS＋SSOT）」
- `docs/plans/civic-bunko.md` §4「架構」
- `docs/plans/content-packs.md` §2「內容包的形狀」
- `tools/laws/fetch.mjs`、`tools/validate/enrich.mjs`、`tools/validate/cards.mjs`、`src/data/laws.ts`、`data/laws/index.json`
