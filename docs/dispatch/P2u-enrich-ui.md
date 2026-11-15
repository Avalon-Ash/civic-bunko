# 派工單 P2u：介面顯示加工內容（口訣、圖、逐選項、法條、修法提醒）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：作答後把 `data/enrich/` 的口訣、陷阱、小圖顯示出來；點開可看每個選項的說明與法條原文。沒有加工內容的題目維持現狀。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_ui3`，分支 `p2u`。只准改這個資料夾內的檔案。

## 已由主代理改好（在你的工作區，尚未提交）

`src/core/types.ts` 的加工層型別已改成和 `data/enrich/<PaperId>.json` 一致（`Enrich`、`EnrichFile`、`EnrichVisual`、`LawFile`）。`marks` 改成以原文片段比對（`{ text, color }`），不再用位置。**改完後 `npm run lint` 目前會失敗，修好它是你的工作之一。**

## 工作

### 1. 載入
- `src/data/source.ts`：`data/enrich/*.json` 用非 eager glob，和試卷一起延後載入；找不到檔案時視為沒有。`src/systems/bankLoader.ts` 把 `EnrichFile.items` 放進 `world.enrich`（以題目 ID 為鍵）。補測試。
- 法條：`data/laws/index.json` eager；各法 `data/laws/<pcode>.json` 非 eager，使用者點條號時才載入。載入函式放 `src/data/laws.ts`。

### 2. 題幹標記
- 依 `marks` 把題幹中第一次出現的 `text` 包成標記：紅＝`--red`／`--red-bg`，藍＝`--blue`／`--blue-bg`。切分邏輯寫成純函式 `splitByMarks(stem, marks)` 放 `src/ui/marks.ts` 並寫測試（重疊時先到先得、找不到的略過）。
- 作答前就顯示標記。

### 3. 口訣回饋卡（答對答錯都顯示）
- 版面照 `prototype/mvp.html` 的 `.kou`：貓的表情＋小標（答對「答對了！口訣再記一次」／答錯「差一點！看這句馬上學會」）＋口訣大字 → 小圖 → 「陷阱」紅色小標籤＋陷阱句。
- 快刷且答對時只顯示精簡版（貓＋口訣一行），仍在 `FAST_ADVANCE_MS` 後自動下一題。
- 卡片角落放小字「AI 解析」；`confidence: 'low'` 時多一行小字「這題的說明把握較低，以官方答案為準」。
- `lawChanged` 不是 `null`：顯示一條「修法提醒」框（用 `--ink` 外框與 `--surface-sunken` 底，**不要用橘色**，橘色只給官方更正）。

### 4. 小圖元件 `src/ui/kit/Visual.tsx`
- `flow`：每列橫排，步驟之間放箭頭；`tone`：`hot`＝紅底紅字、`key`＝綠色實心白字、`plain`＝淺底；第二列以後整列變淡。窄螢幕可換行。
- `versus`：左右兩張小卡並排（左 `--butter`、右 `--mint`），標題粗體，下面條列。寬度不足 340px 時上下排。
- 出現時步驟依序彈入（每步延遲 60ms，只動 `transform`／`opacity`，尊重 `prefers-reduced-motion`）。

### 5. 逐選項與法條
- 回饋卡下方「看每個選項」→ 底部 `Sheet`：四列，各有選項字母、`why`；正解那列綠色。有 `lawRef` 的顯示可點的藍色條號標籤（例「地方制度法 第 26 條」）。
- 點條號 → 第二層 `Sheet`（或同一個 Sheet 換頁，有返回鍵）顯示該條原文，上方標「全國法規資料庫・修正日期」，載入中顯示 `sleepy` 貓。查不到條文時顯示「找不到這一條」而不是空白。

### 6. 白話版
- `plain` 不是 `null` 時，題幹上方出現「原文／白話」切換（`Segmented`）；預設原文。

## 可修改檔案

`src/data/**`、`src/systems/bankLoader.ts`、`src/selectors/**`（只新增）、`src/ui/**`，以及它們的測試；為了修好型別錯誤必須動到的其他 `src/**` 檔案（`types.ts`、`theme.css`、`constants/**` 除外）。其他一律不准改。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`prototype/mvp.html`（`.kou`、`.pic`、`.lane`、`.trap`、`.sheet`、`.line`）、`docs/dispatch/P2b-enrich.md`（欄位意義與範例）、`src/ui/screens/QuestionScreen.tsx`、`src/ui/kit/Sheet.tsx`。

目前 `data/enrich/` 可能是空的。請在 `src/testing/` 放一筆符合型別的假資料供測試使用，不要放進 `data/enrich/`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS 仍小於 300 kB。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`；不准用 `dangerouslySetInnerHTML`（加工內容是 AI 產生的文字，一律當純文字顯示）。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫。
- 不准改 `types.ts`、不准安裝套件、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 輸出的各檔大小。
