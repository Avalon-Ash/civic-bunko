import { useEffect, useRef, useState } from 'react';
import { WEATHER } from '../core/constants/weather';
import type { Weather } from '../core/types';
import { parseWeather, weatherUrl } from '../systems/weather';

/**
 * 問到了沒：idle＝還沒問或關著、asking＝正在問、ok＝有天氣、denied＝她沒給定位、failed＝連不上或定位失敗、
 * waiting＝開著，但這台裝置沒有「已允許定位」的紀錄，等她點一下才問（不在打開 App 時自己跳出定位詢問）
 */
export type WeatherStatus = 'idle' | 'asking' | 'ok' | 'denied' | 'failed' | 'waiting';
export interface WeatherView {
  status: WeatherStatus;
  weather: Weather | null;
  /** 她點了「問天氣」：現在問一次（會跳出定位詢問） */
  refresh: () => void;
}

/** 這台裝置是不是已經允許過定位（查不到就當作沒有） */
async function locationGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    return status?.state === 'granted';
  } catch {
    return false;
  }
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
 * 現在的天氣（on＝她打開了天氣天空）：把粗略座標送去問天氣，之後每 WEATHER.refreshMs 重問。
 * 會跳出定位詢問的時機只有兩個：她當場把開關打開、她點「問天氣」。打開 App 時（開關本來就開著）和定時重問，
 * 只有在這台裝置已經允許過定位時才自己問，不然等她點（status＝waiting）。
 * 沒同意、離線、服務掛了都只是沒有天氣（頁面照常）。
 */
export function useWeather(on: boolean): WeatherView {
  type Shown = Pick<WeatherView, 'status' | 'weather'>;
  const [view, setView] = useState<Shown>(() =>
    on && cache ? { status: 'ok', weather: cache.weather } : { status: 'idle', weather: null },
  );
  /** 上一次的 on：從關變成開＝她當場打開的；一開始就是開的＝打開 App 時（null＝還沒跑過） */
  const prevOn = useRef<boolean | null>(null);
  const askNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    const toggledOn = prevOn.current === false && on;
    prevOn.current = on;
    if (!on) {
      askNow.current = () => undefined;
      setView({ status: 'idle', weather: null });
      return undefined;
    }
    let alive = true;
    const go = () => {
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
    /** byUser＝她剛點的（可以跳定位詢問）；不是的話要先確認已經允許過 */
    const run = (byUser: boolean) => {
      if (cache && Date.now() - cache.at < WEATHER.refreshMs) {
        setView({ status: 'ok', weather: cache.weather });
        return;
      }
      if (byUser) {
        go();
        return;
      }
      void locationGranted().then((granted) => {
        if (!alive) return;
        if (granted) go();
        else setView((prev) => (prev.weather ? prev : { status: 'waiting', weather: null }));
      });
    };
    askNow.current = () => run(true);
    run(toggledOn);
    const timer = window.setInterval(() => run(false), WEATHER.refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [on]);

  return { ...view, refresh: () => askNow.current() };
}
