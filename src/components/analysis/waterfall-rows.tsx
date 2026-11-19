// The margin waterfall on the phone (Story 3.3; EXPERIENCE.md "Responsive",
// "Margin waterfall"; DESIGN.md "Margin waterfall"): one row per step, the
// name and the signed value on one line, a subline (▲/▼ and word, own mot
// samlet, "Mot peer-gruppen samlet, ikke medianen" where it applies), and a
// 10 px floating bar on one kroner scale shared by every row. The bars are
// decorative (`aria-hidden`): every value is text in the row.
//
// A server component: strings and positions only (src/analysis/waterfall-view.ts).
import type { BarGeometry, WaterfallView } from '@/analysis/waterfall-view';

type Shown = Extract<WaterfallView, { readonly kind: 'shown' }>;

const BG = {
  start: 'bg-median',
  favourable: 'bg-favourable',
  unfavourable: 'bg-unfavourable',
  residual: 'bg-slate',
  end: 'bg-navy-700',
} as const;

/** The floating bar: from its lower to its upper end on the shared scale, at least 2 px wide. */
function Bar({ kind, geometry }: { readonly kind: keyof typeof BG; readonly geometry: BarGeometry }) {
  const left = `${geometry.from * 100}%`;
  const width = `max(2px, ${(geometry.to - geometry.from) * 100}%)`;
  return (
    <span aria-hidden="true" className="relative mt-1 block h-2.5 w-full">
      <span className={`wf-bar absolute top-0 h-2.5 rounded-[2px] ${BG[kind]}`} data-kind={kind} style={{ left, width }} />
    </span>
  );
}

function Row({
  rowKey,
  name,
  value,
  direction = null,
  sub,
  kind,
  geometry,
}: {
  readonly rowKey: string;
  readonly name: string;
  readonly value: string;
  /** ▲/▼ (aria-hidden) and the word, first in the subline. */
  readonly direction?: { readonly glyph: string | null; readonly word: string } | null;
  readonly sub: readonly string[];
  readonly kind: keyof typeof BG;
  readonly geometry: BarGeometry;
}) {
  return (
    <li className="border-b border-divider py-2" data-wf-row={rowKey}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="min-w-0 font-semibold break-words">{name}</span>
        <span className="figure font-semibold whitespace-nowrap">{value}</span>
      </div>
      <p className="figure m-0 text-[13px] break-words text-slate">
        {direction !== null ? (
          <>
            {direction.glyph !== null ? <span aria-hidden="true">{`${direction.glyph} `}</span> : null}
            {direction.word}
            {' · '}
          </>
        ) : null}
        {sub.join(' · ')}
      </p>
      <Bar kind={kind} geometry={geometry} />
    </li>
  );
}

export function WaterfallRows({ view, companyName }: { readonly view: Shown; readonly companyName: string }) {
  return (
    <ul className="m-0 list-none p-0" data-testid="waterfall-rows">
      <Row rowKey="start" name={view.start.label} value={view.start.value} sub={[view.start.margin]} kind="start" geometry={view.start.geometry} />
      {view.steps.map((step) => (
        <Row
          key={step.key}
          rowKey={step.key}
          name={step.label}
          value={step.value}
          direction={step.word === null ? null : { glyph: step.glyph, word: step.word }}
          sub={[step.shares, ...(step.notMedian === null ? [] : [step.notMedian])]}
          kind={step.kind}
          geometry={step.geometry}
        />
      ))}
      <Row rowKey="end" name={companyName} value={view.end.value} sub={[view.end.margin]} kind="end" geometry={view.end.geometry} />
    </ul>
  );
}
