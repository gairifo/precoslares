// Client-safe lares subset. Imported by React islands (Wizard.tsx).
//
// CRITICAL: this module must NEVER import the full `src/data/lares.json`.
// At scale (~2,700 entries) the full file is ~1.5 MB and would balloon
// the Wizard chunk past acceptable bundle-size limits. The slim file
// is regenerated from lares.json by `scripts/emit-lares-slim.ts` at
// every build (`npm run build` pre-step).
//
// Exposed shape is intentionally narrow: { slug, nome } per concelho —
// enough for the wizard's <datalist> autocomplete on Stage 2 Branch A.

import slim from "~/data/lares-slim.json" with { type: "json" };

export interface LarMinimal {
  slug: string;
  nome: string;
}

type SlimEntry = { slug: string; nome: string; concelhoSlug: string };

const BY_CONCELHO: Record<string, ReadonlyArray<LarMinimal>> = (() => {
  const map: Record<string, LarMinimal[]> = {};
  for (const l of slim as SlimEntry[]) {
    if (!map[l.concelhoSlug]) map[l.concelhoSlug] = [];
    map[l.concelhoSlug].push({ slug: l.slug, nome: l.nome });
  }
  for (const k of Object.keys(map)) Object.freeze(map[k]);
  return Object.freeze(map);
})();

export function getLaresByConcelho(concelhoSlug: string): ReadonlyArray<LarMinimal> {
  return BY_CONCELHO[concelhoSlug] ?? [];
}
