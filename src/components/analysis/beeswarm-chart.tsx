'use client';
// The driftsmargin beeswarm (Story 3.4, decisions 4–6, 10; EXPERIENCE.md
// "Beeswarm"; DESIGN.md "Beeswarm", "Chart markers"): every peer a
// `peer-dot` circle, the company a `signature` circle with a 2 px `navy-900`
// outline on the axis and a line up through the swarm with its name above,
// the median a tick spanning the swarm, beste fjerdedel the hollow downward
// triangle on the axis, and the edge columns' counts under them.
//
// Two layouts, both server-computed (src/analysis/beeswarm.ts): the desktop
// one from `lg`, the phone one below it. The one not shown has `display:
// none`, so a screen reader meets exactly one image: a non-focusable SVG
// with `role="img"`, the summary as its name and every child hidden.
//
// A pointer or a tap picks the nearest dot centre within 12 px on screen
// and shows its tooltip (one at a time; tapping elsewhere or Esc closes it).
// The tooltip is a convenience: the compact list and "Vis tallene" carry
// every value. Only strings and plot coordinates reach this module (AD-4).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { SwarmLayout } from '@/analysis/beeswarm';
import { BeeswarmTooltip, type TooltipEntry } from './beeswarm-tooltip';

/** How far from a dot centre, in CSS pixels, a pointer still picks it. */
const PICK_PX = 12;

type Open = { readonly index: number; readonly scale: number; readonly width: number };

function Plot({
  layout,
  summary,
  entries,
  kind,
}: {
  readonly layout: SwarmLayout;
  readonly summary: string;
  readonly entries: readonly TooltipEntry[];
  readonly kind: 'desktop' | 'phone';
}) {
  const [open, setOpen] = useState<Open | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open === null) return undefined;
    const outside = (event: Event) => {
      if (wrapper.current !== null && event.target instanceof Node && !wrapper.current.contains(event.target)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /** The nearest dot within PICK_PX of the pointer, in screen pixels; null when none is. */
  const pick = (event: PointerEvent<HTMLDivElement>): Open | null => {
    const box = svg.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0) return null;
    const scale = box.width / layout.width;
    const px = (event.clientX - box.left) / scale;
    const py = (event.clientY - box.top) / scale;
    let best: number | null = null;
    let bestDistance = PICK_PX;
    for (let index = 0; index < layout.dots.length; index += 1) {
      const dot = layout.dots[index];
      if (dot === undefined) continue;
      const distance = Math.hypot(dot.x - px, dot.y - py) * scale;
      if (distance <= bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    return best === null ? null : { index: best, scale, width: box.width };
  };

  const shown = open === null ? undefined : entries[open.index];
  const dot = open === null ? undefined : layout.dots[open.index];
  const r = layout.radius;
  const axisY = layout.axis.y;
  const chevron = layout.company.clipped === 'low' ? -1 : 1;

  return (
    <div
      ref={wrapper}
      className="relative touch-manipulation"
      data-layout={kind}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return;
        const next = pick(event);
        // Only a change of dot (or to none) re-renders: a mouse moves many times over one dot.
        setOpen((current) => (current?.index === next?.index ? current : next));
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setOpen(null);
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') setOpen(pick(event));
      }}
    >
      <svg
        ref={svg}
        role="img"
        aria-label={summary}
        focusable="false"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block h-auto w-full"
        data-testid="beeswarm-svg"
      >
        <g aria-hidden="true">
          {layout.ticks.map((tick) => (
            <g key={`t-${tick.x}`}>
              <line x1={tick.x} x2={tick.x} y1={layout.swarmTop} y2={axisY} stroke="var(--color-gridline)" strokeWidth={1} />
              <text x={tick.x} y={axisY + 15} textAnchor={tick.anchor} fontSize={kind === 'desktop' ? 10 : 9} fill="var(--color-slate)" className="figure">
                {tick.text}
              </text>
            </g>
          ))}
          <line x1={layout.axis.from} x2={layout.axis.to} y1={axisY} y2={axisY} stroke="var(--color-divider)" strokeWidth={1} />
          {/* The median tick spans the swarm, with a background halo. */}
          <line x1={layout.median} x2={layout.median} y1={layout.swarmTop} y2={axisY} stroke="var(--color-background)" strokeWidth={4} />
          <line
            className="bs-mark"
            data-mark="median"
            x1={layout.median}
            x2={layout.median}
            y1={layout.swarmTop}
            y2={axisY}
            stroke="var(--color-median)"
            strokeWidth={2}
          />
          {/* The peers: one group carries the look, so each of hundreds of dots is only its centre. */}
          <g className="bs-mark" data-mark="peer" fill="var(--color-peer-dot)" stroke="var(--color-background)" strokeWidth={0.75}>
            {layout.dots.map((d, index) => (
              // The dots' order is the server's packing order, fixed for a page.
              <circle key={index} cx={d.x} cy={d.y} r={r} />
            ))}
          </g>
          {/* The company: a line up through the swarm, its name above, the marker on the axis. */}
          <line x1={layout.company.x} x2={layout.company.x} y1={layout.swarmTop - 6} y2={axisY} stroke="var(--color-navy-900)" strokeWidth={1.5} />
          <text
            x={layout.company.label.x}
            y={layout.swarmTop - 10}
            textAnchor={layout.company.label.anchor}
            fontSize={kind === 'desktop' ? 12 : 11}
            fontWeight={600}
            fill="var(--color-navy-900)"
            stroke="var(--color-background)"
            strokeWidth={3}
            paintOrder="stroke"
            data-mark="company-label"
          >
            {layout.company.label.text}
          </text>
          <path
            className="bs-mark"
            data-mark="best"
            d={`M${layout.best - 5} ${axisY - 10}h10l-5 8z`}
            fill="var(--color-background)"
            stroke="var(--color-slate)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <circle cx={layout.company.x} cy={axisY} r={7} fill="var(--color-background)" />
          <circle
            className="bs-mark"
            data-mark="company"
            cx={layout.company.x}
            cy={axisY}
            r={5}
            fill="var(--color-signature)"
            stroke="var(--color-navy-900)"
            strokeWidth={2}
          />
          {layout.company.clipped !== null ? (
            <path
              data-mark="clipped"
              d={`M${layout.company.x + chevron * 9} ${axisY - 4}l${chevron * 3} 4l${-chevron * 3} 4`}
              fill="none"
              stroke="var(--color-navy-900)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {(['low', 'high'] as const).map((side) => {
            const edge = layout.edges[side];
            return edge === null ? null : (
              <text key={side} x={edge.x} y={axisY + 15} textAnchor={edge.anchor} fontSize={kind === 'desktop' ? 10 : 9} fill="var(--color-slate)" data-edge={side}>
                {edge.text}
              </text>
            );
          })}
          {dot !== undefined ? (
            <circle cx={dot.x} cy={dot.y} r={r + 1.5} fill="none" stroke="var(--color-navy-900)" strokeWidth={1.5} data-mark="picked" />
          ) : null}
        </g>
      </svg>
      {open !== null && shown !== undefined && dot !== undefined ? (
        <BeeswarmTooltip
          entry={shown}
          x={dot.x * open.scale}
          y={dot.y * open.scale}
          width={open.width}
          placement={kind === 'desktop' ? 'near' : 'above'}
        />
      ) : null}
    </div>
  );
}

export function BeeswarmChart({
  summary,
  layouts,
  entries,
}: {
  readonly summary: string;
  readonly layouts: { readonly desktop: SwarmLayout; readonly phone: SwarmLayout };
  /** Each dot's tooltip, indexed as the layouts' dots. */
  readonly entries: readonly TooltipEntry[];
}) {
  return (
    <div className="mt-3" data-testid="beeswarm-chart">
      <div className="hidden lg:block">
        <Plot layout={layouts.desktop} summary={summary} entries={entries} kind="desktop" />
      </div>
      <div className="lg:hidden">
        <Plot layout={layouts.phone} summary={summary} entries={entries} kind="phone" />
      </div>
    </div>
  );
}
