# 0018 多隻小貓沿用舊欄位存原本那隻，長相改為帶改動時間跨裝置同步

狀態：採用
日期：2026-11-22
取代：0013

## 背景

使用者 2026-11-22 要求小貓可以有好幾隻、每隻都能取名，並在小屋裡各自換裝（`docs/plans/cat-house.md`）。她已經在用、也設了同步，原本那隻的名字與穿著不能搬動或失效；多隻之後若名字同步、長相不同步，另一台會看到名字對不上長相，使用者同日決定穿著也要同步。0013 規定 `outfit` 只存本機，因此由本份取代。

## 決定

- 0013 的合併規則全部保留：單題進度取 `lastAt` 較晚、單調數值取較大值、集合取聯集、單一值設定連同改動時間成包比較（`mergeCatProfile`），所有合併函式與參數順序無關，寫入時改動時間取 `Math.max(now, prev + 1ms)`。
- 小貓 ID（`CatId`）：原本那隻固定 `HOUSE_FIRST_CAT`（`'cat-1'`），資料留在舊欄位 `settings.catName`／`catNameAt`、`wardrobe.outfit`，加選填 `wardrobe.outfitAt`；領養的照 `HOUSE_ADOPT` 的固定順序編號（`'cat-2'`…），存在選填 `wardrobe.cats`。固定編號讓兩台各自離線領養同一順位時合併成同一隻。
- 領養紀錄是 `wardrobe.owned` 裡的一筆（`'adopt-cat-N'`），跟著 `owned` 取聯集；價格只在 `src/core/constants/house.ts`，`fishBalance` 的花費多算領養價（延伸 0012）。
- 同步檔加兩個選填欄：`cats`（新貓的名字，逐隻 `mergeCatProfile`；原本那隻仍是 `cat` 欄）、`looks`（每隻的長相 `CatLook = { outfit, at }`，含原本那隻，逐隻 `mergeCatLook` 比改動時間、較新的整包留下）。改動時間是空字串的長相不上傳，避免第一次同步時一台的舊穿著蓋掉另一台。
- 符合 `HOUSE_CAT_ID` 格式但這一版不認得的小貓（較新版本領養的）在存檔、同步檔裡照樣保留，只是不顯示。
- 只存本機、不同步：`wardrobe.outing`（帶出門）、`wardrobe.leader`（陪我刷題）、`accessory`、`theme`、`sound`、`weather`、`weatherPlace`、`scorch`、`shuffleOptions`、`bilingual`、`changelogSeen`。
- 「cat-1 讀舊欄位、其他讀新欄位」只寫在 `src/systems/house.ts` 一處；其他地方不判斷小貓 ID。

## 放棄的做法

- 把原本那隻搬進 `wardrobe.cats`：要寫遷移，且舊版那台讀不到牠的名字與穿著。
- 領養用隨機 ID：兩台離線各領一隻會多出一隻，而且之後無法合併成同一隻。
- 穿著維持只存本機：另一台的長相與名字對不上（使用者 2026-11-22 決定同步）。
- 長相逐部位合併：兩台各換一個部位會拼出她沒穿過的組合，也無法表示「脫掉」。

## 後果

- 舊版 App 讀新存檔時丟掉不認得的欄位，不影響原本那隻；舊版那台寫回同步檔會暫時去掉 `cats`、`looks`，更新後下次同步由本機補回。
- 舊版那台不認得領養紀錄，不扣領養的小魚乾，更新後一致。
- 長相受各裝置時鐘偏差影響，同 0013 的名字。
- 由 `src/systems/persistenceHouse.test.ts`、`src/systems/house.test.ts`、`src/systems/syncHouse.test.ts` 與樣本 `src/testing/golden/save-v7-house.json`、`src/testing/golden/sync-v1-house.json` 守門；0013 列的測試照舊有效。

## 證據

- `docs/plans/cat-house.md` §2、§3
- `docs/adr/0012-derived-fish-balance.md`、`docs/adr/0013-commutative-sync-merge-rules.md`
- `src/core/constants/house.ts`、`src/core/types.ts`
- `src/systems/persistenceHouse.test.ts`、`src/systems/house.test.ts`、`src/systems/syncHouse.test.ts`
