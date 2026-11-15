import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getResultTier } from './result';

describe('result tiers', () => {
  it('selects stamp label and cat mood based on accuracy thresholds', () => {
    const perfect = getResultTier(10, 10);
    assert.equal(perfect.stampLabel, '全對！');
    assert.equal(perfect.catMood, 'yay');

    const passBoundary = getResultTier(4, 5);
    assert.equal(passBoundary.stampLabel, '過關成功');
    assert.equal(passBoundary.catMood, 'yay');

    const passHigh = getResultTier(9, 10);
    assert.equal(passHigh.stampLabel, '過關成功');
    assert.equal(passHigh.catMood, 'yay');

    const midBoundary = getResultTier(5, 10);
    assert.equal(midBoundary.stampLabel, '再接再厲');
    assert.equal(midBoundary.catMood, 'idle');

    const midUpper = getResultTier(79, 100);
    assert.equal(midUpper.stampLabel, '再接再厲');
    assert.equal(midUpper.catMood, 'idle');

    const lowUpper = getResultTier(49, 100);
    assert.equal(lowUpper.stampLabel, '明天再戰');
    assert.equal(lowUpper.catMood, 'oops');

    const zero = getResultTier(0, 10);
    assert.equal(zero.stampLabel, '明天再戰');
    assert.equal(zero.catMood, 'oops');

    const empty = getResultTier(0, 0);
    assert.equal(empty.stampLabel, '明天再戰');
    assert.equal(empty.catMood, 'oops');
  });
});
