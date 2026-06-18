# precoslares.pt (lar-ajuda)

## Project Overview
A public, open-source, non-profit calculator that helps Portuguese families work out which state supports (apoios sociais) they can claim for an elderly relative. It applies the rules of 8 main apoios and returns an annual estimate plus an action plan. Built as a fully-static Astro 5 site with React 19 islands and Tailwind 3.

## Repo Structure
```
src/
  lib/calculator/  ← pure-TS calculation engine (no DOM, no fetch); apoios/, __tests__/
  components/      ← UI components incl. the React Wizard island
  pages/           ← Astro routes (calculadora, lares/, apoios/, etc.)
  layouts/         ← Base.astro shell
  content/         ← content collections (content.config.ts)
  data/            ← datasets
  styles/          ← global CSS
api/               ← report.ts — serverless endpoint for anonymous price reports
brand/             ← brand guide, logos, brand.css
scripts/           ← emit-schema.ts, emit-lares-slim.ts, scrapers, __tests__/
docs/              ← product specs (calculator rules, roadmap, wizard spec)
astro.config.mjs   ← static build, React + Tailwind + sitemap integrations
```

## Tech Stack
- Language: TypeScript (strict — extends `astro/tsconfigs/strict`)
- Framework: Astro 5 (static output, no SSR adapter) + React 19 islands
- Styling: Tailwind CSS 3 (`@astrojs/tailwind`)
- Testing: Vitest (Node environment)
- Tooling: tsx for build scripts; cheerio/p-queue/p-retry for the scraper
- Hosting: Vercel (static); README also mentions Cloudflare Pages

## Commands
- `npm run dev` — dev server at http://localhost:4321
- `npm run build` — emit schema + slim lares dataset, then `astro build`
- `npm run preview` — preview the built static site
- `npm run check` — `astro check` (type/diagnostics)
- `npm test` — `vitest run` (calculator engine tests)
- `npm run test:watch` — Vitest in watch mode

## Conventions
- Strict TypeScript; ESM (`"type": "module"`); double-quoted strings
- Path alias `~/*` → `src/*` (configured in tsconfig, astro.config and vitest)
- Calculator engine is pure TS — no DOM, no fetch; one file per apoio under `apoios/`
- Tests live in `__tests__/` dirs matching `{src,scripts}/**/__tests__/**/*.test.ts`
- All user-facing content is in Portuguese (pt-PT)

## Gotchas
- New fiscal year: edit `src/lib/calculator/constants*.json`, rename the file, update the import in `constants.ts`, fix value-dependent tests, open a PR.
- `npm run build` runs `emit-schema` and `emit-lares-slim` first — they are build prerequisites, not optional.
- `PLAUSIBLE_DOMAIN` and `REPORT_ENDPOINT` env vars are optional; when unset, analytics is skipped and the report-submission button becomes a no-op.
- Licensing is split: calculation engine is MIT, site content is CC BY 4.0.
