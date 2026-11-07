// The labelled set's draw (Story 5.1, issue #13; README "The draw"),
// committed so it can be audited and rerun. Two steps, with the labeller's
// description scores in between:
//
//   descriptions  Shuffles the eligible 62.100 subjects (seed 20261030) and
//                 walks them in that order. A subject whose Standard-band
//                 pool (funnel stages 1–3) has fewer than 30 companies is
//                 skipped and recorded. Each of the first 150 others gets 30
//                 candidates drawn at random from its pool, with its own
//                 seeded stream. Writes subjects.json (the order, the skips
//                 and the candidates) and subject-descriptions.csv (the
//                 description text only, for the ja/nei score).
//   pairs         Reads the scores, takes the first 15 subjects scored `ja`
//                 and the first 15 scored `nei`, marks the first 3 of each
//                 as blind, and fetches every company's name, description
//                 and website. Writes drawn.json and the two labelling
//                 sheets.
//
// The candidates are drawn in the first step and stored, so the pairs do not
// move if the local database changes between the steps (a step-1 run, for
// example). Only the register's descriptions and websites are fetched again.
//
// Reads the loaded database as `reader` (READER_DATABASE_URL, from the
// environment, then .env) and Enhetsregisteret's open API, cached under
// analysis/.cache/labelled-set/ (gitignored).
//
// Run: node analysis/labelled-set/draw.ts descriptions|pairs   (from the repository root)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setting } from '../../scripts/run-ingest.ts';
import { parseSemicolonCsv } from '../../scripts/ocr-sm2-compare.ts';
import type { Ineligible } from './draw-compute.ts';

export const SEED = 20261030;
export const CANDIDATES_PER_SUBJECT = 30;
export const SUBJECTS_TO_SCORE = 150;
export const PER_STRATUM = 15;
export const BLIND_PER_STRATUM = 3;

const DIR = 'analysis/labelled-set';
export const SUBJECTS_FILE = `${DIR}/subjects.json`;
export const DESCRIPTIONS_FILE = `${DIR}/subject-descriptions.csv`;
export const DRAWN_FILE = `${DIR}/drawn.json`;
export const LABELS_BLIND_FILE = `${DIR}/labels-blind.csv`;
export const LABELS_FILE = `${DIR}/labels.csv`;
const CACHE_DIR = 'analysis/.cache/labelled-set';
const MANIFEST_FILE = 'seed/demo/manifest.json';
const UNIT_URL = 'https://data.brreg.no/enhetsregisteret/api/enheter/';

// mulberry32, as in analysis/ocr-reference/blind-check-draw.ts: a small
// seeded generator, so the draw is the same on every machine. A float in
// [0, 1) used only to pick indices.
export function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/**
 * The subject's own stream: the seed plus its orgnr, so one subject's draw
 * does not depend on which subjects came before it.
 */
export function subjectSeed(orgnr: string): number {
  if (!/^\d{9}$/.test(orgnr)) throw new Error(`not an orgnr: ${orgnr}`);
  return (SEED + Number.parseInt(orgnr, 10)) >>> 0;
}

/** 30 candidates at random from the pool, which is sorted first so its order cannot matter. */
export function drawCandidates(orgnr: string, pool: readonly string[]): string[] {
  if (pool.length < CANDIDATES_PER_SUBJECT) throw new Error(`${orgnr}: pool of ${pool.length}`);
  const sorted = [...pool].sort();
  return shuffled(sorted, generator(subjectSeed(orgnr))).slice(0, CANDIDATES_PER_SUBJECT);
}

export interface DrawnSubject {
  readonly orgnr: string;
  readonly filingYear: number;
  readonly poolSize: number;
  readonly candidates: readonly string[];
}

export interface SubjectsFile {
  readonly seed: number;
  readonly seedManifestSha256: string;
  readonly companies: number;
  readonly ineligible: Readonly<Record<Ineligible, number>>;
  readonly eligible: number;
  /** In shuffled order: each subject walked, until 150 were taken. */
  readonly walked: readonly ({ readonly n: number } & (DrawnSubject | { readonly orgnr: string; readonly skipped: string }))[];
}

export type Score = 'ja' | 'nei';

export interface ChosenSubject extends DrawnSubject {
  readonly informative: boolean;
  readonly blind: boolean;
}

/**
 * The first 15 subjects scored `ja` and the first 15 scored `nei`, in
 * shuffled order; the first 3 of each are blind. Throws when a stratum has
 * fewer than 15, or a score is neither `ja`, `nei` nor empty before both
 * strata are full: the README's fallback is then a decision, not a default.
 */
export function chooseSubjects(drawn: readonly DrawnSubject[], scores: ReadonlyMap<string, string>): ChosenSubject[] {
  const chosen: ChosenSubject[] = [];
  const count = { ja: 0, nei: 0 };
  for (const subject of drawn) {
    if (count.ja === PER_STRATUM && count.nei === PER_STRATUM) break;
    const score = (scores.get(subject.orgnr) ?? '').trim().toLowerCase();
    if (score === '') throw new Error(`${subject.orgnr} is not scored, and the strata are not full`);
    if (score !== 'ja' && score !== 'nei') throw new Error(`${subject.orgnr}: score "${score}" is neither ja nor nei`);
    if (count[score] === PER_STRATUM) continue;
    count[score] += 1;
    chosen.push({ ...subject, informative: score === 'ja', blind: count[score] <= BLIND_PER_STRATUM });
  }
  if (count.ja < PER_STRATUM || count.nei < PER_STRATUM) {
    throw new Error(`strata not full: ${count.ja} ja, ${count.nei} nei of ${PER_STRATUM} each`);
  }
  return chosen;
}

/** One cell, quoted when it holds a separator, a quote or a line break. */
function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Semicolon-separated UTF-8 with a byte-order mark, so a Norwegian Excel opens it column by column with æøå. */
export function semicolonCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

export interface Unit {
  readonly navn: string;
  readonly beskrivelse: string;
  readonly hjemmeside: string;
  /** Empty when the register has the unit; otherwise its HTTP status. */
  readonly missing: string;
}

/** The register's `aktivitet`, falling back to `vedtektsfestetFormaal`, as in analysis/industry_screening.py. */
export function descriptionOf(unit: Record<string, unknown>): string {
  const parts = (unit.aktivitet ?? unit.vedtektsfestetFormaal ?? []) as unknown;
  return Array.isArray(parts) ? parts.map(String).join(' ').trim() : '';
}

async function fetchUnit(root: string, orgnr: string): Promise<Unit> {
  const cacheFile = path.join(root, ...CACHE_DIR.split('/'), `${orgnr}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8')) as Unit;
  let unit: Unit | null = null;
  for (let attempt = 0; attempt < 5 && unit === null; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${UNIT_URL}${orgnr}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      // A network error is retried like a 5xx; the last one names its cause.
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(`${orgnr}: ${(error as Error).message} (${String((error as Error).cause ?? '')})`);
    }
    if (response.ok) {
      const body = (await response.json()) as Record<string, unknown>;
      unit = {
        navn: String(body.navn ?? ''),
        beskrivelse: descriptionOf(body),
        hjemmeside: String(body.hjemmeside ?? ''),
        missing: '',
      };
    } else if (response.status === 404 || response.status === 410) {
      unit = { navn: '', beskrivelse: '', hjemmeside: '', missing: String(response.status) };
    } else if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    } else {
      throw new Error(`${orgnr}: Enhetsregisteret answered ${response.status}`);
    }
  }
  if (unit === null) throw new Error(`${orgnr}: Enhetsregisteret did not answer`);
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(unit));
  await new Promise((resolve) => setTimeout(resolve, 100));
  return unit;
}

async function compute(root: string) {
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.');
  process.env.READER_DATABASE_URL = url;
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport<typeof import('./draw-compute.ts')>(path.join(root, ...DIR.split('/'), 'draw-compute.ts'), {
    root,
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { 'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js') } },
  });
  return module;
}

const file = (root: string, relative: string) => path.join(root, ...relative.split('/'));

async function descriptions(root: string): Promise<void> {
  const db = await compute(root);
  try {
    const companies = await db.industryCompanies();
    const ineligible: Record<Ineligible, number> = { no_filing: 0, no_revenue: 0, non_calendar: 0 };
    const eligible = [];
    for (const orgnr of companies) {
      const result = await db.benchmark(orgnr);
      if ('ineligible' in result) ineligible[result.ineligible] += 1;
      else eligible.push(result.funnel);
    }
    // Sorted by orgnr before the shuffle, so the order the database returns cannot matter.
    eligible.sort((a, b) => (a.orgnr < b.orgnr ? -1 : a.orgnr > b.orgnr ? 1 : 0));
    const order = shuffled(eligible, generator(SEED));
    const walked: SubjectsFile['walked'][number][] = [];
    let taken = 0;
    for (const funnel of order) {
      if (taken === SUBJECTS_TO_SCORE) break;
      const pool = await db.poolOf(funnel);
      const n = walked.length + 1;
      if (pool.length < CANDIDATES_PER_SUBJECT) {
        walked.push({ n, orgnr: funnel.orgnr, skipped: `pool of ${pool.length}, below ${CANDIDATES_PER_SUBJECT}` });
        continue;
      }
      taken += 1;
      walked.push({
        n,
        orgnr: funnel.orgnr,
        filingYear: funnel.filingYear,
        poolSize: pool.length,
        candidates: drawCandidates(funnel.orgnr, pool),
      });
    }
    const out: SubjectsFile = {
      seed: SEED,
      seedManifestSha256: createHash('sha256').update(readFileSync(file(root, MANIFEST_FILE))).digest('hex'),
      companies: companies.length,
      ineligible,
      eligible: eligible.length,
      walked,
    };
    writeFileSync(file(root, SUBJECTS_FILE), `${JSON.stringify(out, null, 2)}\n`);

    const rows = [['n', 'orgnr', 'beskrivelse', 'informativ (ja/nei)']];
    let n = 0;
    for (const entry of walked) {
      if ('skipped' in entry) continue;
      n += 1;
      const unit = await fetchUnit(root, entry.orgnr);
      rows.push([String(n), entry.orgnr, unit.missing === '' ? unit.beskrivelse : `(ikke i registeret: ${unit.missing})`, '']);
    }
    writeFileSync(file(root, DESCRIPTIONS_FILE), semicolonCsv(rows));
    const skipped = walked.length - taken;
    process.stdout.write(
      `labelled-set: ${companies.length} companies, ${eligible.length} eligible; walked ${walked.length}, ` +
        `${skipped} skipped (pool below ${CANDIDATES_PER_SUBJECT}), ${taken} written to ${DESCRIPTIONS_FILE}\n`,
    );
  } finally {
    await db.closeReader();
  }
}

async function pairs(root: string): Promise<void> {
  const subjects = JSON.parse(readFileSync(file(root, SUBJECTS_FILE), 'utf8')) as SubjectsFile;
  const drawn = subjects.walked.filter((entry): entry is { n: number } & DrawnSubject => !('skipped' in entry));
  const [header, ...rows] = parseSemicolonCsv(readFileSync(file(root, DESCRIPTIONS_FILE), 'utf8'));
  const orgnrAt = header?.indexOf('orgnr') ?? -1;
  const scoreAt = header?.findIndex((name) => name.startsWith('informativ')) ?? -1;
  if (orgnrAt < 0 || scoreAt < 0) throw new Error(`${DESCRIPTIONS_FILE}: no orgnr or informativ column`);
  const scores = new Map(rows.filter((row) => row.length > 1).map((row) => [row[orgnrAt] ?? '', row[scoreAt] ?? '']));
  const chosen = chooseSubjects(drawn, scores);

  const units = new Map<string, Unit>();
  for (const subject of chosen) {
    for (const orgnr of [subject.orgnr, ...subject.candidates]) {
      if (!units.has(orgnr)) units.set(orgnr, await fetchUnit(root, orgnr));
    }
  }
  const unit = (orgnr: string) => units.get(orgnr) as Unit;
  const head = [
    'subject_orgnr', 'subject_navn', 'subject_beskrivelse', 'subject_hjemmeside',
    'candidate_orgnr', 'candidate_navn', 'candidate_beskrivelse', 'candidate_hjemmeside',
    'label', 'labelled_by', 'labelled_on', 'notes',
  ];
  const sheet = (blind: boolean) => [
    head,
    ...chosen
      .filter((subject) => subject.blind === blind)
      .flatMap((subject) =>
        subject.candidates.map((candidate) => {
          const s = unit(subject.orgnr);
          const c = unit(candidate);
          return [
            subject.orgnr, s.navn, s.beskrivelse, s.hjemmeside,
            candidate, c.missing === '' ? c.navn : `(ikke i registeret: ${c.missing})`, c.beskrivelse, c.hjemmeside,
            '', '', '', '',
          ];
        }),
      ),
  ];
  writeFileSync(file(root, LABELS_BLIND_FILE), semicolonCsv(sheet(true)));
  writeFileSync(file(root, LABELS_FILE), semicolonCsv(sheet(false)));
  const out = {
    seed: SEED,
    subjects: chosen.map(({ orgnr, filingYear, poolSize, informative, blind, candidates }) => ({
      orgnr, filingYear, poolSize, informative, blind, candidates,
    })),
  };
  writeFileSync(file(root, DRAWN_FILE), `${JSON.stringify(out, null, 2)}\n`);
  const blind = chosen.filter((s) => s.blind).length;
  process.stdout.write(
    `labelled-set: ${chosen.length} subjects (${blind} blind), ${chosen.length * CANDIDATES_PER_SUBJECT} pairs; ` +
      `wrote ${DRAWN_FILE}, ${LABELS_BLIND_FILE}, ${LABELS_FILE}\n`,
  );
}

export async function main(root: string, argv: readonly string[]): Promise<number> {
  try {
    if (argv.length === 1 && argv[0] === 'descriptions') await descriptions(root);
    else if (argv.length === 1 && argv[0] === 'pairs') await pairs(root);
    else throw new Error('usage: node analysis/labelled-set/draw.ts descriptions|pairs');
    return 0;
  } catch (error) {
    process.stderr.write(`labelled-set: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
