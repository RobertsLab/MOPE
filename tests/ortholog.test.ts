import { describe, it, expect } from 'vitest';
import { buildOrthologIndex, lookupOrthologs, isOneToMany, isDistantReference } from '../src/lib/ortholog';

const rows = [
  { source: 'CGI_A', reference: 'TP53', conf: 'high' },
  { source: 'CGI_B', reference: 'SOD2', conf: 'high' },
  { source: 'CGI_B', reference: 'SOD1', conf: 'low' }, // one-to-many
  { source: 'CGI_C', reference: 'TP53', conf: 'medium' }, // many-to-one on TP53
];

const mapping = { sourceCol: 'source', referenceCol: 'reference', confidenceCol: 'conf' };

describe('buildOrthologIndex + cardinality', () => {
  const idx = buildOrthologIndex(rows, mapping);

  it('resolves a one-to-one mapping', () => {
    const rels = lookupOrthologs(idx, 'CGI_A');
    // CGI_A -> TP53, but TP53 is also hit by CGI_C => many2one
    expect(rels).toHaveLength(1);
    expect(rels[0].referenceId).toBe('TP53');
    expect(rels[0].relationship).toBe('many2one');
  });

  it('flags one-to-many source mappings', () => {
    expect(isOneToMany(idx, 'CGI_B')).toBe(true);
    const rels = lookupOrthologs(idx, 'CGI_B');
    expect(rels).toHaveLength(2);
    const refs = rels.map((r) => r.referenceId).sort();
    expect(refs).toEqual(['SOD1', 'SOD2']);
    expect(rels.every((r) => r.relationship === 'one2many')).toBe(true);
  });

  it('detects many-to-one on a shared reference', () => {
    const relsA = lookupOrthologs(idx, 'CGI_A');
    const relsC = lookupOrthologs(idx, 'CGI_C');
    expect(relsA[0].relationship).toBe('many2one');
    expect(relsC[0].relationship).toBe('many2one');
  });

  it('preserves confidence values', () => {
    const rels = lookupOrthologs(idx, 'CGI_B');
    const sod1 = rels.find((r) => r.referenceId === 'SOD1');
    expect(sod1?.confidence).toBe('low');
  });

  it('returns empty for unknown source', () => {
    expect(lookupOrthologs(idx, 'NOPE')).toEqual([]);
  });

  it('ignores rows with missing source or reference', () => {
    const idx2 = buildOrthologIndex(
      [{ source: '', reference: 'TP53', conf: '' }, { source: 'X', reference: '', conf: '' }],
      mapping,
    );
    expect(idx2.forward.size).toBe(0);
  });
});

describe('isDistantReference', () => {
  it('flags mollusc mapped to mammal as distant', () => {
    expect(isDistantReference('Crassostrea gigas', 'Homo sapiens')).toBe(true);
  });
  it('does not flag same tax group', () => {
    expect(isDistantReference('Crassostrea gigas', 'Crassostrea virginica')).toBe(false);
  });
  it('does not flag zebrafish to human (near pair)', () => {
    expect(isDistantReference('Danio rerio', 'Homo sapiens')).toBe(false);
  });
  it('does not assert distance for unknown organisms', () => {
    expect(isDistantReference('Unknownus fakus', 'Homo sapiens')).toBe(false);
  });
  it('returns false when no reference given', () => {
    expect(isDistantReference('Crassostrea gigas', null)).toBe(false);
  });
});
