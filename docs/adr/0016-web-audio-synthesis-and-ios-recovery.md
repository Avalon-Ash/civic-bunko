# 0016 音效採 Web Audio 即時合成並獨立處理系統靜默恢復

狀態：採用
日期：2026-11-18

## 背景

刷題與互動需要短促的回饋音，同時在 iPhone／iPad 切到背景、鎖螢幕或來電後，Safari 的 `AudioContext` 可能進入 `suspended`、`interrupted` 或狀態為 `running` 但 `currentTime` 停住的卡死狀態，導致聲音回不來或在醒來瞬間爆出舊聲音（決定日期依 `docs/HANDOFF.md`「目前狀態」`音效與更新紀錄（2026-11-18）` 與 `docs/reference/README.md` 下載日 2026-11-18）。

## 決定

- 按鈕（`tap`）、答對（`correct`）、答錯（`wrong`）、獎勵（`reward`）以 Web Audio API 即時合成（聲音參數集中於 `src/core/constants/sound.ts`，播放實作於 `src/ui/sound.ts`），不放音檔；點小貓播三段 Mixkit 貓叫錄音（授權記於 `docs/reference/README.md`，打包進 `assets/` 由離線快取收錄並預解碼成 `AudioBuffer`）。
- 建立音訊環境時若瀏覽器支援 `navigator.audioSession`，設為 `'ambient'`，讓 iOS 17+ 跟著硬體靜音鍵且不打斷背景音樂。
- 將音訊生命週期、叫醒與卡死重建抽離為純邏輯介面 `src/ui/soundPlayer.ts`（`SoundContext`、`soundHealth`、`createSoundPlayer`）：每次使用者手勢呼叫 `unlock()` 喚醒非 `running` 狀態；若牆上時間經過 `SOUND_STUCK_MS` 以上但 `currentTime` 未前進，於手勢中關閉舊環境、清空已解碼緩衝並重建；未醒前待播音效超過 `SOUND_LATE_MS` 即丟棄，不於醒來補播舊聲。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 介面音效不增加音檔體積且可離線運作，靜默恢復邏輯不依賴真實瀏覽器音訊硬體即可自動化測試。
- 由 `src/ui/soundPlayer.test.ts` 以假 `SoundContext` 驗證暫停、中斷、卡死重建與過期丟棄。
- 代價是 `audioSession` 僅支援 iOS 17 以上，且 iOS 實機的 `interrupted` 與卡死恢復行為仍須實機驗證。

## 證據

- `docs/HANDOFF.md`「目前狀態」「沒驗到的（要實機）」
- `docs/reference/README.md`「音效素材」
- `src/core/constants/sound.ts`、`src/ui/sound.ts`、`src/ui/soundPlayer.ts`、`src/ui/soundPlayer.test.ts`
