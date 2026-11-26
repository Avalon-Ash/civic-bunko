# UX3：圖卡列表（依科目分組、列表變矮、漫畫篩選與小圖）

執行者：agy `gemini-4-neon-medium`；工作資料夾 `C:\Git\_wt_civic_ux_cards`（分支 `ux3-cards`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
圖卡頁有 4,625px（5.5 個螢幕）：33 張觀念卡單欄全攤開，一張 120px。考生說「全部攤開、滑動太長」。另外圖卡開始有四格漫畫，列表要看得出哪幾張有漫畫、可以只看有漫畫的。背景：`docs/plans/ux-cleanup.md` §1.2 L1、§3 圖卡那一列、§8-4；`docs/plans/comic-cards.md` §3-1。引導架構 `docs/adr/0019-guide-targets-single-go.md`。

## 已經有的（直接用，不要改）
- `src/ui/kit/Collapse.tsx`：原地收合（`title`、`summary`、`defaultOpen`；其他屬性放到外層 `section`）。樣式在 `styles/kit.css`，不改。
- `src/ui/kit/comic/ComicStrip.tsx` 匯出的 `ComicThumb`（`<ComicThumb comic={card.comic} />`，72px 寬的第一格小圖）。
- `src/selectors/cards.ts` 匯出的 `cardHasComic(card)`。
- `src/ui/useGuide.ts`：`guideAnchor('cards-unseen')`、`useGo()`；`src/core/constants/guide.ts` 的 `GUIDE.cardsEmpty`。**這些檔都不改。**

## 要做的
1. **依科目分組**（`CardsScreen.tsx`）：科目篩選選「全部」時，卡片依科目分組，每組一個 `Collapse`：標題「〈科目短名〉」，`summary` 寫「看過 x/y」或「還有 N 張沒看」（擇一，寫在報告）。**預設只展開第一個還有沒看過的卡的組**（都看過就展開第一組）。選了某一科時照舊平鋪那一科，不分組。沒有科目的卡（`subjectKey` 是 null）放最後一組「其他」。
2. **列表項變矮**（`CardListItem.tsx`）：分組裡不必再顯示科目籤（加一個 `showSubject` 屬性，分組時傳 false；平鋪時照舊顯示）。版面改成一列：左邊（有漫畫時）`ComicThumb`、中間標題＋一句話重點（重點最多兩行、超過用省略號）、右邊已看過的貓掌勾。目標一張約 70–80px。另外留一個選填的 `badge?: ReactNode`，畫在標題旁邊（之後的「該複習」記號會放這裡；現在沒有人傳）。
3. **「漫畫」篩選**：科目籤那一排最前面（「全部」後面）多一顆「漫畫 N」（N＝這一類裡有漫畫的張數；0 張就不顯示）。選了它就只平鋪有漫畫的卡、不分組。
4. **落點**：顯示順序裡第一張沒看過的卡標 `guideAnchor('cards-unseen')`（都看過就不標；同一個 id 只標一次）。它所在的組一定是預設展開的那一組。
5. **空狀態**（`CardsPlaceholder`，「先去刷題熱身吧！」）下面加一顆「去刷題」：`go(GUIDE.cardsEmpty)`。
6. 寬螢幕（≥700px）原本是兩欄：分組後每組裡面照舊兩欄，不要弄壞。

樣式只改 `src/ui/cards.css`。

## 可以改的檔（只有這些）
`src/ui/screens/CardsScreen.tsx`、`src/ui/components/cards/CardListItem.tsx`、`src/ui/cards.css`。其他檔一律不改（`CardDetailSheet.tsx`、`kit/comic/*`、`selectors/*`、`core/*` 都不改）；覺得非改不可就停下回報。

## 不能碰壞的
- 存檔零新欄位：分組開關只放元件狀態，換頁回到預設。不改 `src/testing/golden/**`。
- 點卡片照舊打開抽屜（`CardDetailSheet`）。已看過的貓掌勾照舊。
- 不在 `src/` 寫科目名稱或考試名稱字樣（科目短名從資料讀）。不用瀏覽器彈窗。

## 驗收（主席整合後重跑；你也跑）
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過（`src/ui/guide.test.ts` 會檢查落點只用 `guideAnchor('…')`、不重複）。
- 主席會在預覽 390×844 量：圖卡頁空白存檔 ≤ 2,000px（現 4,625）；820×1180 寬版兩欄沒壞；從今日任務「看一張新圖卡」點過來，落在第一張沒看過的卡。

## 指令
只能跑這三個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（測試、`guide.ts` 不准改）。
- 不新增耦合（「有沒有漫畫」只用 `cardHasComic`；「第一張沒看過」只判斷一次，分組預設展開與落點共用它）。

## 什麼時候停下來回報
規格互相矛盾、同一個驗收失敗兩次、需要改「可以改的檔」以外的檔、需要新增存檔欄位。

## 回報
每個完成項附 `檔案:行號`；三個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
