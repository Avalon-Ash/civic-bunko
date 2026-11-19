# 0005 App 採用 ECS 與 SSOT 單向資料流架構

狀態：採用
日期：2026-11-15

## 背景

題庫量大且後續會擴充功能或替換題庫，使用者於 2026-11-15 指定採用 ECS＋SSOT，將資料、業務邏輯與畫面分離，並讓核心邏輯不依賴瀏覽器環境即可測試。

## 決定

- SSOT：全專案型別只定義於 `src/core/types.ts`；數值、上限、日期與規則只定義於 `src/core/constants/*.ts`；色彩、圓角、字級與固定四色語意（紅＝問法陷阱、綠＝正解、藍＝法條與名詞、橘＝官方更正，不得挪作他用）只定義於 `src/theme.css`。
- ECS：`src/core/world.ts` 持有純資料 Component 容器（`questions`、`enrich`、`progress`、`dayLog`、`round`、`settings`、`sync` 等）；業務邏輯放純函式 `src/systems/*`，System 不碰 DOM。
- 單一擁有者與事件匯流排：每個狀態欄位只有一個擁有者 System（例：`world.settings` 只由 `src/systems/settings.ts` 寫入，同步系統算出合併結果後呼叫 `applySyncedSettings`、`applySyncedCatProfile`；衣櫥狀態由 `src/systems/wardrobe.ts` 提供 `applySyncedWardrobe`），System 之間只透過 `src/core/bus.ts` 溝通。
- 畫面單向邊界：`src/ui/` 只經 `src/selectors/*` 唯讀查詢狀態、只經 `src/core/commands.ts`（`dispatch` / `UICommand`）觸發狀態變更。

## 放棄的做法

原紀錄沒有寫。

## 後果

- System 可在無瀏覽器環境直接以 `node:test` 單元測試，避免多處寫入同一狀態造成衝突或魔術數字散落。
- 由 `tsc --noEmit`（`npm run lint`）與 `src/systems/*.test.ts`（`npm test`）守門。
- 代價是新增功能須跨 `types.ts`、常數檔、System、selector 與 `commands.ts` 配線，不能在畫面元件內直接修改狀態。

## 證據

- `AGENTS.md` §2「架構（ECS＋SSOT）」「介面」
- `docs/plans/civic-bunko.md` §4「App 架構：ECS＋SSOT」、§9「程式結構補充」
- `src/core/types.ts`、`src/core/world.ts`、`src/core/bus.ts`、`src/core/commands.ts`、`src/selectors/index.ts`、`src/systems/settings.ts`、`src/systems/wardrobe.ts`、`src/theme.css`
