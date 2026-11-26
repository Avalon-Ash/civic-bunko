# CC3：卡片↔官方題（刷這張卡的題、解析區帶出圖卡）

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_links`（分支 `cc3`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
考生說「看到考題想不起圖卡」。卡片和題目現在互不相識。這一包把兩邊接起來：卡片上記它對應哪些官方題（`StudyCard.questions`，主席已放好型別），然後
1. 圖卡抽屜可以「刷這張卡的題」；
2. 刷題時，解析區帶出這題的圖卡，點了在抽屜裡打開。
背景：`docs/plans/comic-cards.md` §2.4、§2.5、§3-3、§3-4。

## 已經有的（主席放好了，直接用，不要改）
- `src/core/types.ts`：`StudyCard.questions?: QuestionId[]`；`UICommand` 的 `{ type: 'startCardRound'; cardId }`。
- `src/core/commands.ts`：`startCardRound` 那一條已經接到 `systems/round.ts` 的 `startCardRound(world, cardId, rng)`（**這個函式由你寫**，現在不存在所以 `tsc` 是紅的）。
- 紅色測試：`src/selectors/cardLinks.test.ts`、`src/systems/cardRound.test.ts`。**不准改**；全部變綠就是完成。
- `src/core/constants/guide.ts` 的 `GUIDE.cardRound`（去刷題分頁）；`src/ui/useGuide.ts` 的 `useGo()`。

## 要做的
1. **`src/selectors/cardLinks.ts`**（新檔）：`cardQuestionIds(world, cardId): QuestionId[]`（只留題庫裡有的、去重、照卡片寫的順序）、`cardsForQuestion(world, questionId): CardView[]`（照 `world.cards` 的順序；`CardView` 用 `selectors/cards.ts` 已有的 `cardById` 或同檔的轉換，不另寫一份）。卡片↔題目的查詢只在這個檔。
2. **`src/systems/round.ts`**：`startCardRound(world, cardId, rng)`：題目＝`cardQuestionIds`，洗牌後開作答回合（`study: 'quiz'`、`mode: 'mixed'`、`ask: 'all'`、`count`＝題數、`passes: 1`、`fast: false`、`subjectKeys: []`、`bankId`＝題目所在的題庫）。**不在 `RoundConfig` 加任何欄位**（測試會擋）；選項打亂照 `world.settings.shuffleOptions`，寫法沿用 `startRound`／`quizSameSet` 現有的那段，不另寫一份。沒有題目就不動作。
3. **`tools/cards/suggest-links.mjs`**（新檔，只印不寫）：每張非申論卡，列出「正解選項的 `lawRef` 落在卡片 `lawRefs` 裡」的題目候選（`--any` 參數改成任一選項）。最後一行印 `linked <N> of <總題數>`。照開案書 §11 指令 2、3 的算法，要能重現 **110**（預設）與 **183**（`--any`）。
4. **圖卡抽屜的按鈕**：新元件 `src/ui/components/cards/CardRoundButton.tsx`：`cardQuestionIds` 有題目才顯示「刷這張卡的題（N 題）」，點了 `dispatch(world, { type: 'startCardRound', cardId })` 再 `go(GUIDE.cardRound)`。**不要改 `CardDetailSheet.tsx`**（主席接）。
5. **解析區帶出圖卡**：新元件 `src/ui/components/cards/CardLinks.tsx`：給 `world` 與 `questionId`，用 `cardsForQuestion` 列出「圖卡：〈卡片標題〉」小鈕（卡片有漫畫時鈕前面放 `src/ui/kit/comic/ComicStrip.tsx` 匯出的 `ComicThumb`），點了在抽屜（`CardDetailSheet`）裡打開那張卡，關掉回到原題。沒有連到的卡就什麼都不畫。
   - `src/ui/components/QuestionParts.tsx` 的 `EnrichCard` 加一個選填的 `extra?: ReactNode`，畫在口訣卡最下面。
   - 在 `QuestionScreen.tsx`、`ReadScreen.tsx`、`ResultScreen.tsx` 用到 `EnrichCard` 的地方傳 `extra={<CardLinks world={world} questionId={…} />}`。**模擬考作答中不顯示**（交卷後看答案才有；判斷沿用畫面裡現有的模擬考判斷）。
6. 樣式只加在 `src/ui/styles/question.css`（解析區的小鈕）。

## 可以改的檔（只有這些）
`src/selectors/cardLinks.ts`（新）、`src/systems/round.ts`、`tools/cards/suggest-links.mjs`（新）、`src/ui/components/cards/CardRoundButton.tsx`（新）、`src/ui/components/cards/CardLinks.tsx`（新）、`src/ui/components/QuestionParts.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ReadScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/styles/question.css`。其他檔一律不改（`types.ts`、`commands.ts`、`guide.ts`、`CardDetailSheet.tsx`、`CardsScreen.tsx`、卡片資料都不改；**卡片的 `questions` 由主席看過候選後寫，不是你**）。覺得非改不可就停下回報。

## 不能碰壞的
- 存檔零新欄位：不改 `src/testing/golden/**` 與 `persistenceGolden.test.ts`；進行中的回合存下來的形狀和一般回合一樣。
- 不在 `src/` 寫科目名稱或考試名稱字樣（引擎邊界 lint）。不用瀏覽器彈窗。

## 驗收
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過（含上面兩個紅色測試）。
- `node tools/cards/suggest-links.mjs` 最後一行 `linked 110 of 925`；`node tools/cards/suggest-links.mjs --any` 最後一行 `linked 183 of 925`。

## 指令
只能跑這五個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
- `node tools/cards/suggest-links.mjs`
- `node tools/cards/suggest-links.mjs --any`
讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（兩個測試檔、`guide.ts` 不准改）。
- 不新增耦合（卡片↔題目只在 `cardLinks.ts` 查；選項打亂沿用現有寫法）。

## 什麼時候停下來回報
規格互相矛盾、同一個驗收失敗兩次、需要改「可以改的檔」以外的檔、發現 `startCardRound` 一定要在 `RoundConfig` 加欄位才做得到。

## 回報
每個完成項附 `檔案:行號`；五個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
