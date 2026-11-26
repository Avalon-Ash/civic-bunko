# 0021 漫畫的資料在 pack、版型與道具畫法在引擎，道具與角色是引擎的通用詞彙表

狀態：採用
日期：2026-11-27

## 背景

四格漫畫要在 5 天內量產二十多張（`docs/plans/comic-cards.md` §6）。repo 唯一成熟的插畫能力是小貓（`src/ui/kit/CatBody.tsx`、`src/ui/kit/wardrobe/art.tsx`）。ADR 0011 規定引擎不認識任何一個內容包，第二個題庫要能直接沿用引擎。

## 決定

- 漫畫的詞彙表只在 `src/core/constants/comic.ts`：版型 `COMIC_LAYOUTS`（含格數上下限）、構圖 `COMIC_SCENES`（每格最多幾隻貓、幾樣道具）、道具名稱 `COMIC_PROPS`、角色 `COMIC_CASTS`。ID 的型別在 `src/core/types.ts`（`ComicLayout`、`ComicSceneId`、`ComicPropId`、`ComicCast`）。
- 角色是通用身分（機關、人民、公務員），每個角色固定一套衣櫥穿著，同一個角色在每張卡都長一樣；演員沿用 `CatBody`，不畫新角色。
- 道具的圖在 `src/ui/kit/comic/props.tsx`（`Record<ComicPropId, …>`，每個道具一定有圖），構圖擺位在 `src/ui/kit/comic/scenes.ts`；五種版型共用 `ComicStrip`，樣式在 `src/ui/styles/comic.css`，顏色只用 `src/theme.css` 的 token。
- 道具與角色的 ID 是通用名詞，不含任何包的科目或考試字樣（`tools/lint/engine-boundary.mjs` 照樣守）。卡片資料只能引用詞彙表裡的 ID，驗證直接 import `constants/comic.ts`，沒有第二份清單。
- 量產一張卡＝選版型、構圖、角色、道具，填指標；缺道具才在詞彙表加一筆並畫圖。

## 放棄的做法

- 每張卡一張獨立大插畫：5 天畫不完，也無法機械產生小遊戲。
- 影像模型產圖：風格不一致、圖裡的中文字會錯、離線快取變大、原創性難保證。
- 道具清單寫在 pack：第二個題庫要重畫同一套道具，而且畫法和清單會分在兩處。
- 角色的穿著寫在每一格：同一個角色在不同卡長得不一樣，「戴領帶的是機關」就記不起來。

## 後果

- 新增道具要同時改 `types.ts` 的聯集、`COMIC_PROPS` 的名稱、`props.tsx` 的圖；少一處 `tsc` 就紅。
- 道具是程式碼，會讓 JS 變大；不新增離線檔案，`precache.json` 不受影響。
- 看圖腳本 `tools/gallery/comic-gallery.mts` 列出每樣道具被哪幾張卡用到，「每張卡要有自己的畫面」由主席看圖判斷，不寫成測試。

## 證據

- `docs/plans/comic-cards.md` §2.2、§2.3、§10-1
- `docs/adr/0011-content-packs-and-engine-boundary.md`
- `src/core/constants/comic.ts`、`src/ui/kit/comic/`、`tools/gallery/comic-gallery.mts`
