# 派工單 P6c：英文題中英對照

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：使用者夫妻英文都很弱。英文題（法學知識與英文 31–50 題）要能中英對照著看：題組文章逐句對照、題幹與選項有中譯、每題有重點單字表。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p6c`，分支 `p6c`。只准改這個資料夾內的檔案。

## 已由主代理準備好（已提交，不要再改）

- 資料：`data/zh/<PaperId>.json`（5 份；`ZhFile`：`groups[]` 逐句對照 `segments[{en, zh}]` 與 `vocab`；`items[]` 每題 `stem`（克漏字題是 `null`）、`options.A–D`、`vocab`）。內容不准改。
- 型別：`src/core/types.ts` 的 `VocabEntry`、`QuestionZh`、`GroupZh`、`ZhFile`；`Settings.bilingual?`（沒設定視為開啟）；指令 `setBilingual`。
- `src/core/world.ts`：`world.zh`（題目 ID → `QuestionZh`）、`world.groupZh`（題組 ID → `GroupZh`）。

## 邏輯

- `src/data/source.ts`：`loadZhFiles()`，照 `loadEnrichFiles` 的寫法（`import.meta.glob('../../data/zh/*.json')`，延後載入，失敗當作沒有）。
- `src/systems/zhLoader.ts`（新增）：`loadZh(world, files)` 把資料放進 `world.zh`、`world.groupZh`（重複 ID 留第一筆），最後 `bumpStore`。`src/main.tsx` 在題庫載入的同一個流程裡呼叫（失敗不影響刷題）。
- `src/systems/settings.ts`：`setBilingual(world, on)`，照 `setShuffleOptions` 的寫法；`src/core/commands.ts` 只准加這一個 case；`src/systems/persistence.ts` 保留 `settings.bilingual`（必須是布林，否則丟掉這個欄位）。
- `src/selectors/index.ts`：`currentQuestion`、`readView` 的回傳多兩個欄位 `zh: QuestionZh | null`、`groupZh: GroupZh | null`；`src/selectors/exam.ts` 的 `examQuestionDetail` 也一樣。新增 `bilingualOn(world)`（`settings.bilingual !== false`）。

## 畫面

共用元件放 `src/ui/components/Bilingual.tsx`，樣式放新檔 `src/ui/bilingual.css`（由元件引入，類別名稱 `cb-zh-` 開頭）。**不要改 `src/ui/app.css`。**

- **開關**：這題有 `zh` 或 `groupZh` 時，題卡上方（原本放「原文／白話」的位置；英文題沒有白話版）顯示一顆 `Chip`「中英對照」，點了切換 `setBilingual`，開啟時是選中樣式。沒有中譯資料的題目不顯示。
- **題組文章**（既有的 `PassageCard`）：對照開啟且有 `groupZh` 時，改成逐句顯示：每句一個區塊，英文在上（原本的字級），中文在下（小一級、柔和的字色），句與句之間留間距。對照關閉時維持現在的整段原文。文章下方有可收合的「單字表」（預設收合），列出 `groupZh.vocab`（英文粗體＋中文）。
- **作答畫面**（`QuestionScreen`，一般回合）：
  - 對照開啟時，題幹下方顯示 `zh.stem`（有的話）。
  - 作答前：選項只顯示英文；選項區下方一顆小按鈕「看選項中文」，點了才在每個選項下方顯示 `zh.options`（換題後恢復隱藏）。這是為了讓她先試著自己讀。
  - 作答後：對照開啟時每個選項下方直接顯示 `zh.options`，口訣卡下方多一塊「這題的單字」列出 `zh.vocab`（沒有就不顯示）。
  - 選項打亂時，中譯要跟著官方代號走（`zh.options[官方代號]`），不能照畫面位置。
- **模擬考作答中**：完全不顯示中譯、開關與單字表。
- **看答案模式**（`ReadScreen`）：對照開啟時題幹中譯、每個選項中譯、逐句對照、單字表都直接顯示。
- **模擬考結果的錯題抽屜**（`ResultScreen`）：對照開啟時顯示題幹與選項中譯、逐句對照。
- 中文一律用中性字色（`--ink-soft` 之類的 token），不要用紅、綠、藍、橘（四色有固定語意）。
- 版面：320pt 寬不破版；長選項的中譯要能換行；觸控區至少 44pt；日夜兩套都要能看；動態效果只用 CSS 並尊重 `prefers-reduced-motion`。

## 可修改檔案

`src/data/source.ts`、`src/systems/zhLoader.ts`（新增）、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/core/commands.ts`（只加一個 case）、`src/main.tsx`（只限載入中譯）、`src/selectors/index.ts`、`src/selectors/exam.ts`、`src/ui/components/**`（`cards/` 除外）、`src/ui/bilingual.css`（新增）、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ReadScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/testing/**`，以及上述檔案的測試。其他一律不准改，特別是 `src/core/types.ts`、`src/core/world.ts`、`src/core/constants/**`、`src/ui/app.css`、`src/ui/kit/**`、`src/ui/screens/StampsScreen.tsx`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/screens/CardsScreen.tsx`、`src/theme.css`、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/world.ts`、`data/zh/115-general-law-english.json`、`src/data/source.ts`、`src/main.tsx`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/systems/cardLoader.ts`（看載入器的寫法）、`src/selectors/index.ts`、`src/selectors/exam.ts`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ReadScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/components/QuestionParts.tsx`、`src/ui/kit/Chip.tsx`、`src/theme.css`（只讀）。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS（`dist/assets/index-*.js`）小於 392 kB（中譯資料要是獨立的延後載入分片，不能進主程式）。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

新邏輯都要有測試：`loadZh`（放進兩個 Map、重複 ID 留第一筆）；`setBilingual` 與存檔往返、壞資料丟棄；`bilingualOn` 預設開啟；`currentQuestion`／`readView`／`examQuestionDetail` 帶回 `zh` 與 `groupZh`（有與沒有兩種情況）。既有測試不准刪、不准弱化。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM。
- 不准改型別與常數、不准改 `data/**`、不准安裝套件。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
