# 0017 天氣天空為同步以外唯一對外連線並限制定位精度與時機

狀態：採用
日期：2026-11-19

## 背景

本專案原則上不加後端且全離線運作，2026-11-19 新增今日頁背景「天氣天空」須即時查詢當地天氣，因此必須界定此唯一非同步對外連線的隱私、定位授權時機、離線降級與干擾隔離規則（決定日期依 `docs/HANDOFF.md`「目前狀態」`天氣天空（2026-11-19）` 與 `docs/reference/README.md` 實測日 2026-11-19）。

## 決定

- 天氣天空（`settings.weather`，預設關閉、只存本機）是 App 除私人 repo 同步以外唯一的對外網路請求，固定查詢 Open-Meteo Forecast API（`WEATHER.endpoint`，免金鑰、非商業免費、CC BY 4.0，畫面標示「天氣資料：Open-Meteo」）。
- 送出的經緯度一律以 `coarseCoord`（`src/systems/weather.ts`）四捨五入到小數 1 位（`WEATHER.coordDigits = 1`，約 11 公里範圍）；座標與查詢結果只存於 `src/ui/useWeather.ts` 記憶體快取，不寫入 `localStorage` 或同步檔。亦提供臺灣各縣市選單（`WEATHER_PLACES`，存於本機選填欄位 `settings.weatherPlace`），選縣市時完全不呼叫定位。
- 觸發瀏覽器定位詢問僅限兩個明確操作時機：當場打開開關、點擊「問天氣／再試一次」；打開 App、定時重問或切回前景時，僅在 `navigator.permissions.query({ name: 'geolocation' })` 回報 `'granted'` 才自動查詢，否則顯示等待狀態。
- 對外天氣請求不列入 `precache.json`，離線或回應格式異常時僅不繪製天空；`src/ui/kit/Sky.tsx` 畫於內容背後，答題與模擬考畫面不畫，且小貓背景配件不隨天氣變動。

## 放棄的做法

原紀錄沒有寫。

## 後果

- 維持無後端、不保存精確住址與不干擾作答的邊界，並可在服務異動或收費時透過替換 `WEATHER.endpoint` 或移除開關隔離影響。
- 由 `src/systems/weather.test.ts` 驗證 WMO 代碼對映、粗略座標截斷與異常回應處理。
- 代價是依賴第三方免費服務可用性，且 iPhone 主畫面 PWA 若未回報 `'granted'` 須由使用者手動點擊「問天氣」。

## 證據

- `docs/HANDOFF.md`「目前狀態」「已知問題」「沒驗到的（要實機）」
- `docs/reference/README.md`「音效素材」
- `src/core/constants/weather.ts`、`src/systems/weather.ts`、`src/systems/weather.test.ts`、`src/ui/useWeather.ts`、`src/ui/kit/Sky.tsx`
