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

describe('Story 2.1b copy', () => {
  it('names the filed annual accounts among the sources in "Kilder og lisens"', () => {
    expect(t('about.sources.origin')).toBe(
      'Tallene i Peerless kommer fra Brønnøysundregistrene: Enhetsregisteret, nøkkeltallene i Regnskapsregisteret og årsregnskapene som er sendt inn til Regnskapsregisteret.',
    );
  });
});

// Story 2.8: the copy approved at the checkpoint (Meinich, 2026-11-13), as
// EXPERIENCE.md quotes it.
describe('Story 2.8 copy', () => {
  it.each([
    ['peers.band.label', 'Størrelsesintervall'],
    ['peers.band.range', 'Omsetning {fra}–{til} mill. kr'],
    [
      'peers.band.fixed',
      'Bare størrelsesintervallet kan utvides. Kravene til sammenlignbart regnskap, selskapsform og bransje løsnes aldri.',
    ],
    [
      'peers.allExcluded',
      'Du har ekskludert alle sammenlignbare selskaper. Ta med et selskap igjen, eller tilbakestill til standard.',
    ],
    ['peers.tooSmall', 'Peer-gruppen har bare {n} sammenlignbare. Med under 10 viser vi ingen median eller kroner.'],
    ['peers.tooSmallWiden', 'Utvid størrelsesintervallet'],
    ['peers.widened.body', 'Utvidet størrelsesintervall ({b}). Dette er ikke standard peer-gruppe.'],
    ['peers.widened.back', 'Tilbake til standard ({b})'],
    ['peers.funnel.excluded', '{n} ekskludert av deg → {m} i analysen'],
    ['peers.col.action', 'Handling'],
    ['peers.action.excludeName', 'Ekskluder {navn}'],
    ['peers.action.restoreName', 'Ta med igjen {navn}'],
    ['peers.excluded', 'Ekskludert'],
    ['peers.reset', 'Tilbakestill til standard'],
    ['peers.announce.excluded', '{navn} er ekskludert. {m} sammenlignbare i analysen.'],
    ['peers.announce.restored', '{navn} er tatt med igjen. {m} sammenlignbare i analysen.'],
    ['peers.announce.band', 'Størrelsesintervall {b}. {n} sammenlignbare.'],
    ['peers.announce.reset', 'Standard peer-gruppe er gjenopprettet. {n} sammenlignbare.'],
    ['peers.pending', 'Oppdaterer …'],
    ['peers.failed', 'Kunne ikke oppdatere analysen. Prøv igjen.'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});
