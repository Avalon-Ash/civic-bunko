# CC4b-props：四格漫畫 B 批的 8 個新道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_props_b`（分支 `cc4b-props`）。無人值守：不要寫計畫、不要等確認，現在就動手。**只准改工作資料夾內的檔案。**

## 目標
App 的圖卡有「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。已經有 19 個道具（`src/ui/kit/comic/props.tsx` 的 `PROP_ART`），這一包再畫 **8 個新道具**。它們現在是暫時的灰色圓角方塊（`draft()`），把它們全部換成真正的圖，畫完把 `draft` 函式刪掉。

## 畫風（照現有的 19 個道具）
- 先讀 `props.tsx` 裡已經畫好的 `stamp`、`document`、`hourglass`、`courthouse`、`door`、`coins`、`ballot-box`、`crown`，**照它們的風格**：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。新道具放在它們旁邊要像同一套。
- 外框用檔案裡已有的 `stroke`（粗 2.2）；細節線用 `thin`、`fine`。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼。
- **圖裡不要有任何文字、數字、注音或英文字母**（`<text>` 一律不用）。
- 座標：`viewBox="0 0 64 64"`。底邊貼在 y ≈ 58–60（放在地上）。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來：形狀要大、對比要夠。重複的座標（像柵欄的直條）可以照 `OFFICE_WINDOWS`、`COIN_LAYERS` 的做法寫成具名的常數陣列再 `map`。

## 8 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 | 用在哪（給你判斷重點） |
| :-- | :-- | :-- | :-- |
| `scale` | 天秤 | 一座金色或木頭色的天秤：中間一根直柱、底座，頂上一根橫桿，兩端各吊一個盤子。**兩邊盤子一樣高（平衡）**，左盤放一小塊東西（例如一顆 `--acc-coral` 的小圓）、右盤放另一樣（例如一個 `--acc-sky` 的小方塊） | 「比例原則：損害和利益不能顯失均衡」「哪個算法對人民有利」 |
| `fence` | 柵欄 | 一段矮矮的木柵欄（`--acc-wood` 或 `--acc-cream`）：4–5 根尖頭直條、兩根橫條；中間可以掛一個 `--acc-coral` 的禁止通行小牌子（只有色塊或一條斜線，不寫字） | 「裁量不得逾越範圍」「這幾種稅不列入」：擋住、劃界線 |
| `umbrella` | 雨傘 | 一把撐開的大傘（傘面 `--acc-lav` 或 `--acc-sky`，分 4–5 瓣、瓣緣是圓弧），傘柄彎鉤；傘上方落下兩三滴雨（`--acc-sky` 的水滴） | 「信賴保護：保護人民正當合理的信賴」 |
| `magnifier` | 放大鏡 | 一支斜放的大放大鏡：粗圓框（`--acc-gold` 或 `--acc-navy`）、鏡片 `--acc-sky` 加一道白色反光、木頭握柄 `--acc-wood` | 「監察院」：查看、監督 |
| `test-paper` | 考卷 | 一張直式的紙（`--acc-cream`），上面三四列「圓圈＋橫線」代表選項，其中兩三個圓圈被塗滿；旁邊斜靠一支鉛筆（筆身 `--acc-gold`、筆尖 `--acc-wood`） | 「考試院」 |
| `house` | 房子 | 一棟小房子：三角形屋頂（`--acc-coral`）、方形牆（`--acc-cream`）、一扇門（`--acc-wood`）、一扇窗（`--acc-sky`），可以有小煙囪 | 「設籍在這裡，就是這裡的居民」：住在這裡 |
| `bench` | 公園長椅 | 一張公園長椅（木條 `--acc-wood`、椅腳 `--acc-navy` 或 `--acc-silver`），旁邊一棵圓圓的小樹（樹冠 `--acc-leaf`、樹幹 `--acc-wood`） | 「使用地方公共設施」 |
| `money-bag` | 錢袋 | 一個鼓鼓的大布袋（`--acc-cream` 或 `--acc-gold`），袋口用繩子綁住、往上翻出一圈，袋口露出兩三枚金幣（`--acc-gold`）；袋身可以有一個圓形徽記（只有圓，不寫錢的符號） | 「營業稅：扣除後全部」：一整袋都給 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把上面 8 筆的 `draft()` 換成真正的圖，刪掉 `draft` 函式。已經畫好的 19 個道具、`ComicProp` 元件、`PROP_ART` 的型別都不要改。其他檔一律不改；覺得非改不可就停下回報。

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
