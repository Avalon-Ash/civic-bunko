import { GRADUATE_STREAK, REVIEW_INTERVAL_DAYS } from '../core/constants/round';
import type { Progress } from '../core/types';
import type { World } from '../core/world';
import { addDaysLocal } from './date';

function getIntervalDays(index: number): number {
  const clamped = Math.min(Math.max(0, index), REVIEW_INTERVAL_DAYS.length - 1);
  const days = REVIEW_INTERVAL_DAYS[clamped];
  if (days === undefined) {
    throw new Error('REVIEW_INTERVAL_DAYS cannot be empty');
  }
  return days;
}

/** 訂閱 answered 與 viewed 事件，更新題目進度、觀看次數與間隔複習到期日。 */
export function attachScheduling(world: World): () => void {
  const unsubAnswered = world.bus.on('answered', (event) => {
    const prev = world.progress.get(event.id);
    const isNew = prev === undefined || prev.seen === 0;
    const atDate = new Date(event.at);

    const seen = (prev?.seen ?? 0) + 1;
    const correct = (prev?.correct ?? 0) + (event.correct ? 1 : 0);

    let streak: number;
    let due: string | null;

    if (!event.correct) {
      streak = 0;
      due = addDaysLocal(atDate, REVIEW_INTERVAL_DAYS[0]);
    } else {
      streak = (prev?.streak ?? 0) + 1;
      if (isNew || streak >= GRADUATE_STREAK) {
        due = null;
      } else {
        due = addDaysLocal(atDate, getIntervalDays(streak));
      }
    }

    const nextProgress: Progress = {
      seen,
      correct,
      views: prev?.views ?? 0,
      streak,
      lastPick: event.pick,
      lastAt: event.at,
      due,
    };

    world.progress.set(event.id, nextProgress);
    world.bus.emit({
      type: 'progressChanged',
      ids: [event.id],
    });
  });

  const unsubViewed = world.bus.on('viewed', (event) => {
    const prev = world.progress.get(event.id);
    const nextProgress: Progress = {
      seen: prev?.seen ?? 0,
      correct: prev?.correct ?? 0,
      views: (prev?.views ?? 0) + 1,
      streak: prev?.streak ?? 0,
      lastPick: prev?.lastPick ?? null,
      lastAt: event.at,
      due: prev?.due ?? null,
    };

    world.progress.set(event.id, nextProgress);
    world.bus.emit({
      type: 'progressChanged',
      ids: [event.id],
    });
  });

  return () => {
    unsubAnswered();
    unsubViewed();
  };
}
