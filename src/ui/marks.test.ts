import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitByMarks } from './marks';

describe('splitByMarks', () => {
  it('returns empty array for empty stem and plain segment when marks are empty', () => {
    assert.deepEqual(splitByMarks('', [{ text: '錯誤', color: 'red' }]), []);
    assert.deepEqual(splitByMarks('下列何者錯誤？', []), [{ text: '下列何者錯誤？', color: null }]);
  });

  it('splits red and blue marks at first occurrence and skips missing or empty marks', () => {
    const stem = '有關信賴保護原則，下列敘述何者錯誤？';
    const result = splitByMarks(stem, [
      { text: '信賴保護原則', color: 'blue' },
      { text: '不存在的詞', color: 'blue' },
      { text: '', color: 'red' },
      { text: '何者錯誤', color: 'red' },
    ]);

    assert.deepEqual(result, [
      { text: '有關', color: null },
      { text: '信賴保護原則', color: 'blue' },
      { text: '，下列敘述', color: null },
      { text: '何者錯誤', color: 'red' },
      { text: '？', color: null },
    ]);
  });

  it('marks only the first occurrence when text appears multiple times', () => {
    const stem = '核定與備查不同，核定為事前監督。';
    const result = splitByMarks(stem, [{ text: '核定', color: 'blue' }]);

    assert.deepEqual(result, [
      { text: '核定', color: 'blue' },
      { text: '與備查不同，核定為事前監督。', color: null },
    ]);
  });

  it('keeps first-come match when marks overlap or share start index', () => {
    const stem = '自治條例處罰規定之事前監督';
    const overlapResult = splitByMarks(stem, [
      { text: '條例處罰', color: 'red' },
      { text: '自治條例', color: 'blue' },
      { text: '事前', color: 'blue' },
    ]);

    assert.deepEqual(overlapResult, [
      { text: '自治條例', color: 'blue' },
      { text: '處罰規定之', color: null },
      { text: '事前', color: 'blue' },
      { text: '監督', color: null },
    ]);

    const sameStart = splitByMarks(stem, [
      { text: '自治條例', color: 'blue' },
      { text: '自治', color: 'red' },
    ]);

    assert.deepEqual(sameStart, [
      { text: '自治條例', color: 'blue' },
      { text: '處罰規定之事前監督', color: null },
    ]);
  });

  it('handles adjacent marks without emitting empty plain segments', () => {
    const stem = '自治條例處罰規定';
    const result = splitByMarks(stem, [
      { text: '自治條例', color: 'blue' },
      { text: '處罰規定', color: 'red' },
    ]);

    assert.deepEqual(result, [
      { text: '自治條例', color: 'blue' },
      { text: '處罰規定', color: 'red' },
    ]);
  });
});
