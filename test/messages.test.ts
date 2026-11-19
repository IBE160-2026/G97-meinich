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

// Story 2.9: the copy approved in the spec (Meinich, 2026-11-14, decision 6),
// as EXPERIENCE.md quotes it.
describe('Story 2.9 copy', () => {
  it.each([
    ['analysis.documentFailed', 'Regnskapet for {aar} kunne ikke leses sikkert'],
    ['analysis.documentNotRead', 'Regnskapet for {aar} er ikke lest i denne versjonen'],
    ['analysis.figures.documentMissing', 'Regnskapet for {aar} er ikke lest inn'],
    ['analysis.figures.notReadInV1', 'Ikke lest i denne versjonen'],
    [
      'analysis.figures.notReadInV1.notes',
      'Antall årsverk står i notene til årsregnskapet. Denne versjonen av Peerless leser ikke notene.',
    ],
    [
      'analysis.figures.notReadInV1.filingYear',
      'I denne versjonen leser Peerless årsregnskapene for {fra}–{til}. Regnskapet for {aar} er ikke lest.',
    ],
    [
      'analysis.figures.notReadInV1.paper',
      'Regnskapet for {aar} er levert på papir. Denne versjonen av Peerless leser ikke papirregnskap.',
    ],
    ['analysis.figures.reason.lineNotReadSafely', 'en regnskapslinje kunne ikke leses sikkert'],
    ['analysis.figures.notInDataset', 'Ikke i demodataene'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});

// Story 3.1b: the copy approved in the spec (Meinich, 2026-11-15, decision 5),
// verbatim, and the strings it takes from EXPERIENCE.md.
describe('Story 3.1b copy', () => {
  it.each([
    ['keyFigures.caption', 'Nøkkeltall mot sammenlignbare selskaper'],
    ['keyFigures.middleHalfDays', 'midtre halvdel {lo}–{hi}\u00a0dager'],
    ['keyFigures.middleHalfDaysNegative', 'midtre halvdel {lo} til {hi}\u00a0dager'],
    ['keyFigures.middleHalfDaysLabelled', 'Midtre halvdel: {lo}–{hi}\u00a0dager'],
    ['keyFigures.middleHalfDaysLabelledNegative', 'Midtre halvdel: {lo} til {hi}\u00a0dager'],
    ['keyFigures.middleHalfTurnover', 'midtre halvdel {lo}–{hi}'],
    ['keyFigures.middleHalfTurnoverNegative', 'midtre halvdel {lo} til {hi}'],
    ['keyFigures.middleHalfTurnoverLabelled', 'Midtre halvdel: {lo}–{hi}'],
    ['keyFigures.middleHalfTurnoverLabelledNegative', 'Midtre halvdel: {lo} til {hi}'],
    ['analysis.figures.reason.salesNotPositive', 'salgsinntekten er null eller negativ'],
    ['analysis.figures.reason.costsNotPositive', 'varekostnad og andre driftskostnader er til sammen null eller negative'],
    ['analysis.figures.reason.operatingAssetsNotPositive', 'eiendelene utenom bankinnskudd er null eller negative'],
    ['analysis.figures.reason.priorRevenueNotPositive', 'fjorårets omsetning er null eller negativ'],
    ['keyFigures.targetNotPositive', 'Ingen kronebeløp: beste fjerdedel er ikke over null'],
    ['keyFigures.checkRow', 'Kontroll av de tre andelene'],
    ['fig.ebitda', 'EBITDA-margin'],
    ['fig.vare', 'Varekostnadsandel'],
    ['fig.lonn', 'Lønnskostnadsandel'],
    ['fig.andre', 'Andel andre driftskostnader'],
    ['fig.total', 'Total kostnadsandel'],
    ['fig.omsArsverk', 'Omsetning per årsverk'],
    ['fig.lonnArsverk', 'Lønnskostnad per årsverk'],
    ['fig.kfd', 'Kundefordringsdager'],
    ['fig.lgd', 'Leverandørgjeldsdager'],
    ['fig.oml', 'Omløpshastighet driftseiendeler'],
    ['fig.kontant', 'Kontantandel'],
    ['fig.vekst', 'Omsetningsvekst'],
    ['keyFigures.moreAbout', 'Mer om dette'],
    [
      'keyFigures.notInDataset.popover',
      'Tallene fra årsregnskapsdokumentene er i denne versjonen bare lest inn for demoselskapene og sammenligningsgruppene deres. For dette selskapet sammenlignes bare nøkkeltallene fra Regnskapsregisterets API.',
    ],
    ['keyFigures.notInDataset.state', 'Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen.'],
    ['keyFigures.costShare.kroner', 'Se forklaring av marginen'],
    ['keyFigures.oneOff', 'engangsbeløp'],
    ['keyFigures.costShare.group', 'Forklarer marginavviket – summeres ikke'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});

// Story 3.2: the copy approved in the spec (Meinich, 2026-11-18, decision 6), verbatim.
describe('Story 3.2 copy', () => {
  it.each([
    ['fig.tkOml', 'Totalkapitalens omløpshastighet'],
    ['keyFigures.foldout.margin', 'Margin eller kapitalbruk?'],
    ['keyFigures.foldout.pay', 'Lønnsnivå eller produktivitet?'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});

// Story 3.3: the copy approved in the spec (Meinich, 2026-11-19, decisions 8 and 11), verbatim.
describe('Story 3.3 copy', () => {
  it.each([
    ['keyFigures.foldout.waterfall', 'Hva forklarer marginavviket?'],
    ['waterfall.start', 'Peer-gruppen samlet'],
    ['waterfall.bar.varekostnad', 'Varekostnad'],
    ['waterfall.bar.lonnskostnad', 'Lønn'],
    ['waterfall.bar.annenDriftskostnad', 'Andre driftskostnader'],
    ['waterfall.bar.residual', 'Avskrivninger og øvrige poster'],
    ['waterfall.tag', 'Mot peer-gruppen samlet: {x}, ikke beste fjerdedel'],
    ['waterfall.neverAdded', 'Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat.'],
    ['waterfall.notMedian', 'Mot peer-gruppen samlet, ikke medianen'],
    ['waterfall.tooFew', 'Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs).'],
    ['waterfall.notLoaded', 'Ingen forklaring av marginen: regnskapstallene til de sammenlignbare er ikke i demodataene.'],
    [
      'waterfall.shortOfTotal',
      'Ingen forklaring av marginen: kostnadslinjene i regnskapet for {aar} summerer ikke til sum driftskostnader.',
    ],
    ['waterfall.margin', 'margin {m}'],
    ['waterfall.shares', '{own} mot {all}'],
    ['waterfall.lower', 'lavere enn samlet'],
    ['waterfall.higher', 'høyere enn samlet'],
    ['waterfall.summary', 'Fra {start} (peer-gruppen samlet) til {end}, fire poster, sum {sum}'],
    ['waterfall.legend.favourable', 'Hever marginen mot samlet'],
    ['waterfall.legend.unfavourable', 'Senker marginen mot samlet'],
    ['waterfall.legend.residual', 'Restpost, uten retning'],
    ['waterfall.table.caption', 'Marginavviket mot peer-gruppen samlet, i kroner'],
    ['waterfall.table.post', 'Post'],
    ['waterfall.table.all', 'Samlet'],
    ['waterfall.table.kroner', 'Kroner'],
    ['waterfall.table.reference', 'Referanse'],
    ['chart.showNumbers', 'Vis tallene'],
    ['chart.hideNumbers', 'Skjul tallene'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});

// Story 3.4, decision 8: the approved copy, verbatim; C1–C11 and K2, K7 are the spec's names.
describe('Story 3.4 copy', () => {
  it.each([
    ['oversikt.capital.kicker', 'Største kapitalgap'],
    ['oversikt.strength.kicker', 'Største styrke'],
    ['oversikt.missing.kicker', 'Mangler grunnlag'],
    ['oversikt.topNote', 'Viser gap ved full tilnærming'],
    ['oversikt.capital.notPerYear', 'Ikke per år, og legges ikke til resultatet.'],
    ['oversikt.capital.none', 'Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel.'],
    ['oversikt.strength.none', 'Ingen nøkkeltall ligger på eller over beste fjerdedel.'],
    ['oversikt.missing.none', 'Alle nøkkeltall har grunnlag for sammenligning.'],
    ['oversikt.missing.more', 'og {n} til'],
    ['oversikt.beeswarm.seeAll', 'Se alle {n}'],
    ['oversikt.beeswarm.selected', '(valgt selskap)'],
    // C1, C2, K2
    ['oversikt.capital.amount', 'Frigjort kapital: {belop} (engangsbeløp)'],
    ['oversikt.capital.workingCapital', 'Arbeidskapital (kundefordringsdager og leverandørgjeldsdager)'],
    ['oversikt.capital.noGap', 'Ingen kapitalgap blant kapitalnøkkeltallene som har grunnlag for sammenligning.'],
    // C4, C5, C6
    ['oversikt.beeswarm.heading', 'Driftsmargin blant sammenlignbare'],
    [
      'oversikt.beeswarm.summary',
      'Driftsmargin for {n} sammenlignbare. {selskap} {own}, median {median}, beste fjerdedel {best}, bedre enn {plassering}.',
    ],
    ['oversikt.beeswarm.legend.company', '{selskap} {v}'],
    ['oversikt.beeswarm.legend.median', 'Median {v}'],
    ['oversikt.beeswarm.legend.best', 'Beste fjerdedel {v}'],
    // K7, C8, C9, C10, C11
    ['oversikt.beeswarm.noMargin', '{k} uten driftsmargin er ikke med i plottet.'],
    ['oversikt.beeswarm.nearest', 'Nærmeste i driftsmargin'],
    ['oversikt.beeswarm.caption', 'Driftsmargin for sammenlignbare selskaper'],
    ['oversikt.beeswarm.revenue', 'Omsetning {v}'],
    ['oversikt.beeswarm.edgeLow', '‹ {k}'],
    ['oversikt.beeswarm.edgeHigh', '{k} ›'],
    ['oversikt.beeswarm.edgeLegend', 'Prikkene ved kantene ligger utenfor skalaen.'],
  ] as const)('%s', (id, text) => {
    expect(nb[id]).toBe(text);
  });
});
