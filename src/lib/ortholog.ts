/**
 * Ortholog handling.
 *
 * Builds an {@link OrthologIndex} from a user-supplied ortholog table and
 * exposes lookups that resolve a study-organism identifier to one or more
 * reference-organism identifiers, preserving one-to-many / many-to-one
 * cardinality. Ambiguity is never hidden: every mapping carries its
 * cardinality and the full set of reference targets.
 */
import type {
  OrthologRelationship,
  OrthologyCardinality,
  IdentifierType,
} from '../types/model';
import { detectIdentifierType, normalizeIdentifier } from './identifiers';
import { taxGroupOf, type TaxGroup } from '../data/species';

export interface OrthologTableMapping {
  sourceCol: string;
  referenceCol: string;
  confidenceCol: string | null;
}

export interface OrthologIndex {
  /** normalized source id -> reference relationships. */
  forward: Map<string, OrthologRelationship[]>;
  /** normalized reference id -> count of distinct sources (for many2one). */
  reverseCounts: Map<string, number>;
  sourceType: IdentifierType;
  referenceType: IdentifierType;
}

/**
 * Builds an ortholog index from parsed rows and a column mapping.
 * Cardinality is computed globally: a source with >1 distinct reference is
 * one2many; a reference hit by >1 distinct source is many2one; both => many2many.
 */
export function buildOrthologIndex(
  rows: Record<string, string>[],
  mapping: OrthologTableMapping,
): OrthologIndex {
  const forwardRaw = new Map<string, Set<string>>();
  const reverseRaw = new Map<string, Set<string>>();
  const confidences = new Map<string, string>();

  let sourceType: IdentifierType = 'unknown';
  let referenceType: IdentifierType = 'unknown';

  for (const row of rows) {
    const src = (row[mapping.sourceCol] ?? '').trim();
    const ref = (row[mapping.referenceCol] ?? '').trim();
    if (!src || !ref) continue;

    if (sourceType === 'unknown') sourceType = detectIdentifierType(src);
    if (referenceType === 'unknown') referenceType = detectIdentifierType(ref);

    const nSrc = normalizeIdentifier(src, detectIdentifierType(src));
    const nRef = normalizeIdentifier(ref, detectIdentifierType(ref));

    if (!forwardRaw.has(nSrc)) forwardRaw.set(nSrc, new Set());
    forwardRaw.get(nSrc)!.add(nRef);
    if (!reverseRaw.has(nRef)) reverseRaw.set(nRef, new Set());
    reverseRaw.get(nRef)!.add(nSrc);

    if (mapping.confidenceCol) {
      const c = (row[mapping.confidenceCol] ?? '').trim();
      if (c) confidences.set(`${nSrc}|${nRef}`, c);
    }
  }

  const forward = new Map<string, OrthologRelationship[]>();
  const reverseCounts = new Map<string, number>();
  reverseRaw.forEach((srcs, ref) => reverseCounts.set(ref, srcs.size));

  forwardRaw.forEach((refs, src) => {
    const srcIsMany = refs.size > 1;
    const rels: OrthologRelationship[] = [];
    refs.forEach((ref) => {
      const refFanIn = reverseRaw.get(ref)?.size ?? 1;
      const refIsMany = refFanIn > 1;
      const cardinality: OrthologyCardinality = srcIsMany && refIsMany
        ? 'many2many'
        : srcIsMany
          ? 'one2many'
          : refIsMany
            ? 'many2one'
            : 'one2one';
      rels.push({
        sourceId: src,
        sourceType,
        referenceId: ref,
        referenceType,
        confidence: confidences.get(`${src}|${ref}`) ?? null,
        relationship: cardinality,
        provenance: 'user_table',
      });
    });
    forward.set(src, rels);
  });

  return { forward, reverseCounts, sourceType, referenceType };
}

/** Looks up reference relationships for a normalized source id. */
export function lookupOrthologs(index: OrthologIndex, normalizedSourceId: string): OrthologRelationship[] {
  return index.forward.get(normalizedSourceId) ?? [];
}

/** True when a source id maps to more than one reference id. */
export function isOneToMany(index: OrthologIndex, normalizedSourceId: string): boolean {
  return (index.forward.get(normalizedSourceId)?.length ?? 0) > 1;
}

/**
 * Coarse evolutionary-distance heuristic between study and reference organism.
 * Same tax group => near; cross-group combinations of well-separated clades
 * (e.g. mollusc study mapped to mammal reference) => distant. Only used to
 * raise a transparency warning.
 */
const NEAR_PAIRS: Record<TaxGroup, TaxGroup[]> = {
  mammal: ['mammal', 'fish'],
  fish: ['fish', 'mammal'],
  insect: ['insect', 'nematode'],
  nematode: ['nematode', 'insect'],
  echinoderm: ['echinoderm', 'mammal', 'fish'],
  mollusc: ['mollusc'],
  cnidarian: ['cnidarian'],
  other: ['other'],
};

export function isDistantReference(studySpecies: string, referenceSpecies: string | null): boolean {
  if (!referenceSpecies) return false;
  const s = taxGroupOf(studySpecies);
  const r = taxGroupOf(referenceSpecies);
  if (s === 'other' || r === 'other') return false; // unknown => don't assert
  if (s === r) return false;
  return !(NEAR_PAIRS[s] ?? []).includes(r);
}
