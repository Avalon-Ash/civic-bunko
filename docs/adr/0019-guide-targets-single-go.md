# 0019 引導的目的地只定義在任務表與 guide.ts，畫面只經 go() 換頁與落點

狀態：採用
日期：2026-11-27

## 背景

使用者 2026-11-26 回報「任務引導沒有正確引導到要按的按鈕」（`docs/reference/ux-audit-2026-11-26.md`）。今日頁的「今日任務」卡不管任務是什麼都去小貓分頁（舊的 `TodayScreen.tsx` 卡片 `onClick={onGoCat}`）；換頁的入口散成 `onStartQuiz`、`onGoSetup`、`onGoStamps`、`onGoCat` 四個回呼，每個畫面自己決定去哪，而且只能換分頁、不能落在某一顆按鈕（`docs/plans/ux-cleanup.md` §1.1 G1、G8）。

## 決定

- 「叫她去做某件事」的目的地是 `GuideTarget = { tab, anchor?, preset? }`（`src/core/types.ts`）：哪個分頁、落在哪個元素、到了先做什麼。
- 任務的目的地寫在任務自己身上：`Quest.go` 必填，新增任務種類沒填目的地 `tsc` 就紅。其他目的地（成就依 `AchievementMetric`、題數獎勵、鎖住的配件、空狀態、同步出錯、完成提示）都在 `src/core/constants/guide.ts`；共用的目的地（`GO_START` 等）只定義一次，任務表也引用它們。
- 落點 id 的清單與說明是 `GUIDE_ANCHORS`，預選是 `GUIDE_PRESETS`（同檔）。畫面用 `guideAnchor(id)`（`src/ui/useGuide.ts`）標在元素上，不直接寫 `data-guide`；同一個 id 只標一個元素。
- 畫面只經 `useGo()` 拿到的 `go(target)` 換頁與落點；`go` 由 `App.tsx` 經 context 提供，不加成各畫面的 props。`planGo` 決定怎麼走：有回合正在進行時去刷題分頁只回到那一題（不落點、不預選、不清回合）；停在結果頁時先收掉結果頁再落點。
- 落點：換頁後捲到元素、置中、閃一下（尊重減少動態）；找不到元素就只換分頁、不報錯。預選由目的地畫面用 `useGuidePreset` 接，每次引導只交出一次。
- 「直接開始回合」只保留今日頁本來就是這樣的三回快刷；其他一律落在按鈕，範圍與題數由她自己按。

## 放棄的做法

- 每個畫面各自收 `onGoX` 回呼：入口會繼續增加，目的地散在 `App.tsx` 與各畫面。
- 目的地用 `QuestKind` 做 switch 寫在畫面裡：新增任務種類時畫面不會紅，和「一個概念只定義在一處」衝突。
- 落點用 `id` 屬性或 ref 傳遞：`id` 會和既有的頁內 id 撞；ref 要層層往上傳。
- 任務卡直接開始回合：會開出她沒選的範圍與題數（`docs/plans/ux-cleanup.md` §8-7 的預設）。

## 後果

- 之後任何「叫她去做某件事」的介面都照這條：目的地加在 `guide.ts`（或任務表），畫面標 `guideAnchor`、呼叫 `go`。
- 過渡期（到 UX5）舊的四個回呼與 `go()` 並存；畫面還沒標上的落點，`go()` 只換分頁。
- 目的地與存檔無關：`QUESTS` 不進存檔（存的是 id），收合與引導都不新增存檔欄位。
- 由 `src/ui/guide.test.ts` 守門：每個任務、每種成就、`GUIDE` 每一列都有目的地且落點與預選在清單裡；畫面上標的落點都在清單裡、不重複、只用 `guideAnchor()`；`planGo` 的三種情況。「清單裡每個落點都有畫面標上」在 UX5 打開。

## 證據

- `docs/reference/ux-audit-2026-11-26.md`
- `docs/plans/ux-cleanup.md` §1.1、§2.2、§2.3
- `src/core/constants/guide.ts`、`src/core/constants/wardrobe.ts`（`QUESTS`）
- `src/ui/useGuide.ts`、`src/ui/App.tsx`、`src/ui/guide.test.ts`
