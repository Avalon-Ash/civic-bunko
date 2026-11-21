# 0013 跨裝置同步採可交換合併規則與單一值改動時間戳

狀態：已取代（由 0018）
日期：2026-11-18

## 背景

iPhone 與 iPad 可能各自離線刷題、購買配件或修改小貓名字後再同步，若採用整份覆蓋會造成先同步或離線那台的紀錄遺失；2026-11-16 至 2026-11-17 建立進度、每日題數、卡片、模擬考與衣櫥合併，使用者於 2026-11-18 決定小貓名字（`CatProfile`）的跨裝置同步規則並訂為後續單一值設定的範本。

## 決定

- 所有跨裝置同步欄位必須在 `src/systems/syncMerge.ts` 具備確定性、與參數順序無關的合併函式：
  - 單題進度（`mergeProgress`）：取 `lastAt` 較晚整筆，同時間依 `seen`、`correct`、`streak`、`due`、`lastPick`、`lastAt` 確定性裁決；`views` 取 `Math.max`。
  - 單調數值（`mergeDays`、`wardrobe.saved` 各件、`wardrobe.repairs`）：取兩邊較大值。
  - 集合與清單（`mergeCardsSeen`、`mergeExamHistory` 以 `at|paperId` 去重並保留最近 `EXAM_HISTORY_MAX` 筆、`mergeWardrobe` 的 `owned`/`achievements`/`quests`）：取聯集並依固定順序整理。
  - 單一值設定（範例：`CatProfile` 的 `{ name, at }`）：連同最後一次改動時間一起存成一包；寫入時改動時間取 `Math.max(now, prev + 1ms)`（`src/systems/settings.ts`），`mergeCatProfile` 留改動時間較新的整包，同時間以有值與字典序裁決；清掉名字亦更新時間。
- 各裝置偏好與暫態（`outfit`、`accessory`、`theme`、`sound`、`weather`、`weatherPlace`、`scorch`、`shuffleOptions`、`bilingual`、`changelogSeen`）只存本機，不同步；`src/systems/sync.ts` 只算出合併結果並透過擁有者系統介面寫回。

## 放棄的做法

`AGENTS.md` §2 與 `src/systems/syncMerge.ts` 排除「後寫蓋前寫」與「以同步當下時間作為比較依據」；`docs/plans/cat-wardrobe.md` §3.7 排除將兩台離線燒焦修復次數相加（避免多扣小魚乾）。

## 後果

- 無論哪一台先同步，雙裝置收斂到相同狀態且不丟失已累積紀錄。
- 由 `src/systems/syncMerge.test.ts`、`src/systems/sync.test.ts`、`src/systems/syncCatProfile.test.ts` 驗證交換律與雙裝置收斂。
- 代價是單一值設定仍受各裝置時鐘偏差影響（快鐘裝置離線改名會勝出，須於拉下後再改一次覆過），且新增 `CatProfile` 欄位時須同步更新 `parseCatProfile`、`withCatProfile`、`sameCatProfile`。

## 證據

- `AGENTS.md` §2「使用者資料」
- `docs/HANDOFF.md`「目前狀態」「使用者已決定」「已知問題」
- `docs/plans/cat-wardrobe.md` §3.5、§3.6、§3.7、§7.5
- `src/systems/syncMerge.ts`、`src/systems/syncMerge.test.ts`、`src/systems/syncCatProfile.test.ts`、`src/systems/settings.ts`、`src/systems/sync.ts`
