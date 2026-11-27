# CC4d-props：四格漫畫 D 批的 3 個新道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_props_d`（分支 `cc4d-props`）。無人值守：不要寫計畫、不要等確認，現在就動手。**只准改工作資料夾內的檔案。**

## 目標
App 的圖卡有「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。已經有 27 個道具（`src/ui/kit/comic/props.tsx` 的 `PROP_ART`），這一包再畫 **3 個新道具**。它們現在是暫時的灰色圓角方塊（`draft()`），把它們全部換成真正的圖，畫完把 `draft` 函式刪掉。

## 畫風（照現有的 27 個道具）
- 先讀 `props.tsx` 裡已經畫好的 `house`、`money-bag`、`door`、`office`、`coins`、`umbrella`、`courthouse`，**照它們的風格**：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。新道具放在它們旁邊要像同一套。
- 外框用檔案裡已有的 `stroke`（粗 2.2）；細節線用 `thin`、`fine`。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼。
- **圖裡不要有任何文字、數字、注音、英文字母或百分比符號**（`<text>` 一律不用）。
- 座標：`viewBox="0 0 64 64"`。底邊貼在 y ≈ 58–60（放在地上）。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來：形狀要大、對比要夠。重複的座標可以照 `OFFICE_WINDOWS`、`COIN_LAYERS` 的做法寫成具名的常數陣列再 `map`。

## 3 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 | 用在哪（給你判斷重點） |
| :-- | :-- | :-- | :-- |
| `mountain` | 山 | 兩座圓潤的綠色山（`--acc-leaf`，一高一矮、前後疊在一起），高的那座山頂有一頂白色或 `--acc-cream` 的雪帽（波浪邊），山腳可以有一兩棵圓圓的小樹或一條小路。不要畫成金字塔或三角形旗子 | 「山地鄉」「山地原住民區」：這裡是山上的鄉 |
| `pie` | 切開的派 | 從斜上方看的一整個圓派（`--acc-gold` 的餅皮、`--acc-cream` 的派面或 `--acc-coral` 的內餡），**被切下一小塊**：小塊（約占整個的一成以下，很窄的一片）往外拉開一點點、和大塊之間有明顯縫隙。大塊幾乎是整個圓。可以放在一個淺盤子上（`--acc-silver`） | 「統籌分配稅款：96% 普通、4% 特別」：一大塊和一小塊 |
| `shop` | 拉下鐵門的小店 | 正面的一間小店：上面一個紅白（`--acc-coral`＋`--acc-cream`）條紋的遮雨棚（下緣是半圓波浪），下面是**拉到底的鐵捲門**（`--acc-silver`，好幾條橫向的凹槽），門上斜貼一條 `--acc-coral` 的封條或掛一個小牌子（只有色塊，不寫字）。牆是 `--acc-cream` 或 `--acc-wood` | 「停止營業、命令歇業」：店被關起來了 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把上面 3 筆的 `draft()` 換成真正的圖，刪掉 `draft` 函式。已經畫好的 27 個道具、`ComicProp` 元件、`PROP_ART` 的型別都不要改。其他檔一律不改；覺得非改不可就停下回報。

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
