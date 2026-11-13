// What `pnpm seed` prints about each step's latest run (Story 2.6).
import { describe, expect, it } from 'vitest';
import { runRecordLine, type RunRecord } from '../scripts/step2-record.ts';
import { printRunRecords } from '../scripts/seed-load.ts';

const record: RunRecord = {
  id: '12',
  mode: 'classify',
  started_at: new Date('2026-11-08T10:00:00Z'),
  ended_at: new Date('2026-11-08T10:05:00Z'),
  failures: 2,
  error: null,
};

describe('the run record line', () => {
  it('labels the step and gives the run', () => {
    expect(runRecordLine('step 2', record)).toBe(
      'seed: step 2: last run 12 (classify), started 2026-11-08T10:00:00.000Z, ended 2026-11-08T10:05:00.000Z, 2 failures',
    );
  });

  it('says so when a step has none', () => {
    expect(runRecordLine('step 1', null)).toBe('seed: step 1: no run record');
  });

  it('says when a run did not end, or ended in an error', () => {
    expect(runRecordLine('step 1', { ...record, ended_at: null })).toContain('not ended');
    expect(runRecordLine('step 1', { ...record, error: 'E: x' })).toContain('ended in an error');
  });
});

describe('printing both steps', () => {
  it('prints each step\'s latest run record', async () => {
    const lines = await printRunRecords({
      step1: () => Promise.resolve({ ...record, mode: 'plain' }),
      step2: () => Promise.resolve(null),
    });
    expect(lines).toEqual([expect.stringContaining('step 1: last run 12 (plain)'), 'seed: step 2: no run record']);
  });

  it('says a record could not be read, and does not stop', async () => {
    const lines = await printRunRecords({
      step1: () => Promise.reject(new Error('no such role')),
      step2: () => Promise.resolve(record),
    });
    expect(lines[0]).toBe('seed: step 1: run record could not be read (Error)');
    expect(lines[1]).toContain('step 2: last run 12');
  });
});
