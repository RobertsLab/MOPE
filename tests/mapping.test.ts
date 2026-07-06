import { describe, it, expect } from 'vitest';
import { runMapping } from '../src/lib/mapping';
import { buildOrthologIndex } from '../src/lib/ortholog';
import { normalizeRecords, DEFAULT_THRESHOLDS } from '../src/lib/normalize';
import type { InputRecord, Pathway } from '../src/types/model';

// Minimal test pathway with gene-symbol and metabolite xrefs.
const testPathway: Pathway = {
  id: 'TESTWP',
  source: 'wikipathways',
  name: 'Test Pathway',
  organism: 'Homo sapiens',
  categories: ['metabolism'],
  description: 'test',
  sourceUrl: 'https://example.org',
  attribution: 'test',
  edges: [],
  entities: [
    { nodeId: 'n1', label: 'TP53', entityType: 'gene', xrefs: { gene_symbol: ['TP53'] } },
    { nodeId: 'n2', label: 'SOD2', entityType: 'gene', xrefs: { gene_symbol: ['SOD2'] } },
    { nodeId: 'n3', label: 'Citrate', entityType: 'metabolite', xrefs: { chebi: ['CHEBI:16947'], metabolite_name: ['CITRATE'] } },
    { nodeId: 'n4', label: 'CAT', entityType: 'gene', xrefs: { gene_symbol: ['CAT'] } },
  ],
};

function records(rows: Record<string, string>[]): InputRecord[] {
  return rows.map((raw, i) => ({ rowId: `t:${i}`, sourceTable: 't', raw }));
}

const mapping = {
  identifier: 'id', label: 'name', effectSize: 'lfc', significance: 'padj',
  direction: null, omicsLayer: null, chromosome: null, start: null, end: null,
  nearestGene: null, dmrId: null, annotationColumns: [],
};

describe('runMapping (direct mode)', () => {
  const recs = records([
    { id: 'TP53', name: 'TP53', lfc: '1.5', padj: '0.001' }, // direct, significant
    { id: 'SOD2', name: 'SOD2', lfc: '-0.8', padj: '0.2' }, // direct, not significant
    { id: 'CHEBI:16947', name: 'Citrate', lfc: '0.5', padj: '0.01' }, // metabolite direct
    { id: 'FAKEGENE', name: 'FAKEGENE', lfc: '2.0', padj: '0.001' }, // unmapped
  ]);
  const entities = normalizeRecords(recs, { mapping, thresholds: DEFAULT_THRESHOLDS, dataType: 'deg' });
  const result = runMapping({ entities, pathways: [testPathway], mode: 'direct' });

  it('counts total uploaded', () => {
    expect(result.summary.totalUploaded).toBe(4);
  });
  it('maps direct gene symbols and metabolites', () => {
    expect(result.summary.mappedDirect).toBe(3);
    expect(result.summary.mappedOrthology).toBe(0);
  });
  it('reports one unmapped', () => {
    expect(result.summary.unmapped).toBe(1);
  });
  it('records evidence with direct mapping type', () => {
    const tp53 = result.evidence.find((e) => e.pathwayNodeId === 'n1');
    expect(tp53?.mappingType).toBe('direct');
  });
  it('populates identifier type counts', () => {
    expect(result.summary.identifierTypes['gene_symbol']).toBeGreaterThan(0);
    expect(result.summary.identifierTypes['chebi']).toBe(1);
  });
  it('orthology fraction is zero in direct mode', () => {
    expect(result.summary.orthologyFraction).toBe(0);
  });
});

describe('runMapping (ortholog mode, one-to-many)', () => {
  // CGI_1 -> TP53 and SOD2 (one-to-many); CGI_2 -> CAT (one-to-one)
  const orthoRows = [
    { s: 'CGI_1', r: 'TP53' },
    { s: 'CGI_1', r: 'SOD2' },
    { s: 'CGI_2', r: 'CAT' },
  ];
  const idx = buildOrthologIndex(orthoRows, { sourceCol: 's', referenceCol: 'r', confidenceCol: null });
  const recs = records([
    { id: 'CGI_1', name: '', lfc: '1.0', padj: '0.01' },
    { id: 'CGI_2', name: '', lfc: '-1.0', padj: '0.01' },
  ]);
  const entities = normalizeRecords(recs, { mapping, thresholds: DEFAULT_THRESHOLDS, dataType: 'deg' });
  const result = runMapping({ entities, pathways: [testPathway], orthologIndex: idx, mode: 'ortholog_reference' });

  it('maps both through orthology', () => {
    expect(result.summary.mappedOrthology).toBe(2);
    expect(result.summary.mappedDirect).toBe(0);
  });
  it('flags the one-to-many source', () => {
    expect(result.summary.oneToMany).toBe(1);
    const evForCgi1 = result.evidence.filter((e) => e.matchedVia[0] === 'CGI_1');
    expect(evForCgi1.length).toBe(2);
    expect(evForCgi1.every((e) => e.oneToMany)).toBe(true);
    expect(evForCgi1.every((e) => e.mappingType === 'ambiguous')).toBe(true);
  });
  it('computes orthology fraction of 1.0', () => {
    expect(result.summary.orthologyFraction).toBe(1);
  });
  it('produces an audit row per feature', () => {
    expect(result.audit).toHaveLength(2);
    expect(result.audit.every((a) => a.mapped)).toBe(true);
  });
});

describe('runMapping filtering', () => {
  it('excludes filtered rows and does not map them', () => {
    const recs = records([
      { id: 'TP53', name: 'TP53', lfc: '1.5', padj: '0.001' },
      { id: 'SOD2', name: 'SOD2', lfc: '-0.8', padj: '0.5' }, // fails significance
    ]);
    const thresholds = { ...DEFAULT_THRESHOLDS, filterBeforeMapping: true };
    const entities = normalizeRecords(recs, { mapping, thresholds, dataType: 'deg' });
    const result = runMapping({ entities, pathways: [testPathway], mode: 'direct' });
    expect(result.summary.excludedByFilter).toBe(1);
    expect(result.summary.mappedDirect).toBe(1);
  });
});
