# 0002 加工層、卡片與中譯與官方層分開存放

狀態：採用
日期：2026-11-15

## 背景

考生需要口訣、陷阱提醒、白話情境、四色標記、逐選項解析、觀念／新法／申論卡片與英文題中英對照，但 AI 產生或人工撰寫的說明可能出錯或修改，不能汙染官方題目與答案（決定日期依 `AGENTS.md` 建立日與 `docs/plans/civic-bunko.md` 開案日 2026-11-15；中譯組裝規則於 2026-11-16 補齊）。

## 決定

- AI 加工資料放 `data/packs/<包ID>/enrich/**`、卡片放 `cards/**`、英文中譯放 `zh/**`，各自以題目 ID 或試卷 ID 對應 `official/**`，不得寫回 `official/**`。
- `enrich/**` 每檔帶 `model`、`generatedAt`，每題帶 `reviewed`（預設 `false`；畫面對未審查解析標示「AI 解析」），並遵守口訣 ≤ 40 字、陷阱 ≤ 30 字、白話 ≤ 60 字、選項解析 ≤ 50 字等上限。
- `cards/**` 由主代理撰寫，每行 ≤ 30 字、每面 ≤ 3 行、每張 ≤ 5 面（上限定義於 `src/core/constants/cards.ts` 與 `tools/validate/cards.mjs`）；申論題原文不寫進卡片檔，載入時從官方層帶入。
- 英文中譯來源放 `tools/zh/src/<包ID>/`（來源檔不寫英文），由 `tools/zh/build.mjs` 從 `official/` 取出英文原句組裝成 `zh/**`。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 加工層、卡片或中譯出錯與重跑都不會改動官方試卷。
- 由 `tools/validate/enrich.mjs`、`tools/validate/cards.mjs`、`tools/validate/zh.mjs`（`npm run validate`）檢查字數上限、標記原文存在性、反向問法紅標與逐句英文拼回等於官方原文。
- 代價是載入與驗證端須跨目錄以 ID 關聯，且 `src/core/constants/cards.ts` 與 `tools/validate/cards.mjs` 的字數上限常數須同步維護。

## 證據

- `AGENTS.md` §2「加工層」
- `docs/plans/civic-bunko.md` §4「架構」、§9「已上線」
- `docs/HANDOFF.md`「內容品質紀錄」
- `src/core/constants/cards.ts`、`tools/validate/enrich.mjs`、`tools/validate/cards.mjs`、`tools/zh/build.mjs`、`tools/validate/zh.mjs`
