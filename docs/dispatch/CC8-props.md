# CC8-props：申論卡漫畫的 4 個新道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_props_e`（分支 `cc8-props`）。無人值守：不要寫計畫、不要等確認，現在就動手。**只准改工作資料夾內的檔案。**

## 目標
App 的圖卡有「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。已經有 27 個道具（`src/ui/kit/comic/props.tsx` 的 `PROP_ART`），這一包再畫 **4 個新道具**。它們現在是暫時的灰色圓角方塊（`draft()`），把它們全部換成真正的圖，畫完把 `draft` 函式刪掉。

## 畫風（照現有的道具）
- 先讀 `props.tsx` 裡已經畫好的 `stamp`、`hourglass`、`courthouse`、`coins`、`ballot-box`、`house`、`bench`、`money-bag`，**照它們的風格**：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。新道具放在它們旁邊要像同一套。
- 外框用檔案裡已有的 `stroke`（粗 2.2）；細節線用 `thin`、`fine`。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼。
- **圖裡不要有任何文字、數字、注音或英文字母**（`<text>` 一律不用）。
- 座標：`viewBox="0 0 64 64"`。底邊貼在 y ≈ 58–60（放在地上）。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來：形狀要大、對比要夠，**深色模式也要看得清**（深色時外框 `--cat-line` 會變淺色）。重複的座標可以照 `OFFICE_WINDOWS`、`COIN_LAYERS` 的做法寫成具名的常數陣列再 `map`。

## 4 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 | 用在哪（給你判斷重點） |
| :-- | :-- | :-- | :-- |
| `bridge` | 拱橋 | 一座胖胖的拱橋，從左邊地面跨到右邊地面（佔滿寬度）：橋身 `--acc-wood` 或 `--acc-cream`、上緣一排短短的欄杆柱、橋下一個半圓的拱洞，拱洞裡露出一條 `--acc-sky` 的水（兩三道波浪線） | 「村里長是上情下達、下情上達的橋樑」「跨域治理：跨轄區合作」：連接兩邊 |
| `phone` | 手機 | 一支直立的智慧型手機（機身 `--acc-navy`、圓角大、螢幕 `--acc-sky`），螢幕上 4 個圓角小方塊（App 圖示，用不同的 token 色）；右上角冒出一個 `--acc-coral` 的通知小圓點（只有圓，不寫數字），旁邊兩三道短弧線表示在震動或響 | 「觸發：廣告、提醒讓人開始接觸」「行動：點擊、滑動等簡單操作」 |
| `fish` | 魚 | 一條胖胖的魚，側面、往上彎成躍起的弧度：身體 `--acc-silver` 或 `--acc-sky`、背鰭和尾鰭 `--acc-coral` 或 `--acc-orange`、一個大眼睛（`--surface` 白底＋深色瞳孔）、幾片鱗片用 `fine` 的弧線；魚身旁邊兩三滴水（`--acc-sky`） | 「優點：豐富食物與產業，如臺灣鯛」「缺點：管理不當就變成入侵種」 |
| `whale` | 虎鯨 | 一隻浮在水面的虎鯨，側面：身體 `--acc-night`（黑）、眼睛後面那塊招牌的橢圓白斑和白肚子用 `--acc-cream`、高高的三角背鰭、尾鰭翹起來；身體下半截被一條 `--acc-sky` 的波浪水面蓋住。要一眼看出是虎鯨（黑白配色＋高背鰭），不是一般的魚 | 「同情心：虎鯨母子的處境令人不忍」「虎鯨：只禁演，沒有安置與強制手段」 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把上面 4 筆的 `draft()` 換成真正的圖，刪掉 `draft` 函式。已經畫好的道具、`ComicProp` 元件、`PROP_ART` 的型別都不要改。其他檔一律不改；覺得非改不可就停下回報。

## 自我檢查
- 跑看圖腳本產生 HTML：`npx tsx tools/gallery/comic-gallery.mts .gallery/comic-light.html light` 與 `npx tsx tools/gallery/comic-gallery.mts .gallery/comic-dark.html dark`，最後一行要寫「問題 0」。
- `npx tsc --noEmit`、`npm test`、`npm run lint` 全過。
- 主席會把看圖頁截圖交給另一個模型審圖；看不出是什麼的道具會退回重畫。

## 指令
只能跑這五個指令，每個單獨一次呼叫，字串照抄，不加 `cd`、不串接：
- `npx tsc --noEmit`
- `npm test`
- `npm run lint`
- `npx tsx tools/gallery/comic-gallery.mts .gallery/comic-light.html light`
- `npx tsx tools/gallery/comic-gallery.mts .gallery/comic-dark.html dark`

讀檔、列目錄、搜尋只用檔案工具，絕不用終端機。不要讀 `node_modules`。不 commit。

## 固定三條
- 只結束自己啟動的行程。
- 不為了過檢查改造形或改驗收（測試、看圖腳本、`constants/comic.ts` 不准改）。
- 不新增耦合（顏色只用 token，不寫死色碼）。

## 什麼時候停下來回報
規格互相矛盾、同一個檢查失敗兩次、需要改 `props.tsx` 以外的檔。

## 回報
每個道具一句話說你畫了什麼（形狀、用了哪些顏色 token）；五個指令的最後幾行輸出；遇到的阻礙照實寫（沒有就寫沒有）。
