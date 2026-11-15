import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  groupItemsIntoLines,
  parseAnswerPdf,
  parseCorrectionNotes,
  parseQuestionPdf,
} from './lib.mjs';

export { groupItemsIntoLines };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BANK_ID = 'local4-civil';

function extractPuaCodes(str) {
  const codes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0xe000 && cp <= 0xf8ff) {
      codes.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }
  return codes;
}

async function readPdfPages(absPath) {
  const data = new Uint8Array(readFileSync(absPath));
  const doc = await getDocument({ data, verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push({ pageNo: p, items: tc.items });
  }
  return pages;
}

async function runDump(manifest) {
  const dumpDir = resolve(root, 'tools/parser/.dump');
  mkdirSync(dumpDir, { recursive: true });

  const puaStats = new Map();

  for (const entry of manifest.files) {
    const absPdf = resolve(root, entry.file);
    const pages = await readPdfPages(absPdf);
    const outLines = [];
    outLines.push(
      `# ${entry.file} (examCode=${entry.examCode} year=${entry.year} exam=${entry.exam} subject=${entry.subjectKey} type=${entry.type})`,
    );

    for (const { pageNo, items } of pages) {
      outLines.push(`\n=== PAGE ${pageNo} ===`);
      const lines = groupItemsIntoLines(items);
      for (const line of lines) {
        const parts = [];
        let lineText = '';
        for (const it of line.items) {
          const pua = extractPuaCodes(it.str);
          const puaTag = pua.length ? ` PUA=[${pua.join(',')}]` : '';
          parts.push(
            `(x=${it.x.toFixed(1)},y=${it.y.toFixed(1)},f=${it.fontName}${puaTag}):${JSON.stringify(it.str)}`,
          );
          lineText += it.str;

          for (const code of pua) {
            if (!puaStats.has(code)) {
              puaStats.set(code, { count: 0, fonts: new Set(), samples: [] });
            }
            const stat = puaStats.get(code);
            stat.count += 1;
            stat.fonts.add(it.fontName);
            if (stat.samples.length < 8) {
              stat.samples.push(
                `${entry.examCode}-${basename(entry.file)} p${pageNo}: ${JSON.stringify(lineText)} | item=${JSON.stringify(it.str)}`,
              );
            }
          }
        }
        outLines.push(`[y=${line.y.toFixed(1)}] ${JSON.stringify(lineText)} || ${parts.join(' ')}`);
      }
    }

    const base = basename(entry.file, '.pdf');
    const dumpPath = resolve(dumpDir, `${entry.examCode}-${base}.txt`);
    writeFileSync(dumpPath, outLines.join('\n') + '\n', 'utf8');
  }

  const summaryLines = ['# PUA Summary'];
  for (const [code, stat] of [...puaStats.entries()].sort()) {
    summaryLines.push(`\n${code}: count=${stat.count} fonts=[${[...stat.fonts].join(', ')}]`);
    for (const s of stat.samples) {
      summaryLines.push(`  ${s}`);
    }
  }
  writeFileSync(resolve(dumpDir, '_pua-summary.txt'), summaryLines.join('\n') + '\n', 'utf8');
  console.log(`dumped=${manifest.files.length} pua_codes=${puaStats.size}`);
}

function toSourceFile(entry) {
  return {
    url: entry.url,
    file: entry.file,
    sha256: entry.sha256,
  };
}

/**
 * Group manifest entries by paper (`<year>-<exam>-<subjectKey>`).
 * @param {Array<any>} files
 */
function groupManifestIntoPapers(files) {
  const byPaper = new Map();
  for (const f of files) {
    const id = `${f.year}-${f.exam}-${f.subjectKey}`;
    if (!byPaper.has(id)) {
      byPaper.set(id, {
        id,
        year: f.year,
        exam: f.exam,
        subjectKey: f.subjectKey,
        subjectName: f.subjectName,
        examCode: f.examCode,
        q: null,
        s: null,
        m: null,
      });
    }
    const bundle = byPaper.get(id);
    if (f.type === 'Q') bundle.q = f;
    else if (f.type === 'S') bundle.s = f;
    else if (f.type === 'M') bundle.m = f;
  }
  return [...byPaper.values()].sort(
    (a, b) => b.year - a.year || a.exam.localeCompare(b.exam) || a.subjectKey.localeCompare(b.subjectKey),
  );
}

async function runParse(manifest) {
  const officialDir = resolve(root, 'data/official');
  mkdirSync(officialDir, { recursive: true });

  const bundles = groupManifestIntoPapers(manifest.files);
  const indexPapers = [];
  let totalQuestions = 0;
  let totalNeedsReview = 0;

  for (const b of bundles) {
    if (!b.q || !b.s) {
      throw new Error(`Paper ${b.id} missing Q or S PDF in manifest`);
    }

    const [qPages, sPages, mPages] = await Promise.all([
      readPdfPages(resolve(root, b.q.file)),
      readPdfPages(resolve(root, b.s.file)),
      b.m ? readPdfPages(resolve(root, b.m.file)) : Promise.resolve(null),
    ]);

    const sParsed = parseAnswerPdf(sPages);
    const mParsed = mPages ? parseAnswerPdf(mPages) : null;
    const correctionNotes = mParsed ? parseCorrectionNotes(mParsed.noteText) : new Map();

    const declaredMcqCount = sParsed.declaredMcqCount;
    if (!declaredMcqCount) {
      throw new Error(`Paper ${b.id} missing declared MCQ count in S PDF`);
    }

    const qParsed = parseQuestionPdf(qPages, declaredMcqCount);
    const groups = qParsed.groups.map((g, idx) => ({
      id: `${b.id}-g${idx + 1}`,
      text: g.text,
      fromNo: g.fromNo,
      toNo: g.toNo,
    }));

    let paperNeedsReview = 0;
    const questions = qParsed.questions.map((q) => {
      const sAns = sParsed.answers.get(q.no) ?? '';
      const mAns = mParsed ? mParsed.answers.get(q.no) ?? '' : '';
      const corr = correctionNotes.get(q.no) ?? null;

      /** @type {Array<'A' | 'B' | 'C' | 'D'>} */
      let answer = [];
      let correction = null;
      let parseStatus = q.parseStatus;
      const notes = q.reviewNote ? [q.reviewNote] : [];

      if (mParsed) {
        if (corr) {
          answer = corr.choices;
          correction = {
            original: /^[A-D]$/.test(sAns) ? [sAns] : [],
            note: corr.note,
            allCredit: corr.allCredit,
          };
        } else if (mAns === '#') {
          parseStatus = 'needs_review';
          notes.push('M answer # without parsed correction note');
        } else if (/^[A-D]$/.test(mAns)) {
          answer = [mAns];
          if (/^[A-D]$/.test(sAns) && sAns !== mAns) {
            correction = {
              original: [sAns],
              note: `原答案 ${sAns} 更正為 ${mAns}。`,
              allCredit: false,
            };
          }
        }
      } else if (/^[A-D]$/.test(sAns)) {
        answer = [sAns];
      }

      if (answer.length === 0) {
        parseStatus = 'needs_review';
        notes.push('missing_answer');
      }

      if (parseStatus === 'needs_review') {
        paperNeedsReview += 1;
      }

      const outQ = {
        id: `${b.id}-q${String(q.no).padStart(2, '0')}`,
        paperId: b.id,
        no: q.no,
        stem: q.stem,
        options: q.options,
        answer,
        correction,
        groupId: q.groupIndex !== null ? groups[q.groupIndex].id : null,
        parseStatus,
      };
      if (parseStatus === 'needs_review' && notes.length > 0) {
        outQ.reviewNote = notes.join('; ');
      }
      return outQ;
    });

    const paperFile = {
      paper: {
        id: b.id,
        bankId: BANK_ID,
        year: b.year,
        exam: b.exam,
        subjectKey: b.subjectKey,
        subjectName: b.subjectName,
        examCode: b.examCode,
        mcqCount: declaredMcqCount,
        sources: {
          q: toSourceFile(b.q),
          s: toSourceFile(b.s),
          m: b.m ? toSourceFile(b.m) : null,
        },
      },
      groups,
      questions,
      essays: qParsed.essays,
    };

    writeFileSync(
      resolve(officialDir, `${b.id}.json`),
      JSON.stringify(paperFile, null, 2) + '\n',
      'utf8',
    );

    indexPapers.push({
      id: b.id,
      bankId: BANK_ID,
      year: b.year,
      exam: b.exam,
      subjectKey: b.subjectKey,
      mcqCount: declaredMcqCount,
      essayCount: qParsed.essays.length,
      needsReview: paperNeedsReview,
    });

    totalQuestions += questions.length;
    totalNeedsReview += paperNeedsReview;
  }

  writeFileSync(
    resolve(officialDir, 'index.json'),
    JSON.stringify({ papers: indexPapers }, null, 2) + '\n',
    'utf8',
  );

  console.log(
    `parsed papers=${bundles.length} questions=${totalQuestions} needs_review=${totalNeedsReview}`,
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(resolve(root, 'data/raw/manifest.json'), 'utf8'));

  if (args.has('--dump')) {
    await runDump(manifest);
    return;
  }

  await runParse(manifest);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
