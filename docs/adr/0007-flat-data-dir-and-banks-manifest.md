# 0007 題庫採扁平資料目錄並由 banks.json 登記

狀態：已取代（由 0011）
日期：2026-11-15

## 背景

開案初期距離筆試僅 20 天，需於第 3 天上線可刷題版本，先為單一考試（115 年地特四等一般民政）規劃依資料層區分的目錄與登記檔（決定日期依 `docs/plans/civic-bunko.md` 開案日 2026-11-15）。

## 決定

- 題庫資料依類型扁平置於 `data/` 之下（`data/official/`、`data/enrich/`、`data/cards/`、`data/topics.json`，以及之後新增的 `data/zh/`），另以 `data/banks.json` 登記題庫 ID、名稱、科目與資料路徑，由 `BankLoader` 載入並於題目紀錄帶 `bankId`。
- 考試別型別 `ExamKind` 定義為固定聯集 `"local4" | "general"`。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 讓初期單一題庫的爬蟲、解析、驗證與前端載入可依既定路徑實作，但資料路徑與考試別字面值散落於 App 與工具腳本中，難以直接放入第二個題庫而不修改程式。
- 此結構已於 2026-11-17 由 `0011` 取代，資料全數搬遷進 `data/packs/local4-civil/`。

## 證據

- `docs/plans/civic-bunko.md` §4「架構」「App 架構：ECS＋SSOT」「資料格式（摘要）」、§9「程式結構補充」
- `docs/plans/content-packs.md` §2「內容包的形狀」、§3「拆包表」
