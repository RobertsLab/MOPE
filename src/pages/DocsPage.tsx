import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { SectionTitle, InfoBanner } from '../components/common';
import type { SessionFile } from '../types/model';

export default function DocsPage() {
  const { dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const importSession = async (file: File | null) => {
    if (!file) return;
    try {
      const session = JSON.parse(await file.text()) as SessionFile;
      dispatch({ type: 'setColumnMapping', mapping: session.columnMapping });
      dispatch({ type: 'setThresholds', thresholds: session.thresholds });
      dispatch({ type: 'setSpecies', species: session.species });
      dispatch({ type: 'setDataType', dataType: session.dataType });
      dispatch({ type: 'setPathwaySource', source: session.pathwaySource });
      dispatch({ type: 'setVisualization', vis: session.visualization });
      setMsg(`Loaded session (v${session.appVersion}, ${session.generatedAt}). Re-upload your data table(s) with the same names to fully restore. Tables expected: ${session.tableNames.join(', ') || 'none recorded'}.`);
    } catch (e) {
      setMsg(`Failed to load session: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="How to use Marine Pathway Mapper — with a focused workflow for non-model and marine organisms.">
        Documentation
      </SectionTitle>

      {/* Non-model workflow */}
      <div className="card p-6">
        <h3 className="mb-3 text-lg font-semibold text-ocean-900">Non-model organism workflow</h3>
        <p className="mb-4 text-sm text-slate-600">
          Species like oysters, mussels, sea stars, and corals rarely have direct pathway coverage.
          The reliable path is to connect your features to a well-annotated reference organism through orthology.
        </p>
        <ol className="space-y-3 text-sm text-slate-700">
          {[
            ['Start with a gene / protein / metabolite table', 'A differential-expression, methylation, proteomics, or metabolomics result table. Keep effect size and significance columns.'],
            ['Map features to stable IDs where possible', 'UniProt, Ensembl, NCBI Gene, ChEBI, or HMDB are far more reliable than free-text symbols. Gene symbols work but are more ambiguous across species.'],
            ['Select a reference organism or upload ortholog assignments', 'Use human, zebrafish, or sea urchin as a reference, or upload an ortholog table from EggNOG, OrthoFinder, or Ensembl orthologs. Two columns (your ID → reference ID) is enough; a confidence column is used if present.'],
            ['Review mapping ambiguity', 'The mapping-quality page reports orthology fraction, one-to-many mappings, and unmapped features. Treat heavy-orthology results as annotations, not direct evidence.'],
            ['Explore pathway-level patterns', 'Use the discovery page to rank pathways and the viewer to see which components change and in which direction.'],
            ['Export figures and audit tables', 'Publication SVG/PNG plus CSV/TSV audit tables and a reproducible session file.'],
            ['Cite pathway sources and describe orthology assumptions', 'The export page generates a methods paragraph and source citations for you.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ocean-600 text-xs font-semibold text-white">{i + 1}</span>
              <span><strong className="text-slate-800">{t}.</strong> {d}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-ocean-800">For species without direct coverage, upload one of</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>UniProt accession mappings</li>
            <li>EggNOG annotations</li>
            <li>OrthoFinder ortholog assignments</li>
            <li>Ensembl ortholog tables</li>
            <li>NCBI Gene mappings</li>
            <li>Custom annotation tables (source ID → reference ID)</li>
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-ocean-800">Supported inputs</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>File formats: CSV, TSV, XLSX, pasted text</li>
            <li>Data types: DEG, DMR/methylation, proteomics, metabolomics, generic, multi-omics</li>
            <li>Identifiers: UniProt, Ensembl, NCBI Gene, gene symbol, ChEBI, HMDB, KEGG, KO, EC, PubChem</li>
            <li>Metabolites: ChEBI / HMDB / KEGG / PubChem / name (name = lower confidence)</li>
          </ul>
        </div>
      </div>

      {/* Interpretation guidance */}
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">Interpreting results responsibly</h3>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-emerald-700">Appropriate wording</div>
            <ul className="list-inside list-disc space-y-0.5 text-slate-600">
              <li>“Mapped to pathway”</li>
              <li>“Orthology-supported annotation”</li>
              <li>“Candidate pathway association”</li>
              <li>“Potential pathway-level pattern”</li>
              <li>“Requires biological validation”</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-medium text-rose-700">Avoid (unless you have direct experimental evidence)</div>
            <ul className="list-inside list-disc space-y-0.5 text-slate-600">
              <li>“This pathway is activated”</li>
              <li>“This proves pathway disruption”</li>
              <li>“This gene causes the response”</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Session import */}
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">Restore a session</h3>
        <p className="mb-3 text-sm text-slate-600">Load a previously exported session JSON to restore all settings. Re-upload your data tables to complete the restore.</p>
        {msg && <div className="mb-3"><InfoBanner tone="info">{msg}</InfoBanner></div>}
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import session JSON</button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => importSession(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* Scoring transparency */}
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">How pathways are scored</h3>
        <p className="text-sm text-slate-600">
          The rank score is a transparent blend: 40 × (fraction of pathway entities represented) + 30 × (saturating significant-match term)
          + 30 × (enrichment strength if a background is supplied, otherwise a saturating matched-feature term). When no background universe
          is provided, results are a <strong>mapping summary</strong> (descriptive counts only). With a background, Fisher’s exact test and
          Benjamini-Hochberg FDR are computed and labeled as an <strong>enrichment analysis</strong>.
        </p>
      </div>
    </div>
  );
}
