// 天氣天空：不碰網路與定位的計算（組網址、讀回應）。定位和連線在 ui/useWeather.ts。
import { WEATHER, WEATHER_CODE_KINDS } from '../core/constants/weather';
import type { Weather, WeatherKind } from '../core/types';

/** WMO 天氣代碼歸哪一種天空；不是合理的代碼回 null */
export function weatherKind(code: unknown): WeatherKind | null {
  if (typeof code !== 'number' || !Number.isFinite(code) || code < 0) return null;
  return WEATHER_CODE_KINDS.find((row) => code <= row.upTo)?.kind ?? null;
}

/** 座標四捨五入到 WEATHER.coordDigits 位（送出去的只有這個粗略值） */
export function coarseCoord(value: number): number {
  const k = 10 ** WEATHER.coordDigits;
  return Math.round(value * k) / k;
}

/** 查現在天氣的網址（座標先取粗略值）；座標不合理回 null */
export function weatherUrl(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const query = new URLSearchParams({
    latitude: String(coarseCoord(latitude)),
    longitude: String(coarseCoord(longitude)),
    current: 'weather_code,is_day',
  });
  return `${WEATHER.endpoint}?${query.toString()}`;
}

/** 讀天氣服務的回應；格式不對回 null（畫面就不畫天氣） */
export function parseWeather(body: unknown): Weather | null {
  if (typeof body !== 'object' || body === null) return null;
  const current = (body as { current?: unknown }).current;
  if (typeof current !== 'object' || current === null) return null;
  const { weather_code: code, is_day: isDay } = current as { weather_code?: unknown; is_day?: unknown };
  const kind = weatherKind(code);
  return kind ? { kind, day: isDay !== 0 } : null;
}
