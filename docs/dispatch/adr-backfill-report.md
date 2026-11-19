# ADR 回填報告（adr-backfill）

- 包 ID：`adr-backfill`
- 分支：`docs/adr-backfill`（工作區 `C:\Git\_wt_adr_civic`）
- 報告日期：2026-11-20

## ADR 清單

| 編號 | 標題 | 狀態 | 日期 | 出處文件與章節 |
| :-- | :-- | :-- | :-- | :-- |
| `0001` | [題庫只來自考選部官方 PDF 流水線](../adr/0001-official-pdf-pipeline.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「題庫」、§5；`CLAUDE.md`「鐵律」；`docs/plans/civic-bunko.md` §4、§8；`docs/moex-recon.md` |
| `0002` | [加工層、卡片與中譯與官方層分開存放](../adr/0002-derived-layers-separate-from-official.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「加工層」；`docs/plans/civic-bunko.md` §4、§9；`docs/HANDOFF.md`「內容品質紀錄」 |
| `0003` | [解析與卡片引用法條須對應本機法規副本](../adr/0003-local-law-copies-for-citations.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「加工層」「架構」；`docs/plans/civic-bunko.md` §4；`docs/plans/content-packs.md` §2 |
| `0004` | [題目與各項識別碼產生後不重編、不改名](../adr/0004-stable-ids-never-renumbered.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「題庫」「使用者資料」；`docs/plans/content-packs.md` §2；`docs/plans/cat-wardrobe.md` §2、§3.7 |
| `0005` | [App 採用 ECS 與 SSOT 單向資料流架構](../adr/0005-ecs-ssot-architecture.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「架構（ECS＋SSOT）」「介面」；`docs/plans/civic-bunko.md` §4「App 架構：ECS＋SSOT」、§9 |
| `0006` | [禁用瀏覽器原生彈窗與 as any，介面用自製元件與純 CSS](../adr/0006-no-browser-popups-and-minimal-ui-stack.md) | 採用 | 2026-11-15 | `AGENTS.md` §2「架構（ECS＋SSOT）」「介面」；`docs/plans/civic-bunko.md` §3、§4、§9；`tools/lint/no-popups.mjs` |
| `0007` | [題庫採扁平資料目錄並由 banks.json 登記](../adr/0007-flat-data-dir-and-banks-manifest.md) | 已取代（由 0011） | 2026-11-15 | `docs/plans/civic-bunko.md` §4、§9「程式結構補充」；`docs/plans/content-packs.md` §2、§3 |
| `0008` | [跨裝置進度同步採私人 GitHub repo 與同步碼](../adr/0008-private-repo-sync-with-sync-code.md) | 採用 | 2026-11-16 | `AGENTS.md` §2「介面」；`docs/HANDOFF.md`「目前狀態」「使用者已決定」；`docs/plans/civic-bunko.md` §4、§9；`docs/sync-setup.zh-TW.md` |
| `0009` | [離線快取採自寫 Service Worker 搭配 precache.json 清單](../adr/0009-offline-precache-manifest.md) | 採用 | 2026-11-16 | `docs/plans/civic-bunko.md` §4、§9「已上線」；`docs/HANDOFF.md`「目前狀態」；`vite.config.ts`、`src/data/offline.ts` |
| `0010` | [使用者存檔與同步檔只增選填欄位並由固定樣本守門](../adr/0010-additive-save-format-and-golden-gate.md) | 採用 | 2026-11-17 | `AGENTS.md` §2「使用者資料」；`docs/HANDOFF.md`「使用者已決定」；`docs/plans/cat-wardrobe.md` §2、§5；`src/systems/persistenceGolden.test.ts` |
| `0011` | [題庫拆分為內容包並以引擎邊界腳本守門](../adr/0011-content-packs-and-engine-boundary.md) | 採用（取代 0007） | 2026-11-17 | `AGENTS.md` §2「架構」；`docs/HANDOFF.md`「使用者已決定」；`docs/plans/content-packs.md` §§1–4；`tools/lint/engine-boundary.mjs` |
| `0012` | [小魚乾不存餘額，由單調遞增來源即時計算](../adr/0012-derived-fish-balance.md) | 採用 | 2026-11-17 | `docs/plans/cat-wardrobe.md` §2、§3.2、§3.3、§3.6、§3.7；`src/core/constants/wardrobe.ts`、`src/systems/wardrobe.ts` |
| `0013` | [跨裝置同步採可交換合併規則與單一值改動時間戳](../adr/0013-commutative-sync-merge-rules.md) | 採用 | 2026-11-18 | `AGENTS.md` §2「使用者資料」；`docs/HANDOFF.md`；`docs/plans/cat-wardrobe.md` §3.5、§3.6、§3.7、§7.5；`src/systems/syncMerge.ts` |
| `0014` | [小貓說話採台詞、判斷與介面三層解耦](../adr/0014-cat-voice-three-layer-decoupling.md) | 採用 | 2026-11-18 | `docs/plans/cat-wardrobe.md` §7.5；`docs/HANDOFF.md`；`src/core/constants/catLines.ts`、`src/systems/catBrain.ts`、`src/ui/pet/CatVoiceProvider.tsx` |
| `0015` | [小貓紙娃娃部位分層、姿勢對位表與幾何測試守門](../adr/0015-paper-doll-pose-table-rendering.md) | 採用 | 2026-11-18 | `docs/plans/cat-wardrobe.md` §3.1、§3.7、§7.2；`docs/HANDOFF.md`；`src/core/constants/pet.ts`、`src/ui/kit/catBody.test.ts` |
| `0016` | [音效採 Web Audio 即時合成並獨立處理系統靜默恢復](../adr/0016-web-audio-synthesis-and-ios-recovery.md) | 採用 | 2026-11-18 | `docs/HANDOFF.md`「目前狀態」「沒驗到的」；`docs/reference/README.md`「音效素材」；`src/ui/soundPlayer.ts`、`src/ui/sound.ts` |
| `0017` | [天氣天空為同步以外唯一對外連線並限制定位精度與時機](../adr/0017-weather-sky-sole-non-sync-external-call.md) | 採用 | 2026-11-19 | `docs/HANDOFF.md`「目前狀態」「已知問題」；`docs/reference/README.md`「音效素材」；`src/core/constants/weather.ts`、`src/systems/weather.ts`、`src/ui/useWeather.ts` |

備註：上述 0007 與 0011 依派工單指示拆成取代鏈（原開案書初期採扁平資料目錄與 `data/banks.json`，2026-11-17 改為 `data/packs/*` 內容包）；0010 與 0013 分拆因前者約束靜態存檔與同步檔結構相容（只增選填欄位、固定樣本守門），後者約束多裝置合併演算法（可交換運算與 `CatProfile` 時間戳規則）。

## 考慮過但沒寫成 ADR 的候選與理由

1. **考試與科目收錄範圍（113–115 普考、113–114 地特四等一般民政五科，排除初等考與其他類科）、作文改骨架卡、不做考前自動衝刺模式**：屬產品範圍取捨，依 `docs/adr/README.md` 與派工單不寫 ADR。
2. **小魚乾具體數值與 2026-11-18 獎勵加碼、溢出靠新衣服消耗不調價**：屬價格與數值調整，留存於 `docs/plans/cat-wardrobe.md` §3.2 與 `tools/economy/fish-economy.mts`；其中不改高舊價、不調低舊獎勵與即時重算餘額的結構約束已納入 `0012`。
3. **角色原創畫風、正面坐構圖、表情符號泡泡（`Emote.tsx`）與卡通化優先於結構正確**：屬視覺方向、角色美術口味與單次元件設計，留存於 `AGENTS.md` §2 與 `docs/plans/cat-wardrobe.md` §7.2。
4. **加工批次抽查 10–20%、全量交叉檢查、圖卡來源核對與英文翻譯不另找校對**：屬內容品質紀錄與審查作業結果，留存於 `docs/HANDOFF.md` 與 `docs/reference/README.md`。
5. **選項打亂維持官方 A–D、作答前可看選項中文、答題頁放小貓與想太久提示、娃娃裝個別互動玩法**：屬單一功能產品規則，依既有常數對照表與 System 實作，未建立新的跨模組架構邊界。
6. **題型擴充三件套（`Record<QuestionKind, KindDef>`、handler 表、棘輪測試，`docs/plans/content-packs.md` §6）**：原文件明確註記待第二種題型到位後再開，屬於尚未採行的預備方案而非已做過之決策。
7. **Push 授權、外派池額度換池規則、12-02 起凍結新功能**：屬團隊協作邊界與時程控管，留存於 `AGENTS.md`、`CLAUDE.md` 與 `docs/HANDOFF.md`。
8. **舊欄位 `settings.accessory` 凍結不收新配件、英文中譯原始碼與組裝工具分離（`tools/zh/build.mjs`）**：兩者皆有實質限制，分別為 `0010`（存檔格式向後相容）與 `0002`（官方層與衍生層分離）的直接組成，合併寫入該兩份 ADR 以免一個決定分散多檔。

## 寫了「原紀錄沒有寫。」的欄位清單

- **全欄只寫「原紀錄沒有寫。」（8 份）**：`0001`、`0002`、`0003`、`0004`、`0005`、`0007`、`0016`、`0017` 的 `## 放棄的做法`。
- **部分記載既有排除項目並註明「原紀錄沒有寫。」（5 份）**：
  - `0006` `## 放棄的做法`：註明沒採用 Tailwind、motion 等套件與瀏覽器彈窗／另開分頁，但放棄細節與其他候選比較「原紀錄沒有寫。」。
  - `0008` `## 放棄的做法`：註明排除自建後端、帳號系統與追蹤碼，但其他雲端儲存方案的評估比較「原紀錄沒有寫。」。
  - `0009` `## 放棄的做法`：註明沒有使用 `vite-plugin-pwa`，但放棄理由與其他離線方案評估「原紀錄沒有寫。」。
  - `0010` `## 放棄的做法`：註明放棄沿用 `settings.accessory` 存新配件的原因，但其他存檔格式替代方案「原紀錄沒有寫。」。
  - `0011` `## 放棄的做法`：註明執行時下載題庫（DLC）不在範圍，但其餘方案「原紀錄沒有寫。」。

## 執行的指令與退出碼

1. `node tools/adr/check-adr.mjs --min 8`（開工前確認紅燈：0 份 ADR）→ 退出碼 `1`
2. `git status`（開工前確認工作區乾淨）→ 退出碼 `0`
3. `node tools/adr/check-adr.mjs --min 8`（建立 17 份 ADR 並更新索引後）→ 退出碼 `0`（輸出：`ADR 檢查通過：17 份，索引 docs/adr/README.md`）
4. `git status`（檢查異動與未追蹤檔案清單）→ 退出碼 `0`
5. `git diff --stat`（確認已追蹤檔僅修改 `docs/adr/README.md`：`1 file changed, 17 insertions(+), 1 deletion(-)`）→ 退出碼 `0`
6. `git status`（寫入報告後確認全數異動與未追蹤檔案僅在允許清單內）→ 退出碼 `0`
7. `node tools/adr/check-adr.mjs --min 8`（完稿交付前最終驗證）→ 退出碼 `0`（輸出：`ADR 檢查通過：17 份，索引 docs/adr/README.md`）

## 回退方式

本批沒有修改任何程式碼、資料檔、測試或驗證腳本。若主代理要放棄本批回填結果，於 `C:\Git\_wt_adr_civic` 執行以下復原即可：
1. 刪除未追蹤的新檔 `docs/adr/0001-*.md` 至 `docs/adr/0017-*.md` 與 `docs/dispatch/adr-backfill-report.md`。
2. 還原 `docs/adr/README.md` 的「索引」節為原本的 `（還沒有 ADR。）`。
