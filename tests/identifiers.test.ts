import { describe, it, expect } from 'vitest';
import {
  detectIdentifierType,
  normalizeIdentifier,
  isMetaboliteType,
  isGeneProteinType,
  externalLink,
} from '../src/lib/identifiers';

describe('detectIdentifierType', () => {
  it('detects UniProt accessions', () => {
    expect(detectIdentifierType('P04637')).toBe('uniprot');
    expect(detectIdentifierType('Q9Y6K9')).toBe('uniprot');
    expect(detectIdentifierType('A0A1B2C3D4')).toBe('uniprot');
  });

  it('detects Ensembl ids with and without version', () => {
    expect(detectIdentifierType('ENSG00000141510')).toBe('ensembl');
    expect(detectIdentifierType('ENSG00000141510.11')).toBe('ensembl');
    expect(detectIdentifierType('ENSDARG00000019949')).toBe('ensembl');
  });

  it('detects NCBI gene ids (pure digits)', () => {
    expect(detectIdentifierType('7157')).toBe('ncbi_gene');
  });

  it('detects ChEBI, HMDB, KEGG compound, KO, EC, PubChem', () => {
    expect(detectIdentifierType('CHEBI:16947')).toBe('chebi');
    expect(detectIdentifierType('HMDB0000122')).toBe('hmdb');
    expect(detectIdentifierType('C00031')).toBe('kegg_compound');
    expect(detectIdentifierType('K00844')).toBe('ko');
    expect(detectIdentifierType('EC 1.1.1.1')).toBe('ec');
    expect(detectIdentifierType('2.7.11.1')).toBe('ec');
    expect(detectIdentifierType('CID5793')).toBe('pubchem');
  });

  it('detects Reactome and WikiPathways ids', () => {
    expect(detectIdentifierType('R-HSA-611105')).toBe('reactome');
    expect(detectIdentifierType('WP78')).toBe('wikipathways');
  });

  it('falls back to gene_symbol for short alphanumeric tokens', () => {
    expect(detectIdentifierType('TP53')).toBe('gene_symbol');
    expect(detectIdentifierType('sod2')).toBe('gene_symbol');
    expect(detectIdentifierType('HSP90AA1')).toBe('gene_symbol');
  });

  it('returns unknown for empty or unrecognizable input', () => {
    expect(detectIdentifierType('')).toBe('unknown');
    expect(detectIdentifierType('   ')).toBe('unknown');
    expect(detectIdentifierType('this is a sentence with spaces')).toBe('unknown');
  });
});

describe('normalizeIdentifier', () => {
  it('uppercases gene symbols', () => {
    expect(normalizeIdentifier('tp53')).toBe('TP53');
  });
  it('strips Ensembl version suffix', () => {
    expect(normalizeIdentifier('ENSG00000141510.11')).toBe('ENSG00000141510');
  });
  it('normalizes ChEBI to canonical uppercase form', () => {
    expect(normalizeIdentifier('chebi:16947')).toBe('CHEBI:16947');
  });
  it('normalizes PubChem to CID-prefixed form', () => {
    expect(normalizeIdentifier('PubChem:5793')).toBe('CID5793');
  });
  it('strips EC prefix', () => {
    expect(normalizeIdentifier('EC 1.1.1.1')).toBe('1.1.1.1');
  });
  it('returns empty for empty input', () => {
    expect(normalizeIdentifier('')).toBe('');
  });
});

describe('type predicates', () => {
  it('classifies metabolite types', () => {
    expect(isMetaboliteType('chebi')).toBe(true);
    expect(isMetaboliteType('hmdb')).toBe(true);
    expect(isMetaboliteType('gene_symbol')).toBe(false);
  });
  it('classifies gene/protein types', () => {
    expect(isGeneProteinType('uniprot')).toBe(true);
    expect(isGeneProteinType('gene_symbol')).toBe(true);
    expect(isGeneProteinType('chebi')).toBe(false);
  });
});

describe('externalLink', () => {
  it('builds resolver URLs for supported types', () => {
    expect(externalLink('uniprot', 'P04637')).toContain('uniprot.org');
    expect(externalLink('ncbi_gene', '7157')).toContain('ncbi.nlm.nih.gov/gene/7157');
    expect(externalLink('chebi', 'CHEBI:16947')).toContain('ebi.ac.uk/chebi');
    expect(externalLink('reactome', 'R-HSA-611105')).toContain('reactome.org');
  });
  it('strips CID prefix for PubChem links', () => {
    expect(externalLink('pubchem', 'CID5793')).toContain('/compound/5793');
  });
  it('returns null for unknown', () => {
    expect(externalLink('unknown', 'x')).toBeNull();
  });
});
