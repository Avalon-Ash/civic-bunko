# F1-cat-render：小八喵角色成像優化（交給 Fable 工作階段）

> **已完成（2026-11-18）**。下面是交辦當時的樣子，裡面提到的 `body`、`onBack`、`TORSO_REF` 已經不存在：衣服改成照身體尺寸畫的 `wrap`／`over`／`sleeve`，背上的配件是 `behind`。現況看 `docs/plans/cat-wardrobe.md` §7.2。

```text
包 ID／對應開案書章節：F1-cat-render／docs/plans/cat-wardrobe.md §3（紙娃娃）、§7（身體與亂跑）
目標（做完後使用者多了什麼）：
  小八喵（頭像、有身體的各姿勢、37 件配件）看起來更精緻、更一致，穿什麼都好看。
  她每天會看到的地方：今日頁與集章頁頭像、小貓頁試衣間（全身、坐姿）、答題進度條上的跑者、跑出來玩的小貓。
成品（檔案清單）：
  src/ui/kit/Cat.tsx（頭像 CatHead）、src/ui/kit/CatBody.tsx（身體）、src/ui/kit/wardrobe/art.tsx（配件圖）、
  src/core/constants/pet.ts（姿勢表與對位點）、src/ui/styles/pet.css、src/ui/styles/wardrobe.css（動畫）、
  src/theme.css（只加或調 --acc-*、--cat-* token）、src/core/constants/changelog.ts（最前面加一則）
模型與強度、選用理由：
  Claude Fable 5.2 工作階段（使用者在 App 開）。這是定調類的美術工作（看圖反覆調整、前後相依），
  照全域憲法「動手原則」由 Fable 自己做，不拆給低階代理。
工作區絕對路徑、分支、base SHA：
  C:\Git\civic-bunko，main；base 是開工當下的 main HEAD（開工先記 git rev-parse HEAD）。
  要開工作樹就用 C:\Git\_wt_civic_render（分支 render）。
可修改檔案（精確列舉）：上面「成品」那幾個檔；要動其他檔先停下來問。
必讀檔案／已確認事實：見下方「現況與已知弱點」。
驗收指令與逾時：見下方「驗收」。
什麼時候停下來問：見下方。
回報格式：AGENTS.md §6
```

## 現況與已知弱點（主代理 2026-11-18 留的）

- **座標系**：頭像是 64×64（臉中心 `HEAD_ORIGIN`＝32,39）；身體是 100×90，地面 `PET_GROUND`＝86。身體版用 `place(對位點, 原點)` 把頭、背飾接上去（RO 紙娃娃式對位點），姿勢資料全在 `PET_POSES`。
- **配件圖三種接法**（`art.tsx` 的 `ItemArt`）：
  - `node`：畫在頭像座標，頭像與身體上的頭共用。
  - `body`：畫在身體前面，以身體中心為原點、照站姿身體大小（`TORSO_REF`）畫，會跟著姿勢的身體**不等比**縮放（坐姿是 0.71×1.31）。目前只有披風。
  - `onBack`：畫在身體後面，以背的對位點為原點、等比縮放。目前有翅膀、氣球。
  - 背景（`bg` 部位）只在頭像與試衣間畫（`CatBody` 的 `backdrop`），跑出來玩時不畫。
- **已知弱點**（可以全部重做，不必保留現在的畫法）：
  - 身體上的頭只有頭像的 0.62 倍，臉上的配件（墨鏡、單片眼鏡、口罩）在全身時偏小。
  - 腿是圓角長方形，坐姿與吐司的輪廓偏簡單；四條腿的遠近只靠顏色分。
  - `body` 圖不等比縮放，坐姿上的披風會被拉長。
  - 書堆背景在站姿、走路時壓在下巴附近。
  - 身上部位（毛衣、水手領）在全身時只畫在頭下面，沒有穿到身體上。
  - 外框粗細：頭像 2.5、配件 2.2／1.8，縮放後在身體上變細，兩者不一致。
- **不能動的**：
  - 配件 ID、部位、價格、取得方式（`src/core/constants/wardrobe.ts`）：她已經買過、存檔裡有。
  - 存檔與同步格式：`src/systems/persistenceGolden.test.ts` 和 `src/testing/golden/` 不准改（AGENTS.md §2）。
  - 顏色只用 `theme.css` 的 token，日夜兩套都要好看；角色維持原創（AGENTS.md §2）。
  - 減少動態設定時不能有動畫（theme.css 已統一關掉，新動畫要沿用）。
- 考試是 2026-12-05，12-02 起只修錯：這包要在 12-01 前併入，否則延到考後。

## 驗收

- 看圖（每輪都要，證據由流水線產生）：
  - `npx tsx tools/gallery/cat-gallery.mts .gallery/cat-light.html light`
  - `npx tsx tools/gallery/cat-gallery.mts .gallery/cat-dark.html dark`
  - 頭像（每件單穿）、圖示、每種姿勢 × 背飾、背景、身上部位與三套全身穿搭都在裡面。用 App 的瀏覽器窗格開來看，或在 `.claude/launch.json` 掛一個靜態伺服器。
  - 改前、改後各留一份截圖給使用者比。
- App 實際畫面：`npm run dev`，看今日頁頭像、小貓頁試衣間（手機寬 375 與 320）、答題進度條、放小貓出來玩（拎起來、坐、睡）。
- `npm run lint`、`npm test`、`npm run build` 全過（`src/ui/kit/wardrobe/art.test.ts` 檢查每件配件都有圖）。
- 在 `src/core/constants/changelog.ts` 最前面加一則（只寫她看得到的改變）。

## 什麼時候停下來問

- 要改配件清單、部位、價格，或要改存檔與同步格式。
- 想換掉整個角色造型（不是精修，而是換風格）：先給使用者看 2–3 張對照圖再動手。
- 要加外部素材或字型（授權要記在 `docs/reference/README.md`）。
- 驗收的同一項失敗兩次。

## 韁繩

- 測試與驗收腳本不准為了過關而改；`tools/gallery/` 可以加功能，不可以拿掉既有的區塊。
- 不新增耦合：一個配件的圖只定義在 `art.tsx` 一處，姿勢資料只在 `pet.ts`；不要在元件裡用配件 ID 分支。
- 只結束自己啟動的行程（記下 PID）。
- push 授權照 `docs/HANDOFF.md`「使用者已決定」：驗收通過可直接併進 main、push、部署，回報推了什麼。
