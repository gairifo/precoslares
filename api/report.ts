// Vercel Edge Function — anonymous price-report intake.
//
// Path: POST https://precoslares.pt/api/report
//
// Why Edge runtime: faster cold start, lower cost, web-standard Request/
// Response (no Vercel-specific types). Vercel auto-deploys any .ts file
// in /api/ at the project root regardless of the Astro static build.
// No adapter required.
//
// Privacy contract (mirrors the wizard side, src/lib/report/):
//   - Receives ONLY the LarReport shape: concelho_slug, lar_slug or
//     lar_name_freetext, lar_tipo, monthly_price_eur, services_included[],
//     tenure_band, dependencia_band (coarse), submitted_at.
//   - NEVER the user's idade, pensão, dependência exata, or any
//     identificador. Validation rejects anything outside the schema.
//   - Forwards as plain-text email to REPORT_TO_EMAIL via Resend.
//     Pedro reviews every report manually during seed phase. Volume swap
//     to a DB without breaking the wizard contract.
//   - No persistent storage at this function. No cookies. No tracking.
//
// Defenses (intentionally minimal for v0; spec §6.1 anti-gaming arrives
// in Phase 2b once a baseline volume of real reports lets us detect the
// gaming pattern empirically):
//   - Origin allowlist (eliminates trivial cross-origin abuse).
//   - Schema validation (rejects malformed payloads).
//   - Conservative numeric/string bounds (rejects obvious garbage).
//   - Resend's own per-account rate limits backstop runaway sends.
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   - RESEND_API_KEY (required for delivery; without it, requests are
//     accepted and logged to Vercel function logs as a fallback).
//   - REPORT_TO_EMAIL (defaults to gairifo@gmail.com).
//   - REPORT_FROM_EMAIL (defaults to "Precoslares <onboarding@resend.dev>";
//     after verifying precoslares.pt with Resend, switch to a domain
//     address like "Precoslares <reports@precoslares.pt>").

export const config = { runtime: "edge" };

const ALLOWED_ORIGINS = new Set<string>([
  "https://precoslares.pt",
  "https://precolares.pt",          // defensive twin
  "https://www.precoslares.pt",
  "http://127.0.0.1:4321",          // local dev
  "http://localhost:4321",
]);

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const VALID_TIPOS = new Set([
  "ipss_com_acordo", "ipss_sem_acordo", "misericordia", "privado", "nao_sei",
]);
const VALID_TENURE = new Set(["lt_6m", "6m_to_1y", "1y_to_3y", "gt_3y"]);
const VALID_DEPENDENCIA = new Set([
  "nenhum_ou_1_grau", "2_grau_ou_atestado_60_plus", "nao_avaliado",
]);
const VALID_SERVICOS = new Set([
  "alimentacao", "fraldas", "medicamentos", "fisioterapia",
  "cabeleireiro", "transporte", "quarto_privado", "lavandaria", "atividades",
]);

interface ValidatedReport {
  v: 1;
  submitted_at: string;
  concelho_slug: string;
  lar_slug?: string;
  lar_name_freetext?: string;
  lar_tipo: string;
  monthly_price_eur: number;
  services_included: string[];
  tenure_band: string;
  dependencia_band?: string;
}

function isStr(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

function validate(input: unknown): ValidatedReport | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const r = input as Record<string, unknown>;

  if (r.v !== 1) return { error: "unsupported_version" };

  if (!isStr(r.concelho_slug, 50)) return { error: "invalid_concelho_slug" };
  if (!/^[a-z][a-z0-9-]{1,49}$/.test(r.concelho_slug as string)) {
    return { error: "invalid_concelho_slug_format" };
  }

  if (typeof r.lar_tipo !== "string" || !VALID_TIPOS.has(r.lar_tipo)) {
    return { error: "invalid_lar_tipo" };
  }

  if (
    typeof r.monthly_price_eur !== "number" ||
    !Number.isFinite(r.monthly_price_eur) ||
    r.monthly_price_eur < 0 ||
    r.monthly_price_eur > 50000
  ) {
    return { error: "invalid_monthly_price_eur" };
  }

  if (!Array.isArray(r.services_included)) return { error: "invalid_services_included" };
  if (r.services_included.length > 20) return { error: "too_many_services" };
  for (const s of r.services_included) {
    if (typeof s !== "string" || !VALID_SERVICOS.has(s)) {
      return { error: "invalid_service_value" };
    }
  }

  if (typeof r.tenure_band !== "string" || !VALID_TENURE.has(r.tenure_band)) {
    return { error: "invalid_tenure_band" };
  }

  if (r.dependencia_band !== undefined) {
    if (typeof r.dependencia_band !== "string" || !VALID_DEPENDENCIA.has(r.dependencia_band)) {
      return { error: "invalid_dependencia_band" };
    }
  }

  if (!isStr(r.submitted_at, 40)) return { error: "invalid_submitted_at" };
  // Accept any RFC3339-looking string; full ISO parse is overkill.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(r.submitted_at as string)) {
    return { error: "invalid_submitted_at_format" };
  }

  if (r.lar_slug !== undefined && !isStr(r.lar_slug, 100)) {
    return { error: "invalid_lar_slug" };
  }
  if (r.lar_name_freetext !== undefined && !isStr(r.lar_name_freetext, 200)) {
    return { error: "invalid_lar_name_freetext" };
  }

  return {
    v: 1,
    submitted_at: r.submitted_at as string,
    concelho_slug: r.concelho_slug as string,
    lar_slug: r.lar_slug as string | undefined,
    lar_name_freetext: r.lar_name_freetext as string | undefined,
    lar_tipo: r.lar_tipo,
    monthly_price_eur: r.monthly_price_eur,
    services_included: r.services_included as string[],
    tenure_band: r.tenure_band,
    dependencia_band: r.dependencia_band as string | undefined,
  };
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    // Stay quiet about why — don't leak the allowlist.
    return jsonResponse({ error: "forbidden" }, 403, cors);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const validated = validate(body);
  if ("error" in validated) {
    return jsonResponse(validated, 400, cors);
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const REPORT_TO_EMAIL = process.env.REPORT_TO_EMAIL || "gairifo@gmail.com";
  const REPORT_FROM_EMAIL =
    process.env.REPORT_FROM_EMAIL || "Precoslares <onboarding@resend.dev>";

  // Without Resend configured: log to Vercel function output and accept.
  // Acceptable for v0 — Pedro adds the env var, retroactive reports are
  // recoverable from logs if needed.
  if (!RESEND_API_KEY) {
    console.log("[report] RESEND_API_KEY missing — report received but not emailed:");
    console.log(JSON.stringify(validated));
    return jsonResponse({ ok: true, stored: "log_only" }, 200, cors);
  }

  const subject =
    `[precoslares] Reporte — ${validated.concelho_slug} — €${validated.monthly_price_eur}/mês (${validated.lar_tipo})`;
  const text = [
    "Novo reporte de preço (anónimo)",
    "",
    `Concelho:               ${validated.concelho_slug}`,
    `Lar:                    ${validated.lar_slug ?? validated.lar_name_freetext ?? "(não indicado)"}`,
    `Tipo:                   ${validated.lar_tipo}`,
    `Mensalidade:            €${validated.monthly_price_eur}/mês`,
    `Tempo no lar:           ${validated.tenure_band}`,
    `Serviços incluídos:     ${validated.services_included.join(", ") || "(nenhum)"}`,
    `Banda de dependência:   ${validated.dependencia_band ?? "(não indicado)"}`,
    `Submetido a:            ${validated.submitted_at}`,
    "",
    "—",
    "Para integrar no diretório, adicione manualmente em src/data/lares.json",
    "ou peça verificação ao operador antes de publicar.",
  ].join("\n");

  try {
    const resendRes = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REPORT_FROM_EMAIL,
        to: REPORT_TO_EMAIL,
        subject,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => "");
      console.error("[report] Resend rejected:", resendRes.status, errText);
      return jsonResponse({ ok: false, error: "delivery_failed" }, 502, cors);
    }

    return jsonResponse({ ok: true }, 200, cors);
  } catch (err) {
    console.error("[report] Resend network error:", err);
    return jsonResponse({ ok: false, error: "delivery_network_error" }, 502, cors);
  }
}
