# 0020 漫畫是卡片的選填衍生層，格子文字只用指標指向卡片原文

狀態：採用
日期：2026-11-27

## 背景

App 唯一的使用者說現在的圖卡很難背，要用四格漫畫的起承轉合讓印象和硬背同步（`docs/reference/comic-cards-request.md`）。卡片內容（`hook`、`faces`、`lawRefs`）已逐條對過 `data/laws`；她給的規格裡有條號錯誤（地方制度法第 55、56 條寫反）。漫畫若自己帶一份文字，就會出現第二份內容、需要第二次校對，也可能出現卡片沒有的字。

## 決定

- `StudyCard` 加選填欄位 `comic?: CardComic`（`src/core/types.ts`），寫在既有的 `data/packs/<包ID>/cards/*.json`。沒有 `comic` 的卡照舊只顯示文字卡；拿掉 `comic` 就回到文字卡。
- 格子裡的字是指標 `ComicTextRef`：`hook`、某一面的 `heading`、某一面的某一行（可加 `pick` 取那一行的子字串）。舉牌大字 `sign` 必須是那句話的子字串；versus 的欄標題 `columns` 也是指標。
- 解析與檢查只在 `src/systems/comic.ts`：`resolveComicText`、`comicPanelText`、`comicProblems`。指不到原文、`pick`／`sign` 不是子字串，`comicProblems` 就回報；畫面遇到指不到的格子不畫字。
- 漫畫只挑 2–5 行當記憶錨點，不取代卡片：抽屜裡漫畫在上，原本的翻面、法條鈕留在下面，一行都不少。
- 漫畫沒有自己的字數上限：字都是卡片原文，受 `constants/cards.ts` 管。
- 「遮起來想」的開關與揭曉狀態只放元件狀態，不存檔（`docs/plans/comic-cards.md` §2.5、§10-5）。

## 放棄的做法

- 格子裡寫自己的字串：第二份內容要另外校對，而且會寫出卡片沒有的字。
- 另開 `comics/` 資料夾：要動 `src/data/source.ts`、`tools/paths.mjs` 與 ADR 0011 的包形狀；驗證腳本也要多認一種檔。
- 漫畫取代翻面：考點的完整條列與法條會不見。

## 後果

- 卡片改一個字，漫畫跟著變；之後的小遊戲（排一排、配對）直接從同一份資料產生。
- 卡片改版刪掉一行時，指向它的格子會在 `npm test` 紅起來，要同時改漫畫資料。
- 由 `tools/validate/comics.test.mjs` 守門：每張卡的 `comicProblems` 是空的、每一格都解析得到字、壞資料會被抓到。

## 證據

- `docs/plans/comic-cards.md` §1、§2.1、§2.5
- `docs/reference/comic-cards-request.md`
- `src/core/types.ts`（`CardComic`、`ComicTextRef`）、`src/systems/comic.ts`、`tools/validate/comics.test.mjs`
