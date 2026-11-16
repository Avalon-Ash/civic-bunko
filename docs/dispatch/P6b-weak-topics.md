# 派工單 P6b：弱點考點排行、弱點回合

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **目標**：她在「集章」頁看得到自己最常錯的考點，按一下就只刷那些考點的題目。考前兩週用來補洞。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p6b`，分支 `p6b`。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不要再改）

- `src/core/types.ts`：`RoundConfig.topicIds?: string[]`。
- `src/core/world.ts`：`World.topics: TopicInfo[]`（預設空陣列）。
- `src/core/constants/weak.ts`：`WEAK_MIN_ANSWERED`、`WEAK_TOP_N`、`WEAK_ROUND_COUNT`。

## 背景

- 每一題的考點在 `world.enrich.get(id)?.topic`（1–2 個 `data/topics.json` 的 id，例如 `admin-law/disposition`）。沒有加工資料的題目視為沒有考點。
- 考點名稱與所屬科目在 `data/topics.json`，`src/data/source.ts` 已有 `loadTopics()`。
- 個人進度 `Progress`：`seen`＝作答次數、`correct`＝答對次數、`streak`＝目前連對（`seen > 0 && streak === 0` 就是「上次答錯」）。

## 邏輯

- `src/systems/bankLoader.ts`：新增 `loadTopicList(world, topics)`，把清單放進 `world.topics`（複製一份）。`src/main.tsx` 在題庫載入的同一個流程裡呼叫 `loadTopics()` 再呼叫它（失敗時留空陣列，不影響題庫載入）。
- `src/systems/selection.ts`：`collectEligibleIds` 在 `config.topicIds` 有內容時，只留「該題考點與 `topicIds` 有交集」的題目。其餘分層、洗牌、題數邏輯不變。模擬考不受影響。
- `src/systems/settings.ts`：`roundStarted` 的 `config.topicIds` 有內容時**不要**更新 `settings.lastRound`（弱點回合不該變成下次的預設設定）。
- `src/systems/persistence.ts`：回合續接保留 `config.topicIds`（必須是字串陣列，否則丟棄整個回合）；`settings.lastRound` 讀進來時去掉 `topicIds`。
- `retryWrong`、`quizSameSet` 開出的回合不帶 `topicIds`。
- `src/selectors/weak.ts`（新增）：
  - `topicStats(world, bankId)` → 每個考點一筆 `{ id, name, subjectKey, subjectShort, total（這個考點的題數）, answered（作答過的題數）, attempts（作答次數總和）, wrongAttempts（答錯次數總和＝seen − correct）, wrongNow（上次答錯的題數）, wrongRate（wrongAttempts / attempts，attempts 為 0 時是 0） }`。一題有兩個考點就兩邊都算。只算該題庫、`parseStatus === 'ok'` 的題目；名稱與科目從 `world.topics` 查，查不到的考點略過；`subjectShort` 從 `world.banks` 的科目短名查。
  - `weakTopics(world, bankId)` → `topicStats` 裡 `answered >= WEAK_MIN_ANSWERED` 且 `wrongAttempts > 0` 的考點，依 `wrongRate` 高到低、同分再依 `wrongNow` 多到少、再依 `id`；最多 `WEAK_TOP_N` 筆。
  - `weakRoundConfig(world, bankId, topicIds?)` → 開弱點回合用的 `RoundConfig`：`topicIds` 沒給就用 `weakTopics` 的全部 id；`mode: 'mixed'`、`study: 'quiz'`、`ask: 'all'`、`subjectKeys: []`、`fast` 沿用 `settings.lastRound?.fast ?? false`、`passes: 1`、`count: WEAK_ROUND_COUNT`。沒有弱點考點時回傳 `null`。
  - `weakSummary(world, bankId)` → `{ ready: boolean（有沒有弱點考點）, answeredTotal（整個題庫作答過的題數）, topicCount }`，給空狀態用。

## 畫面

- `StampsScreen`：在「各科進度」上方加一區「弱點考點」：
  - 有資料時：最上面一顆主要按鈕「刷弱點 10 題」（實際題數＝`min(WEAK_ROUND_COUNT, 可出題數)`，用既有的 `availableCount` 算；`dispatch({ type: 'startRound', config })`）。下面列出每個弱點考點：科目短名小標籤、考點名稱、一行「答錯 4 次／作答 9 次」、一條細的比例條、右側小按鈕「只刷這個」（用 `weakRoundConfig(world, bankId, [id])`）。
  - 沒資料時：小貓（`Cat`，`interactive={false}`）＋一句「再多刷幾題，我就能找出你常錯的考點」。
  - 一題都沒錯過但已刷不少題時也是空狀態，文字改成「目前沒有明顯的弱點，繼續保持」。
- `DrillSetupScreen`：模擬考入口卡下面加一張「弱點回合：只刷你最常錯的考點」，有資料時點了直接開弱點回合；沒資料時卡片停用並顯示「再多刷幾題就會開放」。
- 開回合後的畫面流程照既有的（`world.round` 有值時 App 會切到作答畫面），不用另外處理導覽；如果集章頁開回合後沒有切畫面，照 `DrillSetupScreen` 開回合的做法處理（可以改 `App.tsx`）。
- 顏色只用 token；比例條用粉彩或中性色，**不要用紅色與綠色**（紅＝問法陷阱、綠＝正解）。
- 樣式加在 `src/ui/app.css`，類別名稱用 `cb-weak-` 開頭。

## 可修改檔案

`src/systems/bankLoader.ts`、`src/systems/selection.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/systems/round.ts`（只限讓 `retryWrong`、`quizSameSet` 去掉 `topicIds`）、`src/selectors/weak.ts`（新增）、`src/main.tsx`（只限載入考點清單）、`src/ui/App.tsx`、`src/ui/app.css`、`src/ui/screens/StampsScreen.tsx`、`src/ui/screens/DrillSetupScreen.tsx`、`src/ui/components/**`（`cards/` 除外）、`src/testing/**`，以及上述檔案的測試。其他一律不准改，特別是 `src/core/**`、`src/ui/kit/**`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/screens/CardsScreen.tsx`、`src/theme.css`、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/world.ts`、`src/core/constants/weak.ts`、`src/systems/selection.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/systems/bankLoader.ts`、`src/selectors/index.ts`（看 `subjectStats`、`availableCount` 的寫法）、`src/data/source.ts`、`src/main.tsx`、`src/ui/screens/StampsScreen.tsx`、`src/ui/screens/DrillSetupScreen.tsx`、`src/testing/fixture.ts`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS（`dist/assets/index-*.js`）小於 390 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

新邏輯都要有測試：`topicIds` 篩選（含一題兩個考點、沒有加工資料的題目被排除、空陣列＝不限）；`topicStats` 的各個數字；`weakTopics` 的門檻、排序、上限；`weakRoundConfig` 沒有弱點時回 `null`、指定單一考點；弱點回合不更新 `lastRound`；存檔往返保留 `topicIds`、壞資料丟棄、`lastRound` 去掉 `topicIds`；`retryWrong` 不帶 `topicIds`。既有測試不准刪、不准弱化。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM，時間與亂數由參數注入。
- 觸控區至少 44pt；動態效果尊重 `prefers-reduced-motion`；手機 320pt 寬到 iPad 都不能破版；日夜兩套都要能看。
- 不准改型別與常數、不准安裝套件。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小。
