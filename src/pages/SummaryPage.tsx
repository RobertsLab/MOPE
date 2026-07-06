import { useStore } from '../state/store';
import { useDerived } from '../state/useDerived';
import { SectionTitle, Stat, WarningList, Pill, EmptyState } from '../components/common';
import { identifierTypeLabel } from '../lib/identifiers';
import { toDelimited, auditToRows, AUDIT_COLUMNS, downloadBlob } from '../lib/exports';
import type { IdentifierType } from '../types/model';

export default function SummaryPage() {
  const { dispatch } = useStore();
  const { mapping, warnings, entities } = useDerived();
  const s = mapping.summary;

  if (entities.length === 0) {
    return <EmptyState title="No data loaded">Upload a table on the Upload page first.</EmptyState>;
  }

  const mappedTotal = s.mappedDirect + s.mappedOrthology;
  const exportAudit = (delimiter: ',' | '\t') => {
    const content = toDelimited(auditToRows(mapping.audit), AUDIT_COLUMNS, delimiter);
    downloadBlob(content, `mapping_audit.${delimiter === ',' ? 'csv' : 'tsv'}`, 'text/plain');
  };

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="How well your uploaded features connect to pathway entities. Every number is exportable in the audit table.">
        Step 3 — Mapping quality summary
      </SectionTitle>

      <WarningList warnings={warnings} title="Transparency notes" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Uploaded features" value={s.totalUploaded} />
        <Stat label="Recognized identifiers" value={s.recognized} hint={`${pct(s.recognized, s.totalUploaded)}%`} />
        <Stat label="Mapped (direct)" value={s.mappedDirect} />
        <Stat label="Mapped (orthology)" value={s.mappedOrthology} hint={`${Math.round(s.orthologyFraction * 100)}% of mapped`} />
        <Stat label="One-to-many mappings" value={s.oneToMany} />
        <Stat label="Unmapped" value={s.unmapped} hint={`${pct(s.unmapped, s.totalUploaded)}%`} />
        <Stat label="Excluded by filter" value={s.excludedByFilter} />
        <Stat label="Total mapped" value={mappedTotal} hint={`${pct(mappedTotal, s.totalUploaded)}%`} />
      </div>

      {/* Mapping bar */}
      <div className="card p-5">
        <div className="mb-2 label">Feature disposition</div>
        <div className="flex h-6 w-full overflow-hidden rounded-md">
          <Bar value={s.mappedDirect} total={s.totalUploaded} color="#2171b5" title="Direct" />
          <Bar value={s.mappedOrthology} total={s.totalUploaded} color="#6a51a3" title="Orthology" />
          <Bar value={s.oneToMany} total={s.totalUploaded} color="#d94801" title="One-to-many (subset)" />
          <Bar value={s.unmapped} total={s.totalUploaded} color="#cbd5e1" title="Unmapped" />
          <Bar value={s.excludedByFilter} total={s.totalUploaded} color="#94a3b8" title="Excluded" />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
          <Legend color="#2171b5" label="Direct" />
          <Legend color="#6a51a3" label="Orthology" />
          <Legend color="#d94801" label="One-to-many (subset of mapped)" />
          <Legend color="#cbd5e1" label="Unmapped" />
          <Legend color="#94a3b8" label="Excluded by filter" />
        </div>
      </div>

      {/* Identifier types */}
      <div className="card p-5">
        <div className="mb-2 label">Identifier types detected</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(s.identifierTypes).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <Pill key={t} tone="ocean">{identifierTypeLabel(t as IdentifierType)}: {n}</Pill>
          ))}
        </div>
      </div>

      {/* Audit table */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="label mb-0">Mapping audit table</div>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => exportAudit(',')}>↓ CSV</button>
            <button className="btn-ghost text-xs" onClick={() => exportAudit('\t')}>↓ TSV</button>
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                {['Identifier', 'ID type', 'Label', 'Layer', 'Mapped', 'Mapping', 'Reference', '1:many', '# pathways', 'Note'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapping.audit.slice(0, 300).map((a) => (
                <tr key={a.rowId} className="border-b border-slate-100">
                  <td className="px-2 py-1 font-mono">{a.identifier}</td>
                  <td className="px-2 py-1">{identifierTypeLabel(a.identifierType)}</td>
                  <td className="px-2 py-1">{a.label ?? ''}</td>
                  <td className="px-2 py-1">{a.omicsLayer}</td>
                  <td className="px-2 py-1">{a.mapped ? <Pill tone="green">yes</Pill> : <Pill tone="slate">no</Pill>}</td>
                  <td className="px-2 py-1">{a.mappingType}</td>
                  <td className="px-2 py-1 font-mono">{a.referenceId ?? ''}</td>
                  <td className="px-2 py-1">{a.oneToMany ? <Pill tone="amber">yes</Pill> : ''}</td>
                  <td className="px-2 py-1 text-center">{a.matchedPathways}</td>
                  <td className="px-2 py-1 text-slate-400">{a.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mapping.audit.length > 300 && <div className="p-2 text-xs text-slate-400">Showing first 300 rows — export for the full table.</div>}
        </div>
      </div>

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => dispatch({ type: 'setPage', page: 'species' })}>← Back</button>
        <button className="btn-primary" onClick={() => dispatch({ type: 'setPage', page: 'discovery' })}>Discover pathways →</button>
      </div>
    </div>
  );
}

function pct(n: number, total: number) { return total ? Math.round((n / total) * 100) : 0; }

function Bar({ value, total, color, title }: { value: number; total: number; color: string; title: string }) {
  const w = total ? (value / total) * 100 : 0;
  if (w <= 0) return null;
  return <div style={{ width: `${w}%`, background: color }} title={`${title}: ${value}`} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />{label}</span>;
}
