// Astro 5 Content Collections — apoios collection.
//
// Each /src/content/apoios/<slug>.md file is a deep-dive page about a
// public-support program. Frontmatter is Zod-validated at build time;
// adding a new entry without the required fields fails the build.
//
// Authoring guide: docs/AUTHORING.md (8-section template, PT-PT vocab
// glossary, source allowlist).

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/** Stable kebab-case slugs that double as `apoio_id` in calculator results.
 *  Adding a new apoio: add to this array AND to src/lib/calculator/index.ts
 *  in the same PR so the cross-reference stays valid. */
export const APOIO_IDS = [
  "csi",
  "complemento-dependencia",
  "atestado-multiusos",
  "irs-art-84",
  "irs-art-87",
  "erpi-acordo",
  "adse-iasfa-sad",
  "cuidador-informal",
  "apoios-municipais",
] as const;

const apoios = defineCollection({
  loader: glob({
    base: "./src/content/apoios",
    pattern: "**/[^_]*.md",
  }),
  schema: z.object({
    /** SEO `<title>` text. Optimized for the head term + 2026 + value modifiers. */
    title: z.string().min(20).max(80),
    /** Visible `<h1>`. Often differs from title (less keyword-stuffed). */
    h1: z.string().min(10).max(120),
    /** `<meta name="description">`. 150–160 chars sweet spot. */
    description: z.string().min(120).max(180),
    /** ISO date of last update. Used for `dateModified` in JSON-LD and
     *  for the visible "Atualizado em ..." stamp. */
    lastUpdated: z.coerce.date().refine(
      (d) => !isNaN(d.getTime()),
      "lastUpdated must be a valid ISO date"
    ),
    /** Approximate reading time in minutes. */
    readingMinutes: z.number().int().positive().max(60),
    /** Year of the IAS / portaria values cited inline. Permits stale-content
     *  detection by build script in future yearly updates. */
    iasYear: z.number().int().min(2020).max(2100),
    /** Maps the deep-dive back to a calculator result row. */
    apoioId: z.enum(APOIO_IDS),
    /** Sources block — every claim with a number or legal citation must
     *  appear here. Authors link to canonical_url; archive_url is the
     *  web.archive.org snapshot for link-rot defense. */
    sources: z
      .array(
        z.object({
          label: z.string(),
          canonical_url: z.string().url(),
          archive_url: z.string().url().optional(),
        })
      )
      .min(3),
    /** FAQ block. Rendered both as visible `<h3>`/`<p>` Q&A AND as
     *  FAQPage JSON-LD. Min 5 per Google's structured-data guideline
     *  (even though FAQPage rich results are gov/health-only post-2023,
     *  the markup still helps Bing + LLM crawlers). */
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(5),
    /** ≤500-char TL;DR for LLM context injection (Phase 4 concierge).
     *  Doubles as the lede on the page. */
    agentSummary: z.string().min(100).max(500),
    /** Optional: keywords for search/agent-matching. */
    agentKeywords: z.array(z.string()).optional(),
  }),
});

export const collections = { apoios };
