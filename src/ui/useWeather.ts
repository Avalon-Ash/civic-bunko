import { useEffect, useState } from 'react';
import { WEATHER } from '../core/constants/weather';
import type { Weather } from '../core/types';
import { parseWeather, weatherUrl } from '../systems/weather';

/** 問到了沒：idle＝還沒問或關著、asking＝正在問、ok＝有天氣、denied＝她沒給定位、failed＝連不上或定位失敗 */
export type WeatherStatus = 'idle' | 'asking' | 'ok' | 'denied' | 'failed';
export interface WeatherView {
  status: WeatherStatus;
  weather: Weather | null;
}

/** 這次開著 App 期間問到的天氣（只放記憶體：座標和結果都不存檔） */
let cache: { at: number; weather: Weather } | null = null;

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('no geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: WEATHER.locateMs,
      maximumAge: WEATHER.refreshMs,
    });
  });
}

async function ask(): Promise<Weather | null> {
  const position = await locate();
  const url = weatherUrl(position.coords.latitude, position.coords.longitude);
  if (!url) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(WEATHER.fetchMs) });
  if (!response.ok) return null;
  return parseWeather(await response.json());
}

/**
 * 現在的天氣（on＝她打開了天氣天空）：打開時問一次定位（瀏覽器會問她同不同意），把粗略座標送去問天氣，
 * 之後每 WEATHER.refreshMs 重問。沒同意、離線、服務掛了都只是沒有天氣（頁面照常）。
 */
export function useWeather(on: boolean): WeatherView {
  const [view, setView] = useState<WeatherView>(() =>
    on && cache ? { status: 'ok', weather: cache.weather } : { status: 'idle', weather: null },
  );

  useEffect(() => {
    if (!on) {
      setView({ status: 'idle', weather: null });
      return undefined;
    }
    let alive = true;
    const run = () => {
      if (cache && Date.now() - cache.at < WEATHER.refreshMs) {
        setView({ status: 'ok', weather: cache.weather });
        return;
      }
      setView((prev) => ({ status: 'asking', weather: prev.weather }));
      ask().then(
        (weather) => {
          if (weather) cache = { at: Date.now(), weather };
          if (alive) setView(weather ? { status: 'ok', weather } : { status: 'failed', weather: null });
        },
        (error: unknown) => {
          // GeolocationPositionError.PERMISSION_DENIED 是 1
          const denied = typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 1;
          if (alive) setView({ status: denied ? 'denied' : 'failed', weather: null });
        },
      );
    };
    run();
    const timer = window.setInterval(run, WEATHER.refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [on]);

  return view;
}
