---
date: 2026-05-10
topic: phase-1-soft-launch-bundle
---

# Phase 1 Soft-Launch Bundle

## Problem Frame

Phase 0 of the lar-ajuda roadmap is complete: the apoios calculator works for Pedro's family case and surfaced ≥ 1 apoio he didn't know about (Phase 0 gate passed). Phase 1's North Star is "ship the apoios calculator publicly … validate that families find it useful." Today, the calculator is live in dev but missing the elements that make it shareable, trustworthy, and trackable. This bundle is the minimum work needed to make a soft launch to 50–100 people meaningful — i.e., enough that the success metrics in roadmap §Phase 1 can actually be measured (≥ 100 permalink shares, ≥ 50% calculator-completion rate, ≥ 3 unsolicited testimonials).

Affected users: Portuguese families with an idoso facing a care decision. Soft-launch audience: Reddit Portugal, Facebook cuidadores informais groups, 2–3 LinkedIn posts.

## Requirements

- **R1. Permalink for results.** A user who completes the wizard can copy a URL that, when opened by anyone (a sibling, a social worker), restores the same inputs and shows the same result, with no server round-trip and no PII leaking server-side. URL format: `/calculadora#i=<base64url>` (hash, not query string, so inputs never appear in server logs or referer headers). Includes a visible "Copiar link" button on the result page next to "Imprimir / PDF".

- **R2. PDF / print polish.** The existing `window.print()` button produces a clean, readable PDF: header + footer + nav suppressed, single-column, all apoio cards expanded, "Como é calculado" details auto-opened, page break sensible between sections, A4-friendly margins, the bundle's data-source disclaimers always visible.

- **R3. Three deep-dive apoio pages, ~2,000 words each.** Long-form content per roadmap §3.2 / spec §3.2. The 3 apoios are the highest-traffic head terms in PT-PT eldercare search:
  - `/apoios/csi-complemento-solidario-idosos`
  - `/apoios/complemento-por-dependencia`
  - `/apoios/atestado-multiusos`
  Each page must include: what it is, who qualifies, the exact formula or rule (with the constants used), how to apply step-by-step, common pitfalls, FAQ block (≥ 5 questions, FAQ schema markup), official source links, last-updated date, and an inline link back to `/calculadora` framed as "Ver quanto eu posso receber →".

- **R4. "Reportar erro" link on every page.** Per cross-phase governance: "report a bug link prominent." Footer-level mailto with subject prefilled with the page path. Zero server, zero form. One-line: `<a href="mailto:gairifo@gmail.com?subject=…">Reportar erro nesta página</a>`.

- **R5. Plausible analytics.** Per roadmap §Phase 1 tech stack. Single `<script>` in `Base.astro`, no cookies, no PII. Track: pageviews, custom event `calculator_completed` when a user reaches the result view, custom event `permalink_copied` when R1's button is clicked. Pause-able if Plausible isn't set up yet (env-flag).

- **R6. SEO basics: sitemap.xml + robots.txt + JSON-LD on deep-dives.** Astro generates `sitemap.xml` (Astro integration), `public/robots.txt` allows all + sitemap reference, each deep-dive page emits `Article` + `FAQPage` JSON-LD.

- **R7. Soft-launch readiness checklist.** A short `docs/launch-checklist.md` Pedro runs through before going live: domain pointed to host, Plausible site created, "Report erro" mailto verified, build passes, all 3 deep-dive pages live, share-link tested in incognito, mobile pass on iOS Safari + Android Chrome.

## Success Criteria

- A sibling can open a permalink on their phone and see the same result the original family member saw — verified end-to-end on iOS Safari, Android Chrome, and one desktop browser.
- The 3 deep-dive pages are each ≥ 1,800 words (slack to 2k spec target), pass a manual reading-level check, and link bidirectionally with the calculator.
- The PDF export is clean enough that the example case can be sent to a social worker without embarrassment (subjective gate Pedro applies).
- Plausible reports calculator_completed events for the test family flow.
- Post-launch, the success metrics defined in roadmap §Phase 1 ("Success metrics (end of Phase 1)") become measurable. (The metrics themselves are evaluated post-launch, not in this bundle.)

## Scope Boundaries

- **Not in scope:** Carta Social ingestion, lar profile pages, anonymous price reporting, comparison statistics, operator claim flow, wizard branching A/B/C/D — all Phase 2.
- **Not in scope:** Domain registration, DNS, hosting setup — Pedro tasks, prerequisites for actual launch but not engineering work.
- **Not in scope:** Per-município pages, decision tree, cost simulator, master "por onde começar" guide — all Phase 3.
- **Not in scope:** Email capture, newsletter, accounts, login.
- **Not in scope:** Re-translating content into PT-BR / ES (Phase 3 bonus).
- **Not in scope:** The other 5 apoios as deep-dives (ERPI acordo, IRS Art. 84º, IRS Art. 87º, ADSE/IASFA/SAD-PSP, Cuidador Informal). Calculator covers them; long-form pages come after Phase 1 launch validates demand.

## Key Decisions

- **Permalink format = URL hash, not query string.** Hashes never reach the server, so inputs (idade, pensão, dependência) never appear in logs / referer / analytics. Aligns with wizard spec §8 "Privacy architecture": "All Stage 1 inputs … never leave browser."
- **Encoding = base64url(JSON.stringify(input)).** Compact, no library needed. Versioned with a `v` field for forward compatibility when the input schema evolves.
- **Bug-report channel = `mailto:`, not a form.** Zero ops surface, zero spam vector, zero data residency question. Acceptable until volume warrants more.
- **Plausible over Cloudflare Web Analytics.** Roadmap explicitly named Plausible; ~9€/mo is acceptable; Plausible's custom-event API is what enables the calculator_completed metric without writing custom backend.
- **Three apoios for the deep-dives = CSI, Complemento por Dependência, Atestado Multiusos.** Spec §3.2 names these as the head terms ("complemento por dependência", "lar idosos comparticipado", "atestado multiusos como pedir").
- **Page depth = ~2,000 words each (Pedro's call).** Higher upfront effort but maximizes long-term SEO. Realistic timeline: 2 weekends, possibly 3, including review of legal-adjacent content.
- **Domain = `lar-ajuda.pt` assumed.** Already used as canonical in `Base.astro`. Pedro confirms when registering.

## Dependencies / Assumptions

- Pedro registers `lar-ajuda.pt` (or chosen alternative) and points it at Cloudflare Pages or Vercel before launch. Engineering bundle works without it; only the actual launch is gated.
- Pedro creates the Plausible site so we have the `data-domain` to embed.
- Calculator wizard is functionally stable post-Phase 0. (Confirmed: Pedro tested it.)
- The repo is already public-ready (MIT license file in place).

## Outstanding Questions

### Resolve Before Planning

(None — bundle is fully scoped.)

### Deferred to Planning

- [Affects R3][Needs research] Should the 3 deep-dive pages be authored as `.md` files via Astro Content Collections, or as `.astro` pages with inline content? Content Collections give better authoring ergonomics + frontmatter, but adds a small layer. Decide during planning based on what Pedro will be most comfortable editing.
- [Affects R5][Technical] Plausible env-flag default: ship with Plausible disabled in dev / enabled in prod, or always-on? Decide during planning.
- [Affects R3][Needs research] Source verification: each citation in the deep-dives should link to the official portaria / DR / DGSS page. Some of these change URLs over time. Strategy for link rot? (e.g., archived snapshot, internal redirect map.)
- [Affects R6][Technical] Astro's `@astrojs/sitemap` integration vs hand-rolled. Sitemap integration is one line; default to it unless something blocks.

## Next Steps

→ `/ce:plan` for structured implementation planning.
