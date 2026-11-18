// 測試用：算一段靜態 SVG 標記（renderToStaticMarkup 的輸出）裡所有圖形的外框。
// 只看幾何（不含線寬、不含 CSS 動畫），支援 g 的 transform、path 的全部指令、ellipse／circle／rect／line／polygon／polyline。
// 看圖頁（tools/gallery/cat-gallery.mts）在瀏覽器裡量同一件事；這裡讓 npm test 不靠瀏覽器也量得到。

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 仿射矩陣 [a, b, c, d, e, f]：x' = a·x + c·y + e、y' = b·x + d·y + f */
type Mat = readonly [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
/** 一段曲線取幾個點 */
const STEPS = 24;

function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function numbers(text: string): number[] {
  return (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
}

/** SVG 的 transform 屬性 → 矩陣 */
export function parseTransform(value: string | undefined): Mat {
  let m = IDENTITY;
  if (!value) return m;
  for (const [, name, args] of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const n = numbers(args ?? '');
    const at = (i: number, fallback = 0) => n[i] ?? fallback;
    if (name === 'translate') m = mul(m, [1, 0, 0, 1, at(0), at(1)]);
    else if (name === 'scale') m = mul(m, [at(0, 1), 0, 0, at(1, at(0, 1)), 0, 0]);
    else if (name === 'rotate') {
      const rad = (at(0) * Math.PI) / 180;
      const rot: Mat = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];
      m = mul(mul(mul(m, [1, 0, 0, 1, at(1), at(2)]), rot), [1, 0, 0, 1, -at(1), -at(2)]);
    } else if (name === 'matrix') m = mul(m, [at(0, 1), at(1), at(2), at(3, 1), at(4), at(5)]);
    else throw new Error(`svgBounds: 不認得的 transform「${name}」`);
  }
  return m;
}

type Pt = [number, number];

/** 橢圓弧（端點表示法）取樣；照 SVG 規格換成圓心表示法 */
function arcPoints(from: Pt, rx0: number, ry0: number, rotDeg: number, large: boolean, sweep: boolean, to: Pt): Pt[] {
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) return [to];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const start = angle((x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((-x1 - cx1) / rx, (-y1 - cy1) / ry) - start;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  const out: Pt[] = [];
  for (let i = 1; i <= STEPS; i += 1) {
    const t = start + (delta * i) / STEPS;
    out.push([cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos]);
  }
  return out;
}

/** path 的 d → 取樣點（曲線每段取 STEPS 個點） */
export function pathPoints(d: string): Pt[] {
  const out: Pt[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  /** 上一個控制點（S、T 用）；上一個指令不是同類曲線時是 null */
  let ctrl: { kind: 'C' | 'Q'; at: Pt } | null = null;
  const bezier = (pts: Pt[]) => {
    const from = cur;
    for (let i = 1; i <= STEPS; i += 1) {
      const t = i / STEPS;
      let layer: Pt[] = [from, ...pts];
      while (layer.length > 1) {
        layer = layer.slice(1).map((p, j): Pt => {
          const q = layer[j] as Pt;
          return [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t];
        });
      }
      out.push(layer[0] as Pt);
    }
    cur = pts[pts.length - 1] as Pt;
  };
  for (const [, cmd, body] of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
    const n = numbers(body ?? '');
    const upper = (cmd ?? '').toUpperCase();
    const rel = cmd !== upper;
    const abs = (x: number, y: number): Pt => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    const need = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }[upper] ?? 0;
    if (upper === 'Z') {
      cur = start;
      out.push(cur);
      ctrl = null;
      continue;
    }
    if (n.length === 0 || n.length % need !== 0) throw new Error(`svgBounds: path 指令 ${cmd} 的數字個數不對：${d}`);
    for (let i = 0; i < n.length; i += need) {
      const v = (j: number) => n[i + j] ?? 0;
      if (upper === 'M') {
        cur = abs(v(0), v(1));
        if (i === 0) start = cur;
        out.push(cur);
        ctrl = null;
      } else if (upper === 'L') {
        cur = abs(v(0), v(1));
        out.push(cur);
        ctrl = null;
      } else if (upper === 'H') {
        cur = [rel ? cur[0] + v(0) : v(0), cur[1]];
        out.push(cur);
        ctrl = null;
      } else if (upper === 'V') {
        cur = [cur[0], rel ? cur[1] + v(0) : v(0)];
        out.push(cur);
        ctrl = null;
      } else if (upper === 'C') {
        const c2 = abs(v(2), v(3));
        bezier([abs(v(0), v(1)), c2, abs(v(4), v(5))]);
        ctrl = { kind: 'C', at: c2 };
      } else if (upper === 'S') {
        const c1: Pt = ctrl?.kind === 'C' ? [2 * cur[0] - ctrl.at[0], 2 * cur[1] - ctrl.at[1]] : cur;
        const c2 = abs(v(0), v(1));
        bezier([c1, c2, abs(v(2), v(3))]);
        ctrl = { kind: 'C', at: c2 };
      } else if (upper === 'Q') {
        const c = abs(v(0), v(1));
        bezier([c, abs(v(2), v(3))]);
        ctrl = { kind: 'Q', at: c };
      } else if (upper === 'T') {
        const c: Pt = ctrl?.kind === 'Q' ? [2 * cur[0] - ctrl.at[0], 2 * cur[1] - ctrl.at[1]] : cur;
        bezier([c, abs(v(0), v(1))]);
        ctrl = { kind: 'Q', at: c };
      } else if (upper === 'A') {
        const to = abs(v(5), v(6));
        out.push(...arcPoints(cur, v(0), v(1), v(2), v(3) !== 0, v(4) !== 0, to));
        cur = to;
        ctrl = null;
      }
    }
  }
  return out;
}

function attrs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of text.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (name) out[name] = value ?? '';
  }
  return out;
}

function shapePoints(tag: string, a: Record<string, string>): Pt[] | null {
  const num = (name: string) => Number(a[name] ?? 0);
  if (tag === 'path') return pathPoints(a.d ?? '');
  if (tag === 'ellipse' || tag === 'circle') {
    const rx = tag === 'circle' ? num('r') : num('rx');
    const ry = tag === 'circle' ? num('r') : num('ry');
    return Array.from({ length: STEPS * 2 }, (_, i): Pt => {
      const t = (i / (STEPS * 2)) * 2 * Math.PI;
      return [num('cx') + rx * Math.cos(t), num('cy') + ry * Math.sin(t)];
    });
  }
  if (tag === 'rect') {
    const x = num('x');
    const y = num('y');
    return [
      [x, y],
      [x + num('width'), y],
      [x + num('width'), y + num('height')],
      [x, y + num('height')],
    ];
  }
  if (tag === 'line') {
    return [
      [num('x1'), num('y1')],
      [num('x2'), num('y2')],
    ];
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const n = numbers(a.points ?? '');
    return Array.from({ length: Math.floor(n.length / 2) }, (_, i): Pt => [n[i * 2] ?? 0, n[i * 2 + 1] ?? 0]);
  }
  return null;
}

export interface SvgBoundsOptions {
  /** 只量這個 class 的元素底下的圖形（它外層的 transform 照算）；不給就量整段 */
  within?: string;
  /** 這些 class 的元素連同底下的圖形不算（例如被剪裁框裁掉的布面） */
  skipClasses?: readonly string[];
}

/** 被剪裁或不畫出來的容器：裡面的圖形不算 */
const SKIP_TAGS: ReadonlySet<string> = new Set(['clipPath', 'defs', 'mask', 'symbol', 'pattern']);
/** 不占位置、可以不理的標籤 */
const IGNORED_TAGS: ReadonlySet<string> = new Set(['svg', 'g', 'text', 'tspan', 'title', 'desc']);

/**
 * 量一段 SVG 標記裡所有圖形的外框（最外層 svg 的使用者座標）。沒有任何圖形時回 null。
 * 碰到不認得的圖形標籤會丟錯，免得漏量還以為通過。
 */
export function svgBounds(markup: string, options: SvgBoundsOptions = {}): Bounds | null {
  const stack: Array<{ mat: Mat; skip: boolean; inside: boolean }> = [
    { mat: IDENTITY, skip: false, inside: options.within === undefined },
  ];
  let bounds: Bounds | null = null;
  for (const [, closing, tag, rest, selfClosing] of markup.matchAll(/<(\/)?([a-zA-Z][\w:-]*)((?:[^>"]|"[^"]*")*?)(\/)?>/g)) {
    if (!tag) continue;
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1] as { mat: Mat; skip: boolean; inside: boolean };
    const a = attrs(rest ?? '');
    const classes = (a.class ?? '').split(/\s+/);
    const frame = {
      mat: mul(top.mat, parseTransform(a.transform)),
      skip: top.skip || SKIP_TAGS.has(tag) || classes.some((c) => options.skipClasses?.includes(c)),
      inside: top.inside || (options.within !== undefined && classes.includes(options.within)),
    };
    if (!frame.skip && frame.inside) {
      const pts = shapePoints(tag, a);
      if (pts === null && !IGNORED_TAGS.has(tag) && !SKIP_TAGS.has(tag)) {
        throw new Error(`svgBounds: 不認得的圖形標籤 <${tag}>`);
      }
      for (const [x, y] of pts ?? []) {
        const px = frame.mat[0] * x + frame.mat[2] * y + frame.mat[4];
        const py = frame.mat[1] * x + frame.mat[3] * y + frame.mat[5];
        bounds = bounds
          ? {
              minX: Math.min(bounds.minX, px),
              minY: Math.min(bounds.minY, py),
              maxX: Math.max(bounds.maxX, px),
              maxY: Math.max(bounds.maxY, py),
            }
          : { minX: px, minY: py, maxX: px, maxY: py };
      }
    }
    if (!selfClosing) stack.push(frame);
  }
  return bounds;
}
