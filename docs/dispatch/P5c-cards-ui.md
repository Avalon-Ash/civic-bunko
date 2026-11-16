# 派工單 P5c：圖卡分頁（觀念卡、新法卡、申論架構卡）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：「圖卡」分頁從「準備中」變成可以用：她能一張一張看前置觀念、新法重點、申論題的答題骨架，看過的會打勾。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p5c`，分支 `p5c`。只准改這個資料夾內的檔案。

## 已由主代理準備好（已提交，不要再改）

- 型別：`src/core/types.ts` 的 `StudyCard`、`CardFace`、`CardKind`、`CardFile`；`Settings.cardsSeen?`；`UICommand` 的 `markCardSeen`。
- 資料：`data/cards/*.json`（目前有 `concept.json` 5 張、`essay-local-gov.json` 1 張；之後主代理會再加卡片與 `kind: 'newlaw'` 的檔案，形狀相同，畫面不能寫死張數或檔名）。
- 載入：`src/systems/cardLoader.ts` 把卡片放進 `world.cards`（申論卡的 `essayText` 是官方題目原文），發 `cardsLoaded`；`src/main.tsx` 已接好。
- 寫入：`dispatch({ type: 'markCardSeen', id })` 已可用。
- 字數上限：`src/core/constants/cards.ts`（內容已由 `tools/validate/cards.mjs` 把關，畫面不用再檢查，但版面要能容納上限長度）。

## 邏輯

- `src/selectors/cards.ts`（新增）：
  - `cardDecks(world)` → 依 `concept`、`newlaw`、`essay` 的順序回傳 `{ kind, label, total, seen }`（label：觀念／新法／申論）；沒有卡片的類別不回傳。
  - `cardsOfKind(world, kind)` → 該類卡片（維持檔案內順序），每張附 `seen: boolean` 與 `subjectShort`（從 `world.banks` 的科目短名查，查不到是 `null`）。
  - `cardById(world, id)` → 單張卡或 `null`。
  - 申論卡另附 `paperLabel`（例「113 年普考・申論第 1 題」；年度與考試別從 `world.papers` 查）。
- `src/systems/cardLoader.test.ts`（新增）：測 `loadCards`：申論題原文有填入、找不到申論題的卡片不載入、重複 ID 只留第一張、有發 `cardsLoaded`。

## 畫面（`src/ui/screens/CardsScreen.tsx` 與 `src/ui/components/cards/**`）

- 最上方 `Segmented` 切三類，標籤帶進度（例「觀念 2/5」）。只有一類有卡片時不顯示切換。
- 卡片清單：每張顯示標題、一句話重點（`hook`）、科目短名小標籤；看過的右上角有貓掌勾。手機單欄；寬度 ≥ 768px 兩欄。
- 點一張卡 → 開 `Sheet`（盡量高）：
  - 標題、`hook`、小圖（`visual` 不是 `null` 時用 `src/ui/kit/Visual.tsx`）。
  - **觀念卡、新法卡**：`faces` 一次只顯示一面（面的小標題＋最多三行重點），下方圓點與「下一面」；可以左右滑動換面（觸控拖曳，別和抽屜的下拉關閉打架；做不好就只留按鈕與圓點）。最後一面的按鈕是「看完了」：`markCardSeen`、貓掌特效（用既有的 `Burst`）、關閉抽屜。
  - **申論卡**：先顯示題目來源（`paperLabel`）與官方題目原文（預設收成三行，點了展開）；下面把所有 `faces` 依序排成編號方塊（破題、…、結論）全部看得到。右上有開關「遮起來背」：打開後每個方塊只剩小標題，點方塊才翻開那一塊。最下方按鈕「背好了」：`markCardSeen`。
  - `lawRefs` 顯示成條號小標籤，點了顯示條文原文：做法照 `QuestionScreen.tsx` 既有的法條顯示（`formatLawRef`、`src/data/lawLookup.ts`），可以把那段抽成共用元件放 `src/ui/components/`，但 `QuestionScreen.tsx` 本身只准做「改成引用共用元件」這一種修改；不想動它就自己在 `components/cards/` 寫一份呼叫 `lawLookup` 的小元件。
- 卡片還沒載入（`world.cards` 是空的）時維持現在的「準備中」畫面。
- 樣式寫在新檔 `src/ui/cards.css`，由 `CardsScreen.tsx` 引入；類別名稱用 `cb-card-` 開頭。**不要改 `src/ui/app.css`**（另一包正在改）。
- 可玩性：清單卡片按下有回彈；翻面有滑動轉場；看完時貓掌特效；全部尊重 `prefers-reduced-motion`，只用 CSS。

## 可修改檔案

`src/selectors/cards.ts` 與測試（新增）、`src/systems/cardLoader.test.ts`（新增）、`src/ui/screens/CardsScreen.tsx`、`src/ui/components/cards/**`（新增）、`src/ui/cards.css`（新增）、`src/ui/components/LawArticle*.tsx`（若抽共用元件，新增）、`src/ui/screens/QuestionScreen.tsx`（只限上述「改成引用共用元件」）。其他一律不准改，特別是 `src/core/**`、`src/systems/*.ts`（測試新檔除外）、`src/selectors/index.ts`、`src/ui/app.css`、`src/ui/App.tsx`、`src/main.tsx`、`src/theme.css`、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/cards.ts`、`src/systems/cardLoader.ts`、`data/cards/concept.json`、`data/cards/essay-local-gov.json`、`src/selectors/index.ts`（看既有寫法）、`src/ui/screens/CardsScreen.tsx`、`src/ui/screens/StampsScreen.tsx`（看畫面慣例）、`src/ui/screens/QuestionScreen.tsx`（法條顯示那段）、`src/ui/kit/Sheet.tsx`、`src/ui/kit/Segmented.tsx`、`src/ui/kit/Visual.tsx`、`src/ui/kit/Burst.tsx`、`src/theme.css`（只讀，看 token）。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS（`dist/assets/index-*.js`）小於 380 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。
selector 都要有測試：三類的順序與進度、沒有卡片的類別不出現、`seen` 標記、`paperLabel`、`cardById` 查不到回 `null`。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 顏色只用 `src/theme.css` 的 token，日夜兩套都要能看；四色語意不能挪用（紅＝問法陷阱、綠＝正解、藍＝法條與核心名詞、橘＝官方更正）：條號標籤用藍，其餘用中性色與粉彩 token。
- 元件只經 `selectors` 讀、`dispatch` 寫；觸控區至少 44pt；處理 safe-area；320pt 寬到 iPad 橫向都不能破版。
- 不准改型別與常數、不准安裝套件、不准弱化或刪除既有測試。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
