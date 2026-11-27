# 開案書：四格漫畫圖卡

- 開案：2026-11-26，Fable 5.2（派工單 `docs/dispatch/CC0-comic-cards-plan.md`）。狀態：2026-11-27 凌晨照 §10 的預設動工。CC1（3 張樣張、遮起來想）、CC3（卡片↔官方題；樣張 3 張＋另外 21 張有法條的卡已掛題，主席逐題看過題幹）已上線；道具由 agy Neon 畫、Codex 審兩輪。樣張關卡 11-27 使用者回「可以，量產」；**CC4a（A 批 7 張）11-27 上午完成**：主席寫分鏡、agy Neon high 畫 7 個新道具（約 6 分鐘）、Codex 審圖一輪；含引擎補 `label`（排排站每格標項目名稱）、排排站與上到下的列式版面、角色加民意代表與地方政府。實測速率：分鏡加看圖每張約 10–15 分鐘，道具另外平行跑，所以 B 批 8 張不必砍。**CC4b（B 批 8 張）11-27 完成（分支 `claude/cc4b-comics-f4dea8`，待主席審）**：主席寫分鏡（8 張約 10 分鐘）、agy Neon high 畫 8 個新道具（天秤、柵欄、雨傘、放大鏡、考卷、房子、公園長椅、錢袋，約 5 分鐘）、Codex 審圖一輪（gpt-6.2-sol medium）；兩張換版型（§4）；格子文字加 `text-wrap: pretty`，換行不再剩一個字。Codex 意見沒照改的：雨傘那格「貓移到傘下」（構圖模板沒有重疊擺位）、考卷「像待辦清單」（格子上有「考試院」標籤）、營業稅加的是剪刀不是橡皮擦（橡皮擦已代表撤銷）；部分採納：期間第 2 格保留趴著睡（假日才順延），只加沙漏；比例原則那格不加橡皮擦，改指「損害和利益不能顯失均衡」配天秤；第二輪沒跑（Codex 週額度偏低，三條必改都照改）。**2026-11-27 和 `docs/plans/ux-cleanup.md` 合併時程：逐日表以那份 §7 為準，考前目標 22 張（§6）；本檔其他節提到的「30 張」「每天 7–8 張」是合併前的算法，以 §6、§7 為準。**
- 需求來源：`docs/reference/comic-cards-request.md`（她的口述、主代理判讀、規格 → 卡片對照表、規格原文）。
- 期限：可開發日 11-27 到 12-01（5 天）；12-02 起只修錯；考試 12-05、12-06。
- 本檔裡的數字都附量法；沒量過的寫「估」。

## 1. 目標

她看到圖就想起考點、看到考題就想起圖。做法：替既有圖卡加一層「漫畫」（小貓演出＋道具＋卡片原文的一句話），並把卡片和官方題接起來。**不新寫任何考點內容、不新寫考題、不新增存檔欄位。**

### 為什麼現在的卡難背（量到的事實）

| 事實 | 出處 |
| :-- | :-- |
| 「圖」只有兩種文字方塊：flow（一列方塊加箭頭）、versus（左右兩個清單）。沒有任何插畫，每張卡長得一樣，沒有專屬的視覺記號 | `src/ui/kit/Visual.tsx`、`src/core/types.ts:110` |
| 57 張裡 4 張連這種圖都沒有（`newlaw-lga-57-township`、`newlaw-lga-61-pay`、`newlaw-lga-83-7-fund`、`essay-113-general-chinese-1`；`visual=-`） | §11 指令 1 |
| 一張卡 3–5 面、7–15 行、88–239 字，一次只看得到一面，要自己翻 | §11 指令 1 |
| 面與面是並列的條列，沒有先後或因果，沒有故事可以掛 | `data/packs/local4-civil/cards/*.json` |
| 唯一的互動是最後一面的「看完了」，沒有任何回想練習（申論卡才有「遮起來背」） | `src/ui/components/cards/CardFaceViewer.tsx`、`EssayCardBody.tsx` |
| 卡片和題目互不相識：解析頁只顯示該題自己的 `enrich.visual`，看不到圖卡；卡片也開不出「這張卡的題」 | `src/ui/components/QuestionParts.tsx:151`、`StudyCard` 沒有題目或考點欄位 |

結論：現在的卡是「排版過的筆記」，她得硬背條列。缺的是三樣：專屬畫面、起承轉合的順序、回想與考題的連結。

## 2. 架構

### 2.1 資料形狀（放 pack）

在 `StudyCard` 加兩個**選填**欄位，寫在既有的 `data/packs/<包ID>/cards/*.json` 裡。不另開資料夾：`tools/validate/cards.mjs` 會把 `cards/` 下每個 `.json` 當卡片檔驗，而且另開資料夾要動 `src/data/source.ts`、`tools/paths.mjs` 與 ADR 0011 的包形狀。現有驗證腳本不檢查多出來的欄位（只擋 `essayText`），所以加欄位不會讓 `npm run validate` 變紅。

```ts
// src/core/types.ts（示意，名稱由 CC1 定案）
interface StudyCard {
  comic?: CardComic;          // 沒有＝照舊顯示文字卡
  questions?: QuestionId[];   // 這張卡對應的官方題（§2.4）
}
interface CardComic {
  layout: ComicLayout;        // 'story' | 'timeline' | 'versus' | 'ladder' | 'lineup'
  panels: ComicPanel[];       // 2–5 格，上下限寫在 constants/comic.ts
}
interface ComicPanel {
  scene: ComicSceneId;        // 構圖模板（引擎的詞彙表）
  actors: ComicActor[];       // 小貓演員：姿勢、表情、戴什麼（沿用 Outfit）
  props: ComicPropId[];       // 道具（引擎的詞彙表）
  text: ComicTextRef;         // 這格的一句話：指標，不是字串
  sign?: string;              // 舉牌上的大字：必須是 text 那一行的子字串（例「30 日」）
  label?: ComicTextRef;       // 這格是哪一項（例：面標題「修憲」）；遮起來想時照樣顯示。lineup 必填（2026-11-27 CC4a 加：帶數字的那行不含項目名稱）
}
type ComicTextRef =
  | { from: 'hook' }
  | { from: 'heading'; face: number }
  | { from: 'line'; face: number; line: number; pick?: string }; // pick＝該行的子字串
```

**格子裡的字只用指標**（做法同 `Enrich.marks` 的「題幹原文片段」）：
- 內容限制由機器守：指標解析不到、`pick`／`sign` 不是該行的子字串，驗證就紅。漫畫不可能出現卡片沒有的字。
- 同一份內容不寫兩次：卡片改一個字，漫畫跟著變；小遊戲（遮字、配對）直接從同一份資料產生。
- 不需要新的字數上限：字本來就受 `CARD_LINE_MAX` 管。新模式**不在任何地方新增字數數字**。
- 畫面上的角色標籤（「機關」「人民」）同樣只能是卡片某一行的子字串，否則不標。版型自帶的「起、承、轉、合」「VS」是引擎的介面字，不算內容。

**四格和 `faces` 不是一對一**。漫畫只挑 2–5 行當記憶錨點；整張卡原本的 `hook`、所有面、法條鈕都留在漫畫下面的「完整文字」（既有 `CardFaceViewer`，原樣）。內容不會因為有漫畫而少一行。

### 2.2 畫法（放引擎）：小貓劇場

選定做法（方向本身列在 §10-1 給使用者確認，樣張就是確認的依據）：

- **演員**：沿用小貓。`CatBody`（姿勢表 `PET_POSES`：站、走、跑、坐、理毛、趴…）、`CatHead`（表情 `CatMood` 四種、`Emote` 泡泡）、衣櫥配件（學士帽、眼鏡、披風、准考證…）當「角色識別」：同一張卡裡，戴帽子的是機關、沒戴的是人民。零新角色美術。
- **道具**：新畫一套小 SVG 圖示（皇冠、公文、沙漏、日曆、門、天秤、印章、路牌、建築…），放 `src/ui/kit/comic/props.tsx`，一個道具一筆，畫法比照 `wardrobe/art.tsx` 的單件配件（每件約 10–25 行 SVG）。道具 ID 是通用名詞（`crown`、`hourglass`），不含任何包的科目或考試字樣（`tools/lint/engine-boundary.mjs` 會擋）。
- **構圖模板**（`scene`）：少數幾種固定擺位（單人＋道具、兩人交接、一人對一物、排排站舉牌、樓梯三層），由資料選用。量產一張卡＝選模板、選演員與道具、填指標；缺道具才畫新的。
- **五種版型共用一個元件** `ComicStrip`，差別只在格子排列與格間連接線：

| 版型 | 樣子 | 適合 |
| :-- | :-- | :-- |
| `story` | 2×2 四格，標「起承轉合」 | 有情境、有轉折（陷阱或例外）的卡 |
| `timeline` | 四格沿一條時間軸，格間是箭頭 | 期限、流程、演進 |
| `versus` | 左右兩欄各兩格，同一列互為對照 | 兩種制度比較 |
| `ladder` | 一張直圖，上到下三層 | 階層、上下關係 |
| `lineup` | 2–5 個角色排排站舉牌（大字＝`sign`） | **純數字表、三分類**：不硬塞起承轉合 |

- 顏色只用 `src/theme.css` 的 token 與衣櫥既有色票，日夜兩套；**不用四色語意**（紅綠藍橘，ADR 0005）當插畫配色。動態只用 CSS（格子依序出現），尊重減少動態。執行期依賴維持 react／react-dom（ADR 0006）。
- 不新增離線檔案：SVG 是程式碼、資料在既有卡片檔裡，`precache.json` 不受影響。

**為什麼選這個**：
1. repo 唯一成熟的插畫能力就是小貓（`CatBody.tsx` 430 行、`wardrobe/art.tsx` 1,850 行、看圖腳本、靜態幾何測試都在），演員成本是 0，只剩道具。
2. 她每天在養這隻貓，牠演的戲比陌生人物好記。
3. 回退便宜：某張卡的漫畫不好，把那張的 `comic` 欄位拿掉就回到文字卡，不動程式。

放棄的做法：
- 每張卡畫一張獨立大插畫：41 張 × 4 格，5 天畫不完，也無法機械產生小遊戲。
- 影像模型產圖：風格不一致、圖裡的中文字會錯、離線快取變大、原創性難保證。
- emoji 當插畫：規格明講不要；各裝置長相也不同。

**量產算術（估，CC1 做完樣張後以實測重估）**：5 天版 30 張 ≈ 125 格；道具估 55–70 件（多數卡 1–2 件新道具，數字型卡共用舉牌）。照 D2–D5 每天 7–8 張才做得完。CC1 記下「每張卡實際花多久」，D2 收工時實測不到每天 5 張，就照 §6 的砍法縮張數並告訴使用者。

### 2.3 檔案位置

| 東西 | 位置 |
| :-- | :-- |
| 型別 | `src/core/types.ts`（`CardComic` 等） |
| 版型清單、格數上下限、場景與道具的 ID 清單 | `src/core/constants/comic.ts`（唯一一份） |
| 道具圖、場景擺位 | `src/ui/kit/comic/props.tsx`、`src/ui/kit/comic/scenes.ts` |
| 漫畫元件 | `src/ui/kit/comic/ComicStrip.tsx`、樣式 `src/ui/styles/comic.css` |
| 指標解析（指標 → 字串）、小遊戲出題（純函式） | `src/systems/comic.ts`、`src/systems/comicQuiz.ts` |
| 卡片↔題目查詢 | `src/selectors/cardLinks.ts` |
| 驗證（進 `npm test`） | `tools/validate/comics.test.mjs`：`npm test` 用 `node --import tsx` 跑，可以直接 import `constants/comic.ts`（§11 指令 4 確認過 `.ts` 匯得進來），所以**不會有第二份清單** |
| 看圖腳本 | `tools/gallery/comic-gallery.mts`（比照 `cat-gallery.mts`：每張有漫畫的卡 × 日夜，輸出到 `.gallery/`） |
| 連結候選產生器 | `tools/cards/suggest-links.mjs`（只印候選，不寫檔） |

### 2.4 卡片↔官方題的連結（只定義一次）

- 正本：卡片上的 `questions`（官方題 ID 清單，放 pack）。查詢只有一個 selector（`cardLinks`），正向（這張卡的題）與反向（這題的圖卡）都從它來。
- 清單怎麼來：`suggest-links.mjs` 用「題目**正解選項**的 `lawRef` 落在卡片 `lawRefs` 裡」列候選，主席看過再寫進卡片。量到的現況：
  - 26 張有法條的非申論卡，正解選項比對連到 **110 題**，其中 25 張有題（1–12 題不等），`concept-law-rank` 是 0（§11 指令 3）。
  - 放寬成「任一選項」是 183 題、26 張都有，但錯誤選項引用的條文也算進來，會連到不相干的題（§11 指令 2），所以只當候選、不當正本。
  - **15 張沒有 `lawRefs`**（行政學 12、國文 3）機械連不到：由雜事代理在該科的題目裡用卡片關鍵詞找候選，主席逐題看過才掛。找不到合適的就不掛，那張卡沒有「刷題」鈕，不硬湊。
- 不用考點（`enrich.topic`）當連結：一個考點 3–57 題（§11 指令 5），太粗，「刷這張卡的題」會變成刷整科。
- 驗證：`questions` 裡每個 ID 都要在官方層存在；一張卡上限寫在 `constants/comic.ts`。

### 2.5 存檔與同步：零新欄位

| 狀態 | 怎麼處理 |
| :-- | :-- |
| 這張卡看過沒 | 沿用 `settings.cardsSeen`（已同步、取聯集，ADR 0013） |
| 情境題的對錯、什麼時候再出現 | 官方題照常走 `answered` → `Progress` → `REVIEW_INTERVAL_DAYS`（`src/systems/scheduling.ts`），已同步 |
| 這張卡「該複習了」「熟了」 | 由連到的題的 `Progress` 導出（做法同 ADR 0012 的小魚乾餘額），不存 |
| 遮字回想、配對的成績 | **不存**。它們是暖身，不是紀錄；題目 ID 以外的東西不寫進 `progress`。（2026-11-27 改：配對全對存卡片 ID 到 `settings.cardsMatched`，見 ADR 0023、`docs/plans/level-mode.md`） |
| 小魚乾、成就 | 刷卡片的題就是一般回合，照既有規則給；「看新圖卡」的每日任務與 `cardsSeen` 成就照舊 |

「刷這張卡的題」**不在 `RoundConfig` 加欄位**。查過存檔：進行中的回合會整包存進本機（`persistence.ts:578–591`，內容是 `config`＋`queue`…；續玩時 `parseRoundState` 以 `normalizeRoundConfig(value.config)` 保留 `topicIds`，`persistence.ts:442`），所以在設定裡加「哪張卡」就等於加存檔欄位。做法改成：新的 `UICommand`（例 `startCardRound { cardId }`）直接用卡片的 `questions` 組出 `queue`，`config` 用一般回合的既有欄位。存下來的東西和平常的回合同形，續玩靠既有的 `queue`（`validateSavedRound` 只檢查題目 ID 都在）。「這回合是從哪張卡來的」只放記憶體（給結果頁顯示「回到這張卡」）：重開 App 後續玩照常，只是少了那顆鈕，結果頁的「再來一回」會是一般回合。這條路若實作時走不通（例如某處會用 `config` 重新組題），停下來回報，不自己加欄位。

### 2.6 要新開的 ADR

| 標題 | 理由 |
| :-- | :-- |
| 漫畫是卡片的選填衍生層，格子文字只用指標指向卡片原文 | 資料格式與單一事實來源；之後任何「卡片的另一種呈現」都要照這條 |
| 漫畫的資料在 pack、版型與道具畫法在引擎，道具與場景是引擎的通用詞彙表 | ADR 0011 的延伸：第二個題庫要能直接用同一套道具 |
| 卡片↔官方題的連結只存在卡片的 `questions`；小遊戲不存檔，複習狀態由作答紀錄導出 | 資料所有權與相容承諾（不新增存檔欄位） |
| （§10-3 同意才開）驗證腳本經 tsx 讀 `src/core/constants`，不再抄一份數字 | 驗證流程的改動 |

## 3. 她怎麼用

1. **進來**：底部「圖卡」分頁。有漫畫的卡在列表上多一格小圖（第一格），科目篩選旁多一顆「漫畫」篩選（列表的改動由 UX 案的 UX3 做，見 §7 檔案歸屬）。更新紀錄會跳出來告訴她。
2. **看一張卡**：點開，最上面是漫畫（格子依序出現），每格一隻小貓、一兩樣道具、一句話。往下是「完整文字」（原本的翻面與法條鈕，原樣）。
3. **練**（漫畫下面三顆鈕）：
   - 「遮起來想」：格子的字（或舉牌的數字）蓋住，看圖回想，點一下揭曉。
   - 「排一排」：格子打散。`story`／`timeline` 排回順序；`versus`／`lineup`／`ladder` 把句子點到對的圖上。用點的，不用拖（拖曳在抽屜裡會和捲動、下拉關閉打架）。
   - 「刷這張卡的題（N 題）」：開一個只出這張卡對應官方題的回合，流程、解析、小魚乾都和平常刷題一樣。
4. **回到刷題**：平常刷題時，解析區的口訣下面出現一顆「圖卡：〈卡片標題〉」小鈕（附第一格小圖），點了在抽屜裡打開那張卡，關掉回到原題。模擬考作答中不顯示，交卷後看答案才有。
5. **間隔複習**：不用另外學。卡片的題答錯，照既有規則 1、3、7 天後在「到期」回合出現；那題的解析又會帶出同一張圖。

## 4. 每張卡用哪種版型（41 張非申論卡）

主席動手時可以換版型，換了更新這張表。順序＝製作優先序。

| 批 | 卡片 | 版型 | 備註 |
| :-- | :-- | :-- | :-- |
| 樣張 | `concept-admin-act` | story | 起承轉合的代表 |
| 樣張 | `concept-remedy-route` | story | 30 日、3 個月、不作為、2 個月。原定 timeline；2×2 排列時箭頭會指到格外、「不作為」被讀成起訴後的一步（Codex 第二輪審圖），改起承轉合 |
| 樣張 | `concept-al-state-comp` | versus | 公務員 vs 公共設施 |
| A | `concept-con-thresholds` | lineup | 數字型樣張，同樣給她看。修憲、罷免、彈劾、解散四格 2×2，每格 `label` 指面標題 |
| A | `concept-al-act-defect` | lineup | 無效、撤銷、廢止三種；3 格在手機一格一列 |
| A | `concept-al-delegation` | lineup | 三個人把公文交給不同對象 |
| A | `concept-central-local` | versus | |
| A | `concept-lg-supervision` | story | |
| A | `concept-lg-council` | story | |
| A | `concept-law-rank` | ladder | 三層樓 |
| B | `concept-period` | story | 原定 timeline；內容是「規則、規則、例外、例外的例外」不是先後步驟，「處罰類例外」正好當「轉」，「對人民有利就用一般」當「合」（CC4b 改） |
| B | `concept-al-principles` | lineup | 五個原則一格一列 |
| B | `concept-con-limit` | lineup | 原定 timeline「三道關卡」；三個條件是同時要過、不是先後，改排排站 2×2：目的、法律、必要＋人身自由的 24 小時（CC4b 改） |
| B | `concept-con-five-yuan` | lineup | 一院一列，舉牌是人數；行政院舉「總統任命」 |
| B | `concept-lg-residents` | story | 卡片沒有陷阱行：「轉」放義務（繳稅） |
| B | `newlaw-lga-55-city` | lineup | 3 人、14 職等、行政院；2×2：市長（備查）、副市長、秘書長、一級主管 |
| B | `newlaw-lga-56-county` | lineup | 和上一張同構圖，方便對照 |
| B | `newlaw-fiscal-8-source` | lineup | 三種稅的標籤用那一行的 `pick`；第四格「不是來源」不舉牌 |
| C | `concept-pa-classic` | lineup | 三位學者 |
| C | `concept-pa-three-new` | lineup | |
| C | `concept-pa-leadership` | timeline | |
| C | `concept-pa-ppp` | versus | BOT vs OT |
| C | `concept-pa-org-design` | versus | |
| C | `newlaw-lga-61-pay` | story | |
| C | `newlaw-lga-57-township` | story | |
| C | `newlaw-lga-33-gender` | lineup | |
| D | `newlaw-lga-83-7-fund` | story | |
| D | `newlaw-fiscal-16-1-split` | lineup | |
| D | `concept-zh-essay-structure` | story | 本來就是起承轉合 |
| D | `concept-zh-official-doc` | ladder | 上行、平行、下行 |
| 加碼 | `concept-al-penalty` | story | 規格沒列的 11 張，從這裡起 |
| 加碼 | `concept-al-discipline` | versus | |
| 加碼 | `concept-pa-motivation` | versus | |
| 加碼 | `concept-pa-policy` | timeline | |
| 加碼 | `concept-pa-budget` | timeline | |
| 加碼 | `concept-pa-evolution` | timeline | |
| 加碼 | `concept-pa-responsibility` | versus | |
| 加碼 | `concept-pa-personnel` | versus | |
| 加碼 | `concept-pa-npo` | story | |
| 加碼 | `concept-pa-participation` | ladder | |
| 加碼 | `concept-zh-reading` | timeline | |

張數核對：樣張 3＋A 7＋B 8＋C 8＋D 4＝30（規格列的全部）；加碼 11；合計 41。版型（CC4b 改完，含樣張 remedy-route 改 story）：story 12、timeline 5、versus 8、ladder 3、lineup 13。

**16 張申論卡排在第三條切線（考後，或 12-01 前 41 張都做完還有時間）**：它們已經是編號骨架加「遮起來背」，最不缺；一張 10–15 行的論述骨架要先決定哪四行當錨點，比觀念卡費工。做的時候版型一律 `story`（申論本來就是起承轉合），順序照 `essay-local-gov.json`、`essay_chinese.json` 的檔案順序（年度新的在前）。要不要整個拿掉見 §10-4。

## 5. 規格每一項的去向

| 規格 | 去向 | 說明／出處 |
| :-- | :-- | :-- |
| 一、可愛溫暖的 2D 風格、粉彩、圓角 | 已有 | `src/theme.css`、`AGENTS.md` §2 介面 |
| 一、每個考點有專屬視覺符號、每張卡至少一張有意義的插畫 | **做** | 漫畫；每張卡至少一樣專屬道具或構圖 |
| 一、不要把 emoji 當插畫 | 做 | 全部 SVG |
| 一、RPG 冒險外殼 | 不做 | App 已有自己的世界（小貓、集章）；再包一層只會多字 |
| 二、五個科目區域、新法專區 | 已有 | 圖卡頁的觀念／新法／申論分類與科目篩選（`CardsScreen.tsx`） |
| 二、錯題收藏 | 已有 | 回合模式 `wrong`（`types.ts:234`） |
| 二、圖像記憶圖鑑 | **做（簡化）** | 就是圖卡列表加小圖與「漫畫」篩選；「收集」＝既有的已看過貓掌 |
| 二、考前總複習 | 對應既有 | 高頻回合、弱點回合（`docs/HANDOFF.md`） |
| 二、模擬考魔王關 | 已有 | 模擬考（`RoundConfig.exam`、`settings.examHistory`） |
| 二、各科進度與答對率 | 對應既有 | 集章頁的弱點考點排行；不另做首頁 |
| 三、A–E 教材重點 | 內容以卡片為準 | 對照表在 `comic-cards-request.md`；規格的數字與條號不當來源 |
| 三、各條的「視覺」描述（皇冠三層階梯、沙漏、三道門…） | 當美術參考 | 是她腦中的畫面，優先採用；和卡片內容衝突時以卡片為準 |
| 三、「待補教材」四項 | 不適用 | 卡片本來就有完整內容 |
| 三、D5 條號寫成第 56 條 | 以卡片為準 | 直轄市第 55 條、縣市第 56 條 |
| 四-1 看圖記憶 | **做** | 漫畫本身＋「遮起來想」 |
| 四-2 圖像配對 | **做** | 「排一排」，由漫畫資料機械產生 |
| 四-3 情境選擇 | **做（用官方題）** | 「刷這張卡的題」；不新寫題（§10-2） |
| 四-4 間隔複習 | 對應既有 | 官方題的到期複習；卡片不另排程 |
| 四、例：BOT／OT 選哪個是民間興建、撤銷／廢止拖到正確處理、訴願期限放上時間軸 | 做（簡化） | 都是「排一排」的特例：句子或數字點到對的格子；用點的不用拖 |
| 五、圖鑑卡版面（上圖、中流程、下短句、可展開全文） | **做** | 漫畫在上、完整文字在下 |
| 五、角落的「容易混淆的考試陷阱」 | 簡化 | `story` 的「轉」格放卡片裡的例外或陷阱行；卡片沒有陷阱行的就沒有。題目層的陷阱提醒已有（`enrich.trap`） |
| 六、答錯：顯示正確圖像、簡短解釋 | **做** | 解析區帶出圖卡（§3-4）；解釋是既有的口訣與逐選項解析 |
| 六、答錯：為什麼容易選錯 | 已有 | `enrich.trap`、逐選項 `why` |
| 六、答錯：立即再出一題類似題 | 不做 | 現有回合沒有這個機制（§11 指令 7 搜過，0 筆）；卡片回合裡下一題本來就是同一張卡的題 |
| 六、答對：經驗值 | 對應既有 | 小魚乾（ADR 0012） |
| 六、答對：收集對應圖鑑 | 對應既有 | 已看過貓掌；另由作答紀錄導出「熟了」記號（5 天版） |
| 六、連續答對獎勵 | 對應既有 | 每日題數關卡、成就 |
| 七、模擬考：正確率、各科弱點、歷次成績 | 已有 | 模擬考結果與歷次成績、弱點排行 |
| 七、最容易混淆的概念 | 不做 | App 沒有這個統計（§11 指令 7 搜過，0 筆），考前不新做 |
| 七、需要重新複習的圖鑑 | 做（5 天版） | 圖卡列表標出「該複習」：連到的題有到期或上次答錯的 |
| 八-1～3 真的能玩、按鈕有效 | 做 | 驗收含實際操作截圖 |
| 八-4 字不可過多 | 做 | 一格一句，且只能出自卡片 |
| 八-5 數字、期限、法條都保留 | 做 | 完整文字原樣留著；`sign` 只能是原文子字串 |
| 八-6～8 不編造、待補、待核對 | 更嚴 | 指標制：機器保證沒有卡片以外的字 |
| 八-9 單一 HTML | 不做 | 做成 App 內的模式（進度、同步、小貓都在 App 裡） |

## 6. 切線

2026-11-27 改：和 `docs/plans/ux-cleanup.md` 合併時程（那份的 §7 是兩案共用的逐日表，以它為準）。動工日從 11-27 變成 11-28、主席每天還要審 UX 包，所以 12-01 的目標從 30 張降到 22 張。

| | 2 天版（11-29 收工） | 全程版（12-01 收工） |
| :-- | :-- | :-- |
| 有漫畫的卡 | **10 張**（樣張 3＋A 批 7） | **22 張**（再加 B 批 8、C 批前 4：三大學派、三個新學派、領導、BOT） |
| 功能 | 漫畫顯示、完整文字保留、遮起來想（第一天就有）、解析區帶出圖卡、刷這張卡的題（限已掛題的卡）、圖卡列表的小圖與「漫畫」篩選（UX3 做） | 同左＋排一排；列表「該複習／熟了」記號（12-01 中午前併得進來才有） |
| 包數 | 3 包（CC1、CC3、CC4a）＋UX 案的 UX3 | 7 包（再加 CC2、CC4b、CC4c、CC7）；CC5 的記號看時間 |
| 申論卡 | 不做 | 不做（第三條切線） |

**第三條切線（考後）**：規格列的剩下 8 張（`concept-pa-org-design`、`newlaw-lga-61-pay`、`newlaw-lga-57-township`、`newlaw-lga-33-gender`、`newlaw-lga-83-7-fund`、`newlaw-fiscal-16-1-split`、`concept-zh-essay-structure`、`concept-zh-official-doc`）、加碼 11 張、16 張申論卡（CC8）、§10-3 的解耦（CC6）、CC5 沒趕上的部分。12-02 起不加功能，所以這條線是考後；做不做由使用者決定（題庫切換 PK3 之後換包，漫畫引擎可以沿用）。12-01 上午若 22 張提早畫完，照上面這 8 張的順序往下畫，畫幾張算幾張。

- **CC1 當天她就用得到**：3 張樣張連同引擎、遮起來想一起上線（本專案驗收過可直接推，`docs/HANDOFF.md`「push 授權」）。
- **2 天版不假設樣張一次過關**。樣張造形被退：停下來要參考圖（§9），主席那天改審 UX 包與 CC3（題目連結對文字卡也有用），張數照退幾天少幾批。
- **速率不夠時的砍法**（11-29 收工實測每天不到 5 張）：先砍 C 批前 4，再砍 B 批的後 4 張（`concept-lg-residents`、兩張首長團隊、`newlaw-fiscal-8-source`）；樣張與 A 批保住。砍了就告訴使用者，不默默縮。
- **動工再晚一天**（11-28 才同意）：停在 14 張左右（樣張 3＋A 批 7＋B 批前 4）。
- 使用者若選「漫畫優先、UX 只做最小」（`ux-cleanup.md` §8-2）：11-29 A 批、11-30 B 批、12-01 整天 C 批 8 張，CC2 回到 11-29；最多約 26 張（3＋7＋8＋8），12-01 沒有收尾的半天。30 張在考前已經做不到。
- 12-01 下午只收尾：不開新卡，做全量驗收與截圖。

## 7. 拆包表

額度現況（`~/.claude/QUOTA.md`，2026-11-26 23:19）：Fable 計量 0%、本週時間進度約 59%、11-29 21:00 重設；Gemini 池充足；Codex 偏低。照憲法「Fable 落後時間進度：Fable 自己做，連可拆的包也優先自己跑」。這裡仍把 CC2、CC3 派出去，理由是**時鐘**不是額度：主席畫圖時它們可以同時進行。Gemini 池偏低就改 Sonnet 子代理，再不行主席自己做。派工前重查額度。

執行代理同時最多兩個（`AGENTS.md` §3），和 UX 案共用這兩席；每天誰占哪一席看 `ux-cleanup.md` §7。

| 包 | 日 | 範圍 | 執行者 | 前置 |
| :-- | :-- | :-- | :-- | :-- |
| CC1 樣張與引擎 | 11-28 | 型別、`constants/comic.ts`、`ComicStrip`、五種版型裡樣張用到的三種、樣張要的道具、`CardDetailSheet` 接上（漫畫在上、文字在下）、**「遮起來想」**（照 `EssayCardBody` 的遮字做法，第一天就能看也能練）、`comics.test.mjs`、`comic-gallery.mts`、3 張樣張資料、更新紀錄一則（寫「試畫 3 張」，被退時拿掉 `comic` 欄位也不會變成假話）、§2.6 前兩份 ADR。**另外匯出給 UX3 用的兩樣東西**：列表小圖元件（`kit/comic/` 裡）、「這張卡有沒有漫畫」的 selector；CC1 自己不改圖卡列表 | 主席（定調＋美術） | §10-1 的預設；UX1a 已併入 |
| CC3 卡片↔題目 | 11-29 | `StudyCard.questions`、`suggest-links.mjs`、`selectors/cardLinks.ts`、`startCardRound`（§2.5，不加 `RoundConfig` 欄位）、解析區的圖卡鈕（`QuestionParts.tsx`，模擬考作答中不顯示）、匯出一顆「刷這張卡的題」按鈕元件（由主席接進抽屜，避免和 CC2 改同一檔）。型別與指令（`types.ts`、`commands.ts`）由主席連同紅色測試先放進 `main`，執行代理不改這兩個檔；主席另審腳本列出的候選、寫 §2.6 第三份 ADR（執行代理不新增 ADR） | agy Neon high（`C:\Git\_wt_civic_comic_links`） | CC1 併入 |
| CC4a 美術 A 批 | 11-29 | A 批 7 張（含數字型樣張與 `ladder`、`lineup` 版型）＋道具；更新紀錄 | 主席 | 樣張過關 |
| CC2 排一排（2026-11-27 改成 `docs/plans/level-mode.md` 的連連看，不另做） | 11-30 | `systems/comicQuiz.ts`（純函式，給種子就固定）＋ `src/ui/components/cards/comic/*` 的排序與配對練習。主席先寫紅色測試 | agy Neon medium（`C:\Git\_wt_civic_comic_quiz`） | CC1 併入 |
| CC4b 美術 B 批 | 11-30（11-27 完成） | 8 張 | 主席 | CC4a |
| CC4c 美術 C 批前 4 | 12-01 上午 | `concept-pa-classic`、`concept-pa-three-new`、`concept-pa-leadership`、`concept-pa-ppp`；這四張的掛題由主席自己挑（行政學沒有法條可比對），來不及就先不掛、沒有「刷題」鈕 | 主席 | CC4b |
| CC5 複習記號 | 12-01 上午 | 「該複習／熟了」：由 `Progress` 導出的 selector＋測試，加一個小元件放進 UX3 在列表上留的位置（不改 `CardsScreen.tsx`、`cards.css` 的版面）。中午前併不進來就留到考後 | agy Neon medium | CC3、UX3 併入 |
| CC7 收尾 | 12-01 下午 | 全量驗收、兩種尺寸×日夜截圖、`docs/HANDOFF.md` 更新（含沒在實機驗到的）；和 UX5 同一個下午一起做 | 主席 | 全部 |
| CC4c 後 4、CC4d、加碼 | 考後 | §6 第三條切線列的 8 張＋加碼 11 張；其餘行政學、國文卡的掛題（Hydrogen 找候選、主席審） | 主席＋agy Hydrogen | 使用者決定 |
| CC6 驗證腳本解耦 | 考後（使用者同意後） | `tools/validate/cards.mjs` 改用 `node --import tsx` 讀 `constants/cards.ts`；證明行為不變：改前改後 `npm run validate` 輸出逐字相同，再故意放一張超長卡確認仍會紅 | agy Hydrogen high | §10-3 同意 |
| CC8 申論卡漫畫 | 考後 | 16 張，版型 `story` | 主席 | 使用者決定要做（§10-4） |

**檔案歸屬**（完整的表在 `ux-cleanup.md` §6）：
- `CardsScreen.tsx`、`CardListItem.tsx`、`cards.css` 歸 UX 案的 UX3，漫畫案的包都不改。列表小圖與「漫畫」篩選（§3-1）由 UX3 做。
- `CardDetailSheet.tsx`、`components/cards/comic/*`、`kit/comic/*`、`styles/comic.css` 歸漫畫案；UX 案考前不動卡片抽屜。
- `types.ts`、`commands.ts`、`changelog.ts` 只由主席改。`App.tsx` 歸 UX1a；CC3 若發現非改不可就停下來回報。

每一包的派工單固定三條：只結束自己啟動的行程；不為了過檢查改造形或改驗收；不新增耦合。CC2、CC3、CC5 的派工單另外寫明：不改 `src/testing/golden/**` 與 `persistenceGolden.test.ts`、不在 `src/` 寫任何科目或考試字樣、不改上面列為別人擁有的檔。

### 驗收指令（每包整合後由主席重跑，逾時照 `AGENTS.md` §5）

```text
npm run lint
npm run validate
npm test
npm run build
npx tsx tools/gallery/comic-gallery.mts .gallery/comic-light.html light
npx tsx tools/gallery/comic-gallery.mts .gallery/comic-dark.html dark
node tools/cards/suggest-links.mjs          （CC3 起）
```

`npm test` 裡要有的檢查（主席先寫成紅色）：
- `comics.test.mjs`：每個指標解析得到；`pick`、`sign` 是該行的子字串；`layout`、`scene`、`props` 都在 `constants/comic.ts` 的清單裡；格數在上下限內；`questions` 的 ID 都在官方層。「每張卡要有自己的畫面」**不寫成測試**（§4 刻意讓直轄市、縣市兩張同構圖，數字型卡共用舉牌；寫成測試會逼人為了過檢查改造形）：改由看圖頁在頁尾列出每樣道具被哪幾張卡用到，主席看圖時判斷。
- `comicQuiz.test.ts`：同一個種子出同一份題；打散後一定和原順序不同；答案由資料算出、不另存。
- `cardLinks.test.ts`：正向與反向互為反函數；卡片沒有 `questions` 時兩邊都是空的；fixture 從正本表產生，不寫死 ID。
- 既有的 `persistenceGolden.test.ts` 不改、照樣綠（證明沒有動存檔格式）。

畫面驗收（動到介面的包）：390×844 與 820×1180、淺色與深色各一張截圖，加實際操作的觀察（`AGENTS.md` §5）；320 寬另看一次四格會不會擠到字換三行。build 前後的 JS 大小記在回報裡（道具是程式碼，會讓包變大）。圖卡頁的高度照 `ux-cleanup.md` §4 的量測片段量，加了小圖之後仍要在那份的目標內。

## 8. 既有耦合（回報，不順手加）

`tools/validate/cards.mjs` 和引擎之間的第二份定義，比派工單列的多：

| 第二份 | 正本 |
| :-- | :-- |
| `LIMIT` 的 `title`、`hook`、`heading`、`line`、`faceLines`、`faces` 六個數字 | `src/core/constants/cards.ts` |
| `LIMIT.visualText: 14` | **沒有正本**：只存在驗證腳本裡，引擎的 `Visual.tsx` 不知道這個數字 |
| `KINDS`（concept／newlaw／essay） | `src/core/types.ts` 的 `CardKind` |
| `TONES`（plain／hot／key） | `src/core/types.ts` 的 `VisualTone` |
| flow 每列 2–5 步、versus 每邊 1–3 點（寫死在判斷式裡） | 沒有具名常數 |

本案不新增任何一處：漫畫沒有自己的字數上限，清單只在 `constants/comic.ts`，驗證用 tsx 直接讀它。既有的這幾處要不要解，見 §10-3 與 CC6。

## 9. 什麼時候停下來問使用者

- **樣張關卡**：CC1 上線後請使用者和她看 3 張樣張（D2 加看數字型那張）。她說可以才量產。
- **造形被退一次就停**：請她或使用者給參考圖（她心裡的四格漫畫長什麼樣、喜歡哪種畫風），拿到再畫，不憑文字猜著重畫。等的時候做 CC3。
- 連續兩張卡的同一種版型被退：先檢討版型本身（是架構問題），不逐張硬修。
- 某張卡怎麼排都要寫卡片沒有的字才講得通：不寫。回報那張卡，提案改卡片內容（改卡要對 `data/laws`），或那張維持文字卡。
- 實作發現一定要新增存檔或同步欄位。
- 道具讓 build 的 JS 大到離線補抓明顯變慢（CC1 量一次基準）。
- 12-01 中午 22 張還沒到：不趕工降品質，照 §6 的砍法收，告訴使用者停在幾張。
- 要用到本檔以外的權限（新依賴、對外連線、改 GitHub Pages）。

## 10. 待使用者決定

每項都有預設；**沒有一項擋住 CC1**（CC1 照預設做，樣張本身就是第 1 項的判斷依據）。

| # | 要決定的事 | 預設（建議） | 另一個選項 |
| :-- | :-- | :-- | :-- |
| 1 | 美術方向 | **小貓劇場**：小貓當演員＋新畫的道具圖示 | 只用道具圖示拼貼、不放角色：估快三成，但畫面沒有「誰在做什麼」，起承轉合會弱 |
| 2 | 情境題要不要鬆綁「不新寫考題」 | **不鬆綁**：只掛官方題。新寫的情境題沒有官方答案背書，考前沒有時間逐題對條文 | 允許主席依卡片內容寫「這是哪一種？」的二選一，標「練習題，非考古題」；只在掛不到官方題的行政學、國文卡使用 |
| 3 | 驗證腳本的字數上限第二份要不要解掉（§8、CC6） | **同意解，排在考後**：它不擋本案，本案也沒有再加一份 | 維持現狀 |
| 4 | 16 張申論卡的漫畫 | **排在第三條切線（考後）**，考前不做（§4 末） | 整個拿掉不做；或她點名哪幾張要先做，插進加碼前面 |
| 5 | 遮起來想、排一排的成績要不要存、要不要同步 | **不存**：零新欄位，不碰她的存檔 | 存「每張卡練過幾次」當成就來源：要新增選填欄位、golden 樣本、取較大值的合併規則，多一包 |
| 6 | 加碼 11 張的順序 | 照 §4（行政法兩張先，其餘行政學，最後閱讀題） | 她點名想先看哪幾張 |
| 7 | 樣張怎麼給她看 | 直接上線到正式站的 3 張卡（退了就拿掉 `comic` 欄位回到文字卡） | 先給截圖，同意才上線：多等一輪 |

## 11. 量測指令（本檔數字的來源）

都在 repo 根目錄跑，唯讀。

1. 每張卡的面數、行數、字數、有沒有圖、法條數（57 張；3–5 面、7–15 行、88–239 字）：
   ```text
   node -e "const fs=require('fs');const d='data/packs/local4-civil/cards/';for(const f of fs.readdirSync(d)){for(const c of JSON.parse(fs.readFileSync(d+f,'utf8')).cards){console.log(c.id,c.kind,c.faces.length,c.faces.reduce((a,x)=>a+x.lines.length,0),c.faces.reduce((a,x)=>a+x.lines.join('').length,0),c.visual?c.visual.kind:'-',c.lawRefs.length)}}"
   ```
2. 「任一選項的 `lawRef` 落在卡片 `lawRefs`」：26 張都有題、共 183／925 題。把指令 3 的 `const a=ans.get(q.id);const o=q.options[a];return o&&o.lawRef&&s.has(key(o.lawRef))` 換成 `return Object.values(q.options).some(o=>o.lawRef&&s.has(key(o.lawRef)))`。
3. 「正解選項的 `lawRef`」：110 題；每張 0–12 題；只有 `concept-law-rank` 是 0：
   ```text
   node -e "const fs=require('fs');const P='data/packs/local4-civil/';const rd=d=>fs.readdirSync(P+d).map(f=>JSON.parse(fs.readFileSync(P+d+'/'+f,'utf8')));const cards=rd('cards').flatMap(j=>j.cards);const ans=new Map(rd('official').flatMap(j=>j.questions||[]).map(q=>[q.id,q.answer]));const qs=rd('enrich').flatMap(j=>j.items);const key=r=>r.law+'#'+r.article;const tot=new Set();for(const c of cards){if(c.kind==='essay'||!c.lawRefs.length)continue;const s=new Set(c.lawRefs.map(key));const hit=qs.filter(q=>{const a=ans.get(q.id);const o=q.options[a];return o&&o.lawRef&&s.has(key(o.lawRef))});hit.forEach(h=>tot.add(h.id));console.log(c.id,hit.length)}console.log('linked',tot.size,'of',qs.length)"
   ```
   CC3 的 `suggest-links.mjs` 要能重現這兩個數字。
4. `.mjs` 經 tsx 讀得到 `.ts` 常數（印出 `tsx-import-ok 30`）：
   ```text
   node --import tsx -e "import('./src/core/constants/cards.ts').then(m=>console.log('tsx-import-ok',m.CARD_LINE_MAX))"
   ```
5. 考點的題數分布（925 題、47 個考點、3–57 題）：
   ```text
   node -e "const fs=require('fs');const d='data/packs/local4-civil/enrich/';const c={};let n=0;for(const f of fs.readdirSync(d))for(const i of JSON.parse(fs.readFileSync(d+f,'utf8')).items){n++;for(const t of i.topic)c[t]=(c[t]||0)+1}console.log(n,Object.keys(c).length,Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e.join(':')).join(' '))"
   ```
6. 沒有 `lawRefs` 的非申論卡 15 張：指令 1 的輸出裡 kind 不是 essay 且最後一欄是 0 的列。
7. 「類似題」「混淆」的既有機制：`grep -rniE "similar|類似題|混淆|confus" src --include=*.ts --include=*.tsx -l`，0 筆。
8. 進行中的回合會存檔、存什麼：`grep -n "normalizeRoundConfig(\|roundToSave" src/systems/persistence.ts`（442、534、578–591 行）與 `src/core/types.ts:262` 的 `RoundState`。
