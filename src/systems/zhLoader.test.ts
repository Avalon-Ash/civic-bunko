import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getVersion } from '../core/store';
import type { GroupZh, QuestionZh, ZhFile } from '../core/types';
import { createWorld } from '../core/world';
import { loadZh } from './zhLoader';

function makeGroupZh(id: string, en: string, zh: string): GroupZh {
  return {
    id,
    segments: [{ en, zh }],
    vocab: [{ en: 'word', zh: '單字' }],
  };
}

function makeQuestionZh(id: string, stem: string | null): QuestionZh {
  return {
    id,
    stem,
    options: {
      A: '甲',
      B: '乙',
      C: '丙',
      D: '丁',
    },
    vocab: [{ en: 'term', zh: '詞彙' }],
  };
}

describe('zhLoader', () => {
  it('loads items into world.zh and groups into world.groupZh, keeps first on duplicate IDs, and bumps store', () => {
    const world = createWorld();
    const initialVersion = getVersion(world);

    const files: ZhFile[] = [
      {
        paperId: '115-general-law-english',
        groups: [
          makeGroupZh('g-1', 'First sentence.', '第一句。'),
          makeGroupZh('g-1', 'Duplicate in same file.', '同檔重複應略過。'),
        ],
        items: [
          makeQuestionZh('q-1', '第一題題幹'),
          makeQuestionZh('q-1', '同檔重複題目應略過'),
          makeQuestionZh('q-2', null),
        ],
      },
      {
        paperId: '114-general-law-english',
        groups: [
          makeGroupZh('g-1', 'Duplicate across files.', '跨檔重複應略過。'),
          makeGroupZh('g-2', 'Second group.', '第二題組。'),
        ],
        items: [
          makeQuestionZh('q-1', '跨檔重複題目應略過'),
          makeQuestionZh('q-3', '第三題題幹'),
        ],
      },
    ];

    loadZh(world, files);

    assert.equal(world.groupZh.size, 2);
    assert.equal(world.groupZh.get('g-1')?.segments[0]?.zh, '第一句。');
    assert.equal(world.groupZh.get('g-2')?.segments[0]?.zh, '第二題組。');

    assert.equal(world.zh.size, 3);
    assert.equal(world.zh.get('q-1')?.stem, '第一題題幹');
    assert.equal(world.zh.get('q-2')?.stem, null);
    assert.equal(world.zh.get('q-3')?.stem, '第三題題幹');

    assert.equal(getVersion(world), initialVersion + 1);
  });
});
