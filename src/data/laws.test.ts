import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LawFile, LawIndex } from '../core/types';
import { createLawArticleLoader, formatLawRef } from './lawLookup';

const sampleIndex: LawIndex = {
  laws: [
    {
      pcode: 'A0040003',
      name: '地方制度法',
      amendedAt: '民國 114 年 12 月 03 日',
      articleCount: 2,
    },
    {
      pcode: 'A0000001',
      name: '中華民國憲法',
      amendedAt: null,
      articleCount: 1,
    },
  ],
};

const sampleLaws: Record<string, LawFile> = {
  A0040003: {
    pcode: 'A0040003',
    name: '地方制度法',
    amendedAt: '民國 114 年 12 月 03 日',
    url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0040003',
    fetchedAt: '2026-11-15T00:00:00.000Z',
    articles: [
      { no: '7-1', text: '改制計畫條文內容。' },
      { no: '26', text: '自治條例經各該地方立法機關議決後，如規定有罰則時，應分別報經行政院、中央各該主管機關核定後發布。' },
    ],
  },
  A0000001: {
    pcode: 'A0000001',
    name: '中華民國憲法',
    amendedAt: null,
    url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0000001',
    fetchedAt: '2026-11-15T00:00:00.000Z',
    articles: [{ no: '1', text: '中華民國基於三民主義，為民有民治民享之民主共和國。' }],
  },
};

describe('lawLookup', () => {
  it('formats LawRef labels cleanly', () => {
    assert.equal(formatLawRef({ law: '地方制度法', article: '26' }), '地方制度法 第 26 條');
    assert.equal(formatLawRef({ law: '地方制度法', article: '第 7-1 條' }), '地方制度法 第 7-1 條');
  });

  it('loads law lazily on demand, caches by pcode, and resolves articles', async () => {
    let calls = 0;
    const loader = createLawArticleLoader(sampleIndex, async (pcode) => {
      calls += 1;
      return sampleLaws[pcode] ?? null;
    });

    const res1 = await loader.loadArticle({ law: '地方制度法', article: '26' });
    assert.equal(res1.status, 'found');
    assert.equal(res1.lawName, '地方制度法');
    assert.equal(res1.amendedAt, '民國 114 年 12 月 03 日');
    assert.equal(res1.articleNo, '26');
    assert.ok(res1.text?.includes('核定後發布'));
    assert.equal(calls, 1);

    // Second article in the same law reuses cached LawFile
    const res2 = await loader.loadArticle({ law: '地方制度法', article: '7-1' });
    assert.equal(res2.status, 'found');
    assert.equal(res2.text, '改制計畫條文內容。');
    assert.equal(calls, 1);

    // Null amendedAt is preserved cleanly
    const constRes = await loader.loadArticle({ law: '中華民國憲法', article: '1' });
    assert.equal(constRes.status, 'found');
    assert.equal(constRes.amendedAt, null);
    assert.equal(calls, 2);
  });

  it('returns not_found when law or article is missing or loader rejects', async () => {
    const loader = createLawArticleLoader(sampleIndex, async (pcode) => {
      if (pcode === 'A0000001') {
        throw new Error('network failed');
      }
      return sampleLaws[pcode] ?? null;
    });

    const missingLaw = await loader.loadArticle({ law: '不存在的法', article: '1' });
    assert.equal(missingLaw.status, 'not_found');
    assert.equal(missingLaw.text, null);

    const missingArticle = await loader.loadArticle({ law: '地方制度法', article: '999' });
    assert.equal(missingArticle.status, 'not_found');
    assert.equal(missingArticle.lawName, '地方制度法');
    assert.equal(missingArticle.amendedAt, '民國 114 年 12 月 03 日');

    const failedLoad = await loader.loadArticle({ law: '中華民國憲法', article: '1' });
    assert.equal(failedLoad.status, 'not_found');
    assert.equal(failedLoad.text, null);
  });
});
