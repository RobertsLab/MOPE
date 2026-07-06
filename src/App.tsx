import { useStore, type PageId } from './state/store';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import SpeciesPage from './pages/SpeciesPage';
import SummaryPage from './pages/SummaryPage';
import DiscoveryPage from './pages/DiscoveryPage';
import ViewerPage from './pages/ViewerPage';
import ExportPage from './pages/ExportPage';
import DocsPage from './pages/DocsPage';
import AboutPage from './pages/AboutPage';

const NAV: { id: PageId; label: string; step?: number }[] = [
  { id: 'landing', label: 'Home' },
  { id: 'upload', label: 'Upload & Map', step: 1 },
  { id: 'species', label: 'Species', step: 2 },
  { id: 'summary', label: 'Mapping Quality', step: 3 },
  { id: 'discovery', label: 'Pathways', step: 4 },
  { id: 'viewer', label: 'Visualize', step: 5 },
  { id: 'export', label: 'Export & Methods', step: 6 },
  { id: 'docs', label: 'Docs' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const { state, dispatch } = useStore();
  const hasData = state.tables.length > 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <button
            className="flex items-center gap-2 font-semibold text-ocean-800"
            onClick={() => dispatch({ type: 'setPage', page: 'landing' })}
          >
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            TidePath: Marine Omics Pathway Mapper
          </button>
          <nav className="ml-auto flex flex-wrap items-center gap-1">
            {NAV.map((n) => {
              const disabled = !hasData && n.step != null && n.step > 1;
              const active = state.page === n.id;
              return (
                <button
                  key={n.id}
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'setPage', page: n.id })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-ocean-600 text-white' : 'text-slate-600 hover:bg-ocean-50'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  title={disabled ? 'Upload data first' : undefined}
                >
                  {n.step ? `${n.step}. ` : ''}{n.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {state.page === 'landing' && <LandingPage />}
        {state.page === 'upload' && <UploadPage />}
        {state.page === 'species' && <SpeciesPage />}
        {state.page === 'summary' && <SummaryPage />}
        {state.page === 'discovery' && <DiscoveryPage />}
        {state.page === 'viewer' && <ViewerPage />}
        {state.page === 'export' && <ExportPage />}
        {state.page === 'docs' && <DocsPage />}
        {state.page === 'about' && <AboutPage />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        TidePath: Marine Omics Pathway Mapper — free, client-side pathway mapping. Pathway data from WikiPathways (CC0) and Reactome (CC-BY 4.0).
        Results are a mapping aid; interpret with orthology quality and annotation completeness in mind.
      </footer>
    </div>
  );
}
