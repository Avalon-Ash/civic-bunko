// 小貓在卡片上不能被困住：在卡片上挑到「跳上卡片」就是跳回地面；暴衝只在地面。
// 規則在 docs/plans/cat-house.md §4.2（2026-11-22 使用者回報企鵝都不滑）。本檔斷言不准為了讓測試通過而修改。
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RoamBehavior } from '../../core/types';
import { ROAM_ROUTES } from '../../core/constants/pet';
import { pickBehavior, roamUnavailable } from './petLogic';

describe('roaming between cards and the floor', () => {
  it('on the floor: can zoom; can jump onto a card only when one is visible', () => {
    assert.deepEqual([...roamUnavailable('floor', 2)], []);
    assert.deepEqual([...roamUnavailable('floor', 0)], ['perch']);
  });

  it('on a card: cannot zoom, but "perch" stays available (it means hopping back down)', () => {
    assert.deepEqual([...roamUnavailable('perch', 0)], ['zoom']);
    assert.deepEqual([...roamUnavailable('perch', 3)], ['zoom']);
  });

  it('a cat on a card on the today page gets back down often enough (not trapped)', () => {
    const route = ROAM_ROUTES.today!;
    let down = 0;
    const N = 1000;
    for (let i = 0; i < N; i += 1) {
      const b: RoamBehavior = pickBehavior(route, () => (i + 0.5) / N, { unavailable: roamUnavailable('perch', 2) });
      if (b === 'perch') down += 1;
    }
    // 今日頁在卡片上時，每次挑動作至少一成機率跳回地面
    assert.ok(down / N >= 0.1, `down ${down / N}`);
  });
});
