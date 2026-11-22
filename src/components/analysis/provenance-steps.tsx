// The four steps of a drill-down (Story 3.7; EXPERIENCE.md "Provenance
// drill-down"; DESIGN.md "Provenance drill-down"): numbered, each
// calculation in a `surface` chip (tabular), register field names in
// monospace slate, the beste fjerdedel step with its rule, count and "Vis
// fordelingen", and the data-quality line last, in body text.
//
// A server component: the view arrives as strings and field tokens
// (src/analysis/provenance.ts), and a field name is written only as
// `<code data-provenance-field="">name</code>`, the one form the payload
// scan allows (e2e/payload.ts). `formulaExtra` is a slot in the formula step
// for what the browser computes on Verdi (the share line).
import type { ReactNode } from 'react';
import type { FiledValue, Line, ProvenanceView } from '@/analysis/provenance';
import { t } from '@/messages';
import { Disclosure } from './provenance';
import { Chip } from './provenance-chip';

/** One line of text and field names. */
export function LineText({ line }: { readonly line: Line }) {
  return line.map((token, i) =>
    token.kind === 'field' ? (
      <code key={i} data-provenance-field="">
        {token.name}
      </code>
    ) : (
      token.text
    ),
  );
}

function Step({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <li className="mt-3 first:mt-2">
      <p className="m-0 font-semibold">{title}</p>
      {children}
    </li>
  );
}

function Filed({ values }: { readonly values: readonly FiledValue[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {/* The position is the key: a field name may reach the page only inside its <code> marker. */}
      {values.map((value, i) => (
        <li key={i} className="mt-1">
          <span className="figure">
            <code data-provenance-field="">{value.name}</code> {value.value}
          </span>
          {value.rule === null ? null : (
            <Chip>
              <LineText line={value.rule} />
            </Chip>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProvenanceSteps({
  id,
  view,
  formulaExtra = null,
}: {
  /** The drill-down's id, for the ids inside it. */
  readonly id: string;
  readonly view: ProvenanceView;
  readonly formulaExtra?: ReactNode;
}) {
  return (
    <ol className="m-0 list-decimal pl-5 text-[13px] marker:font-semibold">
      <Step title={t('provenance.step.formula')}>
        {view.formula.map((group, i) => (
          <div key={i} className="mt-1">
            {group.label === null ? null : <p className="m-0 mt-2 text-slate">{group.label}</p>}
            {group.lines.map((line, j) => (
              <Chip key={j}>
                <LineText line={line} />
              </Chip>
            ))}
          </div>
        ))}
        {formulaExtra}
      </Step>
      <Step title={t('provenance.step.figure')}>
        {view.figures.map((figure, i) => (
          <div key={figure.label} className="mt-1">
            <p className="m-0 mt-2 text-slate">{figure.label}</p>
            {figure.lines.map((line, j) => (
              <Chip key={j}>
                <LineText line={line} />
              </Chip>
            ))}
            <p className="m-0 mt-1">{figure.best}</p>
            <Disclosure id={`${id}-fordeling-${i}`} label={t('provenance.showDistribution')}>
              <p className="m-0 text-slate">{figure.distribution.caption}</p>
              <ol className="figure m-0 mt-1 grid list-decimal grid-cols-2 gap-x-6 pl-8 sm:grid-cols-3 md:grid-cols-4">
                {figure.distribution.values.map((value, j) =>
                  value.marked ? (
                    <li key={j} className="rounded-sm bg-surface font-semibold" data-marked="">
                      {value.text}
                    </li>
                  ) : (
                    <li key={j}>{value.text}</li>
                  ),
                )}
              </ol>
              <Chip>{figure.distribution.line}</Chip>
            </Disclosure>
          </div>
        ))}
        {/* Story 3.8: a waterfall column's step 2, its lines and its sentences about P; no beste fjerdedel. */}
        {view.pooled.map((step) => (
          <div key={step.label} className="mt-1" data-provenance-pooled="">
            <p className="m-0 mt-2 text-slate">{step.label}</p>
            {step.lines.map((line, j) => (
              <Chip key={j}>
                <LineText line={line} />
              </Chip>
            ))}
            {step.notes.map((note) => (
              <p key={note} className="m-0 mt-1">
                {note}
              </p>
            ))}
          </div>
        ))}
      </Step>
      <Step title={t('provenance.step.filed')}>
        {view.filed.api.length > 0 ? (
          <>
            <Filed values={view.filed.api} />
            {view.filed.apiDate === null ? null : <p className="m-0 mt-1 text-slate">{view.filed.apiDate}</p>}
          </>
        ) : null}
        {view.filed.document.length > 0 ? (
          <div className="mt-2">
            <p className="m-0 font-semibold text-slate">{t('provenance.fromDocument')}</p>
            <Filed values={view.filed.document} />
            {view.filed.documentDate === null ? null : <p className="m-0 mt-1 text-slate">{view.filed.documentDate}</p>}
          </div>
        ) : null}
      </Step>
      <Step title={t('provenance.step.source')}>
        {view.sources.map((source) => (
          <p key={source} className="m-0 mt-1 text-slate">
            {source}
          </p>
        ))}
        <p className="m-0 mt-2" data-provenance-quality="">
          <LineText line={view.quality} />
        </p>
      </Step>
    </ol>
  );
}
