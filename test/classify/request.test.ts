// What pnpm classify sends the model (Story 2.6). Invented companies only.
import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES } from '../../src/engine/fingerprint.ts';
import { ABSTAIN, RESPONSE_SCHEMA, SYSTEM_PROMPT, type Target, parseAnswer, promptHash, requestInput, requestParams } from '../../scripts/classify/request.ts';

const target: Target = {
  orgnr: '000000017',
  navn: 'OPPDIKTET DATA AS',
  naeringskode2: '62.200',
  naeringskode3: null,
  aktivitet: 'Utvikling av programvare',
  vedtektsfestet_formaal: 'Drive konsulentvirksomhet',
};

describe('the request', () => {
  it('sends only the four fields', () => {
    expect(requestInput({ ...target, extra: 'margin 12 %' } as Target)).toEqual({
      navn: 'OPPDIKTET DATA AS',
      sekundaere_naeringskoder: ['62.200'],
      vedtektsfestet_formaal: 'Drive konsulentvirksomhet',
      aktivitet: 'Utvikling av programvare',
    });
    expect(JSON.parse(requestParams(requestInput(target)).messages[0]?.content ?? '')).not.toHaveProperty('orgnr');
  });

  it('sends an identical text once', () => {
    const same = { ...target, aktivitet: 'Samme tekst', vedtektsfestet_formaal: 'Samme tekst' };
    const input = requestInput(same);
    expect(input.vedtektsfestet_formaal).toBe('Samme tekst');
    expect(input).not.toHaveProperty('aktivitet');
    expect(JSON.stringify(input).split('Samme tekst')).toHaveLength(2);
  });

  it('leaves an absent field out', () => {
    expect(requestInput({ ...target, naeringskode2: null, aktivitet: null })).toEqual({
      navn: 'OPPDIKTET DATA AS',
      vedtektsfestet_formaal: 'Drive konsulentvirksomhet',
    });
  });

  it('schema is generated from BUSINESS_TYPES', () => {
    expect(RESPONSE_SCHEMA.properties.business_type.enum).toEqual([...BUSINESS_TYPES, ABSTAIN]);
    expect(Object.keys(RESPONSE_SCHEMA.properties)).toEqual(['business_type']);
    expect(RESPONSE_SCHEMA.additionalProperties).toBe(false);
  });

  it('names every category in the prompt', () => {
    for (const category of [...BUSINESS_TYPES, ABSTAIN]) expect(SYSTEM_PROMPT).toContain(`- ${category}:`);
  });

  it('hashes the prompt to 64 hex digits', () => {
    expect(promptHash()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the answer', () => {
  it('reads a type and the abstention', () => {
    expect(parseAnswer('{"business_type":"konsulent"}')).toEqual({ type: 'konsulent' });
    expect(parseAnswer('{"business_type":"uklart"}')).toEqual({ type: null });
  });

  it.each([
    ['{"business_type":"saas"}', 'answer_outside_category_set'],
    ['{"business_type":"Konsulent"}', 'answer_outside_category_set'],
    ['{"business_type":null}', 'answer_outside_category_set'],
    ['{"business_type":"annet","why":"x"}', 'answer_wrong_shape'],
    ['[]', 'answer_wrong_shape'],
    ['not json', 'answer_not_json'],
  ])('refuses %s', (text, reason) => {
    expect(parseAnswer(text)).toEqual({ failed: reason });
  });
});
