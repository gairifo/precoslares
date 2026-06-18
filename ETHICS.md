# Ethics — precoslares.pt data collection

This document describes how, why, and under what limits the
**PrecoslaresBot** collects data from third-party sources.

It is the public-facing companion to [/bot](https://precoslares.pt/bot).

## Why we collect

precoslares.pt is a free public-utility website that helps Portuguese
families navigate eldercare. To be useful it needs a complete directory
of Portuguese eldercare facilities (lares de idosos) — names, locations,
type (IPSS / Misericórdia / private), and whether they hold an acordo
with Segurança Social.

That data is already publicly published by the Portuguese government
through Carta Social (cartasocial.pt), operated by GEP/MTSSS. Reusing
it for a public-interest project is explicitly contemplated by Portuguese
law on access to administrative documents (LADA, Lei n.º 26/2016, Art. 7º
"Direito de reutilização").

## How we collect

- **Polite by default.** 1 request every 2.5 seconds, single concurrency
  per host. Lower than most browser sessions.
- **robots.txt is respected.** Always. Without exception.
- **Conditional requests.** Cache aggressively; revalidate with
  `If-None-Match` / `If-Modified-Since`. Most refresh runs transfer
  only changed pages.
- **Retry-After is honored.** A 429 or 503 with a `Retry-After` header
  pauses the queue for that duration.
- **Auto-stop.** If error rate exceeds 5% on any run, the scraper stops
  and surfaces the error for human review.
- **No login walls bypassed.** Public, anonymous pages only.

## User-Agent

```
PrecoslaresBot/1.0 (+https://precoslares.pt/bot; gairifo@gmail.com)
```

Both the URL and the email lead to a human (Pedro Santos) who responds
within 1 business day.

## How to block us

Add to your `robots.txt`:

```
User-agent: PrecoslaresBot
Disallow: /
```

Or email `gairifo@gmail.com`. We will remove your source from the next
run and never crawl it again.

## What we publish

- The dataset is published as JSON at `/data/lares.json` under the
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  license.
- Every record retains attribution to the source via
  `_meta.carta_social_url` (deep link to the original ficha).
- A JSON Schema is published at `/schema/lares.json` so other agents
  and aggregators can validate our shape.
- Per-facility pages link back to the Carta Social entry.

## What we do not do

- We do not sell data.
- We do not sell leads.
- We do not accept payment from eldercare operators for ranking,
  visibility, or removal.
- We do not store PII. The calculator runs entirely in the browser.

## Contact

Pedro Santos — `gairifo@gmail.com`

For takedown requests, see [LEGAL.md](LEGAL.md).
