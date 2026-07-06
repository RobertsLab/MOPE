import { useState } from 'react';
import { useStore } from '../state/store';
import { REFERENCE_ORGANISMS, STUDY_ORGANISM_PRESETS } from '../data/species';
import { parseDelimitedText } from '../lib/parse';
import { isDistantReference } from '../lib/ortholog';
import type { SpeciesMode } from '../types/model';
import { SectionTitle, InfoBanner, Pill } from '../components/common';

const MODES: { id: SpeciesMode; label: string; desc: string }[] = [
  { id: 'direct', label: 'Direct species', desc: 'Identifiers are already supported by WikiPathways / Reactome (e.g. human, zebrafish, mouse symbols or accessions).' },
  { id: 'ortholog_reference', label: 'Ortholog-reference', desc: 'Map your non-model organism to a reference species. Requires an ortholog table linking your IDs to reference IDs.' },
  { id: 'user_ortholog_table', label: 'User ortholog table', desc: 'Upload your own ortholog assignments (EggNOG, OrthoFinder, Ensembl orthologs, custom).' },
];

export default function SpeciesPage() {
  const { state, dispatch } = useStore();
  const [orthoError, setOrthoError] = useState<string | null>(null);

  const distant = isDistantReference(state.species.studySpecies, state.species.referenceSpecies);
  const needsOrtholog = state.species.mode !== 'direct';

  const loadOrthologFile = async (file: File | null) => {
    if (!file) return;
    setOrthoError(null);
    try {
      const text = await file.text();
      const table = parseDelimitedText(text, 'ortholog_table');
      // Guess columns.
      const hdr = table.headers;
      const guessSource = hdr.find((h) => /source|query|study|from/i.test(h)) ?? hdr[0];
      const guessRef = hdr.find((h) => /reference|ref|symbol|target|to|human/i.test(h)) ?? hdr[1];
      const guessConf = hdr.find((h) => /conf|score|relationship|type/i.test(h)) ?? null;
      dispatch({ type: 'setOrthologTable', table, mapping: { sourceCol: guessSource, referenceCol: guessRef, confidenceCol: guessConf } });
    } catch (e) {
      setOrthoError(`Failed to parse ortholog table: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="Choose how your identifiers connect to pathway entities. For marine and non-model organisms, orthology mapping is usually required.">
        Step 2 — Species &amp; orthology strategy
      </SectionTitle>

      {/* Study organism presets */}
      <div className="card p-5">
        <div className="label">Study organism</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {STUDY_ORGANISM_PRESETS.map((o) => (
            <button key={o.id + o.common}
              onClick={() => dispatch({ type: 'setSpecies', species: { studySpecies: o.scientific } })}
              className={`badge ${state.species.studySpecies === o.scientific ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              title={o.note}>
              {o.common} · <em className="not-italic opacity-70">{o.scientific}</em>
              {!o.hasDirectCoverage && <span className="ml-1">*</span>}
            </button>
          ))}
        </div>
        <input className="input w-full md:w-96" placeholder="Or type a species name…"
          value={state.species.studySpecies}
          onChange={(e) => dispatch({ type: 'setSpecies', species: { studySpecies: e.target.value } })} />
        <p className="mt-1 text-xs text-slate-400">* No direct pathway coverage — map via a reference organism or a custom ortholog table.</p>
      </div>

      {/* Mode selection */}
      <div className="grid gap-4 md:grid-cols-3">
        {MODES.map((m) => (
          <button key={m.id}
            onClick={() => dispatch({ type: 'setSpecies', species: { mode: m.id } })}
            className={`card p-4 text-left transition-colors ${state.species.mode === m.id ? 'ring-2 ring-ocean-500' : 'hover:bg-ocean-50'}`}>
            <div className="mb-1 font-semibold text-ocean-800">{m.label}</div>
            <div className="text-sm text-slate-600">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Reference organism selector */}
      {needsOrtholog && (
        <div className="card p-5">
          <div className="label">Reference organism</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {REFERENCE_ORGANISMS.map((o) => (
              <button key={o.id}
                onClick={() => dispatch({ type: 'setSpecies', species: { referenceSpecies: o.scientific } })}
                className={`badge ${state.species.referenceSpecies === o.scientific ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {o.common} · <em className="not-italic opacity-70">{o.scientific}</em>
              </button>
            ))}
          </div>
          <input className="input w-full md:w-96" placeholder="Or type a reference species…"
            value={state.species.referenceSpecies ?? ''}
            onChange={(e) => dispatch({ type: 'setSpecies', species: { referenceSpecies: e.target.value || null } })} />

          {distant && (
            <div className="mt-3">
              <InfoBanner tone="warning">
                The reference organism appears evolutionarily distant from <em>{state.species.studySpecies}</em>.
                Orthology-based mappings may be unreliable; treat pathway associations as candidate patterns requiring validation.
              </InfoBanner>
            </div>
          )}
        </div>
      )}

      {/* Ortholog table upload */}
      {needsOrtholog && (
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="label mb-0">Ortholog table</div>
            {state.orthologTable && <Pill tone="green">{state.orthologTable.rows.length} rows loaded</Pill>}
          </div>
          <p className="mb-3 text-sm text-slate-600">
            Upload a table linking your source identifiers to reference-organism identifiers.
            One-to-many and many-to-one relationships are supported and are flagged, never hidden.
          </p>
          {orthoError && <InfoBanner tone="warning">{orthoError}</InfoBanner>}
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,.tsv,.txt" onChange={(e) => loadOrthologFile(e.target.files?.[0] ?? null)}
              className="text-sm" />
            <a className="btn-ghost text-xs" href={`${import.meta.env.BASE_URL}samples/sample_ortholog_table.csv`} download>↓ Sample ortholog table</a>
          </div>

          {state.orthologTable && state.orthologMapping && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(['sourceCol', 'referenceCol', 'confidenceCol'] as const).map((k) => (
                <div key={k}>
                  <label className="label">
                    {k === 'sourceCol' ? 'Source species column *' : k === 'referenceCol' ? 'Reference species column *' : 'Confidence / relationship column'}
                  </label>
                  <select className="input w-full" value={state.orthologMapping![k] ?? ''}
                    onChange={(e) => dispatch({ type: 'setOrthologTable', table: state.orthologTable, mapping: { ...state.orthologMapping!, [k]: e.target.value || null } })}>
                    {k === 'confidenceCol' && <option value="">— none —</option>}
                    {state.orthologTable!.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => dispatch({ type: 'setPage', page: 'upload' })}>← Back</button>
        <button className="btn-primary"
          disabled={needsOrtholog && (!state.orthologTable || !state.species.referenceSpecies)}
          onClick={() => { dispatch({ type: 'setSpecies', species: { distantReference: distant } }); dispatch({ type: 'setPage', page: 'summary' }); }}>
          Continue to mapping quality →
        </button>
      </div>
    </div>
  );
}
