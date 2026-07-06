/**
 * Node color-scale assignment.
 *
 * Encodes effect-size direction/magnitude into fill colors, with a
 * colorblind-aware default palette. Non-significant entities are neutral
 * gray; missing effect sizes are signaled via a pattern flag (the renderer
 * draws an outlined/hatched node). Significance is encoded separately as
 * border width/opacity so color and significance are independent channels.
 */
import type { NormalizedEntity, StyleMode } from '../types/model';

export interface NodeStyle {
  fill: string;
  /** true => renderer should draw a hatch/outline pattern (missing value). */
  pattern: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  /** number of significance "stars" (0-3), optional glyph. */
  stars: number;
}

/** Neutral fill for non-significant / no-data nodes. */
export const NEUTRAL = '#9ca3af';
export const UNMATCHED = '#e5e7eb';

// Colorblind-aware diverging palette (blue = negative, orange/red = positive).
// Based on a blue-orange scheme distinguishable under deuteranopia/protanopia.
const COOL = ['#c6dbef', '#6baed6', '#2171b5', '#08306b']; // negative magnitude
const WARM = ['#fdd0a2', '#fd8d3c', '#e6550d', '#a63603']; // positive magnitude

// Non-colorblind-safe alternative (classic red/blue) offered as a toggle.
const COOL_ALT = ['#cfe3f3', '#7fb3d5', '#2e86c1', '#154360'];
const WARM_ALT = ['#f5b7b1', '#ec7063', '#cb4335', '#7b241c'];

function bucket(magnitude: number, maxAbs: number): number {
  if (maxAbs <= 0) return 0;
  const frac = Math.min(1, magnitude / maxAbs);
  return Math.min(3, Math.floor(frac * 4));
}

/**
 * Computes a node style from an entity's effect size and significance.
 * `maxAbsEffect` normalizes magnitude across the current pathway/dataset.
 */
export function nodeStyleFor(
  entity: NormalizedEntity | null,
  opts: { maxAbsEffect: number; styleMode: StyleMode; colorblindSafe: boolean; significanceThreshold: number; smallerIsStronger: boolean },
): NodeStyle {
  if (!entity) {
    return { fill: UNMATCHED, pattern: false, strokeWidth: 1, strokeOpacity: 0.4, stars: 0 };
  }
  const { maxAbsEffect, styleMode, colorblindSafe } = opts;
  const cool = colorblindSafe ? COOL : COOL_ALT;
  const warm = colorblindSafe ? WARM : WARM_ALT;

  // Significance border encoding.
  const strokeWidth = entity.significant ? 3 : 1;
  const strokeOpacity = entity.significant ? 1 : 0.4;
  const stars = starsFor(entity.significance, opts.significanceThreshold, opts.smallerIsStronger);

  // Significance-only style: color by significant/not.
  if (styleMode === 'significance') {
    return {
      fill: entity.significant ? '#8856a7' : NEUTRAL,
      pattern: entity.effectSize == null,
      strokeWidth,
      strokeOpacity,
      stars,
    };
  }

  // Methylation style: hyper (positive delta) vs hypo (negative delta).
  // Uses the same diverging scheme but is semantically methylation direction.
  const value = entity.effectSize;
  if (value == null) {
    return { fill: NEUTRAL, pattern: true, strokeWidth, strokeOpacity, stars };
  }
  if (!entity.significant && styleMode !== 'original') {
    // Non-significant: neutral unless in 'original' styling.
    return { fill: NEUTRAL, pattern: false, strokeWidth, strokeOpacity, stars };
  }

  const b = bucket(Math.abs(value), maxAbsEffect);
  const fill = value >= 0 ? warm[b] : cool[b];
  return { fill, pattern: false, strokeWidth, strokeOpacity, stars };
}

function starsFor(sig: number | null, threshold: number, smallerIsStronger: boolean): number {
  if (sig == null) return 0;
  if (smallerIsStronger) {
    if (sig <= threshold / 50) return 3;
    if (sig <= threshold / 5) return 2;
    if (sig <= threshold) return 1;
    return 0;
  }
  if (sig >= threshold * 50) return 3;
  if (sig >= threshold * 5) return 2;
  if (sig >= threshold) return 1;
  return 0;
}

/** Legend entries for the active style mode. */
export interface LegendEntry {
  color: string;
  label: string;
  pattern?: boolean;
}

export function legendFor(styleMode: StyleMode, colorblindSafe: boolean): LegendEntry[] {
  const cool = colorblindSafe ? COOL : COOL_ALT;
  const warm = colorblindSafe ? WARM : WARM_ALT;
  if (styleMode === 'significance') {
    return [
      { color: '#8856a7', label: 'Significant' },
      { color: NEUTRAL, label: 'Not significant' },
      { color: NEUTRAL, label: 'Missing value', pattern: true },
      { color: UNMATCHED, label: 'Unmapped entity' },
    ];
  }
  const dirLabel = styleMode === 'methylation' ? ['Hypomethylated', 'Hypermethylated'] : ['Negative effect', 'Positive effect'];
  return [
    { color: cool[3], label: `${dirLabel[0]} (strong)` },
    { color: cool[1], label: `${dirLabel[0]} (weak)` },
    { color: NEUTRAL, label: 'Not significant / no change' },
    { color: warm[1], label: `${dirLabel[1]} (weak)` },
    { color: warm[3], label: `${dirLabel[1]} (strong)` },
    { color: NEUTRAL, label: 'Missing value', pattern: true },
    { color: UNMATCHED, label: 'Unmapped entity' },
  ];
}

/** Per-omics-layer glyph colors for multi-omics split nodes. */
export const LAYER_GLYPH_COLORS: Record<string, string> = {
  rna: '#2171b5',
  methylation: '#6a51a3',
  protein: '#238b45',
  metabolite: '#d94801',
  generic: '#525252',
};
