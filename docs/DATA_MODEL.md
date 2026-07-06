# Marine Pathway Mapper — Data Model

This document describes the internal data model, the transformation pipeline, and
the guarantees the application makes about transparency and provenance. All types
are defined in [`src/types/model.ts`](../src/types/model.ts).

## Design goals

1. **Every value is traceable.** A mapped pathway node can be traced back to the
   uploaded row, the identifier detected, whether the map was direct or
   orthology-mediated, and the reference identifier used.
2. **Ambiguity is never hidden.** One-to-many orthologs, name-only metabolites,
   distant references, and unmapped features are all represented explicitly and
   surfaced in the UI and exports.
3. **Mapping ≠ enrichment.** The model distinguishes a descriptive *mapping
   summary* from a statistical *enrichment analysis*, and never presents the
   former as the latter.

## Pipeline overview

```
raw table(s)                      InputRecord[]        (parse.ts)
   │  detectColumns / detectDataType
   ▼
ColumnMapping + DataType + AnalysisThresholds
   │  normalizeRecords                                 (normalize.ts)
   ▼
NormalizedEntity[]   ── identifier detection ──►       (identifiers.ts)
   │
   │  buildOrthologIndex (if species.mode ≠ direct)    (ortholog.ts)
   ▼
OrthologIndex
   │  runMapping(entities, pathways, orthologIndex)    (mapping.ts)
   ▼
MappingResult { evidence[], summary, audit[], nodeMatches, entityPathways }
   │  scorePathways(entities, pathways, mapping, background?)  (enrichment.ts)
   ▼
PathwayScore[] + AnalysisMode('mapping_summary' | 'enrichment')
   │  generateWarnings                                 (warnings.ts)
   ▼
TransparencyWarning[]
```

The pipeline is pure and memoized in [`src/state/useDerived.ts`](../src/state/useDerived.ts):
identical inputs always produce identical outputs, so exported figures and tables
are reproducible.

## Core records

### InputRecord
A single uploaded row, keyed by a stable `rowId` of the form `"${tableName}:${index}"`.
Preserves the raw cell values so nothing is lost.

### ColumnMapping
Maps table headers to analysis roles: `identifier` (required), `label`,
`effectSize`, `significance`, `direction`, `omicsLayer`, DMR genomic context
(`chromosome`, `start`, `end`, `nearestGene`, `dmrId`), and free `annotationColumns`.
Auto-detected by header-name candidates plus value inspection, always user-editable.

### AnalysisThresholds
`significanceThreshold`, `effectSizeThreshold`, `smallerIsStronger` (true for p/FDR),
and `filterBeforeMapping`. Significance is evaluated, not assumed.

### NormalizedEntity
The canonical unit of analysis:

| field | meaning |
|-------|---------|
| `rowId` | provenance back to the uploaded row |
| `identifier` / `identifierType` | normalized ID and its detected type |
| `label` | human-readable feature name |
| `omicsLayer` | `rna` \| `methylation` \| `protein` \| `metabolite` \| `generic` |
| `effectSize` / `significance` | parsed numeric values (nullable) |
| `direction` | `up` \| `down` \| `none` \| `unknown` |
| `significant` | evaluated against thresholds |
| `dmr` | `DmrContext` when the feature is a methylated region |
| `annotations` | pass-through annotation columns |

### IdentifierType
`uniprot`, `ensembl`, `ncbi_gene`, `gene_symbol`, `chebi`, `hmdb`,
`kegg_compound`, `kegg_gene`, `ko`, `ec`, `pubchem`, `wikipathways`,
`reactome`, `metabolite_name`, `unknown`. Detection rules are ordered so that the
most specific pattern wins (e.g. HMDB before ChEBI). Ensembl version suffixes are
stripped during normalization.

## Orthology

### OrthologRelationship & OrthologyCardinality
An ortholog table row links a `sourceId` to a `referenceId` with an optional
`confidence`. Cardinality (`one2one`, `one2many`, `many2one`, `many2many`,
`unknown`) is computed **globally** across the whole table, so a mapping that is
one-to-many anywhere is flagged everywhere it appears.

### SpeciesSettings & SpeciesMode
`direct` (IDs already supported by the pathway sources), `ortholog_reference`
(map to a reference organism via an ortholog table), or `user_ortholog_table`.
`distantReference` is set when the study and reference organisms are
evolutionarily distant (mollusc → mammal, etc.), which raises a caution.

## Pathways

### Pathway, PathwayEntity, PathwayEdge
A bundled pathway carries its `source` (`wikipathways` | `reactome`), `name`,
`organism`, `categories`, `sourceUrl`, `attribution`, and a list of entities.
Each `PathwayEntity` has a `nodeId`, `label`, `entityType`
(`gene` | `protein` | `metabolite` | `complex`), a set of cross-references
(`xrefs`), and optional normalized layout coordinates `x`/`y` in `[0,1]`.

**Provenance of bundled data.** WikiPathways entities (symbols, Ensembl/Entrez/
UniProt xrefs, and layout coordinates) are derived from WikiPathways pathway
assets. Reactome entities are derived from the Reactome ContentService reference
entities for each pathway. Names and identifiers belong to those sources; see
[SOURCES.md](./SOURCES.md).

### PathwayCategory
Thirteen categories spanning metabolism, energy/amino-acid/lipid metabolism,
oxidative stress, immunity, signal transduction, cell cycle, apoptosis,
reproduction, epigenetic regulation, environmental stress, and disease.

## Mapping results

### MappingEvidence & MappingType
One row per (entity → pathway node) match, tagged `direct`, `orthology`,
`inferred` (e.g. DMR→gene), or `ambiguous` (part of a one-to-many ortholog set).

### MappingSummary
The transparent tally: `totalUploaded`, `recognized`, `mappedDirect`,
`mappedOrthology`, `oneToMany`, `unmapped`, `excludedByFilter`,
`orthologyFraction`, and `identifierTypes` counts. This is what the Mapping
Quality page renders and what the audit CSV/TSV exports.

### MappingAuditRow
One row per uploaded feature, exportable, recording exactly how it was handled —
including features that did **not** map and why.

## Scoring

### PathwayScore & AnalysisMode
`scorePathways` returns a `mode`:

- **`mapping_summary`** — no background universe supplied. Results are descriptive
  counts (matched features, fraction of pathway represented, significant count,
  direction balance, median effect size). **No p-values.**
- **`enrichment`** — a background universe was supplied. Adds a one-sided Fisher's
  exact test `pValue` and Benjamini-Hochberg `qValue`.

`rankScore` is a transparent blend documented in the Docs page and in
[`enrichment.ts`](../src/lib/enrichment.ts): representation fraction, a saturating
significance term, and either enrichment strength (with background) or a
saturating match term (without).

### LayerScore
Per-omics-layer breakdown (matched, significant) so multi-omics pathways report
each layer separately.

## Transparency & warnings

### TransparencyWarning & WarningLevel
`info` | `caution` | `warning`. Generated for heavy orthology reliance,
one-to-many mappings, high unmapped fraction, missing background, mixed-species
Ensembl IDs, short/ambiguous gene symbols, name-only metabolites, DMR proximity
inference, thin pathways, and distant references.

## Visualization & export

### VisualizationState
`pathwayId`, `styleMode` (`original` | `abundance` | `significance` |
`methylation` | `multiomics`), `hideUnmapped`, `showLegend`, `activeLayers`,
zoom/pan, `selectedNodeId`, and `colorblindSafe`. Node layout is computed
deterministically (see [`layout.ts`](../src/lib/layout.ts)): source coordinates
are preserved where available and relaxed to remove overlaps with a fixed-iteration,
seed-free simulation, so SVG/PNG exports are reproducible.

### SessionFile
A complete, portable snapshot: app version, timestamp, column mapping, thresholds,
species/orthology settings, data type, pathway source, selected pathway,
visualization state, and the names of the tables used. Re-importing restores every
setting; re-uploading the named tables completes the restore.

### ExportRecord
Exports include matched entities, unmatched identifiers, the full mapping audit,
the pathway ranking/enrichment summary (CSV/TSV), publication SVG/PNG figures, the
session JSON, and a plain-text methods paragraph whose wording adapts to whether a
mapping summary or an enrichment analysis was performed.
