/**
 * Resolves, for a given pathway, which user entities map to each pathway node
 * and derives a per-node aggregate used for styling and the side panel.
 */
import type { MappingResult } from './mapping';
import type { NormalizedEntity, Pathway, PathwayEntity, MappingType, OmicsLayer } from '../types/model';

export interface NodeDatum {
  entity: PathwayEntity;
  /** All user entities mapped to this node. */
  matched: NormalizedEntity[];
  /** Representative entity chosen for single-value styling (most significant). */
  representative: NormalizedEntity | null;
  mappingTypes: MappingType[];
  /** Per-layer representative entity, for multi-omics split rendering. */
  byLayer: Partial<Record<OmicsLayer, NormalizedEntity>>;
}

export function buildNodeData(
  pathway: Pathway,
  entities: NormalizedEntity[],
  mapping: MappingResult,
): Map<string, NodeDatum> {
  const byRow = new Map(entities.map((e) => [e.rowId, e]));
  const result = new Map<string, NodeDatum>();

  for (const entity of pathway.entities) {
    const nk = `${pathway.id}::${entity.nodeId}`;
    const rowIds = mapping.nodeMatches.get(nk) ?? [];
    const matched = rowIds.map((r) => byRow.get(r)).filter((e): e is NormalizedEntity => !!e);
    const mappingTypes = mapping.evidence
      .filter((ev) => ev.pathwayId === pathway.id && ev.pathwayNodeId === entity.nodeId)
      .map((ev) => ev.mappingType);

    // Representative = significant with largest |effect|, else largest |effect|, else first.
    const representative = pickRepresentative(matched);

    const byLayer: Partial<Record<OmicsLayer, NormalizedEntity>> = {};
    for (const e of matched) {
      const cur = byLayer[e.omicsLayer];
      if (!cur || score(e) > score(cur)) byLayer[e.omicsLayer] = e;
    }

    result.set(entity.nodeId, { entity, matched, representative, mappingTypes, byLayer });
  }
  return result;
}

function score(e: NormalizedEntity): number {
  const mag = e.effectSize == null ? 0 : Math.abs(e.effectSize);
  return (e.significant ? 1000 : 0) + mag;
}

function pickRepresentative(matched: NormalizedEntity[]): NormalizedEntity | null {
  if (!matched.length) return null;
  return matched.reduce((best, e) => (score(e) > score(best) ? e : best), matched[0]);
}

/** Max absolute effect size across matched entities in a pathway (for color scaling). */
export function maxAbsEffect(nodeData: Map<string, NodeDatum>): number {
  let max = 0;
  nodeData.forEach((nd) => {
    for (const e of nd.matched) {
      if (e.effectSize != null) max = Math.max(max, Math.abs(e.effectSize));
    }
  });
  return max || 1;
}
