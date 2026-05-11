# Legal — precoslares.pt

This document covers the legal posture of the precoslares.pt dataset and
the operating limits of the PrecoslaresBot. It is informational; nothing
here constitutes legal advice.

## Operator

Pedro Santos — `gairifo@gmail.com` — Portugal.
Non-commercial, public-utility project. No corporate entity.

## Source of the dataset

The eldercare facility directory is built from:

1. **Carta Social** (cartasocial.pt) — public registry of social
   equipment operated by GEP / MTSSS, the Portuguese
   Ministry of Labour, Solidarity and Social Security.
2. **Hand-curated entries** based on operator websites, IPSS price
   tables, and Misericórdia public listings.
3. **Verified operator self-claims** (Phase 2.8 — operators can claim
   their listing and update fields).

## Why we believe reuse is lawful

### 1. Right of reuse — LADA Art. 7º

Lei n.º 26/2016 ("Lei de Acesso aos Documentos Administrativos e
Reutilização"), Article 7, establishes a **right of reuse** of
administrative documents held by public bodies, for purposes including
commercial and non-commercial use, subject only to:

- attribution of the source;
- preservation of integrity (no falsification);
- compliance with personal-data protection.

GEP / MTSSS, as the operator of Carta Social, is a public administrative
body in the sense of LADA Art. 4º. Carta Social data is administrative
data financed by taxpayers.

### 2. EU sui generis database right — defanged for taxpayer-funded data

The CJEU decision in **C-762/19 (CV-Online Latvia)** clarified that the
sui generis right (Directive 96/9/EC) does not allow database makers to
block re-utilization that does not harm investment recoupment. Carta
Social investment is recouped through public funding, not through
exclusive licensing.

### 3. No copyright over facts

Names, addresses, types, and capacities of public facilities are facts.
Facts are not subject to copyright (Berne Convention Art. 2(8); CDADC
Art. 7). The presentation of facts may be, but we extract data, not
presentation.

### 4. No personal-data processing

The directory contains only **facility data** (legal-entity names,
public phones, public addresses). No personal data of residents or
employees is processed.

## Attribution

Each record in our dataset carries:

- `_meta.carta_social_url` — deep link to the original ficha.
- `_meta.alvara` — the alvará (operating licence) number, when known.
- `_meta.last_seen_at` — ISO date of the last successful scrape.

The dataset top-level `_meta` carries:

- `_meta.source` — "Carta Social, GEP/MTSSS, cartasocial.pt".
- `_meta.license` — "CC BY-SA 4.0".
- `_meta.attribution_text` — the recommended attribution string.

## Our dataset license

The precoslares.pt directory is published under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Anyone
may copy, redistribute, remix, and build upon it, provided that:

- attribution is preserved;
- derivative works are licensed under the same terms.

## Takedown requests

If you operate a listed facility and want to:

- **Correct a fact** — email `gairifo@gmail.com`. We typically respond
  within 1 business day and ship the fix in the next build.
- **Remove your listing** — email with the operating-entity name and the
  alvará number. We will tombstone the URL (HTTP 410 Gone forever) and
  exclude the entry from future scrapes.

If you operate a source we crawl (e.g. cartasocial.pt) and want us to
stop, add `User-agent: PrecoslaresBot` / `Disallow: /` to your
`robots.txt` or email us. We will pause the next run.

## Limitation of liability

The data is provided "as is" with no warranty. Eldercare placement
decisions should be confirmed directly with the facility and the
relevant Segurança Social services. precoslares.pt accepts no liability
for decisions made on the basis of this dataset.
