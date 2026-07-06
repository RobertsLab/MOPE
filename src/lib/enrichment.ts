/**
 * Pathway scoring, enrichment, and ranking.
 *
 * Two modes:
 *  - 'mapping_summary' (default): descriptive counts only. Used when no
 *    background universe is supplied. No p-values are reported.
 *  - 'enrichment': Fisher's exact test per pathway against a user-supplied
 *    background universe, with Benjamini-Hochberg FDR adjustment.
 *
 * The composite rank score is transparent and documented; it is a weighted
 * blend of representation, significant-match count, and (when available)
 * enrichment strength — never a black box.
 */
import type {
  AnalysisMode,
  LayerScore,
  NormalizedEntity,
  OmicsLayer,
  Pathway,
  PathwayScore,
} from '../types/model';
import type { MappingResult } from './mapping';

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Natural log of a factorial via lgamma. */
function lnFactorial(n: number): number {
  return lnGamma(n + 1);
}

/** Lanczos approximation of ln(gamma(x)). */
function lnGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln of the hypergeometric probability of exactly `a` in the 2x2 table. */
function lnHyperProb(a: number, b: number, c: number, d: number): number {
  const n = a + b + c + d;
  return (
    lnFactorial(a + b) + lnFactorial(c + d) + lnFactorial(a + c) + lnFactorial(b + d) -
    lnFactorial(a) - lnFactorial(b) - lnFactorial(c) - lnFactorial(d) - lnFactorial(n)
  );
}

/**
 * One-sided (over-representation) Fisher's exact test p-value for the 2x2
 * table [[a,b],[c,d]] where a = drawn & in-pathway. Sums tail probabilities
 * of tables at least as extreme (a' >= a).
 */
export function fisherExactOverRep(a: number, b: number, c: number, d: number): number {
  const rowSum = a + b;
  const colSum = a + c;
  const n = a + b + c + d;
  const maxA = Math.min(rowSum, colSum);
  let p = 0;
  for (let x = a; x <= maxA; x++) {
    const bx = rowSum - x;
    const cx = colSum - x;
    const dx = n - x - bx - cx;
    if (bx < 0 || cx < 0 || dx < 0) continue;
    p += Math.exp(lnHyperProb(x, bx, cx, dx));
  }
  return Math.min(1, p);
}

/** Benjamini-Hochberg FDR adjustment. Returns q-values in input order. */
export function benjaminiHochberg(pvals: number[]): number[] {
  const n = pvals.length;
  const indexed = pvals.map((p, i) => ({ p, i }));
  indexed.sort((x, y) => x.p - y.p);
  const q = new Array(n).fill(1);
  let prev = 1;
  for (let rank = n; rank >= 1; rank--) {
    const { p, i } = indexed[rank - 1];
    const val = Math.min(prev, (p * n) / rank);
    q[i] = val;
    prev = val;
  }
  return q;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoreOptions {
  entities: NormalizedEntity[];
  pathways: Pathway[];
  mapping: MappingResult;
  /**
   * Background universe of normalized identifiers (uppercased symbols/ids).
   * When provided (and non-trivial), enrichment mode is used.
   */
  background?: Set<string> | null;
}

export interface ScoringOutput {
  scores: PathwayScore[];
  mode: AnalysisMode;
}

/**
 * Computes per-pathway scores and ranks them. Enrichment mode is used only
 * when a background universe with more members than the mapped set is given.
 */
export function scorePathways(opts: ScoreOptions): ScoringOutput {
  const { entities, pathways, mapping, background } = opts;
  const entityById = new Map(entities.map((e) => [e.rowId, e]));

  // Total mapped features (denominator for Fisher "drawn" set).
  const mappedRowIds = new Set<string>();
  mapping.entityPathways.forEach((_set, rowId) => mappedRowIds.add(rowId));
  const drawnTotal = mappedRowIds.size;

  const useEnrichment = !!background && background.size > drawnTotal && background.size > 0;
  const backgroundSize = useEnrichment ? background!.size : 0;

  const raw: PathwayScore[] = [];

  for (const pathway of pathways) {
    // Which user entities matched any node of this pathway?
    const matchedRowIds = new Set<string>();
    const representedNodes = new Set<string>();
    for (const entity of entities) {
      const paths = mapping.entityPathways.get(entity.rowId);
      if (paths?.has(pathway.id)) matchedRowIds.add(entity.rowId);
    }
    // Which nodes are represented?
    for (const node of pathway.entities) {
      const nk = `${pathway.id}::${node.nodeId}`;
      if ((mapping.nodeMatches.get(nk)?.length ?? 0) > 0) representedNodes.add(node.nodeId);
    }
    if (matchedRowIds.size === 0) continue;

    const matchedEntities = Array.from(matchedRowIds).map((id) => entityById.get(id)!).filter(Boolean);
    const significantFeatures = matchedEntities.filter((e) => e.significant).length;
    const effects = matchedEntities.map((e) => e.effectSize).filter((v): v is number => v != null);
    const medEffect = median(effects);
    const ups = matchedEntities.filter((e) => e.direction === 'up').length;
    const directional = matchedEntities.length ? ups / matchedEntities.length : 0;

    // Per-layer breakdown.
    const perLayer: Record<string, LayerScore> = {};
    const layers = new Set(matchedEntities.map((e) => e.omicsLayer));
    layers.forEach((layer) => {
      const le = matchedEntities.filter((e) => e.omicsLayer === layer);
      const leEffects = le.map((e) => e.effectSize).filter((v): v is number => v != null);
      const leUps = le.filter((e) => e.direction === 'up').length;
      perLayer[layer] = {
        matched: le.length,
        significant: le.filter((e) => e.significant).length,
        medianEffectSize: median(leEffects),
        directionBalance: le.length ? leUps / le.length : 0,
      };
    });

    const totalEntities = pathway.entities.length;
    const fraction = totalEntities ? representedNodes.size / totalEntities : 0;

    let pValue: number | null = null;
    if (useEnrichment) {
      const a = representedNodes.size; // pathway nodes hit by drawn set
      const inPathwayBackground = pathwayBackgroundCount(pathway, background!);
      const b = Math.max(0, drawnTotal - a);
      const c = Math.max(0, inPathwayBackground - a);
      const d = Math.max(0, backgroundSize - a - b - c);
      pValue = fisherExactOverRep(a, b, c, d);
    }

    raw.push({
      pathwayId: pathway.id,
      pathwayName: pathway.name,
      source: pathway.source,
      organism: pathway.organism,
      categories: pathway.categories,
      sourceUrl: pathway.sourceUrl,
      matchedFeatures: matchedEntities.length,
      significantFeatures,
      entitiesRepresented: representedNodes.size,
      totalEntities,
      fractionRepresented: fraction,
      medianEffectSize: medEffect,
      directionBalance: directional,
      pValue,
      qValue: null,
      perLayer,
      rankScore: 0,
    });
  }

  // BH adjustment across pathways (enrichment mode only).
  if (useEnrichment) {
    const ps = raw.map((r) => r.pValue ?? 1);
    const qs = benjaminiHochberg(ps);
    raw.forEach((r, i) => (r.qValue = qs[i]));
  }

  // Composite rank score.
  for (const r of raw) {
    r.rankScore = computeRankScore(r, useEnrichment);
  }
  raw.sort((a, b) => b.rankScore - a.rankScore);

  return { scores: raw, mode: useEnrichment ? 'enrichment' : 'mapping_summary' };
}

/** Count of background identifiers that belong to the pathway (by symbol). */
function pathwayBackgroundCount(pathway: Pathway, background: Set<string>): number {
  let count = 0;
  for (const node of pathway.entities) {
    const syms = node.xrefs.gene_symbol ?? [];
    if (syms.some((s) => background.has(s.toUpperCase()))) count++;
  }
  return count;
}

/**
 * Transparent composite rank score in [0, ~100].
 *   - representation term: 40 * fractionRepresented
 *   - significant-match term: 30 * (significant / (significant + 3))  [saturating]
 *   - enrichment term (if available): 30 * (1 - min(q,1))  else redistributed
 * Documented in docs/DATA_MODEL.md and the About page.
 */
export function computeRankScore(s: PathwayScore, useEnrichment: boolean): number {
  const repTerm = 40 * s.fractionRepresented;
  const sigTerm = 30 * (s.significantFeatures / (s.significantFeatures + 3));
  if (useEnrichment && s.qValue != null) {
    const enrichTerm = 30 * (1 - Math.min(s.qValue, 1));
    return round2(repTerm + sigTerm + enrichTerm);
  }
  // No background: redistribute enrichment weight into match count.
  const matchTerm = 30 * (s.matchedFeatures / (s.matchedFeatures + 5));
  return round2(repTerm + sigTerm + matchTerm);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Builds a background universe of normalized gene symbols from all entities. */
export function backgroundFromEntities(entities: NormalizedEntity[]): Set<string> {
  const s = new Set<string>();
  for (const e of entities) {
    s.add(e.normalizedId);
    if (e.label) s.add(e.label.toUpperCase());
  }
  return s;
}

export const LAYER_LABELS: Record<OmicsLayer, string> = {
  rna: 'RNA',
  methylation: 'Methylation',
  protein: 'Protein',
  metabolite: 'Metabolite',
  generic: 'Generic',
};
