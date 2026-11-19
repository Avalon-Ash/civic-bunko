# 0004 題目與各項識別碼產生後不重編、不改名

狀態：採用
日期：2026-11-15

## 背景

使用者作答進度、看過的卡片、衣櫥配件、成就、每日任務、燒焦修復、縣市與更新紀錄都以字串 ID 作為存檔與同步檔的鍵，各資料層之間也靠 ID 關聯（決定日期依 `AGENTS.md` 建立日首次定下題目 ID 規則 2026-11-15；2026-11-17 至 2026-11-19 依序擴及跨包唯一與衣櫥、天氣、更新紀錄 ID）。

## 決定

- 題目 ID 固定格式為 `<年度>-<考試>-<科目>-q<兩位數題號>`（例 `115-general-admin-law-q08`）；題目 ID、試卷 ID、卡片 ID（小寫英數與連字號）、配件 ID、成就 ID、任務 ID、科目 key、燒焦卡片 ID（`data-cat-burn`）、縣市 ID（`WEATHER_PLACES`）與更新紀錄 ID（`CHANGELOG`）產生後皆不得重編或改名。
- 試卷 ID、題目 ID 與卡片 ID 必須全站跨內容包唯一，進度與同步只認 ID。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 既有使用者的本機存檔與雲端同步紀錄不會因版本更新而找不到對應題目、卡片或配件，也能跨包共用進度表。
- 由 `tools/validate/validate.mjs` 檢查題目 ID 格式、單包及跨包試卷／題目 ID 唯一性，由 `tools/validate/cards.mjs` 檢查卡片 ID 格式與跨包唯一性。
- 代價是命名決定後無法直接更名，調整或擴充內容時只能保留舊 ID 或新增 ID。

## 證據

- `AGENTS.md` §2「題庫」「使用者資料」、§5「驗收與 Git」
- `docs/plans/content-packs.md` §2「內容包的形狀」
- `docs/plans/cat-wardrobe.md` §2、§3.7
- `src/core/types.ts`、`src/core/constants/wardrobe.ts`、`src/core/constants/weather.ts`、`src/core/constants/changelog.ts`
- `tools/validate/validate.mjs`、`tools/validate/cards.mjs`
