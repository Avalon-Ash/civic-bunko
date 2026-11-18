// 小魚乾試算：照 constants/wardrobe.ts 的數字逐日模擬，算幾種刷題習慣各在哪一天買得完整間商店。
// 改獎勵或價格之前、之後各跑一次；結果貼進 docs/plans/cat-wardrobe.md §3.2。不算每日特價省下的。
// 用法：npx tsx tools/economy/fish-economy.mts
import {
  ACHIEVEMENTS,
  DAILY_TIERS,
  FISH_PER_QUESTION,
  ITEMS,
  QUESTS,
  WARDROBE_START_DAY,
  WELCOME_FISH,
} from '../../src/core/constants/wardrobe';
import { DAILY_GOAL_QUESTIONS } from '../../src/core/constants/daily';

const EXAM = '2026-12-05';
const shopTotal = ITEMS.reduce((sum, it) => sum + (it.source.kind === 'shop' ? it.source.price : 0), 0);
const questAvg = QUESTS.reduce((s, q) => s + q.fish, 0) / QUESTS.length;
const days: string[] = [];
for (let d = new Date(`${WARDROBE_START_DAY}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
  const key = d.toISOString().slice(0, 10);
  days.push(key);
  if (key === EXAM) break;
}

interface Habit {
  name: string;
  perDay: number;
  /** 每 10 天來幾天 */
  attend: number;
  /** 來的那天有幾成做了每日任務 */
  quest: number;
  /** 每個來的日子看幾張新圖卡 */
  cards: number;
  /** 刷過的題有幾成變熟練 */
  master: number;
}
const HABITS: Habit[] = [
  { name: '每天 5 題、七成出席、任務一半', perDay: 5, attend: 7, quest: 0.5, cards: 0.5, master: 0.2 },
  { name: '每天 15 題、七成出席、任務一半', perDay: 15, attend: 7, quest: 0.5, cards: 0.5, master: 0.2 },
  { name: '每天 15 題、全勤、任務一半', perDay: 15, attend: 10, quest: 0.5, cards: 0.5, master: 0.2 },
  { name: '每天 30 題、七成出席、任務一半', perDay: 30, attend: 7, quest: 0.5, cards: 1, master: 0.2 },
  { name: '每天 30 題、全勤、任務都做', perDay: 30, attend: 10, quest: 1, cards: 1, master: 0.25 },
];

const rows: string[] = [];
for (const hb of HABITS) {
  let fish = WELCOME_FISH;
  let answered = 0;
  let stamps = 0;
  let streak = 0;
  let best = 0;
  let cards = 0;
  let active = 0;
  let doneDay = '買不完';
  let at1201 = 0;
  const got = new Set<string>();
  days.forEach((day, i) => {
    const here = (i * hb.attend) % 10 < hb.attend;
    if (here) {
      active += 1;
      answered += hb.perDay;
      fish += hb.perDay * FISH_PER_QUESTION;
      for (const t of DAILY_TIERS) if (hb.perDay >= t.at) fish += t.fish;
      fish += questAvg * hb.quest;
      cards += hb.cards;
      if (hb.perDay >= DAILY_GOAL_QUESTIONS) {
        stamps += 1;
        streak += 1;
        best = Math.max(best, streak);
      } else streak = 0;
    } else streak = 0;
    const metrics: Record<string, number> = {
      answeredTotal: answered,
      mastered: answered * hb.master,
      stamps,
      stampStreak: best,
      cardsSeen: cards,
      examCount: 0,
      examBest: 0,
    };
    for (const a of ACHIEVEMENTS) {
      if (!got.has(a.id) && (metrics[a.metric] ?? 0) >= a.at) {
        got.add(a.id);
        fish += a.fish;
      }
    }
    if (doneDay === '買不完' && fish >= shopTotal) doneDay = day.slice(5);
    if (day === '2026-12-01') at1201 = fish;
  });
  rows.push(
    `| ${hb.name} | ${active} 天 | ${Math.round(at1201)}（${Math.round((at1201 / shopTotal) * 100)}%） | ${Math.round(fish)}（${Math.round((fish / shopTotal) * 100)}%） | ${doneDay} | ${got.size} 個 |`,
  );
}
console.log(`商店總價 ${shopTotal}；每題 ${FISH_PER_QUESTION}；關卡 ${DAILY_TIERS.map((t) => `${t.at}題+${t.fish}`).join('、')}；任務平均 ${questAvg}；成就總額 ${ACHIEVEMENTS.reduce((s, a) => s + a.fish, 0)}（${ACHIEVEMENTS.length} 個）`);
console.log('| 習慣（從 11-17 起、之前沒有紀錄、沒考模擬考） | 出席 | 到 12-01 累計 | 到 12-05 累計 | 哪天買得完 | 拿到成就 |');
console.log('| :-- | :-- | :-- | :-- | :-- | :-- |');
console.log(rows.join('\n'));
