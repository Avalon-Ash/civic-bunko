import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { HOUSE } from '../../core/constants/house';
import {
  canStartCardEffect,
  clearCatEffects,
  endCardEffect,
  resetPetGate,
  tryCardEffect,
  tryVoice,
} from './petGate';

const CARD_A = { id: 'card-a' } as unknown as Element;
const CARD_B = { id: 'card-b' } as unknown as Element;

describe('petGate', () => {
  beforeEach(() => {
    resetPetGate();
  });

  it('allows only one cat to speak within HOUSE.voiceGapMs and lets another speak after the gap', () => {
    const t0 = 1_000;
    assert.equal(tryVoice('cat-1', t0), true);
    // 同一刻與間隔內其他隻都被擋掉（不排隊、也不延長冷卻）
    assert.equal(tryVoice('cat-2', t0), false);
    assert.equal(tryVoice('cat-2', t0 + HOUSE.voiceGapMs - 1), false);
    assert.equal(tryVoice('cat-3', t0 + HOUSE.voiceGapMs - 1), false);

    // 間隔剛好滿了，第二隻成功，隨即輪到第一隻被擋
    const t1 = t0 + HOUSE.voiceGapMs;
    assert.equal(tryVoice('cat-2', t1), true);
    assert.equal(tryVoice('cat-1', t1 + 1), false);
    assert.equal(tryVoice('cat-1', t1 + HOUSE.voiceGapMs), true);
  });

  it('handles voice gating starting at timestamp 0', () => {
    assert.equal(tryVoice('cat-1', 0), true);
    assert.equal(tryVoice('cat-2', HOUSE.voiceGapMs - 1), false);
    assert.equal(tryVoice('cat-2', HOUSE.voiceGapMs), true);
  });

  it('lets only one cat affect the same card and unlocks after endCardEffect', () => {
    assert.equal(tryCardEffect('cat-1', CARD_A), true);
    assert.equal(tryCardEffect('cat-2', CARD_A), false);

    // 另一隻不能解掉別人的鎖
    endCardEffect('cat-2', CARD_A);
    assert.equal(tryCardEffect('cat-2', CARD_A), false);

    // 原本那隻結束後，另一隻才搶得到
    endCardEffect('cat-1', CARD_A);
    assert.equal(tryCardEffect('cat-2', CARD_A), true);
  });

  it('allows only one cat in the family to run card effects at a time while letting that cat hold multiple cards', () => {
    assert.equal(tryCardEffect('cat-1', CARD_A), true);
    // 同一隻不能對同一張卡疊第二種效果
    assert.equal(tryCardEffect('cat-1', CARD_A), false);
    // 同一隻可以對另一張卡一起生效（例如企鵝一次結冰多張卡片）
    assert.equal(tryCardEffect('cat-1', CARD_B), true);
    // 其他隻連別張卡都不能開始
    assert.equal(canStartCardEffect('cat-2', CARD_B), false);
    assert.equal(tryCardEffect('cat-2', CARD_B), false);

    // 還有一張未結束前，其他隻仍不能開始
    endCardEffect('cat-1', CARD_A);
    assert.equal(canStartCardEffect('cat-2'), false);
    assert.equal(tryCardEffect('cat-2', CARD_A), false);

    // 全部結束後其他隻才可開始
    endCardEffect('cat-1', CARD_B);
    assert.equal(canStartCardEffect('cat-2', CARD_A), true);
    assert.equal(tryCardEffect('cat-2', CARD_A), true);
  });

  it('releases all locks held by a cat on clearCatEffects without affecting other cats', () => {
    assert.equal(tryCardEffect('cat-1', CARD_A), true);
    assert.equal(tryCardEffect('cat-1', CARD_B), true);

    clearCatEffects('cat-2');
    assert.equal(tryCardEffect('cat-2', CARD_A), false);

    clearCatEffects('cat-1');
    assert.equal(tryCardEffect('cat-2', CARD_A), true);
  });
});
