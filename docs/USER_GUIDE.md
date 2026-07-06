# Marine Pathway Mapper — User Guide

A practical walkthrough for mapping marine and non-model organism omics results
onto biological pathways. Everything runs in your browser; your data never leaves
your computer.

## Quick start (2 minutes)

1. Open the app and click **Load demo data** on the landing page.
2. You are taken to the **Mapping Quality** page — see how the demo multi-omics
   dataset (RNA, methylation, protein, metabolite) maps to pathways.
3. Go to **Pathways** to see ranked pathways, then **Visualize** to open the
   interactive diagram (try the *Multi-omics* style and the layer toggles).
4. Go to **Export & Methods** to download tables, a figure, a session file, and a
   methods paragraph.

## The six-step workflow

### 1. Upload & map columns
- Drag and drop **CSV / TSV / XLSX**, paste tabular text, or load a sample.
- Multiple tables are supported (e.g. a DEG table + a metabolomics table).
- The app auto-detects the data type and column roles. **Always confirm the
  mapping** — especially the primary identifier column.
- Set your **significance** and **effect-size thresholds**. By default, smaller
  significance values (p / FDR) are treated as stronger evidence.

**Tip — identifiers.** Stable IDs (UniProt, Ensembl, NCBI Gene, ChEBI, HMDB) map
far more reliably than free-text gene symbols. Metabolites map best by ChEBI /
HMDB / KEGG / PubChem; name-only metabolites are matched but flagged as lower
confidence.

### 2. Species & orthology
Pick how your identifiers connect to pathway entities:

- **Direct species** — your IDs are already supported (human, zebrafish, mouse,
  and similar well-annotated organisms).
- **Ortholog-reference** — for non-model organisms. Choose a reference organism
  (human, zebrafish, sea urchin, oyster, …) and upload an ortholog table linking
  your IDs to reference IDs.
- **User ortholog table** — upload your own assignments from EggNOG, OrthoFinder,
  Ensembl orthologs, or a custom annotation table.

An ortholog table needs only two columns (your ID → reference ID). A confidence or
relationship column is used if present. One-to-many and many-to-one relationships
are preserved and flagged, never silently collapsed.

If the reference organism is evolutionarily distant from your study organism, the
app raises a caution: treat those mappings as candidate annotations.

### 3. Mapping quality
This is the transparency checkpoint. Review:

- how many features were **recognized**, mapped **directly**, mapped via
  **orthology**, were **one-to-many**, **unmapped**, or **excluded by filter**;
- the **identifier types** detected;
- the **audit table** — one row per feature, with the reason it did or did not map.

Export the audit as CSV or TSV here. Read the transparency notes at the top: heavy
orthology reliance, high unmapped fractions, and other caveats are called out
explicitly.

### 4. Discover & rank pathways
- Search by pathway name, gene, metabolite, ID, or keyword.
- Filter by **source** (WikiPathways / Reactome), **category**, minimum matched
  features, and whether the pathway has at least one significant feature.
- Each card shows the **rank score**, matched/significant counts, fraction of the
  pathway represented, median effect size, direction balance, and per-layer counts
  for multi-omics data.

**Mapping summary vs. enrichment.** Without a background universe, results are a
descriptive *mapping summary* (counts only). Tick **"Use uploaded set as
background"** to compute Fisher's exact p-values and Benjamini-Hochberg q-values —
the app then labels results as an *enrichment analysis*. Choose a background that
reflects everything you tested, not just the significant hits.

### 5. Visualize
- Click **Visualize** on any pathway card.
- **Style modes:** Original, Abundance (effect size), Significance, Methylation,
  and Multi-omics (each node split by omics layer).
- Toggle layers, hide unmapped nodes, switch to a colorblind-safe palette, and
  search to highlight nodes.
- **Zoom** with the scroll wheel, **pan** by dragging, and **Reset view** to
  recenter.
- Click any node to open the side panel: mapped features, their values and
  direction, mapping type (direct / orthology / ambiguous), DMR inference notes,
  and external database links.
- Export the current diagram as **SVG** (vector, with an embedded legend) or a
  high-resolution **PNG**.

### 6. Export & methods
- **Data tables** (CSV/TSV): matched entities, unmatched identifiers, full mapping
  audit, and the pathway ranking / enrichment summary.
- **Figures:** publication SVG / high-resolution PNG from the viewer.
- **Reproducibility:** a **session JSON** (all settings) and a plain-text
  **methods paragraph** whose wording adapts to mapping-summary vs. enrichment.
- **Citation:** guidance for citing the pathway sources you used.

## Restoring a session
On the **Docs** page, use **Import session JSON** to restore all settings from a
previously exported session. Re-upload your data tables (with the same names) to
complete the restore.

## Interpreting results responsibly

Pathway overlap is a hypothesis-generating aid, not proof of pathway activity.
Especially with orthology-based mapping:

**Appropriate wording:** "mapped to pathway", "orthology-supported annotation",
"candidate pathway association", "potential pathway-level pattern", "requires
biological validation".

**Avoid (without direct experimental evidence):** "this pathway is activated",
"this proves pathway disruption", "this gene causes the response".

## Frequently asked questions

**My non-model species has no direct coverage — what do I do?**
Use ortholog-reference mode with a well-annotated reference, or upload your own
ortholog table. See the non-model workflow on the Docs page.

**Why are some metabolites low confidence?**
Metabolites matched only by name (no ChEBI/HMDB/KEGG/PubChem ID) are more
ambiguous. Provide a database ID where possible.

**Does anything upload to a server?**
No. All parsing, mapping, scoring, and rendering happen in your browser.

**Can I get KEGG pathway images?**
No — KEGG is link-out only, by design. The app never redistributes proprietary
KEGG maps. Detected KEGG IDs are linked to their KEGG records.
