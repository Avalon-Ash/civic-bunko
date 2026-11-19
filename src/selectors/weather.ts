import type { World } from '../core/world';

/** 天氣天空是否開啟（沒設定視為關閉：要用到定位，所以要她自己打開）。 */
export function weatherOn(world: World): boolean {
  return world.settings.weather === true;
}
