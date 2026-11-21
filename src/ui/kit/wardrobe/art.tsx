// 小八喵配件的圖（每件一個 SVG 片段，畫在貓的 64×64 座標裡）。
// 配件清單（ID、部位、取得方式）在 src/core/constants/wardrobe.ts；這裡只放圖。顏色只用 theme.css 的 token。
import type { ReactNode } from 'react';
import { PET_BACK_EASE, PET_HEAD_SCALE, PET_LEG_W } from '../../../core/constants/pet';
import type { ItemId } from '../../../core/types';

/** 配件自己的小動作（動畫在 styles/wardrobe.css 的 cb-motion-*） */
export type ItemMotion = 'bob' | 'hop' | 'flap' | 'flicker' | 'nibble' | 'twitch' | 'puff';

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
  /** 身體是不是正面朝著你（正面坐）：這時布面會沿脊椎鏡像再畫一次，蓋滿整個身體的布面要自己畫成左右對稱 */
  frontal: boolean;
}

export interface BodyArt {
  /** 衣服的布面：剪裁在身體輪廓內，所以每個姿勢都合身。原點在脖子那端、+x 朝前、-y 是背，身體往 -x 延伸 */
  wrap?: (body: BodyGeom) => ReactNode;
  /** 蓋在身體上、不剪裁（披風）。座標同 wrap */
  over?: (body: BodyGeom) => ReactNode;
  /** 前腿上端的袖子。原點在腿根、+y 往下，腿寬是 PET_LEG_W */
  sleeve?: ReactNode;
  /** 後腿上端的褲管（連身裝）。座標同 sleeve */
  trouser?: ReactNode;
  /** 整條腿（連腳掌）包成這個顏色：腳也包住的連身睡衣。有給就不必再給 sleeve、trouser */
  legs?: string;
  /** 成套的尾巴：尾巴換成這個顏色（連身裝把尾巴也包起來）；spots＝尾巴上一排斑點的顏色；stripes＝斑點改成一圈圈的環紋（老虎） */
  tail?: { fill: string; spots?: string; stripes?: boolean };
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

/** 毛色的花紋層（畫面的東西，不進 core/types.ts）。每種毛色畫哪些部位只定義在 ITEM_ART，Cat／CatBody 只讀表。 */
export interface FurMarks {
  /** 左右耳外框的顏色（[左耳, 右耳]）；沒給就沿用原本的 var(--cat-patch) */
  ears?: readonly [string, string];
  /** 畫在臉底色之上、五官之下，用頭的橢圓裁切（頭像 64×64 座標） */
  head?: ReactNode;
  /** 畫在軀幹底色與背花之上、衣服之下，用軀幹輪廓裁切（座標同 BodyArt.wrap） */
  body?: (body: BodyGeom) => ReactNode;
  /** 腿上的花紋（沒穿包腳連身裝時畫）：full＝整條腿換色（暹羅）、paw＝腳尖白色（賓士） */
  legs?: { kind: 'full' | 'paw'; fill: string };
  /** 尾巴顏色與環紋（沒穿成套連身裝時用；格式同 BodyArt.tail） */
  tail?: BodyArt['tail'];
}

export type ItemArt =
  /** 圖層：node 畫在貓的座標裡；box 是單獨顯示圖示時的 viewBox */
  | {
      kind: 'layer';
      node: ReactNode;
      box: string;
      motion?: ItemMotion;
      /** 單獨顯示時用的圖示（頭像版的圖單獨看認不出來的配件才給，例如連身裝）；沒給就用 node 和 box */
      icon?: { node: ReactNode; box: string };
      onBody?: BodyArt;
      /** 背景配件的全身版（身體座標，地面在 PET_GROUND）：畫在整隻貓後面。沒有就把頭像的圖放大墊在後面 */
      stage?: ReactNode;
    }
  /** 毛色：套在貓外層的 class（色票在 theme.css），選填的花紋畫在頭、身體、腿、尾巴 */
  | { kind: 'fur'; className: string; marks?: FurMarks };

const LINE = 'var(--cat-line)';
const n2 = (v: number) => Math.round(v * 100) / 100;
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

/**
 * 娃娃裝（連身裝）共用的尺寸：整個身體包起來，肚子一塊淺色，有的主題背上有斑點、背鰭。每個主題只給顏色（KIGURUMI）。
 * collar＝領口往前多出多少；trouser＝褲管從後腿腿根往下蓋多長（後腿的腿根埋在身體裡比前腿深，要蓋到露出身體的那一段）；
 * belly＝側面時肚子那塊從肚子半厚的幾成處開始；bellyLen、bellyHalf＝正面時肚子那塊占身體長度、背半厚的幾成（半徑）、
 * bellyAt＝它的中心在身體長度的幾成處；
 * spots＝斑點（在身體長度的幾成處、背半厚的幾成高、半徑）；patches＝乳牛斑（同上）；
 * stripes＝虎紋排在身體長度的幾成處，stripeHalf＝每根在背線那端的半寬、stripeLean＝尖端往屁股倒多少、stripeTip＝尖端長到背半厚的幾成（0＝身體中線）；
 * plates＝背鰭排在背上的哪裡、各是標準大小的幾倍：位置 0–1 是背線（肩膀到屁股最厚處）、1–2 是屁股那段圓弧（2＝屁股端）。
 * 頭很大、會擋住背的前半，所以背鰭排在後半到屁股；
 * plateHalf、plateH、plateSink、plateLean＝背鰭的半寬、高、底邊埋進身體多深、尖端往後倒多少
 */
const ONESIE = {
  collar: 9,
  trouser: 6.2,
  belly: 0.42,
  bellyLen: 0.36,
  bellyHalf: 0.42,
  bellyAt: 0.56,
  spots: [
    [0.32, 0.62, 2],
    [0.56, 0.74, 1.7],
    [0.78, 0.5, 2.2],
  ],
  stripes: [0.12, 0.28, 0.44, 0.6, 0.76, 0.92],
  stripeHalf: 1.8,
  stripeLean: 1.4,
  stripeTip: 0.2,
  patches: [
    [0.24, 0.5, 4.4],
    [0.56, 0.62, 5.2],
    [0.86, 0.32, 3.6],
  ],
  plates: [
    [0.35, 0.85],
    [1, 1],
    [1.5, 0.9],
  ],
  plateHalf: 3.4,
  plateH: 6,
  plateSink: 1.2,
  plateLean: 1,
} as const;

/** 娃娃裝布上的花樣：dots＝圓點、stars＝星星（睡衣）、stripes＝從背往下的虎紋、patches＝乳牛的大塊斑 */
type KigurumiPattern = 'dots' | 'stars' | 'stripes' | 'patches';
/** 一套娃娃裝的顏色：fill＝布、belly＝肚子那塊、spots＝花樣的顏色（身上和尾巴；沒有就不畫）、plates＝背鰭（沒有就不畫） */
interface KigurumiTheme {
  fill: string;
  belly: string;
  spots?: string;
  /** 花樣（有 spots 才畫）；不給是圓點 */
  pattern?: KigurumiPattern;
  plates?: string;
  /** 腳也包住（連身睡衣、企鵝）：整條腿換成這個顏色，腳掌不露出來 */
  feet?: string;
}
/** 每套娃娃裝的顏色只定義在這裡；頭套、連身裝、圖示都讀它 */
const KIGURUMI = {
  dino: { fill: 'var(--acc-leaf)', belly: 'var(--acc-cream)', spots: 'var(--acc-mint)', plates: 'var(--acc-gold)' },
  bear: { fill: 'var(--acc-wood)', belly: 'var(--acc-straw)' },
  frog: { fill: 'var(--acc-lime)', belly: 'var(--acc-cream)', spots: 'var(--acc-leaf)' },
  bunny: { fill: 'var(--acc-rose)', belly: 'var(--acc-cream)' },
  pajama: { fill: 'var(--acc-lav)', belly: 'var(--acc-cream)', spots: 'var(--acc-gold)', pattern: 'stars', feet: 'var(--acc-lav)' },
  cow: { fill: 'var(--acc-cream)', belly: 'var(--acc-rose)', spots: 'var(--acc-shade)', pattern: 'patches' },
  tiger: { fill: 'var(--acc-orange)', belly: 'var(--acc-cream)', spots: 'var(--acc-shade)', pattern: 'stripes' },
  penguin: { fill: 'var(--acc-night)', belly: 'var(--acc-cream)', feet: 'var(--acc-gold)' },
} as const satisfies Record<string, KigurumiTheme>;
/** 頭套上那隻動物自己的眼睛、鼻孔：固定用深色。外框線的顏色在黑貓＋深色模式會換成淺色，畫在布上看不清楚 */
const HOOD_EYE = 'var(--acc-shade)';

/** 星星的內圈半徑是外圈的幾成；畫成星星時比圓點放大幾倍（同樣半徑的星星看起來比圓點小） */
const STAR_INNER = 0.5;
const STAR_GROW = 1.6;
/** 五角星（中心 x,y、外半徑 r）：睡衣的花樣 */
function starPath(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = ((i * 36 - 90) * Math.PI) / 180;
    const k = i % 2 === 0 ? r : r * STAR_INNER;
    pts.push(`${n2(x + Math.cos(rad) * k)} ${n2(y + Math.sin(rad) * k)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 套在腿上端的一截布（袖子、褲管）：原點在腿根、+y 往下；cuff＝袖口羅紋的顏色（不給就沒有羅紋） */
function legCover(fill: string, len: number, cuff?: string): ReactNode {
  return (
    <g>
      <path d={`M${-SLEEVE.half} ${SLEEVE.top} V${len} H${SLEEVE.half} V${SLEEVE.top}`} fill={fill} {...bstroke} />
      {cuff ? (
        <rect
          x={-SLEEVE.half - 0.6}
          y={len - SLEEVE.cuff / 2}
          width={SLEEVE.half * 2 + 1.2}
          height={SLEEVE.cuff}
          rx={SLEEVE.cuff / 2}
          fill={cuff}
          {...bthin}
        />
      ) : null}
    </g>
  );
}

/** 一塊不規則的圓斑（乳牛裝、三花貓共用）：中心 x,y、大約的半徑 r */
function blobPath(x: number, y: number, r: number): string {
  const p = (dx: number, dy: number) => `${n2(x + dx * r)} ${n2(y + dy * r)}`;
  return `M${p(1, 0)} Q${p(1.05, 0.85)} ${p(0.05, 0.8)} Q${p(-1.1, 0.75)} ${p(-0.9, -0.05)} Q${p(-0.95, -1)} ${p(0, -0.85)} Q${p(0.95, -1.1)} ${p(1, 0)} Z`;
}

/** 從背線往身體裡面彎進去的楔形條紋（老虎裝、虎斑貓共用） */
function stripeWedgePath(x: number, edge: number, tip: number, half: number, lean: number): string {
  const mid = (edge + tip) / 2;
  return `M${n2(x + half)} ${n2(edge)} Q${n2(x + 0.4)} ${n2(mid)} ${n2(x - lean)} ${n2(tip)} Q${n2(x - 1.2)} ${n2(mid)} ${n2(x - half)} ${n2(edge)} Z`;
}

/**
 * 連身裝身上的花樣（側面在背那側；正面坐時左右各畫一份，side＝-1 或 1）。座標同 BodyArt.wrap。
 * 虎紋從背線往肚子那側長成一根根楔形，長到背半厚的 ONESIE.stripeTip 成；乳牛斑是幾塊大圓斑。
 */
function onesiePattern(theme: KigurumiTheme, body: BodyGeom, side: number): ReactNode {
  const fill = theme.spots;
  if (!fill) return null;
  if (theme.pattern === 'stripes') {
    const edge = side * (body.back + CLOTH_MARGIN);
    const tip = side * body.back * ONESIE.stripeTip;
    return ONESIE.stripes.map((at) => (
      <path key={at} d={stripeWedgePath(-body.len * at, edge, tip, ONESIE.stripeHalf, ONESIE.stripeLean)} fill={fill} />
    ));
  }
  if (theme.pattern === 'patches') {
    return ONESIE.patches.map(([at, up, r]) => <path key={at} d={blobPath(-body.len * at, side * body.back * up, r)} fill={fill} />);
  }
  return ONESIE.spots.map(([at, up, r]) =>
    theme.pattern === 'stars' ? (
      <path key={at} d={starPath(-body.len * at, side * body.back * up, r * STAR_GROW)} fill={fill} />
    ) : (
      <circle key={at} cx={n2(-body.len * at)} cy={n2(side * body.back * up)} r={r} fill={fill} />
    ),
  );
}

/** 連身裝的布面：整個身體都蓋住。側面時肚子那塊在身體下緣；正面時在中間，斑點左右各一份 */
function onesieWrap(theme: KigurumiTheme): (body: BodyGeom) => ReactNode {
  return (body) => {
    const top = -(body.back + CLOTH_MARGIN);
    const height = body.back + body.belly + CLOTH_MARGIN * 2;
    const rear = -(body.len + CLOTH_MARGIN);
    const sides = body.frontal ? [-1, 1] : [-1];
    const bellyTop = body.belly * ONESIE.belly;
    return (
      <g>
        <rect x={rear} y={top} width={ONESIE.collar - rear} height={height} fill={theme.fill} />
        {body.frontal ? (
          <ellipse
            cx={n2(-body.len * ONESIE.bellyAt)}
            cy="0"
            rx={n2(body.len * ONESIE.bellyLen)}
            ry={n2(body.back * ONESIE.bellyHalf)}
            fill={theme.belly}
            {...bthin}
          />
        ) : (
          <path
            d={`M-2 ${n2(-top)} V${n2(bellyTop * 1.2)} Q${n2(-body.len / 2)} ${n2(bellyTop * 0.6)} ${n2(-body.len + 3)} ${n2(bellyTop * 1.3)} V${n2(-top)} Z`}
            fill={theme.belly}
            {...bthin}
          />
        )}
        {theme.spots ? sides.map((side) => <g key={side}>{onesiePattern(theme, body, side)}</g>) : null}
      </g>
    );
  };
}

/** 連身裝的背鰭（側面）：沿著背線排一排，底邊埋進身體一點 */
function onesiePlates(fill: string): (body: BodyGeom) => ReactNode {
  return (body) => {
    const p0 = [-body.shoulder, -body.chest] as const;
    const p3 = [-(body.len - body.hip), -body.back] as const;
    /** 跟身體的背線同一條曲線（同一個緩急），背鰭才會站在背上 */
    const ease = (p0[0] - p3[0]) * PET_BACK_EASE;
    const xs = [p0[0], p0[0] - ease, p3[0] + ease, p3[0]] as const;
    const ys = [p0[1], p0[1], p3[1], p3[1]] as const;
    const bezier = (v: readonly [number, number, number, number], t: number) => {
      const u = 1 - t;
      return u * u * u * v[0] + 3 * u * u * t * v[1] + 3 * u * t * t * v[2] + t * t * t * v[3];
    };
    return (
      <g>
        {ONESIE.plates.map(([at, k]) => {
          /** 屁股那段圓弧上轉了幾度（背線上是 0）：背鰭跟著輪廓的法線倒 */
          const turn = Math.max(0, at - 1) * 90;
          const rad = (turn * Math.PI) / 180;
          const x = at <= 1 ? bezier(xs, at) : p3[0] - body.hip * Math.sin(rad);
          const y = at <= 1 ? bezier(ys, at) : -body.back * Math.cos(rad);
          const half = ONESIE.plateHalf * k;
          return (
            <path
              key={at}
              transform={`translate(${n2(x)} ${n2(y)}) rotate(${n2(-turn)})`}
              d={`M${n2(half)} ${ONESIE.plateSink} L${-ONESIE.plateLean} ${n2(ONESIE.plateSink - ONESIE.plateH * k)} L${n2(-half)} ${ONESIE.plateSink} Z`}
              fill={fill}
              {...bthin}
            />
          );
        })}
      </g>
    );
  };
}

/**
 * 一件連身裝（身上）：整個身體包起來、前腿套袖子、後腿套褲管、尾巴成套、腳掌露在外面。
 * 圖示另外畫成一件看得出來的小連身衣（頭像版只是下巴下面那一圈領口，單獨看認不出是衣服）。
 */
function onesieArt(theme: KigurumiTheme): ItemArt {
  return {
    kind: 'layer',
    box: '6 50 52 26',
    icon: {
      box: '0 0 32 32',
      node: (
        <g>
          <path
            d="M10 6.5 Q16 3.5 22 6.5 L27.4 12 Q29 15 26.2 16.8 L22.5 14.6 V24 Q22.5 29 19.5 29 H17.3 V24.6 H14.7 V29 H12.5 Q9.5 29 9.5 24 V14.6 L5.8 16.8 Q3 15 4.6 12 Z"
            fill={theme.fill}
            stroke={LINE}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <ellipse cx="16" cy="17.6" rx="3.9" ry="4.8" fill={theme.belly} stroke={LINE} strokeWidth="1" />
          <path d="M12.6 5.6 Q16 8.6 19.4 5.6" fill="none" stroke={LINE} strokeWidth="1.1" strokeLinecap="round" />
          {theme.spots ? (
            <g fill={theme.spots}>
              {theme.pattern === 'stripes' ? (
                <path d="M6.4 11.6 L9.6 12.8 L6.9 14.4 Z M25.6 11.6 L22.4 12.8 L25.1 14.4 Z M9.6 20 L12.2 20.8 L9.6 22.2 Z M22.4 20 L19.8 20.8 L22.4 22.2 Z M10.6 4.6 L12.6 7.6 L13.4 5.2 Z M21.4 4.6 L19.4 7.6 L18.6 5.2 Z" />
              ) : theme.pattern === 'patches' ? (
                <>
                  <path d={blobPath(8, 12.4, 2.2)} />
                  <path d={blobPath(20.6, 25.4, 1.8)} />
                  <path d={blobPath(13.4, 8.6, 1.6)} />
                </>
              ) : (
                <>
                  <circle cx="7.6" cy="12.6" r="1.1" />
                  <circle cx="24.4" cy="12.6" r="1.1" />
                  <circle cx="11.6" cy="26" r="1" />
                  <circle cx="20.4" cy="26" r="1" />
                </>
              )}
            </g>
          ) : null}
          {theme.plates ? <path d="M14.2 4.6 L16 1.2 L17.8 4.6 Z" fill={theme.plates} stroke={LINE} strokeWidth="1" strokeLinejoin="round" /> : null}
        </g>
      ),
    },
    onBody: {
      wrap: onesieWrap(theme),
      // 腳也包住的（睡衣、企鵝）整條腿換成 feet 的顏色；其他的只套袖子和褲管、腳掌露在外面
      ...(theme.feet
        ? { legs: theme.feet }
        : { sleeve: legCover(theme.fill, SLEEVE.len), trouser: legCover(theme.fill, ONESIE.trouser) }),
      tail: { fill: theme.fill, ...(theme.spots ? { spots: theme.spots } : {}), ...(theme.pattern === 'stripes' ? { stripes: true } : {}) },
      // 側面：背上一排背鰭；直立朝著你的姿勢從正面看不到背鰭（給空的 frontal 就不畫側面那排）
      ...(theme.plates ? { over: onesiePlates(theme.plates), frontal: {} } : {}),
      // 下巴下面的領口
      head: <path d="M20.5 56.6 Q32 61.4 43.5 56.6 L43.2 62 Q32 66.6 20.8 62 Z" fill={theme.fill} {...stroke} />,
    },
    node: (
      <g>
        <path d="M11 55 Q32 64.5 53 55 L54 63.5 Q32 73 10 63.5 Z" fill={theme.fill} {...stroke} />
        <path d="M24.5 61.6 Q32 63.6 39.5 61.6 L40 68.4 Q32 70.8 24 68.4 Z" fill={theme.belly} {...thin} />
        {theme.spots ? (
          <g fill={theme.spots}>
            {theme.pattern === 'stripes' ? (
              <path d="M14.6 58.8 L18.6 60.2 L15.2 63.6 Z M49.4 58.8 L45.4 60.2 L48.8 63.6 Z" />
            ) : theme.pattern === 'patches' ? (
              <path d={blobPath(16.5, 61.4, 2.6)} />
            ) : (
              <>
                <circle cx="16.5" cy="61.4" r="1.8" />
                <circle cx="47.5" cy="61.4" r="1.8" />
              </>
            )}
          </g>
        ) : null}
      </g>
    ),
  };
}

/**
 * 頭套的輪廓（頭像座標）：包住頭頂、兩邊蓋到臉頰，不繞到下巴（頸部配件露在外面）；中間的開口露出臉。
 * 貓耳朵豎在頭頂兩側（耳尖約 (14,7)、(50,7)，頭像的耳朵還會抖，最多轉 9 度），每個頭套都要把它們整個包住：
 * pointed＝耳朵的地方鼓成尖耳罩；dome＝圓頂，耳朵那兩塊由各主題自己的圓耳朵、大眼睛、垂耳蓋住（HOOD_EAR 那一圈之內）；
 * egg＝蛋形的高圓頂，整個把耳朵包進去（沒有耳朵的動物）。
 */
const HOOD_SIDES_AND_OPENING =
  'Q61.2 40 59 48.5 Q57.6 52 55 49.5 C55.5 34 46 25.5 32 25.5 C18 25.5 8.5 34 9 49.5 Q6.4 52 5 48.5 Z';
const HOOD_OUTLINE = {
  pointed: `M5 48.5 Q2.8 40 4.4 32 Q5 28.5 6.4 25.5 L9.2 5.6 Q10.6 2.4 13.6 4.2 L27.5 12.6 Q32 11.2 36.5 12.6 L50.4 4.2 Q53.4 2.4 54.8 5.6 L57.6 25.5 Q59 28.5 59.6 32 ${HOOD_SIDES_AND_OPENING}`,
  dome: `M5 48.5 Q2.8 40 4.4 32 Q5.6 22 14 16.5 Q32 4.5 50 16.5 Q58.4 22 59.6 32 ${HOOD_SIDES_AND_OPENING}`,
  /** 蛋形：沒有耳朵的動物（企鵝），整個圓頂撐高到把貓耳朵包在裡面 */
  egg: `M5 48.5 Q2.8 40 4.4 32 Q0 -1 32 -0.4 Q64 -1 59.6 32 ${HOOD_SIDES_AND_OPENING}`,
} as const;
/** 圓頂頭套上蓋住貓耳朵的那一圈（左邊那顆；右邊是 x 鏡像）：圓心與半徑。圓耳朵、大眼睛都畫成這麼大 */
const HOOD_EAR = { x: 13.6, y: 11.4, r: 9.4 } as const;
/** 左右各畫一份（右邊是沿頭像中線 x=32 的鏡像） */
function mirrored(node: ReactNode): ReactNode {
  return (
    <>
      {node}
      <g transform="translate(64 0) scale(-1 1)">{node}</g>
    </>
  );
}
/** 頭套開口上緣的牙齒：一顆牙（原點在牙根中間、尖端朝 +y），和每顆牙的位置與朝向（頭像座標；朝臉的中心） */
const HOOD_TOOTH = 'M-2.8 -1.5 L0 4.4 L2.8 -1.5 Z';
const HOOD_TEETH = [
  [15.1, 31.6, -44],
  [23.2, 26.9, -19],
  [32, 25.5, 0],
  [40.8, 26.9, 19],
  [48.9, 31.6, 44],
] as const;

/**
 * 一件頭套（頭頂）：整顆頭套進去。疊的順序：under（畫在布後面：頭頂的背鰭、圓耳朵）→ 牙齒 → 布（輪廓）→ over（布上面：耳朵裡面、動物自己的眼睛鼻子、垂耳）。
 */
function hoodArt(spec: {
  theme: KigurumiTheme;
  outline: string;
  box: string;
  under?: ReactNode;
  teeth?: boolean;
  over?: ReactNode;
}): ItemArt {
  return {
    kind: 'layer',
    box: spec.box,
    node: (
      <g>
        {spec.under}
        {spec.teeth
          ? HOOD_TEETH.map(([x, y, rot]) => (
              <path key={x} transform={`translate(${x} ${y}) rotate(${rot})`} d={HOOD_TOOTH} fill="var(--acc-cream)" {...thin} />
            ))
          : null}
        <path d={spec.outline} fill={spec.theme.fill} {...stroke} />
        {spec.over}
      </g>
    ),
  };
}

/**
 * 乳牛全套的大斧頭（拿在舉起來的手上，CatBody 的 held）：座標同那條手臂，原點在肩膀、+y 沿著手臂往外。
 * 握在柄的尾端，柄沿著手臂再往外伸 handle；斧刃在手臂的 -x 那一側（手臂舉過頭時朝前，劈下去時朝下）。
 * grip＝柄的尾端藏進腳掌多深；half＝柄的半寬；blade、bladeH＝斧刃伸出去多遠、多寬；knob＝柄頂端那顆的半徑
 */
const AXE = { handle: 24, grip: 2.4, half: 1.7, blade: 15, bladeH: 18, knob: 2.2 } as const;
export function heldAxe(armLen: number): ReactNode {
  const start = armLen - AXE.grip;
  const end = armLen + AXE.handle;
  const top = end - AXE.bladeH;
  return (
    <g className="cb-pet-axe">
      <rect x={-AXE.half} y={start} width={AXE.half * 2} height={end - start} rx={AXE.half} fill="var(--acc-wood)" {...bthin} />
      <path
        d={`M0 ${n2(end - 1)} L${-AXE.blade + 1.5} ${n2(end + 1.6)} Q${-AXE.blade - 2.4} ${n2(end - AXE.bladeH / 2)} ${-AXE.blade + 1.5} ${n2(top - 1.6)} L0 ${n2(top + 1)} Z`}
        fill="var(--acc-silver)"
        {...bstroke}
      />
      <path
        d={`M${-AXE.blade + 0.6} ${n2(end - 0.6)} Q${-AXE.blade - 1.4} ${n2(end - AXE.bladeH / 2)} ${-AXE.blade + 0.6} ${n2(top - 0.6)}`}
        fill="none"
        stroke="var(--acc-cream)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="0" cy={end} r={AXE.knob} fill="var(--acc-wood)" {...bthin} />
    </g>
  );
}

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

/** 虎斑貓背上三條弧形紋的比例（位置、半寬、尖端往後倒多少、尖端長到背半厚的幾成） */
const FUR_TABBY = { stripes: [0.28, 0.5, 0.72], half: 2.2, lean: 2, tip: 0.12 } as const;

/** 虎斑／銀虎斑共用的花紋：額頭三條 M 字紋、兩頰各兩條細紋、背上三條弧形紋、尾巴環紋（顏色由 theme.css 換） */
const TABBY_MARKS: FurMarks = {
  ears: ['var(--cat-fur-far)', 'var(--cat-fur-far)'],
  head: (
    <g fill="none" stroke="var(--cat-mark)" strokeLinecap="round">
      <path d="M25.8 19.2 Q27 23.8 27.6 27.6 M32 18.2 V28 M38.2 19.2 Q37 23.8 36.4 27.6" strokeWidth="2.6" />
      <path d="M6.5 36.5 Q10.5 37.5 14 39 M6.5 41.8 Q10.5 42.2 13.8 43" strokeWidth="2" />
      <path d="M57.5 36.5 Q53.5 37.5 50 39 M57.5 41.8 Q53.5 42.2 50.2 43" strokeWidth="2" />
    </g>
  ),
  body: (body) => {
    const sides = body.frontal ? [-1, 1] : [-1];
    return (
      <g>
        {sides.map((side) => {
          const edge = side * (body.back + CLOTH_MARGIN);
          const tip = side * body.back * FUR_TABBY.tip;
          return (
            <g key={side}>
              {FUR_TABBY.stripes.map((at) => (
                <path
                  key={at}
                  d={stripeWedgePath(-body.len * at, edge, tip, FUR_TABBY.half, FUR_TABBY.lean)}
                  fill="var(--cat-mark)"
                />
              ))}
            </g>
          );
        })}
      </g>
    );
  },
  tail: { fill: 'var(--cat-fur-far)', spots: 'var(--cat-mark)', stripes: true },
};

/** 賓士貓花紋：白色口鼻與下巴、白胸口、四隻腳尖白色 */
const TUXEDO_MARKS: FurMarks = {
  head: (
    <path
      d="M32 35.5 Q29.5 43.5 20 46 Q13 48.5 11.5 55 L14 60 H50 L52.5 55 Q51 48.5 44 46 Q34.5 43.5 32 35.5 Z"
      fill="var(--cat-white)"
    />
  ),
  body: (body) =>
    body.frontal ? (
      <ellipse cx={n2(-body.len * 0.28)} cy="0" rx={n2(body.len * 0.36)} ry={n2(body.back * 0.44)} fill="var(--cat-white)" />
    ) : (
      <ellipse
        cx={n2(-body.len * 0.24)}
        cy={n2(body.belly * 0.76)}
        rx={n2(body.len * 0.34)}
        ry={n2(body.belly * 0.58)}
        fill="var(--cat-white)"
      />
    ),
  legs: { kind: 'paw', fill: 'var(--cat-white)' },
};

/** 三花貓花紋：左耳與左頭側橘斑、右耳與右頭側黑斑、背上一塊橘一塊黑、橘色尾巴 */
const CALICO_MARKS: FurMarks = {
  ears: ['var(--cat-mark)', 'var(--cat-mark-2)'],
  head: (
    <g>
      <path d="M6 42 Q6 18 31 18 Q28 29 21 33 Q13 36 10 46 Q7 45 6 42 Z" fill="var(--cat-mark)" />
      <path d="M58 40 Q58 18 35 18 Q39 27 45 31 Q52 34 55 43 Q57 42 58 40 Z" fill="var(--cat-mark-2)" />
    </g>
  ),
  body: (body) =>
    body.frontal ? (
      <g>
        <path d={blobPath(-body.len * 0.54, -body.back * 0.68, body.back * 0.42)} fill="var(--cat-mark)" />
        <path d={blobPath(-body.len * 0.54, -body.back * 0.68, body.back * 0.42)} transform="scale(1 -1)" fill="var(--cat-mark-2)" />
      </g>
    ) : (
      <g>
        <path d={blobPath(-body.len * 0.34, -body.back * 0.58, body.back * 0.52)} fill="var(--cat-mark)" />
        <path d={blobPath(-body.len * 0.74, -body.back * 0.44, body.back * 0.52)} fill="var(--cat-mark-2)" />
      </g>
    ),
  tail: { fill: 'var(--cat-mark)' },
};

/** 暹羅貓花紋：深咖啡色耳朵、臉中央（鼻子周圍的橢圓，不蓋住眼睛）、四隻腳、尾巴 */
const SIAMESE_MARKS: FurMarks = {
  ears: ['var(--cat-mark)', 'var(--cat-mark)'],
  // 臉中央的面罩：外圈淡淡地暈到兩眼之間，內圈包住鼻子與嘴；用中間色，五官照舊是深色、看得清楚
  head: (
    <g>
      <ellipse cx="32" cy="44" rx="13" ry="11" fill="var(--cat-mark-2)" opacity="0.5" />
      <ellipse cx="32" cy="46" rx="8.5" ry="6.5" fill="var(--cat-mark-2)" />
    </g>
  ),
  legs: { kind: 'full', fill: 'var(--cat-mark)' },
  tail: { fill: 'var(--cat-mark)' },
};

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
  'dino-hood': hoodArt({
    theme: KIGURUMI.dino,
    outline: HOOD_OUTLINE.pointed,
    box: '0 0 64 54',
    // 整顆頭套進小怪獸的嘴巴裡：開口上緣一排牙齒，頭頂一片背鰭，額頭上是小怪獸自己的眼睛和鼻孔
    under: <path d="M28.4 13.4 L32 5 L35.6 13.4 Z" fill={KIGURUMI.dino.plates} {...thin} />,
    teeth: true,
    over: (
      <g>
        <path d="M12.3 10 L10.9 19.5 L18.4 14.4 Z M51.7 10 L53.1 19.5 L45.6 14.4 Z" fill={KIGURUMI.dino.spots} />
        <circle cx="25.5" cy="19.6" r="1.7" fill={HOOD_EYE} />
        <circle cx="38.5" cy="19.6" r="1.7" fill={HOOD_EYE} />
        <circle cx="30.3" cy="22.4" r="0.8" fill={HOOD_EYE} />
        <circle cx="33.7" cy="22.4" r="0.8" fill={HOOD_EYE} />
      </g>
    ),
  }),
  'bear-hood': hoodArt({
    theme: KIGURUMI.bear,
    outline: HOOD_OUTLINE.dome,
    box: '0 0 64 54',
    // 兩顆圓耳朵（包住貓耳朵），額頭上是小熊的眼睛和淺色的鼻口
    under: mirrored(<circle cx={HOOD_EAR.x} cy={HOOD_EAR.y} r={HOOD_EAR.r} fill={KIGURUMI.bear.fill} {...stroke} />),
    over: (
      <g>
        {mirrored(<circle cx={HOOD_EAR.x} cy={HOOD_EAR.y - 1.4} r="4.4" fill={KIGURUMI.bear.belly} />)}
        <circle cx="24.6" cy="17.6" r="1.6" fill={HOOD_EYE} />
        <circle cx="39.4" cy="17.6" r="1.6" fill={HOOD_EYE} />
        <ellipse cx="32" cy="20.6" rx="4.6" ry="3.1" fill={KIGURUMI.bear.belly} {...thin} strokeWidth={WF} />
        <ellipse cx="32" cy="19.6" rx="1.7" ry="1.2" fill={HOOD_EYE} />
      </g>
    ),
  }),
  'frog-hood': hoodArt({
    theme: KIGURUMI.frog,
    outline: HOOD_OUTLINE.dome,
    box: '0 0 64 54',
    // 頭頂兩顆凸出來的大眼睛（包住貓耳朵），額頭上兩個鼻孔
    under: mirrored(<circle cx={HOOD_EAR.x} cy={HOOD_EAR.y} r={HOOD_EAR.r} fill={KIGURUMI.frog.fill} {...stroke} />),
    over: (
      <g>
        {mirrored(
          <g>
            <circle cx={HOOD_EAR.x} cy={HOOD_EAR.y - 0.6} r="5.8" fill="var(--acc-cream)" {...thin} strokeWidth={WF} />
            <circle cx={HOOD_EAR.x + 1.2} cy={HOOD_EAR.y} r="2.9" fill={HOOD_EYE} />
            <circle cx={HOOD_EAR.x + 0.2} cy={HOOD_EAR.y - 1.1} r="0.9" fill="var(--acc-cream)" />
          </g>,
        )}
        <circle cx="29.8" cy="19.4" r="0.9" fill={HOOD_EYE} />
        <circle cx="34.2" cy="19.4" r="0.9" fill={HOOD_EYE} />
      </g>
    ),
  }),
  'bunny-hood': hoodArt({
    theme: KIGURUMI.bunny,
    outline: HOOD_OUTLINE.dome,
    box: '-4 0 72 54',
    // 垂耳兔：兩隻長耳朵從頭頂兩側垂下來（耳根包住貓耳朵），額頭上是兔子的眼睛和小鼻子
    over: (
      <g>
        {mirrored(
          <g>
            <path
              d="M24.5 12.6 Q13 0.6 5 5.6 Q-3 13 -2.2 30 Q-1.6 44 3.8 46.6 Q9 47.2 9.6 38 Q9.4 25 13.6 19.4 Q19.5 17.5 24.5 12.6 Z"
              fill={KIGURUMI.bunny.fill}
              {...stroke}
            />
            <path d="M3.4 15 Q1 27 2.6 39.4 Q3.8 42.6 5.6 39.4 Q5.2 26 8.2 15.6 Q5.6 12.6 3.4 15 Z" fill="var(--pink-deep)" fillOpacity="0.6" />
          </g>,
        )}
        <circle cx="25.6" cy="18.6" r="1.6" fill={HOOD_EYE} />
        <circle cx="38.4" cy="18.6" r="1.6" fill={HOOD_EYE} />
        <path d="M30.6 20.6 H33.4 L32 22.4 Z" fill="var(--pink-deep)" stroke="var(--pink-deep)" strokeWidth="0.8" strokeLinejoin="round" />
      </g>
    ),
  }),
  'pajama-hood': hoodArt({
    theme: KIGURUMI.pajama,
    outline: HOOD_OUTLINE.pointed,
    box: '0 0 64 54',
    // 睡衣的帽子：貓耳朵形狀的帽兜，耳朵裡面淺色，額頭上一彎月亮、兩顆星星
    over: (
      <g>
        <path d="M12.3 10 L10.9 19.5 L18.4 14.4 Z M51.7 10 L53.1 19.5 L45.6 14.4 Z" fill={KIGURUMI.pajama.belly} />
        <path d="M33.6 14.2 A4.6 4.6 0 1 0 36.6 21.6 A3.7 3.7 0 0 1 33.6 14.2 Z" fill={KIGURUMI.pajama.spots} {...thin} strokeWidth={WF} />
        <path d={starPath(23.4, 20.4, 2.5)} fill={KIGURUMI.pajama.spots} />
        <path d={starPath(43.4, 21.6, 2)} fill={KIGURUMI.pajama.spots} />
      </g>
    ),
  }),

  'cow-hood': hoodArt({
    theme: KIGURUMI.cow,
    outline: HOOD_OUTLINE.egg,
    box: '-6 -2 76 56',
    // 乳牛：蛋形的帽子把貓耳朵整個包住，兩側各一隻往外垂的耳朵（一白一黑），頭頂兩側一對往外彎的大牛角；
    // 鼻口是橫跨額頭的寬扁橢圓、鼻孔在兩端斜斜的（圓的小鼻子加中間兩個點會像豬）
    under: (
      <g>
        <path d="M6.4 17.6 Q-0.4 15.4 -2.2 21.6 Q0.4 27 7 24.4 Z" fill={KIGURUMI.cow.fill} {...stroke} />
        <path d="M57.6 17.6 Q64.4 15.4 66.2 21.6 Q63.6 27 57 24.4 Z" fill={KIGURUMI.cow.spots} {...stroke} />
      </g>
    ),
    over: (
      <g>
        <path d="M5 19.4 Q1.2 18.6 0 21.8 Q1.6 24.4 5.4 23.2 Z" fill={KIGURUMI.cow.belly} />
        <path d={blobPath(47.6, 11.6, 4.2)} fill={KIGURUMI.cow.spots} />
        <path d={blobPath(8.6, 33, 2.6)} fill={KIGURUMI.cow.spots} />
        {mirrored(
          <g>
            <path d="M11.4 7.6 Q3.2 7 1.4 -0.6 Q7.6 2.6 17.6 3.6 Q16.4 6.6 11.4 7.6 Z" fill="var(--acc-straw)" {...thin} />
            <path d="M4.6 3.4 Q8 4.8 12 5" fill="none" stroke={LINE} strokeWidth={WF} strokeLinecap="round" strokeOpacity="0.5" />
          </g>,
        )}
        <circle cx="23.8" cy="12.8" r="1.6" fill={HOOD_EYE} />
        <circle cx="40.2" cy="12.8" r="1.6" fill={HOOD_EYE} />
        <ellipse cx="32" cy="20.6" rx="13.8" ry="4.6" fill={KIGURUMI.cow.belly} {...thin} strokeWidth={WF} />
        <ellipse cx="23.6" cy="20.8" rx="1.3" ry="2.3" transform="rotate(-28 23.6 20.8)" fill={HOOD_EYE} />
        <ellipse cx="40.4" cy="20.8" rx="1.3" ry="2.3" transform="rotate(28 40.4 20.8)" fill={HOOD_EYE} />
      </g>
    ),
  }),
  'tiger-hood': hoodArt({
    theme: KIGURUMI.tiger,
    outline: HOOD_OUTLINE.dome,
    box: '0 0 64 54',
    // 老虎：兩顆圓耳朵（包住貓耳朵），額頭上一個「王」字，兩頰各兩道虎紋
    under: mirrored(<circle cx={HOOD_EAR.x} cy={HOOD_EAR.y} r={HOOD_EAR.r} fill={KIGURUMI.tiger.fill} {...stroke} />),
    over: (
      <g>
        {mirrored(
          <g>
            <circle cx={HOOD_EAR.x} cy={HOOD_EAR.y - 1} r="4.4" fill={KIGURUMI.tiger.belly} />
            <path d="M4.2 33 L10.2 34.8 L4.4 36.8 Z M4.4 39.6 L9.8 40.8 L4.9 42.6 Z" fill={KIGURUMI.tiger.spots} />
          </g>,
        )}
        <path d="M27.6 12.2 H36.4 M28.4 15.6 H35.6 M27.6 19 H36.4 M32 12.2 V19" fill="none" stroke={KIGURUMI.tiger.spots} strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="22.8" cy="19.6" r="1.6" fill={HOOD_EYE} />
        <circle cx="41.2" cy="19.6" r="1.6" fill={HOOD_EYE} />
      </g>
    ),
  }),
  'penguin-hood': hoodArt({
    theme: KIGURUMI.penguin,
    outline: HOOD_OUTLINE.egg,
    box: '0 -2 64 56',
    // 企鵝：深色的蛋形帽子（把貓耳朵整個包進去），兩顆白底的圓眼睛，額頭垂下一個黃色的嘴喙。布是深色的，眼睛墊白底才看得到
    over: (
      <g>
        {mirrored(
          <g>
            <circle cx="23.4" cy="16.6" r="3.8" fill={KIGURUMI.penguin.belly} {...thin} strokeWidth={WF} />
            <circle cx="24.4" cy="17.2" r="1.9" fill={HOOD_EYE} />
            <circle cx="23.8" cy="16.4" r="0.6" fill={KIGURUMI.penguin.belly} />
          </g>,
        )}
        <path d="M28 20.8 Q32 19 36 20.8 L32 26 Z" fill={KIGURUMI.penguin.feet} {...thin} />
      </g>
    ),
  }),
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
    motion: 'nibble',
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
    motion: 'twitch',
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
    motion: 'puff',
    box: '10 38 44 20',
    node: (
      <g>
        <path d="M19.5 44 Q14 43 11.5 40.5 M44.5 44 Q50 43 52.5 40.5" fill="none" {...thin} />
        <path d="M19 43 Q32 40.5 45 43 L44 51.5 Q32 56 20 51.5 Z" fill="var(--acc-cream)" {...stroke} />
        <path d="M21.5 46 Q32 44.5 42.5 46 M21.5 49 Q32 48.5 42.5 49" fill="none" {...thin} strokeOpacity="0.4" />
      </g>
    ),
  },

  // 娃娃裝的嘴邊裝飾：從嘴巴往右邊伸出去（不超過 x=64，接在身體上才不會頂出圖外）
  'fire-breath': {
    kind: 'layer',
    motion: 'flicker',
    box: '32 36 34 26',
    // 一大口火從嘴角往右下噴出去：比臉頰還遠；往下斜是因為戴頭套時臉的右上側被頭套蓋住
    node: (
      <g transform="translate(35 49) rotate(16) scale(1.4) translate(-35 -49)">
        <path
          d="M35 47.4 Q41 39.6 50.5 40.6 Q46.6 43.8 54 44.4 Q48.4 47.4 55.5 50.6 Q47.8 51.4 50.6 55.6 Q42 56 35 50.4 Z"
          fill="var(--acc-coral)"
          {...thin}
        />
        <path d="M36.6 48 Q41.4 43.8 46.4 44.2 Q44 46.6 48.2 47.6 Q44.2 49.2 46 52 Q41 52 36.6 49.6 Z" fill="var(--acc-gold)" />
      </g>
    ),
  },
  'honey-dipper': {
    kind: 'layer',
    motion: 'nibble',
    box: '30 41 28 24',
    // 叼著一根蜂蜜棒：木柄從嘴角伸出去，棒頭沾滿蜂蜜、往下滴
    node: (
      <g>
        <path d="M34 48.4 L46.4 52.6" stroke={LINE} strokeWidth="4.2" strokeLinecap="round" />
        <path d="M34 48.4 L46.4 52.6" stroke="var(--acc-wood)" strokeWidth="2.2" strokeLinecap="round" />
        <path className="cb-art-drip" d="M49.4 58 Q48 61.4 50 63 Q52 61.4 50.8 58 Z" fill="var(--acc-gold)" {...thin} strokeWidth={WF} />
        <ellipse cx="50" cy="54" rx="4.4" ry="3.9" transform="rotate(20 50 54)" fill="var(--acc-gold)" {...thin} />
        <path d="M47.4 51.6 L46.2 55.6 M50.4 50.4 L49 57.4 M53.2 51.6 L52.2 56.6" stroke={LINE} strokeWidth={WF} strokeLinecap="round" strokeOpacity="0.55" />
      </g>
    ),
  },
  'frog-bubble': {
    kind: 'layer',
    box: '34 40 30 22',
    // 吹泡泡：一串泡泡從嘴邊往右下飄出去（繞過頭套垂到臉頰的那一段，戴著頭套也看得到）
    node: (
      <g>
        {(
          [
            [39.8, 48.8, 2.6],
            [46.4, 45.8, 3.8],
            [52, 53, 5.2],
            [60, 57.4, 3.3],
          ] as const
        ).map(([x, y, r], i) => (
          <g key={x} className="cb-art-bubble" style={{ animationDelay: `${i * -0.6}s` }}>
            <circle cx={x} cy={y} r={r} fill="var(--acc-sky)" fillOpacity="0.6" stroke={LINE} strokeWidth={WF} />
            <path
              d={`M${x - r * 0.5} ${y - r * 0.1} Q${x - r * 0.45} ${y - r * 0.5} ${x - r * 0.05} ${y - r * 0.55}`}
              fill="none"
              stroke="var(--acc-cream)"
              strokeWidth={r > 3 ? 1.2 : 0.9}
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    ),
  },
  carrot: {
    kind: 'layer',
    motion: 'nibble',
    box: '30 39 34 20',
    // 叼著一根紅蘿蔔：尖的那頭在嘴裡，葉子在外面
    node: (
      <g>
        <path d="M54 48.4 Q57.6 42.4 60.6 44.6 Q59 47.6 56 48.4 Q60.8 48.6 61.2 52 Q57.4 53.4 54 48.4 Z" fill="var(--acc-leaf)" {...thin} />
        <path d="M34 48.6 L51 43.8 Q55.4 48.6 51 53.4 Z" fill="var(--acc-coral)" {...thin} />
        <path d="M42 46.6 L42.8 49 M46.6 45.4 L47.6 48.6 M44 51 L44.8 53" stroke={LINE} strokeWidth={WF} strokeLinecap="round" strokeOpacity="0.5" />
      </g>
    ),
  },
  pacifier: {
    kind: 'layer',
    motion: 'puff',
    box: '21 40 22 18',
    // 奶嘴：含在嘴上的圓片，下面掛一個拉環
    node: (
      <g>
        <circle cx="32" cy="53.2" r="2.9" fill="none" stroke={LINE} strokeWidth="3.4" />
        <circle cx="32" cy="53.2" r="2.9" fill="none" stroke="var(--acc-gold)" strokeWidth="1.6" />
        <ellipse cx="32" cy="48" rx="6" ry="3.7" fill="var(--acc-sky)" {...thin} />
        <circle cx="32" cy="48" r="1.9" fill="var(--acc-cream)" {...thin} strokeWidth={WF} />
      </g>
    ),
  },
  'grass-stalk': {
    kind: 'layer',
    motion: 'nibble',
    box: '30 32 30 22',
    // 叼一根牧草：草莖從嘴角往右上翹，中間兩片葉子，末端一串草穗
    node: (
      <g>
        <path d="M34 48.6 Q44 47 53 40.6" fill="none" stroke={LINE} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M34 48.6 Q44 47 53 40.6" fill="none" stroke="var(--acc-leaf)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M42.6 46.4 Q44.6 41.4 48.4 41.2 Q46.6 45.4 42.6 46.4 Z" fill="var(--acc-leaf)" {...thin} strokeWidth={WF} />
        <path d="M46.6 45.4 Q51.6 46.6 53.4 50 Q49 49.6 46.6 45.4 Z" fill="var(--acc-leaf)" {...thin} strokeWidth={WF} />
        <ellipse cx="55" cy="38.6" rx="2.2" ry="4" transform="rotate(48 55 38.6)" fill="var(--acc-straw)" {...thin} strokeWidth={WF} />
      </g>
    ),
  },
  'tiger-fang': {
    kind: 'layer',
    motion: 'twitch',
    box: '24 42 16 12',
    // 兩顆小虎牙：從嘴巴兩邊往下露出來
    node: (
      <g>
        <path d="M28.6 47.4 H31.2 L29.9 51.4 Z" fill="var(--acc-cream)" {...thin} strokeWidth={WF} />
        <path d="M32.8 47.4 H35.4 L34.1 51.4 Z" fill="var(--acc-cream)" {...thin} strokeWidth={WF} />
      </g>
    ),
  },
  popsicle: {
    kind: 'layer',
    motion: 'nibble',
    box: '30 36 30 20',
    // 咬著一根冰棒：冰的那頭在嘴裡，木棒往右伸出去
    node: (
      <g transform="rotate(-14 34 48.4)">
        <rect x="46.6" y="47.2" width="8.6" height="2.6" rx="1.3" fill="var(--acc-wood)" {...thin} strokeWidth={WF} />
        <rect x="33.4" y="44.6" width="14.6" height="7.6" rx="3.6" fill="var(--acc-sky)" {...thin} />
        <path d="M38.4 44.8 V52 M42.6 44.8 V52" stroke="var(--acc-cream)" strokeWidth="1.2" strokeOpacity="0.8" />
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
      sleeve: legCover('var(--acc-lav)', SLEEVE.len, 'var(--acc-cream)'),
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
  'dino-suit': onesieArt(KIGURUMI.dino),
  'bear-suit': onesieArt(KIGURUMI.bear),
  'frog-suit': onesieArt(KIGURUMI.frog),
  'bunny-suit': onesieArt(KIGURUMI.bunny),
  'pajama-suit': onesieArt(KIGURUMI.pajama),
  'cow-suit': onesieArt(KIGURUMI.cow),
  'tiger-suit': onesieArt(KIGURUMI.tiger),
  'penguin-suit': onesieArt(KIGURUMI.penguin),

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
  'fur-milktea': { kind: 'fur', className: 'cb-fur-milktea' },
  'fur-tabby': { kind: 'fur', className: 'cb-fur-tabby', marks: TABBY_MARKS },
  'fur-silver': { kind: 'fur', className: 'cb-fur-silver', marks: TABBY_MARKS },
  'fur-tuxedo': { kind: 'fur', className: 'cb-fur-tuxedo', marks: TUXEDO_MARKS },
  'fur-calico': { kind: 'fur', className: 'cb-fur-calico', marks: CALICO_MARKS },
  'fur-siamese': { kind: 'fur', className: 'cb-fur-siamese', marks: SIAMESE_MARKS },
};
