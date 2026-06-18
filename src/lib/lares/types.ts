// Lar (eldercare facility) types.
//
// SOURCE OF TRUTH: src/lib/lares/schema.ts (Zod). This module re-exports
// the inferred types for backwards compatibility — every existing
// consumer imports from "./types" and continues to compile.
//
// SCHEMA STABILITY: adding a new optional field to the Zod schema is
// safe (existing data won't break). Renaming/removing a field requires
// migrating src/data/lares.json + bumping permalink shape if applicable.

export type {
  Lar,
  SeededLar,
  CartaSocialLar,
  OperatorClaimLar,
  LarTipo,
  LarValencia,
  PriceRange,
  CartaSocialMeta,
  DatasetMeta,
} from "./schema";

export type ConcelhoFiltro =
  | "todos"
  | "com-acordo"
  | "sem-acordo"
  | "ipss"
  | "privado"
  | "misericordia";
