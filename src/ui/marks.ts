import type { MarkColor } from '../core/types';

export interface StemSegment {
  text: string;
  color: MarkColor | null;
}

interface MatchedMark {
  start: number;
  end: number;
  color: MarkColor;
  order: number;
}

/**
 * 依 marks 把題幹中第一次出現的 text 切分為純文字與標記片段。
 * 找不到片段時略過；重疊時依出現位置先到先得（同起點依 marks 順序）。
 */
export function splitByMarks(
  stem: string,
  marks: ReadonlyArray<{ text: string; color: MarkColor }>,
): StemSegment[] {
  if (stem.length === 0) {
    return [];
  }

  const matched: MatchedMark[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    const m = marks[i];
    if (!m || m.text.length === 0) continue;
    const start = stem.indexOf(m.text);
    if (start === -1) continue;
    matched.push({
      start,
      end: start + m.text.length,
      color: m.color,
      order: i,
    });
  }

  if (matched.length === 0) {
    return [{ text: stem, color: null }];
  }

  matched.sort((a, b) => a.start - b.start || a.order - b.order);

  const segments: StemSegment[] = [];
  let cursor = 0;

  for (const m of matched) {
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      segments.push({ text: stem.slice(cursor, m.start), color: null });
    }
    segments.push({ text: stem.slice(m.start, m.end), color: m.color });
    cursor = m.end;
  }

  if (cursor < stem.length) {
    segments.push({ text: stem.slice(cursor), color: null });
  }

  return segments;
}
