// 四格漫畫的構圖模板：每種 scene 的演員與道具擺在格子的哪裡（ADR 0020）。
// 座標是格子畫面的百分比：x＝水平中心，y＝底邊（腳踩的地方），w＝寬。舉牌固定在左上角，所以道具不擺左上。
import type { ComicSceneId } from '../../../core/types';

export interface ComicSlot {
  x: number;
  y: number;
  w: number;
}

export interface ComicSceneLayout {
  actors: readonly ComicSlot[];
  props: readonly ComicSlot[];
}

export const COMIC_SCENE_LAYOUT: Readonly<Record<ComicSceneId, ComicSceneLayout>> = {
  solo: {
    actors: [{ x: 32, y: 100, w: 58 }],
    props: [
      { x: 76, y: 92, w: 38 },
      { x: 86, y: 40, w: 24 },
    ],
  },
  duo: {
    actors: [
      { x: 25, y: 100, w: 48 },
      { x: 75, y: 100, w: 48 },
    ],
    props: [{ x: 50, y: 62, w: 22 }],
  },
  'prop-big': {
    actors: [{ x: 22, y: 100, w: 42 }],
    props: [{ x: 68, y: 94, w: 54 }],
  },
  crowd: {
    actors: [
      { x: 18, y: 100, w: 38 },
      { x: 50, y: 100, w: 38 },
      { x: 82, y: 100, w: 38 },
    ],
    props: [{ x: 84, y: 34, w: 18 }],
  },
};
