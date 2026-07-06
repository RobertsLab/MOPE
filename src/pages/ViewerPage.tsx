import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useDerived } from '../state/useDerived';
import { getPathway } from '../data/pathwayLibrary';
import { PathwayGraph } from '../components/PathwayGraph';
import { NodePanel } from '../components/NodePanel';
import { Legend } from '../components/Legend';
import { buildNodeData } from '../lib/nodeData';
import { EmptyState, Pill } from '../components/common';
import { serializeSvg, svgToPngDataUrl, downloadBlob } from '../lib/exports';
import type { StyleMode, OmicsLayer } from '../types/model';

const STYLE_MODES: { id: StyleMode; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'abundance', label: 'Abundance' },
  { id: 'significance', label: 'Significance' },
  { id: 'methylation', label: 'Methylation' },
  { id: 'multiomics', label: 'Multi-omics' },
];

const LAYERS: OmicsLayer[] = ['rna', 'methylation', 'protein', 'metabolite'];

export default function ViewerPage() {
  const { state, dispatch } = useStore();
  const { entities, mapping, scores } = useDerived();
  const svgRef = useRef<SVGSVGElement>(null);
  const [search, setSearch] = useState('');

  const vis = state.visualization;
  const pathwayId = vis.pathwayId ?? scores[0]?.pathwayId ?? null;
  const pathway = pathwayId ? getPathway(pathwayId) : null;

  const nodeData = useMemo(
    () => (pathway ? buildNodeData(pathway, entities, mapping) : new Map()),
    [pathway, entities, mapping],
  );
  const selectedNd = vis.selectedNodeId ? nodeData.get(vis.selectedNodeId) ?? null : null;

  if (!pathway) {
    return <EmptyState title="No pathway selected">Choose a pathway on the Discovery page to visualize it.</EmptyState>;
  }

  const resetView = () => svgRef.current?.dispatchEvent(new Event('resetview'));

  const exportSvg = () => {
    if (!svgRef.current) return;
    downloadBlob(serializeSvg(svgRef.current), `${pathway.id}_pathway.svg`, 'image/svg+xml');
  };
  const exportPng = async () => {
    if (!svgRef.current) return;
    const url = await svgToPngDataUrl(svgRef.current, 3);
    const res = await fetch(url);
    downloadBlob(await res.blob(), `${pathway.id}_pathway.png`, 'image/png');
  };

  const matchedCount = scores.find((s) => s.pathwayId === pathway.id)?.matchedFeatures ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-ocean-900">{pathway.name}</h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            <Pill tone={pathway.source === 'reactome' ? 'purple' : 'ocean'}>{pathway.source === 'reactome' ? 'Reactome' : 'WikiPathways'}</Pill>
            <span className="font-mono">{pathway.id}</span>
            <span>· {pathway.organism} · {matchedCount} features matched</span>
            <a href={pathway.sourceUrl} target="_blank" rel="noreferrer" className="text-ocean-600 hover:underline">Source ↗</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input py-1" value={pathway.id}
            onChange={(e) => dispatch({ type: 'setVisualization', vis: { pathwayId: e.target.value, selectedNodeId: null } })}>
            {scores.map((s) => <option key={s.pathwayId} value={s.pathwayId}>{s.pathwayName} ({s.matchedFeatures})</option>)}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="card flex flex-wrap items-center gap-4 p-3">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-500">Style:</span>
          {STYLE_MODES.map((m) => (
            <button key={m.id} onClick={() => dispatch({ type: 'setVisualization', vis: { styleMode: m.id } })}
              className={`rounded-md px-2 py-1 text-xs font-medium ${vis.styleMode === m.id ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {vis.styleMode === 'multiomics' && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-500">Layers:</span>
            {LAYERS.map((l) => (
              <label key={l} className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={vis.activeLayers.includes(l)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...vis.activeLayers, l] : vis.activeLayers.filter((x) => x !== l);
                    dispatch({ type: 'setVisualization', vis: { activeLayers: next } });
                  }} />
                {l}
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={vis.hideUnmapped}
            onChange={(e) => dispatch({ type: 'setVisualization', vis: { hideUnmapped: e.target.checked } })} />
          Hide unmapped
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={vis.colorblindSafe}
            onChange={(e) => dispatch({ type: 'setVisualization', vis: { colorblindSafe: e.target.checked } })} />
          Colorblind-safe palette
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={vis.showLegend}
            onChange={(e) => dispatch({ type: 'setVisualization', vis: { showLegend: e.target.checked } })} />
          Legend
        </label>

        <input className="input py-1 text-xs" placeholder="Search nodes…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={resetView}>⤢ Reset view</button>
          <button className="btn-secondary text-xs" onClick={exportSvg}>↓ SVG</button>
          <button className="btn-secondary text-xs" onClick={exportPng}>↓ PNG</button>
        </div>
      </div>

      {/* Diagram + panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card relative overflow-hidden" style={{ height: 640 }}>
          <PathwayGraph pathway={pathway} entities={entities} mapping={mapping} vis={vis}
            significanceThreshold={state.thresholds.significanceThreshold}
            smallerIsStronger={state.thresholds.smallerIsStronger}
            onSelectNode={(id) => dispatch({ type: 'setVisualization', vis: { selectedNodeId: id } })}
            svgRef={svgRef} searchTerm={search} />
          {vis.showLegend && (
            <div className="absolute bottom-3 left-3 max-w-[220px]">
              <Legend styleMode={vis.styleMode} colorblindSafe={vis.colorblindSafe} activeLayers={vis.activeLayers} />
            </div>
          )}
          <div className="absolute right-3 top-3 text-[10px] text-slate-400">Scroll to zoom · drag to pan</div>
        </div>
        <NodePanel nd={selectedNd} pathwayId={pathway.id}
          onClose={() => dispatch({ type: 'setVisualization', vis: { selectedNodeId: null } })} />
      </div>

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => dispatch({ type: 'setPage', page: 'discovery' })}>← Back to pathways</button>
        <button className="btn-primary" onClick={() => dispatch({ type: 'setPage', page: 'export' })}>Export &amp; methods →</button>
      </div>
    </div>
  );
}
