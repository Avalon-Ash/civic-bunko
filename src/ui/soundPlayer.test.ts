// 音效被系統靜默之後要回得來：用假的音訊環境走一遍暫停、叫醒、卡死、重建。
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SOUND_LATE_MS, SOUND_STUCK_MS, SOUND_WAITING_MAX } from '../core/constants/sound';
import type { SoundName } from '../core/types';
import { createSoundPlayer, soundHealth, type SoundContext } from './soundPlayer';

/** 假的音訊環境：狀態與時間由測試控制；resume 要不要成功也由測試決定 */
class FakeContext implements SoundContext {
  state = 'running';
  currentTime = 0;
  closed = false;
  resumeCalls = 0;
  /** false＝這次不是瀏覽器認的手勢，resume 不會把它叫醒 */
  canResume = true;
  onstatechange: ((this: never, ev: never) => unknown) | null = null;
  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (!this.canResume) return Promise.reject(new Error('not allowed'));
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
  /** 系統把它的狀態改掉（切背景、來電、自己恢復） */
  system(state: string): void {
    this.state = state;
    (this.onstatechange as (() => void) | null)?.();
  }
}

function setup() {
  const created: FakeContext[] = [];
  const played: Array<{ name: SoundName; on: FakeContext; t: number }> = [];
  const clock = { ms: 10_000 };
  let supported = true;
  const player = createSoundPlayer<FakeContext>({
    createContext: () => {
      if (!supported) return null;
      const ac = new FakeContext();
      created.push(ac);
      return ac;
    },
    schedule: (ac, name, t) => played.push({ name, on: ac, t }),
    now: () => clock.ms,
  });
  return {
    player,
    created,
    played,
    names: () => played.map((p) => p.name),
    /** 牆上時間往前；音訊時間跟著走（除非那個環境沒在跑或被標成卡死） */
    pass(ms: number, stuck: FakeContext | null = null) {
      clock.ms += ms;
      for (const ac of created) if (ac.state === 'running' && ac !== stuck) ac.currentTime += ms / 1000;
    },
    unsupported() {
      supported = false;
    },
  };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('sound health', () => {
  it('tells running, paused, closed and stuck apart', () => {
    assert.equal(soundHealth('running', 1, null, 0), 'ok');
    assert.equal(soundHealth('suspended', 1, null, 0), 'resume');
    // iOS 的規格外狀態：來電、切到別的 App 之後
    assert.equal(soundHealth('interrupted', 1, null, 0), 'resume');
    assert.equal(soundHealth('closed', 1, null, 0), 'recreate');
    // 時間有在走：正常
    assert.equal(soundHealth('running', 5, { time: 1, at: 0 }, SOUND_STUCK_MS * 3), 'ok');
    // 過了很久時間沒動：卡死
    assert.equal(soundHealth('running', 1, { time: 1, at: 0 }, SOUND_STUCK_MS), 'recreate');
    // 兩次檢查靠得太近，還看不出來
    assert.equal(soundHealth('running', 1, { time: 1, at: 0 }, SOUND_STUCK_MS - 1), 'ok');
  });
});

describe('sound player', () => {
  it('creates the audio context only on a user gesture', () => {
    const s = setup();
    s.player.play('correct', false);
    assert.equal(s.created.length, 0);
    assert.deepEqual(s.names(), []);
    s.player.play('tap', true);
    assert.equal(s.created.length, 1);
    assert.deepEqual(s.names(), ['tap']);
    // 建立之後，不是手勢的聲音（答對、獎勵）也播得出來
    s.player.play('correct', false);
    assert.deepEqual(s.names(), ['tap', 'correct']);
    assert.equal(s.created.length, 1);
  });

  it('does nothing, quietly, when the browser has no Web Audio', () => {
    const s = setup();
    s.unsupported();
    s.player.play('tap', true);
    s.player.unlock();
    assert.deepEqual(s.names(), []);
  });

  for (const paused of ['suspended', 'interrupted']) {
    it(`comes back after the system pauses it (${paused}): the next tap wakes it and is heard`, async () => {
      const s = setup();
      s.player.play('tap', true);
      const ac = s.created[0] as FakeContext;
      s.pass(60_000);
      ac.system(paused);

      s.player.play('tap', true);
      assert.equal(ac.resumeCalls, 1);
      await settle();
      assert.equal(ac.state, 'running');
      assert.deepEqual(s.names(), ['tap', 'tap']);
      assert.equal(s.created.length, 1);
    });
  }

  it('wakes on the release even when the press was not accepted as a gesture (iOS)', async () => {
    const s = setup();
    s.player.play('tap', true);
    const ac = s.created[0] as FakeContext;
    ac.system('suspended');

    // 按下：瀏覽器不認，叫不醒；聲音先等著
    ac.canResume = false;
    s.player.play('tap', true);
    await settle();
    assert.equal(ac.state, 'suspended');
    assert.deepEqual(s.names(), ['tap']);

    // 放開：瀏覽器認了，醒來，剛剛那一聲補上
    s.pass(80);
    ac.canResume = true;
    s.player.unlock();
    await settle();
    assert.equal(ac.state, 'running');
    assert.deepEqual(s.names(), ['tap', 'tap']);
  });

  it('does not burst out old sounds when it wakes: only recent ones are played', async () => {
    const s = setup();
    s.player.play('tap', true);
    const ac = s.created[0] as FakeContext;
    ac.system('suspended');
    ac.canResume = false;

    // 暫停期間排了好幾個聲音（答題的對錯聲不是手勢）
    s.player.play('correct', false);
    s.pass(5_000);
    s.player.play('wrong', false);
    s.pass(SOUND_LATE_MS + 1);
    s.player.play('reward', false);
    await settle();
    assert.deepEqual(s.names(), ['tap']);

    // 之後她碰了一下畫面：只補最後那一個（還在 SOUND_LATE_MS 內），更早的丟掉
    s.pass(SOUND_LATE_MS - 50);
    ac.canResume = true;
    s.player.unlock();
    await settle();
    assert.deepEqual(s.names(), ['tap', 'reward']);
    // 補播的聲音排在「現在」，不是排在暫停前的時間
    assert.equal(s.played[1]?.t, ac.currentTime);
  });

  it('keeps the waiting list short while it cannot wake', async () => {
    const s = setup();
    s.player.play('tap', true);
    const ac = s.created[0] as FakeContext;
    ac.system('suspended');
    ac.canResume = false;
    for (let i = 0; i < SOUND_WAITING_MAX * 3; i += 1) s.player.play('tap', true);
    ac.canResume = true;
    s.player.unlock();
    await settle();
    assert.equal(s.names().length, 1 + SOUND_WAITING_MAX);
  });

  it('plays what was waiting when the system resumes it by itself', () => {
    const s = setup();
    s.player.play('tap', true);
    const ac = s.created[0] as FakeContext;
    ac.system('suspended');
    ac.canResume = false;
    s.player.play('correct', false);
    assert.deepEqual(s.names(), ['tap']);
    s.pass(100);
    ac.system('running');
    assert.deepEqual(s.names(), ['tap', 'correct']);
  });

  it('replaces a context that looks fine but is stuck (running, clock frozen)', () => {
    const s = setup();
    s.player.play('tap', true);
    const first = s.created[0] as FakeContext;
    // 從背景回來：狀態還是 running，但音訊時間不走了
    s.pass(SOUND_STUCK_MS * 30, first);

    // 不是手勢：不能在這時候換新的（換了也不會出聲），安靜略過
    s.player.play('correct', false);
    assert.equal(s.created.length, 1);
    assert.deepEqual(s.names(), ['tap']);

    // 下一次手勢：關掉舊的、建新的，聲音從新的出來
    s.player.play('tap', true);
    assert.equal(s.created.length, 2);
    assert.equal(first.closed, true);
    assert.equal(s.played[1]?.on, s.created[1]);

    // 之後都用新的，不會每次都重建
    s.pass(SOUND_STUCK_MS * 5);
    s.player.play('tap', true);
    assert.equal(s.created.length, 2);
    assert.deepEqual(s.names(), ['tap', 'tap', 'tap']);
  });

  it('does not mistake a context that just woke up for a stuck one', async () => {
    const s = setup();
    s.player.play('tap', true);
    const ac = s.created[0] as FakeContext;
    s.pass(2_000);
    ac.system('suspended');
    // 暫停了很久（音訊時間凍結是正常的），然後她回來點了一下
    s.pass(600_000);
    s.player.play('tap', true);
    await settle();
    // 緊接著再點：時間還沒走多少，不能因此判成卡死而重建
    s.pass(20);
    s.player.play('tap', true);
    s.pass(SOUND_STUCK_MS * 2);
    s.player.play('tap', true);
    assert.equal(s.created.length, 1);
    assert.deepEqual(s.names(), ['tap', 'tap', 'tap', 'tap']);
  });

  it('builds a new context after the old one was closed', () => {
    const s = setup();
    s.player.play('tap', true);
    (s.created[0] as FakeContext).system('closed');
    s.player.play('tap', true);
    assert.equal(s.created.length, 2);
    assert.deepEqual(s.names(), ['tap', 'tap']);
  });

  it('unlock is silent and harmless to call on every gesture', () => {
    const s = setup();
    for (let i = 0; i < 20; i += 1) {
      s.player.unlock();
      s.pass(300);
    }
    assert.equal(s.created.length, 1);
    assert.deepEqual(s.names(), []);
    assert.equal((s.created[0] as FakeContext).resumeCalls, 0);
  });
});
