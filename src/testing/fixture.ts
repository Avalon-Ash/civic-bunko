import type {
  Bank,
  Enrich,
  EnrichFile,
  OfficialQuestion,
  Paper,
  PaperFile,
  PassageGroup,
  RoundConfig,
  SourceFile,
} from '../core/types';
import { createWorld, type World } from '../core/world';
import { loadBank } from '../systems/bankLoader';

const dummySource: SourceFile = {
  url: 'https://example.invalid/test.pdf',
  file: 'test.pdf',
  sha256: '0000000000000000',
};

export const testBank: Bank = {
  id: 'test-bank',
  title: '測試題庫',
  examDate: '2026-12-05',
  subjects: [
    { key: 'subj-a', name: '測試科目甲', short: '甲科' },
    { key: 'subj-b', name: '測試科目乙', short: '乙科' },
  ],
};

export const otherBank: Bank = {
  id: 'other-bank',
  title: '其他測試題庫',
  examDate: '2026-12-10',
  subjects: [{ key: 'subj-x', name: '測試科目丙', short: '丙科' }],
};

export const testPaperA: Paper = {
  id: '115-general-subj-a',
  bankId: 'test-bank',
  year: 115,
  exam: 'general',
  subjectKey: 'subj-a',
  subjectName: '測試科目甲',
  examCode: 'TEST01',
  mcqCount: 4,
  sources: { q: dummySource, s: dummySource, m: null },
};

export const testPaperB: Paper = {
  id: '115-general-subj-b',
  bankId: 'test-bank',
  year: 115,
  exam: 'general',
  subjectKey: 'subj-b',
  subjectName: '測試科目乙',
  examCode: 'TEST02',
  mcqCount: 2,
  sources: { q: dummySource, s: dummySource, m: null },
};

export const otherPaper: Paper = {
  id: '115-local4-subj-x',
  bankId: 'other-bank',
  year: 115,
  exam: 'local4',
  subjectKey: 'subj-x',
  subjectName: '測試科目丙',
  examCode: 'TEST99',
  mcqCount: 1,
  sources: { q: dummySource, s: dummySource, m: null },
};

export const testGroup: PassageGroup = {
  id: '115-general-subj-a-g1',
  text: '測試題組共用短文內容。',
  fromNo: 1,
  toNo: 2,
};

function makeQuestion(
  id: string,
  paperId: string,
  no: number,
  overrides: Partial<OfficialQuestion> = {},
): OfficialQuestion {
  return {
    id,
    paperId,
    no,
    stem: `測試題 ${id}`,
    options: [`測試選項 A（${id}）`, `測試選項 B（${id}）`, `測試選項 C（${id}）`, `測試選項 D（${id}）`],
    answer: ['A'],
    correction: null,
    groupId: null,
    parseStatus: 'ok',
    ...overrides,
  };
}

export const testQuestionsA: OfficialQuestion[] = [
  makeQuestion('q-a1', testPaperA.id, 1, { groupId: testGroup.id, answer: ['A'] }),
  makeQuestion('q-a2', testPaperA.id, 2, {
    groupId: testGroup.id,
    answer: ['B', 'C'],
    correction: { original: ['B'], note: '測試更正 B 或 C 均給分', allCredit: false },
  }),
  makeQuestion('q-a3', testPaperA.id, 3, { answer: ['C'] }),
  makeQuestion('q-a4-bad', testPaperA.id, 4, { parseStatus: 'needs_review', reviewNote: '測試待確認' }),
];

export const testQuestionsB: OfficialQuestion[] = [
  makeQuestion('q-b1', testPaperB.id, 1, { answer: ['D'] }),
  makeQuestion('q-b2', testPaperB.id, 2, { answer: ['A'] }),
];

export const otherQuestions: OfficialQuestion[] = [
  makeQuestion('q-x1', otherPaper.id, 1, { answer: ['B'] }),
];

export const testEnrich: Enrich[] = [
  {
    id: 'q-a1',
    topic: ['測試考點 1'],
    mnemonic: '測試口訣 1',
    trap: '測試陷阱 1',
    plain: '測試白話 1',
    marks: [{ text: '測試題', color: 'blue' }],
    options: {
      A: { why: '測試解析 A', lawRef: { law: '地方制度法', article: '26' } },
      B: { why: '測試解析 B', lawRef: null },
      C: { why: '測試解析 C', lawRef: null },
      D: { why: '測試解析 D', lawRef: null },
    },
    visual: {
      kind: 'flow',
      lanes: [
        {
          steps: [
            { text: '有罰則', tone: 'hot' },
            { text: '核定', tone: 'key' },
            { text: '發布', tone: 'plain' },
          ],
        },
        {
          steps: [
            { text: '沒罰則', tone: 'plain' },
            { text: '發布', tone: 'plain' },
            { text: '備查', tone: 'plain' },
          ],
        },
      ],
    },
    lawChanged: null,
    confidence: 'high',
    reviewed: false,
  },
];

export const testEnrichFile: EnrichFile = {
  paperId: testPaperA.id,
  model: 'test-fixture',
  generatedAt: '2026-11-15T00:00:00.000Z',
  items: testEnrich,
};

/** 涵蓋 versus、修法提醒、低把握度、紅色標記與條號查詢的測試用假資料。 */
export const sampleRichEnrichFile: EnrichFile = {
  paperId: testPaperB.id,
  model: 'test-fixture',
  generatedAt: '2026-11-16T00:00:00.000Z',
  items: [
    {
      id: 'q-b1',
      topic: ['admin-law/disposition'],
      mnemonic: '違法叫撤銷，合法才廢止。',
      trap: '看到「合法處分」別選成撤銷。',
      plain: null,
      marks: [
        { text: 'q-b1', color: 'blue' },
        { text: '測試題', color: 'red' },
      ],
      options: {
        A: { why: '撤銷針對本來就違法的處分。', lawRef: { law: '行政程序法', article: '117' } },
        B: { why: '廢止針對本來合法的處分。', lawRef: { law: '行政程序法', article: '122' } },
        C: { why: '條號查無示範（故意不存在的條號）。', lawRef: { law: '地方制度法', article: '999' } },
        D: { why: '本選項為正解示範。', lawRef: null },
      },
      visual: {
        kind: 'versus',
        left: { title: '撤銷', points: ['處分本來違法', '知道後 2 年內'] },
        right: { title: '廢止', points: ['處分本來合法', '原因發生後 2 年內'] },
      },
      lawChanged: '現行地方制度法已修正副市長人數，作答本題請以現行條文為準。',
      confidence: 'low',
      reviewed: false,
    },
  ],
};

export const testPaperFiles: PaperFile[] = [
  {
    paper: testPaperA,
    groups: [testGroup],
    questions: testQuestionsA,
    essays: [],
  },
  {
    paper: testPaperB,
    groups: [],
    questions: testQuestionsB,
    essays: [],
  },
  {
    paper: otherPaper,
    groups: [],
    questions: otherQuestions,
    essays: [],
  },
];

export function createTestWorld(): World {
  const world = createWorld();
  loadBank(world, [testBank, otherBank], testPaperFiles, [testEnrichFile]);
  return world;
}

export function makeConfig(overrides: Partial<RoundConfig> = {}): RoundConfig {
  return {
    bankId: testBank.id,
    subjectKeys: [],
    count: 10,
    mode: 'mixed',
    fast: false,
    ...overrides,
  };
}

/** 建立可預測的線性同餘偽亂數產生器，確保測試洗牌結果可重現。 */
export function makeSeededRng(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
