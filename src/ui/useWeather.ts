import { useEffect, useRef, useState } from 'react';
import { WEATHER } from '../core/constants/weather';
import type { Weather, WeatherPlace } from '../core/types';
import { parseWeather, weatherUrl } from '../systems/weather';

/**
 * 問到了沒：idle＝還沒問或關著、asking＝正在問、ok＝有天氣、
 * denied＝定位被擋（她沒同意，或手機／電腦的定位服務關著：這時瀏覽器不會跳詢問）、
 * nofix＝定位開著但抓不到位置或等太久、unsupported＝這個瀏覽器沒有定位功能、
 * offline＝位置有了但問不到天氣（沒網路、服務掛了）、
 * waiting＝開著，但這台裝置沒有「已允許定位」的紀錄，等她點一下才問（不在打開 App 時自己跳出定位詢問）
 */
export type WeatherStatus = 'idle' | 'asking' | 'ok' | 'denied' | 'nofix' | 'unsupported' | 'offline' | 'waiting';
export interface WeatherView {
  status: WeatherStatus;
  weather: Weather | null;
  /** 她點了「問天氣／再試一次」：現在問一次（用定位時會跳出定位詢問） */
  refresh: () => void;
}

/** 這次開著 App 期間問到的天氣（只放記憶體：座標和結果都不存檔）；key＝問的是哪裡（縣市 ID，或 auto＝定位） */
let cache: { at: number; key: string; weather: Weather } | null = null;
const AUTO = 'auto';

/** 問不到的原因（對應 WeatherStatus） */
class WeatherError extends Error {
  readonly status: Extract<WeatherStatus, 'denied' | 'nofix' | 'unsupported' | 'offline'>;
  constructor(status: Extract<WeatherStatus, 'denied' | 'nofix' | 'unsupported' | 'offline'>) {
    super(status);
    this.status = status;
  }
}

function locate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new WeatherError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      // GeolocationPositionError：1＝被擋、2＝抓不到位置、3＝等太久
      (error) => reject(new WeatherError(error.code === 1 ? 'denied' : 'nofix')),
      { enableHighAccuracy: false, timeout: WEATHER.locateMs, maximumAge: WEATHER.refreshMs },
    );
  });
}

async function fetchWeather(latitude: number, longitude: number): Promise<Weather> {
  const url = weatherUrl(latitude, longitude);
  if (!url) throw new WeatherError('nofix');
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), WEATHER.fetchMs);
  try {
    const response = await fetch(url, { signal: abort.signal });
    const weather = response.ok ? parseWeather(await response.json()) : null;
    if (!weather) throw new WeatherError('offline');
    return weather;
  } catch (error) {
    throw error instanceof WeatherError ? error : new WeatherError('offline');
  } finally {
    window.clearTimeout(timer);
  }
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

/**
 * 現在的天氣（on＝她打開了天氣天空；place＝她選的縣市，null＝用定位）。之後每 WEATHER.refreshMs 重問。
 * - 選了縣市：直接用那個縣市的座標問，完全不碰定位。
 * - 用定位：把粗略座標送去問。會跳出定位詢問的時機只有她當場打開開關、她點「問天氣／再試一次」；
 *   打開 App、定時重問、從別的 App 切回來時，只有這台裝置已經允許過定位才自己問，不然等她點（waiting）。
 * 問不到都只是沒有天氣（頁面照常），status 說明原因。
 */
export function useWeather(on: boolean, place: WeatherPlace | null): WeatherView {
  type Shown = Pick<WeatherView, 'status' | 'weather'>;
  const key = place?.id ?? AUTO;
  const [view, setView] = useState<Shown>(() =>
    on && cache?.key === key ? { status: 'ok', weather: cache.weather } : { status: 'idle', weather: null },
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
    /** 上一次問失敗了：畫面留著失敗的原因，不被「等她點」蓋掉 */
    let failed = false;
    const go = () => {
      setView((prev) => ({ status: 'asking', weather: prev.weather }));
      const where = place ? Promise.resolve(place) : locate();
      where
        .then((at) => fetchWeather(at.latitude, at.longitude))
        .then(
          (weather) => {
            cache = { at: Date.now(), key, weather };
            failed = false;
            if (alive) setView({ status: 'ok', weather });
          },
          (error: unknown) => {
            failed = true;
            if (alive) setView({ status: error instanceof WeatherError ? error.status : 'offline', weather: null });
          },
        );
    };
    /** byUser＝她剛點的（可以跳定位詢問）；不是的話，用定位時要先確認已經允許過 */
    const run = (byUser: boolean) => {
      if (cache && cache.key === key && Date.now() - cache.at < WEATHER.refreshMs) {
        setView({ status: 'ok', weather: cache.weather });
        return;
      }
      if (byUser || place) {
        go();
        return;
      }
      void locationGranted().then((granted) => {
        if (!alive) return;
        if (granted) go();
        else if (!failed) setView((prev) => (prev.weather ? prev : { status: 'waiting', weather: null }));
      });
    };
    askNow.current = () => run(true);
    run(toggledOn);
    const timer = window.setInterval(() => run(false), WEATHER.refreshMs);
    // 從別的 App（例如去開定位）切回來：再看一次
    const onVisible = () => {
      if (document.visibilityState === 'visible') run(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // place 用 key 當依賴：同一個縣市不重問
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);

  return { ...view, refresh: () => askNow.current() };
}
