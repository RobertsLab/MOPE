import { useStore } from '../state/store';
import { DEMO_TABLE, DEMO_SESSION } from '../data/demo';
import { MockPathway } from '../components/MockPathway';

export default function LandingPage() {
  const { dispatch } = useStore();

  const loadDemo = () => {
    dispatch({ type: 'reset' });
    dispatch({ type: 'addTable', table: DEMO_TABLE });
    dispatch({ type: 'setColumnMapping', mapping: DEMO_SESSION.columnMapping });
    dispatch({ type: 'setDataType', dataType: DEMO_SESSION.dataType });
    dispatch({ type: 'setThresholds', thresholds: DEMO_SESSION.thresholds });
    dispatch({ type: 'setSpecies', species: DEMO_SESSION.species });
    dispatch({ type: 'setVisualization', vis: DEMO_SESSION.visualization });
    dispatch({ type: 'setPage', page: 'summary' });
  };

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <span className="badge bg-ocean-100 text-ocean-800">Free · Client-side · No API key</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight text-ocean-950">
            Map marine &amp; non-model omics data onto biological pathways
          </h1>
          <p className="text-lg text-slate-600">
            Upload differential expression, methylation, proteomics, metabolomics, or multi-omics
            results. Map identifiers to pathway entities — directly or through orthology to a
            reference organism — and build interactive, publication-ready pathway diagrams using
            open pathway resources.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => dispatch({ type: 'setPage', page: 'upload' })}>
              Upload your data
            </button>
            <button className="btn-secondary" onClick={loadDemo}>
              Load demo data
            </button>
            <button className="btn-ghost" onClick={() => dispatch({ type: 'setPage', page: 'docs' })}>
              Non-model organism guide →
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Everything runs in your browser. Your data never leaves your computer.
          </p>
        </div>
        <div className="card overflow-hidden p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Example: oxidative-stress pathway with multi-omics overlay
          </div>
          <MockPathway />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: 'Answer real questions', d: 'Which pathways are represented? Which genes, proteins, metabolites, or methylated regions map to them? What is up, down, hyper-, or hypomethylated?' },
          { t: 'Built for non-model organisms', d: 'Direct mapping, ortholog-reference mapping to human/zebrafish/urchin/oyster, or your own ortholog table — with ambiguity never hidden.' },
          { t: 'Transparent by design', d: 'Mapping summaries vs. enrichment analysis, colorblind-aware styling, exportable audit tables, and visible uncertainty warnings throughout.' },
        ].map((f) => (
          <div key={f.t} className="card p-5">
            <h3 className="mb-1 font-semibold text-ocean-800">{f.t}</h3>
            <p className="text-sm text-slate-600">{f.d}</p>
          </div>
        ))}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-ocean-900">How it works</h2>
        <ol className="grid gap-4 text-sm text-slate-600 md:grid-cols-3 lg:grid-cols-6">
          {['Upload & map columns', 'Choose species / orthology', 'Review mapping quality', 'Discover & rank pathways', 'Visualize interactively', 'Export figures & methods'].map((s, i) => (
            <li key={s} className="flex flex-col gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ocean-600 text-sm font-semibold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
