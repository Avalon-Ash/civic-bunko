# 派工單 H4a-pet-by-id：小貓引擎改成依小貓 ID（只有一隻時行為完全不變）

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **對應開案書**：`docs/plans/cat-house.md` §4.2、§6、§7（H4a）。
- **目標**：所有現在假設「只有一隻小貓」的地方改成讀小貓 ID，並且全部用「陪我刷題」那隻（`leaderCat(world)`）：今日、集章頁的頭像與放出來亂跑的那隻、答題與看答案頁進度條上的那隻、想太久的提示、點牠說的話（用牠自己的名字）。**家裡只有原本那隻時，畫面與行為跟現在一模一樣**。下一包（H4b）才讓好幾隻一起出門，所以這包的引擎要能各自獨立，但畫面上一次還是只放一隻。
- **模型與強度**：`gemini-pro-orchestrator-neon`（不帶 `--effort`；跨 `PetLayer.tsx` 1,193 行與多個畫面，要先讀很多再改）。
- **工作區**：`C:\Git\_wt_civic_pet`，分支 `pet`，base 是 `git log -1` 的那一筆（`main`，含 H1 的 `selectors/house.ts`）。只准改這個資料夾內的檔案。

## 已經有的（不准改）
- `src/selectors/house.ts`：`houseCats`、`leaderCat`、`outingCats`、`catOutfit`。`src/systems/house.ts` 是唯一判斷「這隻是不是原本那隻」的地方，其他檔案不准寫 `=== HOUSE_FIRST_CAT` 這類判斷。
- `src/core/constants/house.ts`、測試與樣本。

## 要做的（3 件）

### 1. 放出來、叫回家的狀態改成依 ID：`src/ui/pet/petStore.ts`
- 現在是一個模組層級的單例。改成以 `CatId` 為鍵，每隻各自有 `{ out, request, seq }`。對外的函式都多一個 `cat` 參數：`usePet(cat)`、`getPet(cat)`、`subscribePet`、`releasePet(cat, from)`、`recallPet(cat)`、`hintPet(cat, el, right, from)`、`petHome(cat)`。一隻的請求不准影響另一隻。
- 新增 `src/ui/pet/petStore.test.ts`：兩個 ID 各自放出來、叫回家、提示，互不影響；`seq` 各自遞增。

### 2. 引擎與畫面讀「陪我刷題」那隻
- `src/ui/pet/PetLayer.tsx`：加 prop `cat: CatId`；穿著改用 `catOutfit(world, cat)`、套裝效果照這隻的穿著算；所有 `petStore` 呼叫帶 `cat`。`src/ui/App.tsx` 掛載時傳 `leaderCat(world)`，並用 `key={leader}`（換了陪我刷題的那隻就重新掛載，舊的那隻回家）。焦痕、劈歪、結冰這些改卡片的效果與上限照舊（它們本來就存在 world 或 DOM，不跟著小貓走）。
- `src/ui/pet/CatHome.tsx`、`src/ui/pet/PetRunner.tsx`、`src/ui/pet/useCatHint.ts`：用 `leaderCat(world)`（需要 world 的就從 props 傳進來）。
- 頭像與進度條的穿著：`src/ui/screens/TodayScreen.tsx`、`StampsScreen.tsx`、`ResultScreen.tsx`、`QuestionScreen.tsx`、`ReadScreen.tsx` 裡的 `currentOutfit(world)` 改成 `catOutfit(world, leaderCat(world))`。`WardrobeScreen.tsx` 不准動（另一包在改）。
- 說話用那隻的名字：
  - `src/core/types.ts` 的 `CatTap` 加一個**選填**欄 `cat?: CatId`（只加這一欄，其他型別不准動）。
  - `src/selectors/cat.ts`：`catName(world, cat?)`、`catDisplayName(world, character?, cat?)`（或改成用物件參數，挑一種，但既有呼叫 `catDisplayName(world)` 要照樣能用）、`catSituation` 讀 `tap.cat ?? leaderCat(world)` 的名字與穿著。名字與預設名一律從 `houseCats(world)` 讀（`named`、`name`），不准自己讀 `settings.catName`。
  - `PetLayer` 與頭像說話時，在 `CatTap` 帶上那隻的 `cat`。
  - `src/ui/pet/CatVoiceProvider.tsx` 不必改介面（記憶全家共用一份就好）。
- `selectors/cat.test.ts` 的既有斷言不准改；**新增**：領養第 2 隻、取名、設成陪我刷題後，`catSituation` 的 `name` 是牠的名字、`wearing` 照牠的穿著算；`tap.cat` 指定別隻時用那隻的。

### 3. 只有一隻時不變
- 既有的 `petLogic.test.ts`、`catBody.test.ts`、`cat.test.ts`、`catBrain.test.ts` 全部照樣通過，不准改。
- 看圖腳本 `tools/gallery/cat-gallery.mts` 照樣跑得出來。

## 不做
- 不做多隻同時出門、帶出門開關（H4b）。
- 不改 `src/ui/screens/WardrobeScreen.tsx`、`src/ui/pet/CatNameEditor.tsx`、`src/ui/house/**`、`src/systems/**`、存檔與同步。
- 不加更新紀錄（這包她看不到變化，除非她把陪我刷題換成別隻；那一則跟 H3 一起寫）。

## 必讀
- `AGENTS.md`（§2 架構）、`docs/plans/cat-house.md` §4.2、§6、`src/selectors/house.ts`、`src/systems/house.ts`（`houseCats`、`leaderCat`、`catOutfit` 的行為）、`src/ui/pet/petStore.ts`、`src/ui/pet/PetLayer.tsx`（全檔）、`src/ui/pet/CatHome.tsx`、`src/ui/pet/PetRunner.tsx`、`src/ui/pet/useCatHint.ts`、`src/ui/App.tsx`（掛載 `PetLayer` 那段）、`src/selectors/cat.ts`、`src/selectors/cat.test.ts`、上面列的五個畫面檔裡 `currentOutfit` 那幾行。

## 驗收（只能跑這些；每個終端機指令單獨一次呼叫，字串照抄，不加 `cd`、不用 `&&` 或 `;` 串接）
- `npm run lint`（120 秒）
- `npm test`（180 秒）
- `npm run build`（180 秒）
- `npx tsx tools/gallery/cat-gallery.mts .gallery/pet-light.html light`（60 秒）

前三個要退出碼 0。主代理會開瀏覽器確認一隻時的放出來、叫回家、答題頁的提示跟現在一樣。

## 韁繩
- 既有測試與驗收腳本不准改；不准 mock 被驗證的對象、不准空的 `catch`、不准 `as any`。
- 規格互相矛盾、或同一個驗收失敗兩次：停下回報，不要再想辦法讓它過。
- 只讀、只改 `C:\Git\_wt_civic_pet` 裡面的檔案：不要讀工作資料夾以外的任何檔案（包括 AGENTS.md 提到的全域 web-guidance skill、使用者家目錄），也不要讀 `node_modules`；被拒一次整個執行就會結束。
- 只改這幾個檔：`src/ui/pet/petStore.ts`、`src/ui/pet/petStore.test.ts`（新）、`src/ui/pet/PetLayer.tsx`、`src/ui/pet/CatHome.tsx`、`src/ui/pet/PetRunner.tsx`、`src/ui/pet/useCatHint.ts`、`src/ui/App.tsx`、`src/ui/screens/TodayScreen.tsx`、`src/ui/screens/StampsScreen.tsx`、`src/ui/screens/ResultScreen.tsx`、`src/ui/screens/QuestionScreen.tsx`、`src/ui/screens/ReadScreen.tsx`、`src/selectors/cat.ts`、`src/selectors/cat.test.ts`（只加）、`src/core/types.ts`（只在 `CatTap` 加 `cat?`）。需要動別的檔就停下回報。
- 不新增耦合：「陪我刷題是哪隻」只讀 `leaderCat`，名字只讀 `houseCats`。
- 不 commit、不切分支；只結束自己啟動的行程。
- 每個完成項附 `檔案:行號`。

## 回報格式（`AGENTS.md` §6）
```text
包 ID：完成／部分完成／阻塞
請求模型與強度；實際設定：工具確認值或「未確認」
工作區／base SHA：
變更檔案與行為（檔案:行號）：
檢查：指令、退出碼、ERROR/WARN 數
未確認項：
剩餘工作：
```
