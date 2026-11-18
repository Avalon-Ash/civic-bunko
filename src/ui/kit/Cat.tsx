import { useEffect, useState } from 'react';
import { CAT_LINE_W, EMOTE, HEAD_ORIGIN, HEAD_RADIUS } from '../../core/constants/pet';
import { ITEMS, SLOTS } from '../../core/constants/wardrobe';
import type { AccessoryId, CatMood, CatScene, ItemId, Outfit, SlotId } from '../../core/types';
import { useCatBubble, useCatVoice } from './catVoice';
import { Emote } from './Emote';
import { ITEM_ART } from './wardrobe/art';

export type { CatMood };

export interface CatProps {
  size?: number;
  mood?: CatMood;
  /** 這個畫面明講的情境（剛答對、剛答錯）；點牠時說的話會照這個挑。沒給就只看表情 */
  scene?: CatScene;
  interactive?: boolean;
  spin?: boolean;
  /** 舊的單一配件；有 outfit 時忽略 */
  accessory?: AccessoryId | null;
  /** 分部位的穿著 */
  outfit?: Outfit | null;
  className?: string;
}

/** 頭像的座標邊長 */
const HEAD_VIEW = 64;
/** 左右耳（分開畫才能各自抖動）：外耳、耳朵裡面 */
const EARS = [
  { side: 'l', outer: 'M11 28L14 7l15 10z', inner: 'M16.4 21.4L17.3 14.2l5.2 3.5z' },
  { side: 'r', outer: 'M53 28L50 7 35 17z', inner: 'M47.6 21.4L46.7 14.2l-5.2 3.5z' },
] as const;
/** 眼睛：位置、大小，和左上角的反光點 */
const EYES = [22.5, 41.5] as const;
const EYE_Y = 40;
const EYE_R = 3;
const EYE_SHINE = { dx: -1, dy: -1.1, r: 1 } as const;

/** 配件 ID → 部位（從 ITEMS 建一次） */
const ITEM_SLOT: ReadonlyMap<ItemId, SlotId> = new Map(ITEMS.map((item) => [item.id, item.slot]));

/** 舊的單一配件轉成穿著（只有 accessory 沒有 outfit 的呼叫端用） */
function legacyOutfit(accessory: AccessoryId | null | undefined): Outfit {
  if (!accessory) return {};
  const slot = ITEM_SLOT.get(accessory);
  return slot ? { [slot]: accessory } : {};
}

/**
 * 依 SLOTS 的順序畫出穿著的圖層；behind＝畫在貓本體後面的那幾層。
 * standalone＝只有頭的頭像；接在身體上時，有身體版圖的配件只畫它留在頭上的那一部分（其餘由 CatBody 穿到身體上）。
 */
function OutfitLayers({ outfit, behind, standalone }: { outfit: Outfit; behind: boolean; standalone: boolean }) {
  return (
    <>
      {SLOTS.map((slot) => {
        if (!slot.layer || slot.behindCat !== behind) return null;
        const id = outfit[slot.id];
        if (!id || ITEM_SLOT.get(id) !== slot.id) return null;
        const art = ITEM_ART[id];
        if (!art || art.kind !== 'layer') return null;
        const node = !standalone && art.onBody ? art.onBody.head : art.node;
        if (!node) return null;
        return (
          <g key={slot.id} className={`cb-slot cb-slot-${slot.id} ${art.motion ? `cb-motion-${art.motion}` : ''}`.trim()}>
            {node}
          </g>
        );
      })}
    </>
  );
}

/** 穿著的毛色 class（沒有就是空字串） */
export function furClass(outfit: Outfit): string {
  const id = outfit.fur;
  if (!id) return '';
  const art = ITEM_ART[id];
  return art && art.kind === 'fur' ? art.className : '';
}

/** 單獨顯示一件配件的圖示；毛色顯示成那個毛色的小貓。 */
export function ItemIcon({ id, size = 36 }: { id: ItemId; size?: number }) {
  const art = ITEM_ART[id];
  if (!art) return null;
  if (art.kind === 'fur') {
    return <Cat size={size} interactive={false} outfit={{ fur: id }} />;
  }
  return (
    <svg width={size} height={size} viewBox={art.icon?.box ?? art.box} aria-hidden="true" className="cb-acc-svg">
      {art.icon?.node ?? art.node}
    </svg>
  );
}

/** 舊名稱：集章頁的配件圖示 */
export function AccessoryIcon({ id, size = 36 }: { id: AccessoryId; size?: number }) {
  return <ItemIcon id={id} size={size} />;
}

/**
 * 小貓的頭（含耳朵、表情、頭上與臉上的配件），畫在 64×64 的座標裡。
 * 頭像用的 Cat 與有身體的 CatBody 共用它；standalone＝只有頭的頭像（要畫背景與背飾；身體版由 CatBody 畫在身體後面）。
 */
export function CatHead({ mood, outfit, standalone }: { mood: CatMood; outfit: Outfit; standalone: boolean }) {
  const feature = {
    fill: 'none',
    stroke: 'var(--cat-feature)',
    strokeWidth: CAT_LINE_W,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <>
    {standalone ? <OutfitLayers outfit={outfit} behind standalone /> : null}
    {EARS.map((ear) => (
      <g key={ear.side} className={`cb-cat-ear cb-cat-ear-${ear.side}`}>
        <path d={ear.outer} fill="var(--cat-patch)" stroke="var(--cat-line)" strokeWidth={CAT_LINE_W} strokeLinejoin="round" />
        <path d={ear.inner} fill="var(--cat-ear)" stroke="var(--cat-ear)" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    ))}
    <ellipse cx={HEAD_ORIGIN.x} cy={HEAD_ORIGIN.y} rx={HEAD_RADIUS.x} ry={HEAD_RADIUS.y} fill="var(--cat-fur)" />
    <path
      d="M6 40Q6 19 30 18l-5 12q-9 3-13 14zM58 40Q58 19 34 18l5 12q9 3 13 14z"
      fill="var(--cat-patch)"
    />
    <ellipse
      cx={HEAD_ORIGIN.x}
      cy={HEAD_ORIGIN.y}
      rx={HEAD_RADIUS.x}
      ry={HEAD_RADIUS.y}
      fill="none"
      stroke="var(--cat-line)"
      strokeWidth={CAT_LINE_W}
    />
    <ellipse cx="15" cy="46" rx="4.5" ry="3" fill="var(--cat-blush)" />
    <ellipse cx="49" cy="46" rx="4.5" ry="3" fill="var(--cat-blush)" />

    {mood === 'yay' && <path d="M19 41q3.5-5 7 0M38 41q3.5-5 7 0" {...feature} />}

    {mood === 'sleepy' && <path d="M19 40q3.5 3.5 7 0M38 40q3.5 3.5 7 0" {...feature} />}

    {(mood === 'idle' || mood === 'oops') && (
      <g className={mood === 'idle' ? 'cb-cat-eyes' : undefined}>
        {EYES.map((x) => (
          <g key={x}>
            <circle cx={x} cy={EYE_Y} r={EYE_R} fill="var(--cat-feature)" />
            <circle cx={x + EYE_SHINE.dx} cy={EYE_Y + EYE_SHINE.dy} r={EYE_SHINE.r} fill="var(--cat-shine)" />
          </g>
        ))}
      </g>
    )}

    <path d="M30.3 43.7Q32 43 33.7 43.7Q33.4 45.5 32 46.1Q30.6 45.5 30.3 43.7Z" fill="var(--cat-nose)" />
    {mood === 'oops' ? (
      <path d="M29 48.4h6" {...feature} />
    ) : (
      <path d="M27 46.4q2.5 3.5 5 0q2.5 3.5 5 0" {...feature} />
    )}
    <OutfitLayers outfit={outfit} behind={false} standalone={standalone} />
    </>
  );
}

/** 原創角色：八字臉的圓貓。支援四種表情、待機眨眼、點擊壓扁回彈、配件疊加；點牠會說話（說什麼由 CatVoice 決定）。 */
export function Cat({
  size = 64,
  mood = 'idle',
  scene,
  interactive = true,
  spin = false,
  accessory = null,
  outfit = null,
  className = '',
}: CatProps) {
  const wearing = outfit ?? legacyOutfit(accessory);
  const fur = furClass(wearing);
  const [squishing, setSquishing] = useState(false);
  const voice = useCatVoice();
  const { bubble, say } = useCatBubble();

  useEffect(() => {
    if (!squishing) return;
    const id = window.setTimeout(() => setSquishing(false), 380);
    return () => window.clearTimeout(id);
  }, [squishing]);

  const handleTap = () => {
    if (!interactive) return;
    setSquishing(false);
    window.requestAnimationFrame(() => setSquishing(true));
    const line = voice({ mood, place: 'avatar', ...(scene ? { scene } : {}) });
    if (line) say(line.text);
  };

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${HEAD_VIEW} ${HEAD_VIEW}`}
      aria-hidden="true"
      className={`cb-cat-svg ${interactive ? 'cb-cat-alive' : ''} ${fur}`.trim()}
      overflow="visible"
    >
      <CatHead mood={mood} outfit={wearing} standalone />
      {/* 轉圈的時候（答對的慶祝、載入中）不冒：泡泡跟著整張圖轉會上下顛倒 */}
      {spin ? null : (
      <Emote
        mood={mood}
        at={{ x: HEAD_ORIGIN.x + HEAD_RADIUS.x * EMOTE.corner.x, y: HEAD_ORIGIN.y - HEAD_RADIUS.y * EMOTE.corner.y }}
        side={1}
        pxPerUnit={size / HEAD_VIEW}
      />
      )}
    </svg>
  );

  if (!interactive) {
    return (
      <span
        className={`cb-cat-wrap ${spin ? 'is-spinning' : ''} ${className}`.trim()}
      >
        {svg}
      </span>
    );
  }

  return (
    <span className={`cb-cat-host ${className}`.trim()}>
      {bubble}
      <button
        type="button"
        className={`cb-cat-btn ${squishing ? 'is-squishing' : ''} ${spin ? 'is-spinning' : ''}`.trim()}
        onClick={handleTap}
        aria-label="點一點小貓，牠會跟你說話"
        data-sound="meow"
      >
        {svg}
      </button>
    </span>
  );
}
