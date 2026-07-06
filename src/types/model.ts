/**
 * Marine Omics Pathway Mapper — transparent data model.
 *
 * Every record type the application produces is defined here so that the
 * data flow (upload -> normalize -> map -> score -> visualize -> export)
 * is auditable and reproducible. See docs/DATA_MODEL.md for prose.
 */

// ---------------------------------------------------------------------------
// Identifier system
// ---------------------------------------------------------------------------

/** Recognized identifier namespaces. `unknown` is used when no rule matches. */
export type IdentifierType =
  | 'uniprot'
  | 'ensembl'
  | 'ncbi_gene'
  | 'gene_symbol'
  | 'chebi'
  | 'hmdb'
  | 'kegg_compound'
  | 'kegg_gene'
  | 'ko'
  | 'ec'
  | 'pubchem'
  | 'wikipathways'
  | 'reactome'
  | 'metabolite_name'
  | 'unknown';

/** High-level kind of a measured feature. */
export type OmicsLayer =
  | 'rna'
  | 'methylation'
  | 'protein'
  | 'metabolite'
  | 'generic';

/** Detected/confirmed type of an uploaded table. */
export type DataType =
  | 'deg' // differential gene expression
  | 'dmr' // differential methylation region
  | 'proteomics'
  | 'metabolomics'
  | 'generic'
  | 'multiomics';

/** Direction of change for a feature. */
export type Direction = 'up' | 'down' | 'none' | 'unknown';

// ---------------------------------------------------------------------------
// 1. Input record — a single row of an uploaded table, minimally processed.
// ---------------------------------------------------------------------------

export interface InputRecord {
  /** Stable per-row id assigned at parse time (row index within a table). */
  rowId: string;
  /** Which uploaded table this row came from (supports multiple tables). */
  sourceTable: string;
  /** Raw cell values keyed by original column header. */
  raw: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 2. Column mapping — how raw columns are interpreted.
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  identifier: string | null;
  label: string | null;
  effectSize: string | null;
  significance: string | null;
  direction: string | null;
  omicsLayer: string | null;
  /** DMR / genomic-context columns. */
  chromosome: string | null;
  start: string | null;
  end: string | null;
  nearestGene: string | null;
  dmrId: string | null;
  /** Free annotation columns retained for the entity (GO/EC/KO/pathway/etc.). */
  annotationColumns: string[];
}

export interface AnalysisThresholds {
  /** Significance cutoff applied to the significance column. */
  significanceThreshold: number;
  /** Absolute effect-size cutoff. */
  effectSizeThreshold: number;
  /** If true, smaller significance values are stronger (p-values/FDR). */
  smallerIsStronger: boolean;
  /** If true, rows failing thresholds are removed before mapping. */
  filterBeforeMapping: boolean;
}

// ---------------------------------------------------------------------------
// 3. Normalized entity — one feature with parsed, typed values.
// ---------------------------------------------------------------------------

export interface NormalizedEntity {
  rowId: string;
  sourceTable: string;
  /** Primary identifier as uploaded. */
  identifier: string;
  /** Namespace inferred for the identifier. */
  identifierType: IdentifierType;
  /** Uppercased/normalized form used for matching. */
  normalizedId: string;
  label: string | null;
  omicsLayer: OmicsLayer;
  effectSize: number | null;
  significance: number | null;
  /** True when significance passes the user threshold. */
  significant: boolean;
  direction: Direction;
  /** Retained annotations (column header -> value). */
  annotations: Record<string, string>;
  /** DMR-specific fields, present only for methylation region rows. */
  dmr?: DmrContext;
  /** True when the row was excluded by pre-mapping filtering. */
  filteredOut: boolean;
}

export interface DmrContext {
  dmrId: string | null;
  chromosome: string | null;
  start: number | null;
  end: number | null;
  nearestGene: string | null;
  /** How the DMR was linked to a gene. */
  linkMethod: 'nearest_gene' | 'gene_body' | 'promoter' | 'user_linked' | 'none';
}

// ---------------------------------------------------------------------------
// 4. Ortholog relationship.
// ---------------------------------------------------------------------------

export interface OrthologRelationship {
  sourceId: string;
  sourceType: IdentifierType;
  referenceId: string;
  referenceType: IdentifierType;
  /** Confidence or relationship type from the ortholog source, if provided. */
  confidence: string | null;
  /** 'one2one' | 'one2many' | 'many2one' | 'many2many' | 'unknown'. */
  relationship: OrthologyCardinality;
  /** Where the mapping came from. */
  provenance: 'builtin' | 'user_table' | 'direct';
}

export type OrthologyCardinality =
  | 'one2one'
  | 'one2many'
  | 'many2one'
  | 'many2many'
  | 'unknown';

export type SpeciesMode = 'direct' | 'ortholog_reference' | 'user_ortholog_table';

export interface SpeciesSettings {
  mode: SpeciesMode;
  /** Study organism (free text or preset id). */
  studySpecies: string;
  /** Reference organism for ortholog mapping. */
  referenceSpecies: string | null;
  /** Evolutionary-distance flag between study and reference (heuristic). */
  distantReference: boolean;
}

// ---------------------------------------------------------------------------
// 5. Pathway + pathway entity (from the curated library / live sources).
// ---------------------------------------------------------------------------

export type PathwaySource = 'wikipathways' | 'reactome';

export type PathwayCategory =
  | 'metabolism'
  | 'energy_metabolism'
  | 'amino_acid_metabolism'
  | 'lipid_metabolism'
  | 'oxidative_stress'
  | 'immunity'
  | 'signal_transduction'
  | 'cell_cycle'
  | 'apoptosis'
  | 'reproduction'
  | 'epigenetic_regulation'
  | 'environmental_stress'
  | 'disease';

export interface PathwayEntity {
  /** Node id within the pathway. */
  nodeId: string;
  /** Display label as it appears in the source pathway. */
  label: string;
  /** Type of node in the pathway. */
  entityType: 'gene' | 'protein' | 'enzyme' | 'metabolite' | 'complex' | 'reaction' | 'event';
  /** Cross-references keyed by identifier type (for matching). */
  xrefs: Partial<Record<IdentifierType, string[]>>;
  /** Optional layout coordinates (0-1 normalized) if a source layout exists. */
  x?: number;
  y?: number;
}

export interface PathwayEdge {
  source: string;
  target: string;
  type?: string;
}

export interface Pathway {
  id: string;
  source: PathwaySource;
  name: string;
  /** Reference organism the pathway is curated for. */
  organism: string;
  categories: PathwayCategory[];
  description: string;
  /** URL to the source pathway record. */
  sourceUrl: string;
  entities: PathwayEntity[];
  edges: PathwayEdge[];
  /** Attribution string preserved from the source. */
  attribution: string;
}

// ---------------------------------------------------------------------------
// 6. Mapping evidence — how a user feature attaches to a pathway entity.
// ---------------------------------------------------------------------------

export type MappingType = 'direct' | 'orthology' | 'inferred' | 'ambiguous';

export interface MappingEvidence {
  entityRowId: string;
  pathwayId: string;
  pathwayNodeId: string;
  mappingType: MappingType;
  /** Chain of ids traversed: userId -> [referenceId] -> pathwayXref. */
  matchedVia: string[];
  /** True when this user feature maps to >1 pathway node/reference gene. */
  oneToMany: boolean;
  confidenceNote: string | null;
}

// ---------------------------------------------------------------------------
// 7. Mapping summary / audit.
// ---------------------------------------------------------------------------

export interface MappingSummary {
  totalUploaded: number;
  recognized: number;
  mappedDirect: number;
  mappedOrthology: number;
  oneToMany: number;
  unmapped: number;
  excludedByFilter: number;
  identifierTypes: Record<string, number>;
  /** Fraction of mapped features that required orthology. */
  orthologyFraction: number;
}

export interface MappingAuditRow {
  rowId: string;
  identifier: string;
  identifierType: IdentifierType;
  label: string | null;
  omicsLayer: OmicsLayer;
  mapped: boolean;
  mappingType: MappingType | 'unmapped';
  referenceId: string | null;
  oneToMany: boolean;
  matchedPathways: number;
  filteredOut: boolean;
  note: string | null;
}

// ---------------------------------------------------------------------------
// 8. Pathway scoring / ranking.
// ---------------------------------------------------------------------------

export interface PathwayScore {
  pathwayId: string;
  pathwayName: string;
  source: PathwaySource;
  organism: string;
  categories: PathwayCategory[];
  sourceUrl: string;
  /** Number of user features matched to this pathway. */
  matchedFeatures: number;
  /** Number of matched features that are significant. */
  significantFeatures: number;
  /** Number of distinct pathway entities represented. */
  entitiesRepresented: number;
  totalEntities: number;
  /** entitiesRepresented / totalEntities. */
  fractionRepresented: number;
  medianEffectSize: number | null;
  /** Fraction of matched features that are 'up'. */
  directionBalance: number;
  /** Fisher exact p-value, present only when a background is supplied. */
  pValue: number | null;
  /** Benjamini-Hochberg adjusted p-value. */
  qValue: number | null;
  /** Per-omics-layer breakdown. */
  perLayer: Record<string, LayerScore>;
  /** Composite transparent rank score. */
  rankScore: number;
}

export interface LayerScore {
  matched: number;
  significant: number;
  medianEffectSize: number | null;
  directionBalance: number;
}

/** Distinguishes a true enrichment test from a plain mapping summary. */
export type AnalysisMode = 'enrichment' | 'mapping_summary';

// ---------------------------------------------------------------------------
// 9. Transparency warnings.
// ---------------------------------------------------------------------------

export type WarningLevel = 'info' | 'caution' | 'warning';

export interface TransparencyWarning {
  id: string;
  level: WarningLevel;
  message: string;
}

// ---------------------------------------------------------------------------
// 10. Visualization state.
// ---------------------------------------------------------------------------

export type StyleMode =
  | 'original'
  | 'abundance'
  | 'significance'
  | 'methylation'
  | 'multiomics';

export interface VisualizationState {
  pathwayId: string | null;
  styleMode: StyleMode;
  hideUnmapped: boolean;
  showLegend: boolean;
  /** Selected omics layers for display. */
  activeLayers: OmicsLayer[];
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
  colorblindSafe: boolean;
}

// ---------------------------------------------------------------------------
// 11. Export record + session file.
// ---------------------------------------------------------------------------

export interface ExportRecord {
  kind:
    | 'svg'
    | 'png'
    | 'pdf_svg'
    | 'matched_entities_csv'
    | 'unmatched_csv'
    | 'mapping_audit_csv'
    | 'pathway_ranking_csv'
    | 'session_json'
    | 'methods_txt';
  filename: string;
  generatedAt: string;
  appVersion: string;
}

export interface SessionFile {
  appVersion: string;
  generatedAt: string;
  columnMapping: ColumnMapping;
  thresholds: AnalysisThresholds;
  species: SpeciesSettings;
  dataType: DataType;
  pathwaySource: PathwaySource | 'all';
  selectedPathwayId: string | null;
  visualization: VisualizationState;
  /** Optional: retained so a session can be fully re-loaded. */
  tableNames: string[];
}

export const APP_VERSION = '1.0.0';
