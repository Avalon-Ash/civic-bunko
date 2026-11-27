# 0024 驗證腳本經 tsx 直接讀 src 的常數，字數上限只有一份

狀態：採用
日期：2026-11-27

## 背景

0002 定下卡片的字數上限寫在 `src/core/constants/cards.ts`，但當時 `.mjs` 驗證腳本不能 import TypeScript，所以 `tools/validate/cards.mjs` 抄了一份相同的數字，後果一節寫著「兩處須同步維護」。漫畫案（`docs/plans/comic-cards.md` §10-3、CC6）的驗證已經改用 tsx 直接讀 `constants/comic.ts`，使用者同意把卡片這份也解掉。原本排在考後，使用者 2026-11-27 指出考後不會再開，改成考前做。

## 決定

- `npm run validate` 跑 `tools/validate/cards.mjs` 時帶 `node --import tsx`，腳本直接 import `src/core/constants/cards.ts` 的上限常數，不再抄數字。
- 原本只存在驗證腳本的 visual 格子上限（14 字）一起搬進 `constants/cards.ts`（`CARD_VISUAL_TEXT_MAX`）。
- 之後新的驗證腳本要用 `src/` 的常數或規則，一律經 tsx 讀，不抄。

## 放棄的做法

- 維持兩份、靠註解提醒同步：改一邊忘了另一邊時，驗證和 App 的上限會不一致，而且不會有任何檢查發現。
- 把常數搬成 JSON 給兩邊讀：多一個檔案格式，TypeScript 端失去字面型別，換來的只是避開 tsx。

## 後果

- 驗證要裝 tsx（本來就是 devDependency，`npm test` 也用它）。
- 行為不變的證明：改前改後 `node tools/validate/cards.mjs` 的輸出逐字相同（`[local4-civil] cards files=7 cards=57 essays=16 ERROR=0`）；故意把一張卡的標題改成 17 字，仍報「title 17 字，上限 16」並以 1 結束。
- 本份取代 0002 後果一節「兩處字數上限常數須同步維護」那一句；0002 其他部分不變。

## 證據

- `src/core/constants/cards.ts`
- `tools/validate/cards.mjs`
- `package.json`（`validate` 指令）
- `docs/plans/comic-cards.md`（§10-3、CC6）
- [0002 加工層、卡片與中譯與官方層分開存放](0002-derived-layers-separate-from-official.md)
