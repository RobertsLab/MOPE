import { describe, it, expect } from 'vitest';
import {
  escapeCell,
  toDelimited,
  buildMatchedEntitiesExport,
  MATCHED_COLUMNS,
  buildMethodsText,
  buildSessionFile,
} from '../src/lib/exports';
import type { NormalizedEntity, MappingEvidence, ColumnMapping, AnalysisThresholds, SpeciesSettings, VisualizationState } from '../src/types/model';

describe('escapeCell', () => {
  it('quotes CSV cells containing commas, quotes, newlines', () => {
    expect(escapeCell('a,b', ',')).toBe('"a,b"');
    expect(escapeCell('say "hi"', ',')).toBe('"say ""hi"""');
    expect(escapeCell('line1\nline2', ',')).toBe('"line1\nline2"');
  });
  it('leaves simple CSV cells unquoted', () => {
    expect(escapeCell('plain', ',')).toBe('plain');
  });
  it('strips tabs/newlines for TSV', () => {
    expect(escapeCell('a\tb\nc', '\t')).toBe('a b c');
  });
  it('renders null/undefined as empty', () => {
    expect(escapeCell(null, ',')).toBe('');
    expect(escapeCell(undefined, ',')).toBe('');
  });
});

describe('toDelimited', () => {
  const rows = [
    { a: '1', b: 'x,y' },
    { a: '2', b: 'z' },
  ];
  it('produces CSV with header + escaped body', () => {
    const csv = toDelimited(rows, ['a', 'b'], ',');
    expect(csv).toBe('a,b\n1,"x,y"\n2,z');
  });
  it('produces TSV', () => {
    const tsv = toDelimited(rows, ['a', 'b'], '\t');
    expect(tsv).toBe('a\tb\n1\tx,y\n2\tz');
  });
  it('emits header only for empty rows', () => {
    expect(toDelimited([], ['a', 'b'], ',')).toBe('a,b');
  });
});

describe('buildMatchedEntitiesExport', () => {
  const entities: NormalizedEntity[] = [
    {
      rowId: 'r0', sourceTable: 't', identifier: 'TP53', identifierType: 'gene_symbol',
      normalizedId: 'TP53', label: 'TP53', omicsLayer: 'rna', effectSize: 1.5,
      significance: 0.001, significant: true, direction: 'up', annotations: {}, filteredOut: false,
    },
  ];
  const evidence: MappingEvidence[] = [
    { entityRowId: 'r0', pathwayId: 'WP78', pathwayNodeId: 'n1', mappingType: 'direct', matchedVia: ['TP53'], oneToMany: false, confidenceNote: null },
  ];
  it('flattens one row per evidence with full columns', () => {
    const rows = buildMatchedEntitiesExport(entities, evidence);
    expect(rows).toHaveLength(1);
    expect(rows[0].identifier).toBe('TP53');
    expect(rows[0].effectSize).toBe('1.5');
    expect(rows[0].pathwayId).toBe('WP78');
    expect(rows[0].mappingType).toBe('direct');
  });
  it('produces a CSV round-trip with declared columns', () => {
    const rows = buildMatchedEntitiesExport(entities, evidence) as unknown as Record<string, unknown>[];
    const csv = toDelimited(rows, MATCHED_COLUMNS, ',');
    expect(csv.split('\n')[0]).toBe(MATCHED_COLUMNS.join(','));
    expect(csv.split('\n')).toHaveLength(2);
  });
});

describe('buildMethodsText', () => {
  it('uses mapping-summary wording when no background', () => {
    const txt = buildMethodsText({
      sources: ['WikiPathways'], effectField: 'log2FoldChange', significanceField: 'padj',
      threshold: '< 0.05', referenceSpecies: 'Homo sapiens', mode: 'mapping_summary', usedOrthology: true,
    });
    expect(txt).toContain('mapping summary');
    expect(txt).toContain('ortholog mapping to Homo sapiens');
    expect(txt).toContain('WikiPathways');
  });
  it('uses enrichment wording with a background', () => {
    const txt = buildMethodsText({
      sources: ['Reactome'], effectField: 'logFC', significanceField: 'FDR',
      threshold: '< 0.05', referenceSpecies: null, mode: 'enrichment', usedOrthology: false,
    });
    expect(txt).toContain("Fisher");
    expect(txt).toContain('Benjamini-Hochberg');
  });
});

describe('buildSessionFile', () => {
  it('captures all session settings with version + timestamp', () => {
    const columnMapping = {} as ColumnMapping;
    const thresholds = {} as AnalysisThresholds;
    const species = { mode: 'direct', studySpecies: 'Homo sapiens', referenceSpecies: null, distantReference: false } as SpeciesSettings;
    const visualization = {} as VisualizationState;
    const s = buildSessionFile({
      columnMapping, thresholds, species, dataType: 'deg', pathwaySource: 'all',
      selectedPathwayId: 'WP78', visualization, tableNames: ['deg'],
    });
    expect(s.appVersion).toBeTruthy();
    expect(s.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(s.selectedPathwayId).toBe('WP78');
    expect(s.dataType).toBe('deg');
  });
});
