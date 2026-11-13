// The one digest function (Story 2.5; AD-9, AD-13): sha256 over canonical
// JSON, the same for the same value however its keys were ordered.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type Canonical, canonicalJson, digest } from '../../src/engine/digest.ts';

describe('canonicalJson', () => {
  it('sorts keys at every level and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [true, null], c: 'x' } })).toBe('{"a":{"c":"x","d":[true,null]},"b":1}');
  });

  it('writes a bigint as its decimal string, beyond 2^53 exactly', () => {
    expect(canonicalJson({ ore: 9_007_199_254_740_993n, neg: -5n })).toBe('{"neg":"-5","ore":"9007199254740993"}');
  });

  it('keeps array order', () => {
    expect(canonicalJson([3n, 1n, 2n])).toBe('["3","1","2"]');
  });

  it.each([
    ['undefined', { a: undefined } as unknown as Canonical],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a function', (() => 1) as unknown as Canonical],
  ])('refuses %s instead of dropping it', (_label, value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });
});

describe('digest', () => {
  it('is sha256 of the canonical JSON, 64 lower-case hex digits', () => {
    const value = { b: 2n, a: null };
    expect(digest(value)).toBe(createHash('sha256').update('{"a":null,"b":"2"}', 'utf8').digest('hex'));
    expect(digest(value)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not depend on key order', () => {
    expect(digest({ a: 1n, b: 2n })).toBe(digest({ b: 2n, a: 1n }));
  });

  it('tells a bigint from a number and null from 0', () => {
    expect(digest({ a: 1n })).toBe(digest({ a: '1' }));
    expect(digest({ a: 1n })).not.toBe(digest({ a: 1 }));
    expect(digest({ a: null })).not.toBe(digest({ a: 0n }));
  });
});
