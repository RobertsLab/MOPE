/**
 * Organism presets. Study-organism presets are optimized for marine genomics
 * and aquaculture; reference organisms are those with pathway/identifier
 * coverage suitable for ortholog mapping.
 *
 * `taxGroup` is a coarse clade used for a simple evolutionary-distance
 * heuristic (see lib/ortholog.ts::isDistantReference). It is intentionally
 * coarse and only drives a transparency warning, never a hard decision.
 */

export type TaxGroup =
  | 'mammal'
  | 'fish'
  | 'insect'
  | 'nematode'
  | 'echinoderm'
  | 'mollusc'
  | 'cnidarian'
  | 'other';

export interface OrganismPreset {
  id: string;
  common: string;
  scientific: string;
  taxGroup: TaxGroup;
  /** True if this organism has direct pathway coverage in the bundled library. */
  hasDirectCoverage: boolean;
  note?: string;
}

/** Reference organisms offered for ortholog mapping. */
export const REFERENCE_ORGANISMS: OrganismPreset[] = [
  { id: 'hsapiens', common: 'Human', scientific: 'Homo sapiens', taxGroup: 'mammal', hasDirectCoverage: true },
  { id: 'mmusculus', common: 'Mouse', scientific: 'Mus musculus', taxGroup: 'mammal', hasDirectCoverage: true },
  { id: 'drerio', common: 'Zebrafish', scientific: 'Danio rerio', taxGroup: 'fish', hasDirectCoverage: true },
  { id: 'dmelanogaster', common: 'Fruit fly', scientific: 'Drosophila melanogaster', taxGroup: 'insect', hasDirectCoverage: true },
  { id: 'celegans', common: 'Roundworm', scientific: 'Caenorhabditis elegans', taxGroup: 'nematode', hasDirectCoverage: true },
  { id: 'spurpuratus', common: 'Purple sea urchin', scientific: 'Strongylocentrotus purpuratus', taxGroup: 'echinoderm', hasDirectCoverage: true },
  { id: 'cgigas', common: 'Pacific oyster', scientific: 'Crassostrea gigas', taxGroup: 'mollusc', hasDirectCoverage: true },
  { id: 'cvirginica', common: 'Eastern oyster', scientific: 'Crassostrea virginica', taxGroup: 'mollusc', hasDirectCoverage: true },
];

/** Study-organism presets tuned for marine / aquaculture users. */
export const STUDY_ORGANISM_PRESETS: OrganismPreset[] = [
  { id: 'cgigas', common: 'Pacific oyster', scientific: 'Crassostrea gigas', taxGroup: 'mollusc', hasDirectCoverage: true },
  { id: 'cvirginica', common: 'Eastern oyster', scientific: 'Crassostrea virginica', taxGroup: 'mollusc', hasDirectCoverage: true },
  { id: 'olurida', common: 'Olympia oyster', scientific: 'Ostrea lurida', taxGroup: 'mollusc', hasDirectCoverage: false, note: 'Map via ortholog reference or a custom ortholog table.' },
  { id: 'rphilippinarum', common: 'Manila clam', scientific: 'Ruditapes philippinarum', taxGroup: 'mollusc', hasDirectCoverage: false, note: 'Map via ortholog reference or a custom ortholog table.' },
  { id: 'mytilus', common: 'Mussels', scientific: 'Mytilus spp.', taxGroup: 'mollusc', hasDirectCoverage: false, note: 'Map via ortholog reference or a custom ortholog table.' },
  { id: 'pycnopodia', common: 'Sunflower sea star', scientific: 'Pycnopodia helianthoides', taxGroup: 'echinoderm', hasDirectCoverage: false, note: 'Map via S. purpuratus or human reference.' },
  { id: 'pisaster', common: 'Ochre sea star', scientific: 'Pisaster spp.', taxGroup: 'echinoderm', hasDirectCoverage: false, note: 'Map via S. purpuratus or human reference.' },
  { id: 'coral', common: 'Corals', scientific: 'Anthozoa', taxGroup: 'cnidarian', hasDirectCoverage: false, note: 'Map via human reference or a custom ortholog table; expect large evolutionary distance.' },
  { id: 'gmacrocephalus', common: 'Pacific cod', scientific: 'Gadus macrocephalus', taxGroup: 'fish', hasDirectCoverage: false, note: 'Map via zebrafish or human reference.' },
  { id: 'drerio', common: 'Zebrafish', scientific: 'Danio rerio', taxGroup: 'fish', hasDirectCoverage: true },
  { id: 'hsapiens', common: 'Human (reference)', scientific: 'Homo sapiens', taxGroup: 'mammal', hasDirectCoverage: true },
];

const ALL = [...REFERENCE_ORGANISMS, ...STUDY_ORGANISM_PRESETS];

export function findOrganism(idOrScientific: string): OrganismPreset | undefined {
  const key = idOrScientific.trim().toLowerCase();
  return ALL.find(
    (o) => o.id.toLowerCase() === key || o.scientific.toLowerCase() === key || o.common.toLowerCase() === key,
  );
}

export function taxGroupOf(idOrScientific: string): TaxGroup {
  return findOrganism(idOrScientific)?.taxGroup ?? 'other';
}
