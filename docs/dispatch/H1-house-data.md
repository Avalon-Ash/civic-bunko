# 派工單 H1-house-data：小貓之家的資料與系統

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §3、§6；格式決定在 `docs/adr/0018-multi-cat-house-and-synced-looks.md`。
- **目標**：資料層支援最多 5 隻小貓：領養（第 2 隻免費、之後花小魚乾）、每隻各自取名與換裝、名字與長相跨裝置同步、帶出門與陪我刷題（只存本機）。這包沒有畫面改動；做完後下一包（小屋畫面）只經 `selectors/house.ts` 讀、`dispatch` 寫。
- **模型與強度**：`gemini-4-neon-high`（跨存檔、同步、衣櫥三個 System，要守住她已經在用的資料）。
- **工作區**：`C:\Git\_wt_civic_house`，分支 `house`，base 是 `git log -1` 看得到「H0 小貓之家」的那一筆。只准改這個資料夾內的檔案。

## 已由主代理寫好（已提交，不准改）
- `src/core/types.ts`：`CatId`、`HouseCatSave`、`CatLook`、`WardrobeState` 新增的選填欄（`outfitAt`、`cats`、`outing`、`leader`）、新指令（`adoptCat`、`setCatOuting`、`setLeader`）與 `wear`、`setCatName` 新增的選填 `cat`。
- `src/core/constants/house.ts`：`HOUSE_FIRST_CAT`、`HOUSE_CAT_ID`、`HOUSE_ADOPT`、`HOUSE_MAX_CATS`、`HOUSE`。
- 紅色驗收：`src/systems/house.test.ts`、`src/systems/syncHouse.test.ts`、`src/systems/persistenceHouse.test.ts`；樣本 `src/testing/golden/save-v7-house.json`、`src/testing/golden/sync-v1-house.json`。**全部不准改**；你認為斷言錯了就停下回報。

## 要做的（3 件）

### 1. 存檔：`src/systems/persistence.ts` 的 `parseWardrobe`
- 照 `persistenceHouse.test.ts` 讀新欄位，壞掉的只丟那一小項：
  - `outfitAt`：字串才留。
  - `cats`：物件才留；鍵要符合 `HOUSE_CAT_ID` 且不是 `HOUSE_FIRST_CAT`，值要是物件；每隻的 `name`、`nameAt`、`outfitAt` 是字串才留，`outfit` 用跟現有 `outfit` 一樣的清理（部位認得、值是字串）。空物件 `{}` 的小貓照樣保留（牠已經被領養了）。一隻都不剩就不留這欄。
  - `outing`：陣列才留；只留符合 `HOUSE_CAT_ID` 的字串、去重、保持原順序。
  - `leader`：符合 `HOUSE_CAT_ID` 的字串才留。
- 不認得但格式對的小貓（例如 `cat-9`）照樣保留。寫回去要跟樣本相等（測試會比）。

### 2. 小屋系統與讀取：新檔 `src/systems/house.ts`、`src/selectors/house.ts`
- `systems/house.ts` 是 `wardrobe.cats`、`wardrobe.outfitAt`、`wardrobe.outing`、`wardrobe.leader` 的擁有者，並且是**唯一**判斷「這隻是不是原本那隻」的地方：原本那隻的名字讀寫 `settings.catName`／`catNameAt`（沿用 `systems/settings.ts` 的 `setCatName` 與 `catBrain.ts` 的 `catProfileOf`），穿著讀寫 `wardrobe.outfit`＋`outfitAt`；其他隻讀寫 `wardrobe.cats[id]`。其他檔案不准再寫 `id === HOUSE_FIRST_CAT` 這類判斷。
- 家裡有誰：原本那隻＋`HOUSE_ADOPT` 裡 `owned` 已經在 `wardrobe.owned` 的，照表的順序。不認得的編號不列。
- 領養（`adoptCat`）：下一隻＝表裡第一個還沒領養的；滿了或 `fishBalance(world, now).raw` 不夠就不動作。把那隻的 `owned` ID 加進 `wardrobe.owned`；有 `name` 就照 `setCatName` 的規則清理並記 `nameAt`；有 `fur` 且已擁有、部位是 `fur` 才穿上並記 `outfitAt`。
- 小魚乾：`systems/wardrobe.ts` 的 `fishBalance` 花費多加「已領養的 `HOUSE_ADOPT` 價格」。價格只讀 `HOUSE_ADOPT`，不另寫一份。`ownedItems` 不必排除領養 ID。
- 換裝（`wear` 加 `cat`）：`systems/wardrobe.ts` 的 `wear(world, slot, item, cat?, now?)`，`cat` 預設原本那隻，舊的三個參數呼叫照舊能用（`wardrobeSale.test.ts` 直接呼叫）。只接受已在家裡的小貓、已擁有且部位相符的配件；同一件可以好幾隻同時穿。每次改動記改動時間。`currentOutfit(world)` 維持是原本那隻的穿著（等於 `catOutfit(world, HOUSE_FIRST_CAT)`），過濾規則（沒擁有、部位不對的不算）套用到每一隻。
- 取名（`setCatName` 加 `cat`）：沒有 `cat` 或是原本那隻→照舊寫 `settings.catName`；其他已領養的→寫 `wardrobe.cats[id].name`／`nameAt`；清空名字也記時間；沒領養的不動作。
- 改動時間一律 `Math.max(now, 上一次 + 1ms)`（跟 `systems/settings.ts` 的名字一樣，抽成共用函式，不要複製一份）。
- 帶出門（`setCatOuting`）：沒有 `outing` 欄時視為「家裡前 `HOUSE.maxOut` 隻」；開的時候已經 `HOUSE.maxOut` 隻就不動作；可以一隻都不帶。讀的時候只列在家裡的、照家裡順序。
- 陪我刷題（`setLeader`）：只接受在家裡的；讀的時候存的那隻不在家裡就是原本那隻。
- 這兩個設定都不碰 `settings.accessory`。
- 寫入一律走 `systems/wardrobe.ts` 現有的 `commitWardrobe`（或擴充它的 patch），讓存檔與事件跟現在一樣只發一次。
- `selectors/house.ts` 照測試 export：`houseCats(world)`（每隻 `{ id, name, named, outfit, out, leader }`；`name` 是顯示名：取了名用名字，原本那隻沒取名用 `CAT_CHARACTER.defaultName`，其他隻用 `HOUSE_ADOPT` 的 `defaultName`；`named` 是她取的名字或 `null`）、`nextAdoption(world, now)`（`{ cat, price, short } | null`，`short = Math.max(0, price - fishBalance.raw)`）、`leaderCat(world)`、`outingCats(world)`、`catOutfit(world, id)`。
- `src/core/commands.ts` 接上 `adoptCat`、`setCatOuting`、`setLeader`，`wear`、`setCatName` 傳 `cat` 與 `now`。

### 3. 同步：`src/systems/sync.ts`、`src/systems/syncMerge.ts`
- `syncMerge.ts` 新增並 export `mergeCatLook(a, b)`：改動時間較新的整包留下；同時間要確定性（例如比 outfit 依部位排序後的字串），結果與參數順序無關（測試驗交換律與結合律）。逐隻合併的共用函式也放這裡（名字用現有 `mergeCatProfile`）。
- 同步檔加兩個選填欄：`cats: Record<CatId, CatProfile>`（新貓的名字；原本那隻仍在 `cat` 欄）、`looks: Record<CatId, CatLook>`（每隻的長相，含原本那隻）。解析時壞掉的只丟那一隻；不認得但格式對的小貓保留，寫回去時照樣帶著。
- 改動時間是空字串的長相不上傳、也不拿來蓋本機（`syncHouse.test.ts` 第三個情境）。
- 合併後透過擁有者（`systems/house.ts`）寫回本機；本機沒變就不寫、遠端沒變就不上傳（跟現有的比對方式一樣，把 `cats`、`looks` 加進去）。
- `outing`、`leader` 不進同步檔。

## 不做
- 不改任何畫面（`src/ui/**`）、不改 `src/core/types.ts`、`src/core/constants/**`、測試與樣本。
- 不加更新紀錄（這包她看不到變化）。

## 必讀
- `AGENTS.md` §2（使用者資料、架構）、`docs/plans/cat-house.md` §3、`docs/adr/0018-multi-cat-house-and-synced-looks.md`、`docs/adr/0012-derived-fish-balance.md`。
- `src/systems/persistence.ts`（`parseWardrobe`）、`src/systems/wardrobe.ts`（`fishBalance`、`ownedItems`、`currentOutfit`、`wear`、`commitWardrobe`、`applySyncedWardrobe`）、`src/systems/settings.ts`（`setCatName`、`withCatProfile`、`applySyncedCatProfile`）、`src/systems/catBrain.ts`（`catProfileOf`、`parseCatProfile`）、`src/systems/sync.ts`、`src/systems/syncMerge.ts`、`src/core/commands.ts`、三個紅色測試檔。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）
- `npx tsx tools/economy/fish-economy.mts`（60 秒）：只跑、把輸出貼進回報，不改這個腳本。

前三個都要退出碼 0。

## 韁繩
- 驗收腳本與測試不准改；不准 mock 被驗證的對象、不准空的 `catch`、不准用 `?? 預設值` 讓缺欄位通過、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只改工作資料夾內這幾個檔：`src/systems/persistence.ts`、`src/systems/house.ts`（新）、`src/selectors/house.ts`（新）、`src/systems/wardrobe.ts`、`src/systems/settings.ts`、`src/systems/sync.ts`、`src/systems/syncMerge.ts`、`src/core/commands.ts`。需要動別的檔就停下回報。
- 不新增耦合：同一個判斷不在兩處重複（原本那隻的轉接只在 `systems/house.ts`，改動時間的算法只有一份，領養價格只讀 `HOUSE_ADOPT`）。
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
