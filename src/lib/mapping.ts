/**
 * Core mapping engine.
 *
 * Attaches normalized user features to pathway entities in the curated
 * library via (a) direct identifier matching and (b) ortholog-mediated
 * matching through a user-supplied ortholog index. Produces MappingEvidence,
 * a MappingSummary, and per-feature audit rows. Ambiguity (one-to-many) is
 * preserved and flagged, never silently collapsed.
 */
import type {
  MappingAuditRow,
  MappingEvidence,
  MappingSummary,
  MappingType,
  NormalizedEntity,
  Pathway,
  PathwayEntity,
  IdentifierType,
} from '../types/model';
import type { OrthologIndex } from './ortholog';
import { normalizeIdentifier } from './identifiers';

export interface MappingInput {
  entities: NormalizedEntity[];
  pathways: Pathway[];
  /** Present in ortholog-reference / user-table modes. */
  orthologIndex?: OrthologIndex | null;
  /** 'direct' | 'ortholog_reference' | 'user_ortholog_table'. */
  mode: 'direct' | 'ortholog_reference' | 'user_ortholog_table';
}

export interface MappingResult {
  evidence: MappingEvidence[];
  summary: MappingSummary;
  audit: MappingAuditRow[];
  /** entity rowId -> pathway ids matched (for quick scoring lookups). */
  entityPathways: Map<string, Set<string>>;
  /** pathwayNodeId key `${pathwayId}::${nodeId}` -> matched entity rowIds. */
  nodeMatches: Map<string, string[]>;
}

/**
 * Builds a lookup from every matchable pathway-entity xref to its
 * (pathway, entity) locations. Keys are `${type}:${normalizedValue}`.
 */
function buildEntityXrefIndex(pathways: Pathway[]): Map<string, Array<{ pathway: Pathway; entity: PathwayEntity }>> {
  const idx = new Map<string, Array<{ pathway: Pathway; entity: PathwayEntity }>>();
  for (const pathway of pathways) {
    for (const entity of pathway.entities) {
      for (const [type, values] of Object.entries(entity.xrefs)) {
        for (const v of values ?? []) {
          const key = `${type}:${normalizeIdentifier(v, type as IdentifierType)}`;
          if (!idx.has(key)) idx.set(key, []);
          idx.get(key)!.push({ pathway, entity });
        }
      }
    }
  }
  return idx;
}

/** All candidate xref keys a normalized entity could match directly. */
function directKeys(entity: NormalizedEntity): string[] {
  const keys: string[] = [`${entity.identifierType}:${entity.normalizedId}`];
  // Gene symbols and label also matched as gene_symbol / metabolite_name.
  if (entity.identifierType === 'gene_symbol') {
    keys.push(`gene_symbol:${entity.normalizedId}`);
  }
  if (entity.label) {
    keys.push(`metabolite_name:${entity.label.toUpperCase()}`);
    keys.push(`gene_symbol:${entity.label.toUpperCase()}`);
  }
  return Array.from(new Set(keys));
}

export function runMapping(input: MappingInput): MappingResult {
  const { entities, pathways, orthologIndex, mode } = input;
  const xrefIndex = buildEntityXrefIndex(pathways);

  const evidence: MappingEvidence[] = [];
  const entityPathways = new Map<string, Set<string>>();
  const nodeMatches = new Map<string, string[]>();
  const audit: MappingAuditRow[] = [];

  const idTypeCounts: Record<string, number> = {};
  let recognized = 0;
  let mappedDirect = 0;
  let mappedOrthology = 0;
  let oneToManyCount = 0;
  let unmapped = 0;
  let excluded = 0;

  const addEvidence = (
    entity: NormalizedEntity,
    hit: { pathway: Pathway; entity: PathwayEntity },
    mappingType: MappingType,
    matchedVia: string[],
    oneToMany: boolean,
    note: string | null,
  ) => {
    evidence.push({
      entityRowId: entity.rowId,
      pathwayId: hit.pathway.id,
      pathwayNodeId: hit.entity.nodeId,
      mappingType,
      matchedVia,
      oneToMany,
      confidenceNote: note,
    });
    if (!entityPathways.has(entity.rowId)) entityPathways.set(entity.rowId, new Set());
    entityPathways.get(entity.rowId)!.add(hit.pathway.id);
    const nk = `${hit.pathway.id}::${hit.entity.nodeId}`;
    if (!nodeMatches.has(nk)) nodeMatches.set(nk, []);
    if (!nodeMatches.get(nk)!.includes(entity.rowId)) nodeMatches.get(nk)!.push(entity.rowId);
  };

  for (const entity of entities) {
    idTypeCounts[entity.identifierType] = (idTypeCounts[entity.identifierType] ?? 0) + 1;

    if (entity.filteredOut) {
      excluded++;
      audit.push(auditRow(entity, false, 'unmapped', null, false, 0, 'Excluded by pre-mapping filter'));
      continue;
    }

    if (entity.identifierType !== 'unknown') recognized++;

    // --- Direct matching ---
    const seenPathways = new Set<string>();
    let directHitCount = 0;
    for (const key of directKeys(entity)) {
      const hits = xrefIndex.get(key);
      if (!hits) continue;
      for (const hit of hits) {
        const pkNode = `${hit.pathway.id}::${hit.entity.nodeId}`;
        if (seenPathways.has(pkNode)) continue;
        seenPathways.add(pkNode);
        addEvidence(entity, hit, 'direct', [entity.identifier], false, null);
        directHitCount++;
      }
    }

    // --- Ortholog-mediated matching ---
    let orthoHitCount = 0;
    let usedOrtholog = false;
    let oneToManyFlag = false;
    let referenceIdForAudit: string | null = null;
    if ((mode === 'ortholog_reference' || mode === 'user_ortholog_table') && orthologIndex) {
      const rels = orthologIndex.forward.get(entity.normalizedId) ?? [];
      if (rels.length > 1) oneToManyFlag = true;
      for (const rel of rels) {
        referenceIdForAudit = referenceIdForAudit ?? rel.referenceId;
        const refKeys = [
          `${rel.referenceType}:${rel.referenceId}`,
          `gene_symbol:${rel.referenceId}`,
        ];
        for (const key of refKeys) {
          const hits = xrefIndex.get(key);
          if (!hits) continue;
          for (const hit of hits) {
            const pkNode = `${hit.pathway.id}::${hit.entity.nodeId}`;
            if (seenPathways.has(pkNode)) continue;
            seenPathways.add(pkNode);
            const ambiguous = rel.relationship === 'one2many' || rel.relationship === 'many2many';
            addEvidence(
              entity,
              hit,
              ambiguous ? 'ambiguous' : 'orthology',
              [entity.identifier, rel.referenceId],
              rel.relationship === 'one2many' || rel.relationship === 'many2many',
              rel.confidence ? `orthology confidence: ${rel.confidence}` : `orthology (${rel.relationship})`,
            );
            orthoHitCount++;
            usedOrtholog = true;
          }
        }
      }
    }

    const totalHits = directHitCount + orthoHitCount;
    const matchedPathwayCount = entityPathways.get(entity.rowId)?.size ?? 0;

    if (totalHits === 0) {
      unmapped++;
      audit.push(auditRow(entity, false, 'unmapped', referenceIdForAudit, oneToManyFlag, 0, null));
      continue;
    }

    if (directHitCount > 0) mappedDirect++;
    else if (usedOrtholog) mappedOrthology++;

    if (oneToManyFlag) oneToManyCount++;

    const mappingType: MappingType = directHitCount > 0 ? 'direct' : usedOrtholog ? (oneToManyFlag ? 'ambiguous' : 'orthology') : 'inferred';
    audit.push(
      auditRow(entity, true, mappingType, referenceIdForAudit, oneToManyFlag, matchedPathwayCount, null),
    );
  }

  const mappedTotal = mappedDirect + mappedOrthology;
  const summary: MappingSummary = {
    totalUploaded: entities.length,
    recognized,
    mappedDirect,
    mappedOrthology,
    oneToMany: oneToManyCount,
    unmapped,
    excludedByFilter: excluded,
    identifierTypes: idTypeCounts,
    orthologyFraction: mappedTotal > 0 ? mappedOrthology / mappedTotal : 0,
  };

  return { evidence, summary, audit, entityPathways, nodeMatches };
}

function auditRow(
  entity: NormalizedEntity,
  mapped: boolean,
  mappingType: MappingType | 'unmapped',
  referenceId: string | null,
  oneToMany: boolean,
  matchedPathways: number,
  note: string | null,
): MappingAuditRow {
  return {
    rowId: entity.rowId,
    identifier: entity.identifier,
    identifierType: entity.identifierType,
    label: entity.label,
    omicsLayer: entity.omicsLayer,
    mapped,
    mappingType,
    referenceId,
    oneToMany,
    matchedPathways,
    filteredOut: entity.filteredOut,
    note,
  };
}
