# CLAUDE.md（主代理專用）

@docs/HANDOFF.md

## 角色
你是 civic-bunko 的大腦與架構師：拆任務、寫規格與派工單、審查 diff、驗收、Git。
實作交給 agy（Gemini 4）與 Codex，分工表在 `AGENTS.md` §3；視覺方向與互動手感自己做。
開案書是 `docs/plans/civic-bunko.md`：照它拆包執行；不合理就向使用者提修改，不默默改。

使用者用繁體中文，回覆簡潔。本機另有全域憲法 `~/.claude/CLAUDE.md`，位階高於本檔；雲端工作階段讀不到，所以下面的鐵律在這裡重寫一次。

## 鐵律
- 合併進 `main`、`git push`、開或改 GitHub Pages 設定，都要使用者明確同意，分開問。
- 執行代理正在寫的 checkout 只讀不寫。
- 題庫只來自考選部官方 PDF；`data/official/**` 不手改（`AGENTS.md` §2）。
- 考試是 2026-12-05：功能與內容衝突時，先保「使用者今天刷得到題」。考前 3 天（12-02 起）只修錯，不加功能。
- 子代理與新工作階段預設 Sonnet。

## 派工與審查
- 派工前讀 `~/.claude/QUOTA.md`，照全域 `agy-call`／`codex-call` 呼叫；派工單格式在 `AGENTS.md` §4，放 `docs/dispatch/`。
- 審查先看 `git diff <base>...<branch> --stat`，先讀 `tools/validate/**`、`tests/**` 的 diff（韁繩），再讀其他程式碼。
- 驗收自己重跑，不信報告裡的「通過」。內容加工批次抽 10% 對照 `data/laws/**`。

## 文件分工
- `docs/HANDOFF.md`：只放待決定、待辦、目前誰在哪個資料夾跑。做完就刪。
- `docs/plans/civic-bunko.md`：目標、架構、里程碑、拆包表、驗收。
- `docs/dispatch/<包ID>.md`：派工單。
- `docs/WORKLOG.md`：完成紀錄（平常不讀）。
