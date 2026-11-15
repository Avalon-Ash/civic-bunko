import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAppVersion, isNewerVersion, parseRemoteVersion } from './useAppVersion';

describe('useAppVersion pure helpers', () => {
  it('parses valid version.json payloads and rejects malformed ones', () => {
    assert.equal(parseRemoteVersion({ version: '2026-11-16T01:23:45.000Z' }), '2026-11-16T01:23:45.000Z');
    assert.equal(parseRemoteVersion({ version: '  2026-11-16T02:00:00.000Z  ' }), '2026-11-16T02:00:00.000Z');
    assert.equal(parseRemoteVersion({ version: '' }), null);
    assert.equal(parseRemoteVersion({ version: '   ' }), null);
    assert.equal(parseRemoteVersion({ version: 123 }), null);
    assert.equal(parseRemoteVersion(null), null);
    assert.equal(parseRemoteVersion([]), null);
    assert.equal(parseRemoteVersion('2026-11-16'), null);
  });

  it('detects newer version only when both versions exist and differ', () => {
    assert.equal(
      isNewerVersion('2026-11-16T01:00:00.000Z', '2026-11-16T01:00:00.000Z'),
      false,
    );
    assert.equal(
      isNewerVersion('2026-11-16T01:00:00.000Z', '2026-11-16T01:23:00.000Z'),
      true,
    );
    assert.equal(isNewerVersion('', '2026-11-16T01:23:00.000Z'), false);
    assert.equal(isNewerVersion('2026-11-16T01:00:00.000Z', null), false);
  });

  it('formats ISO version timestamp in local time and handles invalid input', () => {
    const d = new Date(2026, 10, 16, 1, 23, 0);
    const formatted = formatAppVersion(d.toISOString());
    assert.equal(formatted, '2026/11/16 01:23');

    assert.equal(formatAppVersion(''), '');
    assert.equal(formatAppVersion('not-a-date'), '');
  });
});
