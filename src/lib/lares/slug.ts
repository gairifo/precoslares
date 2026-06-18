// Deterministic slug derivation for Lar entries.
//
// SOURCE OF TRUTH for slug shape: schema.ts SLUG_REGEX.
// Imported by:
//   - scripts/scrape-carta-social/* (generate slugs for new entries)
//   - scripts/lares-data/merge.ts   (assert non-collision against hand slugs)
//
// Algorithm (cascade per plan §"Resolved deferred questions" Q1):
//   1. base = slugify(nome with trailing em-dash clauses trimmed and PT
//      stopwords removed)
//   2. if base free → base
//   3. else base-{concelho}
//   4. else base-{concelho}-{slugify(freguesia)}
//   5. else base-{concelho}-{alvara.slice(-4)}
//   6. else throw — caller must investigate (genuinely duplicate data)
//
// URL stability: existing hand slugs are NEVER re-derived. The merge step
// in scripts/lares-data/merge.ts feeds hand slugs into `existingSlugs`
// before running this algorithm over Carta Social rows, so the cascade
// naturally cedes the namespace to the seed.

import slugify from "@sindresorhus/slugify";
import { SLUG_REGEX } from "./schema";

// Portuguese function words that bloat slugs without adding information.
// Kept conservative: only short connectives whose removal cannot change
// which lar a reader infers from the URL.
const PT_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
]);

const MAX_SLUG_LEN = 80;

export interface SlugInputs {
  nome: string;
  concelhoSlug: string;
  freguesia?: string | null;
  alvara?: string | null;
}

/** Strip a trailing em-dash / en-dash subtitle from `nome`. */
function trimTrailingSubtitle(nome: string): string {
  const dashMatch = nome.match(/^(.*?)\s+[—–]\s+/);
  return dashMatch ? dashMatch[1].trim() : nome.trim();
}

/** Run slugify + drop stopword tokens. Returns base, never empty (asserts). */
function kebabBase(nome: string): string {
  const cleaned = trimTrailingSubtitle(nome);
  const raw = slugify(cleaned);
  const filtered = raw
    .split("-")
    .filter((tok) => tok.length > 0 && !PT_STOPWORDS.has(tok))
    .join("-");
  const out = filtered || raw;
  if (!out) {
    throw new Error(`slug.ts: empty base for nome=${JSON.stringify(nome)}`);
  }
  return out;
}

function truncate(s: string): string {
  if (s.length <= MAX_SLUG_LEN) return s;
  const cut = s.slice(0, MAX_SLUG_LEN);
  // Avoid trailing hyphen after truncation.
  return cut.replace(/-+$/, "");
}

function assertValid(slug: string): string {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`slug.ts: produced invalid slug ${JSON.stringify(slug)}`);
  }
  return slug;
}

/**
 * Derive a slug for one record. Caller threads `existingSlugs` to
 * enforce uniqueness across the whole dataset (seed + scraped).
 *
 * Mutates nothing. Caller is responsible for adding the returned slug
 * to `existingSlugs` before the next call.
 */
export function generateLarSlug(
  inputs: SlugInputs,
  existingSlugs: ReadonlySet<string>,
): string {
  const base = truncate(kebabBase(inputs.nome));

  if (!existingSlugs.has(base)) return assertValid(base);

  const withConcelho = truncate(`${base}-${inputs.concelhoSlug}`);
  if (withConcelho !== base && !existingSlugs.has(withConcelho)) {
    return assertValid(withConcelho);
  }

  if (inputs.freguesia) {
    const fSlug = slugify(inputs.freguesia);
    if (fSlug) {
      const withFreguesia = truncate(`${withConcelho}-${fSlug}`);
      if (!existingSlugs.has(withFreguesia)) return assertValid(withFreguesia);
    }
  }

  if (inputs.alvara) {
    const tail = inputs.alvara.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toLowerCase();
    if (tail) {
      const withAlvara = truncate(`${withConcelho}-${tail}`);
      if (!existingSlugs.has(withAlvara)) return assertValid(withAlvara);
    }
  }

  throw new Error(
    `slug.ts: unresolvable collision for nome=${JSON.stringify(inputs.nome)} concelho=${inputs.concelhoSlug}`,
  );
}

/**
 * Convenience wrapper: derive slugs for a batch, threading the running
 * set of already-assigned slugs. Returns slugs in input order.
 *
 * Pass `seedSlugs` to lock-in hand-curated slugs from the seed dataset
 * (the algorithm will cascade around them).
 */
export function generateAllLarSlugs(
  records: ReadonlyArray<SlugInputs>,
  seedSlugs: ReadonlySet<string> = new Set(),
): string[] {
  const taken = new Set<string>(seedSlugs);
  const out: string[] = [];
  for (const r of records) {
    const s = generateLarSlug(r, taken);
    taken.add(s);
    out.push(s);
  }
  return out;
}
