import { describe, it, expect } from 'vitest';
import { parseDelimitedText, detectColumns, detectDataType, toInputRecords } from '../src/lib/parse';

const DEG_CSV = `gene_id,gene_name,log2FoldChange,padj
ENSG00000141510,TP53,1.8,0.001
ENSG00000012048,BRCA1,-2.1,0.02
ENSG00000109424,SOD2,0.4,0.6`;

const DMR_CSV = `DMR_id,chromosome,start,end,nearest_gene,delta_methylation,qvalue
dmr1,chr1,1000,1500,DNMT1,0.35,0.001
dmr2,chr2,5000,5200,TET2,-0.28,0.03`;

const METAB_TSV = `metabolite_id\tmetabolite_name\tHMDB\tlog2FoldChange\tp_value
CHEBI:16947\tCitrate\tHMDB0000094\t1.2\t0.01
CHEBI:15361\tPyruvate\tHMDB0000243\t-0.9\t0.04`;

describe('parseDelimitedText', () => {
  it('parses CSV with headers into rows', () => {
    const t = parseDelimitedText(DEG_CSV, 'deg');
    expect(t.headers).toEqual(['gene_id', 'gene_name', 'log2FoldChange', 'padj']);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0].gene_name).toBe('TP53');
  });

  it('auto-detects tab delimiter', () => {
    const t = parseDelimitedText(METAB_TSV, 'metab');
    expect(t.headers).toContain('metabolite_name');
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1].metabolite_name).toBe('Pyruvate');
  });
});

describe('detectColumns', () => {
  it('maps DEG columns correctly', () => {
    const t = parseDelimitedText(DEG_CSV, 'deg');
    const m = detectColumns(t);
    expect(m.identifier).toBe('gene_id');
    expect(m.label).toBe('gene_name');
    expect(m.effectSize).toBe('log2FoldChange');
    expect(m.significance).toBe('padj');
  });

  it('maps DMR genomic-context columns', () => {
    const t = parseDelimitedText(DMR_CSV, 'dmr');
    const m = detectColumns(t);
    expect(m.dmrId).toBe('DMR_id');
    expect(m.chromosome).toBe('chromosome');
    expect(m.start).toBe('start');
    expect(m.end).toBe('end');
    expect(m.nearestGene).toBe('nearest_gene');
    expect(m.effectSize).toBe('delta_methylation');
    expect(m.significance).toBe('qvalue');
  });

  it('falls back to value inspection when no header match', () => {
    const csv = `col_a,col_b\nENSG00000141510,foo\nENSG00000012048,bar`;
    const t = parseDelimitedText(csv);
    const m = detectColumns(t);
    expect(m.identifier).toBe('col_a');
  });

  it('collects annotation columns', () => {
    const csv = `gene_id,GO_terms,KEGG_pathway,log2FoldChange\nTP53,GO:0006915,hsa04115,1.2`;
    const t = parseDelimitedText(csv);
    const m = detectColumns(t);
    expect(m.annotationColumns).toContain('GO_terms');
    expect(m.annotationColumns).toContain('KEGG_pathway');
  });
});

describe('detectDataType', () => {
  it('detects DEG', () => {
    const t = parseDelimitedText(DEG_CSV);
    expect(detectDataType(t, detectColumns(t))).toBe('deg');
  });
  it('detects DMR', () => {
    const t = parseDelimitedText(DMR_CSV);
    expect(detectDataType(t, detectColumns(t))).toBe('dmr');
  });
  it('detects metabolomics', () => {
    const t = parseDelimitedText(METAB_TSV);
    expect(detectDataType(t, detectColumns(t))).toBe('metabolomics');
  });
  it('detects multiomics from an omics-layer column', () => {
    const csv = `gene_id,omics_type,log2FoldChange\nTP53,rna,1.2\nCHEBI:16947,metabolite,0.5`;
    const t = parseDelimitedText(csv);
    expect(detectDataType(t, detectColumns(t))).toBe('multiomics');
  });
});

describe('toInputRecords', () => {
  it('assigns stable row ids', () => {
    const t = parseDelimitedText(DEG_CSV, 'deg');
    const recs = toInputRecords(t);
    expect(recs[0].rowId).toBe('deg:0');
    expect(recs[2].rowId).toBe('deg:2');
    expect(recs[0].sourceTable).toBe('deg');
  });
});
