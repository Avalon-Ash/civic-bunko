# 0001 題庫只來自考選部官方 PDF 流水線

狀態：採用
日期：2026-11-15

## 背景

本專案給零法學基礎的考生準備 115 年地方特考四等一般民政，題目與答案正確性是底線，且開案到筆試僅 20 天（決定日期依 `AGENTS.md` 建立日與 `docs/plans/civic-bunko.md` 開案日 2026-11-15）。考選部試題依著作權法第 9 條不屬著作權標的，可公開置於 repo。

## 決定

- 題目、選項、標準答案與更正答案只取自考選部官方 PDF；`data/packs/<包ID>/official/**` 只能由本機手動執行的 `tools/crawler/crawl.mjs`（每次請求間隔 ≥ 2 秒、以 sha256 快取避免重抓）與 `tools/parser/parse.mjs` 產生，CI 不連線考選部。
- 任何代理不得手改或以模型補寫、修正 `official/**` 題目文字；無法解析的題目標記 `parseStatus: "needs_review"` 交由主代理處理，不猜測內容。
- 有官方更正答案時以更正為準，同時保留 `correction` 欄位（`original`、`note`、`allCredit`）；每份試卷保留來源 URL、檔名與 PDF sha256 對應至 `data/raw/manifest.json`。
- 參考資料夾（Drive）檔案僅作視覺參考，不當題庫來源。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 官方原文與答案可追溯至原始 PDF 雜湊，避免人工或模型改動題幹與答案。
- 由 `tools/validate/validate.mjs`（`npm run validate`）守門：檢查 manifest sha256 一致、題數與答案 PDF 宣告相符、無自訂字元或表頭外洩、黃金答案比對、`needs_review` 比例不超過 5% 且只降不升。
- 代價是遇考選部格式異動或 PDF 解析異常時，須修正解析器而非直接修改資料檔。

## 證據

- `AGENTS.md` §2「題庫」、§5「驗收與 Git」
- `CLAUDE.md`「鐵律」
- `docs/plans/civic-bunko.md` §4「架構」、§8
- `docs/moex-recon.md`
- `tools/crawler/crawl.mjs`、`tools/parser/parse.mjs`、`tools/validate/validate.mjs`、`data/raw/manifest.json`
