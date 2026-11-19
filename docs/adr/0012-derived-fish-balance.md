# 0012 小魚乾不存餘額，由單調遞增來源即時計算

狀態：採用
日期：2026-11-17

## 背景

小貓衣櫥需要透過刷題賺取小魚乾購買配件，同時須支援雙裝置離線使用與私人 repo 合併，不能在同步時因單一數值餘額互蓋而遺失餘額（決定日期依 `docs/plans/cat-wardrobe.md` 開案日 2026-11-17；2026-11-18 補每日特價 `saved`，2026-11-19 補燒焦修復 `repairs`）。

## 決定

- 存檔與同步檔不存小魚乾餘額；餘額一律由 `src/systems/wardrobe.ts` 即時算成「賺到的 − 花掉的」。
- 賺到的來源取自只會變多的紀錄：`WARDROBE_START_DAY` 起的 `dayLog` 題數 × `FISH_PER_QUESTION`、每日題數關卡、見面禮、`wardrobe.achievements` 與 `wardrobe.quests`。花掉的為 `wardrobe.owned` 原價總和扣除 `wardrobe.saved`（每件夾在 0 到原價間），加上 `wardrobe.repairs × SCORCH.repairFish`。
- 因餘額由常數與歷史紀錄重算：已發佈的配件價格與修復費用不得調高、獎勵不得調低（調高獎勵須使用者同意）；新增配件前須以 `tools/economy/fish-economy.mts` 試算。
- 每日小任務與每日特價清單（`DAILY_SALE`）依日期與配件 ID 雜湊決定，兩台裝置同日算出相同結果；特價購買時記錄選填的 `wardrobe.saved`，買掉後不遞補；雙裝置離線重複花費致餘額為負時，畫面顯示 0 並暫停購買。

## 放棄的做法

`docs/plans/cat-wardrobe.md` §3.2 排除直接儲存餘額（雙裝置合併會互蓋）；§3.6 排除全面降價、排除記錄特價購買日（日後新增商店配件會改變當天特價清單，導致已省下金額變動）與買掉後遞補下一件（會讓單日整間打折買完）。

## 後果

- 小魚乾收支在離線合併時不需交易帳本也能保持一致，調高獎勵時歷史紀錄自動補發差額。
- 由 `src/systems/wardrobe.test.ts`、`src/systems/wardrobeSale.test.ts`、`src/systems/wardrobeScorch.test.ts` 與 `tools/economy/fish-economy.mts` 守門。
- 代價是歷史價格與獎勵常數受相容鎖定，且未更新至新版的舊裝置因不認得新配件、`saved` 或 `repairs` 會在更新前顯示不同餘額。

## 證據

- `docs/plans/cat-wardrobe.md` §2、§3.2、§3.3、§3.6、§3.7
- `src/core/constants/wardrobe.ts`、`src/systems/wardrobe.ts`、`src/systems/wardrobe.test.ts`、`src/systems/wardrobeSale.test.ts`、`src/systems/wardrobeScorch.test.ts`、`tools/economy/fish-economy.mts`
