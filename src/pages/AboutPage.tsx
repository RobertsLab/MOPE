import { SectionTitle } from '../components/common';
import { PATHWAYS } from '../data/pathwayLibrary';
import { APP_VERSION } from '../types/model';

export default function AboutPage() {
  const wpCount = PATHWAYS.filter((p) => p.source === 'wikipathways').length;
  const rxCount = PATHWAYS.filter((p) => p.source === 'reactome').length;

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="Data sources, attribution, licensing, and scope.">About &amp; data-source attribution</SectionTitle>

      <div className="card p-6">
        <h3 className="mb-2 text-lg font-semibold text-ocean-900">Marine Omics Pathway Mapper</h3>
        <p className="text-sm text-slate-600">
          A free, browser-based tool for mapping marine and non-model organism omics results onto biological pathways.
          Everything runs client-side — your data never leaves your computer, and no API key is required for ordinary use.
          Version {APP_VERSION}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-ocean-800">WikiPathways</h3>
          <p className="text-sm text-slate-600">
            Community-curated, openly editable pathway diagrams. This app bundles {wpCount} WikiPathways pathways with their
            gene/protein/metabolite entities and identifiers, retrieved from WikiPathways. Pathway content, identifiers,
            names, and organism metadata belong to WikiPathways and its contributors.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Content is released under CC0. Please preserve attribution and cite WikiPathways.
            <br />
            <a className="text-ocean-600 hover:underline" href="https://www.wikipathways.org" target="_blank" rel="noreferrer">wikipathways.org ↗</a>
          </p>
        </div>
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-ocean-800">Reactome</h3>
          <p className="text-sm text-slate-600">
            An expert-curated, peer-reviewed pathway knowledgebase covering signaling, immunity, cell cycle, metabolism,
            stress response, chromatin regulation, apoptosis, and development. This app bundles {rxCount} Reactome pathways
            with reference entities retrieved from the Reactome ContentService.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Content is released under CC-BY 4.0. Please cite Reactome.
            <br />
            <a className="text-ocean-600 hover:underline" href="https://reactome.org" target="_blank" rel="noreferrer">reactome.org ↗</a>
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">External reference layer (link-out only)</h3>
        <p className="text-sm text-slate-600">
          Identifiers such as KEGG IDs, EC numbers, KO identifiers, UniProt accessions, Ensembl IDs, NCBI Gene IDs, ChEBI,
          and HMDB are used for matching and external links. <strong>KEGG is link-only</strong>: this app never reproduces
          or redistributes proprietary KEGG pathway images. Where KEGG identifiers are detected, only external links are provided.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">Scope &amp; limitations</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>The bundled library is a curated static core for offline use — it is not the complete WikiPathways/Reactome collection. Live API synchronization is a planned modular extension.</li>
          <li>Pathway topology in the viewer uses source layout coordinates where available (WikiPathways) or a clean generated layout (Reactome); it is a readable approximation, not a byte-for-byte reproduction of the source diagram.</li>
          <li>Ortholog-based mappings are annotations, not direct evidence. Results should be interpreted with orthology quality, annotation completeness, and background choice in mind.</li>
          <li>Pathway overlap does not imply causation. This is a mapping and enrichment aid, not a substitute for experimental validation.</li>
        </ul>
      </div>

      <div className="card p-5">
        <h3 className="mb-2 font-semibold text-ocean-800">Technology &amp; licensing</h3>
        <p className="text-sm text-slate-600">
          Built with React, TypeScript, Vite, Tailwind CSS, and D3.js. Client-side CSV/TSV/XLSX parsing (papaparse, SheetJS).
          The application code is MIT-licensed. Bundled pathway data retains its original source licenses (WikiPathways CC0, Reactome CC-BY 4.0).
        </p>
      </div>
    </div>
  );
}
