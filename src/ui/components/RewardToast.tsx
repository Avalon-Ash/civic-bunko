import { useCallback } from 'react';
import { ACHIEVEMENTS, QUESTS } from '../../core/constants/wardrobe';
import { dispatch } from '../../core/commands';
import type { Celebration } from '../../core/types';
import type { World } from '../../core/world';
import { GUIDE } from '../../core/constants/guide';
import { Toast } from '../kit/Toast';
import { useGo } from '../useGuide';
import { useWorld } from '../useWorld';

/** 慶祝提示停留時間 */
const REWARD_TOAST_MS = 3600;

/** 把衣櫥系統新給的獎勵合成一句話；認不得的 ID 略過。 */
export function rewardMessage(rewards: readonly Celebration[]): string | null {
  let fish = 0;
  const names: string[] = [];
  let questDone = false;
  for (const r of rewards) {
    if (r.kind === 'achievement') {
      const a = ACHIEVEMENTS.find((x) => x.id === r.id);
      if (!a) continue;
      fish += a.fish;
      names.push(a.name);
    } else {
      const q = QUESTS.find((x) => x.id === r.id);
      if (!q) continue;
      fish += q.fish;
      questDone = true;
    }
  }
  if (names.length === 0 && !questDone) return null;
  const parts: string[] = [];
  if (questDone) parts.push('今日任務完成');
  if (names.length === 1) parts.push(`解鎖成就「${names[0]}」`);
  else if (names.length > 1) parts.push(`解鎖 ${names.length} 個成就`);
  return `${parts.join('，')}！小魚乾 +${fish}`;
}

/** 有新的成就或任務完成時，在頁面頂端冒出提示；放完就清掉。 */
export function RewardToast({ world }: { world: World }) {
  useWorld(world);
  const message = rewardMessage(world.celebrations);
  const go = useGo();
  const handleDismiss = useCallback(() => dispatch(world, { type: 'dismissCelebrations' }), [world]);
  // 點提示去換裝（ux-cleanup §2.2）；不點照舊自己消失
  return (
    <Toast
      message={message}
      onDismiss={handleDismiss}
      durationMs={REWARD_TOAST_MS}
      onClick={() => go(GUIDE.rewardToast)}
    />
  );
}
