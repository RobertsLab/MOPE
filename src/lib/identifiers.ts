/**
 * Identifier detection and normalization.
 *
 * Each rule maps a raw identifier string to an {@link IdentifierType} using
 * conservative regular expressions. Detection is order-sensitive: more
 * specific patterns are tested before more permissive ones (e.g. HMDB before
 * a bare gene symbol). Normalization uppercases and strips version suffixes
 * so that matching is stable across common export formats.
 */
import type { IdentifierType } from '../types/model';

interface IdRule {
  type: IdentifierType;
  test: RegExp;
  /** Normalizes a raw value that matched this rule. */
  normalize?: (raw: string) => string;
}

const stripVersion = (s: string) => s.replace(/\.\d+$/, '');

/**
 * Ordered detection rules. The first matching rule wins.
 */
const RULES: IdRule[] = [
  // HMDB: HMDB followed by 5 or 7 digits (e.g. HMDB0000122 / HMDB00122).
  { type: 'hmdb', test: /^HMDB\d{5,7}$/i, normalize: (s) => s.toUpperCase() },
  // ChEBI: "CHEBI:1234" or "ChEBI:1234".
  { type: 'chebi', test: /^chebi:\d+$/i, normalize: (s) => s.toUpperCase() },
  // KEGG compound: C followed by 5 digits.
  { type: 'kegg_compound', test: /^C\d{5}$/i, normalize: (s) => s.toUpperCase() },
  // KEGG orthology: K followed by 5 digits.
  { type: 'ko', test: /^K\d{5}$/i, normalize: (s) => s.toUpperCase() },
  // EC number: 1-4 dot-separated groups, last may be '-'.
  { type: 'ec', test: /^(EC[:\s-]?)?\d+\.\d+\.\d+\.(\d+|-)$/i, normalize: (s) => s.replace(/^EC[:\s-]?/i, '') },
  // PubChem CID: "CID12345" or "PubChem:12345".
  { type: 'pubchem', test: /^(cid|pubchem)[:\s-]?\d+$/i, normalize: (s) => 'CID' + s.replace(/^(cid|pubchem)[:\s-]?/i, '') },
  // Reactome stable id: R-XXX-1234567.
  { type: 'reactome', test: /^R-[A-Z]{3}-\d+(\.\d+)?$/i, normalize: (s) => s.toUpperCase() },
  // WikiPathways: WP followed by digits.
  { type: 'wikipathways', test: /^WP\d+$/i, normalize: (s) => s.toUpperCase() },
  // Ensembl: species prefix + G/T/P + 11 digits, version optional.
  { type: 'ensembl', test: /^ENS[A-Z]{0,4}[GTP]\d{6,}(\.\d+)?$/i, normalize: (s) => stripVersion(s).toUpperCase() },
  // UniProt accession (Swiss-Prot/TrEMBL canonical patterns).
  {
    type: 'uniprot',
    test: /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})(-\d+)?$/,
    normalize: (s) => s.toUpperCase(),
  },
  // KEGG gene: organism prefix + ':' + locus, e.g. hsa:7157.
  { type: 'kegg_gene', test: /^[a-z]{3,4}:[A-Za-z0-9_.-]+$/, normalize: (s) => s.toLowerCase() },
  // NCBI Gene: pure digits (kept fairly late; often ambiguous).
  { type: 'ncbi_gene', test: /^\d{1,9}$/, normalize: (s) => s },
];

/**
 * Detects the {@link IdentifierType} of a raw identifier string.
 * Returns 'unknown' when nothing matches; empty/whitespace also => 'unknown'.
 */
export function detectIdentifierType(raw: string): IdentifierType {
  const s = (raw ?? '').trim();
  if (!s) return 'unknown';
  for (const rule of RULES) {
    if (rule.test.test(s)) return rule.type;
  }
  // Gene symbol fallback: short alphanumeric token (letters + digits), no spaces.
  if (/^[A-Za-z][A-Za-z0-9._-]{0,19}$/.test(s)) return 'gene_symbol';
  return 'unknown';
}

/** Normalizes an identifier for matching (uppercase, strip versions, etc.). */
export function normalizeIdentifier(raw: string, type?: IdentifierType): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const t = type ?? detectIdentifierType(s);
  const rule = RULES.find((r) => r.type === t);
  if (rule?.normalize) return rule.normalize(s);
  // Gene symbols and unknowns: uppercase, no version handling.
  if (t === 'gene_symbol') return s.toUpperCase();
  return s.toUpperCase();
}

/** True when the identifier type denotes a metabolite namespace. */
export function isMetaboliteType(t: IdentifierType): boolean {
  return t === 'chebi' || t === 'hmdb' || t === 'kegg_compound' || t === 'pubchem' || t === 'metabolite_name';
}

/** True when the identifier type denotes a gene/protein namespace. */
export function isGeneProteinType(t: IdentifierType): boolean {
  return (
    t === 'uniprot' ||
    t === 'ensembl' ||
    t === 'ncbi_gene' ||
    t === 'gene_symbol' ||
    t === 'kegg_gene' ||
    t === 'ko' ||
    t === 'ec'
  );
}

/** Human-friendly label for an identifier type. */
export function identifierTypeLabel(t: IdentifierType): string {
  const map: Record<IdentifierType, string> = {
    uniprot: 'UniProt',
    ensembl: 'Ensembl',
    ncbi_gene: 'NCBI Gene',
    gene_symbol: 'Gene symbol',
    chebi: 'ChEBI',
    hmdb: 'HMDB',
    kegg_compound: 'KEGG compound',
    kegg_gene: 'KEGG gene',
    ko: 'KEGG orthology (KO)',
    ec: 'EC number',
    pubchem: 'PubChem',
    wikipathways: 'WikiPathways',
    reactome: 'Reactome',
    metabolite_name: 'Metabolite name',
    unknown: 'Unknown',
  };
  return map[t];
}

/**
 * Builds an external database URL for an identifier where a stable resolver
 * exists. Returns null when no safe link-out is available. KEGG is link-only
 * (no image reuse), per data-source policy.
 */
export function externalLink(type: IdentifierType, id: string): string | null {
  const norm = id.trim();
  if (!norm) return null;
  switch (type) {
    case 'uniprot':
      return `https://www.uniprot.org/uniprotkb/${encodeURIComponent(norm)}`;
    case 'ensembl':
      return `https://www.ensembl.org/Multi/Search/Results?q=${encodeURIComponent(norm)}`;
    case 'ncbi_gene':
      return `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(norm)}`;
    case 'gene_symbol':
      return `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(norm)}`;
    case 'chebi':
      return `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${encodeURIComponent(norm)}`;
    case 'hmdb':
      return `https://hmdb.ca/metabolites/${encodeURIComponent(norm)}`;
    case 'kegg_compound':
      return `https://www.kegg.jp/entry/${encodeURIComponent(norm)}`;
    case 'kegg_gene':
      return `https://www.kegg.jp/entry/${encodeURIComponent(norm)}`;
    case 'ko':
      return `https://www.kegg.jp/entry/${encodeURIComponent(norm)}`;
    case 'pubchem':
      return `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(norm.replace(/^CID/, ''))}`;
    case 'reactome':
      return `https://reactome.org/content/detail/${encodeURIComponent(norm)}`;
    case 'wikipathways':
      return `https://www.wikipathways.org/pathways/${encodeURIComponent(norm)}.html`;
    default:
      return null;
  }
}
