/**
 * Global application state.
 *
 * A single reducer holds the raw uploaded tables, the confirmed column
 * mapping, thresholds, species/orthology settings, and visualization state.
 * Derived products (normalized entities, mapping result, pathway scores,
 * warnings) are computed with useMemo in {@link useDerived} so the pipeline
 * stays a pure function of inputs — this is what makes sessions reproducible.
 */
import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type {
  AnalysisThresholds,
  ColumnMapping,
  DataType,
  PathwaySource,
  SpeciesSettings,
  VisualizationState,
} from '../types/model';
import type { ParsedTable } from '../lib/parse';
import { detectColumns, detectDataType } from '../lib/parse';
import type { OrthologTableMapping } from '../lib/ortholog';
import { DEFAULT_THRESHOLDS } from '../lib/normalize';

export type PageId =
  | 'landing'
  | 'upload'
  | 'species'
  | 'summary'
  | 'discovery'
  | 'viewer'
  | 'export'
  | 'docs'
  | 'about';

export interface AppState {
  page: PageId;
  tables: ParsedTable[];
  activeTableName: string | null;
  columnMapping: ColumnMapping;
  dataType: DataType;
  thresholds: AnalysisThresholds;
  species: SpeciesSettings;
  /** Parsed ortholog table + its column mapping (user-table / reference mode). */
  orthologTable: ParsedTable | null;
  orthologMapping: OrthologTableMapping | null;
  /** Whether a background universe should be used for enrichment. */
  useBackground: boolean;
  pathwaySource: PathwaySource | 'all';
  visualization: VisualizationState;
}

const defaultVisualization: VisualizationState = {
  pathwayId: null,
  styleMode: 'abundance',
  hideUnmapped: false,
  showLegend: true,
  activeLayers: ['rna', 'methylation', 'protein', 'metabolite', 'generic'],
  zoom: 1,
  panX: 0,
  panY: 0,
  selectedNodeId: null,
  colorblindSafe: true,
};

const emptyMapping: ColumnMapping = {
  identifier: null, label: null, effectSize: null, significance: null,
  direction: null, omicsLayer: null, chromosome: null, start: null, end: null,
  nearestGene: null, dmrId: null, annotationColumns: [],
};

export const initialState: AppState = {
  page: 'landing',
  tables: [],
  activeTableName: null,
  columnMapping: emptyMapping,
  dataType: 'generic',
  thresholds: DEFAULT_THRESHOLDS,
  species: { mode: 'direct', studySpecies: 'Homo sapiens', referenceSpecies: null, distantReference: false },
  orthologTable: null,
  orthologMapping: null,
  useBackground: false,
  pathwaySource: 'all',
  visualization: defaultVisualization,
};

export type Action =
  | { type: 'setPage'; page: PageId }
  | { type: 'addTable'; table: ParsedTable }
  | { type: 'setTables'; tables: ParsedTable[]; activeName: string | null }
  | { type: 'setActiveTable'; name: string }
  | { type: 'removeTable'; name: string }
  | { type: 'setColumnMapping'; mapping: Partial<ColumnMapping> }
  | { type: 'setDataType'; dataType: DataType }
  | { type: 'setThresholds'; thresholds: Partial<AnalysisThresholds> }
  | { type: 'setSpecies'; species: Partial<SpeciesSettings> }
  | { type: 'setOrthologTable'; table: ParsedTable | null; mapping: OrthologTableMapping | null }
  | { type: 'setUseBackground'; value: boolean }
  | { type: 'setPathwaySource'; source: PathwaySource | 'all' }
  | { type: 'setVisualization'; vis: Partial<VisualizationState> }
  | { type: 'loadSession'; state: Partial<AppState> }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setPage':
      return { ...state, page: action.page };
    case 'addTable': {
      const tables = [...state.tables.filter((t) => t.name !== action.table.name), action.table];
      const activeTableName = state.activeTableName ?? action.table.name;
      let next = { ...state, tables, activeTableName };
      // Auto-detect columns/type from the first table added.
      if (state.tables.length === 0) {
        const mapping = detectColumns(action.table);
        const dataType = detectDataType(action.table, mapping);
        next = { ...next, columnMapping: mapping, dataType };
      }
      return next;
    }
    case 'setTables':
      return { ...state, tables: action.tables, activeTableName: action.activeName };
    case 'setActiveTable':
      return { ...state, activeTableName: action.name };
    case 'removeTable': {
      const tables = state.tables.filter((t) => t.name !== action.name);
      const activeTableName = state.activeTableName === action.name ? (tables[0]?.name ?? null) : state.activeTableName;
      return { ...state, tables, activeTableName };
    }
    case 'setColumnMapping':
      return { ...state, columnMapping: { ...state.columnMapping, ...action.mapping } };
    case 'setDataType':
      return { ...state, dataType: action.dataType };
    case 'setThresholds':
      return { ...state, thresholds: { ...state.thresholds, ...action.thresholds } };
    case 'setSpecies':
      return { ...state, species: { ...state.species, ...action.species } };
    case 'setOrthologTable':
      return { ...state, orthologTable: action.table, orthologMapping: action.mapping };
    case 'setUseBackground':
      return { ...state, useBackground: action.value };
    case 'setPathwaySource':
      return { ...state, pathwaySource: action.source };
    case 'setVisualization':
      return { ...state, visualization: { ...state.visualization, ...action.vis } };
    case 'loadSession':
      return { ...state, ...action.state };
    case 'reset':
      return { ...initialState };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
