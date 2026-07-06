# Data Sources & Attribution

Marine Pathway Mapper performs identifier mapping and visualization only. All
pathway content, names, gene/protein/metabolite members, and identifiers belong to
the original sources listed here. The bundled library is a curated static core for
offline use — it is **not** the complete collection of either source.

## WikiPathways

- **What is bundled:** 18 pathways with gene/protein/metabolite entities, their
  Ensembl / Entrez Gene / UniProt / ChEBI cross-references, and layout coordinates.
- **How it was obtained:** from the per-pathway WikiPathways pathway assets
  (`https://www.wikipathways.org/wikipathways-assets/pathways/<id>/<id>.json`).
- **License:** WikiPathways content is released under **CC0**.
- **How to cite:** cite the current WikiPathways database publication and the
  specific pathway IDs you used. See the "How to cite" guidance at
  <https://www.wikipathways.org>.

| ID | Name | Entities |
|----|------|----------|
| WP78 | TCA cycle (aka Krebs or citric acid cycle) | 42 |
| WP106 | Alanine and aspartate metabolism | 66 |
| WP143 | Fatty acid beta-oxidation | 70 |
| WP179 | Cell cycle | 70 |
| WP197 | Cholesterol biosynthesis pathway | 30 |
| WP254 | Apoptosis | 70 |
| WP382 | MAPK signaling | 70 |
| WP408 | Oxidative stress response | 34 |
| WP453 | Inflammatory response pathway | 33 |
| WP534 | Glycolysis and gluconeogenesis | 65 |
| WP1742 | TP53 network | 33 |
| WP2064 | Neural crest differentiation | 70 |
| WP2380 | BDNF signaling | 70 |
| WP2447 | ALS | 50 |
| WP2795 | Cardiac hypertrophic response | 68 |
| WP3925 | Amino acid metabolism | 70 |
| WP4172 | PI3K-Akt signaling | 70 |
| WP4341 | Non-genomic actions of 1,25-dihydroxyvitamin D3 | 70 |

## Reactome

- **What is bundled:** 8 pathways with their reference entities (proteins by
  UniProt accession, small molecules by ChEBI).
- **How it was obtained:** from the Reactome ContentService reference-entities
  endpoint (`https://reactome.org/ContentService/data/participants/<id>/referenceEntities`).
  Large pathways are capped at 60 entities for visualization clarity; the full
  content remains available at the linked Reactome record.
- **License:** Reactome content is released under **CC-BY 4.0**.
- **How to cite:** cite the current Reactome Pathway Knowledgebase publication and
  the specific pathway IDs you used. See <https://reactome.org/cite>.

| ID | Name | Entities |
|----|------|----------|
| R-HSA-71291 | Metabolism of amino acids and derivatives | 60 |
| R-HSA-109581 | Apoptosis | 60 |
| R-HSA-157118 | Signaling by NOTCH | 60 |
| R-HSA-168256 | Immune System | 60 |
| R-HSA-195721 | Signaling by WNT | 60 |
| R-HSA-212165 | Epigenetic regulation of gene expression | 60 |
| R-HSA-3299685 | Detoxification of Reactive Oxygen Species | 60 |
| R-HSA-611105 | Respiratory electron transport | 60 |

## KEGG — link-out only

KEGG identifiers (KEGG compound, KEGG gene, KO, EC) are used for matching and to
build **external links only**. This application never reproduces, bundles, or
redistributes proprietary KEGG pathway maps or images. Where KEGG identifiers are
detected, only a link to the KEGG record is provided.

## Other identifier resolvers (external links)

UniProt, Ensembl, NCBI Gene, ChEBI, HMDB, and PubChem identifiers are linked to
their respective public resolver pages. These services are not redistributed; only
links are generated.

## Layout note

The interactive viewer uses WikiPathways layout coordinates where available and a
clean generated layout for Reactome pathways. In both cases a deterministic
overlap-removal step is applied. The result is a readable approximation of the
pathway, not a byte-for-byte reproduction of the source diagram. For the canonical
diagram, follow the "Source record" link on any pathway.
