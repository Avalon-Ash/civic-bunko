# 派工單 W1-sys：衣櫥系統（小魚乾、成就、每日小任務、買與穿、存檔、同步）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-wardrobe.md` §2、§3.2–3.5。
- **目標**：她刷題會賺小魚乾，能買配件、分部位換裝；每天有一個小任務，累計紀錄會解鎖成就。兩台裝置同步後不會互相蓋掉。這包只做邏輯、存檔、同步與測試，**不做畫面**（畫面由主代理做）。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_wsys`，分支 `wsys`（base `7dd3659`）。只准改這個資料夾內的檔案。

## 已由主代理改好（已提交，不要再改）

- `src/core/types.ts`：`SlotId`、`ItemId`、`AchievementId`、`QuestId`、`ItemSource`、`WardrobeItem`、`Outfit`、`AchievementMetric`、`Achievement`、`QuestKind`、`Quest`、`Celebration`、`WardrobeState`、`Settings.wardrobe?`；事件 `roundFinished` 多了 `config`、新事件 `rewardsEarned`；指令 `buyItem`、`wear`、`dismissCelebrations`。
- `src/core/world.ts`：`World.celebrations: Celebration[]`（預設空陣列）。
- `src/core/constants/wardrobe.ts`：`SLOTS`、`ITEMS`、`WARDROBE_START_DAY`、`WELCOME_FISH`、`FISH_PER_QUESTION`、`DAILY_TIERS`、`SPRINT_DAYS`、`ACHIEVEMENTS`、`QUEST_ROUND_MIN`、`QUESTS`。數字只從這裡讀，不准在別處寫死。

## 規則（照做；有矛盾就停下回報）

### 擁有
`ownedItems(world)` ＝ 下面三者的聯集：
1. 集章配件（`source.kind === 'stamps'`）：累計章數（`countTotalStamps`）≥ `source.stamps`。
2. `wardrobe.owned` 裡的 ID。
3. 有效的已解鎖成就（`unlockedAchievements(world)`，見下方系統一節的修訂）的 `item`，以及 `source.kind === 'achievement'` 且該成就已解鎖的配件。

### 小魚乾
- 賺到 ＝
  - `WARDROBE_START_DAY`（含）以後每一天：`dayLog[day] × FISH_PER_QUESTION`，加上該天達到的每個 `DAILY_TIERS`（`dayLog[day] >= at`）的 `fish`；
  - `WELCOME_FISH`；
  - 有效的已解鎖成就（`unlockedAchievements(world)`）裡每個**認得的**成就的 `fish`；
  - `wardrobe.quests` 每一天每個**認得的**任務的 `fish`。
- 花掉 ＝ `wardrobe.owned` 裡每個認得、`source.kind === 'shop'` 的配件 `price`。
- 餘額 ＝ 賺到 − 花掉（可能是負的：兩台離線各花一次）。畫面顯示 `Math.max(0, 餘額)`；能不能買看原始餘額 ≥ 價格。
- 不認得的 ID（新版才有的）**保留在存檔裡**，計算時略過。

### 衝刺限定
`sprintOpen(world, now)`：`world.banks` 裡任一題庫，今天（當地日期）在 `examDate − SPRINT_DAYS` 到 `examDate` 之間（兩端都含）。`sprint: true` 的配件只有這段期間能買；已經買的永久擁有。

### 成就
- `wardrobeMetrics(world)` 回傳每個 `AchievementMetric` 的值：
  - `answeredTotal`：`dayLog` 全部加總（不受 `WARDROBE_START_DAY` 限制）；
  - `mastered`：`progress` 裡 `seen > 0 && due === null` 的題數；
  - `stamps`：`countTotalStamps`；
  - `stampStreak`：`dayLog` 達 `DAILY_GOAL_QUESTIONS` 的日子裡，最長的連續日期天數（看日曆日，不看今天）；
  - `cardsSeen`：`settings.cardsSeen` 的張數；
  - `examCount`：`settings.examHistory` 筆數；
  - `examBest`：`settings.examHistory` 最高 `score`（沒有就 0）。
- 值 ≥ `at` 的成就加進 `wardrobe.achievements`。**解鎖後不收回**，就算之後值變小。

### 每日小任務
- `todayQuest(world, now)`：今天（當地日期 `DayKey`）從 `QUESTS` 裡挑一個。先排除今天做不到的：`new-card`（`world.cards` 有載入且 `cardsSeen` 已經包含全部卡片）、`wrong-round`（沒有「上次答錯」的題目：`seen > 0 && streak === 0`）。再用日期字串算一個確定性的雜湊（例如 FNV-1a），對剩下的數量取餘數。同一天、同樣資料，兩台挑到同一個。
- 完成條件（**只有今天挑到的那個任務算**，事件發生在今天）：
  - `quiz-round`：`roundFinished`，`config.study === 'quiz'`，`results.length >= QUEST_ROUND_MIN`，不是模擬考；
  - `wrong-round`：`roundFinished`，`config.mode === 'wrong'`，`results.length > 0`；
  - `topic-round`：`roundFinished`，`config.topicIds` 有內容，`results.length > 0`；
  - `new-card`：`settings.cardsSeen` 的張數比上一次看到的多；
  - `exam`：`examFinished`。
- 完成就把任務 ID 加進 `wardrobe.quests[今天]`（已經有就不重複）。

### 系統 `src/systems/wardrobe.ts`（新增）

> **修訂（主代理，回應你回報的矛盾）**：讀檔與同步**不准寫存檔**（守門測試 `writes a current save back byte-for-byte equivalent` 要求讀進來再寫回完全一樣）。所以把「已解鎖」分成兩層：
> - **有效的已解鎖成就** ＝ `wardrobe.achievements` ∪ 目前條件已達成的成就。所有選擇器、小魚乾、擁有、買東西都用這個（寫成一個函式 `unlockedAchievements(world)`，其他地方呼叫它）。所以她一打開 App 就看得到補算的成就與小魚乾，不必先寫檔。
> - **寫進存檔**只在使用者真的做了事的時候：`dayLogChanged`、`roundFinished`、`examFinished`、`cardSeen`（新事件，見下）、`buyItem`、`wear`。每次寫入時把「有效的已解鎖成就」整份寫進 `wardrobe.achievements`。
> - **不准**因為 `settingsChanged`、`progressChanged`、`bankLoaded`、`cardsLoaded` 而寫存檔或發 `settingsChanged`。

- `attachWardrobe(world, options?: { now?: () => Date })`：照 `attachDaily` 的寫法（同一個 World 重複呼叫先解除舊監聽）。在 `createWorld` 裡掛上（`src/core/world.ts` 只准加這一行呼叫與 import）。
- 監聽 `dayLogChanged`、`roundFinished`、`examFinished`、`cardSeen`：依上面的規則記任務、把有效的已解鎖成就寫進 `wardrobe.achievements`；**跟存檔裡比有變化才**寫回 `world.settings.wardrobe` 並發 `settingsChanged`。
- 慶祝：維護一份「已經慶祝過」的記憶體清單（不存檔），一開始＝存檔裡的 `wardrobe.achievements`。在 `bankLoaded`、`cardsLoaded`、`settingsChanged`、`dayLogChanged`、`roundFinished`、`examFinished`、`cardSeen` 之後，把「有效的已解鎖成就裡還沒慶祝過的」與「剛完成的任務」推進 `world.celebrations`、發 `rewardsEarned`，並加進已慶祝清單。這一步只動記憶體，不寫存檔。她上線當天依舊紀錄補發的成就就靠這個出現慶祝。
- `new-card` 任務改看 `cardSeen` 事件（不看 `cardsSeen` 張數變化）：在 `src/systems/settings.ts` 的 `markCardSeen` 真的新增一張時，緊接著原本的 `settingsChanged` 之後發 `{ type: 'cardSeen', id, at }`（`markCardSeen` 加一個 `now: () => Date` 參數，`commands.ts` 傳進去）。型別已由主代理加好。
- 同步合併後的 `wardrobe` 由本系統提供 `applySyncedWardrobe(world, merged)` 寫入（照 `settings.ts` 的 `applySyncedSettings` 寫法：欄位擁有者是本系統，同步只算合併結果再交給它），保留本機 `outfit`。
- `buyItem(world, id, now)`：認得、`source.kind === 'shop'`、還沒擁有、在架上（`sprint` 要 `sprintOpen`）、原始餘額 ≥ 價格，才加進 `owned` 並發 `settingsChanged`。其他情況不動作。
- `wear(world, slot, item)`：`item === null` 就把那個部位清掉；否則要擁有、而且 `ITEMS` 裡它的 `slot` 等於參數 `slot` 才穿上。`wardrobe.outfit` 還不存在時，先用 `currentOutfit(world)` 當起點再改。**不准改 `settings.accessory`**。
- `dismissCelebrations(world)`：清空 `world.celebrations`。
- `src/core/commands.ts`：加 `buyItem`、`wear`、`dismissCelebrations` 三個 case（只准加這三個 case 與 import）。

### 選擇器 `src/selectors/wardrobe.ts`（新增；畫面只用這些讀）
- `ownedItems(world): Set<ItemId>`
- `fishBalance(world, now)` → `{ balance（顯示用，≥ 0）, raw（原始餘額）, earned, spent, parts: { questions, tiers, welcome, achievements, quests } }`
- `currentOutfit(world): Outfit`：有 `wardrobe.outfit` 就用它，只留擁有、部位相符的；沒有就從 `settings.accessory`（已解鎖才算）轉成 `{ [它的部位]: id }`；都沒有就 `{}`。
- `itemStatuses(world, now)` → `ITEMS` 每件一筆 `{ item, state, price?, need? }`，`state` 是 `'owned' | 'buyable' | 'short'（錢不夠） | 'stamps'（集章還沒到，need＝還差幾章） | 'achievement'（成就還沒解，附成就 ID） | 'off'（衝刺限定且不在架上、也沒擁有）`。順序照 `ITEMS`。
- `todayQuest(world, now)` → `{ quest: Quest, done: boolean } | null`（任務池全被排除時 `null`）
- `dailyTierStatus(world, now)` → `{ count, tiers: Array<{ at, fish, reached }> }`
- `achievementStatuses(world)` → `ACHIEVEMENTS` 每個一筆 `{ achievement, value, unlocked }`
- `wardrobeMetrics(world)`、`sprintOpen(world, now)` 也從這裡匯出（或從 system 匯出再轉出）。

### 存檔 `src/systems/persistence.ts`
- `settings.wardrobe` 是選填欄位，照既有 `cardsSeen`、`examHistory` 的寫法加進白名單與正規化。
- **`settings.wardrobe` 壞掉時只丟 wardrobe 這一欄（或裡面壞掉的那一小項），絕對不能讓 `isValidSettings` 回 false**：`owned`／`achievements` 不是字串陣列就當空陣列；`quests` 只留合法 `DayKey` → 字串陣列的項目；`outfit` 只留 `SLOTS` 裡有的部位、值是字串的項目；整個 wardrobe 不是物件就當沒有這欄。
- 不認得的配件、成就、任務 ID 照樣保留。
- `settings.accessory` 的檢查不准放寬也不准改。

### 同步 `src/systems/sync.ts`、`src/systems/syncMerge.ts`
- 同步檔加選填欄位 `wardrobe: { owned, achievements, quests }`（**不含 `outfit`**）。讀遠端時壞掉或沒有這欄就當空的，不影響其他欄位。
- `syncMerge.ts` 新增 `mergeWardrobe(local, remote)`：`owned`、`achievements` 取聯集並排序；`quests` 每一天取聯集並排序。結果與參數順序無關。
- 合併後寫回 `world.settings.wardrobe`，保留本機的 `outfit`。

## 可修改檔案

`src/systems/wardrobe.ts`（新增）、`src/selectors/wardrobe.ts`（新增）、`src/systems/settings.ts`（只限 `markCardSeen` 發 `cardSeen`）、`src/systems/persistence.ts`、`src/systems/sync.ts`、`src/systems/syncMerge.ts`、`src/core/commands.ts`（只限三個 case）、`src/core/world.ts`（只限掛 `attachWardrobe`）、`src/testing/fixture.ts`（只准新增輔助函式）、新增的 `src/testing/golden/save-v2-wardrobe.json`、新增的 `src/systems/persistenceWardrobe.test.ts`，以及上述檔案的 `*.test.ts`。

其他一律不准改，特別是：`src/core/types.ts`、`src/core/constants/**`、`src/ui/**`、`src/theme.css`、`src/systems/persistenceGolden.test.ts`、`src/testing/golden/save-v1.json` 等既有樣本、`tools/**`、`data/**`、`docs/**`、`package.json`。

## 必讀檔案

`AGENTS.md` §2、`docs/plans/cat-wardrobe.md`、`src/core/types.ts`、`src/core/world.ts`、`src/core/constants/wardrobe.ts`、`src/core/constants/daily.ts`、`src/systems/daily.ts`、`src/selectors/daily.ts`、`src/systems/settings.ts`、`src/systems/persistence.ts`、`src/systems/persistenceGolden.test.ts`、`src/systems/sync.ts`、`src/systems/syncMerge.ts`、`src/systems/round.ts`（`roundFinished` 在哪裡發）、`src/core/commands.ts`、`src/core/store.ts`、`src/testing/fixture.ts`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。

### 一定要有的測試
- 小魚乾：`WARDROBE_START_DAY` 前的題數不算、之後的算；三個關卡各算一次；見面禮；成就與任務獎勵；買東西扣價格；不認得的 ID 略過；兩邊各花一次的負餘額 → `balance` 是 0、`raw` 是負的、買不了。
- 擁有：集章到門檻自動擁有舊配件；成就送的配件。
- 成就：依既有紀錄補算（建一個有 300 題 dayLog 的 World，載入後 `unlockedAchievements` 含 `answered-100`、`answered-300`、`world.celebrations` 有兩筆，**而且存檔沒有被寫**）；下一次 `dayLogChanged` 後才寫進 `wardrobe.achievements`；已寫進存檔的成就值變小不收回；同一個成就只慶祝一次；`stampStreak` 的連續天數計算（中間斷一天）。
- 守門：既有 `persistenceGolden.test.ts` 全部照樣通過（它會載入 `save-v1.json`，裡面有一筆 62 分模擬考，`exam-1`、`exam-60` 會被補算，但不准寫回）。
- 任務：同一天兩個 World（資料相同）挑到同一個；`new-card`、`wrong-round` 被排除的情形；只有今天挑到的那個任務算；完成後再觸發不重複記；不是今天的事件不算。
- 買與穿：錢不夠、已擁有、衝刺限定不在架上、部位不符、沒擁有，都不動作；`wear` 不改 `settings.accessory`；舊存檔只有 `accessory: 'crown'`（章數夠）時 `currentOutfit` 是 `{ 'head-top': 'crown' }`。
- 存檔：新樣本 `save-v2-wardrobe.json` 往返不變；wardrobe 壞掉時其他設定與進度都還在；`settings.accessory` 是不認得的 ID 時照舊整份失敗（既有行為不變）。
- 同步：`mergeWardrobe` 交換律與冪等；遠端沒有 `wardrobe`（舊版同步檔）合併後本機的不丟；合併後本機 `outfit` 保留；同步檔裡沒有 `outfit`。
- 不會無限迴圈：觸發一次 `settingsChanged` 且沒有新東西時，系統不再發 `settingsChanged`。

既有測試不准刪、不准弱化。

## 韁繩

- 不准用 `as any`、`@ts-ignore`、`alert`、`confirm`、`prompt`、`window.open`。
- System 不碰 DOM；時間由參數注入（`now`），不准在 System 或選擇器裡直接 `new Date()` 當現在時間（預設值除外，照 `attachDaily` 的寫法）。
- 數字只從 `src/core/constants/wardrobe.ts`、`daily.ts` 讀。同一個判斷（例如「擁有」「在架上」）只寫一個函式，其他地方呼叫它。
- 被驗證的對象不准 mock；不准空的 `catch`；斷言不准用 `?? 預設值` 讓缺欄位通過。
- 不准改型別與常數、不准安裝套件。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小，以及每個新函式的 `檔案:行號`。
