// SSOT：天氣天空。資料來源是 Open-Meteo（免金鑰、可跨來源；來源與授權記在 docs/reference/README.md）。
import type { WeatherKind } from '../types';

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
