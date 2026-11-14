// One phone card of the Peers tab (Stories 2.7, 2.8): name; revenue and
// driftsmargin; reason; basis, flag and the exclude or restore action.
// Shared by the server-rendered first cards (peer-list.tsx) and the cards
// "Vis alle" renders in the client (show-all-toggle.tsx), so both are the
// same markup. It takes every label as a string and imports no engine
// module; the action (peer-action.tsx) reads its own labels. The list's
// classes style the cards from the outside (CARD_LIST_CLASS), which keeps
// each card's markup short. An excluded peer's card stays, in slate, its
// name struck through and tagged "Ekskludert" (DESIGN.md "Peer list").
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import { PeerAction } from './peer-action';

/** The labels a card shows, from t() on the server. */
export type PeerCardLabels = {
  readonly omsetning: string;
  readonly driftsmargin: string;
  readonly reason: string;
  readonly basis: string;
  /** "KI-generert", what screen readers hear for ✦. */
  readonly ki: string;
  /** "Ekskludert", the excluded peer's tag. */
  readonly excluded: string;
};

/** The glyph, U+2726, the same in every marker. */
export const AI_GLYPH = '✦';

export const CARD_LIST_CLASS =
  'm-0 list-none p-0 [&>li]:border-b [&>li]:border-divider [&>li]:py-3 [&_p]:m-0 [&_p]:font-semibold [&_p]:break-words ' +
  '[&_dl]:m-0 [&_dl]:mt-1 [&_dl]:grid [&_dl]:grid-cols-[auto_minmax(0,1fr)] [&_dl]:gap-x-3 [&_dl]:gap-y-1 [&_dl]:text-[13px] ' +
  '[&_dt]:text-slate [&_dd]:m-0 [&_dd]:break-words [&_dd:nth-of-type(-n+2)]:figure ' +
  '[&_dd:last-child]:flex [&_dd:last-child]:flex-wrap [&_dd:last-child]:items-center [&_dd:last-child]:gap-x-2 [&_dd:last-child]:gap-y-1';

/** ✦, `aria-hidden`; `ki` is the spoken "KI-generert", omitted for a second marker in the same cell. */
export function Mark({ ki }: { readonly ki: string | null }) {
  return (
    <>
      <span aria-hidden="true" className="mr-1 text-slate" data-testid="ai-mark">
        {AI_GLYPH}
      </span>
      {ki === null ? null : <span className="sr-only">{`${ki} `}</span>}
    </>
  );
}

/** The basis, ✦ first when it rests on a classification. */
export function Basis({ row, ki }: { readonly row: PeerDisplayRow; readonly ki: string }) {
  return (
    <span data-testid="peer-basis">
      {row.grunnlagKi ? <Mark ki={ki} /> : null}
      {row.grunnlag}
    </span>
  );
}

/** The name, struck through and tagged "Ekskludert" when the peer is excluded. */
export function PeerName({ row, excludedTag }: { readonly row: PeerDisplayRow; readonly excludedTag: string }) {
  if (!row.excluded) return <>{row.navn}</>;
  return (
    <>
      <span className="line-through">{row.navn}</span>{' '}
      <span
        className="inline-flex items-center rounded-sm border border-divider px-1.5 text-[11.5px] font-semibold whitespace-nowrap text-slate no-underline"
        data-testid="peer-excluded"
      >
        {excludedTag}
      </span>
    </>
  );
}

/** The flag as a slate tag; `ki` null when its cell has said "KI-generert" already. */
export function Flag({ text, ki }: { readonly text: string; readonly ki: string | null }) {
  return (
    <span
      className="inline-flex items-center rounded-sm border border-input-border px-1.5 text-[11.5px] font-semibold whitespace-nowrap text-slate"
      data-testid="peer-flag"
    >
      <Mark ki={ki} />
      {text}
    </span>
  );
}

export function PeerCard({
  row,
  labels,
  first,
}: {
  readonly row: PeerDisplayRow;
  readonly labels: PeerCardLabels;
  /** The first card "Vis alle" reveals: it takes focus. */
  readonly first: boolean;
}) {
  return (
    <li data-testid="peer-card" data-excluded={row.excluded ? 'true' : undefined} className={row.excluded ? 'text-slate' : undefined}>
      <p tabIndex={first ? -1 : undefined}>
        <PeerName row={row} excludedTag={labels.excluded} />
      </p>
      <dl>
        <dt>{labels.omsetning}</dt>
        <dd>{row.omsetning}</dd>
        <dt>{labels.driftsmargin}</dt>
        <dd>{row.driftsmargin}</dd>
        <dt>{labels.reason}</dt>
        <dd>{row.hvorforMed}</dd>
        <dt>{labels.basis}</dt>
        {/* Basis and flag share this cell: "KI-generert" is said once for both. */}
        <dd>
          <Basis row={row} ki={labels.ki} />
          {row.flagg === null ? null : <Flag text={row.flagg} ki={row.grunnlagKi ? null : labels.ki} />}
          <PeerAction orgnr={row.orgnr} navn={row.navn} excluded={row.excluded} />
        </dd>
      </dl>
    </li>
  );
}
