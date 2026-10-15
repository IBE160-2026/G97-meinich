// t() and the copy Story 1.5b adds (EXPERIENCE.md quotes are authoritative;
// the spec's front-page decisions of 2026-10-15).
import { describe, expect, it } from 'vitest';
import { t } from '../src/messages/index.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

describe('t', () => {
  it('returns a message without placeholders as written', () => {
    expect(t('search.label')).toBe('Navn eller organisasjonsnummer');
  });

  it('replaces every placeholder', () => {
    expect(t('search.count', { n: '5' })).toBe('5 treff');
    expect(t('industry.inSentence', { navn: 'dataprogrammeringstjenester', kode: '62.100' })).toBe(
      'dataprogrammeringstjenester (62.100)',
    );
  });

  it('throws when a placeholder has no value', () => {
    expect(() => t('search.count')).toThrow(/search\.count.*\{n\}/);
    expect(() => t('search.noMatch', { q: 'x' })).toThrow(/\{industry\}/);
  });

  it('does not expand braces inside a value', () => {
    expect(t('search.noMatch', { q: '{industry}', industry: 'x' })).toBe(
      'Ingen treff på «{industry}». Peerless har foreløpig bare selskaper i x.',
    );
  });
});

describe('Story 1.5b copy', () => {
  it.each([
    ['front.title', 'Se hva gapet til sammenlignbare selskaper er verdt i kroner'],
    ['front.lead', 'Peerless dekker foreløpig {industry}.'],
    ['front.steps.title', 'Slik fungerer det'],
    ['front.steps.1.title', 'Søk opp selskapet'],
    [
      'front.steps.1.body',
      'Skriv inn navn eller organisasjonsnummer. Vi bruker regnskapet selskapet har levert til Brønnøysundregistrene.',
    ],
    ['front.howLink', 'Les hvordan Peerless velger sammenlignbare selskaper og regner ut tallene'],
    ['footer.sources', 'Kilder og lisens'],
    ['search.label', 'Navn eller organisasjonsnummer'],
    ['search.submit', 'Sammenlign'],
    ['search.count', '{n} treff'],
    ['search.loading', 'Henter analysen …'],
    ['search.empty', 'Skriv inn et navn eller et organisasjonsnummer'],
    ['search.orgnrLength', 'Organisasjonsnummeret må ha 9 siffer'],
    ['search.orgnrChecksum', 'Ugyldig organisasjonsnummer'],
    ['search.noMatch', 'Ingen treff på «{q}». Peerless har foreløpig bare selskaper i {industry}.'],
    [
      'search.unknownOrgnr',
      'Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi {industry}.',
    ],
    ['search.failed', 'Noe gikk galt. Prøv igjen om litt.'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });

  it('names no industry in any message (coverage comes from the register)', () => {
    for (const [id, text] of Object.entries(nb)) {
      expect(text, id).not.toMatch(/\d{2}\.\d{3}|programmeringstjenester/i);
    }
  });
});
