import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupItemsIntoLines,
  joinLineItems,
  joinWrappedLines,
  parseAnswerPdf,
  parseCorrectionNotes,
  parseQuestionPdf,
  splitMcqLines,
} from './lib.mjs';

function makeItem(str, x, y, width = 0) {
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
    fontName: 'g_f1',
    hasEOL: false,
  };
}

test('parseAnswerPdf matches answer tokens to question columns by coordinates', () => {
  const pages = [
    {
      items: [
        makeItem('單選題數：10題', 30, 648.8, 84),
        makeItem('題號', 36, 589.8, 24),
        makeItem('第1題', 74, 589.8, 30),
        makeItem('第2題', 124, 589.8, 30),
        makeItem('第3題', 174, 589.8, 30),
        makeItem('第10題', 521, 589.8, 36),
        makeItem('答案', 36, 570.8, 24),
        makeItem('D', 86, 570.8, 8),
        makeItem('A', 136, 570.8, 8),
        makeItem('#', 186, 570.8, 8),
        makeItem('B', 536, 570.8, 8),
        makeItem('題號', 36, 544.8, 24),
        makeItem('第11題', 71, 544.8, 36),
        makeItem('答案', 36, 525.8, 24),
        makeItem('備 註： 第3題答Ｂ或Ｃ者均給分。', 42.5, 141.0, 200),
      ],
    },
  ];

  const parsed = parseAnswerPdf(pages);
  assert.equal(parsed.declaredMcqCount, 10);
  assert.equal(parsed.answers.get(1), 'D');
  assert.equal(parsed.answers.get(2), 'A');
  assert.equal(parsed.answers.get(3), '#');
  assert.equal(parsed.answers.get(10), 'B');
  assert.equal(parsed.answers.get(11), undefined);
  assert.equal(parsed.noteText, '第3題答Ｂ或Ｃ者均給分。');
});

test('parseCorrectionNotes handles multi-choice credits, all-credit, and multiple clauses', () => {
  const single = parseCorrectionNotes('第32題答Ａ或Ｂ者均給分。');
  assert.deepEqual(single.get(32), {
    choices: ['A', 'B'],
    allCredit: false,
    note: '第32題答Ａ或Ｂ者均給分。',
  });

  const multi = parseCorrectionNotes(
    '第3題答Ａ或Ｂ或Ｄ者均給分，第26題答Ａ或Ｃ者均給分，第29題答Ｂ或Ｃ者均給分。',
  );
  assert.deepEqual(multi.get(3)?.choices, ['A', 'B', 'D']);
  assert.deepEqual(multi.get(26)?.choices, ['A', 'C']);
  assert.deepEqual(multi.get(29)?.choices, ['B', 'C']);

  const allCredit = parseCorrectionNotes('第10題一律給分。');
  assert.deepEqual(allCredit.get(10), {
    choices: ['A', 'B', 'C', 'D'],
    allCredit: true,
    note: '第10題一律給分。',
  });
});

test('splitMcqLines splits 4-on-1-line, 2x2, and multiline wrapped options cleanly', () => {
  const oneLine = splitMcqLines(
    ['8 中央主管機關之監督方式？', '\uE18C備查 \uE18D特許 \uE18E核定 \uE18F通報'],
    8,
  );
  assert.equal(oneLine.ok, true);
  assert.equal(oneLine.stem, '中央主管機關之監督方式？');
  assert.deepEqual(oneLine.options, ['備查', '特許', '核定', '通報']);

  const twoByTwo = splitMcqLines(
    [
      '10 下列何者非屬權限委任之要件？',
      '\uE18C須有法規依據 \uE18D原管轄機關須有權限',
      '委任之法律行為',
      '\uE18E須經受委任機關之同意 \uE18F須公告與刊登公報',
    ],
    10,
  );
  assert.equal(twoByTwo.ok, true);
  assert.deepEqual(twoByTwo.options, [
    '須有法規依據',
    '原管轄機關須有權限委任之法律行為',
    '須經受委任機關之同意',
    '須公告與刊登公報',
  ]);

  const english = splitMcqLines(
    ['41 \uE18C abandoned\uE18D evolved\uE18E inhabited\uE18Fdenied'],
    41,
  );
  assert.equal(english.ok, true);
  assert.equal(english.stem, '');
  assert.deepEqual(english.options, ['abandoned', 'evolved', 'inhabited', 'denied']);
});

test('joinLineItems detects wide fill-in-the-blank underline gaps and joinWrappedLines preserves spacing', () => {
  const line = [
    makeItem('31', 35.8, 644.6),
    makeItem(' ', 46.8, 644.6),
    makeItem('After a long flight, you can', 58.1, 644.6),
    makeItem(' ', 178.0, 644.6),
    makeItem('your legs.', 216.5, 644.6),
  ];
  const [groupedLine] = groupItemsIntoLines(line);
  const joined = joinLineItems(groupedLine.items, { detectBlanks: true });
  assert.equal(joined, '31 After a long flight, you can _____ your legs.');

  assert.equal(
    joinWrappedLines(['sleep-', 'deprived students', '在教室內學習', 'A 地與 B 地']),
    'sleep-deprived students 在教室內學習 A 地與 B 地',
  );
});

test('parseQuestionPdf strips page headers, extracts essays, passages, and links cloze stems', () => {
  const pages = [
    {
      items: [
        makeItem('代號：40220', 34, 789.5),
        makeItem('115年公務人員普通考試試題', 185, 782.4),
        makeItem('頁次：2－1', 34, 777.5),
        makeItem('類 科：一般民政', 34, 758.8),
        makeItem('科 目：測試科目', 34, 741.8),
        makeItem('考試時間： 1 小時', 34, 724.9),
        makeItem('※注意：\uE129禁止使用電子計算器。', 34, 704.0),
        makeItem('甲、申論題部分：（50 分）', 34, 678.8),
        makeItem('\uE129不必抄題。', 58, 665.2),
        makeItem('一、試述地方自治之意義。（25 分）', 34, 603.4),
        makeItem('乙、測驗題部分：（50 分）', 34, 495.6),
        makeItem('\uE129本試題為單一選擇題。', 58, 482.0),
        makeItem('1', 40.7, 441.8),
        makeItem(' ', 46.7, 441.8),
        makeItem('下列何者為自治事項？', 58.1, 441.8),
        makeItem('\uE18C甲事項 \uE18D乙事項 \uE18E丙事項 \uE18F丁事項', 58.1, 422.3),
        makeItem('請依下文回答第 2 題至第 3 題：', 34, 380),
        makeItem('Octopuses are ', 57.6, 360),
        makeItem('2', 140, 360),
        makeItem(' creatures.', 155, 360),
        makeItem('2', 40.7, 340),
        makeItem(' ', 46.7, 340),
        makeItem('\uE18Csmart \uE18Dbig \uE18Efast \uE18Fslow', 58.1, 340),
        makeItem('3', 40.7, 320),
        makeItem(' ', 46.7, 320),
        makeItem('Which title fits best?', 58.1, 320),
        makeItem('\uE18CA \uE18DB \uE18EC \uE18FD', 58.1, 300),
      ],
    },
  ];

  const grouped = groupItemsIntoLines(pages[0].items);
  assert.ok(grouped.length > 5);

  const parsed = parseQuestionPdf(pages, 3);
  assert.equal(parsed.essays.length, 1);
  assert.equal(parsed.essays[0].text, '試述地方自治之意義。（25 分）');
  assert.equal(parsed.groups.length, 1);
  assert.equal(parsed.groups[0].fromNo, 2);
  assert.equal(parsed.groups[0].toNo, 3);
  assert.equal(parsed.questions.length, 3);
  assert.equal(parsed.questions[0].groupIndex, null);
  assert.equal(parsed.questions[1].groupIndex, 0);
  assert.equal(parsed.questions[1].stem, '請依下文第 2 題空格作答');
  assert.equal(parsed.questions[2].groupIndex, 0);
  assert.equal(parsed.questions[2].stem, 'Which title fits best?');
  assert.ok(parsed.questions.every((q) => q.parseStatus === 'ok'));
});
