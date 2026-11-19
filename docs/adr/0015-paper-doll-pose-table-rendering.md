# 0015 小貓紙娃娃部位分層、姿勢對位表與幾何測試守門

狀態：採用
日期：2026-11-18

## 背景

小貓從 64×64 頭像擴充為 9 個換裝部位與 100×90 全身多姿勢（站、走、跑、正面坐、理毛、睡、跳、踉蹌、拎起、落下），需要避免每增一件配件或調整姿勢時重複手刻所有組合，並防止配件出界或正面坐穿幫（部位表始於 2026-11-17 `docs/plans/cat-wardrobe.md` 開案；2026-11-18 定案姿勢表、正面坐背飾圖與自動化幾何測試）。

## 決定

- 部位定義於 `src/core/constants/wardrobe.ts` 的 `SLOTS`，疊圖順序另以 `z` 導出 `SLOTS_BY_DEPTH`（與衣櫥分頁順序分離，使 `face-low` 畫在 `head-top` 之上）；毛色透過 `src/theme.css` 色票切換，不占圖層。套裝特殊動作統一登記於 `OUTFIT_SPECIALS` 並由 `outfitSpecials()` 判斷。
- 每個姿勢以純資料 `PetPoseSpec` 定義於 `src/core/constants/pet.ts`（含身體幾何參數、四腿、尾巴、頭與背飾對位點、`frontal`/`backFront` 旗標、換姿中心軸 `PET_PIVOT_SHIFT`）；`src/ui/kit/petShape.ts` 計算身體輪廓與背花，`src/ui/kit/CatBody.tsx` 依對位點繪製。
- `src/ui/kit/wardrobe/art.tsx` 的身體版配件（`BodyArt`）以函式接收 `BodyGeom`（`wrap`、`over`、`sleeve`、`trouser`、`tail`），不寫死身體大小；直立正面姿勢（`backFront`）有定義 `BodyArt.frontal` 時取代側面圖；`CatBody` 依 `BodyArt.tail` 畫成套尾巴，不判斷配件 ID。
- 靜態幾何檢查納入 `src/ui/kit/catBody.test.ts`（`npm test`），搭配 `tools/gallery/cat-gallery.mts` 產出日夜看圖頁供檢視動態。

## 放棄的做法

`docs/plans/cat-wardrobe.md` §3.1 記載找過 Kenney、OpenGameArt、Open Peeps 等 CC0 素材但畫風不符而改為自繪 SVG；§7.2 記載 2026-11-18 使用者回饋側面披風／翅膀鏡像後不正確，放棄對正面坐直接鏡像側面背飾圖，改設 `BodyArt.frontal`。

## 後果

- 調整體型或新增姿勢時衣服與頭飾自動跟隨，加一套新娃娃裝只須補 `KIGURUMI`、`ITEM_ART` 與 `ITEMS`。
- 由 `src/ui/kit/catBody.test.ts` 驗證每種姿勢 × 配件不出 `PET_VIEW_W × PET_VIEW_H` 座標、花紋不超出身體、面向左為鏡像與正面圖規則。
- 代價是 `catBody.test.ts` 僅能量靜態幾何，CSS 動畫位置仍須另開看圖頁或實機確認。

## 證據

- `docs/plans/cat-wardrobe.md` §3.1、§3.7、§7.2
- `docs/HANDOFF.md`「目前狀態」
- `src/core/constants/wardrobe.ts`、`src/core/constants/pet.ts`、`src/ui/kit/petShape.ts`、`src/ui/kit/Cat.tsx`、`src/ui/kit/CatBody.tsx`、`src/ui/kit/wardrobe/art.tsx`、`src/ui/kit/catBody.test.ts`、`tools/gallery/cat-gallery.mts`
