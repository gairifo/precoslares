---
title: Carta Social comprehensive ingest — full PT eldercare directory
type: feat
status: active
date: 2026-05-11
origin: docs/brainstorms/2026-05-11-comprehensive-lares-directory-requirements.md
deepened: 2026-05-11
---

# Carta Social comprehensive ingest

## Enhancement Summary

**Deepened on:** 2026-05-11 with 11 parallel reviewers (kieran-typescript, architecture-strategist, security-sentinel, code-simplicity, pattern-recognition, performance-oracle, julik-frontend-races, agent-native, data-integrity-guardian, data-migration-expert, deployment-verification).

The body of the plan below is preserved verbatim for audit. **Where this summary contradicts a section below, this summary wins.** Implementers read this first.

### Locked decision overrides (P0 — must apply before Phase A starts)

| # | Override | Why | Source |
|---|---|---|---|
| 1 | **Zod schema is the source of truth for `Lar`.** Add `src/lib/lares/schema.ts` exporting `LarSchema` (+ `LarTipoSchema`, `LarValenciaSchema`, `PriceRangeSchema`); derive `type Lar = z.infer<typeof LarSchema>`. `types.ts` re-exports `Lar` from `./schema` for compat. Eliminates interface/Zod drift. | kieran-ts P0-2 |
| 2 | **`Lar.source` becomes a discriminated union** (`SeededLar` \| `CartaSocialLar` \| `OperatorClaimLar`) with per-variant required fields. `CartaSocialLar` requires `_meta.{carta_social_id, carta_social_url, alvara, last_seen_at}` and forbids `preco`. Enforced via `z.discriminatedUnion("source", [...])`. | kieran-ts P1-2; data-integrity #2 |
| 3 | **`_meta` is dual-level.** Top-level `data._meta` (dataset: source, snapshot_date, license, attribution). Per-entry `Lar._meta` (record: carta_social_id, carta_social_url, alvara, last_seen_at). Both in the Zod schema. Alvará is canonical identity (not idEquipment). | kieran-ts P0-3; spec-flow Minor #16 |
| 4 | **`src/lib/lares/index.ts` becomes the single `getCollection` unwrap seam.** Top-level `await getCollection("lares")`, then `LARES = Object.freeze(entries.map(e => e.data))`. Astro pages do NOT call `getCollection("lares")` directly — they go through this module. Migration is non-breaking only via this seam. | kieran-ts P0-1 |
| 5 | **Slug regex assertion** (`^[a-z0-9](?:[a-z0-9-]{0,80})$`) inside `slug.ts` post-generation AND in the Zod schema. Closes path-traversal + tombstone-header-injection vectors. | security C3 |
| 6 | **URL/email/phone sanitization layer at the mapper boundary.** `safeHttpUrl()` (rejects non-`http(s):`), strict email regex, strict phone regex `^[+\d\s()\-]{6,20}$`. Reject (drop field) on failure. Zod refinements re-check at build. | security C1, C2 |
| 7 | **Sitemap MUST filter when `PUBLISH_CARTA_SOCIAL=false`.** Without this filter the gated commit publishes ~2,700 lar URLs to Google with broken nav coherence. Add `filter: (page) => process.env.PUBLISH_CARTA_SOCIAL === "true" \|\| !/\/lares\/[^/]+\/[^/]+\/?$/.test(page)` to `@astrojs/sitemap` config. | data-migration P0-1; deployment §9.1 |
| 8 | **Seed-merge fails the build on unmatched hand entries.** Match by `(slugify(nome), concelhoSlug)`, then fuzzy-match (Levenshtein ≤ 3) across unmatched pairs. Print suspected pairs + emit `merge-report.json` committed alongside the dataset. No silent orphans = no duplicate pages. | data-migration P0-2 |
| 9 | **`merge.ts` moves out of `scripts/scrape-carta-social/`.** New location: `scripts/lares-data/merge.ts`. Cross-boundary write (`scripts/ → src/data/`) is a separate command (`npm run lares:merge`). Scrape script emits NDJSON only; merge folds into the dataset. | architect P0-1 |
| 10 | **`scripts/lares-data/generate-headers.ts` is a `prebuild` step** that derives `public/_headers` 410-Gone rules from `src/data/lares.tombstones.json`. Tombstones file is the single source of truth; `_headers` is generated, not hand-edited. | architect P1-4 |

### New tasks layered onto existing phases

#### Phase A — additions
- **A2.5. URL/email/phone sanitization module** at `src/lib/lares/safe-fields.ts` (`safeHttpUrl`, `safeEmail`, `safePhone`). Imported by mapper.
- **A3 (revised). `slug.ts` API is a pure function** `generateLarSlug(inputs, existingSlugs: ReadonlySet<string>): string`. Plus `generateAllLarSlugs(records)` convenience wrapper. Slug regex assertion inside.
- **A9 (NEW). `src/lib/lares/index.client.ts`** — slim autocomplete-shaped subset (`{slug, nome, concelhoSlug}[]`, ≤ 50 kB) consumed by Wizard. Prevents the 1.5 MB JSON leaking into Wizard.js. **Verify with CI guard**: build, then assert `gzip -c dist/_astro/Wizard*.js | wc -c < 20000`. (performance #5, security M1)
- **A10 (NEW). CI guard: client bundle size cap.** `Wizard*.js.gz ≤ 20 kB`, total client JS gz ≤ 50 kB. Fail loudly on regression.
- **A11 (NEW). CI guard: `set:html` requires `safeJsonForScript`.** Grep `src/pages` + `src/layouts`; fail if any `set:html=` without the helper.
- **A12 (NEW). vitest.config.ts include glob extension.** `"include": ["{src,scripts}/**/__tests__/**/*.test.ts"]`. Plan §F tests at `scripts/scrape-carta-social/__tests__/` currently invisible to the runner.
- **A6 deferred to Phase H.** Pre-staged PT+EN response letters move from Phase A to Phase H1. Reduces Phase A by 1 step. PT-only template lives in `docs/MAINTAINERS.md` as a paragraph; EN translates only on first English contact. (architect #11; simplicity #7)

#### Phase B — additions
- **B5 reconciliation: `acordoSS` stays boolean, not null.** Non-ERPI rows are filtered out at the mapper; `acordoSS: false` when ERPI is present without acordo. Removes the `null` inconsistency between §B5 and §R5. (pattern-rec #3)
- **B5 rename: `acordoSS_per_valencia` → `acordoSSPerValencia`.** snake_case slip. (pattern-rec #1)

#### Phase C — additions / overrides
- **CLI flag parsing via `node:util.parseArgs`.** No commander/yargs. Wrap result in typed `ScrapeConfig`. (kieran-ts P1-3)
- **Cut these flags** for first run: `--from-id` (use `crawl_state` resume), `--max-errors` (hardcode 5%), `--snapshot-dir` (hardcode `snapshots/YYYY-MM-DD/`). **Keep**: `--dry-run`, `--concelho`, `--rate-limit-ms` (default 2500), `--allow-unknown-tipo`. (simplicity #13)
- **`Result<T, ScrapeError>` discriminated union** shared across fetcher/parser/mapper. Consistent error narrowing + structured logs. (kieran-ts P1-4)
- **`p-queue` must route ALL outbound HTTP** including robots.txt fetches and cache revalidations. Verify in code review. (performance #10)
- **Drop the `ndjson` package** — use raw `JSON.stringify(r) + "\n"` line writes. (kieran-ts P2-4)

#### Phase D — additions
- **D8 (NEW). Agent-native build-step artifacts** emitted alongside the dataset:
  - `public/schema/lares.json` — JSON Schema (draft-07) for the `Lar` shape. Mirrors `public/schema/apoios-input.json` pattern.
  - `public/data/lares.json` — full dataset, versioned, with embedded `_meta.license`, `_meta.attribution`, `_meta.schemaUrl`, `_meta.snapshotDate`.
  - `public/data/lares-manifest.json` — slim `{slug, concelho, tipo, acordoSS}[]` (~220 kB). Crawl entry point.
  - `public/data/concelhos.json` — `{slug, nome, distrito, larCount, ipssCount, comAcordo, valenciasOferecidas[]}[]`.
  - `public/data/tombstones.json` — `{slug, removedAt, reason}[]`.
  - `public/data/lares/[slug].json` per-entry endpoint (one fs.writeFile per lar in the same build loop that emits HTML).
  - HTML page emits `<link rel="alternate" type="application/json" href="/data/lares/[slug].json">` for discovery.
  All emitted from a single `scripts/lares-data/emit-public-artifacts.ts` run as part of `npm run build`. (agent-native #1-7)
- **D9 (NEW). CSV cell formula-injection mitigation** in `output.ts`. Prefix any leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'`. Wrap every cell in double quotes; double internal `"`. (security H2)
- **D5 atomicity.** Atomic write via temp file + `rename`. Pre-commit-1 commit `src/data/lares.seed-snapshot.json` as a permanent regression fixture. (data-migration P2 #10)

#### Phase E — additions / overrides
- **E1. Filter UI revisions** (julik-frontend findings):
  - **a11y**: Filter chips are `<button type="button" aria-pressed="...">`, not `<div onclick>`. Use the existing `.chip` class from `global.css`. (pattern-rec #10)
  - **View transitions**: either disable on `/lares` routes (`<meta name="astro-view-transitions-enabled" content="false">`) OR move the filter script from `is:inline` to `<script>` + `astro:page-load` listener. Pick the simpler path: disable view transitions on these routes for v0. (julik #1)
  - **FOUC mitigation**: head-script reads URL params + injects a `<style>` rule (`document.write('<style>[data-lar-card]:not([data-tipo="ipss"]){display:none}</style>')`) before paint. (julik #2)
  - **`replaceState`, not `pushState`** for chip toggles. Filter is a view preference, not a navigation. (julik #3)
  - **Pagination preserves query string**: render anchors with `${page.url.next}?${currentSearch}` at build time, not via JS. (julik #4)
  - **Empty-state**: `<p data-empty-state hidden>Nenhum lar com estes filtros</p>` flips visible when zero cards match. (julik #6)
  - **Filter scope = within current pagination window only.** Don't pre-render off-page entries; pagination + filter compose. (performance §15b)
- **E1a. `/lares/[concelho]/1` redirects to `/lares/[concelho]`** via dynamic route check + 301. (julik #8)
- **E5 CONCELHOS strategy.** Split into `src/lib/lares/concelhos-data.ts` (mechanical full list) + `src/lib/lares/concelhos-curated.ts` (top-30 autocomplete picks + hand annotations). Don't move to JSON. (architect #5)
- **E6 tombstones → 410**: `vercel.json` is the authoritative source on Vercel (NOT `_headers`, which is Cloudflare/Netlify convention). Plan §E6 shipped both; **verify on preview that `vercel.json` rules actually fire**. (deployment §9.1)
- **E7 CI build text** + raise `timeout-minutes` from 8 to 15.

#### Phase F — dissolved
- Phase F as a separate "tests phase" is removed. Tests are interleaved with their modules: slug tests in A3, parser tests in B3, mapper tests in B5, merge/diff tests in D, integration tests in G. The 5 cross-layer Integration Test Scenarios stay as a checklist in Phase G. (architect #11b)

#### Phase G — additions
- **G0 (NEW). Pre-deploy local verification.** `npm run build` with flag off → ~70 pages. `npm run build` with flag on → ~2,700 pages, < 180s, peak RSS < 4 GB (`/usr/bin/time -l`). Slug stability test passes. Sitemap respects the filter. (deployment §1)
- **G5 (NEW). Post-build verification script** `scripts/lares-data/verify-build.ts`:
  - Asserts `Object.keys(lares).length` within ±5% of expected.
  - Asserts no duplicate slugs.
  - Asserts every seed slug from `lares.seed-snapshot.json` still present.
  - Reads `merge-report.json` and asserts `seed_only_count === 0` unless `ALLOW_ORPHAN_SEEDS=true`.
  - Asserts `getRoutedConcelhos().length >= 280` (invariant lock per data-migration P2 §9).
  Run in CI on the build commit. Deploy-blocking on failure. (data-migration P1 §5)
- **G2 archive.org snapshots: 3 manual saves**, not 20. (simplicity #14)

#### Phase H — additions
- **H6 (NEW). Build-time stale-data warning.** `console.warn` when `_meta.snapshot_date > 12mo`; `console.error` (red, non-blocking) when `> 18mo`. Replaces the heavier CI-fail guard in original plan. (architect #9)
- **H7 (NEW). PT-only response template** in `docs/MAINTAINERS.md` (as a paragraph, not a separate file). EN translates only on first English contact. (simplicity #7, #16)
- **H8 (NEW). `/bot` page JSON-LD** — emit `<script type="application/ld+json">` with `{policy, contact, rateLimits, userAgent, dataLicense, schemaUrls[]}`. (agent-native #7)

### Critical Vercel verifications before flag flip

Adopt verbatim from the deployment-verification agent (§9). Do not promote to Production until each is personally verified on Preview:

1. `vercel.json` 410 rules fire on a tombstoned URL (not just `_headers`).
2. Build memory stays under 4 GB; raise `NODE_OPTIONS=--max-old-space-size=6144` only if needed.
3. Build duration < Vercel Hobby 45-min ceiling.
4. `PUBLISH_CARTA_SOCIAL` is a **build-time** env var; toggling requires manual Redeploy, not just env save.
5. Sitemap structure: `/sitemap-index.xml` references `/sitemap-0.xml`; verify both exist.
6. `api/report.ts` deploy status = "Ready" in Functions tab.
7. Static 410 responses verify correctly via curl, with cache-buster on retry.
8. Vercel build-min budget headroom before flip.

### Outstanding gates raised by deepening

| # | Question | Tag | Where it lands |
|---|---|---|---|
| 1 | **CONFIRMED:** `src/components/Wizard.tsx:6-7` imports `CONCELHOS` from `~/lib/lares/concelhos` AND `getAllLares, getLaresByConcelho` from `~/lib/lares`. Current Wizard.js.gz = 18.72 kB. At 2,700-entry dataset *without* the client/server split, the chunk balloons to ~150 kB+ gz. **Phase A9 (`index.client.ts` slim subset) is a hard blocker for Phase A2 (Content Collection migration).** Order: ship A9 first, refactor Wizard imports, then migrate to getCollection. | [Locked] | Phase A9 → A2 |
| 2 | Vercel Hobby memory ceiling exact (8 GB?) — affects whether we need `NODE_OPTIONS` flag. | [Verify] | Phase G preview |
| 3 | Vercel's CDN edge behavior for 410 from `vercel.json` `headers` block — works for static-asset paths? | [Verify] | Phase G preview |
| 4 | `astro:env` build-time flag actually triggers rebuild on Vercel UI toggle, or requires Deployments → Redeploy click. | [Verify] | Phase G preview |

### What was NOT changed

- All 10 origin R-requirements (R1–R10).
- The polite-scrape + skip-the-GEP-pre-email decision.
- CC-BY-SA 4.0 dataset license.
- Annual refresh ritual.
- Carta Social-sourced entries don't carry `preco` (now enforced by the discriminated union).
- The 5 resolved deferred questions from origin (slug algorithm, natureza-tipo mapping, ID stop condition, pagination UX, build perf).

### Confidence after deepening
**HIGH** with one open verification: confirm Wizard.tsx's actual `~/lib/lares` imports before Phase A2 starts. If Wizard imports `getLaresByConcelho` directly, the migration is blocked until the client/server split lands. Mitigation: I scoped that work in A9 — it's a 30-min refactor, not a re-architecture.

---

## Overview

Grow `precoslares.pt`'s lar directory from 32 hand-curated seed entries (~1% coverage) to ~2,600 entries (~100%) by ingesting cartasocial.pt's public-record ERPI registry. Honor the brand promise (preços de lares por concelho), unlock the SEO long-tail (per-concelho + per-freguesia pages), and establish the data-update ritual for future years.

This plan executes the [origin requirements doc](../brainstorms/2026-05-11-comprehensive-lares-directory-requirements.md): polite scrape, skip the GEP pre-email per Pedro's call, full attribution + open-source script, annual refresh ritual. All 10 origin requirements (R1–R10) trace through to specific phases below. All 5 origin deferred-to-planning questions are resolved in §"Resolved deferred questions" below. The 20 spec-flow analyzer findings (5 critical, 7 important, 8 minor) are integrated as either explicit requirements or task-level items.

The work spans **~3-4 days of active engineering + ~24-48h elapsed for the actual scrape run**. Phases A–H designed so Pedro can park between them without leaving the site broken.

## Problem Statement

Today: 32 entries, 14 concelhos. Family searching `lares idosos braga preços` lands on a 1-entry page → bounce. SEO ceiling = 30-ish concelho pages. The wizard's "lar autocomplete" datalist is mostly empty. The brand's "Preços de lares por concelho" hero promise is structurally unfulfilled.

The data exists at cartasocial.pt (~2,600 ERPI records, public-record taxpayer-funded). It is HTML-only, no CSV/API. Sequential `idEquipment` URL pattern makes it scrapeable. Pedro chose the polite-scrape path (2026-05-11, see origin §Key Decisions).

The risk envelope is real but bounded: ToS-gray posture, no documented GEP cease-and-desist precedent for public-utility projects citing LADA Art. 7.º, EU Database Directive sui generis right defanged by CJEU C-762/19 for taxpayer-funded data with no investment-recovery interest. We harden against the residual risk via attribution, open-source script, polite rate, archival snapshots, pre-drafted response letter.

## Proposed Solution

**A polite, resumable, open-source Node 20 scraper** at `scripts/scrape-carta-social/`, run locally by Pedro on demand (annual refresh ritual), that:

1. Enumerates `idEquipment` IDs against `cartasocial.pt`
2. Parses each detail page via `cheerio`
3. Maps to our existing `Lar` shape (idEquipment + alvará as canonical identity; slug derived deterministically)
4. Writes NDJSON snapshots + diffs against previous snapshot (additions/removals/changes)
5. After human review, the run output replaces `src/data/lares.json` (or its successor Content Collection backing file)
6. Pedro commits behind a feature flag, deploys to Vercel preview, flips the flag in a follow-up commit

**Migration to Astro Content Collection (`file()` loader)** so the 2,700-entry dataset benefits from build-time caching + tree-shaking from client bundles. Same JSON file, same Zod schema, better build perf.

**Pagination on `/lares/[concelho]` via Astro's built-in `paginate()` helper** at `[...page].astro` (rest param so page-1 has no `/page/1` suffix). Page size 25.

**Defensive infrastructure**: `ETHICS.md`, `LEGAL.md`, public `/bot` info page, MAINTAINERS, pre-drafted response letter (PT + EN), pino structured logs (the most important defensive artifact), archive.org snapshots of source pages.

## Technical Approach

### Architecture

**New folder structure** (additive — nothing existing moves except where noted):

```
lar-ajuda/
├── scripts/
│   └── scrape-carta-social/
│       ├── index.ts                # CLI entrypoint
│       ├── fetcher.ts              # make-fetch-happen + p-queue + p-retry
│       ├── parser.ts               # cheerio HTML → raw record
│       ├── mapper.ts               # raw record → Lar (tipo + acordoSS + valencias)
│       ├── slug.ts                 # deterministic, collision-aware slug derivation
│       ├── state.ts                # better-sqlite3 WAL crawl_state
│       ├── diff.ts                 # snapshot diff: added/removed/changed
│       ├── merge.ts                # seed-merge: hand-curated vs scraped
│       ├── output.ts               # NDJSON + JSON + CSV writers
│       └── __tests__/
│           ├── fixtures/           # committed HTML samples (10-20 entries)
│           ├── parser.test.ts
│           ├── mapper.test.ts
│           ├── slug.test.ts
│           ├── merge.test.ts
│           └── diff.test.ts
├── snapshots/                       # gitignored except for the latest manifest
│   └── 2026-05-11/
│       ├── records.ndjson
│       ├── errors.ndjson
│       ├── added.ndjson            # vs previous snapshot
│       ├── removed.ndjson
│       └── changed.ndjson
├── src/
│   ├── content.config.ts            # ADD lares collection (file() loader)
│   ├── content/
│   │   └── (no new dirs; lares stays as JSON via file() loader)
│   ├── data/
│   │   ├── lares.json               # MODIFIED — full dataset replaces seed
│   │   ├── lares.tombstones.json    # NEW — removed entries (slug + concelho)
│   │   └── concelhos-aliases.json   # NEW — normalize Carta Social slugs → ours
│   ├── lib/lares/
│   │   ├── concelhos.ts             # MODIFIED — extended to all PT concelhos
│   │   ├── index.ts                 # MODIFIED — uses getCollection if migrated
│   │   ├── slug.ts                  # NEW — shared slug algorithm (imported by scraper + Astro)
│   │   └── __tests__/
│   │       ├── slug.test.ts
│   │       └── concelho-alias.test.ts
│   └── pages/
│       └── lares/
│           ├── [concelho]/
│           │   ├── [slug].astro      # UNCHANGED structure; consumes new fields
│           │   └── [...page].astro   # NEW (replaces index.astro) — paginated
│           ├── bot.astro             # NEW — bot info page
│           └── index.astro           # MODIFIED — updated counts + summary copy
├── public/_headers                   # MODIFIED — add tombstone 410 rules
├── vercel.json                       # MODIFIED — equivalent headers config
├── docs/
│   ├── AUTHORING.md                  # MODIFIED — annual lar-refresh section
│   ├── ETHICS.md                     # NEW
│   ├── LEGAL.md                      # NEW
│   ├── MAINTAINERS.md                # NEW
│   └── legal/
│       ├── response-template-pt.md   # NEW
│       └── response-template-en.md   # NEW
└── .gitignore                        # MODIFIED — exclude .scrape-cache/ etc.
```

### Implementation Phases

#### Phase A — Foundation (~3-4h, no scrape yet)

- **A1. Dependencies.** `make-fetch-happen`, `p-queue`, `p-retry`, `robots-parser`, `better-sqlite3`, `@sindresorhus/slugify`, `cheerio`, `pino`. All under `devDependencies` (script-only).
- **A2. Migrate `src/data/lares.json` to Content Collection.** Add `lares` to `src/content.config.ts` with `file("src/data/lares.json")` loader and a Zod schema mirroring `Lar` type. Update `src/lib/lares/index.ts` to use `getCollection("lares")` instead of the JSON import. Existing consumers (Wizard, lar pages, concelho pages) continue working — `getCollection` returns the same shape. (Per Astro framework-docs agent: this prevents accidental client-bundle inclusion + enables build-time cache.)
- **A3. Shared `slug.ts` module** at `src/lib/lares/slug.ts`, imported by both the Astro pages (validation) and the scraper script (generation). Implements the cascade from §"Resolved deferred questions" Q1.
- **A4. Tombstone + alias data files.** Create empty `src/data/lares.tombstones.json` ([]) and `src/data/concelhos-aliases.json` ({}). Wire into types.
- **A5. `ETHICS.md`, `LEGAL.md`, `MAINTAINERS.md`** committed (defensive artifacts before scraping starts — half the battle is showing good faith from day one).
- **A6. Pre-drafted response letters** in `docs/legal/response-template-{pt,en}.md` citing LADA Art. 7.º, CJEU C-762/19, CNPD Deliberação 2023/622, offering per-record takedown, refusing blanket takedown. Templates only; not sent.
- **A7. Public `/bot` info page** at `src/pages/bot.astro`. Mirrors ETHICS.md. The User-Agent string used by the scraper points here.
- **A8. Update `docs/AUTHORING.md`** with the "Annual lar refresh" section: how to run the scrape, where snapshots land, how to review the diff, the two-commit flag-gated deploy pattern.

**Phase A success:** Build passes, tests pass, all defensive docs committed. No scraping yet.

#### Phase B — Probe + parser (~3-4h)

- **B1. Hand-fetch 15-20 sample entries** via `curl` against cartasocial.pt with the polite UA. Save as `scripts/scrape-carta-social/__tests__/fixtures/equipment-<id>.html`. Mix of types: misericórdia, ipss, privado, with-acordo, without-acordo, Açores, Madeira, multi-valência. Commit fixtures.
- **B2. Build `parser.ts`** (cheerio): given HTML → raw object `{ idEquipment, alvará, nome, naturezaJuridica, morada, codigoPostal, freguesia, concelho, distrito, telefone, email, website, valencias[], capacidade, acordoSS_per_valencia[] }`.
- **B3. Parser tests** (vitest, using committed fixtures). 100% coverage on the parser surface — this is the single most fragile piece.
- **B4. Discover `natureza jurídica` vocabulary** across fixtures + a few more probe-fetches. Build the closed mapping table for tipo:
  ```
  Misericórdia / Santa Casa da Misericórdia → misericordia
  Cooperativa de Solidariedade Social → cooperativa
  Sociedade Anónima / Lda / Unipessoal / Empresa → privado
  Associação / Fundação / União / Centro Social Paroquial / IPSS → ipss
  ```
  Build-time guard: parser fails (with helpful error listing the offending value) on any unmapped natureza. `--allow-unknown-tipo` CLI flag maps unknowns to `privado` with a warning log, for first-run survivability.
- **B5. `mapper.ts`** translates raw → `Lar`. Handles:
  - **Multi-valência rule** (spec-flow Critical #1): only emit a `Lar` if `valencias` includes ERPI. Other valências stay in the `valencias[]` array. Non-ERPI-only entries are filtered out + logged.
  - **Multi-tipo precedence** (spec-flow Critical #2): if natureza jurídica matches multiple buckets, use `misericordia > ipss > cooperativa > privado`. Log the multi-match.
  - **acordoSS rule** (spec-flow Important #7): boolean reflects the **ERPI valência only**; `null` if ERPI absent (filtered out anyway). Documented in `Lar.acordoSS` JSDoc.
  - **Distrito for Açores / Madeira** (spec-flow Important #9): introduce `distritoSlug: "acores" | "madeira"` as virtual distritos. Add to `src/lib/lares/concelhos.ts`.
- **B6. `slug.ts` generation pass** validates the cascade against committed fixtures + the existing 32 seed entries (Phase D's seed-merge will assert hand slugs are preserved by the algorithm — see §"Resolved deferred questions" Q1).

**Phase B success:** Parser tests green. Mapper produces valid `Lar` objects. Slug algorithm matches all 32 hand-crafted seed slugs.

#### Phase C — Scraper main loop (~4-6h)

- **C1. SQLite state schema** (better-sqlite3, WAL mode):
  ```sql
  CREATE TABLE crawl_state (
    id_equipment INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('pending','done','retry','skip','permanent_404')),
    fetched_at TEXT,
    http_status INTEGER,
    etag TEXT,
    last_modified TEXT,
    error TEXT
  );
  CREATE TABLE crawl_log (
    ts TEXT NOT NULL,
    level TEXT NOT NULL,
    id_equipment INTEGER,
    msg TEXT
  );
  ```
- **C2. Fetcher** wraps `make-fetch-happen` with `p-queue` (concurrency=1, interval=2500ms, intervalCap=1) and `p-retry` (5 retries, exponential backoff, honour `Retry-After`). User-Agent: `PrecoslaresBot/1.0 (+https://precoslares.pt/bot; gairifo@gmail.com) Node/20`.
- **C3. ID enumeration.**
  - Start ID: configurable (default 1, or resume from `crawl_state` max-id-with-status-`done`).
  - Stop: 5 consecutive HTTP 404s = end-of-enumeration. Configurable.
  - 3 consecutive 429s = abort with clean shutdown + email-pedro-now log line.
  - SIGINT/SIGTERM: drain queue (30s timeout), close SQLite, exit 0.
- **C4. Cache layer.** `make-fetch-happen` keeps HTTP cache at `.scrape-cache/` (gitignored). Conditional GETs with stored ETag re-validate cheaply on re-runs. Re-running an annual refresh costs ~zero requests for unchanged entries.
- **C5. Robots.txt** fetched at start + every 24h during a long run; parsed via `robots-parser`. If Disallow appears for our UA, abort + email pedro. Honor `Crawl-delay` strictly.
- **C6. CLI** at `scripts/scrape-carta-social/index.ts`:
  - `--dry-run` — emit diff to stdout, write nothing
  - `--concelho <slug>` — incremental scrape filter (post-parse)
  - `--from-id <N>` — start ID override
  - `--rate-limit-ms <N>` — default 2500
  - `--allow-unknown-tipo` — map unknown natureza to privado
  - `--snapshot-dir <path>` — default `snapshots/YYYY-MM-DD/`
  - `--max-errors <pct>` — default 5; abort run if per-entry error rate exceeds
- **C7. Structured logs.** `pino` writes one JSON line per fetch + per parse outcome to `snapshots/YYYY-MM-DD/run.log.jsonl`. Compressed monthly. **This is the single most important defensive artifact.**

**Phase C success:** A small probe run (e.g. `--from-id 1 --max-id 50`) writes 50 records + cache files. SQLite state survives a `kill -9` and resumes cleanly. Logs show one polite request every ~2.5s.

#### Phase D — Output + diff (~2-3h)

- **D1. NDJSON snapshot writer** at `snapshots/YYYY-MM-DD/records.ndjson`. One JSON per line, sorted by `alvará` (canonical identity per spec-flow Minor #16). Errors at `errors.ndjson`. Concelho-alias misses at `unmapped-concelhos.ndjson`.
- **D2. Slug-generation pass** runs over records, generates slugs via the shared module, asserts uniqueness. On collision, cascade per §"Resolved deferred questions" Q1.
- **D3. Seed-merge pass** (spec-flow Critical #4). For each existing entry in current `src/data/lares.json`:
  - Match by `(slugify(nome), concelhoSlug)`. If unique match: keep the hand slug; overlay scraped fields onto the hand entry (preserving hand slug, hand-edited preço, hand-edited notas).
  - If no match: scraped entry is added as new.
  - If hand entry has no match in scrape: log under `seed-orphans.ndjson` for Pedro's review (might be a closed lar, or a name mismatch).
  - Emit summary report: "matched X/32, Y unresolved" to stdout.
- **D4. Concelho-registry-extension pass** (spec-flow Important #8). For each unique `concelhoSlug` encountered:
  - If present in `src/lib/lares/concelhos.ts`: OK.
  - If present in `src/data/concelhos-aliases.json`: rewrite to canonical slug.
  - Otherwise: log to `unmapped-concelhos.ndjson` + fail the merge (forces Pedro to update either the registry or the alias map).
- **D5. JSON writer.** Replaces `src/data/lares.json` after Pedro's manual review of the merge report. Atomic write (temp file + rename).
- **D6. CSV writer** alongside JSON. Same data, flat columns. Lets Pedro (or a friendly reviewer) eyeball in Numbers/Excel.
- **D7. Diff tool.** Compares current `snapshots/YYYY-MM-DD/records.ndjson` against previous (if any). Emits `added.ndjson`, `removed.ndjson`, `changed.ndjson` (latter with field-level diffs). Pedro reviews before commit.

**Phase D success:** First full run produces a valid `records.ndjson` + sensible merge report. Seed-merge preserves all 32 hand slugs (slug-stability test passes).

#### Phase E — UI updates (~3-4h)

- **E1. Pagination route.** Move `src/pages/lares/[concelho]/index.astro` → `src/pages/lares/[concelho]/[...page].astro`. Use Astro's `paginate()` helper, pageSize 25, rest param so page-1 stays at `/lares/<concelho>` (no `/page/1` suffix). Each page emits `<link rel="prev/next/canonical">` from `page.url.*`.
- **E2. Filter UI on concelho pages.** Simple GET-param filters: `?tipo=ipss`, `?acordo=true`. Server-rendered links (no client island needed — keeps the page lean). The page reads `Astro.url.searchParams` in the script tag. Pre-render the unfiltered version; filtered version client-side via showing/hiding. **Decision:** start with show-all-but-CSS-hide-via-`data-tipo`-attr; client-side filter via tiny vanilla-JS inline script. Avoids a React island on every concelho page.
- **E3. `/lares/index.astro` update.** New aggregate counts: total lares, with-acordo count, by-tipo counts. Concelho cards with new larCount values.
- **E4. `[concelho]/[slug].astro` update.** Add per-page "Reportar erro" footer (already in Base.astro footer; verify no duplicate). Add per-page Carta Social source backlink in the Notas section (if `_meta.carta_social_url` available).
- **E5. CONCELHOS registry extension** (post-first-scrape). Add the ~280 concelhos the scrape discovered. Hand-set `topAutocomplete` for the top 30. Default `topAutocomplete: false` for the long tail.
- **E6. Tombstones → 410 Gone.** `public/_headers` + `vercel.json` headers config: for each entry in `src/data/lares.tombstones.json`, emit a `410 Gone` header rule. The static HTML file still exists (or doesn't); the host returns 410 above whatever exists. (Spec-flow Important #6.)
- **E7. CI workflow text update.** `.github/workflows/ci.yml` step name "70 static pages" → "~2,700 static pages". Increase job timeout from 8 to 15 minutes (defensive; expected actual is <3 min).

**Phase E success:** `npm run build` completes in <120s with the full dataset. All routes return 200; tombstoned URLs return 410. Pagination works (`/lares/lisboa/2`, `/3`, …). Filter UI works for the top-3 concelhos.

#### Phase F — Tests (~3h)

- **F1. `src/lib/lares/__tests__/slug.test.ts`** — collision cascade, all 32 seed slugs reproducible from algorithm, PT diacritics, edge cases (Ç, Æ, special quotes, `Lar nº 1`, `Lar D'Ouro`).
- **F2. `src/lib/lares/__tests__/concelho-alias.test.ts`** — Açores/Madeira slug rules, accent normalization, hyphen handling.
- **F3. Parser tests** at `scripts/scrape-carta-social/__tests__/parser.test.ts` against committed HTML fixtures. 100% surface coverage.
- **F4. Mapper tests** — natureza-jurídica mapping table, multi-tipo precedence, acordoSS per-valência, ERPI filtering.
- **F5. Diff tests** — added/removed/changed correctness on synthetic before/after pairs.
- **F6. Seed-merge tests** — hand slug preservation, scraped-field overlay, orphan detection.

**Phase F success:** ≥30 new tests pass (additive to the existing 47). CI green.

#### Phase G — First scrape + ship (~24-48h elapsed, ~6h active)

- **G1. Dry-run probe.** `--from-id 1 --max-id 50 --dry-run` — eyeball the first 50 records. Validate parser + mapper + slug. Adjust if pathological cases break.
- **G2. Full scrape run.** Run overnight at default 2.5s rate. 2,600 records × 2.5s = ~110 minutes minimum. Realistic with retries: 2–6 hours. Plan for 24h elapsed = "run twice if needed."
- **G3. Manual sample review.** Read 30 random NDJSON entries. Spot-check Carta Social pages for fidelity.
- **G4. Seed-merge review.** Look at `seed-orphans.ndjson` — any of the 32 hand entries unmatched? Update aliases or hand entry names to resolve. Re-run merge.
- **G5. Slug uniqueness assertion.** Run `scripts/scrape-carta-social/index.ts --validate-only`. Fail if any collision.
- **G6. Commit #1: gated dataset.** Replace `src/data/lares.json` with the full output. Add a `PUBLISH_CARTA_SOCIAL` env flag (Astro `astro:env`) defaulted to `false`. The lar pages render normally; the homepage hero copy stays unchanged. Commit message: `feat(data): ingest 2,600 lares from Carta Social (gated)`.
- **G7. Vercel preview deploy.** Verify build completes <8 min CI gate (expected <3 min). Verify ~2,700 pages render. Sample 20 random URLs.
- **G8. Commit #2: flip the flag.** Set `PUBLISH_CARTA_SOCIAL=true` in Vercel Production env. Re-deploy. Commit message: `feat(data): enable Carta Social-sourced directory`.
- **G9. Post-deploy verification.**
  - `https://precoslares.pt/sitemap-index.xml` lists ~2,700 routes.
  - 30 sample lar pages all return 200.
  - 5 sample concelho pages render the paginated list.
  - Google Search Console submit the new sitemap.
- **G10. archive.org snapshot** of 20 sample Carta Social source pages via `savepagenow` — independent timestamped record.

**Phase G success:** Production carries the full directory. Brand promise fulfilled. CI green.

#### Phase H — Post-ingest hardening + monitoring (~2h)

- **H1. Plausible custom event** `directory_lar_view` fires on every `/lares/[concelho]/[slug]` view. Helps Pedro see which lares actually get hit.
- **H2. CI guard for slug stability.** Add a step that compares `src/data/lares.json` slugs against the previous commit's slugs; fails if any slug changed without an explicit tombstone added. Forces URL stability.
- **H3. Update `docs/launch-checklist.md`** with the new dataset state: "Carta Social directory live" replaces the "Pedro tasks for cold-start dataset" section.
- **H4. Update README.md** with the new lar count, the data source, the CC-BY-SA license for the dataset.
- **H5. Pre-staged response letter polish.** With the dataset live, finalize PT + EN response letters.

**Phase H success:** Operational readiness post-launch. Slug-stability guard prevents accidental SEO breakage. Plausible captures baseline traffic.

## Resolved Deferred Questions (from origin doc)

### Q1: Slug algorithm

**Resolved:** Cascade rule, implemented in `src/lib/lares/slug.ts`:

```
function generateSlug(nome, concelho, freguesia, alvara, existingSlugs):
  base = kebab(stripDiacritics(nome))
  if base not in existingSlugs: return base
  withConcelho = base + "-" + concelho
  if withConcelho not in existingSlugs: return withConcelho
  withFreguesia = withConcelho + "-" + kebab(stripDiacritics(freguesia))
  if withFreguesia not in existingSlugs: return withFreguesia
  withAlvara = withConcelho + "-" + alvara.slice(-4)
  if withAlvara not in existingSlugs: return withAlvara
  // Should never reach here unless data is genuinely duplicated
  throw new Error("unresolvable collision: " + nome)
```

Library: `@sindresorhus/slugify` (PT diacritic handling). Generation must be deterministic + reproducible. Stability rule: existing slugs MUST roundtrip; the slug-merge step in `merge.ts` asserts that re-running the algorithm against existing entries produces the same slugs (failing the build if not).

URL stability across name corrections: when a `nome` is corrected (typo fix), the algorithm may produce a different slug. Policy: **keep the existing slug**, do not re-derive. The `idEquipment` + `alvará` are the canonical identity; the slug is a URL key that survives name churn.

### Q2: natureza-jurídica → tipo mapping

**Resolved:** Mapping table in `scripts/scrape-carta-social/mapper.ts`:

```
"Misericórdia" / "Santa Casa da Misericórdia" / contains "Misericórdia"
                                              → misericordia
"Cooperativa" / "Cooperativa de Solidariedade Social"
                                              → cooperativa
"Sociedade" / "Lda" / "Unipessoal" / "Empresa" / "S.A." / "Sociedade Anónima"
                                              → privado
"Associação" / "Fundação" / "União" / "Centro Social Paroquial"
                                              → ipss
"IPSS" (literal token in natureza)            → ipss
default                                       → throw (or → privado with --allow-unknown-tipo)
```

Multi-match precedence: `misericordia > ipss > cooperativa > privado`. Logged.

### Q3: ID enumeration stop condition

**Resolved:** **5 consecutive HTTP 404s** = end of enumeration. Configurable via `--end-of-list-threshold`. Probe runs use a lower threshold (3) for speed.

### Q4: Pagination + filter UX

**Resolved:**
- Pagination: Astro `paginate()` helper on `[...page].astro`, pageSize 25, rest-param routing (page 1 has no suffix).
- Filter: simple GET params + tiny inline vanilla-JS hide/show. No React island per concelho page. Server pre-renders unfiltered; client toggles.

### Q5: Build-time perf

**Resolved:** Expected ~60–120s for ~2,700 pages on Vercel build infra. Free tier (100 build min/month) supports ~50 builds/month at this scale — comfortable. CI timeout raised to 15 min as defensive headroom (was 8). Mitigation if exceeded: Vercel ISR (would require adapter shift — defer).

## Spec-Flow Findings (integration map)

Mapped to phases — every finding has a home:

| # | Severity | Finding | Phase |
|---|---|---|---|
| 1 | Critical | Multi-valência collapse — keep ERPI-bearing, collapse to one entry, log multi-valência | B5 |
| 2 | Critical | Multi-tipo precedence — `misericordia > ipss > cooperativa > privado` | B5, Q2 |
| 3 | Critical | Resume protocol — SQLite WAL + crawl_state checkpoint | C1 |
| 4 | Critical | Seed-merge — match by (slug-of-nome, concelhoSlug); hand slug wins | D3 |
| 5 | Critical | Vercel deploy explosion — `PUBLISH_CARTA_SOCIAL` env flag; two-commit pattern | G6, G8 |
| 6 | Important | 410 Gone for closed lares — `_headers` / `vercel.json` headers | E6 |
| 7 | Important | acordoSS per-valência → ERPI only; null when no ERPI | B5 |
| 8 | Important | Concelho slug mismatch — alias map + fail-loud on unmapped | A4, D4 |
| 9 | Important | Açores/Madeira virtual distritos | B5 |
| 10 | Important | Multi-facility same-name — cascade to freguesia, then alvará-last-4 | Q1 |
| 11 | Important | "Legal complaint" = GEP/MTSSS official channels only (email/letter/phone) | A6 (response template) |
| 12 | Important | "≥ 2,000" = successful entries only; log skipped | C6 (`--max-errors`) |
| 13 | Minor | Malformed-HTML budget: skip+log, abort if >5% errors | C6 |
| 14 | Minor | Missing-capacidade UI branch (already exists; verify) | E4 |
| 15 | Minor | Encoding fixtures for pathological names | F1 |
| 16 | Minor | `idEquipment` instability fallback — store `alvará` as canonical identity | C1, D1 |
| 17 | Minor | `--rate-limit-ms` CLI flag | C6 |
| 18 | Minor | `--dry-run`, `--concelho`, CSV output | C6, D6 |
| 19 | Minor | `--allow-unknown-tipo` for first-run survivability | B4 |
| 20 | Minor | Single-facility-single-address assumption (no action; safe) | — |

## Alternative Approaches Considered

| Alternative | Why rejected |
|---|---|
| **Email GEP first; scrape only on refusal** | Pedro explicitly chose to skip the email (origin §Key Decisions, 2026-05-11). Speed > formal channel. |
| **Pure composite stack (OSM + Wikidata + UMP + Cascais open)** | Recon showed coverage ~400-600 entries (~20% of target). Concelho pages outside Lisboa/Porto/Cascais stay thin. Best for legal posture; worst for SEO. Rejected per origin. |
| **Scrape commercial directories (Lares Online, Casas Sénior, Via Senior)** | EU Database Directive sui generis right is significantly stronger against commercial-DB scraping than against government public-record scraping. Worse legal posture, no factual advantage (they mirror Carta Social). |
| **Migrate to Astro Content Collection with `glob('src/content/lares/*.md')`** | 2,700 markdown files is unwieldy for a pure-data record with no prose body. `file()` loader against a single JSON is strictly better at this scale. (Per framework-docs agent.) |
| **Vercel ISR (Incremental Static Regeneration) instead of full static build** | Requires Astro adapter shift to hybrid mode. Build perf at 2,700 static pages is already fine (~60-120s). Defer. |
| **Server-rendered filtered concelho pages (one URL per filter combo)** | Combinatorial explosion of URLs. Single page with client-toggled filters is simpler + better UX + same SEO via canonical to the unfiltered version. |
| **GitHub Actions cron to re-scrape automatically** | Annual cadence + manual review gate (per origin R9) is the right ritual. Automated scrape risks silent breakage + ToS violation. Pedro-in-the-loop is the defense. |
| **Hash-only slug suffixes (e.g., `-x7f2`)** | Less human-readable. Reserve hash suffix for residual collisions only (~3 of 2,600). Prefer geographic disambiguation. |
| **Use `idEquipment` as the URL slug directly** | URLs lose all signal value. SEO + UX both lose. Slug from name is right. |

## System-Wide Impact

### Interaction Graph

**Scrape run → snapshot → merge → commit → build → deploy chain:**

1. `scripts/scrape-carta-social/index.ts` (Pedro's laptop) issues HTTP GET to `cartasocial.pt` via fetcher.ts.
2. fetcher.ts: p-queue throttles to 1 req/2.5s; make-fetch-happen caches; p-retry handles 429/503.
3. parser.ts extracts raw record from cheerio'd HTML.
4. mapper.ts transforms to `Lar` shape (with multi-valência filter, tipo precedence, acordoSS rule).
5. SQLite crawl_state writes status.
6. After all records: slug.ts generates slugs (collision-aware), output.ts writes NDJSON snapshot.
7. diff.ts compares vs previous snapshot.
8. merge.ts merges with current `src/data/lares.json` (seed-merge with hand-slug priority).
9. Pedro reviews diff + merge report. If OK, accepts the write.
10. `src/data/lares.json` updated. `src/lib/lares/concelhos.ts` may need new entries.
11. **git commit #1 (gated):** dataset replaced + env flag introduced, defaulted to off.
12. git push → CI runs (build with feature flag off — behavior unchanged) → Vercel auto-deploys preview.
13. Pedro verifies preview, reviews sample lar pages.
14. **git commit #2 (flag flip):** flag → on in Vercel Production env. Redeploy.
15. New deploy serves ~2,700 lar pages. Sitemap updated. Plausible captures `directory_lar_view` events.

### Error & Failure Propagation

| Layer | Failure | Behavior |
|---|---|---|
| fetcher.ts | Network timeout | p-retry → 5 retries → mark `retry` in state → continue |
| fetcher.ts | 429 with Retry-After | sleep, continue |
| fetcher.ts | 429 without Retry-After | exponential backoff (30s, 60s, ..., cap 10min, max 5) → abort with clean shutdown |
| fetcher.ts | 503 | same as 429 |
| fetcher.ts | 5 consecutive 429s | abort, email pedro via log, exit 2 |
| fetcher.ts | 5 consecutive 404s | end of enumeration; mark all `permanent_404`; exit 0 |
| fetcher.ts | robots.txt Disallow | abort + log |
| parser.ts | unexpected DOM shape (missing required field) | log to errors.ndjson, skip entry, continue. If error rate > 5% (configurable), abort. |
| mapper.ts | unmapped natureza-jurídica | throw (or → privado with `--allow-unknown-tipo`) |
| mapper.ts | no ERPI valência | log filtered, skip |
| slug.ts | unresolvable collision (alvará suffix exhausted) | throw — should never happen with real data |
| merge.ts | hand seed entry has no scrape match | log to seed-orphans.ndjson, manual review by Pedro |
| merge.ts | scraped entry concelho not in registry + not in aliases | abort merge with full list of unmapped concelhos |
| Astro build | unknown slug in `getStaticPaths` | build fails (Vercel deploy fails before promotion — safe) |
| CI | build exceeds 15 min | timeout, deploy not promoted |
| Plausible | event call when script blocked | silent noop (already wrapped per Phase A from earlier plan) |

### State Lifecycle Risks

- **Partial scrape interruption:** SQLite WAL survives kill -9. `crawl_state.status='pending'` rows resume on next run. Cache files (`.scrape-cache/`) provide HTTP cache. **Safe.**
- **Snapshot mid-write:** atomic write via temp file + rename. **Safe.**
- **`src/data/lares.json` mid-commit:** Pedro reviews diff before committing. Git itself is atomic. **Safe.**
- **CONCELHOS registry desync:** if scrape adds a concelho slug and registry isn't updated, `getRoutedConcelhos` filters the lar out silently. Mitigation: D4's fail-loud rule + the build-time guard in `[concelho]/[slug].astro` that throws on unknown concelhoSlug. **Safe with mitigation.**
- **Slug change between snapshots:** if a Carta Social entry's nome changes mid-year, our merge.ts preserves the existing slug via `(slugify-of-old-nome, concelhoSlug)` matching. **But if the nome change is large enough to break the slug-of-nome match**, the entry shows as removed + added. Mitigation: also match on `(alvará, concelhoSlug)` as fallback. **Documented; alvará as canonical identity per spec-flow Minor #16.**
- **Tombstone management:** entries that disappear from Carta Social get appended to `lares.tombstones.json`. `_headers` config returns 410 Gone for their URLs. Manual review by Pedro before tombstoning (operator might have just been re-numbered, not closed).

### API Surface Parity

The new shared `src/lib/lares/slug.ts` is consumed by:
- Astro pages — for validation in dev (assert all slugs in `lares.json` round-trip the algorithm)
- The scraper script — for generation
- Future Phase 2.8 operator claim flow — for new entries that operators add

If a fourth consumer appears, slug.ts is the single source. No DSL/mixin/parallel surface to worry about.

### Integration Test Scenarios

5 cross-layer test scenarios mock-free unit tests wouldn't catch:

1. **Full pipeline against fixtures.** Feed 10 committed HTML fixtures through fetcher (cached) → parser → mapper → slug → output. Assert: NDJSON exactly matches a committed `expected.ndjson`. Run on every CI build.
2. **Seed-merge end-to-end.** Take a synthetic "previous lares.json" with 5 hand entries and a synthetic "current scrape" with 100 entries (5 matching by name+concelho). Run merge. Assert: 5 hand slugs preserved, 95 new entries added, 0 duplicates, the orphans list is empty.
3. **Concelho-alias resolution.** Synthetic scrape with concelho slug `"vila-real-de-santo-antónio"` (with accent). Alias map maps to `"vila-real-de-santo-antonio"`. Assert: merge succeeds, the lar is routed to `/lares/vila-real-de-santo-antonio/...`.
4. **Multi-valência + multi-tipo.** A fixture with valências=[ERPI, Centro de Dia, SAD] and natureza="IPSS — Misericórdia". Assert: emitted as one entry, tipo=misericordia (precedence), valencias=[erpi, centro_dia, sad].
5. **Tombstone → 410.** Add a slug to `lares.tombstones.json`, build, deploy to preview, curl the URL. Assert: HTTP 410.

## Acceptance Criteria

### Functional Requirements

#### R1 — Coverage
- [ ] First production-ready ingest yields ≥ 2,000 *successful* `Lar` entries (skipped entries logged separately). Target: ~2,600 (full Carta Social count). Counted by `Lar` records, not `idEquipment` IDs (one ID may yield zero or one Lar after multi-valência filtering).

#### R2 — Per-entry fields
- [ ] Every entry has: `slug`, `nome`, `tipo`, `acordoSS`, `valencias`, `concelhoSlug`, `distritoSlug`, `source: "carta_social"`.
- [ ] ≥ 95% of entries have: `freguesia`, `morada`, `codigoPostal`.
- [ ] ≥ 80% of entries have: `telefone`.
- [ ] `preco` field unset for all `carta_social`-sourced entries (prices stay from wizard reports + operator outreach).
- [ ] `_meta.carta_social_url` per entry (deep link to source page).

#### R3 — Slug stability
- [ ] All 32 hand-curated seed slugs are preserved byte-for-byte after merge.
- [ ] Slug-generation pass yields zero unresolvable collisions.
- [ ] CI guard (Phase H2) compares slugs between commits; fails if any slug changes without a tombstone added.
- [ ] Closed lares appear in `lares.tombstones.json`; their URLs return HTTP 410 via `_headers` / `vercel.json` config.

#### R4 — tipo mapping
- [ ] Build-time guard rejects unknown `natureza jurídica` values unless `--allow-unknown-tipo` set.
- [ ] Multi-tipo precedence applied (`misericordia > ipss > cooperativa > privado`); multi-matches logged.

#### R5 — acordoSS
- [ ] Boolean reflects ERPI valência only.
- [ ] `acordoSS` set to `false` (not `null` — type stays boolean) when ERPI is present but lacks acordo.
- [ ] Documented in `Lar.acordoSS` JSDoc.

#### R6 — Attribution
- [ ] Every `/lares/[concelho]/[slug]` page footer: *"Dados publicados originalmente pela [Carta Social — MTSSS](https://www.cartasocial.pt/...)" with the per-entry deep link.
- [ ] `src/data/lares.json` `_meta` block: `source`, `source_url`, `snapshot_date`, `attribution_text`.
- [ ] `LEGAL.md` documents the LADA Art. 7.º basis + the CC-BY-SA 4.0 dataset license.

#### R7 — Open-source script
- [ ] `scripts/scrape-carta-social/` is committed to the public repo, including `__tests__/fixtures/`.
- [ ] No secrets in the script (UA contact email is the only "PII" — already public).
- [ ] README in the scrape folder explains usage + flags + ethics.

#### R8 — Polite rate + caching + resumability
- [ ] Default rate: 1 request per 2,500ms (0.4 req/s).
- [ ] User-Agent: `PrecoslaresBot/1.0 (+https://precoslares.pt/bot; gairifo@gmail.com) Node/20`.
- [ ] `/bot` page returns 200 with the public bot info.
- [ ] HTTP cache via `make-fetch-happen`. Conditional GETs honored.
- [ ] SQLite WAL `crawl_state`; resumes cleanly after SIGINT / kill -9.
- [ ] Robots.txt parsed; `Crawl-delay` honored; `Disallow: /` aborts.
- [ ] On 5 consecutive 429s OR robots.txt Disallow: clean shutdown + exit 2 + log line that says "email Pedro now".
- [ ] On 5 consecutive 404s: clean end-of-enumeration.

#### R9 — Annual refresh ritual
- [ ] `docs/AUTHORING.md` has a dedicated "Annual lar refresh" section with the full procedure.
- [ ] Procedure documented to take Pedro ≤ 4 hours of active time.
- [ ] Diff workflow surfaces additions/removals/changes for review before commit.

#### R10 — UI scales to ~2,700 entries
- [ ] `/lares/[concelho]/[...page].astro` paginates at 25 entries/page.
- [ ] Page 1 URL = `/lares/<concelho>` (no `/page/1` suffix).
- [ ] `<link rel="prev|next|canonical">` emitted on paginated pages.
- [ ] Concelho pages with > 25 entries paginate; ≤ 25 single-page.
- [ ] `/lares/index.astro` lists all concelhos by name + larCount; doesn't bulk-render entries.
- [ ] Filter UI on concelho pages: client-side toggle by tipo + acordo.
- [ ] Build completes in ≤ 120s on Vercel; ≤ 8 min on CI.

### Non-Functional Requirements

- [ ] CI build runs under 15 min total (raise from current 8 min).
- [ ] Astro build uses ≤ 4 GB memory (GitHub runner has 7 GB).
- [ ] Wizard chunk size unaffected (lar data behind getCollection — server-only).
- [ ] Plausible event vocabulary unchanged except for the new `directory_lar_view`.

### Quality Gates

- [ ] Tests: ≥ 30 new tests pass; existing 47 still pass.
- [ ] Schema.org validator green on a sample `/lares/[concelho]/[slug]` page.
- [ ] Sitemap validates with ~2,700 routes.
- [ ] No `import.meta.env.SECRET_*` leak (existing CI guard).
- [ ] Manual review of 30 random scraped entries.

## Success Metrics

- ≥ 2,000 *successful* entries in production within 7 days of starting Phase G.
- ≥ 280 concelho pages routed (was 14 with seed).
- Sitemap entry count grows from ~70 to ≥ 2,000.
- Google Search Console: ≥ 50 unique lar pages indexed within 30 days of publish.
- ≥ 10 organic `lares idosos [concelho]` queries land on precoslares.pt per Plausible referrers within 30 days.
- 0 confirmed legal complaints from GEP/MTSSS official channels (email, registered letter, phone) within 30 days of publish.
- Annual refresh runs end-to-end in ≤ 4 active hours.

## Dependencies & Prerequisites

**External (Pedro / world):**
- Carta Social site continues exposing per-ID detail pages with the documented structure.
- Vercel free tier build budget allows ~50 builds/month at scale.
- No GEP/MTSSS objection during the 24-48h scrape window.

**Internal (already shipped):**
- Phase 2 lar routing infrastructure (`/lares/[concelho]/[slug].astro`, types, lookup utils) — done.
- Astro 5 + sitemap integration — done.
- `_meta` block in `lares.json` already supports extension — done.

**New deps (devDependencies only — never enter client bundle):**
- `make-fetch-happen` — HTTP cache + retries
- `p-queue` — rate-limited queue
- `p-retry` — exponential backoff
- `robots-parser` — robots.txt parsing
- `better-sqlite3` — crawl state (native binding; Pedro's macOS prebuilt available)
- `@sindresorhus/slugify` — PT diacritic-aware slugs
- `cheerio` — HTML parsing
- `pino` — structured logging
- `zod` — already present (via astro:content)
- `ndjson` — line-delimited JSON I/O

## Risk Analysis & Mitigation

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| GEP issues cease-and-desist | L | H | Pre-staged response letter (PT+EN) citing LADA + CJEU; polite shutdown protocol; per-record takedown offer; named maintainer; archive.org snapshots for proof of public availability |
| Carta Social site refactors mid-scrape | M | M | Parser tests against committed fixtures fail loudly; partial-result review before merge |
| Rate limiting trips at 2.5s/req | L | M | Configurable via flag; exponential backoff; SQLite resume; archived cache means re-run is cheap |
| Slug collision algorithm fails on a real entry | L | M | Cascade has 4 fallbacks (base → +concelho → +freguesia → +alvará-last-4); unresolvable throws + Pedro fixes manually |
| Build time exceeds CI timeout | L | M | CI timeout raised to 15 min; expected actual <3 min; mitigation paths documented (ISR, batching) but not implemented unless needed |
| Vercel free tier exhausts | L | L | At ~50 builds/month, well within 100-min budget; Pro tier ($20/mo) is the upgrade path |
| Stale data after annual refresh forgotten | M | M | `docs/AUTHORING.md` ritual; calendar reminder for Pedro (Q1) |
| Operators reach out wanting their lar removed | M | L | Per-page "Reportar erro" footer; standard policy: factual public-record data, attribution provided, per-record takedown available |
| Tombstone list grows unwieldy | L | L | Tombstones are just slug + timestamp; thousands fit fine |
| `idEquipment` re-numbering on Carta Social side | L | H | Match by `alvará` as canonical identity (already in design); `idEquipment` is only the access path |
| Wrong-concelho assignment in scraped data | L | M | Fail-loud unmapped-concelho check; alias map covers known variants |
| Hand seed entry overwritten by scrape | L | M | Seed-merge logic preserves hand slug + hand-edited fields (preço, notas) |
| Scraper accidentally pushed with API tokens | L | H | No tokens needed — Carta Social is unauthenticated. CI grep guard already in place. |

## Resource Requirements

- **Pedro time:** 3-4 active days. Phases A-F over 1-2 weekends; Phase G run overnight; Phase H polish post-launch.
- **Money:** €0 incremental. All dev tools free. Resend / Plausible / Vercel free tiers absorb the modest traffic uptick.
- **Infra:** No new hosting. SQLite cache lives on Pedro's laptop. Snapshots ship to git via the existing repo.

## Future Considerations

**Phase 2.6+** in the original roadmap (operator claim flow): the rich dataset makes this more valuable. Operators search for their lar, claim via email verification matching the listed phone/email, can add structured info + respond to reports.

**Phase 2.7** (search by concelho): now backed by real data. A `/lares` search input with client-side autocomplete becomes viable (filter the 2,700-entry JSON in the browser — at ~700 KB it's borderline; consider a search index file with just name+slug+concelho per entry, ~50 KB).

**Phase 3** (per-município content): the 280 concelho pages become natural anchors for "Apoios da Câmara de [concelho]" + "Centro Distrital SS" content. Programmatic SEO compounds.

**Long-term dataset license**: CC-BY-SA 4.0 ships now. If demand grows, a separate `precoslares-data` repo (CC0 vs CC-BY-SA debate; CC-BY-SA matches our content posture) gives third parties a clean way to fork.

**Crawl budget for re-scrapes**: incremental ETag-based fetches make annual refresh near-zero-cost. After 3 annual cycles, we'll have a strong historical record of which lares opened/closed when — useful for trend journalism, academic research.

## Documentation Plan

- `docs/AUTHORING.md` — add "Annual lar refresh" section
- `docs/ETHICS.md` (new) — full scraper ethics: rate, UA, robots, opt-out, attribution
- `docs/LEGAL.md` (new) — LADA Art. 7.º, CC-BY-SA 4.0 dataset license, MIT code license, CJEU C-762/19, CNPD analysis
- `docs/MAINTAINERS.md` (new) — Pedro + contact
- `docs/legal/response-template-pt.md` + `response-template-en.md` (new)
- `docs/launch-checklist.md` — replace cold-start section with "Carta Social directory live"
- `README.md` — update lar count + data source + dataset license
- `/sobre` page — mention Carta Social as data source
- Scrape script README — usage, flags, ethics

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-05-11-comprehensive-lares-directory-requirements.md](../brainstorms/2026-05-11-comprehensive-lares-directory-requirements.md). Key decisions carried forward:
  1. Polite scrape path, skip the GEP pre-email (Pedro's call 2026-05-11)
  2. CC-BY-SA 4.0 dataset license
  3. Annual refresh ritual
  4. URL stability rule (hand slug preserved; tombstones for closed lares)
  5. Carta Social-sourced entries don't carry `preco` (prices stay crowdsourced)

### Internal references

- Existing Lar shape: [src/lib/lares/types.ts](../../src/lib/lares/types.ts)
- Concelhos registry: [src/lib/lares/concelhos.ts](../../src/lib/lares/concelhos.ts) — to be extended
- Lar pages: [src/pages/lares/[concelho]/index.astro](../../src/pages/lares/%5Bconcelho%5D/index.astro), [src/pages/lares/[concelho]/[slug].astro](../../src/pages/lares/%5Bconcelho%5D/%5Bslug%5D.astro)
- Data loader: [src/lib/lares/index.ts](../../src/lib/lares/index.ts)
- Sitemap config: [astro.config.mjs](../../astro.config.mjs)
- CI workflow: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Existing AUTHORING ritual pattern (yearly constants): [docs/AUTHORING.md](../AUTHORING.md)

### External references — Astro 5

- [Routing reference / getStaticPaths](https://docs.astro.build/en/reference/routing-reference/#getstaticpaths)
- [Pagination guide](https://docs.astro.build/en/guides/routing/#pagination)
- [Content Collections — `file()` loader](https://docs.astro.build/en/guides/content-collections/)
- [Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [Rendering modes (for 410)](https://docs.astro.build/en/basics/rendering-modes/)

### External references — Scraping + Legal

- [Lei n.º 26/2016 (LADA)](https://dre.pt/dre/legislacao-consolidada/lei/2016-75216578)
- CJEU C-762/19 (CV-Online Latvia) — sui generis DB right scope
- [CNPD Deliberação 2023/622](https://www.cnpd.pt/) — scraping public-interest data
- [Database Directive 96/9/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31996L0009)
- [D3 — Defesa dos Direitos Digitais](https://direitosdigitais.pt/)
- [Transparência Hackday Lisboa principles](https://transparencia.pt/) — civic-tech ethics

### External references — Tooling

- [make-fetch-happen (npm)](https://www.npmjs.com/package/make-fetch-happen)
- [p-queue](https://www.npmjs.com/package/p-queue)
- [p-retry](https://www.npmjs.com/package/p-retry)
- [robots-parser](https://www.npmjs.com/package/robots-parser)
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
- [@sindresorhus/slugify](https://www.npmjs.com/package/@sindresorhus/slugify)
- [cheerio](https://www.npmjs.com/package/cheerio)
- [pino](https://www.npmjs.com/package/pino)
- [savepagenow](https://github.com/pastpages/savepagenow) for archive.org snapshots

### Related work

- [Phase 1 plan](2026-05-10-001-feat-phase-1-soft-launch-bundle-plan.md) — the existing /lares routes this scales up
- Brand rename commit `8601ae9` — establishes the precoslares.pt brand the data fulfills
