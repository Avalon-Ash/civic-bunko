# CC4a-props：四格漫畫 A 批的 7 個新道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_props`（分支 `cc4a-props`）。無人值守：不要寫計畫、不要等確認，現在就動手。**只准改工作資料夾內的檔案。**

## 目標
App 的圖卡有「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。已經有 12 個道具（`src/ui/kit/comic/props.tsx` 的 `PROP_ART`），這一包再畫 **7 個新道具**。它們現在是暫時的灰色圓角方塊（`draft()`），把它們全部換成真正的圖，畫完把 `draft` 函式刪掉。

## 畫風（照現有的 12 個道具）
- 先讀 `props.tsx` 裡已經畫好的 `stamp`、`document`、`ticket`、`hourglass`、`courthouse`、`door`，**照它們的風格**：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。新道具放在它們旁邊要像同一套。
- 外框用檔案裡已有的 `stroke`（粗 2.2）；細節線用 `thin`、`fine`。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼。
- **圖裡不要有任何文字、數字、注音或英文字母**（`<text>` 一律不用）。
- 座標：`viewBox="0 0 64 64"`。底邊貼在 y ≈ 58–60（放在地上）。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來：形狀要大、對比要夠。

## 7 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 | 用在哪（給你判斷重點） |
| :-- | :-- | :-- | :-- |
| `torn-paper` | 撕破的紙 | 一張直式公文從中間被撕成左右兩半、中間是鋸齒狀的裂口、兩半稍微分開歪一點；紙上幾條橫線，一個紅色小方印被撕成兩半 | 「無效」：處分有重大明顯的瑕疵，等於廢紙 |
| `eraser` | 橡皮擦 | 一塊斜放的長方形橡皮擦（一半有紙套：套子用 `--acc-sky` 或 `--acc-navy`，露出來的橡皮用 `--acc-rose`），底下一張紙上有一道被擦掉的痕跡＋幾粒橡皮屑 | 「撤銷」：把違法的處分擦掉 |
| `coins` | 一疊硬幣 | 兩三疊高低不同的金色硬幣（`--acc-gold`），硬幣側面有幾條直紋；最上面一枚正面朝前、中間一個簡單的圓或方孔（不寫字） | 「補償」：廢止合法處分要補償 |
| `scissors` | 剪刀 | 一把張開的剪刀，兩個圓圈握把（`--acc-coral`）、銀色刀刃（`--acc-silver`），刀刃正在剪一條紙帶（紙帶剪斷一小段往下掉） | 「預算只能砍不能加」 |
| `handcuffs` | 手銬 | 一副銀色手銬（`--acc-silver`），兩個圓環＋中間短鏈條，平放或微斜 | 「會期內不得逮捕」 |
| `ballot-box` | 投票箱 | 方正的箱子（`--surface` 或 `--acc-cream` 為主、`--acc-navy` 鑲邊），頂上一條投入口，一張對折的選票正插進去一半 | 「記名投票」「罷免」 |
| `crown` | 皇冠 | 一頂金色皇冠（`--acc-gold`），三到五個尖、尖端有小圓珠，底座一條帶子上嵌兩三顆寶石（`--acc-coral`、`--acc-sky`）；擺在一個矮矮的紅色軟墊（`--acc-coral` 或 `--acc-rose`）上 | 「憲法最大」 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把上面 7 筆的 `draft()` 換成真正的圖，刪掉 `draft` 函式。已經畫好的 12 個道具、`ComicProp` 元件、`PROP_ART` 的型別都不要改。其他檔一律不改；覺得非改不可就停下回報。

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
