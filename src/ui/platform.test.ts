import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStandaloneApp } from './platform';

describe('platform detection', () => {
  it('returns true when iOS navigator.standalone is true', () => {
    assert.equal(isStandaloneApp({ standalone: true }), true);
    assert.equal(
      isStandaloneApp({
        standalone: true,
        matchMedia: () => ({ matches: false }),
      }),
      true,
    );
  });

  it('returns true when display-mode standalone media query matches', () => {
    const queries: string[] = [];
    const result = isStandaloneApp({
      standalone: false,
      matchMedia: (q) => {
        queries.push(q);
        return { matches: q === '(display-mode: standalone)' };
      },
    });
    assert.equal(result, true);
    assert.deepEqual(queries, ['(display-mode: standalone)']);
  });

  it('returns false when running in regular browser tab or without browser globals', () => {
    assert.equal(
      isStandaloneApp({
        standalone: false,
        matchMedia: () => ({ matches: false }),
      }),
      false,
    );
    assert.equal(isStandaloneApp({}), false);
    assert.equal(isStandaloneApp(), false);
  });
});
