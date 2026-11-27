# CC4c-props：四格漫畫行政學批的 10 個新道具 SVG

執行者：agy `gemini-4-neon-high`；工作資料夾 `C:\Git\_wt_civic_comic_props_c`（分支 `cc4c-props`）。無人值守：不要寫計畫、不要等確認，現在就動手。**只准改工作資料夾內的檔案。**

## 目標
App 的圖卡有「四格漫畫」：小貓當演員，旁邊擺一兩樣道具，讓考生看圖就想起考點（`docs/plans/comic-cards.md` §2.2）。已經有 27 個道具（`src/ui/kit/comic/props.tsx` 的 `PROP_ART`），這一包再畫 **10 個新道具**。它們現在是暫時的灰色圓角方塊（`draft()`），把它們全部換成真正的圖，畫完把 `draft` 函式刪掉。

## 畫風（照現有的 27 個道具）
- 先讀 `props.tsx` 裡已經畫好的 `stamp`、`hourglass`、`door`、`coins`、`ballot-box`、`crown`、`scale`、`umbrella`、`magnifier`、`house`，**照它們的風格**：圓潤、胖胖的貼紙感、粗外框、少細節、一眼認得出來。新道具放在它們旁邊要像同一套。
- 外框用檔案裡已有的 `stroke`（粗 2.2）；細節線用 `thin`、`fine`。
- 填色**只用** `src/theme.css` 的 token：`var(--acc-coral)`、`--acc-orange`、`--acc-navy`、`--acc-sky`、`--acc-lav`、`--acc-gold`、`--acc-cream`、`--acc-wood`、`--acc-silver`、`--acc-leaf`、`--acc-shade`、`--acc-night`、`--acc-rose`、`--acc-mint`，以及 `--surface`、`--pink-deep`。不要寫死色碼。
- **圖裡不要有任何文字、數字、注音或英文字母**（`<text>` 一律不用）。
- 座標：`viewBox="0 0 64 64"`。底邊貼在 y ≈ 58–60（放在地上）。左右留 2–4 的邊。
- 每個道具 8–30 行 SVG（`<g>` 包起來）。在 40px 大小時要認得出來：形狀要大、對比要夠。重複的座標（像梯子的橫木、組織圖的方塊）可以照 `OFFICE_WINDOWS`、`COIN_LAYERS`、`FENCE_PICKETS` 的做法寫成具名的常數陣列再 `map`。

## 10 個道具要畫成什麼
| id | 名稱 | 要畫的樣子 | 用在哪（給你判斷重點） |
| :-- | :-- | :-- | :-- |
| `stopwatch` | 碼錶 | 一個圓圓的大碼錶：`--acc-silver` 或 `--acc-gold` 的外殼、`--acc-cream` 的錶面，頂上一顆按鈕和一個小環；錶面上一根指針（指向右上），可以有 4 個刻度短線 | 「泰勒：動作與時間研究」「傳統時期：效率」「績效預算：效率」 |
| `org-chart` | 組織圖 | 一張樹狀組織圖：最上面 1 個方塊，下面 3 個方塊，用直線和橫線連起來（像倒過來的「品」字樹）；方塊用 `--acc-sky`、`--acc-cream` 等色，最上面那個顏色不同（例如 `--acc-coral`）；可以畫在一塊立著的看板上（有兩根短腳） | 「層級節制」「費堯：管理功能」「控制幅度」 |
| `ship-wheel` | 舵輪 | 一個船的舵輪：`--acc-wood` 的圓環、中心一個圓軸、8 根放射狀把手凸出圓環外（把手末端圓頭）；可以有一根短柱把它立在地上 | 「新公共管理：政府領航而不操槳」 |
| `flag` | 旗子 | 一根直立的旗桿（`--acc-silver` 或 `--acc-wood`，頂上一顆小圓球），上面一面飄動的三角旗或長方旗（`--acc-coral`，邊緣波浪），旗面上可以有一顆星形或圓形色塊（不寫字）；旗桿插在一個小土堆或底座上 | 「轉換型領導：用願景帶著部屬往前走」 |
| `crane` | 起重機 | 一座工地塔式起重機：直立的格子塔身（`--acc-gold`）、頂上一根橫的吊臂、吊臂一端垂下一條線掛著一塊磚或一個箱子（`--acc-coral`）；底下可以有兩三塊疊起來的磚。要一眼看得出「蓋房子、工地」 | 「BOT：民間出錢興建」「OT：政府蓋好」 |
| `key` | 鑰匙 | 一把大大的、斜放的老式鑰匙（`--acc-gold`）：圓形或花形的握柄（中間一個洞）、長桿、末端兩三個齒；可以掛一個小圓標籤 | 「期滿營運權歸還政府」：把經營的鑰匙交還 |
| `curtain` | 舞台布幕 | 一座小舞台：上方一條垂下的帷幔（`--acc-coral` 或 `--acc-rose`，波浪下緣），左右兩片拉開、用繩子束起的布幕，中間露出舞台後方（`--acc-night` 或 `--acc-navy`），下方一條木頭舞台地板（`--acc-wood`） | 「行政法人：例如兩廳院（劇院）」 |
| `ladder` | 梯子 | 一把直立、稍微斜靠的木梯（`--acc-wood`）：兩根側桿、5–6 根橫木（寫成具名常數陣列），最上面一根橫木旁邊可以有一顆小星星（`--acc-gold`）表示「最高」 | 「需求層級由低到高」「公民參與階梯：越往上權力越大」 |
| `heart` | 愛心 | 一顆胖胖的愛心（`--acc-rose` 或 `--acc-coral`），左上一道白色反光（`--acc-cream`），可以有一兩個小閃光 | 「專業倫理、個人的良知」「慈善」 |
| `megaphone` | 大聲公 | 一支斜放的手持擴音器：喇叭口朝右上（`--acc-coral` 或 `--acc-orange`），握把（`--acc-navy`），喇叭口前面三道弧線表示聲音 | 「公民參與、傳播媒體」：大聲監督 |

## 可以改的檔（只有這一個）
`src/ui/kit/comic/props.tsx`：把上面 10 筆的 `draft()` 換成真正的圖，刪掉 `draft` 函式。已經畫好的 27 個道具、`ComicProp` 元件、`PROP_ART` 的型別都不要改。其他檔一律不改；覺得非改不可就停下回報。

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
