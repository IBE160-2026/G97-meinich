// Verdi's drill-downs as the server renders them (Story 3.7, decisions 1 and
// 7): each card's and EV's four steps at full convergence, with a slot in the
// formula step for what the browser computes at the live share
// (`VerdiFormulaSlot`: the share line, EV's product line). The fixed parts
// are the same views the table and the hero show (src/analysis/
// provenance.ts); at the median step the profit's formula is (M − r) ×
// sumDriftsinntekter with the amount `profitAtMedian` gives, written here and
// shown by the slot. No new wire value: the panel receives these as rendered
// nodes, whose field names are marked up as everywhere else.
import type { ReactNode } from 'react';
import {
  capitalProvenance,
  profitAtMedianLines,
  profitProvenance,
  workingCapitalProvenance,
  type ProvenanceSubject,
} from '@/analysis/provenance';
import type { ApiBenchmark, DocumentBenchmark } from '@/engine/benchmark';
import { profitAtMedian } from '@/engine/closable';
import { resolveApiInputs } from '@/engine/key-figures';
import { Chip } from './provenance-chip';
import { LineText, ProvenanceSteps } from './provenance-steps';
import { VerdiFormulaSlot } from './verdi-formula-slot';
import { VERDI_PROVENANCE_IDS } from './verdi-provenance-ids';

/** Each Verdi card's drill-down, and EV's; null where the card can never show an amount. */
export type VerdiProvenance = {
  readonly profit: ReactNode | null;
  readonly workingCapital: ReactNode | null;
  readonly oml: ReactNode | null;
  readonly ev: ReactNode | null;
};

export function verdiProvenance(subject: ProvenanceSubject, api: ApiBenchmark, document: DocumentBenchmark): VerdiProvenance {
  const profit = profitProvenance(subject, api.driftsmargin);
  let median: ReactNode = null;
  if (profit !== null) {
    const revenue = resolveApiInputs(subject.api).sumDriftsinntekter;
    if (revenue === null) throw new Error('a profit amount has its revenue');
    const atMedian = profitAtMedian(api.driftsmargin.comparison, revenue.ore);
    median =
      atMedian === null
        ? null
        : profitAtMedianLines(subject, api.driftsmargin, atMedian.ore).map((line, i) => (
            <Chip key={i}>
              <LineText line={line} />
            </Chip>
          ));
  }
  const workingCapital = workingCapitalProvenance(subject, document);
  const oml = capitalProvenance(subject, 'oml', document.oml);
  return {
    profit:
      profit === null ? null : (
        <ProvenanceSteps id={VERDI_PROVENANCE_IDS.profit} view={profit} formulaExtra={<VerdiFormulaSlot card="profit" median={median} />} />
      ),
    workingCapital:
      workingCapital === null ? null : (
        <ProvenanceSteps
          id={VERDI_PROVENANCE_IDS.workingCapital}
          view={workingCapital}
          formulaExtra={<VerdiFormulaSlot card="workingCapital" />}
        />
      ),
    oml: oml === null ? null : <ProvenanceSteps id={VERDI_PROVENANCE_IDS.oml} view={oml} formulaExtra={<VerdiFormulaSlot card="oml" />} />,
    ev:
      profit === null ? null : (
        <ProvenanceSteps id={VERDI_PROVENANCE_IDS.ev} view={profit} formulaExtra={<VerdiFormulaSlot card="ev" median={median} />} />
      ),
  };
}
