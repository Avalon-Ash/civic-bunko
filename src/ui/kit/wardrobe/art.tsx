// 小八喵配件的圖（每件一個 SVG 片段，畫在貓的 64×64 座標裡）。
// 配件清單（ID、部位、取得方式）在 src/core/constants/wardrobe.ts；這裡只放圖。顏色只用 theme.css 的 token。
import type { ReactNode } from 'react';
import { PET_BACK_EASE, PET_HEAD_SCALE, PET_LEG_W } from '../../../core/constants/pet';
import type { ItemId } from '../../../core/types';

/** 配件自己的小動作（動畫在 styles/wardrobe.css 的 cb-motion-*） */
export type ItemMotion = 'bob' | 'hop' | 'flap';

/**
 * 有身體的小貓用的圖（身體座標 100×90，不縮放、只跟著姿勢移動與轉動）。
 * 有這份圖的配件，在身體版就不畫頭像的 node，改照這裡穿到身體上。
 */
/**
 * 身體的尺寸（身體座標），CatBody 照姿勢算好傳進來。衣服照它長，身體換姿勢、改體型時衣服跟著走，不各自寫死一份身體的大小。
 * len＝脖子那端到屁股那端；back、belly＝屁股最厚處往背、往肚子的半厚；chest＝胸口的半厚；
 * shoulder、hip＝胸口、屁股最厚的地方各離自己那端多遠。
 */
export interface BodyGeom {
  len: number;
  back: number;
  belly: number;
  chest: number;
  shoulder: number;
  hip: number;
  /** 頭的下緣蓋到脖子那端下面多遠（沿著身體往屁股的方向量）：領口的裝飾要露在它下面 */
  chin: number;
}

export interface BodyArt {
  /** 衣服的布面：剪裁在身體輪廓內，所以每個姿勢都合身。原點在脖子那端、+x 朝前、-y 是背，身體往 -x 延伸 */
  wrap?: (body: BodyGeom) => ReactNode;
  /** 蓋在身體上、不剪裁（披風）。座標同 wrap */
  over?: (body: BodyGeom) => ReactNode;
  /** 前腿上端的袖子。原點在腿根、+y 往下，腿寬是 PET_LEG_W */
  sleeve?: ReactNode;
  /** 畫在身體後面（翅膀、氣球）。原點在姿勢的背對位點 */
  behind?: ReactNode;
  /** 留在頭上的那一部分（領口、領結）。頭像座標，跟頭一起縮放 */
  head?: ReactNode;
  /**
   * 身體直立、頭朝著你的姿勢（PetPoseSpec.backFront：正面坐、被拎著、掉下來）的畫法：有給就取代側面用的 behind 和 over。
   * 披在背後的東西從正面看是從身體兩側露出來，側面那張圖鏡像一下湊不出來，所以另外畫。
   * 座標：原點在身體的脖子那端（頭的正下方）、+x 朝畫面右、+y 朝下；
   * 身體往下長 body.len，最寬處左右各 body.back。圖本身要左右對稱。
   */
  frontal?: {
    /** 畫在身體後面 */
    behind?: (body: BodyGeom) => ReactNode;
    /**
     * 脖子前面的領子、扣子，畫在身體前面（上緣會被下巴蓋住）。
     * 脖子上已經有別的東西（頸部配件、衣服自己的領口）時不畫，免得兩樣東西疊在同一塊。
     */
    collar?: (body: BodyGeom) => ReactNode;
  };
}

export type ItemArt =
  /** 圖層：node 畫在貓的座標裡；box 是單獨顯示圖示時的 viewBox */
  | {
      kind: 'layer';
      node: ReactNode;
      box: string;
      motion?: ItemMotion;
      onBody?: BodyArt;
      /** 背景配件的全身版（身體座標，地面在 PET_GROUND）：畫在整隻貓後面。沒有就把頭像的圖放大墊在後面 */
      stage?: ReactNode;
    }
  /** 毛色：套在貓外層的 class（色票在 theme.css） */
  | { kind: 'fur'; className: string };

const LINE = 'var(--cat-line)';
/** 配件的線只有三級：外框（與貓本體的 CAT_LINE_W 同級、略細）、小零件的外框、圖案裡的細線 */
const W = 2.2;
const WT = 1.8;
const WF = 1.1;

const stroke = { stroke: LINE, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { stroke: LINE, strokeWidth: WT, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
/** 身體座標用的線：身體版的圖不經過頭的縮放，線寬自己乘上頭的比例，才跟頭上的配件一樣粗 */
const bstroke = { ...stroke, strokeWidth: W * PET_HEAD_SCALE };
const bthin = { ...thin, strokeWidth: WT * PET_HEAD_SCALE };
/** 布面上的織紋、摺線 */
const seam = { fill: 'none', strokeWidth: 1.1, strokeLinecap: 'round' as const };

/** 布面往背、往肚子各多畫一點，確定蓋滿身體（多的由身體輪廓裁掉） */
const CLOTH_MARGIN = 1;
/** 毛衣：下擺蓋到身體長度的幾成、領口往前多出多少、織紋的間距、下擺羅紋的寬度 */
const SWEATER = { cover: 0.64, collar: 9, rib: 5, hem: 4.2 } as const;
/** 袖子：比腿寬一點，從腿根往下蓋多長；袖口羅紋的高度 */
const SLEEVE = { half: PET_LEG_W / 2 + 0.3, top: -1.5, len: 2.4, cuff: 2.2 } as const;
/** 水手領：領片從脖子往後多長、領尖繞到胸口多遠 */
const COLLAR = { len: 14.5, front: 6 } as const;
/**
 * 披風（側面）：綁在後頸、沿著背披到屁股後面飄出去，只蓋住背，不包住身體（包住就變成衣服了）。
 * lift＝比背線高出多少；flow＝尾端飄出屁股多遠；rear＝尾端的下緣在背半厚的幾成高（1＝背線、0＝身體中線）；
 * low、hang＝下擺最靠前的那一點在身體長度的幾成處、在胸口半厚的幾成高（都在背那一側，不過中線）；
 * teeth、tooth＝下擺鋸齒有幾齒、每齒多深；nape＝後頸那個結離脖子端多遠
 */
const CAPE = { lift: 2.2, flow: 5, rear: 0.6, low: 0.22, hang: 0.3, teeth: 3, tooth: 2.8, nape: 3.5 } as const;
/**
 * 披風（正面）：披在背後，從身體兩側和下面露出來；脖子前面一條領子、中間一顆扣子。
 * flare＝下擺比身體最寬處每邊多出多少；neck＝領口的半寬；hem＝下擺離身體底端多高；teeth、tooth＝下擺鋸齒；
 * band＝領子多寬；droop＝領子中間比兩端低多少；clasp＝扣子的半徑；tuck＝領子的上緣藏進下巴後面多深
 */
const CAPE_FRONT = { flare: 6.5, neck: 9, hem: 2, teeth: 6, tooth: 3, band: 4.2, droop: 6, clasp: 2.3, tuck: 3.3 } as const;
/**
 * 翅膀（正面）：一左一右從肩胛往外上方展開，翅根藏在身體後面。
 * in＝翅根離中線多遠（比胸口半厚往裡收多少）、down＝翅根在肩膀下面多遠
 */
const WING_FRONT = { in: 5, down: 4 } as const;

/** 毛衣的布面：從領口蓋到下擺，直的織紋，下擺一圈羅紋 */
function sweaterWrap(body: BodyGeom): ReactNode {
  const top = -(body.back + CLOTH_MARGIN);
  const height = body.back + body.belly + CLOTH_MARGIN * 2;
  const hem = -body.len * SWEATER.cover;
  const ribs: string[] = [];
  for (let x = -SWEATER.rib / 2; x > hem + SWEATER.hem / 2; x -= SWEATER.rib) ribs.push(`M${x} ${top}v${height}`);
  return (
    <g>
      <rect x={hem} y={top} width={SWEATER.collar - hem} height={height} fill="var(--acc-lav)" />
      <path d={ribs.join('')} stroke="var(--acc-cream)" strokeOpacity="0.7" {...seam} />
      <rect x={hem - SWEATER.hem / 2} y={top} width={SWEATER.hem} height={height} fill="var(--acc-cream)" {...bthin} />
    </g>
  );
}

/** 水手領的領片：披在肩背上，邊上一道白線 */
function sailorWrap(body: BodyGeom): ReactNode {
  const top = -(body.back + CLOTH_MARGIN);
  const edge = `V1 Q${-COLLAR.len * 0.4} 6.5 ${COLLAR.front} 4`;
  return (
    <g>
      <path d={`M${COLLAR.front} ${top} H${-COLLAR.len} ${edge} Z`} fill="var(--acc-navy)" />
      <path d={`M${-COLLAR.len + 2.9} ${top} V-0.6 Q${-COLLAR.len * 0.35} 3.4 ${COLLAR.front} 1.4`} stroke="var(--acc-cream)" {...seam} strokeWidth="1.3" />
      <path d={`M${-COLLAR.len} ${top} ${edge}`} fill="none" {...bthin} />
    </g>
  );
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/** 披風（側面）：從後頸沿著背披到屁股後面，尾端飄出去；下擺鋸齒留在背上，不垂到身體側面 */
function capeOver(body: BodyGeom): ReactNode {
  const shoulder = [-body.shoulder, -body.chest - CAPE.lift] as const;
  const hip = [-(body.len - body.hip), -body.back - CAPE.lift] as const;
  const tip = [-body.len - CAPE.flow, -body.back * CAPE.rear] as const;
  const low = [-body.len * CAPE.low, -body.chest * CAPE.hang] as const;
  /** 披風的背線跟身體的背線用同一個緩急，才會一路貼著 */
  const ease = (shoulder[0] - hip[0]) * PET_BACK_EASE;
  /** 下擺：從尾端到最靠前的那一點之間切成幾齒，齒谷往背那側收 */
  const steps = CAPE.teeth * 2;
  const hem: string[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = tip[0] + (low[0] - tip[0]) * t;
    const y = tip[1] + (low[1] - tip[1]) * t - (i % 2 === 1 ? CAPE.tooth : 0);
    hem.push(`L${n2(x)} ${n2(y)}`);
  }
  const d = [
    `M${CAPE.nape} ${-CAPE.nape}`,
    `Q-1 ${n2(shoulder[1] - 1)} ${n2(shoulder[0])} ${n2(shoulder[1])}`,
    `C${n2(shoulder[0] - ease)} ${n2(shoulder[1])} ${n2(hip[0] + ease)} ${n2(hip[1])} ${n2(hip[0])} ${n2(hip[1])}`,
    `Q${n2(-body.len)} ${n2(hip[1])} ${n2(tip[0])} ${n2(tip[1])}`,
    hem.join(''),
    `Q${n2(low[0] / 2)} ${n2(low[1] / 2)} ${CAPE.nape} 0`,
    `Q${n2(CAPE.nape * 1.5)} ${n2(-CAPE.nape / 2)} ${CAPE.nape} ${-CAPE.nape}Z`,
  ].join('');
  return <path d={d} fill="var(--acc-coral)" {...bstroke} />;
}

/** 披風（正面）披在背後的那一片：從領口往兩邊展開，下擺鋸齒，比身體寬，所以從身體兩側和下面露出來 */
function capeFrontBehind(body: BodyGeom): ReactNode {
  const half = body.back + CAPE_FRONT.flare;
  const widest = body.len - body.hip;
  const hemY = body.len - CAPE_FRONT.hem;
  const steps = CAPE_FRONT.teeth * 2;
  const hem: string[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const x = -half + (half * 2 * i) / steps;
    hem.push(`L${n2(x)} ${n2(hemY - (i % 2 === 1 ? CAPE_FRONT.tooth : 0))}`);
  }
  const side = (sign: 1 | -1) =>
    `${n2(sign * (CAPE_FRONT.neck + body.shoulder * 0.8))} 0 ${n2(sign * (half - 1.5))} ${n2(body.shoulder)} ${n2(sign * half)} ${n2(widest)}`;
  const d = [
    `M${-CAPE_FRONT.neck} 0`,
    `C${side(-1)}`,
    `L${-half} ${n2(hemY)}`,
    hem.join(''),
    `L${half} ${n2(widest)}`,
    `C${n2(half - 1.5)} ${n2(body.shoulder)} ${n2(CAPE_FRONT.neck + body.shoulder * 0.8)} 0 ${CAPE_FRONT.neck} 0`,
    'Z',
  ].join('');
  return <path d={d} fill="var(--acc-coral)" {...bstroke} />;
}

/** 披風（正面）脖子前面的領子和扣子：貼著下巴下緣（每個姿勢頭蓋到身體的深度不一樣） */
function capeFrontCollar(body: BodyGeom): ReactNode {
  const { neck, band, droop, clasp, tuck } = CAPE_FRONT;
  return (
    <g transform={`translate(0 ${n2(body.chin - tuck)})`}>
      <path
        d={`M${-neck} 0 Q0 ${droop} ${neck} 0 L${n2(neck - 0.6)} ${band} Q0 ${droop + band} ${n2(-neck + 0.6)} ${band} Z`}
        fill="var(--acc-coral)"
        {...bthin}
      />
      <circle cx="0" cy={n2(droop / 2 + band)} r={clasp} fill="var(--acc-gold)" {...bthin} />
    </g>
  );
}

/** 一片翅膀（翅根在原點，往右上展開）；左邊那片由呼叫端鏡像 */
const WING_FRONT_PATH = 'M0 0 C6 -12 16 -20 25 -21 Q28.5 -17 24 -14 Q28 -11 23 -8 Q26 -4 20 -2 Q22 2 15 3 Q8 5 0 0 Z';
const WING_FRONT_SEAMS = 'M24 -14 Q16 -12 9 -8 M23 -8 Q16 -6 9 -3';

/** 翅膀（正面）：一左一右從背後展開。每片各自從翅根拍（動畫在 styles/pet.css 的 cb-pet-wing） */
function wingsFrontBehind(body: BodyGeom): ReactNode {
  const x = body.chest - WING_FRONT.in;
  const y = body.shoulder + WING_FRONT.down;
  const wing = (
    <g className="cb-pet-wing">
      <path d={WING_FRONT_PATH} fill="var(--acc-cream)" {...bstroke} />
      <path d={WING_FRONT_SEAMS} stroke="var(--acc-lav)" {...seam} />
    </g>
  );
  return (
    <g>
      <g transform={`translate(${n2(-x)} ${n2(y)}) scale(-1 1)`}>{wing}</g>
      <g transform={`translate(${n2(x)} ${n2(y)})`}>{wing}</g>
    </g>
  );
}

export const ITEM_ART: Readonly<Record<ItemId, ItemArt>> = {
  // ── 舊集章配件（沿用原本的造型）──────────────────────────
  bow: {
    kind: 'layer',
    box: '35 12 24 20',
    node: (
      <g transform="translate(47 22) rotate(18)">
        <path d="M-1 0 L-8 -4.5 L-8 4.5 Z" fill="var(--pink-deep)" {...stroke} />
        <path d="M1 0 L8 -4.5 L8 4.5 Z" fill="var(--pink-deep)" {...stroke} />
        <circle cx="0" cy="0" r="2.6" fill="var(--acc-straw)" stroke={LINE} strokeWidth={W} />
      </g>
    ),
  },
  'straw-hat': {
    kind: 'layer',
    box: '8 1 48 26',
    node: (
      <g>
        <ellipse cx="32" cy="18" rx="22" ry="4.5" fill="var(--acc-straw)" stroke={LINE} strokeWidth={W} />
        <path d="M21 17 L23 7 Q32 4 41 7 L43 17 Z" fill="var(--acc-straw)" stroke={LINE} strokeWidth={W} strokeLinejoin="round" />
        <path d="M21.8 14.8 Q32 16.8 42.2 14.8" fill="none" stroke="var(--pink-deep)" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  scarf: {
    kind: 'layer',
    box: '13 49 38 23',
    // 圍一圈在下巴下面，尾巴從右前方垂下來、尾端有條紋和流蘇
    node: (
      <g>
        <path d="M36 60 L43 59 L45 68.4 L38 69.6 Z" fill="var(--acc-mint)" {...stroke} />
        <path d="M37.2 64.6 L44 63.5" stroke="var(--acc-leaf)" {...seam} strokeWidth="1.6" />
        <path d="M40 69.2 V71.4 M43 68.7 V70.9" fill="none" {...thin} />
        <path d="M17 53.6 Q32 60.4 47 53.6 L46.4 59.8 Q32 66 17.6 59.8 Z" fill="var(--acc-mint)" {...stroke} />
        <path d="M24 59.2 L24.6 62.6 M32 60.4 V63.9 M40 59.2 L39.4 62.6" stroke="var(--acc-leaf)" strokeOpacity="0.8" {...seam} />
      </g>
    ),
  },
  flower: {
    kind: 'layer',
    box: '5 12 20 20',
    node: (
      <g transform="translate(15 22)">
        {[
          [0, -4.5],
          [4.3, -1.4],
          [2.6, 3.6],
          [-2.6, 3.6],
          [-4.3, -1.4],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r="3.2" fill="var(--pink-deep)" stroke={LINE} strokeWidth={W} />
        ))}
        <circle cx="0" cy="0" r="2.8" fill="var(--acc-straw)" stroke={LINE} strokeWidth={WT} />
      </g>
    ),
  },
  glasses: {
    kind: 'layer',
    box: '8 28 48 24',
    node: (
      <g>
        <circle cx="22.5" cy="40" r="6.8" fill="var(--acc-sky)" fillOpacity="0.35" stroke={LINE} strokeWidth={W} />
        <circle cx="41.5" cy="40" r="6.8" fill="var(--acc-sky)" fillOpacity="0.35" stroke={LINE} strokeWidth={W} />
        <path d="M29.3 40 Q32 38 34.7 40" fill="none" stroke={LINE} strokeWidth={W} strokeLinecap="round" />
        <path d="M15.7 39.5 L10 38 M48.3 39.5 L54 38" fill="none" stroke={LINE} strokeWidth={W} strokeLinecap="round" />
      </g>
    ),
  },
  crown: {
    kind: 'layer',
    box: '15 1 34 22',
    node: (
      <g>
        <path d="M21 19 L19 7 L27 13 L32 4 L37 13 L45 7 L43 19 Z" fill="var(--acc-straw)" stroke={LINE} strokeWidth={W} strokeLinejoin="round" />
        <circle cx="32" cy="14" r="2" fill="var(--pink-deep)" />
      </g>
    ),
  },

  // ── 頭頂 ────────────────────────────────────────────────
  beanie: {
    kind: 'layer',
    box: '9 1 46 30',
    node: (
      <g>
        <path d="M13 25 Q13 9 32 8.5 Q51 9 51 25 Z" fill="var(--acc-sky)" {...stroke} />
        <path d="M22 11.5 Q21 18 22 24 M32 9 V24 M42 11.5 Q43 18 42 24" fill="none" {...thin} strokeOpacity="0.45" />
        <rect x="11.5" y="21.5" width="41" height="6.5" rx="3.2" fill="var(--acc-cream)" {...stroke} />
        <circle cx="32" cy="7" r="4" fill="var(--acc-cream)" {...stroke} />
      </g>
    ),
  },
  beret: {
    kind: 'layer',
    box: '12 2 40 24',
    node: (
      <g transform="rotate(-10 32 16)">
        <path d="M31 8.5 Q32 5 34 6" fill="none" {...stroke} />
        <ellipse cx="32" cy="15" rx="17.5" ry="6.8" fill="var(--acc-navy)" {...stroke} />
        <path d="M18 17.5 Q32 22 46 17.5" fill="none" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.7" />
      </g>
    ),
  },
  'party-hat': {
    kind: 'layer',
    box: '18 -4 30 26',
    node: (
      <g transform="rotate(12 32 18)">
        <path d="M24 19 L32 1.5 L40 19 Q32 21.5 24 19 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M28.2 10.5 L33.8 12.5 M26 15.5 L37.6 18" fill="none" stroke="var(--acc-gold)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="32" cy="1.5" r="3" fill="var(--pink-deep)" {...thin} />
      </g>
    ),
  },
  chick: {
    kind: 'layer',
    motion: 'hop',
    box: '20 0 24 22',
    node: (
      <g>
        <path d="M25.5 15 Q25 6.5 32 6 Q39 6.5 38.5 15 Q38 19 32 19.2 Q26 19 25.5 15 Z" fill="var(--acc-gold)" {...stroke} />
        <path d="M31 6.2 Q31.5 3 33.5 3.4 M32.3 6 Q34.5 3.8 36 5" fill="none" {...thin} />
        <circle cx="30" cy="11.5" r="1.3" fill={LINE} />
        <circle cx="35" cy="11.5" r="1.3" fill={LINE} />
        <path d="M31 13.6 L32.5 15.6 L34 13.6 Z" fill="var(--acc-coral)" {...thin} />
        <path d="M37 13.5 Q40.5 13.5 39.5 16.5" fill="none" {...thin} />
      </g>
    ),
  },
  hachimaki: {
    kind: 'layer',
    box: '6 16 58 24',
    node: (
      <g>
        <path d="M54 30.5 L61.5 26.5 L60.5 32.5 Z" fill="var(--acc-cream)" {...thin} />
        <path d="M54 32.5 L62 35.5 L57.5 38.5 Z" fill="var(--acc-cream)" {...thin} />
        <path d="M9 30 Q32 18 55 30 L54.2 35 Q32 23.6 9.8 35 Z" fill="var(--acc-cream)" {...stroke} />
        <circle cx="32" cy="26.6" r="2.9" fill="var(--acc-coral)" />
      </g>
    ),
  },
  'grad-cap': {
    kind: 'layer',
    box: '11 1 42 25',
    node: (
      <g>
        <path d="M22 14 L22 20.5 Q32 24.5 42 20.5 L42 14" fill="var(--acc-navy)" {...stroke} />
        <path d="M13 11.5 L32 4.5 L51 11.5 L32 18.5 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M32 11.5 L46.5 13.5 L46.5 21" fill="none" stroke="var(--acc-gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M45 21 L48 21 L47.5 25 L45.5 25 Z" fill="var(--acc-gold)" {...thin} />
        <circle cx="32" cy="11.5" r="1.4" fill="var(--acc-gold)" />
      </g>
    ),
  },

  // ── 頭側 ────────────────────────────────────────────────
  'star-clip': {
    kind: 'layer',
    box: '37 12 20 20',
    node: (
      <path
        transform="translate(47 22) rotate(12)"
        d="M0 -7 L2 -2.3 L6.8 -2.1 L3.1 1.1 L4.3 5.9 L0 3.2 L-4.3 5.9 L-3.1 1.1 L-6.8 -2.1 L-2 -2.3 Z"
        fill="var(--acc-gold)"
        {...stroke}
      />
    ),
  },
  sakura: {
    kind: 'layer',
    box: '5 12 20 20',
    node: (
      <g transform="translate(15 22)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path
            key={deg}
            transform={`rotate(${deg})`}
            d="M0 -0.5 Q-3.4 -3.2 -2.2 -6.4 L0 -5.4 L2.2 -6.4 Q3.4 -3.2 0 -0.5 Z"
            fill="var(--pink)"
            {...thin}
          />
        ))}
        <circle cx="0" cy="0" r="1.6" fill="var(--pink-deep)" />
      </g>
    ),
  },
  clover: {
    kind: 'layer',
    box: '37 11 20 22',
    node: (
      <g transform="translate(47 21) rotate(15)">
        <path d="M0 2 Q1 7 3 9" fill="none" {...thin} />
        {[0, 90, 180, 270].map((deg) => (
          <path
            key={deg}
            transform={`rotate(${deg + 45})`}
            d="M0 0 Q-4 -2 -3.2 -5 Q-1.6 -6.6 0 -4.6 Q1.6 -6.6 3.2 -5 Q4 -2 0 0 Z"
            fill="var(--acc-leaf)"
            {...thin}
          />
        ))}
      </g>
    ),
  },

  // ── 眼睛 ────────────────────────────────────────────────
  sunglasses: {
    kind: 'layer',
    box: '8 30 48 20',
    node: (
      <g>
        <path d="M15 35.5 H30 Q30.5 45 22.5 45.5 Q15 45 15 35.5 Z" fill="var(--acc-shade)" {...stroke} />
        <path d="M34 35.5 H49 Q49 45 41.5 45.5 Q33.5 45 34 35.5 Z" fill="var(--acc-shade)" {...stroke} />
        <path d="M30 37 Q32 35.6 34 37" fill="none" {...stroke} />
        <path d="M15 36 L9.5 34.5 M49 36 L54.5 34.5" fill="none" {...stroke} />
        <path d="M18 38 L21 38 M37 38 L40 38" stroke="var(--acc-cream)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8" />
      </g>
    ),
  },
  monocle: {
    kind: 'layer',
    box: '32 30 22 30',
    node: (
      <g>
        <path d="M45.5 46 Q49 52 47 58" fill="none" stroke="var(--acc-gold)" strokeWidth="1.4" strokeDasharray="1.6 1.4" strokeLinecap="round" />
        <circle cx="41.5" cy="40" r="6.6" fill="var(--acc-sky)" fillOpacity="0.3" stroke="var(--acc-gold)" strokeWidth="2.4" />
        <circle cx="41.5" cy="40" r="7.9" fill="none" stroke={LINE} strokeWidth={WF} />
      </g>
    ),
  },

  // ── 嘴邊 ────────────────────────────────────────────────
  'fish-snack': {
    kind: 'layer',
    box: '30 36 30 22',
    node: (
      <g transform="translate(34 48) scale(1.25) rotate(-10) translate(-34 -48)">
        <path d="M49 48 L55 44 L54.5 52 Z" fill="var(--acc-silver)" {...thin} />
        <path d="M33 48 Q40 42.5 49.5 48 Q40 53.5 33 48 Z" fill="var(--acc-silver)" {...thin} />
        <circle cx="36.8" cy="47.2" r="1" fill={LINE} />
        <path d="M42 46 Q43.2 48 42 50 M45 46.4 Q46 48 45 49.6" fill="none" stroke={LINE} strokeWidth={WF} strokeLinecap="round" />
      </g>
    ),
  },
  mustache: {
    kind: 'layer',
    box: '18 40 28 14',
    // 掛在鼻子下面，蓋住嘴巴
    node: (
      <path
        transform="translate(0 2.6)"
        d="M32 44.2 Q28 42 24.5 44 Q21.5 46 22.5 48.5 Q20 47.5 20.5 44.8 Q22 40.5 27 41.5 Q30.5 42.3 32 43.4 Q33.5 42.3 37 41.5 Q42 40.5 43.5 44.8 Q44 47.5 41.5 48.5 Q42.5 46 39.5 44 Q36 42 32 44.2 Z"
        fill="var(--acc-wood)"
        {...thin}
      />
    ),
  },
  mask: {
    kind: 'layer',
    box: '10 38 44 20',
    node: (
      <g>
        <path d="M19.5 44 Q14 43 11.5 40.5 M44.5 44 Q50 43 52.5 40.5" fill="none" {...thin} />
        <path d="M19 43 Q32 40.5 45 43 L44 51.5 Q32 56 20 51.5 Z" fill="var(--acc-cream)" {...stroke} />
        <path d="M21.5 46 Q32 44.5 42.5 46 M21.5 49 Q32 48.5 42.5 49" fill="none" {...thin} strokeOpacity="0.4" />
      </g>
    ),
  },

  // ── 頸部 ────────────────────────────────────────────────
  bell: {
    kind: 'layer',
    box: '14 50 36 16',
    node: (
      <g>
        <path d="M17 54 Q32 60 47 54 L46.5 57.6 Q32 63.4 17.5 57.6 Z" fill="var(--acc-coral)" {...stroke} />
        <circle cx="32" cy="61" r="3.6" fill="var(--acc-gold)" {...thin} />
        <path d="M30.2 61.6 H33.8 M32 61.6 V64" fill="none" stroke={LINE} strokeWidth={WF} strokeLinecap="round" />
      </g>
    ),
  },
  bowtie: {
    kind: 'layer',
    box: '19 55 26 15',
    // 領結掛在下巴下緣（下巴在 x 22–42 約 y 58.5–60），翅膀不伸進臉裡
    node: (
      <g>
        <path d="M30.5 62.6 L22.5 59 Q21.4 62.6 22.5 66.2 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M33.5 62.6 L41.5 59 Q42.6 62.6 41.5 66.2 Z" fill="var(--acc-lav)" {...stroke} />
        <rect x="29.5" y="60.2" width="5" height="5" rx="1.6" fill="var(--pink-deep)" {...thin} />
      </g>
    ),
  },
  necktie: {
    kind: 'layer',
    box: '24 56 16 19',
    // 領帶結從下巴下緣（y≈60）往下掛
    node: (
      <g>
        <path d="M30.3 63.6 L27.8 71 L32 74 L36.2 71 L33.7 63.6 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M28.8 59.3 L35.2 59.3 L33.9 63.9 L30.1 63.9 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M29.4 67.4 L34.8 65.4 M28.6 70.4 L35.6 67.8" stroke="var(--acc-gold)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  'exam-pass': {
    kind: 'layer',
    box: '18 55 28 17',
    // 掛繩從下巴邊緣（x 22／42、y≈58.4）開始，卡片掛在下巴下面
    node: (
      <g>
        <path d="M22.5 58.2 L29.5 62 M41.5 58.2 L34.5 62" fill="none" stroke="var(--acc-coral)" strokeWidth="2" strokeLinecap="round" />
        <rect x="26" y="61.2" width="12" height="8.5" rx="1.6" fill="var(--acc-cream)" {...thin} />
        <rect x="27.6" y="62.9" width="3.6" height="4.4" rx="0.6" fill="var(--acc-sky)" />
        <path d="M32.6 63.7 H36.2 M32.6 66.3 H35.4" stroke={LINE} strokeWidth={WF} strokeLinecap="round" />
      </g>
    ),
  },

  // ── 身上 ────────────────────────────────────────────────
  sweater: {
    kind: 'layer',
    box: '6 50 52 26',
    onBody: {
      // 從脖子往後套到腰，下擺是一圈羅紋；屁股露在外面
      wrap: sweaterWrap,
      sleeve: (
        <g>
          <path d={`M${-SLEEVE.half} ${SLEEVE.top} V${SLEEVE.len} H${SLEEVE.half} V${SLEEVE.top}`} fill="var(--acc-lav)" {...bstroke} />
          <rect
            x={-SLEEVE.half - 0.6}
            y={SLEEVE.len - SLEEVE.cuff / 2}
            width={SLEEVE.half * 2 + 1.2}
            height={SLEEVE.cuff}
            rx={SLEEVE.cuff / 2}
            fill="var(--acc-cream)"
            {...bthin}
          />
        </g>
      ),
      // 下巴下面的高領
      head: (
        <g>
          <path d="M20.5 56.6 Q32 61.4 43.5 56.6 L43.2 62 Q32 66.6 20.8 62 Z" fill="var(--acc-lav)" {...stroke} />
          <path d="M26 60.4 V64 M32 61.2 V65 M38 60.4 V64" stroke="var(--acc-cream)" strokeOpacity="0.75" {...seam} />
        </g>
      ),
    },
    node: (
      <g>
        <path d="M11 55 Q32 64.5 53 55 L54 63.5 Q32 73 10 63.5 Z" fill="var(--acc-lav)" {...stroke} />
        <path d="M16 58.6 L15.6 65 M21.5 60.6 L21.3 67.4 M27 61.8 L27 68.8 M32 62.2 V69.2 M37 61.8 L37 68.8 M42.5 60.6 L42.7 67.4 M48 58.6 L48.4 65" fill="none" stroke="var(--acc-cream)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.75" />
      </g>
    ),
  },
  sailor: {
    kind: 'layer',
    box: '4 50 56 26',
    onBody: {
      // 領片披在肩背上，邊上一道白線
      wrap: sailorWrap,
      // 下巴下面的領巾結
      head: (
        <g>
          <path d="M22 57 Q32 61.6 42 57 L41.4 60.6 Q32 64.8 22.6 60.6 Z" fill="var(--acc-navy)" {...stroke} />
          <path d="M28.4 62.6 L35.6 62.6 L32 70.4 Z" fill="var(--acc-coral)" {...thin} />
          <circle cx="32" cy="62.6" r="2.3" fill="var(--acc-coral)" {...thin} />
        </g>
      ),
    },
    node: (
      <g>
        <path d="M10 55 Q32 65 54 55 L56.5 64 Q32 75 7.5 64 Z" fill="var(--acc-navy)" {...stroke} />
        <path d="M11.6 59.2 Q32 69.6 52.4 59.2" fill="none" stroke="var(--acc-cream)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M27 62.4 L37 62.4 L32 71 Z" fill="var(--acc-coral)" {...thin} />
        <circle cx="32" cy="62.6" r="2.3" fill="var(--acc-coral)" {...thin} />
      </g>
    ),
  },

  // ── 背飾（畫在貓後面）────────────────────────────────────
  balloon: {
    kind: 'layer',
    motion: 'bob',
    box: '44 0 20 52',
    onBody: {
      // 線綁在背上，氣球飄在頭的後上方（頭像版在頭右上，接到身體會躲在頭後面）
      behind: (
        <g>
          <path d="M0 0 Q-4.5 -13 -6.2 -27.6" fill="none" stroke={LINE} strokeWidth={WF} strokeLinecap="round" />
          <ellipse cx="-6.5" cy="-36.4" rx="6.7" ry="8.3" fill="var(--acc-coral)" {...bthin} />
          <path d="M-7.7 -28.2 L-6.3 -26.6 L-5 -28.3 Z" fill="var(--acc-coral)" {...bthin} />
          <path d="M-9.9 -40.6 Q-8.9 -42.6 -6.9 -43.1" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ),
    },
    node: (
      <g>
        <path d="M54 46 Q52 34 56.5 19.5" fill="none" stroke={LINE} strokeWidth={WF} strokeLinecap="round" />
        <ellipse cx="57" cy="11.5" rx="6.3" ry="7.8" fill="var(--acc-coral)" {...thin} />
        <path d="M55.5 19 L57 20.6 L58.5 19 Z" fill="var(--acc-coral)" {...thin} />
        <path d="M54 7.5 Q55 5.6 56.8 5.2" fill="none" stroke="var(--acc-cream)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },
  cape: {
    kind: 'layer',
    onBody: {
      // 側面：綁在後頸、沿著背披到屁股後面（頭像版畫在頭後面，接到身體上會整件被身體擋住）
      over: capeOver,
      // 正面：披在背後，從身體兩側露出來，脖子前面一條領子加扣子
      frontal: { behind: capeFrontBehind, collar: capeFrontCollar },
    },
    box: '-2 30 68 36',
    node: (
      <path d="M12 38 Q2 50 -0.5 63.5 Q16 60 32 64 Q48 60 64.5 63.5 Q62 50 52 38 Z" fill="var(--acc-coral)" {...stroke} />
    ),
  },
  wings: {
    kind: 'layer',
    motion: 'flap',
    box: '-8 20 80 36',
    onBody: {
      // 側身只看得到一對翅膀從背上往後豎起來（遠的那片錯開一點、顏色不同）
      behind: (
        <g>
          <path
            d="M4 3 Q5 -14 -10 -25 Q-16 -24 -13.5 -19 Q-19.5 -17.5 -15.5 -13 Q-20 -9.5 -13.5 -7 Q-7 -1.5 4 3 Z"
            transform="translate(6.5 -2) scale(0.9)"
            fill="var(--acc-lav)"
            {...bstroke}
          />
          <path
            d="M4 3 Q5 -14 -10 -25 Q-16 -24 -13.5 -19 Q-19.5 -17.5 -15.5 -13 Q-20 -9.5 -13.5 -7 Q-7 -1.5 4 3 Z"
            fill="var(--acc-cream)"
            {...bstroke}
          />
          <path d="M-13.5 -19 Q-6 -16.5 -0.5 -10.5 M-15.5 -13 Q-8 -11.5 -1.5 -5.5" stroke="var(--acc-lav)" {...seam} />
        </g>
      ),
      // 正面：一左一右展開
      frontal: { behind: wingsFrontBehind },
    },
    node: (
      <g>
        <path
          d="M12 36 Q2 22 -5.5 27 Q-8 32 -3.5 35 Q-8 38 -4 42 Q-6.5 46 -1 48 Q4 50 11 46 Z"
          fill="var(--acc-cream)"
          {...stroke}
        />
        <path
          d="M52 36 Q62 22 69.5 27 Q72 32 67.5 35 Q72 38 68 42 Q70.5 46 65 48 Q60 50 53 46 Z"
          fill="var(--acc-cream)"
          {...stroke}
        />
        <path d="M-3.5 35 Q3 36 8 38 M-4 42 Q3 42 9 42.5 M67.5 35 Q61 36 56 38 M68 42 Q61 42 55 42.5" fill="none" stroke="var(--acc-lav)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    ),
  },

  // ── 背景（畫在最後面）────────────────────────────────────
  cushion: {
    kind: 'layer',
    box: '-2 52 68 16',
    // 全身版：一塊大坐墊鋪在地上，小貓坐在上面
    stage: (
      <g>
        <path d="M16 79.5 L12.5 76.5 M84 79.5 L87.5 76.5 M16 86.5 L12.5 89 M84 86.5 L87.5 89" stroke="var(--acc-gold)" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="14" y="76.5" width="72" height="12.5" rx="6.2" fill="var(--pink)" {...bstroke} />
        <path d="M21 83.6 Q50 87.4 79 83.6" stroke="var(--pink-deep)" strokeOpacity="0.6" {...seam} />
      </g>
    ),
    node: (
      <g>
        <path d="M0.5 57 L-2 54.5 M63.5 57 L66 54.5 M0.5 63 L-2 65.5 M63.5 63 L66 65.5" stroke="var(--acc-gold)" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="0" y="54" width="64" height="12" rx="6" fill="var(--pink)" {...stroke} />
        <path d="M6 60 Q32 63.5 58 60" fill="none" stroke="var(--pink-deep)" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
      </g>
    ),
  },
  'book-stack': {
    kind: 'layer',
    box: '44 26 24 38',
    // 全身版：三本書疊在小貓前面的地上，上面橫著一枝鉛筆（疊太高會頂到臉）。
    // 整疊往右挪 5：坐著的身體右緣到 x≈68，書放在身體旁邊，不壓在身體後面
    stage: (
      <g transform="translate(5 0)">
        <rect x="68" y="78.6" width="19" height="7" rx="1.4" fill="var(--acc-sky)" {...bthin} />
        <rect x="70" y="71.6" width="16" height="7" rx="1.4" fill="var(--acc-coral)" {...bthin} />
        <rect x="68.6" y="64.6" width="17.4" height="7" rx="1.4" fill="var(--acc-leaf)" {...bthin} />
        <path d="M71 82.1 H84 M73 75.1 H83 M71.6 68.1 H83" stroke="var(--acc-cream)" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M71.5 61.2 H80.5 L84 62.9 L80.5 64.6 H71.5 Z" fill="var(--acc-gold)" {...bthin} />
        <path d="M80.5 61.2 V64.6" fill="none" {...bthin} />
      </g>
    ),
    node: (
      <g>
        <rect x="48" y="55" width="19" height="7" rx="1.6" fill="var(--acc-sky)" {...thin} />
        <rect x="50" y="48" width="16" height="7" rx="1.6" fill="var(--acc-coral)" {...thin} />
        <rect x="47.5" y="41" width="18" height="7" rx="1.6" fill="var(--acc-leaf)" {...thin} />
        <rect x="51" y="34" width="14" height="7" rx="1.6" fill="var(--acc-lav)" {...thin} />
        <path d="M51 58.5 H64 M53 51.5 H63 M50.5 44.5 H62.5" stroke="var(--acc-cream)" strokeWidth="1" strokeLinecap="round" />
        <path d="M55 34 L57 27.5 L59 34" fill="var(--acc-gold)" {...thin} />
      </g>
    ),
  },
  moon: {
    kind: 'layer',
    box: '-1 -1 66 66',
    // 全身版：一圈夜空在小貓背後，月亮掛在左上（右上是頭）
    stage: (
      <g>
        <circle cx="50" cy="46" r="37" fill="var(--acc-night)" />
        <path d="M27 12.5 A9.5 9.5 0 1 0 36.5 23.5 A7.2 7.2 0 1 1 27 12.5 Z" fill="var(--acc-gold)" {...bthin} />
        <path
          d="M80 27 l0.9 2 l2 0.9 l-2 0.9 l-0.9 2 l-0.9 -2 l-2 -0.9 l2 -0.9 Z M19 52 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z M83 54 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z M70 11 l0.6 1.3 l1.3 0.6 l-1.3 0.6 l-0.6 1.3 l-0.6 -1.3 l-1.3 -0.6 l1.3 -0.6 Z"
          fill="var(--acc-cream)"
        />
      </g>
    ),
    node: (
      <g>
        <circle cx="32" cy="36" r="31" fill="var(--acc-night)" />
        <path d="M51 4.5 A10.5 10.5 0 1 0 61.5 17 A8 8 0 1 1 51 4.5 Z" fill="var(--acc-gold)" {...thin} />
        <path d="M11 12 l1 2.2 l2.2 1 l-2.2 1 l-1 2.2 l-1 -2.2 l-2.2 -1 l2.2 -1 Z M4.5 32 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z M59 33 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 Z" fill="var(--acc-cream)" />
      </g>
    ),
  },
  rainbow: {
    kind: 'layer',
    box: '-4 -4 72 50',
    // 全身版：彩虹從小貓背後跨過去，兩端落在雲上
    stage: (
      <g>
        <g fill="none" strokeLinecap="round" strokeWidth="3.6">
          <path d="M18 64 A32 32 0 0 1 82 64" stroke="var(--acc-coral)" />
          <path d="M21.6 64 A28.4 28.4 0 0 1 78.4 64" stroke="var(--acc-gold)" />
          <path d="M25.2 64 A24.8 24.8 0 0 1 74.8 64" stroke="var(--acc-leaf)" />
          <path d="M28.8 64 A21.2 21.2 0 0 1 71.2 64" stroke="var(--acc-sky)" />
        </g>
        {[13, 67].map((x) => (
          <path
            key={x}
            transform={`translate(${x} 59)`}
            d="M3.6 10 Q0.4 10 0.8 6.8 Q1.2 4 4.4 4.4 Q5.6 0.8 9.6 2 Q13.6 0.6 15 4.4 Q18.6 4.6 18.4 7.6 Q18.2 10 15.6 10 Z"
            fill="var(--acc-cream)"
            {...bthin}
          />
        ))}
      </g>
    ),
    node: (
      <g fill="none" strokeLinecap="round">
        <path d="M-1 42 A33 33 0 0 1 65 42" stroke="var(--acc-coral)" strokeWidth="4" />
        <path d="M3 42 A29 29 0 0 1 61 42" stroke="var(--acc-gold)" strokeWidth="4" />
        <path d="M7 42 A25 25 0 0 1 57 42" stroke="var(--acc-leaf)" strokeWidth="4" />
        <path d="M11 42 A21 21 0 0 1 53 42" stroke="var(--acc-sky)" strokeWidth="4" />
      </g>
    ),
  },

  // ── 毛色 ────────────────────────────────────────────────
  'fur-orange': { kind: 'fur', className: 'cb-fur-orange' },
  'fur-gray': { kind: 'fur', className: 'cb-fur-gray' },
  'fur-black': { kind: 'fur', className: 'cb-fur-black' },
  'fur-gold': { kind: 'fur', className: 'cb-fur-gold' },
};
