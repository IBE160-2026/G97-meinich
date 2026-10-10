import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The Tailwind theme must carry DESIGN.md's light-mode tokens exactly, and
// nothing from dark mode (stage 2).
const root = path.resolve(import.meta.dirname, '..');
const css = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
const designMd = readFileSync(
  path.join(root, '_bmad-output/planning-artifacts/ux-designs/ux-Peerless-2026-10-04/DESIGN.md'),
  'utf8',
);

// Colour tokens from DESIGN.md's frontmatter `colors:` block.
function designColours(): Map<string, string> {
  const frontmatter = designMd.split(/^---\s*$/m)[1] ?? '';
  const block = frontmatter.split(/^colors:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  const colours = new Map<string, string>();
  for (const match of block.matchAll(/^\s+([a-z0-9-]+):\s*'(#[0-9A-Fa-f]{6})'/gm)) {
    const [, name, hex] = match;
    if (name && hex) colours.set(name, hex.toLowerCase());
  }
  return colours;
}

function themeValue(variable: string): string | undefined {
  const match = css.match(new RegExp(`^\\s*${variable}:\\s*([^;]+);`, 'm'));
  return match?.[1]?.trim().toLowerCase();
}

describe('Tailwind theme', () => {
  const colours = designColours();
  const light = [...colours].filter(([name]) => !name.endsWith('-dark'));

  it('reads the DESIGN.md palette', () => {
    expect(light.length).toBe(19);
    expect(colours.get('band')).toBe('#6c7f95');
  });

  it.each(light)('defines --color-%s as in DESIGN.md', (name, hex) => {
    expect(themeValue(`--color-${name}`)).toBe(hex);
  });

  it('defines band as #6C7F95', () => {
    expect(themeValue('--color-band')).toBe('#6c7f95');
  });

  it('defines the radii sm 3 / md 4 / lg 6 / full', () => {
    expect(themeValue('--radius-sm')).toBe('3px');
    expect(themeValue('--radius-md')).toBe('4px');
    expect(themeValue('--radius-lg')).toBe('6px');
    expect(themeValue('--radius-full')).toBe('9999px');
  });

  it('uses Inter for text and figures and Source Serif 4 for headings', () => {
    expect(themeValue('--font-sans')).toMatch(/^'inter variable', inter,/);
    expect(themeValue('--font-serif')).toMatch(/^'source serif 4 variable', 'source serif 4',/);
    expect(css).toMatch(/@utility figure \{[^}]*font-variant-numeric: tabular-nums;/);
    expect(css).toMatch(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6 \{\s*font-family: var\(--font-serif\);/);
  });

  it('defines the named spacing tokens', () => {
    const spacing: Record<string, string> = {
      'gutter-desktop': '32px',
      'gutter-phone': '16px',
      'card-padding': '24px',
      'card-padding-phone': '16px',
      'grid-gap': '24px',
      'grid-gap-phone': '16px',
      'front-hero-top': '112px',
      'front-hero-top-phone': '40px',
      'indent-group': '30px',
      'target-min': '24px',
      'target-phone': '44px',
    };
    for (const [name, value] of Object.entries(spacing)) {
      expect(themeValue(`--spacing-${name}`), name).toBe(value);
    }
  });

  it('applies no dark-mode tokens', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/-dark\b/);
    expect(rules).not.toMatch(/prefers-color-scheme/);
    expect(rules).not.toMatch(/@custom-variant dark|\.dark\b/);
  });
});
