import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPet, hintPet, petHome, recallPet, releasePet, subscribePet, type PetRect } from './petStore';

const RECT_A: PetRect = { left: 10, top: 20, width: 76, height: 76 };
const RECT_B: PetRect = { left: 100, top: 20, width: 76, height: 76 };
const FAKE_EL = {} as unknown as Element;

describe('petStore', () => {
  it('starts at home with seq 0 and returns a stable snapshot for unseen cats', () => {
    const a = getPet('test-init-a');
    const b = getPet('test-init-b');
    assert.deepEqual(a, { out: false, request: null, seq: 0 });
    assert.equal(a, b);
    assert.equal(getPet('test-init-a'), a);
  });

  it('tracks release, recall, and petHome independently per cat id', () => {
    const catA = 'test-roam-a';
    const catB = 'test-roam-b';

    releasePet(catA, RECT_A);
    assert.deepEqual(getPet(catA), { out: true, request: { kind: 'release', from: RECT_A }, seq: 1 });
    assert.deepEqual(getPet(catB), { out: false, request: null, seq: 0 });

    // 重複 release 不會覆寫也不會增加 seq
    releasePet(catA, RECT_B);
    assert.equal(getPet(catA).seq, 1);

    // 另一隻放出來與叫回家互不干擾
    releasePet(catB, RECT_B);
    assert.deepEqual(getPet(catB), { out: true, request: { kind: 'release', from: RECT_B }, seq: 1 });

    recallPet(catA);
    assert.deepEqual(getPet(catA), { out: true, request: { kind: 'recall' }, seq: 2 });
    assert.deepEqual(getPet(catB), { out: true, request: { kind: 'release', from: RECT_B }, seq: 1 });

    petHome(catA);
    assert.deepEqual(getPet(catA), { out: false, request: null, seq: 3 });
    assert.equal(getPet(catB).out, true);
    assert.equal(getPet(catB).seq, 1);

    // 已經在家時 recall / petHome 都是 no-op
    recallPet(catA);
    petHome(catA);
    assert.equal(getPet(catA).seq, 3);

    petHome(catB);
    assert.deepEqual(getPet(catB), { out: false, request: null, seq: 2 });
  });

  it('handles hintPet per cat and sets auto based on that cat’s own out state', () => {
    const catA = 'test-hint-a';
    const catB = 'test-hint-b';

    // catA 在家，hintPet 會標 auto: true，catB 不受影響
    hintPet(catA, FAKE_EL, true, RECT_A);
    assert.deepEqual(getPet(catA), {
      out: true,
      request: { kind: 'hint', el: FAKE_EL, right: true, auto: true, from: RECT_A },
      seq: 1,
    });
    assert.deepEqual(getPet(catB), { out: false, request: null, seq: 0 });

    // catA 已經在外面，再次 hintPet 會標 auto: false 且 seq 遞增
    hintPet(catA, FAKE_EL, false, RECT_A);
    assert.deepEqual(getPet(catA), {
      out: true,
      request: { kind: 'hint', el: FAKE_EL, right: false, auto: false, from: RECT_A },
      seq: 2,
    });

    // catB 在家，hintPet 仍標 auto: true 且 seq 從自己的 0 升為 1
    hintPet(catB, FAKE_EL, false, RECT_B);
    assert.deepEqual(getPet(catB), {
      out: true,
      request: { kind: 'hint', el: FAKE_EL, right: false, auto: true, from: RECT_B },
      seq: 1,
    });
    assert.equal(getPet(catA).seq, 2);
  });

  it('notifies subscribers on state changes and stops after unsubscribe', () => {
    const cat = 'test-sub-a';
    let calls = 0;
    const unsub = subscribePet(() => {
      calls += 1;
    });

    releasePet(cat, RECT_A);
    recallPet(cat);
    petHome(cat);
    assert.equal(calls, 3);

    // no-op 不通知
    petHome(cat);
    assert.equal(calls, 3);

    unsub();
    releasePet(cat, RECT_A);
    assert.equal(calls, 3);
  });
});
