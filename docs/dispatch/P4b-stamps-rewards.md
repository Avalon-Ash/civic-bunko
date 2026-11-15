# 派工單 P4b：每日目標、蓋章規則、集章獎勵

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **使用者回饋**：「今天三個小任務只做完一個也蓋章，很奇怪，應該全部做完才有章。章集滿能做什麼？」
- **目標**：(1) 當天刷滿 `DAILY_GOAL_QUESTIONS` 題（＝三個任務）才蓋章，而且蓋過的章不會消失；(2) 章可以換貓的配件，讓集章有意義。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_p4b`，分支 `p4b`。只准改這個資料夾內的檔案。

## 已由主代理改好（在你的工作區，尚未提交）

- `src/core/types.ts`：`DayKey`、`AccessoryId`；`Settings.accessory?`；`UICommand` 多了 `setAccessory`；`AppEvent` 多了 `dayLogChanged`。
- `src/core/constants/daily.ts`：`DAILY_GOAL_QUESTIONS`、`MISSION_SIZE`、`STAMPS_PER_REWARD`、`ACCESSORIES`。
- `World` 要多一個 `dayLog: Map<DayKey, number>`（`src/core/world.ts` 可改）：每個當地日期「作答或看過」的題次數。

## 邏輯層

### `src/systems/daily.ts`（擁有 `world.dayLog`）
- 訂閱 `answered` 與 `viewed`：依事件的 `at` 換成當地日期（`YYYY-MM-DD`，日期換算寫成可注入時區偏移的純函式並測試），該日計數加一，發 `dayLogChanged`。
- 存檔：`persistence.ts` 把 `dayLog` 存進同一份存檔的 `days` 欄位並讀回；`exportProgress`／`importProgress` 也包含 `days`。
- **舊資料補登**：讀檔後若 `dayLog` 是空的但有作答進度，依每題 `lastAt` 的當地日期統計一次當作初始值（只做這一次）。
- 同步：遠端檔案多一個 `days: { [DayKey]: number }`，合併時每個日期取兩邊較大值（改 `syncMerge.ts` 與 `sync.ts`，舊的遠端檔沒有 `days` 要能讀）。補測試。

### Selector（`src/selectors/daily.ts`，新檔）
- `todayProgress(world, now)` → `{ count, goal, missionsDone, missionsTotal, stamped }`；`missionsDone = min(3, floor(count / MISSION_SIZE))`。
- `weekStamps(world, now)` → 週一到週日 `{ date, label, isToday, stamped, count }`；`stamped` 是該日計數 ≥ `DAILY_GOAL_QUESTIONS`。
- `stampTotals(world)` → `{ total, unlocked: AccessoryId[], next: { id, name, need } | null }`；第 N 個配件在累積 `N × STAMPS_PER_REWARD` 個章時解鎖。
- `currentAccessory(world)` → 目前戴的配件（必須已解鎖，否則 `null`）。
- 把 `src/selectors/index.ts` 裡舊的 `weekActivity` 移除，畫面改用 `weekStamps`；相關測試一併更新（在回報裡列出）。
- `settings.ts` 處理 `setAccessory`（只接受已解鎖的配件或 `null`）。

## 畫面

### 今日
- 任務區標題旁顯示「今天 7 / 15 題」，下面三個貓掌：每滿 `MISSION_SIZE` 題亮一個（亮起時彈一下）。三個都亮＝今天的章蓋好。
- 任務區下方一行小字：「三個任務都做完（15 題）才會蓋今天的章」；已蓋章後改成「今天的章蓋好了！」。
- 「這週的章」改用 `weekStamps`：已蓋章顯示紅色圓章；今天未達標顯示目前題數（例「7/15」）；其他未蓋章顯示星期。
- 當天第一次達標時（`count` 從 14 變 15 的那一刻）：畫面中央蓋章動畫＋橫幅「今天的章蓋好了！」；若同時解鎖配件，再接一條「解鎖新配件：蝴蝶結」。只觸發一次，重新載入不再播。

### 集章
- 最上方新增「我的章」卡：累積章數（`CountUp`）、目前戴著配件的貓、下一個獎勵「再 2 個章解鎖 草帽」。
- 配件列：六個圓形格子。已解鎖的可點選配戴（再點一次取下），目前配戴的有粗框；未解鎖的是灰色剪影加鎖頭與「再 N 個章」。
- 換上配件時貓會轉一圈。

### 貓的配件（`src/ui/kit/Cat.tsx`）
- `Cat` 多一個可選的 `accessory` 屬性，在既有的 64×64 座標系上疊畫：`bow` 蝴蝶結（右耳下）、`straw-hat` 草帽（頭頂）、`scarf` 圍巾（下巴下方）、`flower` 小花（左耳旁）、`glasses` 圓眼鏡、`crown` 皇冠（頭頂）。每個配件用簡單幾何形狀，顏色用既有 token（`--pink-deep`、`--butter`、`--mint`、`--blue`、`--cat-line`），線條粗細與貓一致。
- 今日、集章、結果頁、口訣卡上的貓都帶上目前的配件（用 `currentAccessory`）。載入畫面與圖示不用改。

## 可修改檔案

`src/systems/**`、`src/selectors/**`、`src/core/commands.ts`、`src/core/world.ts`、`src/main.tsx`、`src/ui/**`、`src/testing/**` 及測試。其他一律不准改，包含 `src/core/types.ts`、`src/core/constants/**`、`src/theme.css`、`vite.config.ts`、`index.html`、`public/**`、`package.json`、`tools/**`、`data/**`、`docs/**`。

## 必讀檔案

`AGENTS.md` §2、`src/core/types.ts`、`src/core/constants/daily.ts`、`src/systems/persistence.ts`、`src/systems/sync.ts`、`src/systems/syncMerge.ts`、`src/systems/scheduling.ts`、`src/selectors/index.ts`、`src/ui/kit/Cat.tsx`、`src/ui/screens/TodayScreen.tsx`、`src/ui/screens/StampsScreen.tsx`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

及格：三個都退出碼 0；主程式 JS 小於 370 kB。讀檔、找檔、搜尋一律用檔案工具，不要用終端機指令。
新邏輯都要有測試：日期換算（含跨午夜）、計數、舊資料補登只做一次、蓋章門檻、配件解鎖門檻、只能戴已解鎖的配件、存檔往返、同步合併取較大值與舊檔相容。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`、`dangerouslySetInnerHTML`。
- 顏色只用 token；元件只經 `selectors` 讀、`dispatch` 寫；System 不碰 DOM，時間由參數注入。
- 不准改 `types.ts` 與常數、不准安裝套件、不准弱化或刪除既有測試（因移除 `weekActivity` 必須調整的要逐一列出）。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6，另附 build 各檔大小與被調整的既有測試清單。
