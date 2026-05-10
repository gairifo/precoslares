# Soft-launch checklist

Run top-to-bottom before publishing the URL anywhere. Each item is binary; tick when verified.

## Pre-deploy

- [ ] `npm test` — all tests pass (47 expected: 35 calculator + 12 permalink)
- [ ] `npm run build` — passes with zero warnings; `dist/` exists
- [ ] `npm run schema:emit` — `public/schema/apoios-input.json` regenerated
- [ ] No accidental `SECRET_*` import in client code:
  ```
  grep -rE "import\.meta\.env\.(?!PUBLIC_|PLAUSIBLE_DOMAIN)" src/components src/pages src/layouts
  # → must return nothing
  ```
- [ ] No leftover `console.log` in `src/components/Wizard.tsx`:
  ```
  grep -n "console\." src/components/Wizard.tsx
  # → must return nothing
  ```
- [ ] Phase 0 calculator engine is still pure — no DOM access in code:
  ```
  # Match identifiers, not the words "window"/"fetch" inside comments.
  grep -rEn "^[^/]*\b(window\.|document\.|localStorage|fetch\()" src/lib/calculator | grep -v "^Binary file"
  # → must return nothing
  ```
- [ ] **IAS 2026 reconciled.** The actual DR-published Portaria de atualização do IAS 2026 has been verified, and `src/lib/calculator/constants_2026.json` reflects it. Tests updated. (BLOCKER FOR PHASE C content; can launch Phase 1 without C if intentional.)

## Hosting & domain

- [ ] Domain `precoslares.pt` (or chosen alt) registered.
- [ ] Hosting set up (Cloudflare Pages or Vercel).
- [ ] DNS A/AAAA pointed at host.
- [ ] HTTPS certificate provisioned (auto on both providers).
- [ ] Custom domain bound to Cloudflare Pages project / Vercel project.
- [ ] `_headers` (Cloudflare) or `vercel.json` headers active in prod (verify in browser DevTools → Network → Headers).

## Analytics

- [ ] Plausible site created at `plausible.io` (paid plan or trial).
- [ ] `PLAUSIBLE_DOMAIN=precoslares.pt` set in **Vercel → Project → Settings → Environment Variables** (Production + Preview).
- [ ] Re-deploy.
- [ ] Open site in incognito: `<script src="https://plausible.io/js/script.js">` is in DOM.
- [ ] Plausible dashboard shows 1 visitor.
- [ ] **Network tab:** the POST to `https://plausible.io/api/event` carries `u: "https://precoslares.pt/calculadora"` (pathname only — NEVER `#i=...`).

## Price-report endpoint (Vercel + Resend)

- [ ] Resend account created at `resend.com`. Free tier (100/day, 3,000/month) is enough for v0.
- [ ] **API key generated** in Resend (Dashboard → API Keys → Create).
- [ ] In Vercel → Project → Settings → Environment Variables (Production + Preview), add:
  - `RESEND_API_KEY` = the key from Resend
  - `REPORT_ENDPOINT` = `https://precoslares.pt/api/report` (the wizard reads this client-side; same-origin POST)
  - `REPORT_TO_EMAIL` = `gairifo@gmail.com` (or your preferred inbox)
  - Optional: `REPORT_FROM_EMAIL` (defaults to `Precoslares <onboarding@resend.dev>` — works without domain verification)
- [ ] Re-deploy.
- [ ] **Verify domain in Resend** (optional but recommended for deliverability) — Resend → Domains → Add → `precoslares.pt` → add the SPF/DKIM/DMARC DNS records at your registrar (dominios.pt). After verification, change `REPORT_FROM_EMAIL` to e.g. `Precoslares <reports@precoslares.pt>`.
- [ ] **End-to-end test on a phone in incognito:**
  - Open https://precoslares.pt/calculadora
  - Stage 1: idade 80, regime geral, pensão 800, viúvo, semi-dependente
  - Stage 2: situação = "Num lar privado", concelho = lisboa, mensalidade = 1500, services tick a few, tenure 6m-1y, leave opt-in checked
  - Click "Calcular apoios →"
  - Result page shows "Obrigada por contribuir" banner
  - Email arrives at `REPORT_TO_EMAIL` within ~30s with the structured fields
- [ ] **Cross-origin block test:** `curl -sw "%{http_code}\n" -X POST https://precoslares.pt/api/report -H "Origin: https://example.com" -H "Content-Type: application/json" -d '{}'` → `403`.
- [ ] **Schema validation test:** `curl -sw "%{http_code}\n" -X POST https://precoslares.pt/api/report -H "Origin: https://precoslares.pt" -H "Content-Type: application/json" -d '{"v":1,"concelho_slug":"lisboa","lar_tipo":"BOGUS","monthly_price_eur":-99,"services_included":[],"tenure_band":"x","submitted_at":"2026-01-01T00:00:00Z"}'` → `400` with `{"error":"invalid_lar_tipo"}`.

## Sustainable data ingest (post-launch task)

- [ ] Email `cartasocial@gep.mtsss.pt` requesting research / public-utility data agreement for the full Carta Social ERPI dataset (~2,700 records). Frame as: independent public-utility site, no commercial use, source attribution, ready to sign a memorandum. Slow but the right way.
- [ ] In parallel: as price reports arrive via wizard, batch them weekly into `src/data/lares.json`. Spec §6 notes the trimmed-mean + ≥10/concelho threshold; until that volume, individual reports stay in your inbox for manual review.

## Permalink end-to-end

- [ ] On phone: open `https://precoslares.pt/calculadora` → fill in baseline scenario → submit → click "Copiar link".
- [ ] On desktop in incognito: paste link → result page shows the same numbers.
- [ ] On the same desktop: paste a corrupted link (truncate the hash by 5 chars) → "Link inválido" banner appears, no crash.
- [ ] Plausible dashboard shows `permalink_copied`, `permalink_loaded`, `permalink_invalid` events.
- [ ] `calculator_completed` count equals (rough) number of fresh wizard submissions, NOT inflated by permalink opens.

## Print / PDF

- [ ] iOS Safari: open result page → Share → Print → pinch to PDF. The 3 expanded `<details>` show open. No header chrome.
- [ ] Android Chrome: same end-to-end.
- [ ] Desktop Firefox: print preview shows expanded details, no nav/footer chrome, "valores de 2026" banner visible, page-break sensible.

## Reportar erro

- [ ] Tap "Reportar erro nesta página" on mobile → mail app opens with subject "[precoslares] Erro em /<page>" and body containing only the page path.
- [ ] **Verify the body does NOT contain the permalink hash.**
- [ ] "Copiar email" fallback button copies `gairifo@gmail.com` to clipboard.

## SEO / structured data

- [ ] `https://precoslares.pt/sitemap-index.xml` resolves and lists all routes.
- [ ] `https://precoslares.pt/robots.txt` allows all + references sitemap.
- [ ] [Schema.org validator](https://validator.schema.org/) green on:
  - `https://precoslares.pt/`
  - `https://precoslares.pt/calculadora`
- [ ] `<html lang="pt-PT">` present everywhere.
- [ ] `<link rel="alternate" hreflang="pt-pt">` present everywhere.

## Security headers

Use [securityheaders.com](https://securityheaders.com/) on the deployed URL — target ≥ A grade. Specifically verify:

- [ ] `Content-Security-Policy` with `script-src 'self' https://plausible.io` and `frame-ancestors 'none'`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` blocks geolocation/microphone/camera

## Mobile

- [ ] iOS Safari (real device or simulator): all forms render, all selects work, "Copiar link" works.
- [ ] Android Chrome (real device or emulator): same.
- [ ] Lighthouse mobile audit ≥ 95 on Performance, Accessibility, Best Practices, SEO.

## Soft launch

- [ ] Personal post on LinkedIn (in PT) — link + 1 paragraph why.
- [ ] Reddit r/portugal post (off-peak, weekday morning).
- [ ] 2 Facebook groups for cuidadores informais (search "cuidadores informais portugal").
- [ ] WhatsApp to 5 friends/family for direct feedback.
- [ ] Monitor Plausible dashboard daily for first week.
- [ ] Triage `gairifo@gmail.com` inbox daily for first week.

## Post-launch (week 1)

- [ ] Track success metrics from roadmap §Phase 1:
  - Unique users (target: 500 in 30 days)
  - Calculator-completion rate (target: ≥ 50%)
  - `permalink_copied` count (target: ≥ 100)
  - Unsolicited testimonials (target: ≥ 3)
- [ ] Update plan status to `completed` if metrics on track.
- [ ] Run `gh issue create` (or equivalent) for any reported bugs.
