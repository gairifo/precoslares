---
title: Phase 1 Soft-Launch Bundle — Permalinks, PDF, Deep-dives, Analytics, SEO
type: feat
status: active
date: 2026-05-10
origin: docs/brainstorms/2026-05-10-phase-1-soft-launch-bundle-requirements.md
deepened: 2026-05-10
---

# Phase 1 Soft-Launch Bundle

## Enhancement Summary

**Deepened on:** 2026-05-10 with 9 parallel agents (kieran-typescript-reviewer, architecture-strategist, security-sentinel, code-simplicity-reviewer, pattern-recognition-specialist, performance-oracle, julik-frontend-races-reviewer, agent-native-reviewer, best-practices-researcher).

The original plan below is preserved verbatim for audit. **Where this summary contradicts a section below, this summary wins.** Implementers should read this first, then the original sections in light of it. Appendix A (PT-PT content authoring brief for Phase C) is at the end of the document.

### Locked decision changes (override the original plan)

| # | Change | Why | Source |
|---|---|---|---|
| 1 | **Drop Zod from client runtime.** Hand-roll a 30-line validator at the permalink boundary. Keep Zod only at build time for Astro Content Collections. | Saves ~13 kB gz; preserves Phase 0 engine purity invariant; one-input schema doesn't justify Zod. | kieran-ts P0; simplicity #3; performance #1; pattern-rec #2 |
| 2 | **Drop lz-string.** Switch permalink to positional-CSV encoding, e.g. `#i=1,2026,80,500,2_grau,viuvo,...`. | 0-byte dep; 30–50 char URLs (vs 200+); no compression-failure modes; messenger-truncation risk vanishes. | performance #3 |
| 3 | **Drop the migrators table.** Until v=2 actually ships, decode rejects unknown `v` → recovery banner. Build the migrator the day v=2 lands. | YAGNI; speculative abstraction. The schema-stability comment alone documents the contract for v=1. | simplicity #1 |
| 4 | **Drop the elaborate drift-mismatch banner.** Still encode `c: 2026` (1 char) and display "Valores de 2026" prominently. Defer the c-mismatch banner to when 2027 ships. | Conditional UX for code that won't execute for 8 months. Banner is the load-bearing affordance. | simplicity #2 |
| 5 | **Drop the `/r/<slug>` redirect map.** Link deep-dives directly to canonical URLs; keep `archive_url` in frontmatter as backup. Revisit when ≥ 10 deep-dives or actual link-rot observed. | "Build the rails before the train" trap; 3 pages × ~5 sources = 15 citations is find-and-replace, not routing. | simplicity #4 |
| 6 | **Drop the reference-PDF gate (E1).** Pedro eyeballs once, ships. Delete `docs/reference/example-case.pdf` requirement. | Process theater — there's no automated diff; vibes-check anyway. | simplicity #6 |
| 7 | **Constants version lives in the engine, not the Wizard.** Add `src/lib/calculator/version.ts` exporting `CONSTANTS_VERSION = "2026"` (string, not number — supports mid-year `"2026.1"`). Permalink layer imports from there. | When 2027 lands, exactly one place changes; layering correctness. | architect P0 |
| 8 | **`permalink.ts` becomes a folder.** `src/lib/permalink/{index.ts, codec.ts, validator.ts}`. Public API in `index.ts`, encode/decode in `codec.ts`, hand-rolled validator in `validator.ts`. | One-file-with-four-responsibilities won't survive Phase 2. Cheaper to cut now while small. | architect P1 |
| 9 | **Centralize Plausible event vocabulary in `src/lib/analytics.ts`.** `export const Events = {...} as const` + typed `track(event, props)` wrapper around `window.plausible?.()`. | Prevents string-typo drift across Wizard, layout, launch checklist. Makes events testable. | architect P3 |
| 10 | **Derive `APOIO_IDS` once in `src/lib/calculator/index.ts`.** Reuse via `z.enum(APOIO_IDS)` in `content.config.ts`. | Adding a 9th apoio in Phase 2 can't silently desync the deep-dive enum. | architect P3; pattern-rec |
| 11 | **JSON-LD: page-composed via `<slot name="head-jsonld" />` in `Base.astro`, never prop-driven.** Each page builds its own structured data and emits one `<script type="application/ld+json" slot="head-jsonld">` (or two, or a `@graph`). Always pass payload through `safeJsonForScript()` (new A11). | A9/D1 conflated two patterns; per-page composition is honest about who knows the data. | architect P1; pattern-rec; security H1 |
| 12 | **`apoio_id` enum in `content.config.ts` mirrors calculator's kebab-case slugs**, not snake_case. (`csi`, `complemento-dependencia`, `atestado-multiusos`, ...). Drop the invented `slug_short` field — Astro 5 loader auto-derives `id` from filename. | Convention drift detected against `src/pages/apoios/index.astro`. | pattern-rec #1 |
| 13 | **Banner / toast styles go in `global.css` `@layer components`** as `.banner-warn`, `.banner-info`, `.toast`. Don't inline utility-class soup in `Wizard.tsx`. | Consistency with existing `.btn-primary`, `.field`, `.badge-elig-*` pattern. | pattern-rec #6 |
| 14 | **Use existing `ApoiosResult.ano_referencia`** for the visible "Valores de 2026" banner. Only the encoded permalink needs a separate `c` field. | The data already exists on the result; don't invent a parallel constant export for the UI. | pattern-rec |
| 15 | **NFR tightened: ≤ 25 kB gz bundle delta**, not 100 kB. | With Zod + lz-string both removed, realistic delta is ~3 kB gz; loose ceilings invite regression. | performance |

### New tasks to add to the existing phases

#### Phase A (foundation) — add 5 tasks
- **A11. `safeJsonForScript()` helper.** Escapes `</script>`, `-->`, and ` `/` ` in JSON-LD payloads. Used by every `set:html={...}` JSON-LD emission. (security H1)
  ```ts
  export const safeJsonForScript = (v: unknown) =>
    JSON.stringify(v)
      .replace(/</g, "\\u003c")
      .replace(/-->/g, "--\\u003e")
      .replace(/ /g, "\\u2028")
      .replace(/ /g, "\\u2029");
  ```
- **A12. Security headers via `public/_headers` (Cloudflare Pages) and `vercel.json`.** Ship with: `Content-Security-Policy` (script-src self + plausible.io + sha256 of inline loader; connect-src self + plausible.io; style-src self 'unsafe-inline' for Tailwind base; frame-ancestors none; object-src none); `Referrer-Policy: strict-origin-when-cross-origin`; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`; `Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()`. (security M2)
- **A13. Server-side mailto for "Reportar erro".** Build href in `Base.astro` frontmatter from `Astro.url.pathname` only (regex-validated `^/[a-zA-Z0-9/_-]{0,80}$`). Pass through `encodeURIComponent`. **Never include `Astro.url.hash` or any client-`location` value** — would leak the user's permalink (PII) to gairifo@gmail.com. Body template references the page path + a static "Descreva o problema:" prompt; explicitly does NOT carry the wizard inputs. (security H2)
- **A14. Build-time host allowlist test for source URLs in deep-dive frontmatter.** Vitest case asserts every `sources[].canonical` and `archive_url` parses to a hostname matching `seg-social.pt`, `gov.pt`, `dre.pt`, `portaldasfinancas.gov.pt`, `sns24.gov.pt`, `web.archive.org`. Guards against typo-citations to look-alike phishing domains. (security M4)
- **A15. Snapshot test for permalink schema stability.** Vitest case snapshots the keys of the hand-rolled validator (or a key array of `ApoiosInput` field names). CI fails on accidental rename — replaces the rot-prone schema-stability code comment with an executable assertion. (architect P3)

#### Phase B (permalinks) — race-fix overlay (replaces / refines original B3–B6)
- **B3 (revised).** Hash hydration uses a `useRef(false)` guard, not just first-render-only logic. Prevents StrictMode dev double-fire AND any future parent re-mount from re-firing `permalink_loaded`. Pattern:
  ```ts
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const r = decode(raw);
    if (r.ok) { setInput(r.input); setStage("result"); track("permalink_loaded"); }
    else { setBanner(r.kind); track("permalink_invalid"); }
  }, []);
  ```
  (frontend-races #1)
- **B4 (revised).** "Copiar link" button is `disabled` when `stage !== "result"` OR `!hydratedRef.current`. Otherwise a slow-network user can copy the empty form on first paint. (frontend-races #2)
- **B5 (revised — CRITICAL).** `calculator_completed` fires ONLY inside the wizard's "Calcular apoios →" submit handler, NEVER from a `useEffect` watching `stage`. Hydration sets stage="result" directly and bypasses the handler — that's the boundary that keeps the metric honest. Add an explicit `// DO NOT MOVE` comment above the firing line. (frontend-races #3)
- **B6 (revised).** Clipboard write uses `.then/.catch`, not `await`. Plausible event fires only inside `.then` resolve callback. On reject (Safari permission denial, non-secure context), show "selecione e copie manualmente" toast with the URL visible — no analytics event. (frontend-races #5)
- **B12 (NEW).** **Decision: do NOT add a `hashchange` listener.** An in-page anchor (`<a href="#fontes">`) would re-trigger hydration and wipe the user's typed input. The plan is one-shot hydration on mount only. Document in `docs/PERMALINK.md`. (frontend-races #4)
- **B13 (NEW).** `<details>` print expansion uses **all three** signals: `matchMedia("print")` change listener as primary, `beforeprint`/`afterprint` as fallback (Safari macOS sometimes drops `afterprint`; iOS Safari's share-sheet print path may drop both). Also a `setTimeout(restoreAll, 30000)` safety net so a cancelled-print never leaves the DOM permanently expanded. Listener attached only on the calculator result stage via `useEffect` (not in `Base.astro`); cleanup disposes all three. (frontend-races #6, #7)
- **B14 (NEW).** Encoder runs ONLY in the click handler, never in a `useEffect([input])`. Avoids `history.replaceState` mid-keystroke focus jank on iOS Safari. (frontend-races #8)

#### Phase C (deep-dives) — content brief authoritative
- **C7 (NEW).** Use **Appendix A** as the canonical brief for all 3 pages. The writer (Pedro, or Claude with Pedro review) follows it section-by-section. Every numeric value flagged `[CONFIRMAR]` in Appendix A must be verified against the actual 2026 DR-published portaria before publication.
- **Schema simplification.** Drop `slug_short`. Use `id` derived from filename. `apoio_id` enum imports `APOIO_IDS` from `~/lib/calculator`. Add: `agent_summary: z.string().max(500)` and `agent_keywords: z.array(z.string()).optional()` for Phase 4 LLM-context use. (agent-native Q3, Q5)

#### Phase D (SEO + privacy) — additions
- **D6 (cheap agent-native wins, ~2 hours total).** All optional but high-leverage:
  - Emit `public/schema/apoios-input.json` at build via a small `scripts/emit-schema.ts` (uses `zod-to-json-schema`). Lets out-of-process LLM agents declare a tool that calls `calcular()`. (agent-native Q2)
  - Author `docs/PERMALINK.md` documenting the envelope (`{v: 1, c: 2026, fields: [idade, ...positional...]}`), the 1,800-char cap, the `B12` no-hashchange decision, and the v→2 migration policy. (agent-native Q1)
  - Author `docs/AUTHORING.md` documenting deep-dive frontmatter schema, the 8-section template (Appendix A), the source-url allowlist (A14), and the Plausible event vocabulary (`Events` from analytics.ts). (agent-native Q5)
  - Add `data-error-context` JSON blob next to "Reportar erro" mailto with `{ page, constants_year, user_agent_hash }` (NEVER includes the permalink). Reserves the contract for a future POST endpoint. (agent-native Q6)
- **D3 (revised) — privacy disclosures.** Add to PT copy: (i) browser history retains `#i=...` indefinitely on shared devices; (ii) screenshots and the printed PDF embed the permalink data — treat both with the same care as the link itself; (iii) mobile share-sheets and Universal Clipboard / Windows Cloud Clipboard may sync the URL across the user's devices. (security L1, L4)
- **D4.** CC-BY-SA 4.0 only on `/apoios/*` deep-dives, NOT site-wide. Engine remains MIT.

#### Phase E (validation) — replace E1
- **E1 (revised).** Pedro runs his own family case and eyeballs the printed PDF. No reference file in repo. Delete the `docs/reference/example-case.pdf` requirement.
- **E4 (NEW — pre-launch grep guard).** CI / pre-commit grep: `grep -rE "import\.meta\.env\.(?!PUBLIC_)" src/components src/pages` must return nothing. Catches accidental SECRET_* leakage to client bundles. (security)

### Outstanding question raised by deepening

**IAS 2026 value discrepancy.** The origin requirements doc stated `IAS 2026 = 537,13 €` (which is what shipped in `constants_2026.json`). The best-practices research returned `IAS 2026 = 522,50 €` (after Portaria 304/2024). These cannot both be right; neither agent had Pedro's authoritative source. **Action before Phase C author:** Pedro verifies the actual 2026 DR-published Portaria de atualização do IAS, updates `constants_2026.json` if needed, then re-runs all 35 calculator tests and updates Appendix A's `[CONFIRMAR]` values. Tag every numeric claim in deep-dive markdown with `[VERIFICAR 2026]` until confirmed against DR. **This is the single blocker for Phase C — fix before authoring the 6,000 words.**

### What was NOT changed

- All 7 R-requirements (R1–R7) and the 5-phase A–E structure remain.
- Astro 5 Content Collections, `@astrojs/sitemap`, `astro:env`, hash-not-query, MIT engine — all locked decisions stand.
- Soft-launch readiness checklist (R7).
- The PT-PT slugs (`csi`, `complemento-dependencia`, `atestado-multiusos`) and the SEO `<title>`/`<h1>` separation.
- The 8-section deep-dive template — but Appendix A makes it concrete.

### Confidence after deepening
HIGH. No critical findings remain unresolved. The IAS-value question is a content fact-check, not a design issue, and is gated before Phase C only.

---

## Overview

Take lar-ajuda from "Phase 0 calculator works for Pedro" to "Phase 1 publicly shippable to 50–100 families." Ship 7 requirements (R1–R7) carried forward verbatim from the [origin requirements doc](../brainstorms/2026-05-10-phase-1-soft-launch-bundle-requirements.md): permalinks, PDF/print polish, three ~2,000-word deep-dive apoio pages, "Reportar erro" link, Plausible analytics, SEO basics (sitemap, robots, JSON-LD), and a launch checklist.

The plan also resolves the 4 deferred-to-planning questions from the origin doc and incorporates 5 critical findings surfaced by the spec-flow analyzer (constants version drift, malformed-permalink UX, `calculator_completed` event semantics, FAQ-schema rich-result reality, mobile Safari print path).

## Problem Statement

After Phase 0, the calculator works locally and is correct for Pedro's family case (the Phase 0 decision gate passed — surfaced ≥ 1 apoio Pedro didn't know about). But it can't be shared, can't be measured, can't rank for the head terms it needs, and can't be soft-launched without footguns. Specifically:

- **Can't be shared.** No permalinks → siblings can't open the same result. Roadmap success metric "≥ 100 permalink shares" is impossible to hit.
- **Can't be measured.** No analytics → can't validate "≥ 50% calculator-completion" or "≥ 500 unique users in first 30 days."
- **No content moat.** Glossary is a stub list. The roadmap's "Top 3 ranking for ≥ 20 head terms" goal needs deep-dive pages for the highest-traffic queries (CSI, Complemento por Dependência, Atestado Multiusos).
- **No trust signal.** No "Reportar erro" affordance, no source citations, no last-updated dates. Cross-phase governance §"Wrong calculation costs a family money" requires "report a bug link prominent."
- **Not crawlable.** No sitemap, no robots.txt, no JSON-LD. Compounding-content strategy depends on these.

## Proposed Solution

A bounded engineering bundle that ships in **2–3 weekends**, broken into 5 implementation phases (A–E) so Pedro can park between phases without leaving the app in a broken state. Each phase has its own success criteria.

The high-level technical direction (locked decisions, key dependencies, file locations) is captured below because this bundle is inherently architectural — Astro Content Collections, the permalink encoding format, the analytics gating pattern, and the JSON-LD strategy are all product decisions disguised as technical ones.

## Technical Approach

### Architecture

The bundle introduces **5 new modules** and **6 new pages/files** without disturbing the existing calculator engine. Calculator logic remains pure TS, untouched.

```
lar-ajuda/
├── astro.config.mjs               # add @astrojs/sitemap; declare astro:env client schema
├── .env.example                   # NEW — document PUBLIC_PLAUSIBLE_DOMAIN
├── src/
│   ├── content.config.ts          # NEW — Astro 5 collections (loader: glob)
│   ├── content/
│   │   └── apoios/
│   │       ├── csi.md             # NEW — ~2,000 words
│   │       ├── complemento-dependencia.md
│   │       └── atestado-multiusos.md
│   ├── lib/
│   │   ├── calculator/            # untouched (Phase 0)
│   │   └── permalink.ts           # NEW — encode/decode/migrate
│   ├── components/
│   │   └── Wizard.tsx             # MODIFY — hash hydration, copy-link button, event semantics
│   ├── layouts/
│   │   └── Base.astro             # MODIFY — analytics, hreflang, footer mailto, error link, JSON-LD slot
│   ├── pages/
│   │   ├── apoios/
│   │   │   ├── index.astro        # MODIFY — query getCollection
│   │   │   └── [...slug].astro    # NEW — render deep-dives
│   │   ├── r/
│   │   │   └── [slug].astro       # NEW — link-rot redirect map
│   │   └── calculadora.astro      # MODIFY — drop page-scoped print CSS
│   ├── data/
│   │   └── source-redirects.ts    # NEW — { slug: { canonical, archive } }
│   └── styles/
│       └── global.css             # MODIFY — add @media print
├── public/
│   └── robots.txt                 # NEW
└── docs/
    ├── launch-checklist.md        # NEW — R7
    └── reference/
        └── example-case.pdf       # NEW — Pedro's signed-off baseline (E1)
```

### Implementation Phases

#### Phase A — Foundation (1 sitting, ~3 hours)

Add infrastructure that everything else depends on. Each item is independent and can be done in any order.

- **A1. Install dependencies.** `lz-string`, `@astrojs/sitemap`. Optionally `@astrojs/mdx` (defer — `glob` loader handles `.md` natively per Astro 5 docs).
- **A2. Add `astro:env` config.** In `astro.config.mjs`, declare client schema: `PLAUSIBLE_DOMAIN: envField.string({ context: "client", access: "public", optional: true })`. Type-safe, validated at build, recommended Astro 5 pattern over raw `import.meta.env.PUBLIC_*`.
- **A3. Add `@astrojs/sitemap` integration.** Already have `site: "https://lar-ajuda.pt"` set, so it's a one-liner. Auto-detects all static routes including `[...slug]`.
- **A4. Create `public/robots.txt`.** Allow all + sitemap reference.
- **A5. Create `.env.example`** documenting `PUBLIC_PLAUSIBLE_DOMAIN`.
- **A6. Move existing print CSS** from page-scoped `<style is:global>` in `calculadora.astro` to `src/styles/global.css` `@media print` block. Reconcile with new print rules from R2.
- **A7. Wire Plausible script in `Base.astro`** — conditional on `PLAUSIBLE_DOMAIN` env. Use `is:inline` (REQUIRED in Astro 5 for conditionally-rendered scripts — without it, Astro tries to bundle and the conditional disappears at build).
- **A8. Add "Reportar erro" footer link** to `Base.astro`. `mailto:gairifo@gmail.com?subject=...&body=...` with the page path prefilled. Pair with a "Copiar email" affordance for users without a configured mail client (mobile gotcha #8 from spec-flow).
- **A9. Add `<head>` JSON-LD slot in `Base.astro`** so individual pages can pass structured data via prop. Use `set:html={JSON.stringify(ld)}` to avoid HTML-escaping (Astro 5 gotcha).
- **A10. Add `hreflang="pt-pt"`** + `<link rel="sitemap">` to `Base.astro` head.

**Phase A success criteria:** `npm run build` passes. `npm run dev` shows no console errors. Plausible script tag appears only when `PUBLIC_PLAUSIBLE_DOMAIN` is set in `.env`.

#### Phase B — Permalinks (1 sitting, ~4 hours)

The bundle's most surgical work. All in `Wizard.tsx` and a new `lib/permalink.ts` module.

- **B1. Create `src/lib/permalink.ts`** with:
  - `encode(input: ApoiosInput, constantsYear: number): string` — wraps as `{v: 1, c: 2026, d: input}`, JSON-stringifies, runs through `compressToEncodedURIComponent` from `lz-string`. Hard-cap at 1,800 chars (messenger-safe per best-practices research); over → log warning + still return.
  - `decode(hash: string): { ok: true; input: ApoiosInput; constantsYear: number } | { ok: false; reason: "malformed" | "version_too_new" | "validation_failed" }` — validates with a Zod schema mirroring `ApoiosInput`. Rejects negative numbers, idade > 120, etc.
  - `migrators: Record<number, (raw: unknown) => ApoiosInput>` — table for forward-compat. v=1 only for now; structure ready for v=2.
- **B2. Add Zod runtime validation for `ApoiosInput`** in `src/lib/calculator/types.ts` (export both type and schema). Single source of truth — the Zod `infer` becomes the TS type.
- **B3. `Wizard.tsx` — hash hydration** via `useEffect` on mount:
  - Read `window.location.hash`, slice off `#`.
  - On valid decode: `setInput(input); setStage("result")`. Fire `permalink_loaded` Plausible event (NOT `calculator_completed`).
  - On invalid decode: render banner at top of stage-1 form: "Link inválido ou desatualizado — preencha de novo para nova estimativa." Fire `permalink_invalid` event.
  - Pattern: `useState(empty)` first render (SSR-safe), `useEffect` hydrates after mount. This is the canonical fix for hash-in-island under `client:load` per Astro 5 docs.
- **B4. `Wizard.tsx` — "Copiar link" button** on result page next to "Imprimir / PDF":
  - Encode current input → write hash to `window.location` (using `history.replaceState` so browser back doesn't accumulate junk).
  - Copy full URL to clipboard via `navigator.clipboard.writeText`.
  - Toast: "Link copiado — qualquer pessoa que abra este link verá o mesmo resultado."
  - Fire `permalink_copied` Plausible event.
- **B5. `Wizard.tsx` — `calculator_completed` event semantics** (resolves spec-flow #3):
  - Fire ONCE per session on first arrival at result via wizard submission. Use `sessionStorage.setItem("calc_completed_session", "1")` flag.
  - Do NOT fire on permalink hydration (that's a different event: `permalink_loaded`).
  - Do NOT re-fire on stage navigation back/forward.
- **B6. `Wizard.tsx` — `onRestart` clears hash** via `history.replaceState(null, "", window.location.pathname)`.
- **B7. Constants version banner on result page** (resolves spec-flow #4 — constants drift):
  - Display "Estimativa com base em valores de **2026**" prominently above the result headline.
  - The encoded permalink also includes `c: 2026`. On decode, if `decoded.c !== currentConstantsYear`, display additional banner: "Este link foi gerado com valores de 2026. A estimativa atual usa valores de 2027 — recomenda-se recalcular." (Only relevant after the first yearly bump; ship the code now.)
- **B8. `Wizard.tsx` — input schema lock comment.** Add `/** SCHEMA STABILITY: this shape is encoded into permalinks. Adding a field is safe (decoder fills as undefined → null). RENAMING or REMOVING a field requires bumping permalink v→2 and adding a migrator in src/lib/permalink.ts. */` above `ApoiosInput` definition in `types.ts`.

**Phase B success criteria:** Encode in browser A → paste link in browser B incognito → exact same numbers render. Encoded URLs stay under 1,800 chars for the Pedro-family input. Malformed hash (truncated payload, garbage string) shows the recovery banner instead of crashing. `permalink_copied` and `calculator_completed` events visible in Plausible test mode.

#### Phase C — Deep-dive content (~2 weekends)

The biggest time sink. Engineering is small (~3 hours); content authoring is the long pole.

- **C1. Create `src/content.config.ts`** with:
  ```ts
  import { defineCollection, z } from "astro:content";
  import { glob } from "astro/loaders";

  const apoios = defineCollection({
    loader: glob({ base: "./src/content/apoios", pattern: "**/[^_]*.md" }),
    schema: z.object({
      title: z.string(),                  // page <title> (SEO-optimized phrase)
      h1: z.string(),                     // visible page heading (often = title)
      description: z.string(),            // meta description, 150–160 chars
      slug_short: z.string(),             // matches existing apoios/index slug ("csi", etc.)
      lastUpdated: z.coerce.date(),
      readingMinutes: z.number(),
      ias_year: z.number(),               // year of the IAS values cited inside
      sources: z.array(z.object({
        label: z.string(),
        canonical_url: z.string().url(),
        archive_url: z.string().url().optional(),
        redirect_slug: z.string().optional(),  // links via /r/<slug>
      })),
      faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(5),
      apoio_id: z.enum([                  // ties page back to calculator's apoio.id
        "csi", "complemento_dependencia", "atestado_multiusos",
        "irs_art_84", "irs_art_87", "erpi_acordo",
        "adse_iasfa_sad", "cuidador_informal",
      ]),
    }),
  });

  export const collections = { apoios };
  ```
- **C2. Create `src/pages/apoios/[...slug].astro`** dynamic route. Uses `getCollection("apoios")` → `getStaticPaths`. Renders `<Content />`. Emits `Article` + `FAQPage` JSON-LD as a single `@graph` block (one parse for crawlers). Always sets `inLanguage: "pt-PT"` on the Article.
- **C3. Update `src/pages/apoios/index.astro`** to query `getCollection("apoios")` (remove the inline `apoios = [...]` array). Show authored apoios as cards; show the other 5 as "em breve" (lower confidence than blank).
- **C4. Author 3 markdown files** in `src/content/apoios/`. Each follows this 8-section template:
  1. **Hero box** (TL;DR in 30 seconds — 2 sentences + "Ver quanto eu posso receber →" CTA to `/calculadora`)
  2. **O que é** (300 words: definition, history, who pays it)
  3. **Quem tem direito** (300 words: each eligibility rule with examples)
  4. **Quanto vale em 2026** (350 words: formula in plain Portuguese + 2 worked examples + table of values, citing `constants_2026.json`)
  5. **Como pedir, passo a passo** (350 words: numbered steps, formulários with /r/ redirect links, where to entregar, expected response time)
  6. **Erros comuns** (250 words: 4–6 pitfalls families make)
  7. **Perguntas frequentes** (350 words: ≥ 5 Q&As — semantic `<h3>`/`<p>`, also marked up as FAQPage JSON-LD even though Google rich result is unavailable post-Aug-2023; Bing and AI/LLM crawlers still use it)
  8. **Fontes oficiais** (every citation with canonical URL + archive backup via `/r/<slug>`)

  **The 3 pages and their target SEO phrases (locked from origin §Key Decisions, refined for slug consistency with existing `apoios/index.astro`):**

  | File | Slug | `<title>` | `<h1>` |
  |---|---|---|---|
  | `csi.md` | `/apoios/csi` | "CSI 2026 — Complemento Solidário para Idosos: como pedir e quanto vale" | "Complemento Solidário para Idosos (CSI) em 2026" |
  | `complemento-dependencia.md` | `/apoios/complemento-dependencia` | "Complemento por Dependência 2026 — 1.º e 2.º grau, valores e como pedir" | "Complemento por Dependência (1.º e 2.º grau) em 2026" |
  | `atestado-multiusos.md` | `/apoios/atestado-multiusos` | "Atestado Multiusos em 2026 — como pedir, benefícios e graus de incapacidade" | "Atestado Multiusos: como pedir e que benefícios desbloqueia" |

- **C5. Source link-rot mitigation (resolves spec-flow #12 + origin deferred Q3).** Create `src/data/source-redirects.ts` mapping `slug → { canonical, archive_url, label }`. Create `src/pages/r/[slug].astro` that reads the slug, returns a 301 (or in static build, an HTML meta-refresh) to the canonical, with the archive_url as comment fallback. Markdown citations link to `/r/<slug>` not the raw URL. When DGSS reorganizes (it always does), update one file in the repo, not 3 markdown files.

**Phase C success criteria:** All 3 pages render at the URLs above; each ≥ 1,800 words; each has all 8 sections (manual checklist); `Article` JSON-LD validates at schema.org/structured-data; FAQ JSON-LD validates; `lastUpdated` is recent; sitemap includes all 3.

#### Phase D — SEO + privacy + governance

- **D1. `Base.astro` — JSON-LD slot.** Pages can pass an array of structured-data objects via prop; layout renders them as separate `<script type="application/ld+json">` tags or merges into `@graph` for deep-dive routes.
- **D2. Homepage Organization + WebSite JSON-LD.** Static, set in `pages/index.astro`. Includes `inLanguage: "pt-PT"` and `potentialAction` for site search (placeholder in case Phase 3 adds search).
- **D3. Update `/privacidade`** to disclose:
  - Plausible (cookieless, no consent banner needed in PT under Lei 41/2004 + EDPB cookieless guidance — use the PT template from best-practices research §2).
  - URL-hash mechanism: "Quando partilha um link da calculadora, os dados que introduziu (idade, pensão, dependência) são codificados na parte do URL após `#` (chamada *fragmento*). O fragmento nunca é enviado a servidores. Mas, ao partilhar o link, está a partilhar esses dados com quem o receber, e o seu navegador pode sincronizar URLs entre dispositivos (iCloud, Chrome Sync). Use links de calculadora apenas com pessoas em quem confia."
- **D4. Add CC-BY-SA notice** on the deep-dive footer. Calculator engine remains MIT (in repo LICENSE). Content explicitly under CC-BY-SA 4.0. One-line in deep-dive layout.
- **D5. `Base.astro` footer** — add the "Reportar erro nesta página" link from A8 here (already done in A8; D5 verifies copy + accessibility on every page including the deep-dives).

**Phase D success criteria:** Privacy page passes a manual GDPR-disclosure read; Plausible disclosure matches CNPD-aligned PT template; CC-BY-SA notice visible on deep-dive pages; Schema.org validator green for homepage and a sample deep-dive.

#### Phase E — Validation & launch readiness

- **E1. Reference-PDF acceptance gate (resolves spec-flow #9).** Pedro runs his own family case through the wizard, exports the PDF (`window.print()` → "Save as PDF"), saves to `docs/reference/example-case.pdf`. This file is the regression baseline. Any PDF change in future requires re-confirming this case looks at-least-as-good.
- **E2. `docs/launch-checklist.md` (R7)** — the punch list Pedro runs through pre-launch:
  - [ ] `npm run build` passes
  - [ ] `npm test` passes (Phase 0 35 tests still green)
  - [ ] Domain `lar-ajuda.pt` (or chosen alt) registered and DNS pointed at host
  - [ ] Hosting set up (Cloudflare Pages or Vercel free tier)
  - [ ] `PUBLIC_PLAUSIBLE_DOMAIN` set in host environment
  - [ ] Plausible site created at plausible.io
  - [ ] Test permalink generated → opened in incognito on phone → same result
  - [ ] Test "Reportar erro" mailto → email arrives at gairifo@gmail.com
  - [ ] Test "Copiar email" fallback → clipboard contains email
  - [ ] iOS Safari: open `/calculadora` → fill in → tap "Imprimir / Guardar como PDF" → share-sheet → Print → pinch to PDF → looks like reference PDF
  - [ ] Android Chrome: same end-to-end
  - [ ] Desktop Firefox: print preview shows expanded `<details>`, no nav/footer chrome
  - [ ] Schema.org validator green for `/`, `/apoios/csi`, `/calculadora`
  - [ ] Sitemap `https://lar-ajuda.pt/sitemap-index.xml` resolves
  - [ ] `robots.txt` references sitemap
  - [ ] All 3 deep-dive pages have last-updated dates within 90 days
- **E3. Soft-launch channels** (out of scope for this bundle, but noted): roadmap §Phase 1.8 calls Reddit Portugal, Facebook cuidadores informais groups, 2–3 LinkedIn posts. Pedro's call when to pull the trigger.

**Phase E success criteria:** Launch checklist 100% checked; reference PDF in repo; 3 unsolicited testers (e.g., Pedro's siblings) complete the wizard end-to-end without confusion.

## System-Wide Impact

### Interaction Graph

The wizard is the only place where everything intersects. Trace of a single user flow:

**Permalink hydration path:**
1. User opens `/calculadora#i=...` → Astro serves static HTML with React island unmounted.
2. Browser parses, hydrates Wizard via `client:load`.
3. `useState(empty)` first-render → SSR'd HTML matches → no hydration mismatch.
4. `useEffect` runs → reads `window.location.hash` → calls `permalink.decode()`.
5. On success: validates against Zod schema → `setInput(decoded.input); setStage("result"); plausible("permalink_loaded")`.
6. Result page renders → `Article + FAQPage @graph` JSON-LD does NOT apply here (only on `/apoios/*`); but `valores de YYYY` banner appears.
7. User clicks "Copiar link" → `permalink.encode(input, 2026)` → `history.replaceState(null, "", "#i=...")` → `navigator.clipboard.writeText(...)` → `plausible("permalink_copied")` → toast.

**Wizard submission path:**
1. User completes stage 1 + stage 2 → clicks "Calcular apoios →" → `setStage("result")`.
2. `useMemo` runs `calcular(input)` (existing pure-TS engine).
3. First time per session: `sessionStorage.getItem("calc_completed_session")` is null → fire `plausible("calculator_completed")` → set flag.
4. Subsequent navigations within session do NOT re-fire.

### Error & Failure Propagation

| Layer | Failure | Behavior |
|---|---|---|
| `permalink.decode()` | malformed base64, lz-string fails | Returns `{ok: false, reason: "malformed"}` → wizard shows banner, stays on stage 1 |
| `permalink.decode()` | Zod validation fails | Returns `{ok: false, reason: "validation_failed"}` → same banner |
| `permalink.decode()` | `v` is newer than known | Returns `{ok: false, reason: "version_too_new"}` → banner: "Este link foi gerado com uma versão mais recente — atualize a página." |
| `navigator.clipboard.writeText` | permission denied (some mobile contexts) | Toast: "Não foi possível copiar — selecione e copie manualmente: [URL visible]" |
| `window.plausible` | undefined (script blocked, env unset) | Wrapped in optional chaining `window.plausible?.(...)` → silent noop |
| `window.print()` | (always succeeds; OS handles print dialog) | n/a |
| Sitemap build | `site:` missing | (already set; build already would have failed) |
| Markdown parse error | bad frontmatter | Astro build fails loudly → caught pre-deploy |
| Source-redirect 404 | slug not in map | Astro build fails (slug must exist for the page to be generated) |

### State Lifecycle Risks

- **Permalink encodes a SNAPSHOT of inputs at copy time.** Constants are NOT encoded with full granularity — only the year (`c: 2026`). When `constants_2026.json` is updated mid-year (e.g., Portaria 480/2025 publishes a corrected IAS), the re-decoded result MAY differ from the original. Mitigation: bump `c` to 2026.1 if mid-year correction occurs (semver-ish), and only show the warning banner on `c` mismatch at year level.
- **`sessionStorage` flag for `calculator_completed` event** doesn't survive new tabs. A user who refreshes the page and re-completes counts as a new completion. Acceptable — Plausible has no `distinct_id`-style session model anyway.
- **Hash in `history.replaceState` doesn't push to back-stack.** Good: user can't accidentally navigate "back" to an empty form. Bad: if they want to A/B between two scenarios, they have to keep both URLs in tabs. Document as known limitation.

### API Surface Parity

The calculator module is **single-surface**: only `Wizard.tsx` consumes it. No backend, no mobile app, no other entry point. So:
- Adding `permalink.encode()` and `permalink.decode()` doesn't fork any consumer.
- The Zod schema becomes the canonical input contract — both TS types and runtime validation derive from it. Single source of truth.
- Future Phase 2 wizard branching can extend the schema additively (new optional fields → safe for v=1 permalinks since decoder fills missing as undefined → null).

### Integration Test Scenarios

These are the cross-layer cases unit tests with mocks won't catch:

1. **Permalink round-trip across browsers.** Encode in Chrome → decode in Safari → same `ApoiosResult`. Fragility: lz-string outputs URI-safe by design, but verify on iOS Safari which historically has had `URIComponent` quirks.
2. **Permalink + constants update.** Save a permalink against constants_2026. Change `constants_2026.json` to `constants_2027.json` locally → reload permalink → user sees `c` mismatch banner AND the new computed value (intended).
3. **Plausible script blocked.** Open `/calculadora` with uBlock Origin in aggressive mode → wizard works fine, no console errors. Custom-event calls noop.
4. **Print on iOS Safari from result page.** Tap "Imprimir / PDF" → share-sheet appears → Print → pinch to PDF. The 3 expanded `<details>` (calculation-explanation blocks) all show open in the PDF — this is the test of the `beforeprint` listener.
5. **Deep-dive page with malformed FAQ frontmatter.** Author makes a typo (e.g., 4 FAQs instead of ≥5) → `npm run build` fails with Zod error pointing to the file → deep-dive does not silently ship broken.
6. **Source link rot.** Update `src/data/source-redirects.ts` for one citation → rebuild → that one URL changes everywhere it's referenced; markdown content untouched.

## Alternative Approaches Considered

| Alternative | Why rejected |
|---|---|
| **Permalinks via query string** | Personal financial data ends up in server logs / referer / analytics. Hash never reaches server. Locked. |
| **Permalinks via raw base64(JSON)** | ~2.5× longer than lz-string for our payload size; messenger truncation risk. Lz-string yields 50–70% size with `compressToEncodedURIComponent`, no extra encoding step needed. Locked. |
| **Permalinks via server-side short-link service** | Re-introduces a backend, breaks the privacy guarantee, adds latency, ops burden. Locked: client-side hash. |
| **Server-side PDF (Puppeteer/Playwright)** | Adds 150 MB infra, cold-start latency, security surface. Best-practices research showed CSS print stylesheet + `window.print()` is the right answer for this use case. Defer Playwright to Phase 4 if data shows demand. |
| **client-side PDF (jsPDF / html2pdf)** | html2canvas rasterizes the DOM → unsearchable text, broken Portuguese diacritics, larger files. Rejected. |
| **Cookieless analytics: Cloudflare Web Analytics or Umami instead of Plausible** | Roadmap §Phase 1 explicitly named Plausible. Plausible's custom-event API is what makes `calculator_completed` measurable without a backend. Cloudflare WA has no custom events. Umami requires self-hosting. Locked. |
| **Astro `.astro` content pages instead of Content Collections** | The 3 deep-dives have 4+ structured fields each (sources array with archive URLs, faqs array, lastUpdated). Inline JS arrays in `.astro` frontmatter become unreadable fast and have no schema validation. Content Collections give Zod validation + type-safe queries + auto-routing. Locked. |
| **Hand-rolled sitemap.xml** | `@astrojs/sitemap` is one line and auto-detects Content Collection routes. Hand-rolled means manual updates per page. Locked: integration. |
| **Display `FAQPage` rich snippet expectation** | Google deprecated for non-gov/non-health Aug 2023. Ship the JSON-LD anyway (helps Bing + AI/LLM crawlers; harmless for Google) but don't include "Google rich snippet appears" in success criteria. |
| **Pure-CSS `<details open>` on print** | Best-practices research confirmed: no reliable cross-browser pure-CSS solution. `details::details-content` is Chromium-only (131+). Use `beforeprint`/`afterprint` JS listeners. Locked. |
| **`client:only="react"` for Wizard** | Tempting (skips SSR hydration entirely → can read `window` in initializer) but loses static-HTML for crawlers and breaks JS-disabled fallback. The two-render `useEffect` pattern is the canonical fix. Locked: keep `client:load`. |
| **Long SEO slugs (`/apoios/csi-complemento-solidario-idosos`)** | Existing `apoios/index.astro` already uses short slugs (`csi`, `complemento-dependencia`). Internal consistency wins. SEO phrase lives in `<title>` and `<h1>`, not the URL. Locked: short slugs. |

## Acceptance Criteria

### Functional Requirements

#### R1 — Permalinks
- [ ] User completing the wizard can click "Copiar link" on the result page.
- [ ] Copied URL has format `/calculadora#i=<lz-string-encoded>`.
- [ ] Opening the URL in any browser (incognito, different device) restores the same inputs and shows the same numeric result.
- [ ] Permalink payload includes both `v` (schema version) and `c` (constants year).
- [ ] Permalinks under 1,800 chars for typical Pedro-family input (verified).
- [ ] Malformed permalink shows recovery banner; does not crash; user lands on empty stage 1.
- [ ] Constants-year mismatch shows banner: "valores de YYYY" + recommendation to recalculate.
- [ ] Schema-stability comment present above `ApoiosInput` definition.
- [ ] `permalink_copied` and `permalink_loaded` Plausible events fire correctly; do not double-fire.

#### R2 — PDF / Print polish
- [ ] `window.print()` from result page produces a clean A4 PDF.
- [ ] Header nav, footer chrome, and CTA buttons are hidden in print.
- [ ] All `<details>` blocks (per-apoio "Como é calculado") are open in the PDF.
- [ ] Page-break-inside: avoid on apoio cards.
- [ ] Result-page permalink (full URL) printed at the top of the first page (so the printed PDF *is* shareable back into the calculator).
- [ ] "Valores de 2026" banner visible in the PDF.
- [ ] Reference PDF (E1) committed at `docs/reference/example-case.pdf`.
- [ ] On touch devices, button copy says "Guardar como PDF" instead of "Imprimir / PDF".

#### R3 — Three deep-dive apoio pages
- [ ] `/apoios/csi`, `/apoios/complemento-dependencia`, `/apoios/atestado-multiusos` all return 200 from the static build.
- [ ] Each page ≥ 1,800 words.
- [ ] Each page contains all 8 template sections (Hero, O que é, Quem tem direito, Quanto vale, Como pedir, Erros comuns, FAQ ≥ 5, Fontes).
- [ ] Each page emits combined `Article` + `FAQPage` `@graph` JSON-LD with `inLanguage: "pt-PT"`.
- [ ] Each page has `lastUpdated` set to within 90 days of launch.
- [ ] Each page has CTA back to `/calculadora` framed as "Ver quanto eu posso receber →".
- [ ] Each page has CC-BY-SA 4.0 footer notice.
- [ ] Source citations route through `/r/<slug>` redirects, not raw DGSS URLs.
- [ ] `apoios/index.astro` queries Content Collection (no inline arrays).
- [ ] PT-PT vocabulary verified (no "fato"/"ação"/"aposentadoria" leak from PT-BR).

#### R4 — "Reportar erro" link
- [ ] Footer of every page has "Reportar erro nesta página" link.
- [ ] Link is `mailto:gairifo@gmail.com` with `subject` and `body` prefilled with the page path and timestamp.
- [ ] Adjacent "Copiar email" affordance for users without configured mail client.

#### R5 — Plausible analytics
- [ ] `<script>` only renders when `PUBLIC_PLAUSIBLE_DOMAIN` env var is set.
- [ ] Uses `is:inline` directive (Astro 5 requirement).
- [ ] Custom events fire: `calculator_completed` (once per session, on wizard submission), `permalink_copied`, `permalink_loaded`, `permalink_invalid`.
- [ ] All `window.plausible(...)` calls wrapped in optional chaining → silent noop if blocked.
- [ ] `pathname`-only tracking (no full URL in analytics) — verified by inspecting Plausible config.
- [ ] Verified against Plausible test mode using a staging `data-domain`.

#### R6 — SEO basics
- [ ] `@astrojs/sitemap` integration installed and configured.
- [ ] `https://<domain>/sitemap-index.xml` resolves and lists all routes.
- [ ] `public/robots.txt` allows all + references sitemap.
- [ ] Each deep-dive emits `Article` + `FAQPage` `@graph` JSON-LD.
- [ ] Homepage emits `Organization` + `WebSite` JSON-LD.
- [ ] `<html lang="pt-PT">` and `hreflang="pt-pt"` set.

#### R7 — Soft-launch readiness
- [ ] `docs/launch-checklist.md` exists and is followed top-to-bottom pre-launch.
- [ ] Reference PDF at `docs/reference/example-case.pdf` is the regression baseline.

### Non-Functional Requirements

- [ ] Total static-build size increase: ≤ 100 kB gzipped vs Phase 0 baseline (Wizard already 12.66 kB; permalink module + Zod < 30 kB).
- [ ] Wizard time-to-interactive on mid-range Android ≤ 2.5 s on 4G (Plausible script is async/defer).
- [ ] Calculator engine remains pure TS — no DOM imports.
- [ ] All new code passes `npm run check` (Astro type checker) with zero errors.

### Quality Gates

- [ ] `npm test` — 35 existing calculator tests still pass + at least 5 new tests for `permalink.ts` (encode/decode round-trip, malformed input, version mismatch, constants-year mismatch, length cap).
- [ ] `npm run build` — passes with zero warnings.
- [ ] Manual review of deep-dive content by Pedro before merge (legal-adjacent text).
- [ ] Schema.org validator green on `/`, `/apoios/csi`, `/calculadora`.

## Success Metrics

These are the post-launch metrics from origin doc + roadmap §Phase 1 success criteria. Tracked via Plausible:

- ≥ 500 unique users in first 30 days post-launch (Plausible visitors)
- ≥ 50% completion rate (`calculator_completed` ÷ unique pageviews on `/calculadora`)
- ≥ 100 permalink shares (`permalink_copied` events)
- ≥ 3 unsolicited family testimonials (qualitative — counted manually from email + soft-launch channels)
- Top-10 Google PT ranking within 90 days for at least one of: "complemento por dependência", "csi 2026", "atestado multiusos como pedir"

## Dependencies & Prerequisites

**External (Pedro to handle):**
- Domain `lar-ajuda.pt` (or chosen alternative) registered.
- Cloudflare Pages or Vercel account.
- Plausible account at plausible.io with site created.
- Pedro's family case run through wizard for E1 reference PDF.

**Internal (this bundle):**
- Phase 0 calculator engine — done, 35 tests passing.
- `astro.config.mjs` updates (sitemap, astro:env).
- New deps: `lz-string`, `zod`, `@astrojs/sitemap`. (Zod may already transitively be present via Astro; verify.)

## Risk Analysis & Mitigation

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Constants update mid-year breaks permalink "same result" promise | M | M | `c` field in payload; banner on mismatch; document in privacy page |
| Permalink schema drift breaks shared links | L (locked schema) | H | `v` field + migrators table + schema-stability comment in code |
| Deep-dive content has legal/factual errors | M | H | Source every claim with /r/ redirect; "Reportar erro" link; Pedro review pre-merge; CC-BY-SA invites correction |
| FAQ JSON-LD treated as spammy structured data | L | L | Only mark up FAQs that are visibly rendered; standard pattern; no manual-action precedent |
| Plausible blocked by adblockers (~25–35% of users) | H | L | Acceptable — analytics is directional, not transactional. Wrap in noop. |
| Mobile Safari print produces poor PDF | M | M | E1 reference PDF on iOS specifically; iOS Chrome and Android tested in launch checklist |
| Pedro burns out writing 6,000 words across 3 weekends | M | M | Section template (8 sections × ~250 words avg) is more tractable than one 2,000-word essay; can ship one page first if needed |
| Astro 5 minor version breaks Content Collections API | L | M | Pin Astro version in package.json; `npm test && npm run build` in CI |
| Domain registration delays soft launch | M | L | Bundle ships independently of domain; launch is the gated step |

## Resource Requirements

- **Pedro time:** 2–3 weekends. Phase A+B+D+E ~1 weekend (engineering); Phase C ~1.5–2 weekends (content authoring + review).
- **Money:** ~€30/year (domain) + €9/month Plausible. ~€150/year ongoing.
- **Infra:** Cloudflare Pages free tier or Vercel free tier. Zero backend.

## Future Considerations

Things this bundle deliberately does NOT do but builds the foundation for:

- **Phase 1.7 (cold-start price seeding) and Phase 2 wizard** — the permalink schema's `v` field and migrators table are designed for the field-shape changes Phase 2 will require.
- **Phase 2 lar profile pages** — Content Collections pattern established here will be reused: `lares` collection, `[...slug].astro`, JSON-LD as `LocalBusiness`.
- **Phase 3 per-município pages** — programmatic SEO. Sitemap auto-detection already wired.
- **Phase 4 agentic concierge** — out of scope but the permalink pattern means an agent can take a permalink as input.
- **Yearly constants update** — README already documents the ritual. Bundle's `c` field formalizes the version contract on permalinks.

## Documentation Plan

- Update `README.md`: add "Permalinks", "Analytics", and "Content authoring" sections.
- Add `docs/AUTHORING.md`: how to write a new deep-dive (file location, frontmatter schema, 8-section template, source-redirect workflow).
- Add `docs/launch-checklist.md` (R7).
- Add `docs/reference/example-case.pdf` (E1).
- Add inline schema-stability comment in `src/lib/calculator/types.ts`.
- Update `/privacidade` page (D3).

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-05-10-phase-1-soft-launch-bundle-requirements.md](../brainstorms/2026-05-10-phase-1-soft-launch-bundle-requirements.md). Key decisions carried forward: (1) hash-based permalinks with `v` schema versioning, (2) Plausible over Cloudflare Web Analytics, (3) `mailto` over a bug-report form, (4) the 3 deep-dive apoios = CSI / Complemento por Dependência / Atestado Multiusos, (5) ~2,000-word depth per Pedro's call.

### Internal references

- Phase 0 calculator: [src/lib/calculator/index.ts](../../src/lib/calculator/index.ts) and the 35-test suite in `__tests__/`.
- Wizard component to modify: [src/components/Wizard.tsx](../../src/components/Wizard.tsx).
- Constants pattern to honor: [src/lib/calculator/constants.ts](../../src/lib/calculator/constants.ts) (`with { type: "json" }` import).
- Existing print CSS to consolidate: [src/pages/calculadora.astro](../../src/pages/calculadora.astro) (page-scoped `<style is:global>` block).
- Existing apoios index inline array to replace: [src/pages/apoios/index.astro](../../src/pages/apoios/index.astro).

### External references

#### Astro 5
- [Content Collections](https://docs.astro.build/en/guides/content-collections/) — `defineCollection`, `glob` loader, `getCollection`, `render()`
- [Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)
- [Upgrade to v5](https://docs.astro.build/en/guides/upgrade-to/v5/) — what changed from v4
- [Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [Environment variables](https://docs.astro.build/en/guides/environment-variables/) — `astro:env` schema-validated approach
- [v5 release notes](https://astro.build/blog/astro-5/)

#### Schema.org / SEO
- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [FAQPage structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage) (note: rich result limited to gov/health since Aug 2023)
- [Google: Changes to HowTo and FAQ rich results, 2023](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [The rise and fall of FAQ schema (Search Engine Land)](https://searchengineland.com/faq-schema-rise-fall-seo-today-463993)

#### Analytics / Privacy
- [Plausible Data Policy](https://plausible.io/data-policy)
- [Plausible custom events](https://plausible.io/docs/custom-event-goals)
- [Plausible script extensions (tagged-events)](https://plausible.io/docs/script-extensions)
- [CNPD / Lei 41/2004 — Portuguese ePrivacy](https://www.consentstack.io/regulations/pt-law41)
- [Cookieless compliance analysis](https://ocdevel.com/blog/20250614-cookieless-compliance)

#### Permalink encoding
- [URI Fragment — RFC 7231 Referer behaviour](https://en.wikipedia.org/wiki/URI_fragment)
- [HttpWatch: 6 things to know about fragment URLs](https://blog.httpwatch.com/2011/03/01/6-things-you-should-know-about-fragment-urls/)
- [lz-string — `compressToEncodedURIComponent`](https://github.com/pieroxy/lz-string)
- [Personal data in URLs (PrivacyWise)](https://www.privacy-wise.com/personal-data-in-urls/)

#### Print/PDF
- [MDN: Printing CSS media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing)
- [W3C CSSWG issue 2084 — styling `<details>` open for print](https://github.com/w3c/csswg-drafts/issues/2084)
- [HTML to PDF benchmark 2026](https://pdf4.dev/blog/html-to-pdf-benchmark-2026)
- [CSS print styles complete guide](https://pdf4.dev/blog/css-print-styles-pdf-guide)

#### PT-PT SEO + apoios
- [Schema.org multilingual / inLanguage guidance](https://pageoneformula.com/using-schema-org-for-multilingual-content/)
- [Complete Guide for Doing SEO in Portuguese](https://www.ranktracker.com/blog/a-complete-guide-for-doing-seo-in-portuguese/)
- [Segurança Social — Complemento por Dependência](https://www.seg-social.pt/complemento-por-dependencia)

### Related work

- [Roadmap §Phase 1](../brainstorms/2026-05-10-phase-1-soft-launch-bundle-requirements.md) (origin)
- [tempodeespera.pt](https://tempodeespera.pt) (architectural inspiration: small, neutral, durable)

## Open Questions Now Resolved (from origin doc's `Deferred to Planning`)

| Origin Q | Resolution in this plan |
|---|---|
| Content Collections vs `.astro` for deep-dives | **Content Collections.** Zod validation, type-safe queries, frontmatter authoring ergonomics, dynamic-route auto-generation. Phase C details. |
| Plausible env-flag default | **Disabled by default.** Script renders only when `PUBLIC_PLAUSIBLE_DOMAIN` is set. Use `astro:env` (Astro 5 type-safe pattern) for schema-validated client env. Phase A2 + A7. |
| Source link-rot strategy | **`/r/<slug>` redirect map** in `src/data/source-redirects.ts` + per-source `archive_url` in frontmatter. Markdown links via `/r/<slug>` not raw URLs. Single file to update on URL change. Phase C5. |
| Sitemap integration vs hand-rolled | **`@astrojs/sitemap` integration.** Auto-detects all routes including Content Collection dynamics. Phase A3. |

## Open Questions Surfaced by This Plan

| # | Question | Tag | Where it lands |
|---|---|---|---|
| 1 | Should the permalink encoding include a `c` (constants year) field, or just rely on the visible "Valores de YYYY" banner? | [Decided] | **Yes, encode `c`.** Defensive against silent drift across yearly updates. Phase B7. |
| 2 | When `c` mismatches between permalink and current constants, do we re-run `calcular()` with current constants (default) or with archived constants? | [Decided] | **Re-run with current constants.** Recomputing with archived-snapshot would mean shipping multiple `constants_YYYY.json` files in the bundle forever. Banner explains drift. |
| 3 | Should deep-dive pages link to the calculator with **inputs preset** (e.g., `/calculadora#i=...` for a "see how this applies to a baseline pensioner")? | [Deferred] | Phase 2 idea — would require building "scenario" payloads. Not in this bundle. |
| 4 | Slug for `atestado-multiusos` doesn't match an `apoio_id` in the calculator (no Atestado-Multiusos calculator output — it's an enabler for IRS Art. 87). How should the deep-dive link back to the calculator? | [Decided] | Page links to `/calculadora` with copy: "Ver se desbloqueia apoios fiscais →"; the IRS Art. 87 result will then surface the value. Phase C2. |
| 5 | License for the deep-dive content — origin doc said "MIT for engine" but didn't specify content. | [Decided] | **CC-BY-SA 4.0** for `/apoios/*`. Engine remains MIT (root LICENSE unchanged). Phase D4. |

No items remain that block execution **except** the IAS-value verification flagged in the Enhancement Summary above — gated before Phase C only.

---

# Appendix A — PT-PT Content Authoring Brief (Phase C)

> Hand to writer (Pedro, or Claude with Pedro review). Source: best-practices-researcher agent, 2026-05-10. Every numeric value flagged `[CONFIRMAR]` must be re-verified against the actual DR-published Portaria de atualização 2026 before publication. The IAS discrepancy noted in the Enhancement Summary blocks this Appendix from being authoritative until Pedro reconciles it.
>
> **Tone for all 3 pages:** calm, factual, no alarmism, no "guerra ao Estado." The reader is mid-decision and needs numbers, not indignation. Short sentences. Tables for values. Boxes for "Em 30 segundos" and "Erro comum." End every page with the same single CTA: "Use o nosso simulador para saber a que apoios o seu familiar tem direito" linking to `/calculadora`.
>
> **Avoid absolutely:** "pleitear", "requerer junto à", "no que tange", "burocracia kafkiana", and any Brazilian construction (gerúndio "estou fazendo" → use "estou a fazer").

## A.1 — `/apoios/csi` (Complemento Solidário para Idosos)

### Outline (~2,000 words)

1. **Lede + "Em 30 segundos"** — 150 palavras
2. **O que é o CSI e a quem se destina** — 200 pal. (natureza diferencial; base legal DL 232/2005 + DL 126-A/2017; articulação com pensão)
3. **Quem tem direito em 2026 (requisitos completos)** — 300 pal. (idade ≥ 66 anos e 9 meses; residência legal ≥ 6 anos consecutivos ou interpolados em PT; requerer todas as pensões a que tenha direito; rendimentos abaixo do limiar)
4. **Quanto se recebe — a conta explicada com exemplo numérico** — 350 pal. (8.040 €/ano singular; 14.070 €/ano casal; tecto mensal prático ~670 €; CSI = (valor referência − rendimentos considerados) ÷ 14; exemplo: viúva com pensão 280 €/mês)
5. **O que conta como "rendimentos do requerente" (e do agregado)** — 250 pal. (pensões, rendas, capitais, **25% do rendimento dos filhos** com IRS acima de determinado escalão; exclusões: prestações por deficiência, subsídios eventuais)
6. **Benefícios "extra" desbloqueados pelo CSI** — 250 pal. (medicamentos 100% escalão A + 95% escalão B; óculos até 100 €/2 anos; próteses dentárias até 250 €/3 anos; tarifa social energia/água/telecomunicações)
7. **Como pedir, passo-a-passo (Segurança Social Direta + presencial)** — 300 pal. (Mod. RP5046-DGSS [CONFIRMAR número]; documentos: IRS último ano de todo o agregado, comprovativo morada, IBAN; prazo médio decisão 90 dias; renovação anual automática mas obrigação de comunicar alterações)
8. **Erros comuns + FAQs + fontes oficiais** — 200 pal.

### Factos obrigatórios para 2026
- Idade mínima: **66 anos e 9 meses** (subiu de 66a7m em 2025).
- Valor referência: **8.040,00 €** singular / **14.070,00 €** casal. Tecto mensal ≈ **670 €** ÷ 14.
- Pago **14 vezes/ano**.
- Residência legal em PT **≥ 6 anos** anteriores ao requerimento.
- Tem de ter requerido **todas** as pensões nacionais e estrangeiras a que tenha direito.
- **25% do rendimento dos filhos** entra no cálculo (regra "agregado familiar alargado") quando estes têm IRS acima de determinado escalão — regra mais desconhecida.
- Excluídos: **Complemento por Dependência, prestações por deficiência, bolsas, subsídios funeral**.
- Atribui automaticamente: medicamentos (Portaria 91/2006), óculos, próteses dentárias removíveis, tarifa social.
- Formulário: **Mod. RP5046-DGSS** (em 2026 também 100% online via SSDireta) [CONFIRMAR código].
- **Suspende/cessa** se idoso for institucionalizado em ERPI com acordo (SS paga lar).

### FAQs (≥ 5, perguntas reais do Google PT)
1. "Quanto recebe quem tem CSI em 2026?"
2. "CSI conta o ordenado dos filhos?"
3. "Posso ter CSI e pensão de sobrevivência ao mesmo tempo?"
4. "Quanto tempo demora a aprovação do Complemento Solidário?"
5. "Vou para um lar — perco o CSI?"

### Fontes a citar
- `seg-social.pt` → "Complemento Solidário para Idosos" (guia + Mod. RP5046)
- **DL n.º 232/2005**, 29 Dezembro — `dre.pt`
- **DL n.º 126-A/2017** (alargamento idade)
- **Portaria n.º 91/2006** (medicamentos)
- SNS24 (1400) — comparticipações
- Portaria de actualização 2026 (DR Dez/2025) `[CONFIRMAR]`

### Erros típicos das famílias
- Não pedir porque "o meu pai tem pensão de 320 € e acha que é muito" — desconhecem que CSI completa até ~670 €.
- Não declarar conta bancária com 8.000 € de poupança → indeferimento por omissão.
- Pensar que IRS dos filhos não conta — conta, é a primeira causa de indeferimento.
- Esquecer pensão estrangeira (emigrantes França/Suíça/Alemanha) antes do CSI → indeferimento.
- Acreditar que renovação automática dispensa comunicar morte de cônjuge ou nova reforma → gera dívidas.

### Lede (não desviar)
> O Complemento Solidário para Idosos (CSI) existe para garantir que ninguém com mais de 66 anos e 9 meses vive em Portugal abaixo de um patamar mínimo de rendimento. Não é um favor nem uma esmola: é um direito previsto em lei desde 2005, calculado de forma simples — completa o que falta para chegar aos 8.040 € por ano (cerca de 670 € por mês) — e desbloqueia automaticamente medicamentos gratuitos, óculos e tarifas sociais. Se o seu pai ou a sua mãe recebe uma pensão pequena, vale a pena ler até ao fim antes de assumir que "não chega".

---

## A.2 — `/apoios/complemento-dependencia` (Complemento por Dependência, 1.º e 2.º grau)

### Outline (~2,000 palavras)

1. **Lede + caixa "Quanto vai receber"** — 150 pal.
2. **O que é o Complemento por Dependência** — 200 pal. (DL 265/99, alterado pelo DL 309-A/2000; mensal, vitalício, acumulável com pensão)
3. **Os dois graus de dependência — definição clínica clara** — 250 pal. (1.º: ajuda em AVDs — alimentação, higiene, locomoção; 2.º: acamado/cadeira de rodas + perturbação cognitiva grave OU dupla incontinência permanente)
4. **Tabela 2026 — os 4 valores** — 200 pal.
5. **Como funciona em lar com acordo (a regra que custa dinheiro às famílias)** — 250 pal.
6. **Como pedir — Mod. RP 5027-DGSS, junta médica SVI** — 300 pal.
7. **Prazos reais e o que fazer enquanto se espera** — 200 pal. (~150 dias decisão; retroactivos desde data do requerimento)
8. **Acumulação com outros apoios + erros comuns + FAQs + fontes** — 450 pal.

### Factos obrigatórios (valores 2026)

| Regime | 1.º grau | 2.º grau |
|---|---|---|
| **Regime Geral** (pensões contributivas) | **131,20 €/mês** | **236,16 €/mês** |
| **Regime Não Contributivo** (pensão social, rural, etc.) | **118,08 €/mês** | **223,04 €/mês** |

- Pago **14 vezes/ano** (subsídios Junho e Natal).
- **Acumula** com pensão velhice/invalidez/sobrevivência **e** CSI (CSI não conta o CD como rendimento).
- **Não acumula** com Subsídio por Assistência de 3.ª pessoa.
- Formulário: **Mod. RP 5027-DGSS** + relatório médico inicial.
- Avaliação: **SVI — Sistema de Verificação de Incapacidades** (não confundir com Junta Médica do Atestado Multiusos).
- Prazo médio real 2026: **120–180 dias.** Retroactivos pagos desde data do pedido.
- **Regra do lar com acordo (CRÍTICA):** em ERPI com acordo de cooperação, 2.º grau é pago apenas pelo valor do 1.º grau (diferença reverte para o lar). Em lar privado **sem acordo**, recebe 2.º grau integral.
- Vitalício enquanto persistir condição.
- Isento de IRS.

### FAQs
1. "Qual a diferença entre 1.º e 2.º grau de dependência da Segurança Social?"
2. "Quanto tempo demora o complemento por dependência a ser aprovado?"
3. "Posso ter complemento por dependência e CSI ao mesmo tempo?"
4. "O lar fica com o complemento por dependência do meu pai?"
5. "Quem tem Alzheimer tem direito ao 2.º grau automaticamente?"

### Fontes
- **DL n.º 265/99** 14 Julho + **DL n.º 309-A/2000** + actualizações — `dre.pt`
- `seg-social.pt` → "Complemento por Dependência" (guia + Mod. RP 5027)
- Portaria de actualização 2026 (DR Dez/2025) `[CONFIRMAR]`
- Página do **SVI** no portal SS
- Linha SS: **300 502 502**

### Erros das famílias
- Pedir CD **antes** de ter relatório médico recente (< 6 meses) com diagnóstico claro e descrição funcional → atrasa 3 meses.
- Médico de família escrever "necessita de apoio" em vez de descrever incapacidade para alimentar-se / vestir-se / fazer higiene / deslocar-se → SVI atribui 1.º em vez de 2.º grau.
- Assinar admissão em lar com acordo sem perceber que 2.º grau passa a 1.º — família perde ~105 €/mês.
- Optar pelo Subsídio por Assistência de 3.ª pessoa (do filho cuidador) sem perceber que exclui o CD do idoso — em 90% dos casos o CD é mais vantajoso.
- Não pedir reavaliação após AVC ou progressão de demência.

### Lede
> O Complemento por Dependência é provavelmente o apoio mais importante — e mais subaproveitado — do sistema português para quem cuida de um idoso. Acrescenta entre **118 € e 236 € por mês** à pensão, é vitalício, é pago 14 vezes por ano e não paga IRS. Quem tem Alzheimer, sequelas de AVC, Parkinson avançado ou simplesmente já não consegue tomar banho sozinho tem, quase de certeza, direito a recebê-lo. Esta página explica como pedir, quanto demora, e a única regra que custa dinheiro às famílias quando o idoso entra num lar com acordo.

---

## A.3 — `/apoios/atestado-multiusos` (DL 14/2013)

### Outline (~2,000 palavras)

1. **Lede + "Para que serve este papel"** — 150 pal.
2. **O que é o Atestado Médico de Incapacidade Multiusos (AMIM)** — 200 pal. (base legal DL 202/96 republicado pelo DL 174/97; **DL 291/2009**; **DL 14/2013** simplifica e dispensa renovação para condições permanentes)
3. **Os graus que importam — 60% e 90%** — 250 pal.
4. **O que se desbloqueia em cada grau (lista exaustiva)** — 350 pal.
5. **Como pedir — passo-a-passo real, 2026** — 300 pal. (1) marcar consulta no centro de saúde; 2) médico assistente preenche requerimento + relatório clínico; 3) envio para a **ARS regional**; 4) convocatória para junta médica; 5) emissão do atestado)
6. **Prazos, custo, validade** — 200 pal. (gratuito; espera **2 a 6 meses**; vitalício se condição permanente)
7. **Patologias que tipicamente atingem ≥ 60% e ≥ 90% (orientadora, não vinculativa)** — 250 pal.
8. **Erros comuns + FAQs + fontes** — 300 pal.

### Factos obrigatórios 2026
- Base legal actual: **DL n.º 202/96** (TNI) + **DL n.º 291/2009** + **DL n.º 14/2013**.
- Avaliação por **junta médica** convocada pela ARS regional (não pela SS).
- **Gratuito.**
- Espera real 2026: **2 a 6 meses** (Lisboa e Porto: mais perto dos 6).
- Validade: **vitalícia** se condição permanente.
- **Grau ≥ 60% (TNI)** desbloqueia:
  - **IRS Art. 87.º CIRS:** dedução à colecta de **2,5 × IAS** = **1.306,25 €** [CONFIRMAR — depende do IAS 2026 final]
  - Majoração de despesas de saúde e formação dedutíveis
  - **ISV/IUC** — isenção parcial/total na compra e circulação de viatura adaptada (DL 16/2021)
  - **IMT/IMI** — isenção/redução em habitação própria permanente em determinadas condições
  - Tarifa reduzida em transportes
  - Estacionamento — dístico de mobilidade reduzida
- **Grau ≥ 90%** acresce:
  - Dedução adicional por **acompanhante**: **4 × IAS** = **2.090,00 €** [CONFIRMAR] (Art. 87.º n.º 7 CIRS)
  - Acesso a PSI (Prestação Social para a Inclusão) — para < 66 anos; idosos normalmente já em pensão.
- Patologias frequentes em idosos com ≥ 60%: demência (Alzheimer, vascular, corpos de Lewy) em fase moderada; sequelas de AVC com hemiparesia; Parkinson estádio 3+ Hoehn-Yahr; DPOC grave; insuficiência cardíaca NYHA III/IV; cegueira bilateral; amputação de membro inferior.
- ≥ 90% típico: demência avançada (GDS 6-7); AVC com tetraparesia; acamados permanentes.

### FAQs
1. "Como pedir o atestado multiusos para o meu pai com Alzheimer?"
2. "Quanto tempo demora a junta médica do atestado multiusos em 2026?"
3. "O atestado multiusos tem de ser renovado todos os anos?"
4. "Quanto desconta no IRS um atestado multiusos de 60%?"
5. "Demência dá 60% ou 90% no atestado multiusos?"

### Fontes
- **DL n.º 202/96** + **DL n.º 291/2009** + **DL n.º 14/2013** — `dre.pt`
- **CIRS Art. 87.º** — `info.portaldasfinancas.gov.pt`
- Portaria de actualização do IAS 2026 (DR Dez/2025) `[CONFIRMAR]`
- ARS regional do utente (Norte, Centro, LVT, Alentejo, Algarve)
- **SNS24** (1400)
- **e-Fatura** (declaração de despesas com majoração)
- **DL n.º 16/2021** (isenção ISV viaturas adaptadas)

### Erros das famílias
- Pedir directamente à ARS sem passar pelo médico assistente → devolvido.
- Levar à junta médica relatório de **um único especialista** quando há multipatologia — a junta avalia o conjunto; faltar relatório (p. ex. neuropsicologia em demência) pode baixar 90% para 60%.
- Não pedir cópia do **processo da junta** — sem ela, impossível recorrer no prazo de **30 dias**.
- Submeter no IRS sem ter o atestado emitido **antes de 31 de Dezembro do ano fiscal** — perde-se benefício desse ano.
- Acreditar que "atestado de incapacidade temporária" do médico de família serve para IRS — **não serve**, só o multiusos.
- Não pedir, em vida, para idoso com demência avançada porque "já está velhinho" — perdem-se 1.300–3.400 € em IRS por ano de dedução.

### Lede
> O Atestado Médico de Incapacidade Multiusos é uma folha de papel A4 que pode valer à sua família **mais de 3.000 € por ano em IRS**, isenção na compra de uma viatura adaptada e dístico de estacionamento. É gratuito, é vitalício se a condição for permanente (demência, AVC, Parkinson) e a lei que o regula — o Decreto-Lei 14/2013 — foi feita precisamente para simplificar a vida a quem cuida. O processo demora entre dois e seis meses, exige uma única ida a uma junta médica e começa sempre no centro de saúde do utente. Esta página explica como pedir, que percentagem esperar e o que se desbloqueia em cada grau.

## A.4 — Glossário PT-PT vs PT-BR (aplica às 3 páginas)

| Use (PT-PT) | NÃO use (PT-BR) |
|---|---|
| pensão / pensionista | aposentadoria / aposentado |
| reforma | aposentadoria |
| Segurança Social Directa | Previdência |
| morada | endereço |
| agregado familiar | núcleo familiar |
| IBAN / NIB | conta-corrente |
| IRS | Imposto de Renda |
| receber 14 meses | décimo terceiro |
| dedução à colecta | abatimento |
| atestado médico de incapacidade multiusos | laudo médico |
| junta médica | perícia / perícia médica |
| centro de saúde / USF | posto de saúde / UBS |
| ARS (Administração Regional de Saúde) | secretaria de saúde |
| acto da vida diária / AVD | atividade da vida diária |
| acamado | restrito ao leito |
| lar / ERPI | asilo / casa de repouso |
| cuidador informal | cuidador familiar |
| casa de banho | banheiro |
| dístico | adesivo / selo |
| viatura | carro / automóvel (em contexto fiscal) |
| acompanhante | cuidador (em contexto CIRS é "acompanhante") |
| facto | fato |
| ação | acção (pré-AO90) |
| estou a fazer | estou fazendo |

