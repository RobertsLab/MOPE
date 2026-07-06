import { legendFor } from '../lib/colors';
import { LAYER_GLYPH_COLORS } from '../lib/colors';
import { LAYER_LABELS } from '../lib/enrichment';
import type { StyleMode, OmicsLayer } from '../types/model';

export function Legend({ styleMode, colorblindSafe, activeLayers }: { styleMode: StyleMode; colorblindSafe: boolean; activeLayers: OmicsLayer[] }) {
  const entries = legendFor(styleMode, colorblindSafe);
  return (
    <div className="rounded-md border border-slate-200 bg-white/90 p-3 text-xs">
      <div className="mb-1 font-semibold text-slate-600">Legend</div>
      <div className="space-y-1">
        {styleMode === 'multiomics' ? (
          activeLayers.map((l) => (
            <div key={l} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: LAYER_GLYPH_COLORS[l] }} />
              <span className="text-slate-600">{LAYER_LABELS[l]} layer</span>
            </div>
          ))
        ) : (
          entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border border-slate-300"
                style={e.pattern ? { backgroundImage: 'repeating-linear-gradient(45deg,#9ca3af 0 2px,#e5e7eb 2px 4px)' } : { background: e.color }} />
              <span className="text-slate-600">{e.label}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 border-t border-slate-100 pt-1 text-[10px] text-slate-400">
        Border width = significance · ★ = significance strength · dot = orthology/ambiguous mapping
      </div>
    </div>
  );
}
