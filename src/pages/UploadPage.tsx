import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { parseDelimitedText, parseXlsx, detectColumns, detectDataType, DATA_TYPE_LABELS } from '../lib/parse';
import type { ColumnMapping, DataType } from '../types/model';
import { SectionTitle, InfoBanner, Pill } from '../components/common';
import { DEMO_TABLE, DEMO_SESSION } from '../data/demo';

const SAMPLES = [
  { name: 'DEG (differential expression)', file: 'sample_DEG.csv' },
  { name: 'DMR (differential methylation)', file: 'sample_DMR.csv' },
  { name: 'Metabolomics', file: 'sample_metabolomics.csv' },
  { name: 'Custom ortholog table', file: 'sample_ortholog_table.csv' },
];

const MAPPABLE_FIELDS: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: 'identifier', label: 'Primary identifier *', hint: 'gene_id, UniProt, Ensembl, NCBI Gene, metabolite_id…' },
  { key: 'label', label: 'Feature label', hint: 'gene_name, symbol, protein_name, metabolite_name' },
  { key: 'effectSize', label: 'Effect size', hint: 'log2FoldChange, logFC, beta_difference, delta_methylation' },
  { key: 'significance', label: 'Significance', hint: 'padj, FDR, qvalue, p_value' },
  { key: 'direction', label: 'Direction', hint: 'up_down, regulation, methylation_direction' },
  { key: 'omicsLayer', label: 'Omics layer', hint: 'omics_type, assay, data_layer (enables multi-omics)' },
  { key: 'chromosome', label: 'Chromosome', hint: 'DMR genomic context' },
  { key: 'start', label: 'Start', hint: 'DMR genomic context' },
  { key: 'end', label: 'End', hint: 'DMR genomic context' },
  { key: 'nearestGene', label: 'Nearest / linked gene', hint: 'DMR-to-gene association' },
  { key: 'dmrId', label: 'DMR / region id', hint: 'DMR identifier' },
];

export default function UploadPage() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeTable = state.tables.find((t) => t.name === state.activeTableName) ?? null;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      try {
        if (/\.xlsx?$/i.test(file.name)) {
          const buf = await file.arrayBuffer();
          const table = await parseXlsx(buf, file.name.replace(/\.[^.]+$/, ''));
          dispatch({ type: 'addTable', table });
        } else {
          const text = await file.text();
          const table = parseDelimitedText(text, file.name.replace(/\.[^.]+$/, ''));
          dispatch({ type: 'addTable', table });
        }
      } catch (e) {
        setError(`Failed to parse ${file.name}: ${(e as Error).message}`);
      }
    }
  };

  const loadPaste = () => {
    if (!pasteText.trim()) return;
    setError(null);
    try {
      const table = parseDelimitedText(pasteText, `pasted_${state.tables.length + 1}`);
      dispatch({ type: 'addTable', table });
      setPasteText('');
    } catch (e) {
      setError(`Failed to parse pasted text: ${(e as Error).message}`);
    }
  };

  const loadSample = async (file: string) => {
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
      const text = await res.text();
      const table = parseDelimitedText(text, file.replace(/\.[^.]+$/, ''));
      dispatch({ type: 'addTable', table });
    } catch (e) {
      setError(`Failed to load sample: ${(e as Error).message}`);
    }
  };

  const loadDemo = () => {
    dispatch({ type: 'reset' });
    dispatch({ type: 'addTable', table: DEMO_TABLE });
    dispatch({ type: 'setColumnMapping', mapping: DEMO_SESSION.columnMapping });
    dispatch({ type: 'setDataType', dataType: DEMO_SESSION.dataType });
    dispatch({ type: 'setSpecies', species: DEMO_SESSION.species });
  };

  const reDetect = () => {
    if (!activeTable) return;
    const mapping = detectColumns(activeTable);
    dispatch({ type: 'setColumnMapping', mapping });
    dispatch({ type: 'setDataType', dataType: detectDataType(activeTable, mapping) });
  };

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="Upload CSV, TSV, XLSX, or paste tabular text. Then confirm how columns map to analysis fields.">
        Step 1 — Upload data &amp; map columns
      </SectionTitle>

      {error && <InfoBanner tone="warning">{error}</InfoBanner>}

      {/* Upload zone */}
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-ocean-200 p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <div className="text-slate-600">Drag &amp; drop files here, or</div>
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>Choose files</button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
          <div className="text-xs text-slate-400">CSV · TSV · XLSX · multiple tables supported</div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button className="btn-secondary" onClick={loadDemo}>Load demo (multi-omics)</button>
          </div>
        </div>

        <div className="card p-4">
          <div className="label">Paste tabular text</div>
          <textarea
            className="input h-28 w-full font-mono text-xs"
            placeholder={'gene_id,gene_name,log2FoldChange,padj\nTP53,TP53,1.8,0.001'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between">
            <button className="btn-secondary" onClick={loadPaste} disabled={!pasteText.trim()}>Load pasted text</button>
            <div className="text-xs text-slate-400">Delimiter auto-detected</div>
          </div>
          <div className="mt-4">
            <div className="label">Download sample datasets</div>
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <a key={s.file} className="btn-ghost text-xs" href={`${import.meta.env.BASE_URL}samples/${s.file}`} download>
                  ↓ {s.name}
                </a>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLES.slice(0, 3).map((s) => (
                <button key={s.file} className="btn-ghost text-xs" onClick={() => loadSample(s.file)}>
                  + Load {s.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loaded tables */}
      {state.tables.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="label mb-0">Loaded tables:</span>
            {state.tables.map((t) => (
              <button
                key={t.name}
                onClick={() => dispatch({ type: 'setActiveTable', name: t.name })}
                className={`badge ${state.activeTableName === t.name ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {t.name} ({t.rows.length})
                <span className="ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'removeTable', name: t.name }); }}>×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Column mapping */}
      {activeTable && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ocean-900">Confirm column mapping — {activeTable.name}</h3>
            <button className="btn-ghost text-sm" onClick={reDetect}>↻ Re-run auto-detection</button>
          </div>

          <div className="mb-4">
            <div className="label">Detected data type</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map((dt) => (
                <button key={dt}
                  onClick={() => dispatch({ type: 'setDataType', dataType: dt })}
                  className={`badge ${state.dataType === dt ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {DATA_TYPE_LABELS[dt]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {MAPPABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <select
                  className="input w-full"
                  value={(state.columnMapping[f.key] as string) ?? ''}
                  onChange={(e) => dispatch({ type: 'setColumnMapping', mapping: { [f.key]: e.target.value || null } })}
                >
                  <option value="">— none —</option>
                  {activeTable.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="mt-0.5 text-xs text-slate-400">{f.hint}</div>
              </div>
            ))}
          </div>

          {/* Thresholds */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h4 className="mb-3 font-medium text-slate-700">Thresholds &amp; filtering</h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="label">Significance threshold</label>
                <input type="number" step="0.001" className="input w-full"
                  value={state.thresholds.significanceThreshold}
                  onChange={(e) => dispatch({ type: 'setThresholds', thresholds: { significanceThreshold: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label">Effect-size threshold (abs)</label>
                <input type="number" step="0.1" className="input w-full"
                  value={state.thresholds.effectSizeThreshold}
                  onChange={(e) => dispatch({ type: 'setThresholds', thresholds: { effectSizeThreshold: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label">Stronger evidence is…</label>
                <select className="input w-full" value={state.thresholds.smallerIsStronger ? 'smaller' : 'larger'}
                  onChange={(e) => dispatch({ type: 'setThresholds', thresholds: { smallerIsStronger: e.target.value === 'smaller' } })}>
                  <option value="smaller">Smaller values (p / FDR)</option>
                  <option value="larger">Larger values (score)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={state.thresholds.filterBeforeMapping}
                    onChange={(e) => dispatch({ type: 'setThresholds', thresholds: { filterBeforeMapping: e.target.checked } })} />
                  Filter rows before mapping
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 overflow-x-auto">
            <div className="label">Preview (first 5 rows)</div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  {activeTable.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1">
                      {h}
                      {mappedRole(state.columnMapping, h) && <div><Pill tone="ocean">{mappedRole(state.columnMapping, h)}</Pill></div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTable.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {activeTable.headers.map((h) => <td key={h} className="whitespace-nowrap px-2 py-1 text-slate-600">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <button className="btn-primary" disabled={!state.columnMapping.identifier}
              onClick={() => dispatch({ type: 'setPage', page: 'species' })}>
              Continue to species &amp; orthology →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function mappedRole(mapping: ColumnMapping, header: string): string | null {
  const entries = Object.entries(mapping) as [keyof ColumnMapping, unknown][];
  for (const [key, val] of entries) {
    if (key === 'annotationColumns') {
      if ((val as string[]).includes(header)) return 'annotation';
    } else if (val === header) {
      return key;
    }
  }
  return null;
}
