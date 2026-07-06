import { describe, it, expect } from 'vitest';
import { nodeStyleFor, legendFor, NEUTRAL, UNMATCHED } from '../src/lib/colors';
import type { NormalizedEntity } from '../src/types/model';

function entity(partial: Partial<NormalizedEntity>): NormalizedEntity {
  return {
    rowId: 'r', sourceTable: 't', identifier: 'X', identifierType: 'gene_symbol',
    normalizedId: 'X', label: 'X', omicsLayer: 'rna', effectSize: null,
    significance: null, significant: false, direction: 'unknown', annotations: {},
    filteredOut: false, ...partial,
  };
}

const baseOpts = { maxAbsEffect: 2, styleMode: 'abundance' as const, colorblindSafe: true, significanceThreshold: 0.05, smallerIsStronger: true };

describe('nodeStyleFor', () => {
  it('returns unmatched style for null entity', () => {
    const s = nodeStyleFor(null, baseOpts);
    expect(s.fill).toBe(UNMATCHED);
  });

  it('assigns warm color to positive significant effect', () => {
    const s = nodeStyleFor(entity({ effectSize: 1.8, significant: true, significance: 0.001 }), baseOpts);
    // warm palette values start with #f/#e/#a (orange/red family)
    expect(s.fill).toMatch(/^#(fd|e6|a6|f5|ec|cb|7b)/);
    expect(s.strokeWidth).toBe(3);
  });

  it('assigns cool color to negative significant effect', () => {
    const s = nodeStyleFor(entity({ effectSize: -1.8, significant: true, significance: 0.001 }), baseOpts);
    expect(s.fill).toMatch(/^#(c6|6b|21|08|cf|7f|2e|15)/);
  });

  it('uses neutral for non-significant in abundance mode', () => {
    const s = nodeStyleFor(entity({ effectSize: 1.0, significant: false }), baseOpts);
    expect(s.fill).toBe(NEUTRAL);
  });

  it('flags missing effect size with pattern', () => {
    const s = nodeStyleFor(entity({ effectSize: null, significant: true }), baseOpts);
    expect(s.pattern).toBe(true);
    expect(s.fill).toBe(NEUTRAL);
  });

  it('scales magnitude into buckets (stronger effect => darker)', () => {
    const weak = nodeStyleFor(entity({ effectSize: 0.3, significant: true }), baseOpts);
    const strong = nodeStyleFor(entity({ effectSize: 2.0, significant: true }), baseOpts);
    expect(weak.fill).not.toBe(strong.fill);
  });

  it('significance mode colors by significant flag', () => {
    const opts = { ...baseOpts, styleMode: 'significance' as const };
    const sig = nodeStyleFor(entity({ significant: true, significance: 0.001 }), opts);
    const nonsig = nodeStyleFor(entity({ significant: false }), opts);
    expect(sig.fill).not.toBe(nonsig.fill);
    expect(nonsig.fill).toBe(NEUTRAL);
  });

  it('assigns significance stars by magnitude', () => {
    const s3 = nodeStyleFor(entity({ significant: true, significance: 0.0001 }), baseOpts);
    const s1 = nodeStyleFor(entity({ significant: true, significance: 0.04 }), baseOpts);
    expect(s3.stars).toBe(3);
    expect(s1.stars).toBe(1);
  });

  it('differs between colorblind-safe and alternative palettes', () => {
    const safe = nodeStyleFor(entity({ effectSize: 1.8, significant: true }), { ...baseOpts, colorblindSafe: true });
    const alt = nodeStyleFor(entity({ effectSize: 1.8, significant: true }), { ...baseOpts, colorblindSafe: false });
    expect(safe.fill).not.toBe(alt.fill);
  });
});

describe('legendFor', () => {
  it('produces a diverging legend for abundance mode', () => {
    const legend = legendFor('abundance', true);
    expect(legend.length).toBeGreaterThan(4);
    expect(legend.some((l) => l.pattern)).toBe(true);
    expect(legend.some((l) => l.color === UNMATCHED)).toBe(true);
  });
  it('produces methylation-specific labels', () => {
    const legend = legendFor('methylation', true);
    expect(legend.some((l) => /Hyper/.test(l.label))).toBe(true);
    expect(legend.some((l) => /Hypo/.test(l.label))).toBe(true);
  });
});
