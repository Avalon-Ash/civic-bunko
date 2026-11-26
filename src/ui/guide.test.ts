// 引導的目的地與落點（docs/plans/ux-cleanup.md §2.3、ADR 0019）。fixture 一律從正本表取。
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { ACHIEVEMENT_GO, GUIDE, GUIDE_ANCHORS, GUIDE_PRESETS } from '../core/constants/guide';
import { ACHIEVEMENTS, QUESTS } from '../core/constants/wardrobe';
import type { GuideTarget } from '../core/types';
import { planGo } from './useGuide';

const UI_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function checkTarget(where: string, target: GuideTarget | undefined) {
  assert.ok(target, `${where} 沒有目的地`);
  if (target.anchor) assert.ok(target.anchor in GUIDE_ANCHORS, `${where} 的落點 ${target.anchor} 不在 GUIDE_ANCHORS`);
  if (target.preset) assert.ok(target.preset in GUIDE_PRESETS, `${where} 的預選 ${target.preset} 不在 GUIDE_PRESETS`);
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

test('每個任務都有目的地，落點與預選都在清單裡', () => {
  assert.ok(QUESTS.length > 0);
  for (const quest of QUESTS) checkTarget(`任務 ${quest.id}`, quest.go);
});

test('每種成就都有目的地', () => {
  assert.ok(ACHIEVEMENTS.length > 0);
  for (const achievement of ACHIEVEMENTS) {
    checkTarget(`成就 ${achievement.id}`, ACHIEVEMENT_GO[achievement.metric]);
  }
});

test('其他引導的目的地都在清單裡', () => {
  for (const [key, target] of Object.entries(GUIDE)) checkTarget(`GUIDE.${key}`, target);
});

test('畫面上標的落點都在清單裡、同一個 id 只標一次、只用 guideAnchor() 標', () => {
  const seen = new Map<string, string>();
  const files = tsxFiles(UI_DIR);
  assert.ok(files.length > 20, `只掃到 ${files.length} 個畫面檔，路徑可能錯了`);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(UI_DIR, file);
    assert.ok(!/data-guide/.test(text), `${rel} 直接寫了 data-guide，請改用 guideAnchor()`);
    for (const match of text.matchAll(/guideAnchor\(\s*'([^']+)'\s*\)/g)) {
      const id = match[1] ?? '';
      assert.ok(id in GUIDE_ANCHORS, `${rel} 標了不在清單裡的落點 ${id}`);
      assert.ok(!seen.has(id), `落點 ${id} 標了兩次：${seen.get(id)}、${rel}`);
      seen.set(id, rel);
    }
  }
});

// UX5 才打開：各畫面到 11-30 才全部標上落點，提早開會讓 main 紅好幾天。
test.todo('清單裡每個落點都有畫面標上（UX5 打開）');

test('有回合正在進行時，去刷題分頁只回到那一題，不落點、不預選', () => {
  const quizTarget = QUESTS.find((q) => q.go.tab === 'quiz')?.go;
  assert.ok(quizTarget);
  assert.deepEqual(planGo(quizTarget, { hasActiveRound: true, showResult: false }), {
    tab: 'quiz',
    land: null,
    closeResult: false,
  });
});

test('停在結果頁時，去刷題分頁先收掉結果頁再落點', () => {
  assert.deepEqual(planGo(GUIDE.fishBonus, { hasActiveRound: false, showResult: true }), {
    tab: 'quiz',
    land: GUIDE.fishBonus,
    closeResult: true,
  });
});

test('有回合時去別的分頁照常落點', () => {
  assert.deepEqual(planGo(GUIDE.questDone, { hasActiveRound: true, showResult: false }), {
    tab: GUIDE.questDone.tab,
    land: GUIDE.questDone,
    closeResult: false,
  });
});
