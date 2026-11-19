import { useEffect, useRef, useState } from 'react';
import {
  CAT_HINT,
  PET_VIEW_H,
  PET_VIEW_W,
  ROAM_BLOCK_CHECK_MS,
  ROAM_CALM_AFTER_INPUT_MS,
  ROAM_DRAG_HOLD_MS,
  ROAM_DRAG_SLOP,
  ROAM_EDGE,
  ROAM_GRAB_Y,
  ROAM_GRAVITY,
  ROAM_GROOM_MS,
  ROAM_HOME_SNAP,
  ROAM_JUMP_LIFT,
  ROAM_JUMP_MS,
  ROAM_LAND_MS,
  ROAM_MIN_TRIP,
  ROAM_NAP_MS,
  ROAM_PERCH_MARGIN,
  ROAM_ROUTES,
  ROAM_RUN_SPEED,
  ROAM_SHY_MS,
  ROAM_SIT_MS,
  ROAM_WALK_SPEED,
  ROAM_WIDTH,
} from '../../core/constants/pet';
import { CAT_HINT_LINES } from '../../core/constants/catLines';
import type { CatMood, PetPose, RoamBehavior } from '../../core/types';
import type { World } from '../../core/world';
import { soundOn } from '../../selectors/sound';
import { currentOutfit } from '../../selectors/wardrobe';
import { CatBody } from '../kit/CatBody';
import { useCatBubble, useCatVoice } from '../kit/catVoice';
import { playSound } from '../sound';
import { useWorld } from '../useWorld';
import { between, clamp, jumpPoint, perchOffset, pickBehavior, pickWalkTarget, stepWalk } from './petLogic';
import { getPet, petHome, subscribePet } from './petStore';

const W = ROAM_WIDTH;
const H = (ROAM_WIDTH * PET_VIEW_H) / PET_VIEW_W;
/** 不能待在上面的東西 */
const INTERACTIVE = 'button, a[href], input, select, textarea, label, [role="button"], [role="switch"], [role="tab"]';
/** 沒有標記動線時的預設 */
const DEFAULT_ROUTE: Record<RoamBehavior, number> = { walk: 2, sit: 2, groom: 2, nap: 1, perch: 1, zoom: 0.5 };

/** perch＝站在某個元素的上緣；drop＝改站在上緣往下這麼多的地方（提示時坐進選項裡面，不擋到上一個選項的字） */
type Surface = { kind: 'floor' } | { kind: 'perch'; el: Element; dx: number; drop?: number };
type Mode =
  | { kind: 'idle'; until: number }
  | { kind: 'walk'; to: number; speed: number }
  | { kind: 'jump'; from: { x: number; y: number }; to: { x: number; y: number }; start: number; land: Surface | 'home' }
  | { kind: 'fall'; vy: number }
  | { kind: 'land'; until: number }
  | { kind: 'drag' }
  | { kind: 'goHome' };

interface Engine {
  x: number;
  y: number;
  surface: Surface;
  mode: Mode;
  lastInput: number;
  shyUntil: number;
  lastBlockCheck: number;
  /** 回家：先走到家底下，再跳進去 */
  homeTrip: boolean;
  /**
   * 想太久的提示進行中：right＝牠猜的對不對、auto＝提示完自己回家、answered＝她作答了（該揭曉了）；
   * stage：wait＝跳過去、坐在選項上等她作答；cheer＝猜對了原地跳；done＝揭曉完，等著離開
   */
  hint: { right: boolean; auto: boolean; answered: boolean; stage: 'wait' | 'cheer' | 'done' } | null;
}

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? '';
}

function rectOf(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

/** 地面：分頁列在底部時是分頁列上緣；刷題設定頁的開始鈕（data-cat-floor）在畫面下半部時，站在它上面 */
function floorY(): number {
  const vh = window.innerHeight;
  let y = vh;
  const tabs = document.querySelector('.cb-tabs');
  if (tabs) {
    const r = rectOf(tabs);
    if (r.top > vh / 2) y = Math.min(y, r.top);
  }
  for (const el of document.querySelectorAll('[data-cat-floor]')) {
    const r = rectOf(el);
    if (r.height > 0 && r.top > vh / 2) y = Math.min(y, r.top);
  }
  return y - H + 2;
}

/** 左右邊界：內容區的左右 */
function xRange(): { min: number; max: number } {
  const main = document.querySelector('.cb-container') ?? document.querySelector('.cb-main');
  const r = main ? rectOf(main) : { left: 0, right: window.innerWidth };
  return { min: Math.max(ROAM_EDGE, r.left), max: Math.min(window.innerWidth - ROAM_EDGE, r.right) - W };
}

/** 畫面上看得到、跳得上去的卡片 */
function visiblePerches(floor: number): Element[] {
  return [...document.querySelectorAll('[data-cat-perch]')].filter((el) => {
    const r = rectOf(el);
    return r.width > W * 1.5 && r.top > ROAM_PERCH_MARGIN && r.top < floor - ROAM_PERCH_MARGIN;
  });
}

/** 家在哪：這一頁看得到的頭像優先；沒有就用分頁列的「小貓」（data-cat-home="tab"） */
function homeRect(): DOMRect | null {
  const vh = window.innerHeight;
  const homes = [...document.querySelectorAll('[data-cat-home]')];
  const ordered = [...homes.filter((el) => el.getAttribute('data-cat-home') !== 'tab'), ...homes.filter((el) => el.getAttribute('data-cat-home') === 'tab')];
  for (const el of ordered) {
    const r = rectOf(el);
    if (r.width > 0 && r.bottom > 0 && r.top < vh) return r;
  }
  return null;
}

/** 這個位置的小貓腳下或身上有沒有按鈕之類可以點的東西 */
function blockedAt(x: number, y: number, layer: Element | null): boolean {
  const points: Array<[number, number]> = [
    [x + W * 0.25, y + H * 0.55],
    [x + W * 0.75, y + H * 0.55],
    [x + W * 0.5, y + H * 0.9],
  ];
  for (const [px, py] of points) {
    const hit = document.elementsFromPoint(px, py).find((el) => !layer?.contains(el));
    if (hit?.closest(INTERACTIVE)) return true;
  }
  return false;
}

export interface PetLayerProps {
  world: World;
  /** 動線（ROAM_ROUTES 的 key）：目前分頁，答題中是 round */
  tab: string;
  /** 模擬考中為 false：小貓自動回家，讓她專心 */
  allowed: boolean;
}

/** 自由亂跑的小貓：從頭像鑽出來、沿地面逛、跳上卡片、可以拎起來放回家。 */
export function PetLayer({ world, tab, allowed }: PetLayerProps) {
  useWorld(world);
  const outfit = currentOutfit(world);
  const [out, setOut] = useState(getPet().out);
  const [pose, setPose] = useState<PetPose>('hop');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [flags, setFlags] = useState({ shy: false, dragging: false, landing: false, emerging: false, hinting: false });
  /** 提示揭曉時的表情（得意、心虛）；平常照姿勢預設 */
  const [mood, setMood] = useState<CatMood | undefined>(undefined);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const seqRef = useRef(getPet().seq);
  const drag = useRef<{ id: number; sx: number; sy: number; t0: number; lastX: number; active: boolean } | null>(null);
  const voice = useCatVoice();
  const { bubble, say } = useCatBubble();
  /** 畫面上現在的樣子（主迴圈、點擊、提示都經過 show 改，才不會各改各的對不起來） */
  const shown = useRef<{ pose: PetPose; facing: 'left' | 'right'; shy: boolean }>({ pose: 'hop', facing: 'right', shy: false });
  const show = (p: PetPose, f: 'left' | 'right' = shown.current.facing) => {
    if (p !== shown.current.pose) setPose(p);
    if (f !== shown.current.facing) setFacing(f);
    shown.current = { ...shown.current, pose: p, facing: f };
  };
  /** 提示結束（揭曉完、或牠掉下去了）：表情、點擊穿透都復原 */
  const endHint = (e: Engine) => {
    e.hint = null;
    setMood(undefined);
    setFlags((f) => ({ ...f, hinting: false }));
  };

  // 跟著 store：放出來、叫回家
  useEffect(
    () =>
      subscribePet(() => {
        const s = getPet();
        setOut(s.out);
        if (s.seq === seqRef.current) return;
        seqRef.current = s.seq;
        const e = engine.current;
        if (s.request?.kind === 'release') {
          const from = { x: s.request.from.left + s.request.from.width / 2 - W / 2, y: s.request.from.top + s.request.from.height / 2 - H / 2 };
          const range = xRange();
          const toX = clamp(from.x + (from.x < window.innerWidth / 2 ? 40 : -40), range.min, range.max);
          engine.current = {
            x: from.x,
            y: from.y,
            surface: { kind: 'floor' },
            mode: { kind: 'jump', from, to: { x: toX, y: floorY() }, start: performance.now(), land: { kind: 'floor' } },
            lastInput: 0,
            shyUntil: 0,
            lastBlockCheck: 0,
            homeTrip: false,
            hint: null,
          };
          show('hop');
          setFlags((f) => ({ ...f, emerging: true }));
          window.setTimeout(() => setFlags((f) => ({ ...f, emerging: false })), ROAM_JUMP_MS);
        } else if (s.request?.kind === 'recall' && e) {
          e.homeTrip = true;
          e.mode = { kind: 'goHome' };
          if (e.hint) endHint(e);
        } else if (s.request?.kind === 'hint') {
          const { el, right, auto, from } = s.request;
          // 被拎著、正要回家、上一個提示還沒結束：這次不提示
          if (!auto && e && (e.mode.kind === 'drag' || e.homeTrip || e.hint)) return;
          const r = rectOf(el);
          // 坐進選項裡、蓋在左邊的代號（A–D）上：牠自己就是記號，不擋到選項的字，也不擋到上一個選項
          const tx = r.left + CAT_HINT.seat.dx;
          const drop = r.height - CAT_HINT.seat.up;
          const start =
            !auto && e ? { x: e.x, y: e.y } : { x: from.left + from.width / 2 - W / 2, y: from.top + from.height / 2 - H / 2 };
          engine.current = {
            x: start.x,
            y: start.y,
            surface: !auto && e ? e.surface : { kind: 'floor' },
            lastInput: !auto && e ? e.lastInput : 0,
            shyUntil: 0,
            lastBlockCheck: 0,
            homeTrip: false,
            hint: { right, auto, answered: false, stage: 'wait' },
            mode: {
              kind: 'jump',
              from: start,
              to: { x: tx, y: r.top - H + 3 + drop },
              start: performance.now(),
              land: { kind: 'perch', el, dx: tx - r.left, drop },
            },
          };
          show('hop', tx > start.x ? 'right' : 'left');
          setFlags((f) => ({ ...f, hinting: true, landing: false }));
        }
      }),
    [],
  );

  // 模擬考開始：直接回家
  useEffect(() => {
    if (!allowed && getPet().out) petHome();
  }, [allowed]);

  // 提示中她作答了：記下來，主迴圈在牠坐定後揭曉（還在跳就等落地）
  useEffect(
    () =>
      world.bus.on('answered', () => {
        const e = engine.current;
        if (!e?.hint || e.hint.stage !== 'wait') return;
        e.hint.answered = true;
        if (e.mode.kind === 'idle') e.mode.until = 0;
      }),
    [world],
  );

  // 她捲動或點畫面：小貓變淡讓路，而且一陣子只做原地的動作
  useEffect(() => {
    if (!out) return undefined;
    const bump = (e: Event) => {
      const en = engine.current;
      if (!en) return;
      if (e.target instanceof Node && actorRef.current?.contains(e.target)) return;
      const now = performance.now();
      en.lastInput = now;
      if (e.type === 'scroll') en.shyUntil = now + ROAM_SHY_MS;
    };
    document.addEventListener('pointerdown', bump, true);
    document.addEventListener('scroll', bump, true);
    return () => {
      document.removeEventListener('pointerdown', bump, true);
      document.removeEventListener('scroll', bump, true);
    };
  }, [out]);

  // 主迴圈
  useEffect(() => {
    if (!out) return undefined;
    let raf = 0;
    let last = performance.now();

    const surfaceY = (s: Surface): number | null => {
      if (s.kind === 'floor') return floorY();
      if (!s.el.isConnected) return null;
      const r = rectOf(s.el);
      if (r.top < ROAM_PERCH_MARGIN / 2 || r.top > floorY()) return null;
      return r.top - H + 3 + (s.drop ?? 0);
    };

    const next = (e: Engine, now: number) => {
      const floor = floorY();
      const perches = visiblePerches(floor);
      const unavailable = new Set<RoamBehavior>();
      if (perches.length === 0 || e.surface.kind === 'perch') unavailable.add('perch');
      if (e.surface.kind === 'perch') {
        unavailable.add('zoom');
      }
      const route = ROAM_ROUTES[tabRef.current] ?? DEFAULT_ROUTE;
      const calm = now - e.lastInput < ROAM_CALM_AFTER_INPUT_MS;
      const b = pickBehavior(route, Math.random, { calm, unavailable });
      const range = xRange();
      const layer = layerRef.current;
      const bounds =
        e.surface.kind === 'perch'
          ? (() => {
              const r = rectOf(e.surface.el);
              return { min: r.left + ROAM_EDGE, max: r.right - W - ROAM_EDGE };
            })()
          : range;

      if (b === 'walk' || b === 'zoom') {
        const to =
          b === 'zoom'
            ? e.x < (bounds.min + bounds.max) / 2
              ? bounds.max
              : bounds.min
            : pickWalkTarget(e.x, bounds.min, bounds.max, ROAM_MIN_TRIP, Math.random, (x) => blockedAt(x, e.y, layer));
        if (to !== null) {
          e.mode = { kind: 'walk', to, speed: b === 'zoom' ? ROAM_RUN_SPEED : ROAM_WALK_SPEED };
          show(b === 'zoom' ? 'run' : 'walk', to > e.x ? 'right' : 'left');
          return;
        }
      }
      if (b === 'perch') {
        const el = perches[Math.floor(Math.random() * perches.length)];
        const r = el ? rectOf(el) : null;
        // 坐上去時身體會蓋到卡片上方的東西：那裡有按鈕就換個位置，都不行就不跳
        const tx =
          el && r
            ? pickWalkTarget(Number.NaN, r.left + ROAM_EDGE, r.right - W - ROAM_EDGE, 0, Math.random, (x) =>
                blockedAt(x, r.top - H + 3, layer),
              )
            : null;
        if (el && r && tx !== null) {
          e.mode = { kind: 'jump', from: { x: e.x, y: e.y }, to: { x: tx, y: r.top - H + 3 }, start: now, land: { kind: 'perch', el, dx: tx - r.left } };
          show('hop', tx > e.x ? 'right' : 'left');
          return;
        }
      }
      const restPose: PetPose = b === 'groom' ? 'groom' : b === 'nap' ? 'loaf' : 'sit';
      const range2 = b === 'groom' ? ROAM_GROOM_MS : b === 'nap' ? ROAM_NAP_MS : ROAM_SIT_MS;
      e.mode = { kind: 'idle', until: now + between(range2, Math.random) };
      show(restPose);
    };

    /** 一個動作做完了，接下來做什麼：提示進行中照提示的步驟走，不然隨機挑下一個 */
    const proceed = (e: Engine, now: number) => {
      const h = e.hint;
      if (h?.stage === 'wait' && !h.answered) {
        // 坐在選項上等她作答（不會自己走開）
        e.mode = { kind: 'idle', until: Number.POSITIVE_INFINITY };
        show('sit');
        say(pickLine(CAT_HINT_LINES.point));
        return;
      }
      if (h?.stage === 'wait') {
        // 揭曉：猜對了得意地原地跳，猜錯了心虛
        setMood(h.right ? 'yay' : 'oops');
        say(pickLine(h.right ? CAT_HINT_LINES.right : CAT_HINT_LINES.wrong));
        if (h.right) {
          h.stage = 'cheer';
          e.mode = { kind: 'jump', from: { x: e.x, y: e.y }, to: { x: e.x, y: e.y }, start: now, land: e.surface };
          show('hop');
        } else {
          h.stage = 'done';
          e.mode = { kind: 'idle', until: now + CAT_HINT.revealMs };
          show('stumble');
        }
        return;
      }
      if (h?.stage === 'cheer') {
        h.stage = 'done';
        e.mode = { kind: 'idle', until: now + CAT_HINT.revealMs };
        show('sit');
        return;
      }
      if (h) {
        endHint(e);
        if (h.auto) {
          e.homeTrip = true;
          e.mode = { kind: 'goHome' };
          return;
        }
        // 本來就在外面玩的：跳回地面，不賴在選項上擋字
        e.mode = { kind: 'jump', from: { x: e.x, y: e.y }, to: { x: e.x, y: floorY() }, start: now, land: { kind: 'floor' } };
        show('hop');
        return;
      }
      next(e, now);
    };

    const tick = (now: number) => {
      const e = engine.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (e) {
        const m = e.mode;
        if (m.kind === 'jump') {
          const t = (now - m.start) / ROAM_JUMP_MS;
          // 目標若是卡片，跟著捲動更新落點
          let to = m.to;
          if (m.land !== 'home' && m.land.kind === 'perch') {
            const y = surfaceY(m.land);
            if (y === null) {
              e.surface = { kind: 'floor' };
              e.mode = { kind: 'fall', vy: 0 };
            } else {
              to = { x: rectOf(m.land.el).left + m.land.dx, y };
            }
          } else if (m.land !== 'home') {
            to = { x: m.to.x, y: floorY() };
          }
          if (e.mode === m) {
            const p = jumpPoint(m.from, to, ROAM_JUMP_LIFT, t);
            e.x = p.x;
            e.y = p.y;
            if (t >= 1) {
              if (m.land === 'home') {
                petHome();
                return;
              }
              e.surface = m.land;
              e.mode = { kind: 'land', until: now + ROAM_LAND_MS };
              setFlags((f) => ({ ...f, landing: true }));
              show('stand');
            }
          }
        } else if (m.kind === 'fall') {
          m.vy += ROAM_GRAVITY * dt;
          e.y += m.vy * dt;
          const landY = surfaceY(e.surface) ?? floorY();
          if (e.y >= landY) {
            e.y = landY;
            e.mode = { kind: 'land', until: now + ROAM_LAND_MS };
            setFlags((f) => ({ ...f, landing: true }));
            show('stumble');
          }
        } else if (m.kind === 'land') {
          const y = surfaceY(e.surface);
          if (y !== null) e.y = y;
          if (now >= m.until) {
            setFlags((f) => ({ ...f, landing: false }));
            proceed(e, now);
          }
        } else if (m.kind === 'walk') {
          const step = stepWalk(e.x, m.to, m.speed, dt);
          e.x = step.x;
          // 在卡片上走：把走到的位置寫回 dx（卡片上的 x 只由 dx 決定，之後的原地動作、原地跳都讀它）
          if (e.surface.kind === 'perch' && e.surface.el.isConnected) {
            e.surface.dx = perchOffset(e.x, rectOf(e.surface.el).left);
          }
          if (step.arrived) {
            if (e.homeTrip) {
              const h = homeRect();
              if (h) {
                e.mode = {
                  kind: 'jump',
                  from: { x: e.x, y: e.y },
                  to: { x: h.left + h.width / 2 - W / 2, y: h.top + h.height / 2 - H / 2 },
                  start: now,
                  land: 'home',
                };
                show('hop');
              } else {
                petHome();
                return;
              }
            } else {
              next(e, now);
            }
          }
          const y = surfaceY(e.surface);
          if (y === null) {
            e.surface = { kind: 'floor' };
            e.mode = { kind: 'fall', vy: 0 };
            show('fall');
          } else if (e.mode.kind === 'walk') {
            e.y = y;
          }
        } else if (m.kind === 'goHome') {
          const h = homeRect();
          const range = xRange();
          if (!h) {
            petHome();
            return;
          }
          const to = clamp(h.left + h.width / 2 - W / 2, range.min, range.max);
          if (e.surface.kind === 'perch') {
            e.mode = {
              kind: 'jump',
              from: { x: e.x, y: e.y },
              to: { x: h.left + h.width / 2 - W / 2, y: h.top + h.height / 2 - H / 2 },
              start: now,
              land: 'home',
            };
            show('hop');
          } else {
            e.mode = { kind: 'walk', to, speed: ROAM_RUN_SPEED };
            show('run', to > e.x ? 'right' : 'left');
          }
        } else if (m.kind === 'idle') {
          const y = surfaceY(e.surface);
          if (y === null) {
            e.surface = { kind: 'floor' };
            e.mode = { kind: 'fall', vy: 0 };
            show('fall');
          } else {
            e.y = y;
            if (e.surface.kind === 'perch') e.x = rectOf(e.surface.el).left + e.surface.dx;
            if (now >= m.until) {
              proceed(e, now);
            } else if (now - e.lastBlockCheck > ROAM_BLOCK_CHECK_MS) {
              e.lastBlockCheck = now;
              if (e.surface.kind === 'floor' && blockedAt(e.x, e.y, layerRef.current)) next(e, now);
            }
          }
        }

        // 提示中牠坐的選項捲出畫面了（掉下去）：這次提示作廢
        if (e.hint && e.mode.kind === 'fall') endHint(e);

        const shy = now < e.shyUntil && e.mode.kind !== 'drag';
        if (shy !== shown.current.shy) {
          shown.current = { ...shown.current, shy };
          setFlags((f) => ({ ...f, shy }));
        }
        const actor = actorRef.current;
        if (actor) actor.style.transform = `translate3d(${Math.round(e.x)}px, ${Math.round(e.y)}px, 0)`;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [out]);

  if (!out || !allowed) return null;

  const setHomeTarget = (on: boolean) => {
    for (const el of document.querySelectorAll('[data-cat-home]')) el.classList.toggle('is-target', on);
  };
  const nearHome = (px: number, py: number): boolean => {
    const h = homeRect();
    return (
      !!h &&
      px > h.left - ROAM_HOME_SNAP &&
      px < h.right + ROAM_HOME_SNAP &&
      py > h.top - ROAM_HOME_SNAP &&
      py < h.bottom + ROAM_HOME_SNAP
    );
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, t0: performance.now(), lastX: ev.clientX, active: false };
  };
  const startDrag = () => {
    const e = engine.current;
    if (!e || !drag.current) return;
    drag.current.active = true;
    e.mode = { kind: 'drag' };
    e.homeTrip = false;
    show('dangle');
    setFlags((f) => ({ ...f, dragging: true, landing: false }));
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const e = engine.current;
    if (!d || !e || d.id !== ev.pointerId) return;
    if (!d.active) {
      const moved = Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > ROAM_DRAG_SLOP;
      if (moved || performance.now() - d.t0 > ROAM_DRAG_HOLD_MS) startDrag();
      else return;
    }
    e.x = ev.clientX - W / 2;
    e.y = ev.clientY - H * ROAM_GRAB_Y;
    const swing = clamp((ev.clientX - d.lastX) * -2.5, -25, 25);
    d.lastX = ev.clientX;
    actorRef.current?.style.setProperty('--pet-swing', `${swing}deg`);
    setHomeTarget(nearHome(ev.clientX, ev.clientY));
  };
  const onPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const e = engine.current;
    drag.current = null;
    if (!d || !e) return;
    if (!d.active) {
      // 點一下：喵一聲、說句話、原地跳一下
      if (soundOn(world)) playSound('meow', true);
      const line = voice({ mood: 'idle', place: 'roam' });
      if (line) say(line.text);
      e.mode = { kind: 'jump', from: { x: e.x, y: e.y }, to: { x: e.x, y: e.y }, start: performance.now(), land: e.surface };
      show('hop');
      return;
    }
    setHomeTarget(false);
    actorRef.current?.style.setProperty('--pet-swing', '0deg');
    setFlags((f) => ({ ...f, dragging: false }));
    if (nearHome(ev.clientX, ev.clientY)) {
      petHome();
      return;
    }
    // 放開：掉到下面的卡片上，沒有就掉到地上
    const floor = floorY();
    const below = visiblePerches(floor).find((el) => {
      const r = rectOf(el);
      return ev.clientX > r.left && ev.clientX < r.right && r.top - H + 3 >= e.y;
    });
    e.surface = below ? { kind: 'perch', el: below, dx: clamp(e.x - rectOf(below).left, ROAM_EDGE, rectOf(below).width - W - ROAM_EDGE) } : { kind: 'floor' };
    if (e.surface.kind === 'floor') e.x = clamp(e.x, xRange().min, xRange().max);
    e.mode = { kind: 'fall', vy: 0 };
    show('fall');
  };
  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const e = engine.current;
      if (e) {
        e.homeTrip = true;
        e.mode = { kind: 'goHome' };
      }
    }
  };

  const cls = [
    'cb-pet-actor',
    flags.shy ? 'is-shy' : '',
    flags.dragging ? 'is-dragging' : '',
    flags.landing ? 'is-landing' : '',
    flags.emerging ? 'is-emerging' : '',
    flags.hinting ? 'is-hinting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={layerRef} className="cb-pet-layer">
      <div
        ref={actorRef}
        className={cls}
        style={{ width: W, height: H }}
        role="button"
        tabIndex={0}
        aria-label="小貓：點一下牠會說話，按住可以拎起來，放回頭像就回家；按 Enter 叫牠回家"
        data-sound="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {bubble}
        <div className="cb-pet-actor-inner">
          <CatBody pose={pose} outfit={outfit} facing={facing} width={W} pivot {...(mood ? { mood } : {})} />
        </div>
      </div>
    </div>
  );
}
