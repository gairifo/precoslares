# Maintainers — precoslares.pt

Operational guide for whoever runs the data pipeline.

## Roles

- **Operator** — Pedro Santos (`gairifo@gmail.com`). Owns the domain,
  receives takedown requests, decides scope.
- **Co-maintainers** — none currently. PRs welcome via
  github.com/gairifo/precoslares.

## Scrape cadence

- **Full re-scrape**: 1× per quarter (Jan / Apr / Jul / Oct).
- **Incremental refresh**: weekly, only for entries whose
  `_meta.last_seen_at` is older than 14 days.
- **Operator-triggered**: any record whose `source: operator_claim`
  flips updates immediately on the next build (no scrape needed).

## When a takedown email arrives

Standard PT response (paste into reply, fill in `[brackets]`):

> Olá,
>
> Obrigado pela mensagem. O precoslares.pt é um projeto público sem
> fins lucrativos. A entrada referente a **[nome do lar]** foi
> registada para remoção e deixará de aparecer na próxima publicação
> (tipicamente 24–48 h).
>
> Como a remoção é definitiva, a URL devolverá HTTP 410 (Gone) a
> partir desse momento.
>
> Se preferir corrigir um facto em vez de remover, basta indicar o
> campo correcto e procedemos à edição na próxima ronda.
>
> Com os melhores cumprimentos,
> Pedro Santos

Steps:

1. Open `src/data/lares.tombstones.json`.
2. Add `{ "slug": "<slug>", "removedAt": "<ISO date>", "reason": "<short reason>" }`.
3. Commit and push. The `prebuild` step regenerates `_headers` /
   `vercel.json` rules so the URL returns 410.
4. Reply to the operator confirming.

## When a build fails

Most likely cause: a new lar nome that the slug algorithm cannot
cascade past, or a Carta Social field shape change.

- Slug cascade exhausted: read the failing record in the merge report
  (`scripts/lares-data/merge-report.json`). Add a tombstone or rename
  the existing entry, whichever is correct.
- Carta Social shape changed: regenerate fixtures in
  `scripts/scrape-carta-social/__tests__/fixtures/` from a fresh
  page-source capture, re-run parser tests.

## Annual refresh

Once a year:

- Audit operator-claim emails for staleness.
- Verify the legal posture in `LEGAL.md` still matches the
  state of LADA / EU sui generis case law.
- Refresh the CC BY-SA attribution text in `_meta.attribution_text`.

See [docs/AUTHORING.md](docs/AUTHORING.md) for content updates.
