import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EnrichFile, TopicInfo } from '../core/types';
import { loadModulesSafely, resolveTopicLabel } from './sourceLoader';
import { testEnrichFile } from '../testing/fixture';

describe('sourceLoader', () => {
  it('returns empty array when no enrich files exist and ignores missing/rejected loaders', async () => {
    const empty = await loadModulesSafely<EnrichFile>([]);
    assert.deepEqual(empty, []);

    const partial = await loadModulesSafely<EnrichFile>([
      async () => testEnrichFile,
      async () => {
        throw new Error('404 Not Found');
      },
      async () => null,
    ]);
    assert.equal(partial.length, 1);
    assert.equal(partial[0]?.paperId, testEnrichFile.paperId);
  });

  it('resolves topic id to display name and falls back cleanly', () => {
    const topics: TopicInfo[] = [
      { id: 'admin-law/rules', subjectKey: 'admin-law', name: '法規命令與行政規則' },
    ];
    assert.equal(resolveTopicLabel(topics, 'admin-law/rules'), '法規命令與行政規則');
    assert.equal(resolveTopicLabel(topics, '測試考點 1'), '測試考點 1');
  });
});
