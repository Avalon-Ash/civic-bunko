# 0022 卡片↔官方題的連結只存在卡片的 questions；卡片回合不存卡片、複習狀態由作答紀錄導出

狀態：採用
日期：2026-11-27

## 背景

考生說「看到考題想不起圖卡」：卡片和題目互不相識，解析頁只顯示該題自己的口訣，卡片也開不出「這張卡的題」（`docs/plans/comic-cards.md` §1）。她已經在用、也設了同步，新功能不能新增存檔或同步欄位（`AGENTS.md` §2、ADR 0010、0013）。進行中的回合會整包存進本機，`RoundConfig` 多一個欄位就等於多一個存檔欄位。

## 決定

- 連結的正本是卡片上的選填欄位 `StudyCard.questions`（官方題號清單，放 pack）。候選由 `tools/cards/suggest-links.mjs` 用「正解選項的 `lawRef` 落在卡片 `lawRefs` 裡」列出（`--any` 改成任一選項，只當參考），主席逐題看過題幹才寫進卡片；不用考點（`enrich.topic`）當連結，太粗。
- 查詢只有一處：`src/systems/cardLinks.ts` 的 `cardQuestionIds`（正向，給回合系統用），由 `src/selectors/cardLinks.ts` 轉出並加上反向的 `cardsForQuestion`；畫面一律經 selector 查。
- 「刷這張卡的題」是新的 `UICommand` `startCardRound { cardId }`：用 `cardQuestionIds` 組出 `queue`，`config` 只用一般回合既有的欄位，**不在 `RoundConfig` 記卡片**。存下來的回合和一般回合同形，續玩靠既有的 `queue`。
- 刷題時解析區（口訣卡最下面）列出這題連到的圖卡，點了在抽屜裡打開，關掉回到原題；模擬考作答中本來就沒有解析，不顯示。
- 卡片的「該複習／熟了」不存，由連到的題的作答紀錄導出；練習（遮起來想、排一排）的成績不存。

## 放棄的做法

- 在 `RoundConfig` 加 `cardId`：等於新增存檔欄位，要新的 golden 樣本與遷移。
- 連結反過來存在題目的加工層（`enrich`）：一張卡要改十幾個檔，卡片也看不出自己掛了哪些題。
- 用「任一選項的 `lawRef`」自動連結：錯誤選項引用的條文也會算進來，會連到不相干的題。

## 後果

- 沒有 `lawRefs` 的卡（行政學、國文）機械連不到，要人工找候選；找不到合適的就不掛，那張卡沒有「刷這張卡的題」。
- 重開 App 續玩卡片回合照常，只是不知道它來自哪張卡。
- 由 `src/selectors/cardLinks.test.ts`（正反向互為反函數、只留存在的題）、`src/systems/cardRound.test.ts`（只出這張卡的題、`config` 沒有多的欄位）、`tools/validate/comics.test.mjs`（`questions` 的題號都在官方題庫裡）守門；`persistenceGolden.test.ts` 不改。

## 證據

- `docs/plans/comic-cards.md` §2.4、§2.5、§3-3、§3-4、§11 指令 2、3
- `src/systems/cardLinks.ts`、`src/selectors/cardLinks.ts`、`src/systems/round.ts`（`startCardRound`）
- `tools/cards/suggest-links.mjs`
