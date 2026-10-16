// The one server logger (Story 1.10): JSON lines with a closed set of
// fields, and no other console call in src.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { failureKind, log, logLine, type FailureKind, type LogFields } from '../src/logger.ts';

const root = path.resolve(import.meta.dirname, '..');

afterEach(() => vi.restoreAllMocks());

describe('logLine', () => {
  it('writes one JSON object with the level, the event and the fields given', () => {
    const line = logLine('warn', 'request', { budget: 'search', outcome: 'refused', status: 429 });
    expect(line).not.toContain('\n');
    expect(JSON.parse(line ?? '')).toEqual({
      level: 'warn',
      event: 'request',
      budget: 'search',
      outcome: 'refused',
      status: 429,
    });
  });

  it('writes a failure as its class and SQLSTATE', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:54322'), { code: '08006' });
    expect(JSON.parse(logLine('error', 'search.failed', { failure: failureKind(error) }) ?? '')).toEqual({
      level: 'error',
      event: 'search.failed',
      failure: 'Error 08006',
    });
  });

  it('drops anything forced past the types: unknown fields and values of the wrong shape', () => {
    const forced = {
      budget: '203.0.113.77',
      outcome: 'served /analyse/813235552',
      status: 4290,
      failure: 'connect ECONNREFUSED 127.0.0.1' as FailureKind,
      ip: '203.0.113.77',
      path: '/analyse/813235552',
      headers: { 'x-forwarded-for': '203.0.113.77' },
    } as unknown as LogFields;
    const line = logLine('info', 'request', forced) ?? '';
    expect(JSON.parse(line)).toEqual({ level: 'info', event: 'request' });
    expect(line).not.toMatch(/203|813235552|ECONNREFUSED|127/);
  });

  it('writes nothing for a level or an event it does not know', () => {
    expect(logLine('debug' as 'info', 'request')).toBeNull();
    expect(logLine('info', 'GET /analyse/813235552' as 'request')).toBeNull();
  });

  it('takes no free-form text (typecheck)', () => {
    // @ts-expect-error: an event is one of the listed names, not text
    logLine('error', 'subject lookup failed for 813235552');
    // @ts-expect-error: there is no path field
    logLine('info', 'request', { path: '/analyse/813235552' });
    // @ts-expect-error: a failure is made by failureKind, not from a string
    logLine('error', 'search.failed', { failure: 'connect ECONNREFUSED' });
  });
});

describe('failureKind', () => {
  it('names the class, and a SQLSTATE only when it is one', () => {
    expect(failureKind(Object.assign(new Error('x'), { code: '57014' }))).toBe('Error 57014');
    expect(failureKind(new TypeError('x'))).toBe('TypeError');
    expect(failureKind(Object.assign(new Error('x'), { code: 'ECONNREFUSED 127.0.0.1' }))).toBe('Error');
    expect(failureKind('text')).toBe('string');
  });

  it('never passes on a class name that is not a plain name', () => {
    class Odd extends Error {}
    Object.defineProperty(Odd, 'name', { value: 'Odd 203.0.113.77' });
    expect(failureKind(new Odd('x'))).toBe('unknown');
  });
});

describe('log', () => {
  it('writes errors to stderr and the rest to stdout, one line each', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    log('info', 'request', { budget: 'analysis', outcome: 'served' });
    log('error', 'analysis.subjectFailed', { failure: failureKind(new TypeError('x')) });
    expect(out.mock.calls).toEqual([['{"level":"info","event":"request","budget":"analysis","outcome":"served"}']]);
    expect(err.mock.calls).toEqual([['{"level":"error","event":"analysis.subjectFailed","failure":"TypeError"}']]);
  });
});

describe('no console call in src outside src/logger.ts', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });
  }

  it('finds none', () => {
    const offenders = files(path.join(root, 'src'))
      .filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file))
      .filter((file) => path.relative(root, file).replaceAll('\\', '/') !== 'src/logger.ts')
      .filter((file) => /\bconsole\s*[.[]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });
});
