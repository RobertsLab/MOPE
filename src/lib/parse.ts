/**
 * Table parsing and column auto-detection.
 *
 * Parses CSV/TSV/pasted text (papaparse) and XLSX (SheetJS) into a uniform
 * {@link ParsedTable}, then applies header/value heuristics to guess a
 * {@link ColumnMapping} and the likely {@link DataType}. All guesses are
 * suggestions the user confirms on the column-mapping screen.
 */
import Papa from 'papaparse';
import type {
  ColumnMapping,
  DataType,
  InputRecord,
} from '../types/model';
import { detectIdentifierType } from './identifiers';

export interface ParsedTable {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parses delimited text (CSV/TSV/pasted). Delimiter is auto-detected. */
export function parseDelimitedText(text: string, name = 'pasted'): ParsedTable {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  const rows = (result.data as Record<string, string>[]).map((r) => {
    const clean: Record<string, string> = {};
    for (const h of headers) clean[h] = (r[h] ?? '').toString();
    return clean;
  });
  return { name, headers, rows };
}

/**
 * Parses an XLSX ArrayBuffer via SheetJS. Reads the first sheet by default.
 * Import is dynamic so the (large) xlsx bundle is only loaded when needed.
 */
export async function parseXlsx(buffer: ArrayBuffer, name = 'sheet'): Promise<ParsedTable> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = json.length ? Object.keys(json[0]).map((h) => h.trim()) : [];
  const rows = json.map((r) => {
    const clean: Record<string, string> = {};
    for (const h of headers) clean[h] = (r[h] ?? '').toString();
    return clean;
  });
  return { name, headers, rows };
}

/** Converts a parsed table into indexed {@link InputRecord}s. */
export function toInputRecords(table: ParsedTable): InputRecord[] {
  return table.rows.map((raw, i) => ({
    rowId: `${table.name}:${i}`,
    sourceTable: table.name,
    raw,
  }));
}

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------

const CANDIDATES: Record<keyof Omit<ColumnMapping, 'annotationColumns'>, string[]> = {
  identifier: [
    'gene_id', 'geneid', 'transcript_id', 'protein_id', 'proteinid', 'uniprot',
    'uniprot_id', 'ensembl', 'ensembl_id', 'ncbi_gene_id', 'entrez', 'entrez_id',
    'metabolite_id', 'feature_id', 'id', 'accession', 'kegg', 'ko',
  ],
  label: [
    'gene_name', 'genename', 'symbol', 'gene_symbol', 'protein_name', 'proteinname',
    'metabolite_name', 'name', 'description', 'label', 'compound',
  ],
  effectSize: [
    'log2foldchange', 'log2fc', 'logfc', 'fold_change', 'foldchange', 'fc',
    'beta', 'beta_difference', 'delta_methylation', 'methdiff', 'meth_diff',
    'diff', 'effect', 'effect_size', 'estimate', 'log2ratio', 'ratio',
  ],
  significance: [
    'padj', 'p_adj', 'padjust', 'adj_p', 'adj_pval', 'fdr', 'qvalue', 'qval',
    'q_value', 'p_value', 'pvalue', 'pval', 'p', 'significance',
  ],
  direction: [
    'up_down', 'updown', 'regulation', 'direction', 'methylation_direction',
    'change', 'trend', 'sign',
  ],
  omicsLayer: ['omics_type', 'assay', 'data_layer', 'layer', 'omics', 'datatype', 'data_type'],
  chromosome: ['chromosome', 'chrom', 'chr', 'seqnames', 'scaffold', 'contig'],
  start: ['start', 'chromstart', 'begin', 'pos', 'position'],
  end: ['end', 'chromend', 'stop'],
  nearestGene: ['nearest_gene', 'nearestgene', 'annotated_gene', 'gene', 'closest_gene', 'linked_gene'],
  dmrId: ['dmr_id', 'dmrid', 'region_id', 'region', 'dmr'],
};

const norm = (h: string) => h.toLowerCase().replace(/[\s._-]+/g, '');

function bestHeaderMatch(headers: string[], candidates: string[]): string | null {
  const normalizedCandidates = candidates.map(norm);
  // Exact normalized match first.
  for (const h of headers) {
    if (normalizedCandidates.includes(norm(h))) return h;
  }
  // Substring match (header contains a candidate token). Only candidates of
  // length >= 3 are allowed to match as substrings, so short tokens like 'p'
  // or 'fc' don't accidentally claim unrelated headers (e.g. 'KEGG_pathway').
  for (const h of headers) {
    const nh = norm(h);
    if (normalizedCandidates.some((c) => c.length >= 3 && nh.includes(c))) return h;
  }
  return null;
}

/**
 * Suggests a {@link ColumnMapping} from headers and a sample of values.
 * The identifier column is refined by sampling: if a header-based guess is
 * absent, the column whose values look most like recognized identifiers wins.
 */
export function detectColumns(table: ParsedTable): ColumnMapping {
  const { headers, rows } = table;
  const mapping: ColumnMapping = {
    identifier: null,
    label: null,
    effectSize: null,
    significance: null,
    direction: null,
    omicsLayer: null,
    chromosome: null,
    start: null,
    end: null,
    nearestGene: null,
    dmrId: null,
    annotationColumns: [],
  };

  (Object.keys(CANDIDATES) as (keyof typeof CANDIDATES)[]).forEach((key) => {
    mapping[key] = bestHeaderMatch(headers, CANDIDATES[key]);
  });

  // Fallback: infer identifier column by value inspection.
  if (!mapping.identifier && headers.length) {
    const sample = rows.slice(0, 30);
    let best: { header: string; score: number } | null = null;
    for (const h of headers) {
      let recognized = 0;
      for (const r of sample) {
        const v = (r[h] ?? '').trim();
        if (v && detectIdentifierType(v) !== 'unknown') recognized++;
      }
      const score = sample.length ? recognized / sample.length : 0;
      if (!best || score > best.score) best = { header: h, score };
    }
    if (best && best.score > 0.3) mapping.identifier = best.header;
    else if (headers.length) mapping.identifier = headers[0];
  }

  // Annotation columns: any header referencing common annotation namespaces
  // that is not already assigned to a structured field.
  const assigned = new Set(
    (Object.keys(mapping) as (keyof ColumnMapping)[])
      .filter((k) => k !== 'annotationColumns')
      .map((k) => mapping[k])
      .filter((v): v is string => typeof v === 'string'),
  );
  const annotationTokens = ['go', 'ec', 'ko', 'pathway', 'chebi', 'hmdb', 'kegg', 'annotation', 'ontology'];
  mapping.annotationColumns = headers.filter(
    (h) => !assigned.has(h) && annotationTokens.some((t) => norm(h).includes(t)),
  );

  return mapping;
}

/**
 * Detects the likely {@link DataType} from mapping + headers.
 * Uses presence of DMR/genomic columns, methylation effect terms, an explicit
 * omics-layer column, and identifier-value inspection.
 */
export function detectDataType(table: ParsedTable, mapping: ColumnMapping): DataType {
  const nh = table.headers.map(norm);
  const has = (tok: string) => nh.some((h) => h.includes(tok));

  // Explicit omics-layer column with >1 distinct value => multiomics.
  if (mapping.omicsLayer) {
    const vals = new Set(
      table.rows.map((r) => (r[mapping.omicsLayer as string] ?? '').trim().toLowerCase()).filter(Boolean),
    );
    if (vals.size > 1) return 'multiomics';
  }

  if (mapping.dmrId || (mapping.chromosome && (mapping.start || mapping.end)) || has('methyl') || has('dmr')) {
    return 'dmr';
  }

  // Metabolite signals: metabolite id/name columns or ChEBI/HMDB identifiers.
  if (has('metabolite') || has('chebi') || has('hmdb') || has('compound')) {
    return 'metabolomics';
  }

  // Protein signals.
  if (has('protein') || has('uniprot')) {
    // Distinguish proteomics from DEG: proteomics tables usually center on protein ids.
    if (!has('transcript') && !has('log2fold')) return 'proteomics';
  }

  // DEG signals: fold-change / logFC present.
  if (has('log2fold') || has('logfc') || has('foldchange') || has('deseq') || has('edger')) {
    return 'deg';
  }

  return 'generic';
}

export const DATA_TYPE_LABELS: Record<DataType, string> = {
  deg: 'Differential gene expression',
  dmr: 'Differential methylation',
  proteomics: 'Differential protein abundance',
  metabolomics: 'Metabolomics',
  generic: 'General feature table',
  multiomics: 'Multi-omics merged table',
};

/** Infers the default omics layer implied by a data type. */
export function dataTypeToLayer(dt: DataType): 'rna' | 'methylation' | 'protein' | 'metabolite' | 'generic' {
  switch (dt) {
    case 'deg':
      return 'rna';
    case 'dmr':
      return 'methylation';
    case 'proteomics':
      return 'protein';
    case 'metabolomics':
      return 'metabolite';
    default:
      return 'generic';
  }
}
