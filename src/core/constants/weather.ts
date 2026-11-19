// SSOT：天氣天空。資料來源是 Open-Meteo（免金鑰、可跨來源；來源與授權記在 docs/reference/README.md）。
import type { WeatherKind, WeatherPlace } from '../types';

/**
 * endpoint＝查現在天氣的網址；coordDigits＝座標送出去之前四捨五入到小數幾位（1 位約 11 公里：夠知道天氣，不會暴露住址）；
 * refreshMs＝多久重查一次；locateMs＝等定位最多等多久；fetchMs＝等天氣服務最多等多久
 */
export const WEATHER = {
  endpoint: 'https://api.open-meteo.com/v1/forecast',
  coordDigits: 1,
  refreshMs: 3_600_000,
  locateMs: 10_000,
  fetchMs: 8_000,
} as const;

/**
 * WMO 天氣代碼 → 天空畫哪一種：代碼小於等於 upTo 的歸這一種（由小到大排）。
 * 0–1 晴、2–48 多雲（含陰、霧）、51 以上都是有降水（毛毛雨、雨、雪、陣雨、雷雨）
 */
export const WEATHER_CODE_KINDS: ReadonlyArray<{ upTo: number; kind: WeatherKind }> = [
  { upTo: 1, kind: 'clear' },
  { upTo: 48, kind: 'cloudy' },
  { upTo: 99, kind: 'rain' },
];

/** 畫面上怎麼稱呼（day＝白天） */
export const WEATHER_LABEL: Readonly<Record<WeatherKind, string>> = { clear: '晴', cloudy: '多雲', rain: '下雨' };

/**
 * 不想用定位（或定位開不起來）時可以直接選的地點：臺灣各縣市，座標取縣市政府所在地的小數 1 位。
 * id 存在設定裡（settings.weatherPlace），定了不改。
 */
export const WEATHER_PLACES: readonly WeatherPlace[] = [
  { id: 'keelung', name: '基隆市', latitude: 25.1, longitude: 121.7 },
  { id: 'taipei', name: '臺北市', latitude: 25.0, longitude: 121.6 },
  { id: 'new-taipei', name: '新北市', latitude: 25.0, longitude: 121.5 },
  { id: 'taoyuan', name: '桃園市', latitude: 25.0, longitude: 121.3 },
  { id: 'hsinchu-city', name: '新竹市', latitude: 24.8, longitude: 121.0 },
  { id: 'hsinchu', name: '新竹縣', latitude: 24.8, longitude: 121.0 },
  { id: 'miaoli', name: '苗栗縣', latitude: 24.6, longitude: 120.8 },
  { id: 'taichung', name: '臺中市', latitude: 24.2, longitude: 120.7 },
  { id: 'changhua', name: '彰化縣', latitude: 24.1, longitude: 120.5 },
  { id: 'nantou', name: '南投縣', latitude: 23.9, longitude: 120.7 },
  { id: 'yunlin', name: '雲林縣', latitude: 23.7, longitude: 120.5 },
  { id: 'chiayi-city', name: '嘉義市', latitude: 23.5, longitude: 120.4 },
  { id: 'chiayi', name: '嘉義縣', latitude: 23.5, longitude: 120.3 },
  { id: 'tainan', name: '臺南市', latitude: 23.0, longitude: 120.2 },
  { id: 'kaohsiung', name: '高雄市', latitude: 22.6, longitude: 120.3 },
  { id: 'pingtung', name: '屏東縣', latitude: 22.7, longitude: 120.5 },
  { id: 'yilan', name: '宜蘭縣', latitude: 24.8, longitude: 121.8 },
  { id: 'hualien', name: '花蓮縣', latitude: 24.0, longitude: 121.6 },
  { id: 'taitung', name: '臺東縣', latitude: 22.8, longitude: 121.1 },
  { id: 'penghu', name: '澎湖縣', latitude: 23.6, longitude: 119.6 },
  { id: 'kinmen', name: '金門縣', latitude: 24.4, longitude: 118.3 },
  { id: 'lienchiang', name: '連江縣', latitude: 26.2, longitude: 119.9 },
];
