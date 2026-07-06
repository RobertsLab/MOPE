/**
 * Derives the full analysis pipeline from store inputs. Pure and memoized:
 * normalized entities -> ortholog index -> mapping -> scoring -> warnings.
 */
import { useMemo } from 'react';
import { useStore } from './store';
import { toInputRecords } from '../lib/parse';
import { normalizeRecords } from '../lib/normalize';
import { buildOrthologIndex, isDistantReference, type OrthologIndex } from '../lib/ortholog';
import { runMapping, type MappingResult } from '../lib/mapping';
import { scorePathways, backgroundFromEntities } from '../lib/enrichment';
import { generateWarnings } from '../lib/warnings';
import { allPathways, pathwaysBySource } from '../data/pathwayLibrary';
import type {
  NormalizedEntity,
  PathwayScore,
  TransparencyWarning,
  AnalysisMode,
  Pathway,
} from '../types/model';

export interface DerivedState {
  entities: NormalizedEntity[];
  orthologIndex: OrthologIndex | null;
  mapping: MappingResult;
  scores: PathwayScore[];
  mode: AnalysisMode;
  warnings: TransparencyWarning[];
  pathways: Pathway[];
}

export function useDerived(): DerivedState {
  const { state } = useStore();

  // 1. Normalize every uploaded table's records.
  const entities = useMemo(() => {
    const all: NormalizedEntity[] = [];
    for (const table of state.tables) {
      const recs = toInputRecords(table);
      all.push(
        ...normalizeRecords(recs, {
          mapping: state.columnMapping,
          thresholds: state.thresholds,
          dataType: state.dataType,
        }),
      );
    }
    return all;
  }, [state.tables, state.columnMapping, state.thresholds, state.dataType]);

  // 2. Build ortholog index if applicable.
  const orthologIndex = useMemo(() => {
    if (state.species.mode === 'direct') return null;
    if (!state.orthologTable || !state.orthologMapping) return null;
    return buildOrthologIndex(state.orthologTable.rows, state.orthologMapping);
  }, [state.species.mode, state.orthologTable, state.orthologMapping]);

  // 3. Select candidate pathways by source.
  const pathways = useMemo(() => {
    if (state.pathwaySource === 'all') return allPathways();
    return pathwaysBySource(state.pathwaySource);
  }, [state.pathwaySource]);

  // 4. Map.
  const mapping = useMemo(
    () => runMapping({ entities, pathways, orthologIndex, mode: state.species.mode }),
    [entities, pathways, orthologIndex, state.species.mode],
  );

  // 5. Score / rank.
  const { scores, mode } = useMemo(() => {
    const background = state.useBackground ? backgroundFromEntities(entities) : null;
    return scorePathways({ entities, pathways, mapping, background });
  }, [entities, pathways, mapping, state.useBackground]);

  // 6. Warnings.
  const warnings = useMemo(() => {
    const species = {
      ...state.species,
      distantReference: isDistantReference(state.species.studySpecies, state.species.referenceSpecies),
    };
    return generateWarnings({ summary: mapping.summary, entities, species, scores, mode });
  }, [mapping.summary, entities, state.species, scores, mode]);

  return { entities, orthologIndex, mapping, scores, mode, warnings, pathways };
}
