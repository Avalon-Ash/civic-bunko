import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CAT_DAY_PARTS,
  CAT_EXAM_FAR_DAYS,
  CAT_EXAM_NEAR_DAYS,
  CAT_LINE_MAX,
  CAT_MEMORY_LINES,
  CAT_NAME_MAX,
  CAT_PETTED_A_LOT_TAPS,
  CAT_PETTED_TAPS,
  CAT_STREAK_MIN,
  CAT_TAP_WINDOW_MS,
} from '../core/constants/cat';
import { CAT_CHARACTER } from '../core/constants/catLines';
import type { CatCharacter, CatCondition, CatMemory, CatSituation } from '../core/types';
import {
  CAT_CONDITIONS,
  CAT_LINE_VARS,
  EMPTY_CAT_MEMORY,
  cleanCatName,
  countTaps,
  eligibleTopics,
  fillLine,
  lineVars,
  speak,
} from './catBrain';

/** 平常的一下：下午三點、離考試 20 天、今天還沒刷、沒穿衣服、沒取名 */
const BASE: CatSituation = {
  mood: 'idle',
  place: 'avatar',
  hour: 15,
  daysToExam: 20,
  todayCount: 0,
  dailyGoal: 15,
  streak: 0,
  wearing: 0,
  name: null,
  taps: 1,
};

/** 讓每個條件成立的處境（疊在 BASE 上） */
const MAKE_TRUE: Record<CatCondition, Partial<CatSituation>> = {
  correct: { scene: 'correct', mood: 'yay' },
  wrong: { scene: 'wrong', mood: 'oops' },
  calm: { mood: 'idle' },
  cheerful: { mood: 'yay' },
  down: { mood: 'oops' },
  sleepy: { mood: 'sleepy' },
  roaming: { place: 'roam' },
  morning: { hour: CAT_DAY_PARTS.morning },
  midday: { hour: CAT_DAY_PARTS.midday },
  afternoon: { hour: CAT_DAY_PARTS.afternoon },
  evening: { hour: CAT_DAY_PARTS.evening },
  lateNight: { hour: CAT_DAY_PARTS.lateNight },
  examFar: { daysToExam: CAT_EXAM_FAR_DAYS + 1 },
  examMid: { daysToExam: CAT_EXAM_FAR_DAYS },
  examNear: { daysToExam: CAT_EXAM_NEAR_DAYS },
  examEve: { daysToExam: 1 },
  examDay: { daysToExam: 0 },
  notStarted: { todayCount: 0 },
  underway: { todayCount: 7 },
  goalDone: { todayCount: 15 },
  onStreak: { streak: CAT_STREAK_MIN },
  dressed: { wearing: 2 },
  undressed: { wearing: 0 },
  named: { name: '阿福' },
  unnamed: { name: null },
  petted: { taps: CAT_PETTED_TAPS },
  pettedALot: { taps: CAT_PETTED_A_LOT_TAPS },
};

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe('cat lines (character pack data)', () => {
  const lines = CAT_CHARACTER.topics.flatMap((topic) => topic.lines);

  it('has unique topic ids and no repeated line', () => {
    const ids = CAT_CHARACTER.topics.map((topic) => topic.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(lines).size, lines.length);
  });

  it('only uses placeholders the brain knows', () => {
    for (const line of lines) {
      for (const name of lineVars(line)) assert.ok(name in CAT_LINE_VARS, `不認得的佔位符 {${name}}：${line}`);
      assert.doesNotMatch(line.replace(/\{[A-Z]+\}/g, ''), /[{}]/, `佔位符寫錯：${line}`);
    }
  });

  it('every line fits the bubble even with the longest name and three-digit numbers', () => {
    const widest: Record<string, string> = { NAME: '貓'.repeat(CAT_NAME_MAX) };
    for (const line of lines) {
      const filled = line.replace(/\{([A-Z]+)\}/g, (_, name: string) => widest[name] ?? '999');
      assert.ok([...filled].length <= CAT_LINE_MAX, `太長（${[...filled].length} 字）：${filled}`);
    }
    assert.ok([...CAT_CHARACTER.defaultName].length <= CAT_NAME_MAX);
  });

  it('every topic can actually be said: its conditions can hold together and all its lines fill in', () => {
    for (const topic of CAT_CHARACTER.topics) {
      const situation = topic.when.reduce<CatSituation>((s, c) => ({ ...s, ...MAKE_TRUE[c] }), BASE);
      for (const c of topic.when) assert.ok(CAT_CONDITIONS[c](situation), `${topic.id}：條件 ${c} 和其他條件不能同時成立`);
      assert.ok(eligibleTopics(CAT_CHARACTER, situation).includes(topic), topic.id);
      for (const line of topic.lines) {
        assert.notEqual(fillLine(line, situation, CAT_CHARACTER), null, `${topic.id} 的這句填不出來：${line}`);
      }
    }
  });

  it('has something to say in every plain situation', () => {
    for (const mood of ['idle', 'yay', 'oops', 'sleepy'] as const) {
      for (const place of ['avatar', 'roam'] as const) {
        for (const daysToExam of [null, 0, 1, 5, 20, 90]) {
          const s: CatSituation = { ...BASE, mood, place, daysToExam };
          assert.ok(speak(CAT_CHARACTER, s, EMPTY_CAT_MEMORY, 0, () => 0.5).line, `${mood}/${place}/${daysToExam}`);
        }
      }
    }
  });
});

describe('cat brain', () => {
  it('each condition in MAKE_TRUE really makes that condition true', () => {
    for (const [name, patch] of Object.entries(MAKE_TRUE) as Array<[CatCondition, Partial<CatSituation>]>) {
      assert.ok(CAT_CONDITIONS[name]({ ...BASE, ...patch }), name);
    }
  });

  it('splits the day into parts with no gap, late night wrapping past midnight', () => {
    const parts = ['morning', 'midday', 'afternoon', 'evening', 'lateNight'] as const;
    for (let hour = 0; hour < 24; hour += 1) {
      const on = parts.filter((p) => CAT_CONDITIONS[p]({ ...BASE, hour }));
      assert.equal(on.length, 1, `${hour} 點：${on.join(',')}`);
    }
    assert.ok(CAT_CONDITIONS.lateNight({ ...BASE, hour: 2 }));
    assert.ok(CAT_CONDITIONS.morning({ ...BASE, hour: CAT_DAY_PARTS.midday - 1 }));
  });

  it('puts every day before the exam in exactly one exam stage, and none when there is no exam', () => {
    const stages = ['examDay', 'examEve', 'examNear', 'examMid', 'examFar'] as const;
    for (let daysToExam = 0; daysToExam <= 400; daysToExam += 1) {
      const on = stages.filter((p) => CAT_CONDITIONS[p]({ ...BASE, daysToExam }));
      assert.equal(on.length, 1, `${daysToExam} 天：${on.join(',')}`);
    }
    assert.deepEqual(stages.filter((p) => CAT_CONDITIONS[p]({ ...BASE, daysToExam: null })), []);
  });

  it('fills placeholders, uses the default name when unnamed, and refuses lines it cannot fill', () => {
    assert.equal(fillLine('{NAME}陪你', BASE, CAT_CHARACTER), `${CAT_CHARACTER.defaultName}陪你`);
    assert.equal(fillLine('{NAME}陪你', { ...BASE, name: '阿福' }, CAT_CHARACTER), '阿福陪你');
    assert.equal(fillLine('剩 {DAYS} 天', BASE, CAT_CHARACTER), '剩 20 天');
    assert.equal(fillLine('剩 {DAYS} 天', { ...BASE, daysToExam: null }, CAT_CHARACTER), null);
    assert.equal(fillLine('再 {LEFT} 題', { ...BASE, todayCount: 11 }, CAT_CHARACTER), '再 4 題');
    assert.equal(fillLine('再 {LEFT} 題', { ...BASE, todayCount: 15 }, CAT_CHARACTER), null);
    assert.equal(fillLine('{WHAT}', BASE, CAT_CHARACTER), null);
  });

  it('counts taps in a row and starts over after a pause', () => {
    assert.equal(countTaps(EMPTY_CAT_MEMORY, 1000), 1);
    const memory: CatMemory = { ...EMPTY_CAT_MEMORY, taps: 2, lastTapAt: 1000 };
    assert.equal(countTaps(memory, 1000 + CAT_TAP_WINDOW_MS), 3);
    assert.equal(countTaps(memory, 1001 + CAT_TAP_WINDOW_MS), 1);
  });

  const pack: CatCharacter = {
    id: 'test',
    defaultName: '貓',
    topics: [
      { id: 'a', when: [], weight: 1, lines: ['a1', 'a2', 'a3'] },
      { id: 'b', when: [], weight: 1, lines: ['b1'] },
      { id: 'night', when: ['lateNight'], weight: 100, lines: ['n1'] },
    ],
  };

  it('does not pick a topic whose conditions fail, and takes the weights into account', () => {
    for (let r = 0; r < 1; r += 0.1) {
      assert.notEqual(speak(pack, BASE, EMPTY_CAT_MEMORY, 0, () => r).line?.topic, 'night');
    }
    assert.equal(speak(pack, { ...BASE, hour: 23 }, EMPTY_CAT_MEMORY, 0, () => 0.5).line?.topic, 'night');
  });

  it('avoids the previous topic and lines it said recently', () => {
    let memory = EMPTY_CAT_MEMORY;
    const said: string[] = [];
    const topics: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const result = speak(pack, BASE, memory, i, seq(0, 0));
      memory = result.memory;
      said.push(result.line?.text ?? '');
      topics.push(result.line?.topic ?? '');
    }
    // 兩個話題輪流；a 的三句說完才會重複
    assert.deepEqual(topics, ['a', 'b', 'a', 'b', 'a', 'b']);
    assert.deepEqual(said, ['a1', 'b1', 'a2', 'b1', 'a3', 'b1']);
    assert.equal(memory.lastTopic, 'b');
  });

  it('keeps only the most recent lines in memory and records the tap', () => {
    let memory = EMPTY_CAT_MEMORY;
    for (let i = 0; i < CAT_MEMORY_LINES * 3; i += 1) {
      memory = speak(CAT_CHARACTER, { ...BASE, taps: 1 }, memory, i * 10_000, Math.random).memory;
    }
    assert.equal(memory.recentLines.length, CAT_MEMORY_LINES);
    assert.equal(memory.lastTapAt, (CAT_MEMORY_LINES * 3 - 1) * 10_000);
  });

  it('says nothing when the pack has nothing for the situation, but still remembers the tap', () => {
    const empty: CatCharacter = { id: 'empty', defaultName: '貓', topics: [] };
    const result = speak(empty, { ...BASE, taps: 4 }, EMPTY_CAT_MEMORY, 123, () => 0);
    assert.equal(result.line, null);
    assert.deepEqual(result.memory, { ...EMPTY_CAT_MEMORY, taps: 4, lastTapAt: 123 });
  });

  it('reacts to being petted: the petting topics take over after several taps in a row', () => {
    const topicsAt = (taps: number) => eligibleTopics(CAT_CHARACTER, { ...BASE, taps }).map((t) => t.id);
    assert.ok(!topicsAt(CAT_PETTED_TAPS - 1).includes('petted'));
    assert.ok(topicsAt(CAT_PETTED_TAPS).includes('petted'));
    assert.ok(topicsAt(CAT_PETTED_A_LOT_TAPS).includes('petted-a-lot'));
    assert.ok(!topicsAt(CAT_PETTED_A_LOT_TAPS).includes('petted'));
  });
});

describe('cat name', () => {
  it('trims, drops control characters and clips to the limit', () => {
    assert.equal(cleanCatName('  阿福  '), '阿福');
    assert.equal(cleanCatName('阿\n福\t'), '阿福');
    assert.equal(cleanCatName('a'.repeat(CAT_NAME_MAX + 5)), 'a'.repeat(CAT_NAME_MAX));
    assert.equal(cleanCatName('🐱'.repeat(CAT_NAME_MAX + 1)), '🐱'.repeat(CAT_NAME_MAX));
    assert.equal(cleanCatName(`${String.fromCodePoint(0x200b)}咪${String.fromCodePoint(0x202e)}`), '咪');
  });

  it('treats empty and non-string values as no name', () => {
    for (const value of ['', '   ', '\n', null, undefined, 42, {}, ['阿福']]) {
      assert.equal(cleanCatName(value), null);
    }
  });
});
