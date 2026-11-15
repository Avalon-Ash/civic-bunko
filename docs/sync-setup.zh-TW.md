# 開啟進度同步（給管理的人）

做一次就好，大約 10 分鐘。做完會得到一串「同步碼」，傳給要刷題的家人，她在 App 裡貼一次就會自動同步。

進度會存在你自己的**私人** GitHub repo 裡，只有拿到同步碼的人讀寫得到。

## 第一步：開一個私人 repo

1. 登入 GitHub，右上角「＋」→ **New repository**。
2. Repository name 填 `civic-bunko-data`（名字可以自己取）。
3. 選 **Private**。
4. 勾選 **Add a README file**（repo 不能是空的）。
5. 按 **Create repository**。

## 第二步：產生只能讀寫這個 repo 的權杖

1. 右上角頭像 → **Settings** → 左側最下面 **Developer settings**。
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
3. Token name 填 `civic-bunko sync`。
4. Expiration 選到考試之後（例如 90 天）。
5. Repository access 選 **Only select repositories**，然後只選 `civic-bunko-data`。
6. Permissions → Repository permissions → **Contents** 改成 **Read and write**。其他都不要動。
7. 按 **Generate token**，把出現的那串 `github_pat_…` 複製起來。這串只會顯示一次。

這個權杖只碰得到那一個私人 repo，就算外流，別人最多只能改進度檔，碰不到你其他的 repo。

## 第三步：在 App 裡產生同步碼

1. 打開 App → **集章** → 最下面 **同步與備份** → 展開 **給管理的人：產生同步碼**。
2. 填入：你的 GitHub 帳號、repo 名稱（`civic-bunko-data`）、剛剛複製的權杖。
3. 按 **產生**，再按 **複製**。
4. 把同步碼用訊息傳給家人。

## 她那邊要做的事

1. 先把 App 加到主畫面，之後都從主畫面的圖示打開。
2. 在訊息裡長按同步碼 → 拷貝。
3. 打開 App → **集章** → **貼上同步碼** → **貼上** → **開始同步**。

iPhone 和 iPad 各做一次。之後每刷完一回合就會自動同步，兩台的進度會合併。

## 常見狀況

- **顯示「同步碼失效或權限不足」**：權杖過期了，或第二步的 Contents 沒有設成 Read and write。重做第二、三步，把新的同步碼再傳一次。
- **想停止同步**：集章 → 停止同步。只會從那台裝置移除同步碼，進度不會刪。
- **想撤銷**：GitHub → Settings → Developer settings → Fine-grained tokens，把那個權杖刪掉，所有裝置的同步立刻失效。
- 同步碼等於鑰匙，只傳給家人，不要貼到公開的地方。
