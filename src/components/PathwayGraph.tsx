import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Pathway, VisualizationState, NormalizedEntity } from '../types/model';
import type { MappingResult } from '../lib/mapping';
import { buildNodeData, maxAbsEffect, type NodeDatum } from '../lib/nodeData';
import { nodeStyleFor, LAYER_GLYPH_COLORS } from '../lib/colors';
import { layoutPathway } from '../lib/layout';

const NODE_W = 68;
const NODE_H = 30;
const BASE_W = 900;
const BASE_H = 640;

/** Canvas grows with node count so dense pathways stay legible (viewer is zoom/pan). */
function canvasSize(n: number): { W: number; H: number } {
  // Target roughly one node per ~150×105 px cell so labels and gaps have room.
  const target = n * 150 * 105;
  const scale = Math.max(1, Math.sqrt(target / (BASE_W * BASE_H)));
  return { W: Math.round(BASE_W * scale), H: Math.round(BASE_H * scale) };
}

interface Props {
  pathway: Pathway;
  entities: NormalizedEntity[];
  mapping: MappingResult;
  vis: VisualizationState;
  significanceThreshold: number;
  smallerIsStronger: boolean;
  onSelectNode: (nodeId: string | null) => void;
  svgRef?: React.RefObject<SVGSVGElement>;
  searchTerm?: string;
}

export function PathwayGraph({
  pathway, entities, mapping, vis, significanceThreshold, smallerIsStronger, onSelectNode, svgRef, searchTerm,
}: Props) {
  const innerRef = useRef<SVGGElement | null>(null);
  const localSvgRef = useRef<SVGSVGElement | null>(null);
  const ref = svgRef ?? localSvgRef;

  const nodeData = useMemo(() => buildNodeData(pathway, entities, mapping), [pathway, entities, mapping]);
  const maxAbs = useMemo(() => maxAbsEffect(nodeData), [nodeData]);

  const { W, H } = useMemo(() => canvasSize(pathway.entities.length), [pathway]);

  // Deterministic de-overlap layout seeded at source coordinates.
  const pos = useMemo(
    () => layoutPathway(pathway, { width: W, height: H, nodeW: NODE_W, nodeH: NODE_H }),
    [pathway, W, H],
  );

  // D3 zoom/pan.
  useEffect(() => {
    if (!ref.current || !innerRef.current) return;
    const svg = d3.select(ref.current);
    const g = d3.select(innerRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', (event) => { g.attr('transform', event.transform.toString()); });
    svg.call(zoom);
    // Expose reset via custom event.
    const resetHandler = () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    ref.current.addEventListener('resetview', resetHandler);
    return () => { ref.current?.removeEventListener('resetview', resetHandler); svg.on('.zoom', null); };
  }, [ref]);

  const term = (searchTerm ?? '').trim().toLowerCase();

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-full w-full select-none bg-white"
      role="img" aria-label={`Pathway diagram: ${pathway.name}`}>
      <defs>
        <pattern id="mpm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#e5e7eb" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#9ca3af" strokeWidth="2" />
        </pattern>
      </defs>
      <g ref={innerRef}>
        {/* Edges */}
        {pathway.edges.map((e, i) => {
          const a = pos.get(e.source); const b = pos.get(e.target);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e2e8f0" strokeWidth={1.5} />;
        })}
        {/* Nodes */}
        {pathway.entities.map((entity) => {
          const p = pos.get(entity.nodeId)!;
          const nd = nodeData.get(entity.nodeId)!;
          const isMapped = nd.matched.length > 0;
          if (vis.hideUnmapped && !isMapped) return null;
          const activeLayers = nd.matched.filter((e) => vis.activeLayers.includes(e.omicsLayer));
          const hit = term && entity.label.toLowerCase().includes(term);
          return (
            <NodeGlyph key={entity.nodeId} x={p.x} y={p.y} entity={entity} nd={nd}
              maxAbs={maxAbs} vis={vis} significanceThreshold={significanceThreshold}
              smallerIsStronger={smallerIsStronger} selected={vis.selectedNodeId === entity.nodeId}
              highlight={!!hit} activeLayers={activeLayers}
              onClick={() => onSelectNode(vis.selectedNodeId === entity.nodeId ? null : entity.nodeId)} />
          );
        })}
      </g>
    </svg>
  );
}

interface GlyphProps {
  x: number; y: number; entity: Pathway['entities'][number]; nd: NodeDatum;
  maxAbs: number; vis: VisualizationState; significanceThreshold: number; smallerIsStronger: boolean;
  selected: boolean; highlight: boolean; activeLayers: NormalizedEntity[]; onClick: () => void;
}

function NodeGlyph({ x, y, entity, nd, maxAbs, vis, significanceThreshold, smallerIsStronger, selected, highlight, activeLayers, onClick }: GlyphProps) {
  const isMetabolite = entity.entityType === 'metabolite';
  const rw = 68, rh = 30, rr = isMetabolite ? 18 : 6;
  const rep = nd.representative;
  const style = nodeStyleFor(rep, { maxAbsEffect: maxAbs, styleMode: vis.styleMode, colorblindSafe: vis.colorblindSafe, significanceThreshold, smallerIsStronger });

  const multi = vis.styleMode === 'multiomics' && activeLayers.length > 1;
  const layers = ['rna', 'methylation', 'protein', 'metabolite', 'generic'].filter((l) => activeLayers.some((e) => e.omicsLayer === l));

  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} style={{ cursor: 'pointer' }}
      role="button" aria-label={`${entity.label}${nd.matched.length ? `, ${nd.matched.length} matched` : ', unmapped'}`}>
      {isMetabolite ? (
        <>
          {multi ? renderPie(layers, rr) : (
            <circle r={rr} fill={style.pattern ? 'url(#mpm-hatch)' : style.fill}
              stroke={selected ? '#0f2937' : '#334155'} strokeWidth={selected ? 3.5 : style.strokeWidth} strokeOpacity={style.strokeOpacity} />
          )}
        </>
      ) : (
        <>
          {multi ? renderSplitRect(layers, rw, rh, rr) : (
            <rect x={-rw / 2} y={-rh / 2} width={rw} height={rh} rx={rr}
              fill={style.pattern ? 'url(#mpm-hatch)' : style.fill}
              stroke={selected ? '#0f2937' : '#334155'} strokeWidth={selected ? 3.5 : style.strokeWidth} strokeOpacity={style.strokeOpacity} />
          )}
        </>
      )}
      {highlight && <rect x={-rw / 2 - 4} y={-rh / 2 - 4} width={rw + 8} height={rh + 8} rx={rr + 3} fill="none" stroke="#f59e0b" strokeWidth={3} />}
      <text textAnchor="middle" dy="0.32em" fontSize={11} fontWeight={600} fill={labelColor(style.fill, style.pattern)}
        style={{ pointerEvents: 'none' }}>
        {truncate(entity.label, 10)}
      </text>
      {/* significance stars */}
      {style.stars > 0 && (
        <text x={rw / 2 - 6} y={-rh / 2 + 2} fontSize={10} fill="#1e293b" style={{ pointerEvents: 'none' }}>
          {'★'.repeat(style.stars)}
        </text>
      )}
      {/* mapping-type indicator: orthology/ambiguous get a small marker */}
      {nd.mappingTypes.includes('ambiguous') && <circle cx={-rw / 2 + 6} cy={-rh / 2 + 6} r={4} fill="#d97706" />}
      {nd.mappingTypes.includes('orthology') && !nd.mappingTypes.includes('direct') && <circle cx={-rw / 2 + 6} cy={-rh / 2 + 6} r={4} fill="#7c3aed" />}
    </g>
  );
}

function renderSplitRect(layers: string[], rw: number, rh: number, rr: number) {
  const n = layers.length;
  const seg = rw / n;
  return (
    <g>
      <clipPath id="_">{null}</clipPath>
      {layers.map((l, i) => (
        <rect key={l} x={-rw / 2 + i * seg} y={-rh / 2} width={seg} height={rh}
          fill={LAYER_GLYPH_COLORS[l]} stroke="#334155" strokeWidth={0.5} />
      ))}
      <rect x={-rw / 2} y={-rh / 2} width={rw} height={rh} rx={rr} fill="none" stroke="#334155" strokeWidth={2} />
    </g>
  );
}

function renderPie(layers: string[], r: number) {
  const n = layers.length;
  const arcGen = d3.arc();
  return (
    <g>
      {layers.map((l, i) => {
        const d = arcGen({
          innerRadius: 0,
          outerRadius: r,
          startAngle: (2 * Math.PI * i) / n,
          endAngle: (2 * Math.PI * (i + 1)) / n,
        }) ?? '';
        return <path key={l} d={d} fill={LAYER_GLYPH_COLORS[l]} stroke="#334155" strokeWidth={0.5} />;
      })}
      <circle r={r} fill="none" stroke="#334155" strokeWidth={2} />
    </g>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function labelColor(fill: string, pattern: boolean): string {
  if (pattern) return '#1e293b';
  // luminance-based contrast
  const hex = fill.replace('#', '');
  if (hex.length !== 6) return '#1e293b';
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}
