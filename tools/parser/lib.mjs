/**
 * Pure helper functions for parsing MOEX exam PDF text items into structured
 * official question papers, answer tables, correction notes, and passages.
 * @module tools/parser/lib
 */

/** @typedef {'A' | 'B' | 'C' | 'D'} Choice */

export const PUA_RE = /[\uE000-\uF8FF]/g;
export const BAD_CHARS_RE = /[\uE000-\uF8FF\uFFFD]/;

/** Mapping of MOEX PUA codepoints to Unicode characters or structural markers. */
export const PUA_OPTION_MAP = new Map([
  ['\uE18C', 'A'],
  ['\uE18D', 'B'],
  ['\uE18E', 'C'],
  ['\uE18F', 'D'],
]);

export const PUA_BULLET_MAP = new Map([
  ['\uE129', '①'],
  ['\uE12A', '②'],
  ['\uE12B', '③'],
]);

const OPTION_MARKER_RE = /[\uE18C-\uE18F]/;
const OPTION_MARKER_SPLIT_RE = /([\uE18C-\uE18F])/;

/**
 * Group pdfjs textContent items on a single page into horizontal visual lines.
 * Lines are sorted top-to-bottom (y descending); items within a line are sorted left-to-right (x ascending).
 *
 * @param {Array<{ str?: string, transform: number[], width?: number, fontName?: string, hasEOL?: boolean }>} items
 * @param {number} [yTolerance=2.5]
 * @returns {Array<{ y: number, items: Array<{ str: string, x: number, y: number, w: number, fontName: string, hasEOL: boolean }> }>}
 */
export function groupItemsIntoLines(items, yTolerance = 2.5) {
  const valid = items
    .filter((it) => typeof it.str === 'string')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width ?? 0,
      fontName: it.fontName ?? '',
      hasEOL: Boolean(it.hasEOL),
    }));

  valid.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const lines = [];
  for (const item of valid) {
    let target = null;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (Math.abs(lines[i].y - item.y) <= yTolerance) {
        target = lines[i];
        break;
      }
      if (lines[i].y - item.y > yTolerance * 2) break;
    }
    if (!target) {
      target = { y: item.y, items: [] };
      lines.push(target);
    }
    target.items.push(item);
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.y = line.items.reduce((acc, it) => acc + it.y, 0) / line.items.length;
  }
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

/**
 * Replace known MOEX bullet PUA codepoints (\uE129..\uE12B -> ①..③) and strip full-width spaces if requested.
 * Option markers (\uE18C..\uE18F) are preserved unless replaceOptionMarkers is true.
 *
 * @param {string} text
 * @param {boolean} [replaceOptionMarkers=false]
 * @returns {string}
 */
export function normalizeKnownPua(text, replaceOptionMarkers = false) {
  let out = '';
  for (const ch of text) {
    if (PUA_BULLET_MAP.has(ch)) {
      out += PUA_BULLET_MAP.get(ch);
    } else if (replaceOptionMarkers && PUA_OPTION_MAP.has(ch)) {
      out += `(${PUA_OPTION_MAP.get(ch)})`;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Join pdfjs items on a single line into text.
 * Optionally detects wide horizontal gaps drawn over fill-in-the-blank underlines (e.g. English Q31-40)
 * and renders them as ` _____ `.
 *
 * @param {Array<{ str: string, x: number, w?: number }>} items
 * @param {{ detectBlanks?: boolean, replaceOptionMarkers?: boolean }} [opts]
 * @returns {string}
 */
export function joinLineItems(items, opts = {}) {
  const { detectBlanks = false, replaceOptionMarkers = false } = opts;
  const nonEmpty = items.filter((it) => it.str !== '');
  let out = '';
  for (let i = 0; i < nonEmpty.length; i += 1) {
    const cur = nonEmpty[i];
    if (
      detectBlanks &&
      cur.str.trim() === '' &&
      i > 0 &&
      i < nonEmpty.length - 1
    ) {
      const prev = nonEmpty[i - 1];
      const next = nonEmpty[i + 1];
      const gap = next.x - cur.x;
      const isLeadingQuestionNum = prev.x < 55 && /^\d{1,3}$/.test(prev.str.trim());
      const touchesMarker =
        OPTION_MARKER_RE.test(prev.str) ||
        OPTION_MARKER_RE.test(next.str) ||
        PUA_BULLET_MAP.has(prev.str);
      if (!isLeadingQuestionNum && !touchesMarker && gap >= 26) {
        out += ' _____ ';
        continue;
      }
    }
    out += cur.str;
  }
  return normalizeKnownPua(out, replaceOptionMarkers);
}

/**
 * Join multiple wrapped visual lines cleanly, avoiding extra spaces inside CJK text
 * while preserving spaces between English words / alphanumeric tokens and fixing hyphenated English wraps.
 *
 * @param {string[]} rawLines
 * @returns {string}
 */
export function joinWrappedLines(rawLines) {
  let acc = '';
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (!acc) {
      acc = line;
      continue;
    }
    if (acc.endsWith('-') && /^[A-Za-z]/.test(line)) {
      acc += line;
    } else if (
      (/[A-Za-z0-9.,;:?!%'"’”\])]$/.test(acc) && /^[A-Za-z0-9("'‘“\[]/.test(line)) ||
      (/[A-Za-z0-9]$/.test(acc) && /^[\u4E00-\u9FFF]/.test(line)) ||
      (/[\u4E00-\u9FFF]$/.test(acc) && /^[A-Za-z0-9]/.test(line))
    ) {
      acc += ` ${line}`;
    } else {
      acc += line;
    }
  }
  return acc.replace(/ {2,}/g, ' ').trim();
}

/**
 * Parse a MOEX standard answer (`-S.pdf`) or corrected answer (`-M.pdf`) page list.
 * Matches every answer cell to its question number column by (x, y) coordinates.
 *
 * @param {Array<{ items: Array<{ str?: string, transform: number[], width?: number, fontName?: string, hasEOL?: boolean }> }>} pages
 * @returns {{ declaredMcqCount: number, answers: Map<number, string>, noteText: string }}
 */
export function parseAnswerPdf(pages) {
  const allLines = [];
  for (const page of pages) {
    allLines.push(...groupItemsIntoLines(page.items));
  }

  let declaredMcqCount = 0;
  let noteStartIdx = -1;

  for (let i = 0; i < allLines.length; i += 1) {
    const txt = joinLineItems(allLines[i].items).trim();
    const countMatch = txt.match(/單選題數\s*[:：]\s*(\d+)\s*題/);
    if (countMatch) {
      declaredMcqCount = Number.parseInt(countMatch[1], 10);
    }
    if (noteStartIdx === -1 && /^備\s*註\s*[:：]/.test(txt)) {
      noteStartIdx = i;
    }
  }

  let noteText = '';
  if (noteStartIdx !== -1) {
    const noteLines = [];
    for (let i = noteStartIdx; i < allLines.length; i += 1) {
      const t = joinLineItems(allLines[i].items).trim();
      if (t) noteLines.push(t);
    }
    noteText = joinWrappedLines(noteLines)
      .replace(/^備\s*註\s*[:：]\s*/, '')
      .trim();
  }

  // Extract question-number header rows and pair each answer row directly below it.
  const answers = new Map();
  /** @type {{ y: number, cols: Array<{ no: number, centerX: number }> } | null} */
  let currentHeader = null;

  for (const line of allLines) {
    const cols = [];
    for (const it of line.items) {
      const m = it.str.trim().match(/^第\s*(\d+)\s*題$/);
      if (m) {
        const w = it.w > 0 ? it.w : 32;
        cols.push({ no: Number.parseInt(m[1], 10), centerX: it.x + w / 2 });
      }
    }
    if (cols.length > 0) {
      currentHeader = { y: line.y, cols };
      continue;
    }

    if (!currentHeader) continue;
    const dy = currentHeader.y - line.y;
    if (dy < 8 || dy > 35) continue;

    const lineText = joinLineItems(line.items).trim();
    if (!lineText.startsWith('答案')) continue;

    for (const it of line.items) {
      const token = normalizeAnswerToken(it.str.trim());
      if (!token || token === '答案') continue;
      if (!/^[A-D#]$/.test(token)) continue;
      const ansCenterX = it.x + (it.w > 0 ? it.w : 6) / 2;
      let bestCol = null;
      let bestDist = Infinity;
      for (const col of currentHeader.cols) {
        const dist = Math.abs(ansCenterX - col.centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = col;
        }
      }
      if (bestCol && bestDist <= 28) {
        answers.set(bestCol.no, token);
      }
    }
  }

  return { declaredMcqCount, answers, noteText };
}

/**
 * Normalize full-width letters/digits in answer tokens and notes.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeFullWidthAlnum(str) {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９＃]/g, (ch) => {
    if (ch === '＃') return '#';
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  });
}

function normalizeAnswerToken(str) {
  return normalizeFullWidthAlnum(str).toUpperCase();
}

/**
 * Parse correction notes from a `-M.pdf` file's `備 註：` section.
 * Supports multi-choice credit (e.g. `第32題答Ａ或Ｂ者均給分`) and `第10題一律給分`.
 *
 * @param {string} noteText
 * @returns {Map<number, { choices: Choice[], allCredit: boolean, note: string }>}
 */
export function parseCorrectionNotes(noteText) {
  const result = new Map();
  if (!noteText || !noteText.trim()) return result;

  const clauseRe = /第\s*([0-9０-９]+)\s*題([^第]*)/g;
  for (const match of noteText.matchAll(clauseRe)) {
    const no = Number.parseInt(normalizeFullWidthAlnum(match[1]), 10);
    const rawClause = match[2].trim();
    const cleanedNote = `第${no}題${rawClause.replace(/[，、；;]+$/, '')}`.replace(/。$/, '') + '。';
    const normalizedClause = normalizeFullWidthAlnum(rawClause).toUpperCase();

    if (/一律給分/.test(normalizedClause)) {
      result.set(no, {
        choices: ['A', 'B', 'C', 'D'],
        allCredit: true,
        note: cleanedNote,
      });
      continue;
    }

    const choices = [];
    for (const chMatch of normalizedClause.matchAll(/[A-D]/g)) {
      const c = /** @type {Choice} */ (chMatch[0]);
      if (!choices.includes(c)) choices.push(c);
    }
    if (choices.length > 0) {
      result.set(no, {
        choices,
        allCredit: false,
        note: cleanedNote,
      });
    }
  }

  return result;
}

/**
 * Split accumulated MCQ text (after the leading question number) into stem and 4 options [A, B, C, D]
 * using the MOEX option marker PUA codepoints (\uE18C..\uE18F).
 *
 * @param {string[]} lines - raw lines belonging to one MCQ (still containing \uE18C..\uE18F)
 * @param {number} questionNo
 * @returns {{ stem: string, options: string[], ok: boolean, reason?: string }}
 */
export function splitMcqLines(lines, questionNo) {
  const stemLines = [];
  /** @type {Record<Choice, string[]>} */
  const optLines = { A: [], B: [], C: [], D: [] };
  /** @type {Choice | null} */
  let currentOpt = null;
  let seenMarkers = 0;

  for (let idx = 0; idx < lines.length; idx += 1) {
    let line = lines[idx];
    if (idx === 0) {
      line = line.replace(new RegExp(`^\\s*${questionNo}(?:\\s+|$)`), '');
    }

    if (!OPTION_MARKER_RE.test(line)) {
      if (currentOpt === null) {
        stemLines.push(line);
      } else {
        optLines[currentOpt].push(line);
      }
      continue;
    }

    const parts = line.split(OPTION_MARKER_SPLIT_RE);
    // parts[0] precedes the first marker on this line
    if (parts[0].trim()) {
      if (currentOpt === null) {
        stemLines.push(parts[0]);
      } else {
        optLines[currentOpt].push(parts[0]);
      }
    }
    for (let p = 1; p < parts.length; p += 2) {
      const marker = parts[p];
      const segment = parts[p + 1] ?? '';
      const choice = PUA_OPTION_MAP.get(marker);
      if (choice) {
        currentOpt = /** @type {Choice} */ (choice);
        seenMarkers += 1;
        optLines[currentOpt].push(segment);
      }
    }
  }

  const stem = joinWrappedLines(stemLines);
  const options = ['A', 'B', 'C', 'D'].map((c) => joinWrappedLines(optLines[/** @type {Choice} */ (c)]));
  if (seenMarkers !== 4 || options.some((opt) => !opt)) {
    return {
      stem,
      options,
      ok: false,
      reason: `option_markers=${seenMarkers} empty_opts=${options.filter((o) => !o).length}`,
    };
  }
  return { stem, options, ok: true };
}

/**
 * Determine whether a line at the top of a PDF page is a running exam header/metadata line.
 *
 * @param {string} text
 * @param {number} pageIdx
 * @param {number} lineY
 * @returns {boolean}
 */
export function isRunningHeaderLine(text, pageIdx, lineY) {
  const t = text.trim();
  if (!t) return true;
  if (/^代\s*號\s*[:：]/.test(t)) return true;
  if (/^頁\s*次\s*[:：]/.test(t) || /頁次\s*[:：]\s*\d+－\d+/.test(t)) return true;
  if (lineY >= 760 && /^\d{4,6}(?:-\d{4,6})?$/.test(t)) return true;
  if (/^(?:1\s*1\s*[0-9]|[0-9]{3})\s*年.*試\s*題$/.test(t)) return true;
  if (/^離\s*島\s*地\s*區\s*公\s*務\s*人\s*員\s*考\s*試\s*試\s*題$/.test(t)) return true;
  if (pageIdx === 0) {
    if (/^(?:考\s*試\s*別|等\s*別|類\s*科|科\s*目|考\s*試\s*時\s*間)\s*[:：]/.test(t)) return true;
    if (/^※\s*注\s*意\s*[:：]/.test(t)) return true;
  }
  return false;
}

/**
 * Clean all pages of a `-Q.pdf` into tagged body lines (stripping page headers, metadata,
 * overlapping `甲、申論部分` watermarks, and notice bullets).
 *
 * @param {Array<{ items: Array<any> }>} pages
 * @returns {Array<{ text: string, y: number, firstItemX: number, items: Array<any> }>}
 */
export function extractCleanQuestionLines(pages) {
  const rawLines = [];
  for (let p = 0; p < pages.length; p += 1) {
    const pageLines = groupItemsIntoLines(pages[p].items);
    let inMetaHeader = p === 0;
    let inNotice = false;
    let noticeIncomplete = false;

    for (const line of pageLines) {
      const text = joinLineItems(line.items, { detectBlanks: true }).trim();
      if (!text) continue;

      if (inMetaHeader) {
        if (/^甲、(?:作文|申論題?)部分/.test(text) || /^乙、測驗(?:題)?部分/.test(text)) {
          inMetaHeader = false;
          inNotice = false;
        } else if (
          p === 0 &&
          line.items[0] &&
          line.items[0].x < 55 &&
          /^1(?:\s|$)/.test(text) &&
          // 試卷標題「1 1 4 年 特 種 考 試…」也在左邊界且以 1 開頭，不是第 1 題。
          !/^(?:\d\s*){2,3}年/.test(text)
        ) {
          inMetaHeader = false;
          inNotice = false;
        } else if (/^請依下文回答第/.test(text)) {
          inMetaHeader = false;
          inNotice = false;
        } else if (isRunningHeaderLine(text, p, line.y)) {
          if (/^※\s*注\s*意\s*[:：]/.test(text)) {
            inNotice = true;
            noticeIncomplete = !text.endsWith('。');
          }
          continue;
        } else if (inNotice && (/^[①②③]/.test(text) || noticeIncomplete)) {
          noticeIncomplete = !text.endsWith('。');
          continue;
        } else {
          // Wrapped `類科：` continuation line on page 1 before `科目：` / `※注意：` / body
          continue;
        }
      } else if (isRunningHeaderLine(text, p, line.y)) {
        continue;
      }

      const firstNonEmpty = line.items.find((it) => it.str.trim() !== '');
      rawLines.push({
        text,
        y: line.y,
        firstItemX: firstNonEmpty ? firstNonEmpty.x : 999,
        items: line.items,
      });
    }
  }

  // Filter overlapping `甲、申論部分：（60 分）` artifact when `甲、作文部分` immediately follows.
  return rawLines.filter((line, idx) => {
    if (/^甲、申論部分[：:]/.test(line.text)) {
      const next = rawLines[idx + 1];
      if (next && /^甲、作文部分[：:]/.test(next.text)) {
        return false;
      }
    }
    return true;
  });
}

function isSectionInstructionLine(text) {
  return (
    /^[①②③]/.test(text) &&
    /(?:單一選擇題|2B\s*鉛筆|不予計分|不必抄題|鋼筆或原子筆|本國文字|姓名或座號|申論試卷|分配各題作答)/.test(
      text,
    )
  );
}

/**
 * Parse essay prompts (`甲、...`) when present in mixed papers (`chinese`, `local-gov`).
 *
 * @param {Array<{ text: string }>} lines
 * @returns {Array<{ no: number, text: string }>}
 */
export function parseEssaysSection(lines) {
  if (lines.length === 0) return [];
  const body = [];
  let passedHeader = false;
  let instrIncomplete = false;
  for (const line of lines) {
    if (!passedHeader && /^甲、(?:作文|申論題?)部分/.test(line.text)) {
      passedHeader = true;
      continue;
    }
    if (passedHeader && (instrIncomplete || isSectionInstructionLine(line.text))) {
      instrIncomplete = !line.text.endsWith('。');
      continue;
    }
    passedHeader = true;
    body.push(line.text);
  }
  if (body.length === 0) return [];

  // Split by Chinese numerals (`一、`, `二、`) if present (e.g. local-gov).
  const numeralChunks = [];
  let current = null;
  for (const t of body) {
    if (/^[一二三四五]、/.test(t)) {
      if (current) numeralChunks.push(current);
      current = [t.replace(/^[一二三四五]、\s*/, '')];
    } else if (current) {
      current.push(t);
    }
  }
  if (current) numeralChunks.push(current);

  if (numeralChunks.length > 0) {
    return numeralChunks.map((chunk, idx) => ({
      no: idx + 1,
      text: joinWrappedLines(chunk),
    }));
  }

  // Otherwise keep the essay prompt/passage together as essay #1 (e.g. chinese).
  return [{ no: 1, text: joinWrappedLines(body) }];
}

/**
 * Parse MCQ section and passage groups (`請依下文回答第 X 題至第 Y 題`).
 *
 * @param {Array<{ text: string, firstItemX: number }>} lines
 * @param {number} declaredMcqCount
 * @returns {{
 *   groups: Array<{ id: string, text: string, fromNo: number, toNo: number }>,
 *   questions: Array<{ no: number, stem: string, options: string[], groupIndex: number | null, parseStatus: 'ok' | 'needs_review', reviewNote?: string }>
 * }}
 */
export function parseMcqSection(lines, declaredMcqCount) {
  // Skip `乙、...` header and its bullet instructions before Q1 / first passage.
  let startIdx = 0;
  let instrIncomplete = false;
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].text;
    if (/^乙、測驗(?:題)?部分/.test(t)) {
      startIdx = i + 1;
      continue;
    }
    if (i === startIdx && (instrIncomplete || isSectionInstructionLine(t))) {
      instrIncomplete = !t.endsWith('。');
      startIdx = i + 1;
      continue;
    }
    break;
  }
  const body = lines.slice(startIdx);

  /** @type {Array<{ fromNo: number, toNo: number, lines: string[] }>} */
  const groups = [];
  /** @type {Map<number, { no: number, lines: string[], groupIndex: number | null }>} */
  const rawQuestions = new Map();

  let expectedNo = 1;
  let activeGroupIndex = -1;
  let collectingPassage = false;
  let currentQuestionNo = null;

  for (const line of body) {
    const t = line.text;
    const passageMatch = t.match(/^請依下文回答第\s*(\d+)\s*題至第\s*(\d+)\s*題/);
    if (passageMatch) {
      const fromNo = Number.parseInt(passageMatch[1], 10);
      const toNo = Number.parseInt(passageMatch[2], 10);
      groups.push({ fromNo, toNo, lines: [] });
      activeGroupIndex = groups.length - 1;
      collectingPassage = true;
      currentQuestionNo = null;
      continue;
    }

    // Sequential question boundary check: starts with expectedNo at left margin (x < 56).
    const qNumMatch = t.match(/^(\d{1,3})(?:\s+|$)/);
    if (qNumMatch && line.firstItemX < 56) {
      const num = Number.parseInt(qNumMatch[1], 10);
      if (num === expectedNo && num <= declaredMcqCount) {
        collectingPassage = false;
        currentQuestionNo = num;
        expectedNo += 1;
        const activeGroup = activeGroupIndex >= 0 ? groups[activeGroupIndex] : null;
        const belongsToGroup =
          activeGroup && num >= activeGroup.fromNo && num <= activeGroup.toNo
            ? activeGroupIndex
            : null;
        rawQuestions.set(num, { no: num, lines: [t], groupIndex: belongsToGroup });
        continue;
      }
    }

    if (collectingPassage && activeGroupIndex >= 0) {
      groups[activeGroupIndex].lines.push(t);
    } else if (currentQuestionNo !== null) {
      rawQuestions.get(currentQuestionNo).lines.push(t);
    }
  }

  const finalGroups = groups.map((g, idx) => ({
    id: `g${idx + 1}`,
    text: joinWrappedLines(g.lines),
    fromNo: g.fromNo,
    toNo: g.toNo,
  }));

  const questions = [];
  for (let no = 1; no <= declaredMcqCount; no += 1) {
    const raw = rawQuestions.get(no);
    if (!raw) {
      questions.push({
        no,
        stem: '',
        options: ['', '', '', ''],
        groupIndex: null,
        parseStatus: 'needs_review',
        reviewNote: `Question ${no} missing from Q PDF`,
      });
      continue;
    }
    const split = splitMcqLines(raw.lines, no);
    let stem = split.stem;
    // Cloze questions (inside a PassageGroup) often have no inline stem text in the PDF.
    if (!stem && raw.groupIndex !== null) {
      stem = `請依下文第 ${no} 題空格作答`;
    }
    const hasBadChars =
      BAD_CHARS_RE.test(stem) || split.options.some((o) => BAD_CHARS_RE.test(o));
    const stemValid = stem.trim().length >= 4 && !/^\d+$/.test(stem.trim());

    if (!split.ok || hasBadChars || !stemValid) {
      questions.push({
        no,
        stem,
        options: split.options,
        groupIndex: raw.groupIndex,
        parseStatus: 'needs_review',
        reviewNote: [
          split.reason,
          hasBadChars ? 'bad_chars' : '',
          !stemValid ? 'short_or_digit_stem' : '',
        ]
          .filter(Boolean)
          .join('; '),
      });
    } else {
      questions.push({
        no,
        stem,
        options: split.options,
        groupIndex: raw.groupIndex,
        parseStatus: 'ok',
      });
    }
  }

  return { groups: finalGroups, questions };
}

/**
 * Parse a complete `-Q.pdf` into essays, passage groups, and MCQs.
 *
 * @param {Array<{ items: Array<any> }>} pages
 * @param {number} declaredMcqCount
 */
export function parseQuestionPdf(pages, declaredMcqCount) {
  const cleanLines = extractCleanQuestionLines(pages);
  const mcIdx = cleanLines.findIndex((l) => /^乙、測驗(?:題)?部分/.test(l.text));

  const essayLines = mcIdx >= 0 ? cleanLines.slice(0, mcIdx) : [];
  const mcqLines = mcIdx >= 0 ? cleanLines.slice(mcIdx) : cleanLines;

  const essays = parseEssaysSection(essayLines);
  const { groups, questions } = parseMcqSection(mcqLines, declaredMcqCount);

  return { essays, groups, questions };
}
