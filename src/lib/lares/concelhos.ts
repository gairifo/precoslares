// Registry of Portuguese concelhos for routing + display.
//
// Anchor list is the high-density set from the autocomplete sweep
// (preços lares + concelho returned suggestions). The full PT concelho
// list is ~308; we ship pages only for concelhos with at least 1 lar
// in the seed, plus the priority list (so empty-state pages are SEO-ready
// for the head-term autocompletes Pedro identified).

export interface Concelho {
  slug: string;
  nome: string;
  distritoSlug: string;
  /** Estimated population — used to prioritize when no real data exists.
   *  Approximate INE 2021 census numbers. */
  populacao?: number;
  /** Whether the concelho has dense autocomplete signal (≥ 5 suggestions
   *  for "lares [concelho]"). Drives the "Em destaque" group. */
  topAutocomplete: boolean;
}

/** Top concelhos identified in autocomplete + the per-concelho price seeds.
 *  Order roughly by autocomplete density + population. */
export const CONCELHOS: Concelho[] = [
  // Lisboa metro
  { slug: "lisboa", nome: "Lisboa", distritoSlug: "lisboa", populacao: 545923, topAutocomplete: true },
  { slug: "sintra", nome: "Sintra", distritoSlug: "lisboa", populacao: 385606, topAutocomplete: true },
  { slug: "loures", nome: "Loures", distritoSlug: "lisboa", populacao: 199494, topAutocomplete: true },
  { slug: "cascais", nome: "Cascais", distritoSlug: "lisboa", populacao: 214158, topAutocomplete: true },
  { slug: "oeiras", nome: "Oeiras", distritoSlug: "lisboa", populacao: 171802, topAutocomplete: true },
  { slug: "amadora", nome: "Amadora", distritoSlug: "lisboa", populacao: 171719, topAutocomplete: false },
  { slug: "odivelas", nome: "Odivelas", distritoSlug: "lisboa", populacao: 148710, topAutocomplete: true },

  // Porto metro
  { slug: "porto", nome: "Porto", distritoSlug: "porto", populacao: 231800, topAutocomplete: true },
  { slug: "vila-nova-de-gaia", nome: "Vila Nova de Gaia", distritoSlug: "porto", populacao: 304149, topAutocomplete: true },
  { slug: "matosinhos", nome: "Matosinhos", distritoSlug: "porto", populacao: 172669, topAutocomplete: true },
  { slug: "maia", nome: "Maia", distritoSlug: "porto", populacao: 134986, topAutocomplete: true },
  { slug: "gondomar", nome: "Gondomar", distritoSlug: "porto", populacao: 168027, topAutocomplete: false },
  { slug: "valongo", nome: "Valongo", distritoSlug: "porto", populacao: 95924, topAutocomplete: false },

  // Setúbal margin
  { slug: "almada", nome: "Almada", distritoSlug: "setubal", populacao: 174030, topAutocomplete: true },
  { slug: "barreiro", nome: "Barreiro", distritoSlug: "setubal", populacao: 76467, topAutocomplete: true },
  { slug: "setubal", nome: "Setúbal", distritoSlug: "setubal", populacao: 123684, topAutocomplete: true },

  // Other district capitals
  { slug: "braga", nome: "Braga", distritoSlug: "braga", populacao: 192494, topAutocomplete: true },
  { slug: "guimaraes", nome: "Guimarães", distritoSlug: "braga", populacao: 156830, topAutocomplete: true },
  { slug: "coimbra", nome: "Coimbra", distritoSlug: "coimbra", populacao: 140796, topAutocomplete: true },
  { slug: "aveiro", nome: "Aveiro", distritoSlug: "aveiro", populacao: 81328, topAutocomplete: true },
  { slug: "leiria", nome: "Leiria", distritoSlug: "leiria", populacao: 128640, topAutocomplete: true },
  { slug: "viseu", nome: "Viseu", distritoSlug: "viseu", populacao: 99274, topAutocomplete: true },
  { slug: "faro", nome: "Faro", distritoSlug: "faro", populacao: 67650, topAutocomplete: true },
  { slug: "evora", nome: "Évora", distritoSlug: "evora", populacao: 53585, topAutocomplete: true },
  { slug: "portimao", nome: "Portimão", distritoSlug: "faro", populacao: 55976, topAutocomplete: true },
  { slug: "vila-real", nome: "Vila Real", distritoSlug: "vila-real", populacao: 49056, topAutocomplete: true },
  { slug: "castelo-branco", nome: "Castelo Branco", distritoSlug: "castelo-branco", populacao: 54769, topAutocomplete: true },
  { slug: "guarda", nome: "Guarda", distritoSlug: "guarda", populacao: 40005, topAutocomplete: true },
  { slug: "chaves", nome: "Chaves", distritoSlug: "vila-real", populacao: 39040, topAutocomplete: true },
  { slug: "funchal", nome: "Funchal", distritoSlug: "madeira", populacao: 105795, topAutocomplete: true },
  { slug: "ponta-delgada", nome: "Ponta Delgada", distritoSlug: "acores", populacao: 67288, topAutocomplete: true },
];

export const CONCELHOS_BY_SLUG = Object.fromEntries(
  CONCELHOS.map((c) => [c.slug, c])
);

export const TOP_CONCELHOS = CONCELHOS.filter((c) => c.topAutocomplete);

export function getConcelho(slug: string): Concelho | null {
  return CONCELHOS_BY_SLUG[slug] ?? null;
}
