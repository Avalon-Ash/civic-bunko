import { WEATHER_PLACES } from '../core/constants/weather';
import type { WeatherPlace } from '../core/types';
import type { World } from '../core/world';

/** 天氣天空是否開啟（沒設定視為關閉：要用到定位，所以要她自己打開）。 */
export function weatherOn(world: World): boolean {
  return world.settings.weather === true;
}

/** 天氣天空看哪個縣市；沒選（或存的 id 不認得）回 null＝用定位。 */
export function weatherPlace(world: World): WeatherPlace | null {
  const id = world.settings.weatherPlace;
  return (id && WEATHER_PLACES.find((place) => place.id === id)) || null;
}
