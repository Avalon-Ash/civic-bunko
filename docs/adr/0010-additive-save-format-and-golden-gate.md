# 0010 使用者存檔與同步檔只增選填欄位並由固定樣本守門

狀態：採用
日期：2026-11-17

## 背景

2026-11-17 確認真實使用者已開始使用線上版並開啟跨裝置同步，任何改版皆不得造成既有裝置存檔或私人 repo 同步檔讀不回來、被清空或被覆蓋。

## 決定

- 凍結儲存鍵與檔案版本：`STORAGE_KEY = 'civic-bunko/v1'`、`SYNC_STORAGE_KEY = 'civic-bunko/sync'`、`SYNC_REMOTE_PATH = 'progress.json'`、`SYNC_FILE_VERSION = 1`。
- 存檔、同步檔與匯出檔格式只允許往上新增選填欄位：不改名、不刪欄位、不改既有欄位語意；缺欄位時套用預設值，壞掉的子欄位只丟棄該欄位（如 `parseWardrobe`、`parseExamHistory`）而非整份存檔失效。若須改變格式，先寫自動遷移並停下來詢問主代理。
- 既有 `settings.accessory` 維持只放舊 6 件集章配件，新衣櫥換裝寫入選填的 `settings.wardrobe.outfit`，不得將新配件 ID 寫入 `settings.accessory`。
- `src/testing/golden/**` 的已出貨樣本與 `src/systems/persistenceGolden.test.ts`（內含樣本檔 sha256 雜湊斷言）禁止修改；新增選填欄位時只能新增樣本檔與對應測試檔。

## 放棄的做法

`docs/plans/cat-wardrobe.md` §2 記載放棄沿用 `settings.accessory` 存新配件，因已出貨版本的 `persistence.ts`（`isValidSettings`）讀到不在舊 6 件集合內的配件 ID 會讓整份存檔讀取失敗；其餘存檔格式替代方案，原紀錄沒有寫。

## 後果

- 舊版存檔與同步檔在後續改版皆可向後相容讀取，新舊裝置混用時舊裝置也不會因新增欄位而整份壞檔。
- 由 `src/systems/persistenceGolden.test.ts`、`src/systems/persistenceWardrobe.test.ts`、`src/systems/persistenceCatName.test.ts`、`src/systems/wardrobeSale.test.ts`、`src/systems/wardrobeScorch.test.ts`（`npm test`）守門。
- 代價是存檔解析器須逐欄做驗證與正規化，且歷史欄位（如 `settings.accessory`）須長期保留相容邏輯。

## 證據

- `AGENTS.md` §2「使用者資料」
- `docs/HANDOFF.md`「使用者已決定」
- `docs/plans/cat-wardrobe.md` §2、§5
- `src/systems/persistence.ts`、`src/systems/persistenceGolden.test.ts`、`src/systems/persistenceWardrobe.test.ts`、`src/systems/persistenceCatName.test.ts`
- `src/testing/golden/save-v1.json`、`src/testing/golden/sync-v1.json`、`src/testing/golden/save-v2-wardrobe.json`、`src/testing/golden/save-v3-cat-name.json`、`src/testing/golden/save-v4-cat-profile.json`、`src/testing/golden/save-v5-wardrobe-saved.json`、`src/testing/golden/save-v6-wardrobe-scorch.json`
