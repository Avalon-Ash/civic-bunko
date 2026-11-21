# 派工單 H2-fur-marks：6 種新毛色（含花紋）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §5。
- **目標**：衣櫥的毛色從 4 種變成 10 種，新增的有素色也有花紋（虎斑、銀虎斑、賓士、三花、暹羅），讓好幾隻小貓長得不一樣。頭像（只有頭）與有身體的小貓（每種姿勢）都看得到花紋。
- **模型與強度**：`gemini-4-neon-high`（要動頭與身體兩個畫法，花紋要貼著輪廓、不能蓋到五官）。
- **工作區**：`C:\Git\_wt_civic_fur`，分支 `fur`，base 是 `git log -1` 的那一筆。只准改這個資料夾內的檔案。

## 新毛色（ID、名稱、價格照抄；ID 產生後不改）
加在 `src/core/constants/wardrobe.ts` 的 `ITEMS`，接在 `fur-gold` 後面，部位都是 `fur`：

| ID | 名稱 | 價格 | 樣子（照一般人對這種貓的印象畫，卡通化、圓潤，不追求寫實） |
| :-- | :-- | :-- | :-- |
| `fur-milktea` | 奶茶貓 | `PRICE.m` | 素色：淺奶茶色毛、深一點的奶茶色斑（耳朵、頭側、背上的斑沿用現在的 `--cat-patch` 位置） |
| `fur-tabby` | 虎斑貓 | `PRICE.xl` | 暖棕底、深棕條紋：額頭三條短紋（像 M 字）、兩頰各兩條細紋、背上三條弧形紋、尾巴一圈一圈 |
| `fur-silver` | 銀虎斑 | `PRICE.xl` | 花紋同虎斑，顏色換成銀灰底、深灰條紋 |
| `fur-tuxedo` | 賓士貓 | `PRICE.xl` | 黑毛（外框照黑貓用 `--cat-line-black`），白色口鼻與下巴、白胸口、四隻腳的腳尖白色 |
| `fur-calico` | 三花貓 | `PRICE.rare` | 白底，一邊耳朵與頭側是橘斑、另一邊是黑斑，背上一塊橘一塊黑，尾巴橘色 |
| `fur-siamese` | 暹羅貓 | `PRICE.rare` | 奶油色身體，深咖啡色的臉中央（鼻子周圍的橢圓，不蓋住眼睛的線條）、耳朵、腳、尾巴 |

## 要做的（3 件）

### 1. 花紋表與色票
- `src/ui/kit/wardrobe/art.tsx` 的毛色條目從 `{ kind: 'fur', className }` 擴充成可以帶選填的花紋（例如 `marks?: FurMarks`，型別放在 art.tsx 旁邊，它是畫面的東西，不進 `core/types.ts`）。**花紋的種類與每種畫哪些部位只定義在這張表**；`Cat.tsx`、`CatBody.tsx` 只讀表，不准用 `if (id === 'fur-tabby')` 之類的分支判斷。
- 顏色只在 `src/theme.css`：每種毛色一個 class（照現有 `.cb-fur-orange` 的寫法），花紋用的顏色開新的色票變數（例如 `--cat-mark`、`--cat-mark-2`、`--cat-white`），預設值放在 `:root` 的小貓色票旁邊；畫法裡不准寫色碼。深色模式比照現有毛色：不另外壓暗（黑底的那種照黑貓換外框）。
- 條紋、斑塊可以參考娃娃裝 `KigurumiTheme.pattern` 的條紋與斑塊畫法（同檔），但不要讓娃娃裝跟毛色互相依賴：要共用就抽成共用的小函式。

### 2. 畫上去
- 頭：`src/ui/kit/Cat.tsx` 的 `CatHead`。花紋畫在臉的底色之上、五官（眼睛、鼻子、嘴、腮紅）之下，用頭的橢圓裁切，不准超出頭的輪廓。頭像（64×64）和身體版共用同一個 `CatHead`，所以兩邊一起有。
- 身體：`src/ui/kit/CatBody.tsx`。身體的花紋畫在軀幹底色與現有的 `cb-pet-saddle` 之上，用軀幹輪廓裁切（像現有的 `cb-pet-wrap` 那樣），正面坐（`spec.frontal`）時左右對稱。腳尖白（賓士）、深色腳（暹羅）畫在腿上；尾巴的條紋與顏色走現有的尾巴畫法。
- 穿著衣服時：衣服本來就畫在花紋上面，蓋住的就蓋住，不用另外處理；但連身裝的成套尾巴照舊換色。
- 面向左是鏡像：花紋跟著翻。

### 3. 測試與看圖
- `src/ui/kit/catBody.test.ts`、`src/ui/kit/wardrobe/art.test.ts` 的既有斷言不准改、不准刪；**新增**斷言：
  - 每種有花紋的毛色，在頭像與每種姿勢的身體版都真的畫出了花紋元素（例如有某個 class）。
  - 花紋元素都在裁切範圍內（用了頭或軀幹的 clipPath）。
  - 花紋的 fill／stroke 只用 `var(--…)`，沒有色碼。
  - 沒穿新毛色的小貓畫出來的標記跟改之前一樣沒有花紋元素。
- `tools/gallery/cat-gallery.mts` 會自動列出所有 `ITEMS`，新毛色會自己出現；另外在頁面加一列「新毛色 × 每種姿勢」方便比對（不改既有的列）。

## 不做
- 不改存檔、同步、`src/systems/**`、`src/selectors/**`、畫面（`src/ui/screens/**`、`src/ui/pet/**`）。
- 不改既有 4 種毛色的樣子與價格。
- 不加更新紀錄（主代理整合時加）。

## 必讀
- `AGENTS.md`（§2 架構與介面）、`docs/plans/cat-house.md` §5、`docs/adr/0015-paper-doll-pose-table-rendering.md`。
- `src/ui/kit/Cat.tsx`、`src/ui/kit/CatBody.tsx`、`src/ui/kit/petShape.ts`、`src/ui/kit/wardrobe/art.tsx`（毛色條目、`KigurumiTheme`、條紋與斑塊的畫法）、`src/theme.css`（小貓色票與 `.cb-fur-*`）、`src/core/constants/wardrobe.ts`（`PRICE`、毛色那幾行）、`src/ui/kit/catBody.test.ts`、`src/ui/kit/wardrobe/art.test.ts`。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）
- `npx tsx tools/gallery/cat-gallery.mts .gallery/fur-light.html light`（60 秒）
- `npx tsx tools/gallery/cat-gallery.mts .gallery/fur-dark.html dark`（60 秒）
- `npx tsx tools/economy/fish-economy.mts`（60 秒）：只跑、把輸出貼進回報。

前三個要退出碼 0；看圖頁要產生得出來（主代理會開來看）。

## 韁繩
- 既有的驗收腳本與測試斷言不准改、不准刪；不准 mock 被驗證的對象、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只改工作資料夾內這幾個檔：`src/core/constants/wardrobe.ts`（只加 6 筆 `ITEMS`）、`src/ui/kit/wardrobe/art.tsx`、`src/ui/kit/Cat.tsx`、`src/ui/kit/CatBody.tsx`、`src/theme.css`、`src/ui/kit/catBody.test.ts`（只加）、`src/ui/kit/wardrobe/art.test.ts`（只加）、`tools/gallery/cat-gallery.mts`。需要動別的檔就停下回報。
- 不新增耦合：花紋種類與部位只在 art.tsx 的表裡，顏色只在 theme.css。
- 不 commit、不切分支；只結束自己啟動的行程。
- 每個完成項附 `檔案:行號`。

## 回報格式（`AGENTS.md` §6）
```text
包 ID：完成／部分完成／阻塞
請求模型與強度；實際設定：工具確認值或「未確認」
工作區／base SHA：
變更檔案與行為（檔案:行號）：
檢查：指令、退出碼、ERROR/WARN 數
小魚乾試算輸出：
未確認項：
剩餘工作：
```
