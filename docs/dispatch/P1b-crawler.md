# 派工單 P1b：考選部試題爬蟲

無人值守。讀完本檔與必讀檔案後直接動手，不要寫計畫、不要等確認。

- **包 ID／開案書章節**：P1b／`docs/plans/civic-bunko.md` §4、§6
- **目標**：把 113–115 年普考與 113–114 年地特四等「一般民政」五科的官方試題、答案、更正答案 PDF 下載到 `data/raw/`，並留下可追溯的清單。這些 PDF 是整個題庫唯一的來源。
- **模型與強度**：`gemini-4-hydrogen-high`。小而具體、規格明確的實作包。
- **工作區**：`C:\Git\_wt_civic_crawler`，分支 `p1b-crawler`。只准改這個資料夾內的檔案。

## 成品

1. `tools/crawler/crawl.mjs`：零依賴的 Node 腳本（只用 Node 內建的 `fetch`、`node:fs`、`node:crypto`、`node:path`）。**不要建立 `package.json`、不要安裝任何套件。**
2. `data/raw/<考試代碼>/<科目key>-<類型>.pdf`，例如 `data/raw/115080/admin-law-Q.pdf`。
3. `data/raw/manifest.json`：

```json
{
  "generatedAt": "ISO 時間",
  "files": [
    {
      "examCode": "115080", "year": 115, "exam": "general",
      "classCode": "402", "classLabel": "普通考試_一般民政",
      "subjectKey": "admin-law", "subjectCode": "0406", "subjectName": "行政法概要",
      "type": "Q",
      "url": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115080&c=402&s=0406&q=1",
      "file": "data/raw/115080/admin-law-Q.pdf",
      "sha256": "…", "bytes": 12345, "downloadedAt": "ISO 時間"
    }
  ]
}
```

## 可修改檔案

- 新增：`tools/crawler/crawl.mjs`、`data/raw/**`
- 其他一律不准改，包含 `tools/crawler/targets.json`、`tools/crawler/verify.mjs`、`docs/**`、`AGENTS.md`。

## 必讀檔案／已確認事實

- `AGENTS.md`、`docs/moex-recon.md`（查詢網址、列表結構、檔案網址規則，全部實測過）
- `tools/crawler/targets.json`（要抓的考試、科目比對規則、請求間隔；從這裡讀設定，不要寫死在程式裡）
- `tools/crawler/verify.mjs`（驗收腳本，讀它就知道及格條件）

## 行為要求

- 每場考試抓一次列表頁（`?y=<y>&e=<code>`），找出等級文字含 `levelIncludes`、類科名稱等於「一般民政」的類科；找到 0 個或超過 1 個就停下回報，不要自己挑。
- 在該類科之下，用科目名稱開頭比對五科；連結去重複；`&amp;` 還原成 `&`。
- 對考選部的每次請求之間至少間隔 `delayMs` 毫秒；依序下載，不平行。帶一般瀏覽器的 `User-Agent`。
- 已存在且 `manifest.json` 裡 sha256 相符的檔案不重新下載。
- 回應不是 PDF（開頭不是 `%PDF-`）或 HTTP 非 200：重試一次，仍失敗就把該檔列在輸出的 `failed` 清單並以非 0 結束，不要寫入假檔案。
- `--dry-run`：只抓列表頁，印出每場考試找到的類科（代碼與標籤）與每科有哪些類型，不下載 PDF、不寫檔。
- 正常執行結束時印出一行摘要：下載幾個、略過幾個、失敗幾個。

## 驗收指令（只能跑這三個；字串照抄，每個單獨一次呼叫，不加 `cd`、不用 `&&` 或 `;` 串接）

```
node tools/crawler/crawl.mjs --dry-run
node tools/crawler/crawl.mjs
node tools/crawler/verify.mjs
```

逾時：dry-run 120 秒、正式下載 600 秒、verify 60 秒。及格：`verify.mjs` 退出碼 0、`ERROR=0`。

## 韁繩

- 驗收腳本與 `targets.json` 不准改；覺得它們有錯就停下回報。
- 不准為了過驗收而寫入假資料、略過檢查、吞掉錯誤。
- 規格矛盾，或同一個驗收指令失敗兩次，就停下回報現況。
- 不准 commit 或做任何 git 操作。

## 什麼時候停下來問

- 列表頁結構和 `docs/moex-recon.md` 寫的不一樣。
- 某場考試找不到「四等／普通考試 × 一般民政」，或五科缺任何一科的試題或答案。
- 考選部回應 403、驗證碼或疑似擋爬。

## 回報格式

照 `AGENTS.md` §6。另外列出：每場考試實際找到的類科代碼與標籤、五科的科目代碼、各有哪些類型（Q/S/M）、三個驗收指令的退出碼與最後一行輸出。
