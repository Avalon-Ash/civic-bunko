# 0006 禁用瀏覽器原生彈窗與 as any，介面用自製元件與純 CSS

狀態：採用
日期：2026-11-15

## 背景

本專案主要在 iPhone／iPad（含加入主畫面 PWA 模式）使用，需自訂底部抽屜、對話框、安全區域、日夜雙主題與減少動態設定，且維持靜態打包、執行期只依賴 React 與 TypeScript strict 的型別檢查限制（決定日期依 `AGENTS.md` 建立日與 `docs/plans/civic-bunko.md` 開案日 2026-11-15）。

## 決定

- `src/` 內一律禁用 `alert()`、`confirm()`、`prompt()`、`window.open()`、`target="_blank"` 與 `as any`；所有抽屜、對話框、提示均使用 `src/ui/kit/` 的頁面內自製元件。
- 執行期套件相依僅保留 `react` 與 `react-dom`（`package.json`）；樣式與互動動態全以純 CSS 實作，顏色與版面 token 集中於 `src/theme.css`，樣式層疊順序集中於 `src/ui/app.css`，並支援系統／淺色／深色主題切換與減少動態效果。

## 放棄的做法

`docs/plans/civic-bunko.md` §4 記載沒有採用 Tailwind、motion 或其他動畫套件，亦不使用瀏覽器原生彈窗與另開分頁（放棄細節與其他候選比較，原紀錄沒有寫。）。

## 後果

- iOS PWA 內不會被瀏覽器原生彈窗或另開視窗打斷，且執行期不引入額外 CSS／動畫框架相依。
- 由 `tools/lint/no-popups.mjs` 與 `tsc --noEmit`（均掛於 `npm run lint`）阻擋違規呼叫與 `as any`。
- 代價是抽屜、對話框、提示元件與 CSS 樣式表須自行維護，樣式新增時必須依層疊順序放進 `src/ui/app.css`。

## 證據

- `AGENTS.md` §2「架構（ECS＋SSOT）」「介面」
- `docs/plans/civic-bunko.md` §3「題庫總數與可玩性」、§4「架構」「App 架構：ECS＋SSOT」、§9「程式結構補充」
- `tools/lint/no-popups.mjs`、`package.json`、`src/theme.css`、`src/ui/app.css`、`src/ui/kit/`
