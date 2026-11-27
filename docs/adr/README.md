# 架構決策紀錄（ADR）

本資料夾放 civic-bunko 的架構級決策，一個決策一個檔：記下限制之後程式怎麼寫的選擇、理由、放棄的做法、後果與出處。動某個結構之前先查這裡；要做的事和「採用」的 ADR 衝突時停下來回報，不直接改。

## 什麼時候寫

符合任一條就新增一份：

1. 會限制之後程式怎麼寫的決策：模組邊界、資料所有權、單一事實來源放哪、資料格式與相容承諾、渲染規則、驗證流程。
2. 寫進開案書（`docs/plans/`）「契約」的架構決策。
3. 推翻或取代既有 ADR。

產品範圍、素材與授權、視覺口味、單次小取捨不寫 ADR，照舊寫在開案書（`docs/plans/`）或 `docs/HANDOFF.md`。

## 編號與檔名

- `NNNN-<英文小寫連字號>.md`，從 `0001` 連續遞增，不跳號、不重複、不重編。
- 每新增一份，在本檔最下面的「索引」加一行：一句話摘要＋相對連結。

## 格式

- 第一行 `# NNNN <繁體中文標題>`（編號與檔名一致）。
- 狀態行只有三種寫法：`狀態：採用`、`狀態：提議`、`狀態：已取代（由 NNNN）`。
- `日期：YYYY-MM-DD`（決定的日期）。只有取代別份時才在下一行寫 `取代：NNNN`。
- 五個章節，標題固定：`## 背景`、`## 決定`、`## 放棄的做法`、`## 後果`、`## 證據`。
- 20～50 行，只寫事實與理由，不寫效果形容詞。
- 查不到的欄位寫「原紀錄沒有寫。」，不補編。
- `## 證據` 只列查得到的出處：repo 內存在的檔案路徑（用反引號包起來，檢查腳本會確認存在）、文件章節、commit SHA。

## 推翻既有決策

不改原檔的決定內容，新開一份並雙向標註：

1. 舊檔狀態行改成 `狀態：已取代（由 <新編號>）`。
2. 新檔在 `日期：` 下一行寫 `取代：<舊編號>`。
3. 兩份都留在本資料夾與索引。

## 檢查

`npm run adr:check`（`tools/adr/check-adr.mjs`，只用 node 內建模組）：編號連續、標題、狀態、日期、五節、取代鏈雙向、索引與資料夾一致、證據路徑存在。腳本不判斷決策內容對不對。

## 範本

```markdown
# NNNN 標題

狀態：採用
日期：YYYY-MM-DD

## 背景

觸發這個決策的問題、限制或量測數據。

## 決定

實際採行的規則、邊界、誰是唯一寫入者、落在哪個檔。

## 放棄的做法

評估過但沒採用的方案與原因；原紀錄沒有記載時寫「原紀錄沒有寫。」。

## 後果

遵守這個決定換來的保證、由什麼檢查守門、付出的代價。

## 證據

- 出處文件、程式路徑、測試檔或 commit SHA。
```

## 索引

- [0001 題庫只來自考選部官方 PDF 流水線](0001-official-pdf-pipeline.md)：官方題庫與更正答案只由本機爬蟲與解析腳本產生，不得手改或由模型補寫，並以 manifest 雜湊與驗證腳本守門。
- [0002 加工層、卡片與中譯與官方層分開存放](0002-derived-layers-separate-from-official.md)：AI 加工、圖卡、申論卡與英文中譯各自獨立存放並以 ID 對應，不寫回官方試卷，字數上限與拼回原文由驗證腳本守門。
- [0003 解析與卡片引用法條須對應本機法規副本](0003-local-law-copies-for-citations.md)：解析與卡片引用的法規名稱及條號必須能在共用本機法規副本查到，查不到則記為 `lawRef: null`。
- [0004 題目與各項識別碼產生後不重編、不改名](0004-stable-ids-never-renumbered.md)：題目、試卷、卡片、衣櫥配件、成就、任務、科目、燒焦卡片、縣市與更新紀錄 ID 產生後維持不變，且內容 ID 跨包唯一。
- [0005 App 採用 ECS 與 SSOT 單向資料流架構](0005-ecs-ssot-architecture.md)：型別、常數與主題樣式集中定義，Component 純資料、System 純函式單一擁有狀態、畫面經 selectors 讀與 commands 寫。
- [0006 禁用瀏覽器原生彈窗與 as any，介面用自製元件與純 CSS](0006-no-browser-popups-and-minimal-ui-stack.md)：禁用瀏覽器原生彈窗、`target="_blank"` 與 `as any`，執行期只依賴 React，抽屜、提示與動態效果皆自製並以純 CSS 實作。
- [0007 題庫採扁平資料目錄並由 banks.json 登記](0007-flat-data-dir-and-banks-manifest.md)：（已取代，由 0011）初期將官方與加工等資料依類型扁平置於 `data/` 並由 `data/banks.json` 登記。
- [0008 跨裝置進度同步採私人 GitHub repo 與同步碼](0008-private-repo-sync-with-sync-code.md)：不建自營後端，透過單一 repo 讀寫權限的 Fine-grained PAT 組裝為 `cb1.` 同步碼，讀寫使用者私人 GitHub repo 的 `progress.json`。
- [0009 離線快取採自寫 Service Worker 搭配 precache.json 清單](0009-offline-precache-manifest.md)：以自寫 `public/sw.js` 搭配打包產生的 `precache.json`，在版本一致且全部補抓成功後才清除舊版資產快取。
- [0010 使用者存檔與同步檔只增選填欄位並由固定樣本守門](0010-additive-save-format-and-golden-gate.md)：凍結儲存鍵與版本號，存檔與同步檔只允許往上加選填欄位、壞子欄位單獨丟棄，並以固定樣本與雜湊斷言守門。
- [0011 題庫拆分為內容包並以引擎邊界腳本守門](0011-content-packs-and-engine-boundary.md)：（取代 0007）將各題庫封裝為 `data/packs/<packId>/`，由 `source.ts` 與 `tools/paths.mjs` 統一取得路徑，並以 lint 腳本禁止引擎出現包字面值。
- [0012 小魚乾不存餘額，由單調遞增來源即時計算](0012-derived-fish-balance.md)：不儲存小魚乾餘額，一律由只增不減的題數、關卡、成就、任務與扣除特價省下、燒焦修復的支出重算，已發佈價格不調高。
- [0013 跨裝置同步採可交換合併規則與單一值改動時間戳](0013-commutative-sync-merge-rules.md)：（已取代，由 0018）同步合併採取聯集、較大值或確定性時間戳比較而與順序無關，單一值設定連同最後改動時間成包比較。
- [0014 小貓說話採台詞、判斷與介面三層解耦](0014-cat-voice-three-layer-decoupling.md)：將角色台詞包、處境條件判斷函式與 `CatVoice` 注入介面分離，記憶只存於記憶體且台詞不得含內容包或法條內容。
- [0015 小貓紙娃娃部位分層、姿勢對位表與幾何測試守門](0015-paper-doll-pose-table-rendering.md)：小貓配件依部位深度疊圖、全身姿勢與頭背對位點集中於純資料表，正面姿勢另有背飾圖並以幾何測試檢查座標與鏡像。
- [0016 音效採 Web Audio 即時合成並獨立處理系統靜默恢復](0016-web-audio-synthesis-and-ios-recovery.md)：介面回饋音以 Web Audio 即時合成、貓叫採預載音檔並設為 ambient，且將環境喚醒與卡死重建抽離為可測試的純邏輯介面。
- [0017 天氣天空為同步以外唯一對外連線並限制定位精度與時機](0017-weather-sky-sole-non-sync-external-call.md)：僅對 Open-Meteo 發出非同步對外連線，座標四捨五入至小數一位且不寫入存檔，並限制僅於明確操作或已授權時定位。
- [0018 多隻小貓沿用舊欄位存原本那隻，長相改為帶改動時間跨裝置同步](0018-multi-cat-house-and-synced-looks.md)：（取代 0013）保留 0013 的合併規則，原本那隻留在舊欄位、領養的以固定編號存在選填欄位，名字與長相逐隻比改動時間同步，帶出門與陪我刷題只存本機。
- [0019 引導的目的地只定義在任務表與 guide.ts，畫面只經 go() 換頁與落點](0019-guide-targets-single-go.md)：任務的目的地寫在 `Quest.go`，其他目的地與落點清單在 `constants/guide.ts`，畫面用 `guideAnchor` 標落點、只經 `go()` 換頁；有回合進行時只回到那一題。
- [0020 漫畫是卡片的選填衍生層，格子文字只用指標指向卡片原文](0020-comic-derived-layer-text-pointers.md)：`StudyCard.comic` 選填，格子的字、舉牌、欄標題都是指向 `hook`／`faces` 的指標，由 `systems/comic.ts` 解析與檢查，漫畫不可能出現卡片沒有的字。
- [0021 漫畫的資料在 pack、版型與道具畫法在引擎，道具與角色是引擎的通用詞彙表](0021-comic-vocabulary-in-engine.md)：版型、構圖、道具、角色只列在 `constants/comic.ts`，畫法在 `ui/kit/comic/`，演員沿用小貓，卡片只引用詞彙表的 ID。
- [0022 卡片↔官方題的連結只存在卡片的 questions；卡片回合不存卡片、複習狀態由作答紀錄導出](0022-card-question-links.md)：`StudyCard.questions` 是唯一正本，查詢只經 `cardLinks`；`startCardRound` 不在 `RoundConfig` 加欄位，零新存檔欄位。
- [0023 圖卡闖關：配對完成存進選填的 settings.cardsMatched，三顆星只在一處導出](0023-card-levels-match-saved.md)：（部分取代 0022）配對全對過的卡片 ID 存選填欄位、同步取聯集；看過、配對、實戰三顆星只在 `systems/cardStars.ts` 導出；連連看由漫畫資料機械產生，實戰只用官方題。
