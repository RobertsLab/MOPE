import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useDerived } from '../state/useDerived';
import { SectionTitle, Pill, EmptyState, InfoBanner } from '../components/common';
import { CATEGORY_LABELS, ALL_CATEGORIES } from '../data/pathwayLibrary';
import { LAYER_LABELS } from '../lib/enrichment';
import type { PathwayCategory, PathwaySource, PathwayScore } from '../types/model';

export default function DiscoveryPage() {
  const { state, dispatch } = useStore();
  const { scores, mode } = useDerived();
  const [query, setQuery] = useState('');
  const [sourceTab, setSourceTab] = useState<PathwaySource | 'all'>('all');
  const [categories, setCategories] = useState<Set<PathwayCategory>>(new Set());
  const [minMatched, setMinMatched] = useState(1);
  const [onlyWithSignificant, setOnlyWithSignificant] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scores.filter((s) => {
      if (sourceTab !== 'all' && s.source !== sourceTab) return false;
      if (categories.size && !s.categories.some((c) => categories.has(c))) return false;
      if (s.matchedFeatures < minMatched) return false;
      if (onlyWithSignificant && s.significantFeatures === 0) return false;
      if (q && !(`${s.pathwayName} ${s.pathwayId} ${s.categories.join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [scores, query, sourceTab, categories, minMatched, onlyWithSignificant]);

  const toggleCategory = (c: PathwayCategory) => {
    setCategories((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  if (scores.length === 0) {
    return <EmptyState title="No pathways matched">None of your mapped features hit an entity in the curated library. Check your identifier mapping and species/orthology settings.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <SectionTitle subtitle="Pathways your features map to, ranked by a transparent scoring system. Use search and filters to narrow the list.">
        Step 4 — Discover &amp; rank pathways
      </SectionTitle>

      <InfoBanner tone={mode === 'enrichment' ? 'info' : 'caution'}>
        {mode === 'enrichment'
          ? 'Enrichment mode: Fisher\u2019s exact p-values and Benjamini-Hochberg q-values are shown (a background universe was supplied).'
          : 'Mapping-summary mode: no background universe supplied, so results are descriptive counts — not a statistical enrichment analysis. Enable a background on the Export/Discovery controls to compute p-values.'}
      </InfoBanner>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input className="input flex-1 min-w-[220px]" placeholder="Search pathways, genes, metabolites, IDs, keywords…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={state.useBackground}
              onChange={(e) => dispatch({ type: 'setUseBackground', value: e.target.checked })} />
            Use uploaded set as background (enrichment)
          </label>
        </div>

        {/* Source tabs */}
        <div className="mt-3 flex gap-2">
          {(['all', 'wikipathways', 'reactome'] as const).map((t) => (
            <button key={t} onClick={() => setSourceTab(t)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${sourceTab === t ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {t === 'all' ? 'All sources' : t === 'wikipathways' ? 'WikiPathways' : 'Reactome'}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((c) => (
            <button key={c} onClick={() => toggleCategory(c)}
              className={`badge ${categories.has(c) ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Min matched features:
            <input type="number" min={1} className="input w-16 py-1" value={minMatched}
              onChange={(e) => setMinMatched(Math.max(1, Number(e.target.value)))} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyWithSignificant} onChange={(e) => setOnlyWithSignificant(e.target.checked)} />
            Only pathways with ≥1 significant feature
          </label>
          <span className="ml-auto text-slate-400">{filtered.length} of {scores.length} pathways</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((s) => (
          <PathwayCard key={s.pathwayId} score={s} mode={mode}
            onOpen={() => { dispatch({ type: 'setVisualization', vis: { pathwayId: s.pathwayId } }); dispatch({ type: 'setPage', page: 'viewer' }); }} />
        ))}
      </div>
    </div>
  );
}

function PathwayCard({ score, mode, onOpen }: { score: PathwayScore; mode: string; onOpen: () => void }) {
  const layers = Object.entries(score.perLayer);
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-ocean-900">{score.pathwayName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <Pill tone={score.source === 'reactome' ? 'purple' : 'ocean'}>{score.source === 'reactome' ? 'Reactome' : 'WikiPathways'}</Pill>
            <span className="font-mono">{score.pathwayId}</span>
            <span>· {score.organism}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-ocean-700">{score.rankScore}</div>
          <div className="text-[10px] uppercase text-slate-400">rank score</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {score.categories.map((c) => <Pill key={c} tone="slate">{CATEGORY_LABELS[c]}</Pill>)}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Metric label="Matched" value={score.matchedFeatures} />
        <Metric label="Significant" value={score.significantFeatures} />
        <Metric label="Represented" value={`${(score.fractionRepresented * 100).toFixed(0)}%`} />
        <Metric label="Median effect" value={score.medianEffectSize == null ? '—' : score.medianEffectSize.toFixed(2)} />
        <Metric label="Direction" value={`${(score.directionBalance * 100).toFixed(0)}% up`} />
        {mode === 'enrichment'
          ? <Metric label="q-value" value={score.qValue == null ? '—' : score.qValue.toExponential(1)} />
          : <Metric label="Entities" value={`${score.entitiesRepresented}/${score.totalEntities}`} />}
      </div>

      {layers.length > 1 && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2 text-xs">
          {layers.map(([layer, ls]) => (
            <Pill key={layer} tone="ocean">{LAYER_LABELS[layer as keyof typeof LAYER_LABELS]}: {ls.matched} ({ls.significant} sig)</Pill>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between">
        <a className="text-xs text-ocean-600 hover:underline" href={score.sourceUrl} target="_blank" rel="noreferrer">Source record ↗</a>
        <button className="btn-primary py-1 text-sm" onClick={onOpen}>Visualize →</button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1">
      <div className="font-semibold text-slate-700">{value}</div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
    </div>
  );
}
