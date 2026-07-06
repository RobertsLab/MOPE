/**
 * Bundled demo dataset and demo session. Loaded entirely client-side so the
 * app is fully functional offline. The demo is a Pacific-oyster-style
 * differential expression table whose feature labels are reference (human)
 * gene symbols present in the curated pathway library, so it maps to
 * pathways out of the box.
 */
import type { ParsedTable } from '../lib/parse';
import type { SessionFile } from '../types/model';
import { APP_VERSION } from '../types/model';

/** A compact multi-omics demo table (long format with an omics_type column). */
export const DEMO_TABLE: ParsedTable = {
  name: 'demo_multiomics',
  headers: ['feature_id', 'feature_name', 'omics_type', 'log2FoldChange', 'padj'],
  rows: [
    // RNA
    rna('TP53', 1.9, 0.0008), rna('BAX', 2.3, 0.0002), rna('BCL2', -1.8, 0.004),
    rna('CASP3', 1.6, 0.006), rna('SOD2', 2.1, 0.0009), rna('CAT', 1.2, 0.03),
    rna('NFE2L2', 1.7, 0.002), rna('HMOX1', 2.6, 0.0001), rna('HSPA1A', 2.9, 0.00005),
    rna('HSF1', 1.1, 0.04), rna('HIF1A', 1.4, 0.01), rna('VEGFA', 1.9, 0.003),
    rna('TLR4', 1.3, 0.02), rna('NFKB1', 1.8, 0.001), rna('IL6', 2.4, 0.0004),
    rna('TNF', 2.0, 0.0007), rna('MAPK1', 0.9, 0.06), rna('AKT1', -1.2, 0.02),
    rna('CCND1', 1.5, 0.008), rna('CDK1', 1.7, 0.002), rna('DNMT1', -1.6, 0.005),
    rna('EZH2', 1.3, 0.02), rna('CS', 0.8, 0.09), rna('LDHA', 2.2, 0.0005),
    // Methylation (delta beta as effect size)
    meth('DNMT1', 0.32, 0.001), meth('TET2', -0.28, 0.004), meth('MECP2', 0.21, 0.02),
    meth('HDAC1', 0.18, 0.03), meth('TP53', -0.25, 0.006), meth('SOD2', -0.3, 0.002),
    meth('HMOX1', -0.22, 0.01), meth('VEGFA', 0.19, 0.04),
    // Protein
    prot('SOD2', 1.4, 0.003), prot('CAT', 1.1, 0.02), prot('HSPA1A', 2.2, 0.0006),
    prot('TP53', 1.0, 0.04), prot('CASP3', 1.3, 0.01),
    // Metabolite
    metab('CHEBI:16947', 'Citrate', 1.2, 0.01), metab('CHEBI:15361', 'Pyruvate', -0.9, 0.03),
    metab('CHEBI:16856', 'Glutathione', 1.8, 0.002), metab('CHEBI:16240', 'Hydrogen peroxide', 2.1, 0.0008),
    metab('CHEBI:15414', 'S-Adenosylmethionine', -1.1, 0.02),
  ],
};

function row(id: string, name: string, layer: string, lfc: number, padj: number): Record<string, string> {
  return { feature_id: id, feature_name: name, omics_type: layer, log2FoldChange: String(lfc), padj: String(padj) };
}
function rna(sym: string, lfc: number, padj: number) { return row(`ENSG_${sym}`, sym, 'rna', lfc, padj); }
function meth(sym: string, lfc: number, padj: number) { return row(`DMR_${sym}`, sym, 'methylation', lfc, padj); }
function prot(sym: string, lfc: number, padj: number) { return row(`PROT_${sym}`, sym, 'protein', lfc, padj); }
function metab(id: string, name: string, lfc: number, padj: number) { return row(id, name, 'metabolite', lfc, padj); }

/** Demo session settings matching the demo table. */
export const DEMO_SESSION: SessionFile = {
  appVersion: APP_VERSION,
  generatedAt: '2024-01-01T00:00:00.000Z',
  columnMapping: {
    identifier: 'feature_id', label: 'feature_name', effectSize: 'log2FoldChange',
    significance: 'padj', direction: null, omicsLayer: 'omics_type', chromosome: null,
    start: null, end: null, nearestGene: null, dmrId: null, annotationColumns: [],
  },
  thresholds: { significanceThreshold: 0.05, effectSizeThreshold: 0, smallerIsStronger: true, filterBeforeMapping: false },
  species: { mode: 'ortholog_reference', studySpecies: 'Crassostrea gigas', referenceSpecies: 'Homo sapiens', distantReference: false },
  dataType: 'multiomics',
  pathwaySource: 'all',
  selectedPathwayId: 'WP408',
  visualization: {
    pathwayId: 'WP408', styleMode: 'multiomics', hideUnmapped: false, showLegend: true,
    activeLayers: ['rna', 'methylation', 'protein', 'metabolite', 'generic'], zoom: 1, panX: 0, panY: 0,
    selectedNodeId: null, colorblindSafe: true,
  },
  tableNames: ['demo_multiomics'],
};
