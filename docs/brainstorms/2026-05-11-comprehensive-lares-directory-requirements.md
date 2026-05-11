---
date: 2026-05-11
topic: comprehensive-lares-directory
---

# Comprehensive lares directory (Carta Social ingest)

## Problem Frame

precoslares.pt ships today with 32 hand-curated lar entries across 14 concelhos out of an estimated ~2,700 ERPIs in Portugal — coverage rate ~1%. The brand promise (preços de lares por concelho) and the SEO opportunity (price-anchored queries like `lares idosos lisboa preços`, `lares ipss sintra`, `lares de idosos cascais`) both depend on coverage: a family searching `lares em odivelas` should land on a populated /lares/odivelas page, not an em-breve placeholder. The autocomplete sweep proved the demand exists; we need the data inventory to meet it.

Affected: Portuguese families searching for a lar by concelho (often the freguesia or zona de Lisboa specifically); SEO crawlers indexing the long-tail; Pedro's credibility on the brand promise.

**Out of frame:** *pricing* per lar. Carta Social does not publish prices. Prices will continue to come from (a) the wizard's anonymous crowdsourced reports, (b) the few publicly-priced operators (Misericórdias' tabelas oficiais, Domus Vida), (c) eventual operator self-serve claims (Phase 2.8). This brainstorm captures only the *skeleton* — the comprehensive list of who exists and where.

## Requirements

- **R1. Coverage target ≥ 2,000 ERPI entries** at first ingest run, aiming for ~2,600 (the published Carta Social total). 100% is not required; missing late-added entries are acceptable.
- **R2. Per-entry fields** — match the existing `Lar` type in [`src/lib/lares/types.ts`](../../src/lib/lares/types.ts). Required: `slug`, `nome`, `tipo`, `acordoSS`, `valencias`, `concelhoSlug`, `distritoSlug`, `source: "carta_social"`. Strongly preferred when available: `freguesia`, `morada`, `codigoPostal`, `telefone`, `capacidade`. Nice-to-have: `email`, `website`. `preco` stays unset for `carta_social`-sourced entries — Carta Social doesn't publish prices.
- **R3. Deterministic, collision-safe slugs.** Multiple "Santa Casa da Misericórdia" exist nationally; slugs must include enough context to be unique within the full dataset. Convention: `<name-kebab>-<concelho-slug>` when needed for disambiguation, falling back to `<name-kebab>` when unique nationally. Slugs must remain stable across re-ingests so that external links and the sitemap don't break.
- **R4. Mapping logic for `tipo`** — Carta Social's "natureza jurídica" field maps to our four-value `tipo` enum (`ipss` | `misericordia` | `privado` | `cooperativa`). Documented in code with the mapping table.
- **R5. Acordo-SS flag** — every entry carries a boolean `acordoSS` indicating cooperação com Segurança Social. This is the single most useful filter for families (drives the IPSS / Misericórdia preference) and is exposed on Carta Social per-equipamento.
- **R6. Attribution on every page that displays Carta Social data.** Footer text: *"Dados publicados originalmente pela Carta Social — Ministério do Trabalho, Solidariedade e Segurança Social"* with a link to the original cartasocial.pt entry when possible. Also in the JSON `_meta` block.
- **R7. Open-source the ingest script.** Lives at `scripts/scrape-carta-social.ts` (or equivalent), committed alongside everything else. Transparency over secrecy — auditable, repeatable, defensible.
- **R8. Polite rate + caching + resumability.** Default 1 request per 2 seconds (under one connection). Cache responses to disk so partial runs resume without re-fetching. Stop immediately on a 429 / cease-and-desist / GEP contact.
- **R9. Annual refresh as maintenance ritual.** Documented in [`docs/AUTHORING.md`](../AUTHORING.md). Pedro re-runs the script once per year (Q1, after the new fiscal-year update of any operator data); script diffs the output against the existing `src/data/lares.json` and surfaces additions / removals / changes for review before commit.
- **R10. UI scales gracefully to ~2,700 entries.** `/lares` index doesn't list all 2,700 in one page (concelho-grouped summary stays useful at scale). `/lares/[concelho]` pages with many entries (Lisboa expected >100) need pagination or filter UI (filter by tipo / acordoSS) rather than infinite scroll. Build-time performance for ~2,700 Astro static pages remains under 60 seconds.

## Success Criteria

- After ingest, every PT concelho returned by Carta Social has at least one lar entry on precoslares.pt (the empty-em-breve banner disappears for ~280 of the 308 concelhos; the remaining ~28 are genuine zero-ERPI areas).
- Searching Google PT for `lares de idosos [concelho]` for the 30 top concelhos returns a precoslares.pt page in the top 10 within 90 days post-ingest.
- Sitemap grows from ~70 pages to ≥ 2,000 indexed routes.
- The ingest script can be re-run by Pedro in under 4 hours of elapsed time, end-to-end.
- Zero confirmed legal complaints from GEP / MTSSS within 30 days of publication.

## Scope Boundaries

- **Not in scope:** prices, photos, operator-supplied descriptions, ratings, reviews, real-time vacancies. Carta Social doesn't expose these and inventing them is wrong.
- **Not in scope:** non-ERPI valências (Centro de Dia, SAD, Centro de Convívio) as primary entries. Carta Social entries with multiple valências keep them as `valencias[]`, but the route taxonomy stays `/lares` (ERPI-centric). Pure Centro de Dia / SAD pages are deferred.
- **Not in scope:** non-PT facilities (Açores and Madeira regions stay in scope as part of PT; Brazilian / overseas-Portuguese facilities do not).
- **Not in scope:** operator claim flow (Phase 2.8) — operators don't get to edit their Carta Social-sourced page without verification.
- **Not in scope:** comparison statistics service — needs crowdsourced price data first; tracked separately.
- **Not in scope:** active opposition to GEP. If GEP contacts the project asking us to stop, we stop and pivot to formal request.

## Key Decisions

- **Path = polite scrape, skip the pre-email to GEP.** Pedro's call (2026-05-11). The fait-accompli-then-cooperate posture is rejected; scrape goes first and we deal with consequences if and when they arrive. Defensible because (a) data is taxpayer-funded public record, (b) we publish attribution everywhere, (c) script is open-source and auditable, (d) we stop immediately on contact.
- **License for the resulting dataset = CC-BY-SA 4.0.** Same as the deep-dive content. Forces attribution downstream + share-alike on derivatives. Engine code remains MIT.
- **Refresh cadence = annual.** Manual run by Pedro, Q1 after fiscal-year updates. Not a cron job. Documented ritual.
- **Slug stability rule** — once a slug ships in `src/data/lares.json`, it is never renamed unless the lar genuinely changes name. If an entry is removed (lar closes), its URL serves a `410 Gone` with a redirect to its concelho page rather than a hard 404.
- **No Carta Social data goes into the `preco` field of any entry.** Prices are exclusively from crowdsourced wizard reports or operator self-serve claims (Phase 2.8). Carta Social-sourced entries display "Preço não confirmado — partilhe se conhece" CTAs.

## Dependencies / Assumptions

- Carta Social's `idEquipment` enumeration remains the access pattern documented in recon. If the site refactors to a different routing scheme, the ingest script needs an update — but that's a known risk for any scraping approach.
- Vercel's static build can handle ~2,700 page generation without exhausting the build minute quota (free tier: 100 build-minutes/month; expected single-build cost: ~1 minute even with the inflated page count).
- Resend's free tier (3,000 emails/month) remains the price-report intake mechanism; that's orthogonal to this work.
- Pedro's email at `gairifo@gmail.com` is a credible point of contact if GEP wishes to reach out — already published on the site.

## Outstanding Questions

### Resolve Before Planning

*(none)*

### Deferred to Planning

- [Affects R3][Technical] Exact slug-generation algorithm. Hand-crafted slugs in the current seed (e.g., `santa-casa-misericordia-lisboa`) need to extend to all 2,700 entries deterministically without collisions. Proposal during planning: `kebab(nome)` first; if collision, append `-<concelho-slug>`; if still collision, append `-<distrito-slug>`. Codify + test.
- [Affects R4][Technical, needs research] The exact `natureza jurídica` strings Carta Social uses, and their mapping to our `tipo` enum. Will be discovered during the first probing scrape; mapping table goes in the ingest script with a build-time guard that errors on unknown values.
- [Affects R8][Technical] How to detect the upper bound of `idEquipment` (when does the enumeration stop returning entries). Probably: start from the highest known ID + scan forward in batches, declare done after N consecutive 404s.
- [Affects R10][Technical, needs research] Pagination vs filter UI for high-density concelho pages (Lisboa, Porto). Worth a quick spike during planning to pick the simpler approach.
- [Affects R10][Technical] Build-time performance baseline at ~2,700 pages. If Astro static build exceeds 60s, evaluate batching strategies or per-concelho sub-routes.

## Next Steps

→ `/ce:plan` for structured implementation planning.
