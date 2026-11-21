import { useEffect, useRef, useState } from 'react';
import {
  CAT_HINT,
  PET_AXE,
  PET_CHOP_ARM,
  PET_FLY,
  PET_MOO,
  PET_PLAY,
  PET_POUNCE,
  PET_SCORCH,
  PET_SLIDE,
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
import { dispatch } from '../../core/commands';
import {
  CAT_AXE_LINES,
  CAT_CLAW_LINES,
  CAT_DREAM_LINES,
  CAT_FREEZE_LINES,
  CAT_HINT_LINES,
  CAT_MOO_LINES,
  CAT_ROAR_LINES,
  CAT_SCORCH_LINES,
  CAT_SLIDE_LINES,
} from '../../core/constants/catLines';
import { SCORCH } from '../../core/constants/wardrobe';
import type { CatId, CatMood, PetPose, RoamBehavior, ScorchPlace } from '../../core/types';
import type { World } from '../../core/world';
import { catOutfit } from '../../selectors/house';
import { soundOn } from '../../selectors/sound';
import { outfitSpecials, scorchSpotId, scorchedSpots } from '../../selectors/wardrobe';
import { CatBody } from '../kit/CatBody';
import { heldAxe } from '../kit/wardrobe/art';
import { useCatBubble, useCatVoice } from '../kit/catVoice';
import { playSound } from '../sound';
import { useWorld } from '../useWorld';
import { between, clamp, flyLift, gaitFor, jumpPoint, perchOffset, pickBehavior, pickWalkTarget, stepWalk } from './petLogic';
import { CLAW_MARK, ClawMark, FrostMark } from './petMarks';
import { getPet, petHome, subscribePet } from './petStore';
import { CAT_BURN_ATTR, scorchOffset } from './ScorchLayer';

const W = ROAM_WIDTH;
const H = (ROAM_WIDTH * PET_VIEW_H) / PET_VIEW_W;
/** 不能待在上面的東西 */
const INTERACTIVE = 'button, a[href], input, select, textarea, label, [role="button"], [role="switch"], [role="tab"]';
/** 被大斧頭劈歪的卡片（值＝劈在上緣的哪裡：l、m、r）；被老虎吼得抖一下的卡片。CSS 在 pet.css */
const CHOP_ATTR = 'data-cat-chopped';
const SHAKE_ATTR = 'data-cat-shake';
/** 大斧頭拿在舉起來的手上（畫在 CatBody 裡、跟著手臂轉） */
const AXE = heldAxe(PET_CHOP_ARM.len);
/** 沒有標記動線時的預設 */
const DEFAULT_ROUTE: Record<RoamBehavior, number> = { walk: 2, sit: 2, groom: 2, nap: 1, perch: 1, zoom: 0.5 };

/** perch＝站在某個元素的上緣；drop＝改站在上緣往下這麼多的地方（提示時坐進選項裡面，不擋到上一個選項的字） */
type Surface = { kind: 'floor' } | { kind: 'perch'; el: Element; dx: number; drop?: number };
type Mode =
  | { kind: 'idle'; until: number }
  /** hop＝一蹦一蹦地走（青蛙、兔子） */
  | { kind: 'walk'; to: number; speed: number; hop?: boolean }
  /** ms、lift 不給就是一般的跳（ROAM_JUMP_MS、ROAM_JUMP_LIFT）；披風飛行是一個又長又高的跳 */
  | {
      kind: 'jump';
      from: { x: number; y: number };
      to: { x: number; y: number };
      start: number;
      land: Surface | 'home';
      ms?: number;
      lift?: number;
    }
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
  /**
   * 搗蛋進行中（小怪獸噴火、乳牛劈斧頭）：el、place、spot＝要對付的卡片和它上緣的哪一處、facing＝朝哪邊；
   * go＝正跳過去、act＝正在噴或劈
   */
  prank: { kind: 'fire' | 'axe'; el: Element; place: ScorchPlace; spot: string; facing: 'left' | 'right'; stage: 'go' | 'act' } | null;
  /** 老虎撲過去：to＝落點的 x、el＝撲到哪張卡片上（沒有就是地面）；crouch＝伏低扭屁股、air＝撲在空中 */
  pounce: { to: number; el?: Element; stage: 'crouch' | 'air' } | null;
  /** 上一次冒泡泡、說夢話的時間；上一次哞；上一個蜂蜜腳印留在哪（x） */
  lastBitAt: number;
  lastMooAt: number;
  lastPawX: number;
  /** 下一次可以搗蛋（噴火、劈斧頭）的時間 */
  nextPrank: number;
  /** 下一個動作開始前把表情改回預設（燒焦後心虛的臉） */
  resetMood: boolean;
}

/** 剛放出來的小貓 */
function newEngine(at: { x: number; y: number }, mode: Mode): Engine {
  return {
    x: at.x,
    y: at.y,
    surface: { kind: 'floor' },
    mode,
    lastInput: 0,
    shyUntil: 0,
    lastBlockCheck: 0,
    homeTrip: false,
    hint: null,
    prank: null,
    pounce: null,
    nextPrank: performance.now() + between(PET_SCORCH.firstMs, Math.random),
    resetMood: false,
    lastBitAt: 0,
    lastMooAt: 0,
    lastPawX: at.x,
  };
}

/**
 * 小貓身邊冒出來的小東西：泡泡（可以戳破）、蜂蜜腳印、碎屑（dx、dy＝飛去哪）；
 * 和釘在卡片上、跟著卡片走的痕跡（el；dx、top＝離卡片左緣、上緣多遠）：斧頭的裂痕、老虎的爪痕、企鵝的冰（w、h、radius＝卡片的大小與圓角）
 */
interface Bit {
  id: number;
  kind: 'bubble' | 'paw' | 'chip' | 'crack' | 'claw' | 'frost';
  x: number;
  y: number;
  size: number;
  el?: Element;
  dx?: number;
  dy?: number;
  top?: number;
  w?: number;
  h?: number;
  radius?: number;
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
  /** 這一層控制哪一隻小貓 */
  cat: CatId;
  /** 動線（ROAM_ROUTES 的 key）：目前分頁，答題中是 round */
  tab: string;
  /** 模擬考中為 false：小貓自動回家，讓她專心 */
  allowed: boolean;
}

/** 自由亂跑的小貓：從頭像鑽出來、沿地面逛、跳上卡片、可以拎起來放回家。 */
export function PetLayer({ world, cat, tab, allowed }: PetLayerProps) {
  useWorld(world);
  const outfit = catOutfit(world, cat);
  /** 這身穿著的特殊動作、現在燒焦的地方：主迴圈每次挑動作時讀最新的 */
  const specials = useRef(outfitSpecials(outfit));
  specials.current = outfitSpecials(outfit);
  const burnt = useRef(scorchedSpots(world));
  burnt.current = scorchedSpots(world);
  const [out, setOut] = useState(getPet(cat).out);
  const [pose, setPose] = useState<PetPose>('hop');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [flags, setFlags] = useState({ shy: false, dragging: false, landing: false, emerging: false, hinting: false, firing: false, binky: false });
  const [bits, setBits] = useState<Bit[]>([]);
  const bitSeq = useRef(0);
  /** 冒一個泡泡、腳印、裂痕或碎屑，lifeMs 後自己消失；畫面上最多 PET_PLAY.maxBits 個（舊的先擠掉） */
  const addBit = (bit: Omit<Bit, 'id'>, lifeMs: number) => {
    bitSeq.current += 1;
    const id = bitSeq.current;
    setBits((prev) => [...prev.slice(-(PET_PLAY.maxBits - 1)), { ...bit, id }]);
    window.setTimeout(() => setBits((prev) => prev.filter((other) => other.id !== id)), lifeMs);
  };
  /** 裂痕跟著卡片走：主迴圈每一格照卡片的位置重放 */
  /** 釘在卡片上的痕跡（裂痕、抓痕、冰）：主迴圈每一格照卡片的位置重放 */
  const pins = useRef(new Map<number, HTMLDivElement>());
  const pinRef = (id: number) => (node: HTMLDivElement | null) => {
    if (node) pins.current.set(id, node);
    else pins.current.delete(id);
  };
  const bitsRef = useRef(bits);
  bitsRef.current = bits;
  /** 卡片上的標記（劈歪、抖一下）lifeMs 後拿掉；同一張卡片再被標一次就重新計時、動畫重播 */
  const marks = useRef(new WeakMap<Element, Map<string, number>>());
  const markCard = (el: Element, attr: string, value: string, lifeMs: number) => {
    const timers = marks.current.get(el) ?? new Map<string, number>();
    marks.current.set(el, timers);
    window.clearTimeout(timers.get(attr));
    el.removeAttribute(attr);
    // 先拿掉再加回去，動畫才會從頭播
    void (el as HTMLElement).offsetWidth;
    el.setAttribute(attr, value);
    timers.set(
      attr,
      window.setTimeout(() => el.removeAttribute(attr), lifeMs),
    );
  };
  /** 提示揭曉時的表情（得意、心虛）；平常照姿勢預設 */
  const [mood, setMood] = useState<CatMood | undefined>(undefined);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const seqRef = useRef(getPet(cat).seq);
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
  /** 叫牠回家：噴火、劈斧頭、撲到一半也作罷（還沒劈下去的那幾下不會再落在卡片上） */
  const goHome = (e: Engine) => {
    e.homeTrip = true;
    e.mode = { kind: 'goHome' };
    e.prank = null;
    e.pounce = null;
    setFlags((f) => ({ ...f, firing: false }));
  };
  /** 提示結束（揭曉完、或牠掉下去了）：表情、點擊穿透都復原 */
  const endHint = (e: Engine) => {
    e.hint = null;
    setMood(undefined);
    setFlags((f) => ({ ...f, hinting: false }));
  };

  // 跟著 store：放出來、叫回家
  useEffect(() => {
    const init = getPet(cat);
    setOut(init.out);
    seqRef.current = init.seq;
    const off = subscribePet(() => {
      const s = getPet(cat);
      setOut(s.out);
      if (s.seq === seqRef.current) return;
      seqRef.current = s.seq;
      const e = engine.current;
      if (s.request?.kind === 'release') {
        const from = { x: s.request.from.left + s.request.from.width / 2 - W / 2, y: s.request.from.top + s.request.from.height / 2 - H / 2 };
        const range = xRange();
        const toX = clamp(from.x + (from.x < window.innerWidth / 2 ? 40 : -40), range.min, range.max);
        engine.current = newEngine(from, {
          kind: 'jump',
          from,
          to: { x: toX, y: floorY() },
          start: performance.now(),
          land: { kind: 'floor' },
        });
        show('hop');
        setFlags((f) => ({ ...f, emerging: true }));
        window.setTimeout(() => setFlags((f) => ({ ...f, emerging: false })), ROAM_JUMP_MS);
      } else if (s.request?.kind === 'recall' && e) {
        goHome(e);
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
        const en =
          !auto && e
            ? e
            : newEngine(start, { kind: 'idle', until: 0 });
        en.hint = { right, auto, answered: false, stage: 'wait' };
        en.prank = null;
        en.pounce = null;
        en.mode = {
          kind: 'jump',
          from: start,
          to: { x: tx, y: r.top - H + 3 + drop },
          start: performance.now(),
          land: { kind: 'perch', el, dx: tx - r.left, drop },
        };
        engine.current = en;
        show('hop', tx > start.x ? 'right' : 'left');
        setFlags((f) => ({ ...f, hinting: true, landing: false, firing: false }));
      }
    });
    return () => {
      off();
      petHome(cat);
    };
  }, [cat]);

  // 模擬考開始：直接回家
  useEffect(() => {
    if (!allowed && getPet(cat).out) petHome(cat);
  }, [allowed, cat]);

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

    /**
     * 斧頭劈到卡片：第一下把卡片劈歪（PET_AXE.sagMs 後彈回來）、在劈到的地方留一道裂痕；每一下都噴出碎屑。
     * 劈到的地方＝小貓圖寬的 reach 成處（面向左鏡像），落在卡片上緣
     */
    const chopHit = (e: Engine, prank: NonNullable<Engine['prank']>, first: boolean) => {
      const el = prank.el;
      if (!el.isConnected) return;
      const r = rectOf(el);
      const hitX = clamp(e.x + W * (prank.facing === 'right' ? PET_AXE.reach : 1 - PET_AXE.reach), r.left, r.right);
      if (first) {
        // 歪多久給 CSS 讀（cb-chop-sag 的長度）
        if (el instanceof HTMLElement) el.style.setProperty('--cat-chop-ms', `${PET_AXE.sagMs}ms`);
        markCard(el, CHOP_ATTR, prank.place, PET_AXE.sagMs);
        addBit({ kind: 'crack', x: hitX, y: r.top, size: 0, el, dx: hitX - r.left, top: 0 }, PET_AXE.sagMs);
      }
      const chips = PET_AXE.chips;
      for (let i = 0; i < chips.count; i += 1) {
        const away = (prank.facing === 'right' ? 1 : -1) * (8 + Math.random() * 28);
        addBit(
          { kind: 'chip', x: hitX - chips.size / 2, y: r.top - chips.size / 2, size: chips.size, dx: away, dy: -(14 + Math.random() * 26) },
          chips.ms,
        );
      }
    };

    /** 企鵝滑完：看得到的卡片結冰（蓋一層冰、底下掛冰柱），freezeMs 後退冰 */
    const freezeCards = () => {
      const cards = visiblePerches(floorY());
      for (const el of cards) {
        const r = rectOf(el);
        addBit(
          { kind: 'frost', x: r.left, y: r.top, size: 0, el, dx: 0, top: 0, w: r.width, h: r.height, radius: Number.parseFloat(getComputedStyle(el).borderRadius) || 0 },
          PET_SLIDE.freezeMs,
        );
      }
      if (cards.length > 0) say(pickLine(CAT_FREEZE_LINES));
    };

    const surfaceY = (s: Surface): number | null => {
      if (s.kind === 'floor') return floorY();
      if (!s.el.isConnected) return null;
      const r = rectOf(s.el);
      if (r.top < ROAM_PERCH_MARGIN / 2 || r.top > floorY()) return null;
      return r.top - H + 3 + (s.drop ?? 0);
    };

    const next = (e: Engine, now: number) => {
      // 重新挑動作＝之前排好的撲擊作罷（例如伏低到一半發現腳下有按鈕，被叫去換位置）
      e.pounce = null;
      const floor = floorY();
      const perches = visiblePerches(floor);
      const unavailable = new Set<RoamBehavior>();
      if (perches.length === 0 || e.surface.kind === 'perch') unavailable.add('perch');
      if (e.surface.kind === 'perch') {
        unavailable.add('zoom');
      }
      const baseRoute = ROAM_ROUTES[tabRef.current] ?? DEFAULT_ROUTE;
      // 睡衣全套：特別愛睡
      const route = specials.current.has('dream') ? { ...baseRoute, nap: baseRoute.nap * PET_PLAY.dream.napWeight } : baseRoute;
      const calm = now - e.lastInput < ROAM_CALM_AFTER_INPUT_MS;
      const range = xRange();
      const layer = layerRef.current;

      // 特殊動作：搗蛋——小怪獸全套加噴火、乳牛全套加牧草（大斧頭）。時間到了就跳上一張卡片，
      // 挑上緣還沒燒焦的一處（左、中、右）對著它噴火或劈下去
      const prankKind = specials.current.has('scorch') ? 'fire' : specials.current.has('axe') ? 'axe' : null;
      const prankTiming = prankKind === 'axe' ? PET_AXE : PET_SCORCH;
      if (!calm && prankKind && now >= e.nextPrank) {
        e.nextPrank = now + prankTiming.retryMs;
        const mark = PET_SCORCH.mark;
        /** 對付某一處時小貓站哪、朝哪：左邊那處站在它右邊朝左，中間和右邊站在它左邊朝右 */
        const stance = (r: DOMRect, place: ScorchPlace) => {
          const markX = r.left + scorchOffset(r.width, place);
          return place === 'l'
            ? { x: markX + mark.w - ROAM_EDGE, facing: 'left' as const }
            : { x: markX - W + ROAM_EDGE, facing: 'right' as const };
        };
        const targets: Array<{ el: Element; place: ScorchPlace; spot: string; x: number; facing: 'left' | 'right' }> = [];
        // 噴火會留下焦痕，滿了就不噴；劈歪的卡片一下子就彈回來，不受焦痕的數量限制，但不劈正歪著的卡片
        if (prankKind === 'axe' || burnt.current.length < SCORCH.max) {
          for (const el of perches) {
            const card = el.getAttribute(CAT_BURN_ATTR);
            const r = rectOf(el);
            if (!card || r.width < (W + mark.w) * 2 || el.hasAttribute(CHOP_ATTR)) continue;
            for (const place of SCORCH.places) {
              const spot = scorchSpotId(card, place);
              // 不疊在焦痕上（第一版的存檔只記卡片 ID，那一處就是右邊）
              if (burnt.current.includes(spot) || (place === 'r' && burnt.current.includes(card))) continue;
              const at = stance(r, place);
              if (!blockedAt(at.x, r.top - H + 3, layer)) targets.push({ el, place, spot, ...at });
            }
          }
        }
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (target) {
          const r = rectOf(target.el);
          e.prank = { kind: prankKind, el: target.el, place: target.place, spot: target.spot, facing: target.facing, stage: 'go' };
          e.nextPrank = now + between(prankTiming.everyMs, Math.random);
          e.mode = {
            kind: 'jump',
            from: { x: e.x, y: e.y },
            to: { x: target.x, y: r.top - H + 3 },
            start: now,
            land: { kind: 'perch', el: target.el, dx: target.x - r.left },
          };
          show('hop', target.x > e.x ? 'right' : 'left');
          return;
        }
      }

      const b = pickBehavior(route, Math.random, { calm, unavailable });
      const bounds =
        e.surface.kind === 'perch'
          ? (() => {
              const r = rectOf(e.surface.el);
              return { min: r.left + ROAM_EDGE, max: r.right - W - ROAM_EDGE };
            })()
          : range;

      // 特殊動作：老虎全套——要走路或暴衝時，有時改成伏低扭屁股、撲到遠處的地面（在卡片上也會撲下來；答題頁不撲，她要專心）
      if (
        (b === 'walk' || b === 'zoom') &&
        specials.current.has('pounce') &&
        tabRef.current !== 'round' &&
        Math.random() < PET_POUNCE.chance
      ) {
        // 優先撲到一張卡片上（抓花它），沒有卡片可以撲就撲到地面
        const cards = perches.filter((el) => el !== (e.surface.kind === 'perch' ? e.surface.el : null));
        const card = Math.random() < PET_POUNCE.onCard ? cards[Math.floor(Math.random() * cards.length)] : undefined;
        const cr = card ? rectOf(card) : null;
        const onCard =
          card && cr
            ? pickWalkTarget(Number.NaN, cr.left + ROAM_EDGE, cr.right - W - ROAM_EDGE, 0, Math.random, (x) => blockedAt(x, cr.top - H + 3, layer))
            : null;
        const to =
          onCard ?? pickWalkTarget(e.x, range.min, range.max, PET_POUNCE.minTrip, Math.random, (x) => blockedAt(x, floor, layer));
        if (to !== null) {
          e.pounce = { to, stage: 'crouch', ...(onCard !== null && card ? { el: card } : {}) };
          e.mode = { kind: 'idle', until: now + PET_POUNCE.crouchMs };
          show('crouch', to > e.x ? 'right' : 'left');
          return;
        }
      }

      // 特殊動作：披著披風——要走路或暴衝時，有時改用飛的飛到另一邊
      // （在卡片上也可以起飛：飛下來落在地面的另一邊）
      if ((b === 'walk' || b === 'zoom') && specials.current.has('fly') && Math.random() < PET_FLY.chance) {
        const to = e.x < (range.min + range.max) / 2 ? range.max : range.min;
        const trip = Math.abs(to - e.x);
        if (trip >= PET_FLY.minTrip) {
          e.mode = {
            kind: 'jump',
            from: { x: e.x, y: e.y },
            to: { x: to, y: floor },
            start: now,
            land: { kind: 'floor' },
            ms: (trip / PET_FLY.speed) * 1000,
            lift: flyLift(e.y, floor, PET_FLY.lift),
          };
          show('fly', to > e.x ? 'right' : 'left');
          return;
        }
      }
      if (b === 'walk' || b === 'zoom') {
        const to =
          b === 'zoom'
            ? e.x < (bounds.min + bounds.max) / 2
              ? bounds.max
              : bounds.min
            : pickWalkTarget(e.x, bounds.min, bounds.max, ROAM_MIN_TRIP, Math.random, (x) => blockedAt(x, e.y, layer));
        if (to !== null) {
          // 步態看穿著：青蛙、兔子一蹦一蹦；乳牛站起來走；企鵝搖搖擺擺、暴衝改成用肚子滑
          const gait = gaitFor(specials.current);
          const walkPose = b === 'zoom' ? gait.zoom : gait.walk;
          e.mode = { kind: 'walk', to, speed: b === 'zoom' ? ROAM_RUN_SPEED : ROAM_WALK_SPEED, ...(gait.hop ? { hop: true } : {}) };
          show(walkPose, to > e.x ? 'right' : 'left');
          if (walkPose === 'slide' && Math.random() < PET_SLIDE.cheer) say(pickLine(CAT_SLIDE_LINES));
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
      const restPose: PetPose = b === 'groom' ? 'groom' : b === 'nap' ? 'loaf' : gaitFor(specials.current).rest;
      const range2 = b === 'groom' ? ROAM_GROOM_MS : b === 'nap' ? ROAM_NAP_MS : ROAM_SIT_MS;
      e.mode = { kind: 'idle', until: now + between(range2, Math.random) };
      show(restPose);
    };

    /** 一個動作做完了，接下來做什麼：提示進行中照提示的步驟走，不然隨機挑下一個 */
    const proceed = (e: Engine, now: number) => {
      if (e.resetMood) {
        e.resetMood = false;
        setMood(undefined);
      }
      const prank = e.prank;
      if (prank?.stage === 'go') {
        // 落在卡片上了：面向那一處，噴一大口，或舉起斧頭劈幾下
        prank.stage = 'act';
        if (prank.kind === 'fire') {
          e.mode = { kind: 'idle', until: now + PET_SCORCH.blastMs };
          show('stand', prank.facing);
          setFlags((f) => ({ ...f, firing: true }));
        } else {
          e.mode = { kind: 'idle', until: now + PET_AXE.swingMs * PET_AXE.swings };
          show('chop', prank.facing);
          // 每一下劈到底（動畫的 PET_AXE.hitAt 處）時卡片才受力
          for (let i = 0; i < PET_AXE.swings; i += 1) {
            window.setTimeout(() => {
              if (e.prank === prank) chopHit(e, prank, i === 0);
            }, PET_AXE.swingMs * (i + PET_AXE.hitAt));
          }
        }
        return;
      }
      if (prank?.kind === 'fire') {
        // 噴完：那個角落焦了，牠心虛一下
        e.prank = null;
        setFlags((f) => ({ ...f, firing: false }));
        dispatch(world, { type: 'scorch', spot: prank.spot });
        setMood('oops');
        e.resetMood = true;
        say(pickLine(CAT_SCORCH_LINES));
        e.mode = { kind: 'idle', until: now + PET_SCORCH.sorryMs };
        show('stumble');
        return;
      }
      if (prank) {
        // 劈完：得意地站著
        e.prank = null;
        setMood('yay');
        e.resetMood = true;
        say(pickLine(CAT_AXE_LINES));
        e.mode = { kind: 'idle', until: now + PET_SCORCH.sorryMs };
        show(gaitFor(specials.current).rest);
        return;
      }
      const pounce = e.pounce;
      if (pounce?.stage === 'crouch') {
        // 扭完屁股：撲出去
        pounce.stage = 'air';
        const trip = Math.abs(pounce.to - e.x);
        const card = pounce.el?.isConnected ? rectOf(pounce.el) : null;
        e.mode = {
          kind: 'jump',
          from: { x: e.x, y: e.y },
          to: { x: pounce.to, y: card ? card.top - H + 3 : floorY() },
          start: now,
          land: pounce.el && card ? { kind: 'perch', el: pounce.el, dx: pounce.to - card.left } : { kind: 'floor' },
          ms: Math.max(ROAM_JUMP_MS, (trip / PET_POUNCE.speed) * 1000),
          lift: PET_POUNCE.lift,
        };
        show('run', pounce.to > e.x ? 'right' : 'left');
        return;
      }
      if (pounce) {
        // 落地：吼一聲，看得到的卡片嚇得抖一下；撲在卡片上的話，前腳那裡留下抓痕
        e.pounce = null;
        setMood('yay');
        e.resetMood = true;
        const clawEl = pounce.el && e.surface.kind === 'perch' && e.surface.el === pounce.el && pounce.el.isConnected ? pounce.el : null;
        if (clawEl) {
          const r = rectOf(clawEl);
          const pawX = e.x + W * (shown.current.facing === 'right' ? 0.72 : 0.28);
          addBit(
            { kind: 'claw', x: pawX, y: r.top - CLAW_MARK.rise, size: 0, el: clawEl, dx: pawX - r.left, top: -CLAW_MARK.rise },
            PET_POUNCE.clawMs,
          );
        }
        say(pickLine(clawEl ? CAT_CLAW_LINES : CAT_ROAR_LINES));
        for (const el of visiblePerches(floorY())) markCard(el, SHAKE_ATTR, '', PET_POUNCE.shakeMs);
        e.mode = { kind: 'idle', until: now + PET_POUNCE.roarMs };
        show('stand');
        return;
      }
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
      if (e.homeTrip) {
        e.mode = { kind: 'goHome' };
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
          const t = (now - m.start) / (m.ms ?? ROAM_JUMP_MS);
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
            const p = jumpPoint(m.from, to, m.lift ?? ROAM_JUMP_LIFT, t);
            e.x = p.x;
            e.y = p.y;
            if (t >= 1) {
              if (m.land === 'home') {
                petHome(cat);
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
            // 企鵝用肚子滑到底：卡片都結冰
            if (shown.current.pose === 'slide' && !e.homeTrip && specials.current.has('slide')) freezeCards();
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
                petHome(cat);
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
            // 一蹦一蹦：每走 stride 跳一下
            e.y = m.hop ? y - Math.abs(Math.sin((e.x / PET_PLAY.hop.stride) * Math.PI)) * PET_PLAY.hop.lift : y;
            // 小熊全套：走過的地方留下蜂蜜腳印
            if (specials.current.has('honey') && Math.abs(e.x - e.lastPawX) >= PET_PLAY.paw.stride) {
              e.lastPawX = e.x;
              addBit(
                { kind: 'paw', x: e.x + W / 2 - PET_PLAY.paw.size / 2, y: y + H - PET_PLAY.paw.size, size: PET_PLAY.paw.size },
                PET_PLAY.paw.lifeMs,
              );
            }
            // 乳牛裝站起來走：邊走邊哞（答題頁不出聲，她要專心）
            if (
              specials.current.has('moo') &&
              shown.current.pose === 'upwalk' &&
              tabRef.current !== 'round' &&
              now - e.lastMooAt > PET_MOO.everyMs
            ) {
              e.lastMooAt = now;
              say(pickLine(CAT_MOO_LINES));
              if (soundOn(world)) playSound('moo', false);
            }
          }
        } else if (m.kind === 'goHome') {
          const h = homeRect();
          const range = xRange();
          if (!h) {
            petHome(cat);
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
            show(gaitFor(specials.current).home, to > e.x ? 'right' : 'left');
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
            const asleep = shown.current.pose === 'loaf';
            // 青蛙全套：醒著待在原地時吹泡泡（從嘴邊冒出來往上飄）
            if (specials.current.has('bubbles') && !asleep && !e.hint && !e.prank && now - e.lastBitAt > PET_PLAY.bubble.everyMs) {
              e.lastBitAt = now;
              const size = between(PET_PLAY.bubble.size, Math.random);
              const side = shown.current.facing === 'right' ? 0.66 : 0.34;
              addBit({ kind: 'bubble', x: e.x + W * side - size / 2, y: e.y + H * 0.5 - size / 2, size }, PET_PLAY.bubble.lifeMs);
            }
            // 睡衣全套：睡著時說夢話
            if (specials.current.has('dream') && asleep && now - e.lastBitAt > PET_PLAY.dream.everyMs) {
              e.lastBitAt = now;
              say(pickLine(CAT_DREAM_LINES));
            }
            if (now >= m.until) {
              proceed(e, now);
            } else if (now - e.lastBlockCheck > ROAM_BLOCK_CHECK_MS) {
              e.lastBlockCheck = now;
              // 伏低準備撲的那一秒不換位置（撲出去就離開了）
              if (e.surface.kind === 'floor' && !e.pounce && blockedAt(e.x, e.y, layerRef.current)) next(e, now);
            }
          }
        }

        // 提示中牠坐的選項捲出畫面了（掉下去）：這次提示作廢
        if (e.hint && e.mode.kind === 'fall') {
          // 為了提示自己跑出來的：提示作廢就回家，不留在外面
          if (e.hint.auto) e.homeTrip = true;
          endHint(e);
        }
        // 噴火、劈斧頭、撲到一半掉下去或被拎起來：這次作罷
        if ((e.prank || e.pounce) && (e.mode.kind === 'fall' || e.mode.kind === 'drag')) {
          e.prank = null;
          e.pounce = null;
          setFlags((f) => ({ ...f, firing: false }));
        }

        // 裂痕、抓痕、冰跟著自己的卡片走（卡片不在了就藏起來）
        for (const [id, node] of pins.current) {
          const bit = bitsRef.current.find((other) => other.id === id);
          const alive = Boolean(bit?.el?.isConnected);
          node.style.visibility = alive ? '' : 'hidden';
          if (!bit?.el || !alive) continue;
          const r = rectOf(bit.el);
          node.style.transform = `translate3d(${Math.round(r.left + (bit.dx ?? 0))}px, ${Math.round(r.top + (bit.top ?? 0))}px, 0)`;
        }

        // 提示中不變淡：作答後畫面會自己捲到解析，牠得意或心虛的樣子要看得到
        const shy = now < e.shyUntil && e.mode.kind !== 'drag' && !e.hint;
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
  }, [out, world, cat]);

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
      const line = voice({ mood: 'idle', place: 'roam', cat });
      if (line) say(line.text);
      // 兔子全套：高高跳起來轉一圈
      const binky = specials.current.has('binky');
      e.mode = {
        kind: 'jump',
        from: { x: e.x, y: e.y },
        to: { x: e.x, y: e.y },
        start: performance.now(),
        land: e.surface,
        ...(binky ? { ms: PET_PLAY.binky.ms, lift: PET_PLAY.binky.lift } : {}),
      };
      show('hop');
      if (binky) {
        setFlags((f) => ({ ...f, binky: true }));
        window.setTimeout(() => setFlags((f) => ({ ...f, binky: false })), PET_PLAY.binky.ms);
      }
      return;
    }
    setHomeTarget(false);
    actorRef.current?.style.setProperty('--pet-swing', '0deg');
    setFlags((f) => ({ ...f, dragging: false }));
    if (nearHome(ev.clientX, ev.clientY)) {
      petHome(cat);
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
      if (e) goHome(e);
    }
  };

  const cls = [
    'cb-pet-actor',
    flags.shy ? 'is-shy' : '',
    flags.dragging ? 'is-dragging' : '',
    flags.landing ? 'is-landing' : '',
    flags.emerging ? 'is-emerging' : '',
    flags.hinting ? 'is-hinting' : '',
    flags.firing ? 'is-firing' : '',
    flags.binky ? 'is-binky' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={layerRef} className="cb-pet-layer">
      {bits.map((bit) =>
        bit.kind === 'bubble' ? (
          <button
            key={bit.id}
            type="button"
            className="cb-pet-bit cb-pet-bubble"
            style={{ left: bit.x, top: bit.y, width: bit.size, height: bit.size }}
            aria-label="戳破泡泡"
            tabIndex={-1}
            onPointerDown={() => setBits((prev) => prev.filter((other) => other.id !== bit.id))}
          />
        ) : bit.kind === 'claw' ? (
          <div
            key={bit.id}
            ref={pinRef(bit.id)}
            className="cb-pet-bit cb-pet-claw"
            style={{
              transform: `translate3d(${Math.round(bit.x)}px, ${Math.round(bit.y)}px, 0)`,
              marginLeft: -CLAW_MARK.w / 2,
              animationDuration: `${PET_POUNCE.clawMs}ms`,
            }}
            aria-hidden="true"
          >
            <ClawMark />
          </div>
        ) : bit.kind === 'frost' ? (
          <div
            key={bit.id}
            ref={pinRef(bit.id)}
            className="cb-pet-bit cb-pet-frost"
            style={{
              transform: `translate3d(${Math.round(bit.x)}px, ${Math.round(bit.y)}px, 0)`,
              animationDuration: `${PET_SLIDE.freezeMs}ms`,
            }}
            aria-hidden="true"
          >
            <FrostMark width={bit.w ?? 0} height={bit.h ?? 0} radius={bit.radius ?? 0} seed={bit.id} />
          </div>
        ) : bit.kind === 'crack' ? (
          <div
            key={bit.id}
            ref={pinRef(bit.id)}
            className="cb-pet-bit cb-pet-crack"
            style={{ transform: `translate3d(${Math.round(bit.x)}px, ${Math.round(bit.y)}px, 0)` }}
            aria-hidden="true"
          >
            <svg width="26" height="30" viewBox="0 0 26 30">
              <path d="M13 0 L10 7 L15 12 L9 19 L13 24 L11 30" />
              <path d="M10 7 L4 10 M15 12 L21 14 M9 19 L5 22" />
            </svg>
          </div>
        ) : bit.kind === 'chip' ? (
          <span
            key={bit.id}
            className="cb-pet-bit cb-pet-chip"
            style={
              {
                left: bit.x,
                top: bit.y,
                width: bit.size,
                height: bit.size,
                '--chip-dx': `${Math.round(bit.dx ?? 0)}px`,
                '--chip-dy': `${Math.round(bit.dy ?? 0)}px`,
                animationDuration: `${PET_AXE.chips.ms}ms`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          />
        ) : (
          <svg
            key={bit.id}
            className="cb-pet-bit cb-pet-paw"
            style={{ left: bit.x, top: bit.y }}
            width={bit.size}
            height={bit.size}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <ellipse cx="12" cy="15.5" rx="5" ry="4" />
            <circle cx="6.5" cy="10" r="2.1" />
            <circle cx="12" cy="7.5" r="2.2" />
            <circle cx="17.5" cy="10" r="2.1" />
          </svg>
        ),
      )}
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
        <div
          className="cb-pet-actor-inner"
          style={
            {
              ...(flags.binky ? { animationDuration: `${PET_PLAY.binky.ms}ms` } : {}),
              '--pet-chop-ms': `${PET_AXE.swingMs}ms`,
            } as React.CSSProperties
          }
        >
          <CatBody
            pose={pose}
            outfit={outfit}
            facing={facing}
            width={W}
            pivot
            {...(mood ? { mood } : {})}
            {...(pose === 'chop' ? { held: AXE } : {})}
          />
        </div>
      </div>
    </div>
  );
}
