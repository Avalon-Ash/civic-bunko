import type { World } from '../core/world';

/** 音效是否開啟（沒設定視為開啟）。 */
export function soundOn(world: World): boolean {
  return world.settings.sound !== false;
}
