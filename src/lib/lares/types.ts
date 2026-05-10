// Lar (eldercare facility) types.
//
// SCHEMA STABILITY: this is the canonical Lar shape. Adding a new optional
// field is safe. Renaming or removing requires careful migration of
// src/data/lares.json + the per-concelho routing logic.

export type LarTipo = "ipss" | "misericordia" | "privado" | "cooperativa";

export type LarValencia = "erpi" | "centro_dia" | "sad" | "centro_convivio";

export interface PriceRange {
  /** Monthly mensalidade in EUR. Optional — many lares don't disclose. */
  min?: number;
  max?: number;
  /** "operator_published" = the lar publishes prices openly.
   *  "user_reported" = aggregated from anonymous wizard reports.
   *  "estimated" = inferred from concelho-level mediana when no other data. */
  source?: "operator_published" | "user_reported" | "estimated";
  /** ISO date string of last verification. */
  asOf?: string;
}

export interface Lar {
  /** Stable kebab-case slug, used in URL path /lares/[concelho]/[slug]. */
  slug: string;
  /** Display name. */
  nome: string;
  /** Lar type. Determines the badge + filtering. */
  tipo: LarTipo;
  /** Whether the lar has acordo de cooperação with Segurança Social.
   *  Drives the "comparticipada" filter — a high-intent search modifier. */
  acordoSS: boolean;
  /** Valências disponíveis. ERPI is the most common. */
  valencias: LarValencia[];
  /** Capacity (number of beds for ERPI). Optional. */
  capacidade?: number;

  /** Concelho slug (matches src/lib/lares/concelhos.ts). */
  concelhoSlug: string;
  /** Distrito slug. */
  distritoSlug: string;
  /** Freguesia (optional, for micro-local intent). */
  freguesia?: string;
  /** Street address. Optional. */
  morada?: string;
  /** Postal code. */
  codigoPostal?: string;

  telefone?: string;
  email?: string;
  website?: string;

  /** Price band, when known. Most fields optional. */
  preco?: PriceRange;

  /** Source of the entry itself. "seeded" = hand-curated for v0.
   *  "carta_social" = imported from official Carta Social.
   *  "operator_claim" = added by verified operator (Phase 2.8). */
  source: "seeded" | "carta_social" | "operator_claim";

  /** Optional notes — services included, etc. */
  notas?: string[];
}

export type ConcelhoFiltro = "todos" | "com-acordo" | "sem-acordo" | "ipss" | "privado" | "misericordia";
