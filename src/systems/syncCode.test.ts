import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYNC_CODE_PREFIX } from '../core/constants/sync';
import { decodeSyncCode, encodeSyncCode } from './syncCode';

describe('syncCode', () => {
  it('round-trips credentials and strips surrounding whitespace and newlines', () => {
    const cred = {
      owner: 'family-owner',
      repo: 'civic-progress',
      token: 'github_pat_abc123_XYZ',
    };
    const code = encodeSyncCode(cred);
    assert.ok(code.startsWith(SYNC_CODE_PREFIX));

    assert.deepEqual(decodeSyncCode(code), cred);
    assert.deepEqual(decodeSyncCode(`  \r\n  ${code} \n\t `), cred);
  });

  it('handles non-ASCII characters cleanly using UTF-8', () => {
    const cred = {
      owner: '家庭帳號',
      repo: '公職題庫備份-🌸',
      token: 'tok_測試_123',
    };
    const code = encodeSyncCode(cred);
    assert.deepEqual(decodeSyncCode(code), cred);
  });

  it('returns null for wrong prefix, malformed payload, or missing fields', () => {
    assert.equal(decodeSyncCode(''), null);
    assert.equal(decodeSyncCode('   '), null);
    assert.equal(decodeSyncCode('wrong.abc'), null);
    assert.equal(decodeSyncCode(`${SYNC_CODE_PREFIX}`), null);
    assert.equal(decodeSyncCode(`${SYNC_CODE_PREFIX}not!valid!base64`), null);
    assert.equal(decodeSyncCode(`${SYNC_CODE_PREFIX}a`), null);

    // Valid base64url of non-JSON or missing fields
    const badJson = `${SYNC_CODE_PREFIX}bm90LWpzb24`;
    assert.equal(decodeSyncCode(badJson), null);

    const missingToken = `${SYNC_CODE_PREFIX}${Buffer.from(JSON.stringify({ o: 'a', r: 'b' })).toString('base64url')}`;
    assert.equal(decodeSyncCode(missingToken), null);

    const emptyRepo = `${SYNC_CODE_PREFIX}${Buffer.from(JSON.stringify({ o: 'a', r: '', t: 'tok' })).toString('base64url')}`;
    assert.equal(decodeSyncCode(emptyRepo), null);
  });

  it('returns null when owner or repo contains slash or whitespace', () => {
    const badCases = [
      { owner: 'a/b', repo: 'repo', token: 'tok' },
      { owner: 'owner', repo: 'a/b', token: 'tok' },
      { owner: 'own er', repo: 'repo', token: 'tok' },
      { owner: 'owner', repo: 're\tpo', token: 'tok' },
      { owner: 'owner', repo: 're\npo', token: 'tok' },
      { owner: '..', repo: 'repo', token: 'tok' },
    ];
    for (const cred of badCases) {
      const code = encodeSyncCode(cred);
      assert.equal(decodeSyncCode(code), null);
    }
  });
});
