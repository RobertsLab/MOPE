import { useMemo } from 'react';
import { useStore } from '../state/store';
import { useDerived } from '../state/useDerived';
import { SectionTitle, InfoBanner } from '../components/common';
import {
  toDelimited, downloadBlob,
  buildMatchedEntitiesExport, MATCHED_COLUMNS,
  buildUnmatchedExport, UNMATCHED_COLUMNS,
  auditToRows, AUDIT_COLUMNS,
  rankingToRows, RANKING_COLUMNS,
  buildSessionFile, buildMethodsText,
} from '../lib/exports';
import { getPathway } from '../data/pathwayLibrary';

export default function ExportPage() {
  const { state, dispatch } = useStore();
  const { entities, mapping, scores, mode } = useDerived();

  const usedOrthology = state.species.mode !== 'direct';
  const methods = useMemo(() => {
    const sources = state.pathwaySource === 'all'
      ? ['WikiPathways', 'Reactome']
      : [state.pathwaySource === 'wikipathways' ? 'WikiPathways' : 'Reactome'];
    return buildMethodsText({
      sources,
      effectField: state.columnMapping.effectSize ?? 'effect size',
      significanceField: state.columnMapping.significance ?? 'adjusted p-value',
      threshold: `${state.thresholds.smallerIsStronger ? '<' : '>'} ${state.thresholds.significanceThreshold}`,
      referenceSpecies: state.species.referenceSpecies,
      mode,
      usedOrthology,
    });
  }, [state, mode, usedOrthology]);

  const dl = (rows: Record<string, unknown>[], cols: string[], base: string, delimiter: ',' | '\t') => {
    const content = toDelimited(rows, cols, delimiter);
    downloadBlob(content, `${base}.${delimiter === ',' ? 'csv' : 'tsv'}`, 'text/plain');
  };

  const matchedRows = buildMatchedEntitiesExport(entities, mapping.evidence) as unknown as Record<string, unknown>[];
  const unmatchedRows = buildUnmatchedExport(mapping.audit);
  const auditRows = auditToRows(mapping.audit);
  const rankingRows = rankingToRows(scores);

  const exportSession = () => {
    const session = buildSessionFile({
      columnMapping: state.columnMapping, thresholds: state.thresholds, species: state.species,
      dataType: state.dataType, pathwaySource: state.pathwaySource,
      selectedPathwayId: state.visualization.pathwayId, visualization: state.visualization,
      tableNames: state.tables.map((t) => t.name),
    });
    downloadBlob(JSON.stringify(session, null, 2), 'marine_pathway_mapper_session.json', 'application/json');
  };

  const exportMethods = () => downloadBlob(methods, 'methods_summary.txt', 'text/plain');

  const selectedPathway = state.visualization.pathwayId ? getPathway(state.visualization.pathwayId) : null;
  const citation = buildCitation(scores.map((s) => getPathway(s.pathwayId)!).filter(Boolean));

  const groups: { title: string; items: { label: string; onCsv?: () => void; onTsv?: () => void; onClick?: () => void; note?: string }[] }[] = [
    {
      title: 'Data tables',
      items: [
        { label: `Matched pathway entities (${matchedRows.length} rows)`, onCsv: () => dl(matchedRows, MATCHED_COLUMNS, 'matched_entities', ','), onTsv: () => dl(matchedRows, MATCHED_COLUMNS, 'matched_entities', '\t') },
        { label: `Unmatched identifiers (${unmatchedRows.length} rows)`, onCsv: () => dl(unmatchedRows, UNMATCHED_COLUMNS, 'unmatched_identifiers', ','), onTsv: () => dl(unmatchedRows, UNMATCHED_COLUMNS, 'unmatched_identifiers', '\t') },
        { label: `Mapping audit table (${auditRows.length} rows)`, onCsv: () => dl(auditRows, AUDIT_COLUMNS, 'mapping_audit', ','), onTsv: () => dl(auditRows, AUDIT_COLUMNS, 'mapping_audit', '\t') },
        { label: `Pathway ranking / ${mode === 'enrichment' ? 'enrichment' : 'mapping'} summary (${rankingRows.length} rows)`, onCsv: () => dl(rankingRows, RANKING_COLUMNS, 'pathway_ranking', ','), onTsv: () => dl(rankingRows, RANKING_COLUMNS, 'pathway_ranking', '\t') },
      ],
    },
    {
      title: 'Figures',
      items: [
        { label: 'Publication SVG / high-res PNG', onClick: () => dispatch({ type: 'setPage', page: 'viewer' }), note: selectedPathway ? `Open the viewer for ${selectedPathway.name} and use its SVG/PNG buttons (vector SVG includes an embedded legend).` : 'Select a pathway in the viewer first.' },
      ],
    },
    {
      title: 'Reproducibility',
      items: [
        { label: 'Session file (JSON)', onClick: exportSession, note: 'Column assignments, species/orthology, thresholds, source, selected pathway, colors, date, version.' },
        { label: 'Methods summary (plain text)', onClick: exportMethods },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="Download tables, figures, a reproducible session file, and a manuscript-ready methods paragraph.">
        Step 6 — Export &amp; methods
      </SectionTitle>

      {mode === 'mapping_summary' && (
        <InfoBanner tone="caution">
          Exports are labeled as a <strong>mapping summary</strong>: no background universe was supplied, so p-values are not included.
          Enable a background on the Pathways page to produce a statistical enrichment summary.
        </InfoBanner>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="card p-4">
            <h3 className="mb-3 font-semibold text-ocean-800">{g.title}</h3>
            <div className="space-y-3">
              {g.items.map((it) => (
                <div key={it.label} className="text-sm">
                  <div className="text-slate-700">{it.label}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {it.onCsv && <button className="btn-secondary py-1 text-xs" onClick={it.onCsv}>↓ CSV</button>}
                    {it.onTsv && <button className="btn-secondary py-1 text-xs" onClick={it.onTsv}>↓ TSV</button>}
                    {it.onClick && <button className="btn-secondary py-1 text-xs" onClick={it.onClick}>{it.note ? 'Open / Download' : 'Download'}</button>}
                  </div>
                  {it.note && <div className="mt-1 text-xs text-slate-400">{it.note}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Methods preview */}
      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-ocean-800">Methods summary preview</h3>
          <button className="btn-ghost text-xs" onClick={exportMethods}>↓ Download .txt</button>
        </div>
        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">{methods}</p>
      </div>

      {/* Citation */}
      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">Cite your pathway sources</h3>
        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">{citation}</p>
      </div>
    </div>
  );
}

function buildCitation(pathways: { id: string; source: string; name: string; sourceUrl: string }[]): string {
  const hasWp = pathways.some((p) => p.source === 'wikipathways');
  const hasRx = pathways.some((p) => p.source === 'reactome');
  const lines: string[] = [];
  if (hasWp) lines.push('WikiPathways — cite the current WikiPathways database publication and the specific pathway IDs used (see "How to cite" at https://www.wikipathways.org). Content is released under CC0.');
  if (hasRx) lines.push('Reactome — cite the current Reactome Pathway Knowledgebase publication and the specific pathway IDs used (see the citation guidance at https://reactome.org/cite). Content is released under CC-BY 4.0.');
  const ids = pathways.map((p) => p.id).slice(0, 40).join(', ');
  if (ids) lines.push(`Pathway IDs referenced in this analysis: ${ids}${pathways.length > 40 ? ', …' : ''}.`);
  lines.push('Marine Omics Pathway Explorer (this tool) performed identifier mapping and visualization only; pathway content, names, and identifiers belong to the sources above.');
  return lines.join('\n\n');
}
