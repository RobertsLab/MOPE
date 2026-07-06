/**
 * Transparency warnings.
 *
 * Generates the caution/warning messages the spec requires so uncertainty is
 * always visible. Every threshold is explicit and documented. Warnings never
 * block analysis; they annotate it.
 */
import type {
  AnalysisMode,
  MappingSummary,
  NormalizedEntity,
  PathwayScore,
  SpeciesSettings,
  TransparencyWarning,
} from '../types/model';

export interface WarningContext {
  summary: MappingSummary;
  entities: NormalizedEntity[];
  species: SpeciesSettings;
  scores: PathwayScore[];
  mode: AnalysisMode;
}

export function generateWarnings(ctx: WarningContext): TransparencyWarning[] {
  const w: TransparencyWarning[] = [];
  const { summary, entities, species, scores, mode } = ctx;
  const mappedTotal = summary.mappedDirect + summary.mappedOrthology;

  // >25% of mapped features rely on orthology.
  if (mappedTotal > 0 && summary.orthologyFraction > 0.25) {
    w.push({
      id: 'orthology_high',
      level: 'warning',
      message: `${Math.round(summary.orthologyFraction * 100)}% of mapped features rely on orthology to a reference organism. Interpret pathway associations as orthology-supported annotations, not direct evidence.`,
    });
  }

  // Many one-to-many mappings.
  if (mappedTotal > 0 && summary.oneToMany / mappedTotal > 0.2) {
    w.push({
      id: 'one_to_many_high',
      level: 'caution',
      message: `${summary.oneToMany} source identifiers map to multiple reference genes. Ambiguous mappings are flagged in the audit table and may inflate pathway representation.`,
    });
  }

  // Large proportion unmapped.
  const unmappedFrac = summary.totalUploaded ? summary.unmapped / summary.totalUploaded : 0;
  if (unmappedFrac > 0.5) {
    w.push({
      id: 'unmapped_high',
      level: 'warning',
      message: `${Math.round(unmappedFrac * 100)}% of uploaded features could not be mapped to a pathway entity. Consider mapping identifiers to stable IDs or supplying an ortholog table.`,
    });
  }

  // Enrichment without a background universe.
  if (mode === 'mapping_summary' && scores.length > 0) {
    w.push({
      id: 'no_background',
      level: 'caution',
      message: 'No background universe was provided. Results are reported as a mapping summary, not a statistical enrichment analysis. p-values are not computed.',
    });
  }

  // Mixed species identifiers (multiple Ensembl species prefixes).
  const ensPrefixes = new Set<string>();
  for (const e of entities) {
    if (e.identifierType === 'ensembl') {
      const m = e.normalizedId.match(/^ENS([A-Z]{0,4})[GTP]/);
      if (m) ensPrefixes.add(m[1] || 'HS');
    }
  }
  if (ensPrefixes.size > 1) {
    w.push({
      id: 'mixed_species',
      level: 'warning',
      message: `Ensembl identifiers from ${ensPrefixes.size} different species prefixes were detected. Uploaded identifiers may be mixed across species.`,
    });
  }

  // Ambiguous gene symbols (very short symbols).
  const shortSymbols = entities.filter(
    (e) => e.identifierType === 'gene_symbol' && e.normalizedId.length <= 2,
  ).length;
  if (shortSymbols > 0) {
    w.push({
      id: 'ambiguous_symbols',
      level: 'caution',
      message: `${shortSymbols} very short gene symbols were detected. Short symbols are frequently ambiguous across species and databases.`,
    });
  }

  // Metabolites mapped by name only.
  const nameOnlyMetabolites = entities.filter(
    (e) => e.omicsLayer === 'metabolite' && e.identifierType !== 'chebi' && e.identifierType !== 'hmdb' && e.identifierType !== 'kegg_compound' && e.identifierType !== 'pubchem',
  ).length;
  if (nameOnlyMetabolites > 0) {
    w.push({
      id: 'name_only_metabolites',
      level: 'caution',
      message: `${nameOnlyMetabolites} metabolites appear to be mapped by name only. Name-based metabolite matching is lower confidence than ChEBI/HMDB/KEGG identifiers.`,
    });
  }

  // DMR proximity assignment.
  const dmrProximity = entities.filter((e) => e.dmr && e.dmr.linkMethod === 'nearest_gene').length;
  if (dmrProximity > 0) {
    w.push({
      id: 'dmr_proximity',
      level: 'caution',
      message: `${dmrProximity} differentially methylated regions were assigned to genes by proximity. DMR-to-gene associations are inferred and are not equivalent to direct gene-expression evidence.`,
    });
  }

  // Pathways with only 1-2 matched entities.
  const thinPathways = scores.filter((s) => s.matchedFeatures <= 2).length;
  if (thinPathways > 0) {
    w.push({
      id: 'thin_pathways',
      level: 'caution',
      message: `${thinPathways} pathways matched only one or two entities. Such matches are weak candidate associations and require biological validation.`,
    });
  }

  // Distant reference species.
  if (species.distantReference) {
    w.push({
      id: 'distant_reference',
      level: 'warning',
      message: `The reference organism appears evolutionarily distant from the study species. Orthology-based mappings may be unreliable; treat pathway associations as candidate patterns requiring validation.`,
    });
  }

  return w;
}
