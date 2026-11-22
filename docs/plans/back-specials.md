# 開案書：鴨子裝、背飾單件特效、小屋擺設

- 開案：2026-11-22，主代理 Opus 5.5。狀態：2026-11-22 主代理在同一個工作階段做完 B0–B3（使用者說直接在這裡做；一條相依的鏈，沒有外派）。
- **跟原規劃不同、沒做的**（2026-11-22）：
  - （2026-11-22 補上：小屋裡的蝸牛線與火箭煙圈，判斷在 `houseLogic.ts` 的 `houseMark`，數字沿用 `PET_SLIME`、`PET_ROCKET`。）
  - （2026-11-22 補上：翅膀、氣球從頭像出來也是慢慢飄下來，`PetLayer` 的 release 走 `landsSoftly`。）
  - 氣球的「落地往上彈」只在被放手、從卡片飄下來時。
  - 小屋擺設的圖是 `ItemArt.room = { node, box, wall, at }`（`at` 是 CSS 長度），不是 §3 原本寫的 `place`、比例座標。
  - （2026-11-22 補上：小貓會走去坐墊上睡、書堆上坐。坐面寫在 `ItemArt.room.seat`，`HouseScene` 從畫面量成 `HouseSeat`，走過去、跳上跳下的判斷在 `houseLogic.ts` 的 `decideNextAction`、`perchLift`；權重 `HOUSE_SCENE.weights.seat`，一個位子一次一隻。）
- 使用者原話：「再新增套裝：鴨子裝＝會有小鴨子一起走。小鴨子類似之前頭上有一個會跳的小鳥？差不多就好，會鴨鴨叫」「背景買了要能套用在小屋中」「單件的服飾，背部的都要有特殊效果：披風會超人飛了、天使翅膀可以緩降、氣球會用漂浮走路，諸如此類的你設計」。
- 期限：12-01 前上線（12-02 起只修錯）。

## 1. 鴨子娃娃裝（第九套）

照 `cat-wardrobe.md` §7.2 加新主題的步驟：`KIGURUMI.duck`、`hoodArt`／`onesieArt` 各一行、`ITEMS` 三筆。

| ID | 部位 | 名稱 | 價格 | 樣子 |
| :-- | :-- | :-- | :-- | :-- |
| `duck-hood` | 頭頂 | 小鴨頭套 | `PRICE.l` | 黃色蛋形（`HOOD_OUTLINE.egg`，鴨子沒有耳朵），額頭兩顆圓眼睛、一片橘色扁嘴喙、頭頂一撮翹毛 |
| `duck-suit` | 身上 | 小鴨裝 | `PRICE.xl` | 黃布、奶油色肚子、橘色腳（`feet`，跟企鵝一樣整條腿換色）、尾巴是黃的 |
| `bread` | 嘴邊 | 叼麵包 | `PRICE.m` | 一小塊吐司邊，動態 `nibble` |

套裝效果（`OUTFIT_SPECIALS`，新增 `OutfitSpecial`）：
- `ducklings`（頭套＋小鴨裝）：**兩隻小鴨排成一列跟著走**。小鴨的畫法照頭上小雞（`chick`）縮小、黃色、走路一跳一跳（`hop` 動作）。跟法：記住小貓走過的位置（環狀緩衝），第 n 隻跟在 `n × PET_DUCK.gap` px 之後；小貓停下來時小鴨在牠旁邊坐下；被拎起來時小鴨原地等、放手後跑回來；跳上卡片時小鴨留在地面排隊等（不跳）。偶爾「呱！」：泡泡＋合成音 `quack`（`sound.ts`，兩聲短的鼻音方波），每 `PET_DUCK.quackMs`；答題頁不叫、模擬考不出來。步態：`PET_GAITS` 加一列 `ducklings → waddle`（鴨子搖搖擺擺）。
- `feed`（全套＋叼麵包）：坐著的時候撒麵包屑（`Bit` 新 kind `crumb`），小鴨跑過去啄（低頭動畫）、呱呱叫，屑屑淡掉後回到排隊。
- 數字只在 `PET_DUCK`（`constants/pet.ts`）：`count: 2`、`gap`、`size`、`quackMs`、`crumbMs`。

## 2. 背飾單件特效（只穿這一件就有）

| 背飾 | 效果 ID | 做什麼 | 狀態 |
| :-- | :-- | :-- | :-- |
| 小披風 `cape` | `fly` | 像超人一樣飛過畫面 | 已有（`PET_FLY`） |
| 天使翅膀 `wings` | `glide` | **緩降**：從卡片跳下來、被拎起來放手、從頭像跳出來時，拍著翅膀慢慢飄下來（下落速度上限 `PET_GLIDE.maxVy`，左右輕輕晃），落地不踉蹌；偶爾自己飛上一張卡片（取代跳） | 新 |
| 氣球 `balloon` | `float` | **漂浮走路**：走路時腳不著地，離地 `PET_FLOAT.lift` 上下飄（慢慢的正弦波）、速度 ×`PET_FLOAT.speed`；放手時比翅膀更慢地飄下來，落地前還會往上彈一下 | 新 |
| 蝸牛殼 `snail-shell`（新，`PRICE.l`） | `slime` | 慢吞吞：走路速度 ×0.5，走過留下一條亮晶晶的線（`Bit` 新 kind `trail`，幾秒淡掉，跟蜂蜜腳印同一套）；被點一下縮進殼裡（`loaf`）幾秒再探出頭 | 新 |
| 小火箭 `rocket-pack`（新，`PRICE.xxl`） | `rocket` | 暴衝改成噴射：身後噴火焰、留一串煙圈（`Bit` 新 kind `puff`），速度 ×1.5；偶爾原地垂直升空再落下 | 新 |

- 判斷只在 `OUTFIT_SPECIALS`（`wear: { back: ['wings'] }` 這種單件列）；行為只在 `PetLayer` 的 `next()`／`fall` 分支與 `houseLogic`，數字在 `PET_GLIDE`、`PET_FLOAT`、`PET_SLIME`、`PET_ROCKET`。
- 小屋（`houseLogic.ts`）也要有：鴨子裝帶兩隻小鴨在房間裡跟著走、氣球走路飄起來（`actorLift`）、翅膀偶爾飛起來在房間裡繞一小段再慢慢降落（新 action `hover`）、蝸牛走得慢並留線、火箭暴衝噴火。
- 新背飾的圖：側面 `onBody.behind`、正面 `frontal.behind`、頭像 `node`，照 `cat-wardrobe.md` §7.2；`catBody.test.ts` 的檢查會自動涵蓋新配件。

## 3. 小屋擺設（背景買了套用到小屋）

- 規則：**買了就自動擺進小屋**（大方，照記憶「獎勵設計要大方」），小屋下面多一排「擺設」籤，點了收起來／擺回去。一件都沒買時那排顯示「在衣櫥買背景，就會擺進小屋」。
- 每件背景在房間裡有固定的位置，彼此不重疊（同時全擺也好看）：

| 背景 | 小屋裡 | 位置 |
| :-- | :-- | :-- |
| 坐墊 `cushion` | 一塊大的格紋坐墊（原本那塊小的留著） | 地板右前方 |
| 書堆 `book-stack` | 三本書疊在一起、上面一枝鉛筆 | 地板左邊、貓抓板旁 |
| 月亮 `moon` | 牆上一串月亮與星星吊飾（不管時段都在） | 牆的左上 |
| 彩虹 `rainbow` | 牆上跨過窗戶的彩虹壁貼、兩端一朵雲 | 牆的中間，畫在窗戶後面 |

- 畫法：`ItemArt` 加選填 `room?: { node, box, place: 'wall' | 'floor', at: {x, y, w} }`（房間比例座標），`HouseScene` 只讀這張表，不判斷配件 ID。小貓偶爾走到坐墊、書堆上坐（可選，做得到再做）。
- 存檔：`wardrobe.roomHidden?: ItemId[]`（收起來的那幾件；沒有這欄＝全擺）。只存本機、不同步（同 `outing`）。照 ADR 0010（只加選填欄位、新增固定樣本）與 ADR 0018「帶出門只存本機」的既有做法，沒有新的架構決策，所以不另寫 ADR。`parseWardrobe` 加這欄；新 golden 樣本 `save-v8-room.json`＋測試；舊樣本不碰（`AGENTS.md` §2）。

## 4. 小魚乾
- 新增 5 件（小鴨頭套 100、小鴨裝 120、叼麵包 80、蝸牛殼 100、小火箭 150）＝ 550，商店總價 6,400 → 6,950。照 11-18 的決定（她小魚乾太多，溢出靠出新東西消耗）不加獎勵、不調價。上線前重跑 `npx tsx tools/economy/fish-economy.mts`。

## 5. 不做
- 背飾特效不碰卡片（不燒、不劈）；答題頁的進度條小貓不飛、不飄（她要專心），只有亂跑與小屋有。
- 小鴨不能點、不能拎（不擋操作，點擊穿過去）。

## 6. 拆包

| 包 | 內容 | 執行者 | 依賴 |
| :-- | :-- | :-- | :-- |
| B0 | 型別、`OUTFIT_SPECIALS` 新列、常數、紅色驗收（套裝判斷、`gaitFor`、`roomHidden` 存檔 golden、`houseLogic` 的 hover／float／小鴨跟隨純函式）、派工單 | 主代理 | — |
| B1 | 美術：鴨子三件、小鴨、蝸牛殼、小火箭、四件背景的小屋版；看圖頁截圖 | 主代理（定調類，Fable 有額度時 Fable 做） | B0 |
| B2 | 亂跑引擎：`glide`、`float`、`slime`、`rocket`、`ducklings`、`feed`、`quack` 音效 | agy `gemini-4-neon-high` | B0（圖用 B1，可先用占位） |
| B3 | 小屋：擺設籤與存檔、`room` 圖接線、小屋裡的小鴨／漂浮／hover／蝸牛／火箭 | agy `gemini-4-neon-high` | B0；跟 B2 寫入範圍分開（B2 只動 `src/ui/pet/**`，B3 只動 `src/ui/house/**`、`systems/wardrobe` 的 parse） |
| — | 整合、手機尺寸截圖、更新紀錄、部署 | 主代理 | 各包 |

- Gemini Models 週剩 37%（11/22 20:27）：兩包夠；偏低時照 `agy-call` 換池（Claude 池 100%）。

## 7. 驗收
- `npm run lint`、`npm run validate`、`npm test`、`npm run build`（主代理自己重跑）。
- 舊 golden 全過；`save-v8-room.json` 讀得回來、沒有 `roomHidden` 的舊存檔＝全擺。
- 看圖頁：鴨子三件 × 每種姿勢 × 日夜；蝸牛殼、小火箭側面與正面。
- 開發機手機尺寸（390×844、320×568）：小鴨跟著走與排隊、翅膀緩降、氣球漂浮、蝸牛線、火箭煙圈、小屋四件擺設全擺與收起。動畫要替換計時器才跑（HANDOFF 已知限制），實機手感另記。

## 8. 什麼時候停下來問
- 鴨子或小鴨的造型被退一次：先要參考圖（記憶「美術先要參考圖」）。
- 小鴨跟著走在手機上卡頓：減成一隻。
