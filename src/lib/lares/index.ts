// Public API for the lares dataset.
//
// Pure data lookups; no DOM, no fetch. Loaded at build time via JSON
// import attribute, validated against the Zod schema (single source of
// truth), frozen, and queried by slug / concelho / filter.
//
// Zod is imported via `astro/zod` — already in the Astro bundle, so no
// extra runtime cost. This module is server-side only; React islands
// import the slim shape from `./client.ts` instead.

import data from "~/data/lares.json" with { type: "json" };
import { LarSchema, DatasetMetaSchema } from "./schema";
import type { Lar, LarTipo, LarValencia } from "./types";
import { CONCELHOS, getConcelho } from "./concelhos";

const parsed = LarSchema.array().safeParse(data.lares);
if (!parsed.success) {
  const first = parsed.error.issues[0];
  throw new Error(
    `Invalid lares.json entry [${first?.path.join(".") ?? "?"}]: ${first?.message}`,
  );
}
const metaParsed = data._meta
  ? DatasetMetaSchema.safeParse(data._meta)
  : ({ success: true, data: undefined } as const);
if (!metaParsed.success) {
  throw new Error(
    `Invalid lares.json _meta: ${metaParsed.error.issues[0]?.message}`,
  );
}

const LARES: ReadonlyArray<Lar> = Object.freeze(parsed.data as Lar[]);

export const META = metaParsed.success ? metaParsed.data : undefined;

export function getAllLares(): ReadonlyArray<Lar> {
  return LARES;
}

export function getLarBySlug(slug: string, concelhoSlug?: string): Lar | null {
  for (const l of LARES) {
    if (l.slug !== slug) continue;
    if (concelhoSlug && l.concelhoSlug !== concelhoSlug) continue;
    return l;
  }
  return null;
}

export function getLaresByConcelho(concelhoSlug: string): Lar[] {
  return LARES.filter((l) => l.concelhoSlug === concelhoSlug);
}

export interface ConcelhoSummary {
  slug: string;
  nome: string;
  distritoSlug: string;
  larCount: number;
  ipssCount: number;
  privadoCount: number;
  misericordiaCount: number;
  /** Aggregate published/estimated price band across all lares. Both undefined
   *  if no priced data. */
  precoMin?: number;
  precoMax?: number;
  precoMediana?: number;
}

export function getConcelhoSummaries(): ConcelhoSummary[] {
  return CONCELHOS.map((c) => {
    const lares = LARES.filter((l) => l.concelhoSlug === c.slug);
    const prices = lares
      .filter((l) => l.preco?.min != null && l.preco?.max != null)
      .map((l) => ({ min: l.preco!.min!, max: l.preco!.max! }));

    let precoMin: number | undefined;
    let precoMax: number | undefined;
    let precoMediana: number | undefined;
    if (prices.length > 0) {
      precoMin = Math.min(...prices.map((p) => p.min));
      precoMax = Math.max(...prices.map((p) => p.max));
      const midpoints = prices.map((p) => (p.min + p.max) / 2).sort((a, b) => a - b);
      precoMediana = midpoints[Math.floor(midpoints.length / 2)];
    }

    return {
      slug: c.slug,
      nome: c.nome,
      distritoSlug: c.distritoSlug,
      larCount: lares.length,
      ipssCount: lares.filter((l) => l.tipo === "ipss").length,
      privadoCount: lares.filter((l) => l.tipo === "privado").length,
      misericordiaCount: lares.filter((l) => l.tipo === "misericordia").length,
      precoMin,
      precoMax,
      precoMediana,
    };
  });
}

/** Concelhos that we render programmatic pages for. Returns concelhos with
 *  ≥ 1 lar in the seed AND those marked topAutocomplete (so empty pages
 *  exist for high-search-volume concelhos as SEO surface). */
export function getRoutedConcelhos() {
  return CONCELHOS.filter((c) => {
    const has = LARES.some((l) => l.concelhoSlug === c.slug);
    return has || c.topAutocomplete;
  });
}

export function tipoLabel(tipo: LarTipo): string {
  switch (tipo) {
    case "ipss": return "IPSS";
    case "misericordia": return "Misericórdia";
    case "privado": return "Privado";
    case "cooperativa": return "Cooperativa";
  }
}

export function valenciaLabel(v: LarValencia): string {
  switch (v) {
    case "erpi": return "ERPI (lar residencial)";
    case "centro_dia": return "Centro de Dia";
    case "sad": return "SAD (apoio domiciliário)";
    case "centro_convivio": return "Centro de Convívio";
  }
}

export type { Lar, LarTipo, LarValencia, PriceRange } from "./types";
export { CONCELHOS, TOP_CONCELHOS, getConcelho } from "./concelhos";
