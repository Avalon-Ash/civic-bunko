# CC4a 審圖：7 個新道具與 7 張新漫畫

你是審圖的人，**只讀不改任何檔**。

## 背景
App 的圖卡有「四格漫畫」：小貓當演員，加一兩樣道具和一面舉牌，讓考生看圖就想起考點。格子的字只能取自卡片原文（`docs/plans/comic-cards.md` §2）。角色看毛色和帽子分辨：灰貓戴領帶與單片眼鏡＝機關、橘貓戴毛帽＝人民、銀虎斑戴學士帽＝公務員、暹羅貓戴貝雷帽＝民意代表（立委、議員）、三花貓綁頭巾＝地方政府。

## 要看的圖（用你的看圖工具打開）
- `C:\Git\civic-bunko\.gallery\a-light-0.png`、`a-light-1.png`、`a-light-2.png`：淺色，最上面是全部 19 個道具，下面是 10 張漫畫（左邊一般、右邊「遮起來想」只揭曉第 1 格）。
- `C:\Git\civic-bunko\.gallery\a-dark-0.png`、`a-dark-1.png`、`a-dark-2.png`：同一份深色。

這次新增的是：
- **道具 7 個**：`torn-paper`（撕破的紙）、`eraser`（橡皮擦）、`coins`（一疊硬幣）、`scissors`（剪刀）、`handcuffs`（手銬）、`ballot-box`（投票箱）、`crown`（皇冠）。
- **漫畫 7 張**：
  - `concept-law-rank`：上到下三層樓梯。
  - `concept-central-local`：左右對照。
  - `concept-al-act-defect`、`concept-al-delegation`：排排站，一格一列。
  - `concept-lg-supervision`、`concept-lg-council`：起承轉合。
  - `concept-con-thresholds`：排排站 2×2。

另外 3 張（`concept-admin-act`、`concept-remedy-route`、`concept-al-state-comp`）上一輪已經審過，不用再看。

## 要回答的
1. 新道具在約 40px 大時，**一眼認得出來**是它的名稱嗎？哪個看不出來、會被看成別的東西？
2. 每張新漫畫的每一格，圖和那格的字、舉牌，**意思對得上**嗎？有沒有哪格的圖會讓人記錯（例如動作方向、誰對誰，或道具暗示了相反的意思）？
3. 版面問題，包括深色模式：字被截斷、東西重疊、看不清楚、樓梯或一格一列的排法讀起來的順序不對。

## 回報格式
每個問題一行：`[必改|建議] 卡片 id 或道具 id・第幾格：問題 → 建議怎麼改`。只列你在圖上看到的；沒有問題就寫「沒有」。不要寫稱讚。最後一行寫你打開了哪幾張圖。
