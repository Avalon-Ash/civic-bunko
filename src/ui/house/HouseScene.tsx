import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { HOUSE_SCENE } from '../../core/constants/house';
import type { CatId } from '../../core/types';
import type { HouseCatView } from '../../selectors/house';
import { CatBody } from '../kit/CatBody';
import {
  activeNuzzlePair,
  actorMood,
  actorPose,
  createInitialActors,
  dayPartOfHour,
  hopActor,
  nextTickDelayMs,
  roomBounds,
  stepHouse,
  syncActorsWithCats,
  type HouseActor,
  type HouseDayPart,
  type RoomBounds,
} from './houseLogic';

export interface HouseSceneProps {
  cats: readonly HouseCatView[];
  selected: CatId;
  onSelect: (id: CatId) => void;
  /** 新領養的小貓（由右邊門口走進來）；tick 變化時重新觸發 */
  entering?: { id: CatId; tick: number } | null;
}

const DAY_PART_LABEL: Readonly<Record<HouseDayPart, string>> = {
  day: '白天',
  dusk: '傍晚',
  night: '晚上',
};

const WINDOW_STARS: ReadonlyArray<[number, number, number]> = [
  [22, 16, 1.5],
  [58, 12, 1.3],
  [74, 26, 1.6],
  [36, 32, 1.1],
];

/** 窗外的天空（照 CAT_DAY_PARTS 分白天、傍晚、晚上）；顏色一律用 theme.css token */
function RoomWindow({ part }: { part: HouseDayPart }) {
  const duskId = useId();
  return (
    <svg className="cb-house-window" viewBox="0 0 92 64" aria-hidden="true">
      <defs>
        <linearGradient id={duskId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pink)" />
          <stop offset="100%" stopColor="var(--butter)" />
        </linearGradient>
      </defs>
      {/* 窗外天空 */}
      <rect
        x="6"
        y="6"
        width="80"
        height="48"
        rx="8"
        fill={
          part === 'day'
            ? 'var(--bg-top)'
            : part === 'dusk'
              ? `url(#${duskId})`
              : 'var(--acc-night)'
        }
      />
      {part === 'day' ? (
        <>
          <circle cx="67" cy="20" r="8" fill="var(--acc-gold)" />
          <path
            d="M17 34 Q17 27 24 27 Q27 22 34 24 Q40 24 41 29 Q46 29 46 34 Z"
            fill="var(--surface-raised)"
            opacity="0.9"
          />
        </>
      ) : part === 'dusk' ? (
        <>
          <circle cx="46" cy="40" r="10" fill="var(--acc-orange)" opacity="0.85" />
          <path
            d="M16 26 Q22 21 30 24 Q35 23 38 27 H16 Z"
            fill="var(--surface-raised)"
            opacity="0.6"
          />
        </>
      ) : (
        <>
          <path
            d="M66 13 A9 9 0 1 0 74 27 A7.5 7.5 0 0 1 66 13 Z"
            fill="var(--acc-straw)"
          />
          {WINDOW_STARS.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="var(--acc-straw)" />
          ))}
        </>
      )}
      {/* 窗框十字與窗台 */}
      <rect
        x="6"
        y="6"
        width="80"
        height="48"
        rx="8"
        fill="none"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <line x1="46" y1="6" x2="46" y2="54" stroke="var(--line)" strokeWidth="2.2" />
      <line x1="6" y1="30" x2="86" y2="30" stroke="var(--line)" strokeWidth="2.2" />
      <rect
        x="2"
        y="53"
        width="88"
        height="8"
        rx="4"
        fill="var(--acc-wood)"
        stroke="var(--line)"
        strokeWidth="2.2"
      />
    </svg>
  );
}

/** 房間的擺設：貓抓板、坐墊、右邊的門（裝飾，不擋點擊） */
function RoomFurniture() {
  return (
    <>
      {/* 貓抓板（左後方） */}
      <svg className="cb-house-scratcher" viewBox="0 0 54 64" aria-hidden="true">
        {/* 底座 */}
        <rect
          x="6"
          y="50"
          width="42"
          height="10"
          rx="5"
          fill="var(--acc-wood)"
          stroke="var(--line)"
          strokeWidth="2.2"
        />
        {/* 麻繩柱 */}
        <rect
          x="20"
          y="16"
          width="14"
          height="35"
          rx="4"
          fill="var(--acc-straw)"
          stroke="var(--line)"
          strokeWidth="2.2"
        />
        <path
          d="M21 24 L33 21 M21 31 L33 28 M21 38 L33 35 M21 45 L33 42"
          stroke="var(--line)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* 頂平台與吊球 */}
        <rect
          x="10"
          y="10"
          width="34"
          height="8"
          rx="4"
          fill="var(--butter)"
          stroke="var(--line)"
          strokeWidth="2.2"
        />
        <line x1="40" y1="18" x2="43" y2="28" stroke="var(--line)" strokeWidth="1.6" />
        <circle cx="43" cy="31" r="4" fill="var(--mint)" stroke="var(--line)" strokeWidth="1.8" />
      </svg>

      {/* 軟坐墊（地板左中） */}
      <svg className="cb-house-cushion" viewBox="0 0 74 30" aria-hidden="true">
        <ellipse
          cx="37"
          cy="17"
          rx="33"
          ry="10"
          fill="var(--pink)"
          stroke="var(--line)"
          strokeWidth="2.2"
        />
        <ellipse cx="37" cy="15" rx="22" ry="5" fill="var(--pink-deep)" opacity="0.35" />
        <circle cx="37" cy="15" r="2.6" fill="var(--pink-deep)" />
      </svg>

      {/* 右邊的門（新領養的小貓從這裡走進來） */}
      <svg className="cb-house-door" viewBox="0 0 46 86" aria-hidden="true">
        <path
          d="M4 84 V18 Q4 4 18 4 H42 V84 Z"
          fill="var(--acc-wood)"
          stroke="var(--line)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M11 78 V20 Q11 11 20 11 H37 V78 Z"
          fill="var(--butter)"
          stroke="var(--line)"
          strokeWidth="1.8"
          opacity="0.85"
        />
        <circle cx="17" cy="48" r="3.4" fill="var(--acc-gold)" stroke="var(--line)" strokeWidth="1.6" />
      </svg>
    </>
  );
}

/** 讀系統的 prefers-reduced-motion 並監聽變更 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * 小貓之家房間場景：全家在地板活動，點一隻選牠、跳一下並喵；
 * 畫面不可見（IntersectionObserver）或 App 在背景（visibilitychange）時停止計時器。
 */
export function HouseScene({ cats, selected, onSelect, entering = null }: HouseSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [inView, setInView] = useState(true);
  const [docVisible, setDocVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );
  const [dayPart, setDayPart] = useState<HouseDayPart>(() => dayPartOfHour(new Date().getHours()));
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: HOUSE_SCENE.defaultWidth,
    height: HOUSE_SCENE.height,
  });

  const bounds: RoomBounds = roomBounds(size.width, size.height);
  const boundsRef = useRef<RoomBounds>(bounds);
  boundsRef.current = bounds;

  const [actors, setActors] = useState<HouseActor[]>(() =>
    createInitialActors(
      cats.map((c) => c.id),
      roomBounds(HOUSE_SCENE.defaultWidth, HOUSE_SCENE.height),
      Math.random,
      { reducedMotion },
    ),
  );
  const lastEnteringTick = useRef<number | null>(null);
  const catIdsKey = cats.map((c) => c.id).join(',');

  // 量房間寬高（自適應手機直向、橫放矮高度、iPad 寬版）
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) {
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 房間不在畫面上時停動作計時器
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // App 切到背景時停計時器；回到前景時順便刷新窗外時段
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setDocVisible(visible);
      if (visible) {
        setDayPart(dayPartOfHour(new Date().getHours()));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // 小貓增減、新領養進門、或房間縮放時同步位置與名單
  useEffect(() => {
    const isFreshEntering = entering !== null && entering.tick !== lastEnteringTick.current;
    if (isFreshEntering) {
      lastEnteringTick.current = entering.tick;
    }
    const ids = catIdsKey ? catIdsKey.split(',') : [];
    setActors((prev) =>
      syncActorsWithCats(prev, ids, boundsRef.current, Math.random, {
        reducedMotion,
        enteringId: isFreshEntering ? entering.id : null,
      }),
    );
  }, [catIdsKey, size.width, size.height, reducedMotion, entering]);

  // 動作計時器：只有房間看得到且在前景才跑；有人在走或跳用 rAF，全部靜止用單一 setTimeout
  const delayMs = nextTickDelayMs(actors);
  const running = inView && docVisible && delayMs !== null;
  const animating = running && delayMs === 0;
  const idleWaiting = running && delayMs !== null && delayMs > 0;

  useEffect(() => {
    if (!animating) return;
    let rafId = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(HOUSE_SCENE.maxDtMs, Math.max(0, now - lastTime));
      lastTime = now;
      setActors((prev) => stepHouse(prev, dt, boundsRef.current, Math.random, { reducedMotion }));
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [animating, reducedMotion]);

  useEffect(() => {
    if (!idleWaiting || delayMs === null || delayMs <= 0) return;
    const timer = window.setTimeout(() => {
      setActors((prev) => stepHouse(prev, delayMs, boundsRef.current, Math.random, { reducedMotion }));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [idleWaiting, delayMs, actors, reducedMotion]);

  const catsById = new Map(cats.map((c) => [c.id, c]));
  const wallHeight = size.height - bounds.floorHeight;
  const nuzzle = activeNuzzlePair(actors);

  const sceneStyle = {
    '--house-h': `${HOUSE_SCENE.height}px`,
    '--house-h-short': `${HOUSE_SCENE.shortHeight}px`,
    '--house-floor-pct': `${Math.round(HOUSE_SCENE.floorRatio * 100)}%`,
  } as CSSProperties;

  const handleTap = (id: CatId) => {
    onSelect(id);
    setActors((prev) => hopActor(prev, id));
  };

  return (
    <div
      ref={sceneRef}
      className={`cb-house-scene is-${dayPart}`}
      style={sceneStyle}
      role="region"
      aria-label={`小貓的家（${DAY_PART_LABEL[dayPart]}，共 ${cats.length} 隻）`}
    >
      <div className="cb-house-wall" aria-hidden="true">
        <RoomWindow part={dayPart} />
      </div>
      <div className="cb-house-floor" aria-hidden="true" />
      <RoomFurniture />

      {actors.map((actor) => {
        const cat = catsById.get(actor.id);
        if (!cat) return null;
        const isSelected = cat.id === selected;
        const pose = actorPose(actor);
        const mood = actorMood(actor);
        const feetY = wallHeight + actor.y;
        const zIndex = Math.round(actor.y) + (isSelected ? 100 : 10);

        return (
          <button
            key={cat.id}
            type="button"
            className={`cb-house-cat ${isSelected ? 'is-selected' : ''}`.trim()}
            style={{
              transform: `translate3d(${Math.round(actor.x)}px, ${Math.round(feetY)}px, 0) translate(-50%, -100%)`,
              zIndex,
            }}
            data-sound="meow"
            aria-label={`${cat.name}，點一下選牠`}
            aria-pressed={isSelected}
            onClick={() => handleTap(cat.id)}
          >
            {isSelected ? <span className="cb-house-tag">{cat.name}</span> : null}
            <CatBody
              pose={pose}
              mood={mood}
              outfit={cat.outfit}
              facing={actor.facing}
              width={HOUSE_SCENE.catWidth}
              pivot
              quiet={actor.action === 'nuzzle'}
            />
          </button>
        );
      })}

      {nuzzle ? (
        <span
          className="cb-house-heart"
          aria-hidden="true"
          style={{
            transform: `translate3d(${Math.round(nuzzle.x)}px, ${Math.round(wallHeight + nuzzle.y - HOUSE_SCENE.catWidth * 0.92)}px, 0) translate(-50%, -100%)`,
          }}
        >
          ♥
        </span>
      ) : null}
    </div>
  );
}
