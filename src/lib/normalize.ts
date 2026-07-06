/**
 * Converts raw {@link InputRecord}s into typed {@link NormalizedEntity}s
 * using the confirmed {@link ColumnMapping}, {@link AnalysisThresholds}, and
 * data type. Handles numeric parsing, direction inference, significance
 * evaluation, filtering, and DMR context extraction.
 */
import type {
  AnalysisThresholds,
  ColumnMapping,
  DataType,
  Direction,
  DmrContext,
  InputRecord,
  NormalizedEntity,
  OmicsLayer,
} from '../types/model';
import { detectIdentifierType, normalizeIdentifier } from './identifiers';
import { dataTypeToLayer } from './parse';

/** Parses a possibly messy numeric cell; returns null when not a number. */
export function parseNumber(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = v.toString().trim();
  if (!s || s.toLowerCase() === 'na' || s.toLowerCase() === 'nan' || s === '.') return null;
  // Handle scientific notation and comma decimals.
  const cleaned = s.replace(/,/g, /\d,\d/.test(s) ? '' : '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Maps a free-text direction cell to a {@link Direction}. */
export function parseDirection(v: string | undefined | null): Direction {
  if (!v) return 'unknown';
  const s = v.toString().trim().toLowerCase();
  if (!s) return 'unknown';
  if (['up', 'upregulated', 'increase', 'increased', 'hyper', 'hypermethylated', '+', '1', 'gain'].includes(s)) return 'up';
  if (['down', 'downregulated', 'decrease', 'decreased', 'hypo', 'hypomethylated', '-', '-1', 'loss'].includes(s)) return 'down';
  if (['ns', 'none', 'no change', 'nochange', 'stable', '0'].includes(s)) return 'none';
  return 'unknown';
}

/** Determines direction from an explicit column or the sign of the effect size. */
function resolveDirection(explicit: Direction, effect: number | null): Direction {
  if (explicit !== 'unknown') return explicit;
  if (effect == null) return 'unknown';
  if (effect > 0) return 'up';
  if (effect < 0) return 'down';
  return 'none';
}

function resolveLayer(
  record: InputRecord,
  mapping: ColumnMapping,
  dataType: DataType,
): OmicsLayer {
  if (mapping.omicsLayer) {
    const v = (record.raw[mapping.omicsLayer] ?? '').trim().toLowerCase();
    if (/rna|expr|transcript|deg/.test(v)) return 'rna';
    if (/methyl|dmr|dmc|bs/.test(v)) return 'methylation';
    if (/prot|pep/.test(v)) return 'protein';
    if (/metab|compound|chebi|hmdb/.test(v)) return 'metabolite';
  }
  return dataTypeToLayer(dataType);
}

function extractDmr(record: InputRecord, mapping: ColumnMapping): DmrContext | undefined {
  if (!mapping.dmrId && !mapping.chromosome && !mapping.nearestGene) return undefined;
  const get = (c: string | null) => (c ? (record.raw[c] ?? '').trim() || null : null);
  return {
    dmrId: get(mapping.dmrId),
    chromosome: get(mapping.chromosome),
    start: parseNumber(get(mapping.start)),
    end: parseNumber(get(mapping.end)),
    nearestGene: get(mapping.nearestGene),
    linkMethod: mapping.nearestGene ? 'nearest_gene' : 'none',
  };
}

export interface NormalizeOptions {
  mapping: ColumnMapping;
  thresholds: AnalysisThresholds;
  dataType: DataType;
}

/** Normalizes a batch of input records. */
export function normalizeRecords(
  records: InputRecord[],
  opts: NormalizeOptions,
): NormalizedEntity[] {
  const { mapping, thresholds, dataType } = opts;
  return records
    .map((rec) => normalizeOne(rec, mapping, thresholds, dataType))
    .filter((e): e is NormalizedEntity => e !== null);
}

function normalizeOne(
  record: InputRecord,
  mapping: ColumnMapping,
  thresholds: AnalysisThresholds,
  dataType: DataType,
): NormalizedEntity | null {
  const idRaw = mapping.identifier ? (record.raw[mapping.identifier] ?? '').trim() : '';
  if (!idRaw) return null; // rows without an identifier are dropped

  const identifierType = detectIdentifierType(idRaw);
  const normalizedId = normalizeIdentifier(idRaw, identifierType);
  const label = mapping.label ? (record.raw[mapping.label] ?? '').trim() || null : null;
  const effectSize = mapping.effectSize ? parseNumber(record.raw[mapping.effectSize]) : null;
  const significance = mapping.significance ? parseNumber(record.raw[mapping.significance]) : null;
  const explicitDir = mapping.direction ? parseDirection(record.raw[mapping.direction]) : 'unknown';
  const direction = resolveDirection(explicitDir, effectSize);
  const layer = resolveLayer(record, mapping, dataType);

  const significant = evaluateSignificance(significance, effectSize, thresholds);

  const annotations: Record<string, string> = {};
  for (const col of mapping.annotationColumns) {
    const v = (record.raw[col] ?? '').trim();
    if (v) annotations[col] = v;
  }

  const dmr = extractDmr(record, mapping);
  const filteredOut = thresholds.filterBeforeMapping && !significant;

  return {
    rowId: record.rowId,
    sourceTable: record.sourceTable,
    identifier: idRaw,
    identifierType,
    normalizedId,
    label,
    omicsLayer: layer,
    effectSize,
    significance,
    significant,
    direction,
    annotations,
    dmr,
    filteredOut,
  };
}

/**
 * A feature is "significant" when both the significance value passes the
 * threshold (respecting the direction of stronger evidence) and, if an
 * effect-size threshold is set, the absolute effect passes it. When no
 * significance value exists, only the effect-size threshold applies.
 */
export function evaluateSignificance(
  significance: number | null,
  effectSize: number | null,
  thresholds: AnalysisThresholds,
): boolean {
  const { significanceThreshold, effectSizeThreshold, smallerIsStronger } = thresholds;
  let sigPass = true;
  if (significance != null) {
    sigPass = smallerIsStronger
      ? significance <= significanceThreshold
      : significance >= significanceThreshold;
  }
  let effectPass = true;
  if (effectSizeThreshold > 0) {
    effectPass = effectSize != null && Math.abs(effectSize) >= effectSizeThreshold;
  }
  return sigPass && effectPass;
}

export const DEFAULT_THRESHOLDS: AnalysisThresholds = {
  significanceThreshold: 0.05,
  effectSizeThreshold: 0,
  smallerIsStronger: true,
  filterBeforeMapping: false,
};
