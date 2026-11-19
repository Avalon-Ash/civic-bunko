import { useEffect, useRef, useState } from 'react';
import {
  RUNNER_GROOM_AFTER_MS,
  RUNNER_GROOM_MS,
  RUNNER_HOP_MS,
  RUNNER_RUN_MS,
  RUNNER_SLEEP_AFTER_MS,
  RUNNER_STUMBLE_MS,
  RUNNER_WIDTH,
} from '../../core/constants/pet';
import type { Outfit, PetPose } from '../../core/types';
import type { World } from '../../core/world';
import { CatBody } from '../kit/CatBody';
import { useCanRoam } from './CatHome';
import { recallPet, releasePet, usePet } from './petStore';

export interface PetRunnerProps {
  world: World;
  outfit: Outfit;
  /** 目前進度值（進度條的 value）：變大就往前跑，變小就往回跑 */
  value: number;
}

/**
 * 答題頁進度條上的小貓：跑到哪＝做到哪。答對跳一下、答錯踉蹌；一陣子沒動靜理毛，更久就睡。
 * 點牠＝放出來在畫面上亂跑（這裡就是牠的家：data-cat-home）；出門時原地留一個肉球，點肉球叫牠回來。
 * 模擬考沒有進度條，所以沒有這隻。
 */
export function PetRunner({ world, outfit, value }: PetRunnerProps) {
  const [pose, setPose] = useState<PetPose>('sit');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const prevValue = useRef(value);
  const pendingReaction = useRef<PetPose | null>(null);
  const timers = useRef<number[]>([]);
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const pet = usePet();
  const canRoam = useCanRoam();

  // 進度條的滑動時間＝跑步時間（同一個常數）
  useEffect(() => {
    hostRef.current?.closest<HTMLElement>('.cb-prog-wrap')?.style.setProperty('--runner-run-ms', `${RUNNER_RUN_MS}ms`);
  }, []);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** 重新開始「沒動靜」的計時：先理毛、再睡 */
  const settle = (rest: PetPose) => {
    setPose(rest);
    later(RUNNER_GROOM_AFTER_MS, () => {
      setPose('groom');
      later(RUNNER_GROOM_MS, () => setPose('sit'));
    });
    later(RUNNER_SLEEP_AFTER_MS, () => setPose('loaf'));
  };

  useEffect(() => {
    const off = world.bus.on('answered', (event) => {
      pendingReaction.current = event.correct ? 'hop' : 'stumble';
    });
    settle('sit');
    return () => {
      off();
      clearTimers();
    };
  }, [world]);

  useEffect(() => {
    if (value === prevValue.current) return;
    const forward = value > prevValue.current;
    prevValue.current = value;
    clearTimers();
    setFacing(forward ? 'right' : 'left');
    setPose('run');
    later(RUNNER_RUN_MS, () => {
      const reaction = pendingReaction.current;
      pendingReaction.current = null;
      setFacing('right');
      if (reaction === 'hop') {
        setPose('hop');
        later(RUNNER_HOP_MS, () => settle('sit'));
      } else if (reaction === 'stumble') {
        setPose('stumble');
        later(RUNNER_STUMBLE_MS, () => settle('stand'));
      } else {
        settle('sit');
      }
    });
  }, [value]);

  const handleTap = () => {
    if (pet.out) {
      recallPet();
      return;
    }
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) releasePet({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  };

  const body = (
    <span className={pet.out ? 'cb-pet-runner-away' : undefined}>
      {/* 模擬考要安靜：不冒表情符號泡泡 */}
      <CatBody pose={pose} outfit={outfit} facing={facing} width={RUNNER_WIDTH} pivot quiet={Boolean(world.round?.config.exam)} />
    </span>
  );

  return (
    <span ref={hostRef} className="cb-pet-runner" data-cat-home="">
      {canRoam ? (
        <button
          type="button"
          className="cb-pet-runner-btn"
          onClick={handleTap}
          aria-label={pet.out ? '叫小貓回來' : '放小貓出來玩'}
          tabIndex={-1}
        >
          {body}
          {pet.out ? (
            <svg className="cb-pet-runner-paw" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <ellipse cx="12" cy="15.5" rx="5" ry="4" />
              <circle cx="6.5" cy="10" r="2.1" />
              <circle cx="12" cy="7.5" r="2.2" />
              <circle cx="17.5" cy="10" r="2.1" />
            </svg>
          ) : null}
        </button>
      ) : (
        body
      )}
    </span>
  );
}
