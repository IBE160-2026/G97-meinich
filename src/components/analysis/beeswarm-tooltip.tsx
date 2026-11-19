// The beeswarm's tooltip (Story 3.4; EXPERIENCE.md "Tooltip", "Beeswarm";
// DESIGN.md "Tooltip"): a convenience only, never the only place a value
// lives — every value is also in the compact list and "Vis tallene". So it
// is aria-hidden: a screen reader meets the chart's summary and the table,
// never a stray tooltip.
//
// - Desktop (`near`): above the dot it belongs to, kept inside the plot.
// - Phone (`above`): above the whole plot, so it never covers the company
//   marker, with a leader line down to the dot.
//
// Positions arrive in CSS pixels within the plot; the text arrives as
// strings (AD-4).
export type TooltipEntry = { readonly name: string; readonly margin: string; readonly revenue: string };

export function BeeswarmTooltip({
  entry,
  x,
  y,
  width,
  placement,
}: {
  readonly entry: TooltipEntry;
  /** The dot's centre, in CSS pixels from the plot's top left. */
  readonly x: number;
  readonly y: number;
  /** The plot's width in CSS pixels. */
  readonly width: number;
  readonly placement: 'near' | 'above';
}) {
  // Anchor the box on the side with room: left third from its left edge, right third from its right edge.
  const shift = x < width / 3 ? '0%' : x > (width * 2) / 3 ? '-100%' : '-50%';
  const box = (
    <div
      className="pointer-events-none w-max max-w-[220px] rounded-md border border-divider bg-background px-2.5 py-1.5 text-left shadow-[0_2px_8px_rgba(11,35,64,0.14)]"
      data-testid="beeswarm-tooltip"
    >
      <span className="figure block text-[13px] font-semibold">{entry.margin}</span>
      <span className="block text-[13px] break-words">{entry.name}</span>
      <span className="figure block text-[12px] text-slate">{entry.revenue}</span>
    </div>
  );
  if (placement === 'near') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left: x, top: y - 10, transform: `translate(${shift}, -100%)` }}>
        {box}
      </div>
    );
  }
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10"
        style={{ left: x, bottom: 'calc(100% + 8px)', transform: `translateX(${shift})` }}
        data-placement="above"
      >
        {box}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 w-px bg-navy-900"
        style={{ left: x, top: -8, height: y + 8 }}
        data-testid="beeswarm-leader"
      />
    </>
  );
}
