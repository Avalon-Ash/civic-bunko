# 派工單 P1e-2a：畫面（外殼、今日、刷題流程）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **包 ID／開案書章節**：P1e-2a／`docs/plans/civic-bunko.md` §2–§4
- **目標**：做出第一個能在 iPhone／iPad 上實際刷題的版本：打開 → 設定題數 → 一題接一題作答 → 看結果 → 錯題重刷。視覺與手感以 `prototype/mvp.html` 為準，把它搬成 React 元件。
- **模型與強度**：`gemini-4-hydrogen-high`
- **工作區**：`C:\Git\_wt_civic_ui`，分支 `p1e-ui`。只准改這個資料夾內的檔案。

## 成品

```
src/main.tsx                 啟動：createWorld → attachPersistence → 載入題庫 → render
src/ui/App.tsx               外殼：分頁列＋目前畫面；套用主題到 <html data-theme>
src/ui/useWorld.ts           useSyncExternalStore 接 src/core/store.ts
src/ui/kit/                  自製元件（每個一檔 .tsx，可搭配同名 .css）
  Card, Button, Chip, Segmented, Switch, Stepper, PawPicker, ProgressBar,
  Sheet（底部抽屜）, Toast, TabBar, Cat（角色）, CountUp（數字跳動）, Burst（粒子）
src/ui/screens/
  TodayScreen.tsx            倒數、題庫總數、今日小任務（先放三個 5 題的快速開始）
  DrillSetupScreen.tsx       回合設定：題數、科目、模式、快刷開關
  QuestionScreen.tsx         題卡、選項、回饋、進度
  ResultScreen.tsx           蓋章、分數、錯題重刷
  StampsScreen.tsx           各科進度（總題數、已刷、答對率）
  CardsScreen.tsx            先放「準備中」與角色，不做內容
src/ui/app.css               版面與元件樣式（顏色只能用 src/theme.css 的 token）
```

## 必讀檔案

- `AGENTS.md`（§2 架構與介面規則）
- `prototype/mvp.html`：**視覺與互動的標準答案**。版面、圓角、貼紙外框、下壓手感、文案語氣照它做。它裡面寫死的色碼要全部換成 `src/theme.css` 的 token。
- `src/theme.css`：顏色、圓角、字級的唯一定義（已含日夜兩套）。缺 token 就停下回報，不要在元件裡寫色碼。
- `src/core/types.ts`、`src/core/constants/round.ts`
- `src/core/commands.ts`、`src/core/store.ts`、`src/selectors/index.ts`、`src/systems/persistence.ts`、`src/data/source.ts`：畫面只能透過 `selectors` 讀、`dispatch` 寫。需要的資料 selector 沒提供時，在 `src/selectors/` 加新的唯讀函式（附測試），不要在元件裡自己算。

## 行為

### 外殼與主題
- 底部分頁：今日、圖卡、刷題、集章。回合進行中切走再切回來要還在同一題。
- 主題：`settings.theme` 為 `system` 時不設 `data-theme`；`light`／`dark` 時設在 `<html>`。今日畫面右上角放一個三段切換（系統／淺色／深色）。
- 不用路由套件；目前分頁用元件 state 即可。

### 題庫總數（一定要看得到）
- 今日畫面：一張卡顯示「題庫共 N 題・已刷 M 題」，數字用 `CountUp` 從 0 跳到實際值。
- 回合設定：選了科目與模式後，即時顯示「這個範圍有 N 題可刷」（`availableCount`）；題數超過可刷數時，開始鈕文字改成「開始刷 N 題（全部）」。
- 集章畫面：每科一列，顯示「已刷／總題數」與答對率。

### 回合設定
- 題數：大數字＋左右加減鈕（每次 `ROUND_COUNT_STEP`）＋貓掌快選（`ROUND_COUNT_PRESETS`），範圍 `ROUND_COUNT_MIN`–`ROUND_COUNT_MAX`。
- 科目：可複選的 chip，「全部」與個別科目互斥。科目清單來自 `world.banks`，不得寫死。
- 模式：混合／沒刷過／只刷錯題／到期複習。
- 快刷開關。預填 `settings.lastRound`。

### 題目與回饋
- 題組題在題幹上方顯示可收合的文章卡。
- 作答後：正解變綠；選錯的那個變灰並左右晃一下；其他選項變淡。有官方更正的題目顯示橘色「官方更正」標籤與 `correction.note`。
- 回饋卡：有 `enrich` 時顯示口訣＋陷阱；沒有時顯示「正解是 (X)」與「口訣準備中」。答對用綠卡，答錯用黃卡，不出現紅色大叉。
- 快刷開啟且答對：`FAST_ADVANCE_MS` 後自動 `next`；答錯停住等使用者按。離開畫面或已換題時不得再觸發（清掉計時器）。
- 左滑也能下一題（已作答時）。上方：進度條、`目前/總數`、連對數、結束鈕。

### 結果
- 蓋章動畫、`答對數/總題數`、錯題重刷鈕（沒有錯題時不顯示）、再來一回合、回今日。

## 可玩性（動態與互動；全部要尊重 `prefers-reduced-motion`）

- **角色會回應**：點貓會被壓扁再彈回來，頭上冒一句隨機的鼓勵話（至少 8 句，放在一個常數陣列）；待機時偶爾眨眼。角色用內嵌 SVG，顏色用 `--cat-*` token，表情：`idle`、`yay`、`oops`、`sleepy`。
- **答對有噴發**：從選到的選項噴出 8–12 個小貓掌與星星（`Burst`，純 CSS 動畫的絕對定位元素，動畫結束後移除）。
- **連對里程碑**：連對達 5、10、20、30 時，上方滑下一條橫幅「連對 N！」並讓貓轉一圈。
- **進度條上有貓**：一隻小貓頭跟著進度條前進，前進時彈跳一下。
- **數字會動**：題數加減時大數字上下滾動換字；分數與題庫總數用 `CountUp`。
- **按下去有手感**：所有卡片與按鈕按下時下沉 `--press-depth`、放開彈回（`--spring`）。
- **蓋章**：結果頁的章從大到小砸下來並輕微震動畫面；今日的週集章點了會晃。
- **抽屜**：底部抽屜彈簧滑入，可下拉關閉，點遮罩關閉。
- 動畫只動 `transform` 與 `opacity`；不引入動畫套件。

## 自適應

- 所有尺寸用相對單位；觸控區至少 `--tap-min`。
- 四邊都處理 `env(safe-area-inset-*)`：分頁列加底部 inset；橫向時左右 inset。
- 寬度 < 700px：單欄，內容最大寬 `--content-max` 置中。
- 寬度 ≥ 700px（iPad、橫向大手機）：分頁列改成左側直欄；題目畫面兩欄（左題幹與文章、右選項與回饋），最大寬 `--wide-max`。
- 320px 寬（iPhone SE）不得出現水平捲動；貓掌快選在窄螢幕可換行。
- 高度用 `100dvh`／`height: 100%`，不用 `100vh`。

## 可修改檔案

- 新增：`src/main.tsx`、`src/ui/**`；`src/selectors/**` 只能新增函式與其測試。
- 其他一律不准改，包含 `src/theme.css`、`src/core/**`、`src/systems/**`、`index.html`、`package.json`、`tools/**`、`data/**`、`docs/**`、`prototype/**`。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
npm run lint
npm test
npm run build
```

逾時：各 240 秒。及格：三個都退出碼 0。畫面由主代理另外用瀏覽器驗收。

## 韁繩

- 不准用 `alert`、`confirm`、`prompt`、`window.open`、`target="_blank"`、`as any`、`@ts-ignore`（lint 會擋）。
- 元件不直接讀寫 `world` 的欄位、不放業務邏輯；一律 `selectors` 讀、`dispatch` 寫。
- 不准安裝套件、不准改 lint 與 tsconfig。
- 規格矛盾，或同一個驗收指令連續失敗兩次且沒有新的修正方向，就停下回報現況。
- 不准 commit 或做任何 git 操作。

## 回報格式

照 `AGENTS.md` §6。另外列出：每個畫面用到哪些 selector 與 command、新增了哪些 selector、三個驗收指令的退出碼與最後幾行輸出、你知道但沒做完的項目。
