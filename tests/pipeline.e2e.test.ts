import { describe, it, expect } from 'vitest';
import { DEMO_TABLE, DEMO_SESSION } from '../src/data/demo';
import { toInputRecords } from '../src/lib/parse';
import { normalizeRecords } from '../src/lib/normalize';
import { runMapping } from '../src/lib/mapping';
import { scorePathways, backgroundFromEntities } from '../src/lib/enrichment';
import { generateWarnings } from '../src/lib/warnings';
import { allPathways } from '../src/data/pathwayLibrary';

describe('end-to-end demo pipeline', () => {
  const recs = toInputRecords(DEMO_TABLE);
  const entities = normalizeRecords(recs, { mapping: DEMO_SESSION.columnMapping, thresholds: DEMO_SESSION.thresholds, dataType: 'multiomics' });
  const pathways = allPathways();
  const mapping = runMapping({ entities, pathways, mode: 'direct' });

  it('normalizes all demo rows', () => {
    expect(entities.length).toBe(DEMO_TABLE.rows.length);
  });
  it('detects multiple omics layers', () => {
    const layers = new Set(entities.map((e) => e.omicsLayer));
    expect(layers.size).toBeGreaterThan(2);
  });
  it('maps a meaningful fraction of features', () => {
    const mapped = mapping.summary.mappedDirect + mapping.summary.mappedOrthology;
    expect(mapped).toBeGreaterThan(20);
  });
  it('ranks pathways', () => {
    const { scores, mode } = scorePathways({ entities, pathways, mapping, background: null });
    expect(scores.length).toBeGreaterThan(3);
    expect(mode).toBe('mapping_summary');
    // top pathway should have matched features
    expect(scores[0].matchedFeatures).toBeGreaterThan(0);
  });
  it('switches to enrichment with a background', () => {
    const bg = backgroundFromEntities(entities);
    // pad background so it exceeds mapped set
    for (let i = 0; i < 500; i++) bg.add(`BG_${i}`);
    const { mode, scores } = scorePathways({ entities, pathways, mapping, background: bg });
    expect(mode).toBe('enrichment');
    expect(scores[0].pValue).not.toBeNull();
    expect(scores[0].qValue).not.toBeNull();
  });
  it('generates transparency warnings (no-background note present)', () => {
    const { scores, mode } = scorePathways({ entities, pathways, mapping, background: null });
    const warnings = generateWarnings({ summary: mapping.summary, entities, species: DEMO_SESSION.species, scores, mode });
    expect(warnings.some((w) => w.id === 'no_background')).toBe(true);
  });
});
