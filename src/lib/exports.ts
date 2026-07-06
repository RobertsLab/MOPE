/**
 * Export helpers: CSV/TSV serialization, session JSON, methods text, and
 * SVG/PNG raster export. All exports are generated client-side.
 */
import type {
  AnalysisMode,
  AnalysisThresholds,
  ColumnMapping,
  MappingAuditRow,
  MappingEvidence,
  NormalizedEntity,
  PathwayScore,
  PathwaySource,
  SessionFile,
  SpeciesSettings,
  VisualizationState,
  DataType,
} from '../types/model';
import { APP_VERSION } from '../types/model';

// ---------------------------------------------------------------------------
// Delimited serialization
// ---------------------------------------------------------------------------

/** Escapes a value for CSV (RFC 4180) or TSV. */
export function escapeCell(value: unknown, delimiter: ',' | '\t'): string {
  const s = value == null ? '' : String(value);
  if (delimiter === ',') {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  // TSV: strip tabs/newlines to keep the grid intact.
  return s.replace(/[\t\n\r]/g, ' ');
}

/** Serializes an array of row objects to CSV/TSV using the given columns. */
export function toDelimited(
  rows: Record<string, unknown>[],
  columns: string[],
  delimiter: ',' | '\t' = ',',
): string {
  const header = columns.map((c) => escapeCell(c, delimiter)).join(delimiter);
  const body = rows
    .map((r) => columns.map((c) => escapeCell(r[c], delimiter)).join(delimiter))
    .join('\n');
  return body ? `${header}\n${body}` : header;
}

// ---------------------------------------------------------------------------
// Specific export builders
// ---------------------------------------------------------------------------

export interface MatchedEntityExportRow {
  rowId: string;
  identifier: string;
  identifierType: string;
  label: string;
  omicsLayer: string;
  effectSize: string;
  significance: string;
  significant: string;
  direction: string;
  pathwayId: string;
  pathwayNodeId: string;
  mappingType: string;
  matchedVia: string;
  oneToMany: string;
  note: string;
}

/** Builds matched-entity rows (one row per (entity, pathway node) match). */
export function buildMatchedEntitiesExport(
  entities: NormalizedEntity[],
  evidence: MappingEvidence[],
): MatchedEntityExportRow[] {
  const byId = new Map(entities.map((e) => [e.rowId, e]));
  return evidence.map((ev) => {
    const e = byId.get(ev.entityRowId);
    return {
      rowId: ev.entityRowId,
      identifier: e?.identifier ?? '',
      identifierType: e?.identifierType ?? '',
      label: e?.label ?? '',
      omicsLayer: e?.omicsLayer ?? '',
      effectSize: e?.effectSize == null ? '' : String(e.effectSize),
      significance: e?.significance == null ? '' : String(e.significance),
      significant: e ? String(e.significant) : '',
      direction: e?.direction ?? '',
      pathwayId: ev.pathwayId,
      pathwayNodeId: ev.pathwayNodeId,
      mappingType: ev.mappingType,
      matchedVia: ev.matchedVia.join(' > '),
      oneToMany: String(ev.oneToMany),
      note: ev.confidenceNote ?? '',
    };
  });
}

export const MATCHED_COLUMNS = [
  'rowId', 'identifier', 'identifierType', 'label', 'omicsLayer', 'effectSize',
  'significance', 'significant', 'direction', 'pathwayId', 'pathwayNodeId',
  'mappingType', 'matchedVia', 'oneToMany', 'note',
];

/** Rows for unmatched uploaded identifiers. */
export function buildUnmatchedExport(audit: MappingAuditRow[]): Record<string, unknown>[] {
  return audit
    .filter((a) => !a.mapped)
    .map((a) => ({
      rowId: a.rowId,
      identifier: a.identifier,
      identifierType: a.identifierType,
      label: a.label ?? '',
      omicsLayer: a.omicsLayer,
      filteredOut: a.filteredOut,
      note: a.note ?? '',
    }));
}

export const UNMATCHED_COLUMNS = ['rowId', 'identifier', 'identifierType', 'label', 'omicsLayer', 'filteredOut', 'note'];

export const AUDIT_COLUMNS = [
  'rowId', 'identifier', 'identifierType', 'label', 'omicsLayer', 'mapped',
  'mappingType', 'referenceId', 'oneToMany', 'matchedPathways', 'filteredOut', 'note',
];

export function auditToRows(audit: MappingAuditRow[]): Record<string, unknown>[] {
  return audit.map((a) => ({
    rowId: a.rowId,
    identifier: a.identifier,
    identifierType: a.identifierType,
    label: a.label ?? '',
    omicsLayer: a.omicsLayer,
    mapped: a.mapped,
    mappingType: a.mappingType,
    referenceId: a.referenceId ?? '',
    oneToMany: a.oneToMany,
    matchedPathways: a.matchedPathways,
    filteredOut: a.filteredOut,
    note: a.note ?? '',
  }));
}

export const RANKING_COLUMNS = [
  'pathwayId', 'pathwayName', 'source', 'organism', 'categories', 'matchedFeatures',
  'significantFeatures', 'entitiesRepresented', 'totalEntities', 'fractionRepresented',
  'medianEffectSize', 'directionBalance', 'pValue', 'qValue', 'rankScore',
];

export function rankingToRows(scores: PathwayScore[]): Record<string, unknown>[] {
  return scores.map((s) => ({
    pathwayId: s.pathwayId,
    pathwayName: s.pathwayName,
    source: s.source,
    organism: s.organism,
    categories: s.categories.join('|'),
    matchedFeatures: s.matchedFeatures,
    significantFeatures: s.significantFeatures,
    entitiesRepresented: s.entitiesRepresented,
    totalEntities: s.totalEntities,
    fractionRepresented: s.fractionRepresented.toFixed(4),
    medianEffectSize: s.medianEffectSize == null ? '' : s.medianEffectSize.toFixed(4),
    directionBalance: s.directionBalance.toFixed(4),
    pValue: s.pValue == null ? '' : s.pValue.toExponential(3),
    qValue: s.qValue == null ? '' : s.qValue.toExponential(3),
    rankScore: s.rankScore,
  }));
}

// ---------------------------------------------------------------------------
// Session file
// ---------------------------------------------------------------------------

export interface SessionInputs {
  columnMapping: ColumnMapping;
  thresholds: AnalysisThresholds;
  species: SpeciesSettings;
  dataType: DataType;
  pathwaySource: PathwaySource | 'all';
  selectedPathwayId: string | null;
  visualization: VisualizationState;
  tableNames: string[];
}

export function buildSessionFile(inputs: SessionInputs): SessionFile {
  return {
    appVersion: APP_VERSION,
    generatedAt: new Date().toISOString(),
    columnMapping: inputs.columnMapping,
    thresholds: inputs.thresholds,
    species: inputs.species,
    dataType: inputs.dataType,
    pathwaySource: inputs.pathwaySource,
    selectedPathwayId: inputs.selectedPathwayId,
    visualization: inputs.visualization,
    tableNames: inputs.tableNames,
  };
}

// ---------------------------------------------------------------------------
// Methods text
// ---------------------------------------------------------------------------

export interface MethodsContext {
  sources: string[];
  effectField: string;
  significanceField: string;
  threshold: string;
  referenceSpecies: string | null;
  mode: AnalysisMode;
  usedOrthology: boolean;
}

/** Generates a manuscript-ready methods paragraph with cautious wording. */
export function buildMethodsText(ctx: MethodsContext): string {
  const sources = ctx.sources.length ? ctx.sources.join(' and ') : 'WikiPathways and/or Reactome';
  const orthologyClause = ctx.usedOrthology && ctx.referenceSpecies
    ? ` and, where selected, ortholog mapping to ${ctx.referenceSpecies}`
    : '';
  const modeClause = ctx.mode === 'enrichment'
    ? 'Over-representation was assessed with Fisher\u2019s exact test against the supplied background universe and adjusted for multiple testing using the Benjamini-Hochberg procedure.'
    : 'Because no background universe was supplied, pathway-level results are reported as a mapping summary rather than a statistical enrichment analysis.';

  return [
    `Features were mapped to pathway entities using ${sources} through direct identifier matching${orthologyClause}.`,
    `Differential values were visualized as ${ctx.effectField || 'effect size'}, with statistical significance defined as ${ctx.significanceField || 'adjusted p-value'} ${ctx.threshold}.`,
    modeClause,
    'Pathway-level results are intended as a mapping and enrichment aid and should be interpreted in the context of orthology quality, annotation completeness, and the selected background set.',
    `Analysis was performed with Marine Omics Pathway Mapper v${APP_VERSION}. Pathway sources: WikiPathways (https://www.wikipathways.org) and Reactome (https://reactome.org); please cite these resources.`,
  ].join(' ');
}

// ---------------------------------------------------------------------------
// File download + SVG/PNG raster
// ---------------------------------------------------------------------------

/** Triggers a browser download of a text/blob payload. */
export function downloadBlob(content: BlobPart, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Serializes an <svg> element to a standalone SVG string with XML header. */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const xml = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${xml}`;
}

/** Rasterizes an SVG element to a PNG data URL at the given scale. */
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<string> {
  const svgStr = serializeSvg(svg);
  const bbox = svg.viewBox.baseVal;
  const width = (bbox && bbox.width) || svg.clientWidth || 1200;
  const height = (bbox && bbox.height) || svg.clientHeight || 800;
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.width = width;
    img.height = height;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
