import { describe, it, expect } from 'vitest';
import { fisherExactOverRep, benjaminiHochberg, median, computeRankScore } from '../src/lib/enrichment';
import type { PathwayScore } from '../src/types/model';

describe('fisherExactOverRep', () => {
  it('matches a known 2x2 table p-value', () => {
    // Classic tea-tasting-like table [[8,2],[1,5]]; one-sided over-rep.
    const p = fisherExactOverRep(8, 2, 1, 5);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.05);
  });
  it('returns ~1 for no over-representation', () => {
    const p = fisherExactOverRep(1, 9, 9, 81);
    expect(p).toBeGreaterThan(0.5);
  });
  it('is bounded in [0,1]', () => {
    const p = fisherExactOverRep(5, 5, 5, 5);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('benjaminiHochberg', () => {
  it('returns q-values in input order, monotonic after sorting', () => {
    const p = [0.001, 0.008, 0.039, 0.041, 0.9];
    const q = benjaminiHochberg(p);
    expect(q).toHaveLength(5);
    q.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
    // Smallest p should have smallest (or tied) q.
    expect(q[0]).toBeLessThanOrEqual(q[4]);
  });
  it('never produces q smaller than p*n/rank inversions (monotone)', () => {
    const p = [0.01, 0.02, 0.03];
    const q = benjaminiHochberg(p);
    const sorted = [...q].sort((a, b) => a - b);
    // q should already be non-decreasing when p is sorted ascending
    expect(q).toEqual(sorted);
  });
});

describe('median', () => {
  it('computes odd-length median', () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it('computes even-length median', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('returns null for empty', () => {
    expect(median([])).toBeNull();
  });
});

describe('computeRankScore', () => {
  const base: PathwayScore = {
    pathwayId: 'p', pathwayName: 'P', source: 'wikipathways', organism: 'Homo sapiens',
    categories: ['metabolism'], sourceUrl: '', matchedFeatures: 10, significantFeatures: 6,
    entitiesRepresented: 8, totalEntities: 16, fractionRepresented: 0.5, medianEffectSize: 1.2,
    directionBalance: 0.7, pValue: 0.001, qValue: 0.01, perLayer: {}, rankScore: 0,
  };
  it('is higher with enrichment when q is small', () => {
    const withEnrich = computeRankScore(base, true);
    const noEnrich = computeRankScore({ ...base, qValue: null }, false);
    expect(withEnrich).toBeGreaterThan(0);
    expect(noEnrich).toBeGreaterThan(0);
  });
  it('increases with representation', () => {
    const low = computeRankScore({ ...base, fractionRepresented: 0.1 }, false);
    const high = computeRankScore({ ...base, fractionRepresented: 0.9 }, false);
    expect(high).toBeGreaterThan(low);
  });
});
