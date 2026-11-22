// The payload scan's probes (Story 3.7, decision 6): the scan of
// e2e/payload-scan.ts admits a register field name only inside the
// drill-down's `<code data-provenance-field>` (HTML) or its RSC element, and
// still fails on a name outside it, on a peer's document line written in
// kroner, and on each stored reconciliation column. Each probe is a body the
// scan must refuse; each admitted form, one it must accept.
import { describe, expect, it } from 'vitest';
import { SERVER_FIELDS, documentFieldsIn, finePercentsIn, formattedPeerLinesIn, groupSumsIn, provenanceFields } from '../e2e/payload-scan.ts';

const NBSP = String.fromCharCode(0xa0);

/** What the scan finds in a body: names left after the marked ones are taken out, and document fields. */
function findings(body: string): string[] {
  const { rest } = provenanceFields(body);
  return [...SERVER_FIELDS.filter((field) => rest.includes(field)), ...documentFieldsIn(rest)];
}

describe('the marked field names are admitted, and only they', () => {
  const html = '<p>r = <code data-provenance-field="">driftsresultat</code> / <code data-provenance-field="">sumDriftsinntekter</code></p>';
  const rsc = '["$","code","1",{"data-provenance-field":"","children":"sumDriftsinntekter"}]';
  const inline = '[\\"$\\",\\"code\\",null,{\\"data-provenance-field\\":\\"\\",\\"children\\":\\"annenDriftskostnad\\"}]';

  it('takes the HTML, the RSC and the inline-payload forms out, and names them', () => {
    expect(provenanceFields(html).fields).toEqual(['driftsresultat', 'sumDriftsinntekter']);
    expect(provenanceFields(rsc).fields).toEqual(['sumDriftsinntekter']);
    expect(provenanceFields(inline).fields).toEqual(['annenDriftskostnad']);
    for (const body of [html, rsc, inline]) expect(findings(body)).toEqual([]);
  });

  it('probe: a field name outside the marker fails', () => {
    // The fixture's state: the same name inside the marker passes.
    expect(findings(rsc)).toEqual([]);
    expect(findings('<span>sumDriftsinntekter</span>')).toContain('sumDriftsinntekter');
    expect(findings('{"children":"annenDriftskostnad"}')).toContain('annenDriftskostnad');
    // A marker with another attribute first is not the admitted form.
    expect(findings('<code class="x" data-provenance-field="">annenDriftskostnad</code>')).toContain('annenDriftskostnad');
  });

  it('probe: a peer’s document line written in kroner fails', () => {
    const peerOre = ['123456700', '5000000'];
    // 1 234 567 kr, a peer's line, written as the page writes kroner.
    expect(formattedPeerLinesIn(`<p>1${NBSP}234${NBSP}567${NBSP}kr</p>`, peerOre, [])).toEqual([`1${NBSP}234${NBSP}567${NBSP}kr`]);
    // Not inside a longer number, and not where the subject has the same line.
    expect(formattedPeerLinesIn(`<p>11${NBSP}234${NBSP}567${NBSP}kr</p>`, peerOre, [])).toEqual([]);
    expect(formattedPeerLinesIn(`<p>1${NBSP}234${NBSP}567${NBSP}kr</p>`, peerOre, ['123456700'])).toEqual([]);
  });

  it.each(['api_check', 'api_fail_fields', 'apiCheck', 'apiFailFields', 'documentFacts'])('probe: the column %s fails', (name) => {
    expect(findings(`{"${name}":"pass"}`)).toContain(name);
  });

  it.each(['c1', 'c2', 'c3', 'c4', 'c5'])('probe: the check %s as a key fails, in the RSC and the inline payload', (check) => {
    expect(findings(`{"${check}":"pass"}`).length).toBeGreaterThan(0);
    expect(findings(`{\\"${check}\\":\\"pass\\"}`).length).toBeGreaterThan(0);
    // Its name in text is not a key.
    expect(findings(`<p>${check}</p>`)).toEqual([]);
  });
});

// Story 3.8: the margin waterfall's drill-downs show shares to two decimals and the subject's
// own lines; a sum over P, in any form, and a share beyond two decimals fail the scan.
describe('the waterfall drill-downs carry no sum over P and no exact share', () => {
  // Σvare over the fixture's P: 1 242 500 000 kr, in øre.
  const sum = '124250000000';
  // Aₓ for vare: 1 242,5 / 15 500, exactly.
  const share = '0.08016129032258064516129032258064516129032';

  it('probe: a group sum in kroner fails', () => {
    // The fixture's state: the page's own two-decimal share and a subject line pass.
    expect(groupSumsIn(`<p>8,02${NBSP}% · 105${NBSP}000${NBSP}000${NBSP}kr</p>`, [sum])).toEqual([]);
    expect(groupSumsIn(`<p>1${NBSP}242${NBSP}500${NBSP}000${NBSP}kr</p>`, [sum])).toEqual([`1${NBSP}242${NBSP}500${NBSP}000${NBSP}kr`]);
    expect(groupSumsIn(`<p>1${NBSP}242,5${NBSP}mill.${NBSP}kr</p>`, [sum])).toEqual([`1${NBSP}242,5${NBSP}mill.${NBSP}kr`]);
    expect(groupSumsIn('{"v":"1242500000"}', [sum])).toEqual(['1242500000']);
    expect(groupSumsIn('{"v":"124250000000"}', [sum])).toEqual(['124250000000']);
    // Not inside a longer number.
    expect(groupSumsIn(`<p>11${NBSP}242${NBSP}500${NBSP}000${NBSP}kr</p>`, [sum])).toEqual([]);
  });

  it('probe: an exact Aₓ fails', () => {
    // The fixture's state: two decimals pass.
    expect(finePercentsIn(`<p>A = 8,02${NBSP}%</p>`, [share])).toEqual([]);
    expect(finePercentsIn(`<p>A = 8,016${NBSP}%</p>`, [share]).length).toBeGreaterThan(0);
    expect(finePercentsIn('<p>8,0161</p>', [share]).length).toBeGreaterThan(0);
    expect(finePercentsIn('{"a":"8.016129"}', [share]).length).toBeGreaterThan(0);
    expect(finePercentsIn('{"a":"0.08016129032"}', [share])).toContain('0.080161');
    // Any percent with three decimals, whatever its value.
    expect(finePercentsIn(`<p>22,952${NBSP}%</p>`, [])).toEqual([`22,952${NBSP}%`]);
  });
});
