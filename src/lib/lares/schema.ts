// Zod schema is the SINGLE source of truth for the Lar shape.
//
// Per the deepened plan (Enhancement Summary §1, §2, §3):
// - `type Lar = z.infer<typeof LarSchema>` (no parallel TS interface to
//   keep in sync).
// - `Lar.source` is a discriminated union: SeededLar | CartaSocialLar |
//   OperatorClaimLar with per-variant required fields.
// - `_meta` is dual-level: top-level dataset metadata + per-entry record
//   metadata (alvará is canonical identity for carta_social-sourced
//   entries).
//
// Imported by:
// - `src/content.config.ts` (Astro Content Collection validation)
// - `scripts/scrape-carta-social/` (output validation)
// - `src/lib/lares/index.ts` (consumer types)
//
// NEVER imported by React islands directly (would pull `zod` into the
// client bundle). Wizard imports the slim subset from `./client.ts`.

import { z } from "astro/zod";

// ── Enums ─────────────────────────────────────────────────────────────

export const LarTipoSchema = z.enum([
  "ipss",
  "misericordia",
  "privado",
  "cooperativa",
]);
export type LarTipo = z.infer<typeof LarTipoSchema>;

export const LarValenciaSchema = z.enum([
  "erpi",
  "centro_dia",
  "sad",
  "centro_convivio",
]);
export type LarValencia = z.infer<typeof LarValenciaSchema>;

// ── PriceRange ────────────────────────────────────────────────────────

export const PriceRangeSchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  source: z.enum(["operator_published", "user_reported", "estimated"]).optional(),
  asOf: z.string().optional(),
});
export type PriceRange = z.infer<typeof PriceRangeSchema>;

// ── Slug regex ────────────────────────────────────────────────────────
//
// Defense-in-depth against path-traversal + tombstone-header-injection
// via crafted slugs. Algorithm in slug.ts produces conformant output;
// schema rejects non-conformant just in case.

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,80})$/;

// ── Base shape shared by all sources ──────────────────────────────────

const LarBaseSchema = z.object({
  slug: z.string().regex(SLUG_REGEX),
  nome: z.string().min(1).max(200),
  tipo: LarTipoSchema,
  acordoSS: z.boolean(),
  valencias: z.array(LarValenciaSchema).min(1),
  capacidade: z.number().int().positive().optional(),
  concelhoSlug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,50})$/),
  distritoSlug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,50})$/),
  freguesia: z.string().max(100).optional(),
  morada: z.string().max(200).optional(),
  codigoPostal: z.string().max(20).optional(),
  telefone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  preco: PriceRangeSchema.optional(),
  notas: z.array(z.string()).optional(),
});

// ── Per-entry _meta variants ──────────────────────────────────────────

const CartaSocialMetaSchema = z.object({
  /** Carta Social access path (sequential int). Not canonical identity. */
  carta_social_id: z.number().int().positive(),
  /** Stable URL for deep-link attribution. */
  carta_social_url: z.string().url(),
  /** Alvará / license number — the canonical identity for re-merges. */
  alvara: z.string().min(1).max(50),
  /** ISO date this entry was last confirmed in a scrape run. */
  last_seen_at: z.string(),
});
export type CartaSocialMeta = z.infer<typeof CartaSocialMetaSchema>;

const OperatorClaimMetaSchema = z.object({
  claimed_at: z.string(),
  claimed_via: z.enum(["email_domain", "phone", "manual_override"]),
});

// ── Discriminated union on source ─────────────────────────────────────
//
// - Seeded: hand-curated. May have `preco` (Pedro's research). No _meta required.
// - CartaSocial: scraped. Must NOT have preço (Carta Social doesn't expose it).
//                Must have _meta with the source backlink + alvará.
// - OperatorClaim: verified operator (Phase 2.8). May have preço.

const SeededLarSchema = LarBaseSchema.extend({
  source: z.literal("seeded"),
});

const CartaSocialLarSchema = LarBaseSchema.extend({
  source: z.literal("carta_social"),
  // CartaSocial entries don't carry preço (Carta Social doesn't publish it).
  preco: z.undefined().optional(),
  _meta: CartaSocialMetaSchema,
});

const OperatorClaimLarSchema = LarBaseSchema.extend({
  source: z.literal("operator_claim"),
  _meta: OperatorClaimMetaSchema,
});

export const LarSchema = z.discriminatedUnion("source", [
  SeededLarSchema,
  CartaSocialLarSchema,
  OperatorClaimLarSchema,
]);
export type Lar = z.infer<typeof LarSchema>;
export type SeededLar = z.infer<typeof SeededLarSchema>;
export type CartaSocialLar = z.infer<typeof CartaSocialLarSchema>;
export type OperatorClaimLar = z.infer<typeof OperatorClaimLarSchema>;

// ── Dataset top-level _meta (dataset-wide attribution + provenance) ──

export const DatasetMetaSchema = z.object({
  version: z.number().int().positive().optional(),
  source: z.string().optional(),
  ingest_path: z.string().optional(),
  lastUpdated: z.string().optional(),
  attribution_text: z.string().optional(),
  license: z.string().optional(),
  schemaUrl: z.string().url().optional(),
  snapshot_date: z.string().optional(),
}).passthrough();
export type DatasetMeta = z.infer<typeof DatasetMetaSchema>;

// ── Top-level file shape ──────────────────────────────────────────────

export const LaresFileSchema = z.object({
  _meta: DatasetMetaSchema.optional(),
  lares: z.array(LarSchema),
});
export type LaresFile = z.infer<typeof LaresFileSchema>;
