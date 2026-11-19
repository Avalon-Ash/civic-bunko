# 0014 小貓說話採台詞、判斷與介面三層解耦

狀態：採用
日期：2026-11-18

## 背景

使用者於 2026-11-18 要求增加點小貓的對話並讓結構解耦、可擴充且可抽換（參考其在既有專案做的角色大腦分層設計），同時維持本專案無後端與不觸碰內容包邊界的限制。

## 決定

- 小貓說話拆成三層，各自可獨立更換：
  1. 角色包（純資料）：`src/core/constants/catLines.ts`（`CatCharacter`）只放預設稱呼、話題與台詞；台詞不得出現考試名稱、年度、科目或法條內容。
  2. 判斷層（純函式）：`src/systems/catBrain.ts`（條件表 `CAT_CONDITIONS`、佔位符表 `CAT_LINE_VARS`、`speak`）與門檻常數 `src/core/constants/cat.ts`；只讀取由 `src/selectors/cat.ts`（`catSituation`）整理出的 `CatSituation`，不直接讀 `World`、不碰 DOM；記憶（近期 12 句與連點次數，`CatMemory`）只放記憶體、不存檔。
  3. 說話介面：`CatVoice` 函式型別透過 `CatVoiceContext`（`src/ui/kit/catVoice.tsx`）由 `src/ui/pet/CatVoiceProvider.tsx` 注入本機大腦；`Cat` 與 `PetLayer` 只呼叫 `useCatVoice()`，未注入時預設靜默。

## 放棄的做法

`docs/plans/cat-wardrobe.md` §7.5 記載因本 App 沒有後端，放棄搬入行為樹引擎與接入 LLM，只借用三層接縫設計。

## 後果

- 增改台詞或換角色只動 `src/core/constants/catLines.ts`，新增處境只加 `CatCondition` 與 `CAT_CONDITIONS`，更換說話來源只換 Provider 而不改動小貓元件。
- 由 `src/systems/catBrain.test.ts` 守門，檢查每句填滿佔位符後 ≤ `CAT_LINE_MAX`（24 字）、佔位符皆合法、無重複句、每個話題條件皆可同時成立，且 `tools/lint/engine-boundary.mjs` 防止台詞寫死內容包字眼。
- 代價是台詞與連點記憶在重開 App 後歸零。

## 證據

- `docs/plans/cat-wardrobe.md` §7.5
- `docs/HANDOFF.md`「目前狀態」「已知問題」
- `src/core/constants/catLines.ts`、`src/core/constants/cat.ts`、`src/systems/catBrain.ts`、`src/systems/catBrain.test.ts`、`src/selectors/cat.ts`、`src/ui/kit/catVoice.tsx`、`src/ui/pet/CatVoiceProvider.tsx`
