# CC1-art：四格漫畫的 12 個道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_art`（分支 `cc1-art`）。無人值守：不要寫計畫、不要等確認，現在就動手。

## 目標
App 的圖卡要加「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。小貓已經畫好了；這一包只畫 **12 個道具**。現在 `src/ui/kit/comic/props.tsx` 裡每個道具都是暫時的圓角方塊（`draft(...)`），把它們全部換成真正的圖。

## 畫風（照現有的小貓配件）
- 先讀 `src/ui/kit/wardrobe/art.tsx` 裡 `bell`、`bowtie`、`necktie`、`grad-cap` 這幾件配件的畫法，照它的風格：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。
- 外框：`stroke="var(--cat-line)"`、粗 2.2（`props.tsx` 已有 `stroke` 常數），圓角接頭。細節線可以用 1.1–1.8。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼（日夜兩套顏色靠 token 自動切換）。
- **圖裡不要有任何文字、數字、注音或英文字母**（`<text>` 一律不用）。要表達「罰單」「日曆」用形狀（例：驚嘆號用一條短粗線＋一個圓點畫）。
- 座標：`viewBox="0 0 64 64"`。會站在地上的道具（建築、路燈、坑洞、門、沙漏、靶）底邊貼在 **y = 60**；小東西（印章、公文、罰單、信封、日曆）畫在中間偏下，底邊也落在 y ≈ 58–60。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來，所以形狀要大、對比要夠。

## 12 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 |
| :-- | :-- | :-- |
| `stamp` | 印章 | 木頭握柄＋底下紅色的印面（官印那種），旁邊可以有一個蓋好的紅色方印痕 |
| `document` | 公文 | 一張直式紙、右上角折角、幾條橫線代表字、右下角一個紅色小方印 |
| `ticket` | 罰單 | 一張長條單子、上緣是撕下來的鋸齒、正中一個粗的驚嘆號（線＋點）、粉紅或珊瑚色 |
| `envelope` | 信封 | 橫式信封、封口三角、中間一個紅色封蠟圓點 |
| `hourglass` | 沙漏 | 上下木框、中間兩個玻璃泡、上面剩一點沙、下面堆比較多 |
| `calendar` | 日曆 | 撕頁式日曆：上方兩個圈、紅色頂條、格子裡其中一格被紅圈圈起來（不寫數字） |
| `courthouse` | 法院 | 三角屋頂＋三四根柱子＋台階的古典建築，屋頂三角形裡一個天秤 |
| `office` | 辦公大樓 | 方正的大樓、一排排窗戶、門在中間、屋頂一支小旗子 |
| `pothole` | 路面坑洞 | 一段灰色路面（橫向的扁長方塊，貼地），中間一個深色的洞＋幾道裂縫，旁邊一個橘色三角錐 |
| `lamp` | 壞掉的路燈 | 一支路燈，燈頭歪一邊、燈罩破一角，旁邊冒兩三道小閃電（壞掉在閃） |
| `target` | 靶心 | 三圈的靶（紅白相間）、一支箭插在正中間 |
| `door` | 大門 | 有拱頂的雙開木門、兩個門把 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把 `PROP_ART` 每一筆從 `draft(...)` 換成真正的圖；畫完把 `draft` 函式刪掉。`ComicProp` 元件、`PROP_ART` 的型別與名稱不要改。其他檔一律不改；覺得非改不可就停下回報。

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
