import type { NodeDatum } from '../lib/nodeData';
import type { NormalizedEntity } from '../types/model';
import { externalLink, identifierTypeLabel } from '../lib/identifiers';
import { Pill } from './common';

interface Props {
  nd: NodeDatum | null;
  pathwayId: string;
  onClose: () => void;
}

export function NodePanel({ nd, pathwayId, onClose }: Props) {
  if (!nd) {
    return (
      <div className="card p-4 text-sm text-slate-500">
        Select a node in the diagram to see mapped features, values, and external links.
      </div>
    );
  }
  const { entity, matched, mappingTypes } = nd;
  const entityXrefLinks = xrefLinks(entity.xrefs);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Pathway entity</div>
          <div className="text-lg font-semibold text-ocean-900">{entity.label}</div>
          <Pill tone="slate">{entity.entityType}</Pill>
        </div>
        <button className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {entityXrefLinks.length > 0 && (
        <div>
          <div className="label">Pathway entity references</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {entityXrefLinks.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="text-ocean-600 hover:underline">{l.label} ↗</a>
            ))}
          </div>
        </div>
      )}

      {matched.length === 0 ? (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
          No uploaded feature maps to this entity (unmapped).
        </div>
      ) : (
        <div className="space-y-3">
          <div className="label">Mapped features ({matched.length})</div>
          {matched.map((e) => (
            <MatchedFeature key={e.rowId} e={e} mappingTypes={mappingTypes} />
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">
        Node {entity.nodeId} · pathway {pathwayId}
      </div>
    </div>
  );
}

function MatchedFeature({ e, mappingTypes }: { e: NormalizedEntity; mappingTypes: string[] }) {
  const link = externalLink(e.identifierType, e.identifier);
  const mtype = mappingTypes[0] ?? 'direct';
  const dirTone = e.direction === 'up' ? 'rose' : e.direction === 'down' ? 'ocean' : 'slate';
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono font-medium text-slate-700">
          {link ? <a href={link} target="_blank" rel="noreferrer" className="text-ocean-600 hover:underline">{e.identifier} ↗</a> : e.identifier}
        </span>
        <Pill tone="ocean">{e.omicsLayer}</Pill>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        {e.label && <Row k="Label" v={e.label} />}
        <Row k="ID type" v={identifierTypeLabel(e.identifierType)} />
        <Row k="Mapping" v={mtypeLabel(mtype)} />
        <Row k="Effect size" v={e.effectSize == null ? '—' : e.effectSize.toFixed(3)} />
        <Row k="Significance" v={e.significance == null ? '—' : e.significance.toExponential(2)} />
        <Row k="Significant" v={e.significant ? 'yes' : 'no'} />
        <Row k="Direction" v={<Pill tone={dirTone as 'rose' | 'ocean' | 'slate'}>{e.direction}</Pill>} />
        {e.dmr && <Row k="DMR link" v={`${e.dmr.linkMethod} (inferred)`} />}
      </div>
      {e.dmr && (
        <div className="mt-1 text-[11px] text-amber-700">
          DMR {e.dmr.dmrId ?? ''} at {e.dmr.chromosome}:{e.dmr.start}-{e.dmr.end}. DMR-to-gene association is inferred, not direct expression evidence.
        </div>
      )}
      {Object.keys(e.annotations).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(e.annotations).map(([k, v]) => <span key={k} className="badge bg-white text-slate-500">{k}: {v}</span>)}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <><span className="text-slate-400">{k}</span><span className="text-right">{v}</span></>;
}

function mtypeLabel(t: string): string {
  return { direct: 'Direct', orthology: 'Orthology-based', ambiguous: 'Ambiguous (one-to-many)', inferred: 'Inferred' }[t] ?? t;
}

function xrefLinks(xrefs: Record<string, string[] | undefined>): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const order: [string, string][] = [
    ['uniprot', 'UniProt'], ['ncbi_gene', 'NCBI Gene'], ['ensembl', 'Ensembl'], ['chebi', 'ChEBI'],
  ];
  for (const [type, label] of order) {
    const vals = xrefs[type];
    if (vals && vals[0]) {
      const url = externalLink(type as never, vals[0]);
      if (url) out.push({ label, url });
    }
  }
  return out;
}
