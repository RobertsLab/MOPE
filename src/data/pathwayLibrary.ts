/**
 * Access layer for the bundled curated pathway library.
 *
 * The library is a static, offline-usable core drawn from WikiPathways and
 * Reactome categories relevant to marine, stress, immune, metabolic, and
 * epigenetic biology. Members are reference (human) gene symbols plus ChEBI
 * for metabolites — the most broadly matchable identifiers. Live WikiPathways
 * / Reactome fetching is a modular extension (see lib/liveSources.ts) and is
 * never required for ordinary use.
 */
import raw from './pathways.json';
import type { Pathway, PathwayCategory, PathwaySource } from '../types/model';

export const PATHWAYS: Pathway[] = raw as unknown as Pathway[];

const BY_ID = new Map(PATHWAYS.map((p) => [p.id, p]));

export function getPathway(id: string): Pathway | undefined {
  return BY_ID.get(id);
}

export function allPathways(): Pathway[] {
  return PATHWAYS;
}

export function pathwaysBySource(source: PathwaySource): Pathway[] {
  return PATHWAYS.filter((p) => p.source === source);
}

export function pathwaysByCategory(category: PathwayCategory): Pathway[] {
  return PATHWAYS.filter((p) => p.categories.includes(category));
}

export const CATEGORY_LABELS: Record<PathwayCategory, string> = {
  metabolism: 'Metabolism',
  energy_metabolism: 'Energy metabolism',
  amino_acid_metabolism: 'Amino acid metabolism',
  lipid_metabolism: 'Lipid metabolism',
  oxidative_stress: 'Oxidative stress',
  immunity: 'Immunity',
  signal_transduction: 'Signal transduction',
  cell_cycle: 'Cell cycle',
  apoptosis: 'Apoptosis',
  reproduction: 'Reproduction',
  epigenetic_regulation: 'Epigenetic regulation',
  environmental_stress: 'Environmental stress response',
  disease: 'Disease-associated',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as PathwayCategory[];

/** Total distinct reference gene symbols across the library (background size). */
export function librarySymbolUniverse(): Set<string> {
  const s = new Set<string>();
  for (const p of PATHWAYS) {
    for (const e of p.entities) {
      const syms = e.xrefs.gene_symbol ?? [];
      syms.forEach((x) => s.add(x.toUpperCase()));
    }
  }
  return s;
}
