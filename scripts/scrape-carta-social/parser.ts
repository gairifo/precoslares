// HTML parser for cartasocial.pt equipment detail pages.
//
// Input:  raw HTML string from an equipment-detail.xhtml GET response.
// Output: RawEquipment (field extraction only — no tipo derivation, no slugs).
//
// Selector strategy: confirmed `<label>Field Name</label><p>value</p>`
// sibling pattern for institutional fields; PrimeFaces DataTable for the
// Respostas Sociais section. Both patterns are stable across the Liferay
// JSF shell — they live inside `.portlet-body` of the SocialLetterPortlet.
//
// NOTE: These fixtures were created during a temporary Carta Social service
// outage (2026-05-11). Selectors should be validated against live pages
// once the service is restored.

import * as cheerio from "cheerio";
import type { ParseResult, RawEquipment, RawResponse } from "./types";

// The Liferay portlet-level container id prefix.
const PORTLET_BODY_SEL = ".portlet-body";

// Strings indicating non-data responses.
const NOT_FOUND_MARKER = "informação requerida não está disponível";
const SERVICE_ERROR_MARKER = "temporariamente indisponível";

const RESPONSE_COLUMN_LABELS = {
  tipoLabel: ["Resposta Social"],
  capacidade: ["Capacidade"],
  vagas: ["Vagas"],
  utentes: ["Utentes"],
  horario: ["Horário de Funcionamento", "Horário"],
  acordo: ["Acordo com SS", "Acordo"],
  ultimaAtualizacao: ["Última Atualização", "Ultima Actualização"],
} as const;

/** Look up a label by case-insensitive text, return the next sibling <p> text. */
function labelValue($: cheerio.CheerioAPI, ctx: cheerio.Cheerio<cheerio.AnyNode>, labelText: string): string | null {
  const matched = $("label", ctx).filter((_, el) =>
    $(el).text().trim().toLowerCase().includes(labelText.toLowerCase()),
  );
  if (!matched.length) return null;
  const p = matched.first().next("p");
  if (!p.length) return null;
  const val = p.text().trim();
  return val && val !== "-" ? val : null;
}

/** Find column index by matching any of the candidate header strings. */
function colIdx(headers: string[], candidates: readonly string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/\s/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseAcordo(s: string | undefined): boolean {
  return s?.trim().toLowerCase() === "sim";
}

export function parseEquipmentHtml(html: string, idEquipment: number): ParseResult {
  const $ = cheerio.load(html);

  // Detect error pages before any extraction.
  const bodyText = $(PORTLET_BODY_SEL).text();
  if (bodyText.includes(NOT_FOUND_MARKER)) {
    return { ok: false, reason: "not_found" };
  }
  if (bodyText.includes(SERVICE_ERROR_MARKER)) {
    return { ok: false, reason: "service_error" };
  }

  // Use the SocialLetterPortlet section as root to avoid picking up
  // header/footer labels from the page shell.
  const portlet = $(
    "#p_p_id_SocialLetterPortlet_WAR_cartasocialportlet_, .portlet-boundary_SocialLetterPortlet_WAR_cartasocialportlet_",
  );
  const ctx = portlet.length ? portlet : $("body");

  // Facility name — first h2 inside the portlet body.
  const nome = $(`${PORTLET_BODY_SEL} h2`, ctx).first().text().trim();
  if (!nome) {
    return {
      ok: false,
      reason: "parse_error",
      detail: `idEquipment=${idEquipment}: no h2 found in portlet-body`,
    };
  }

  const naturezaJuridica = labelValue($, ctx, "Natureza Jurídica") ?? labelValue($, ctx, "Natureza Juridica");
  if (!naturezaJuridica) {
    return {
      ok: false,
      reason: "parse_error",
      detail: `idEquipment=${idEquipment}: Natureza Jurídica label not found`,
    };
  }

  const entidadeProprietaria = labelValue($, ctx, "Entidade Proprietária") ?? labelValue($, ctx, "Entidade Proprietaria");
  const morada = labelValue($, ctx, "Morada");
  const codigoPostal = labelValue($, ctx, "Código Postal") ?? labelValue($, ctx, "Codigo Postal");
  const telefone = labelValue($, ctx, "Telefone");

  // Email: may be wrapped in an <a href="mailto:..."> inside the <p>.
  const emailLabel = $("label", ctx).filter((_, el) =>
    $(el).text().trim().toLowerCase().includes("e-mail") ||
    $(el).text().trim().toLowerCase().includes("email"),
  ).first();
  const emailRaw = emailLabel.next("p").text().trim();
  const email = emailRaw && emailRaw !== "-" ? emailRaw : null;

  // Website: may be wrapped in an <a href="..."> inside the <p>.
  const websiteLabel = $("label", ctx).filter((_, el) =>
    $(el).text().trim().toLowerCase() === "website",
  ).first();
  const websiteRaw = websiteLabel.next("p").find("a").attr("href") ??
    websiteLabel.next("p").text().trim();
  const website = websiteRaw && websiteRaw !== "-" ? websiteRaw : null;

  // Respostas Sociais table — PrimeFaces DataTable.
  const table = $(".ui-datatable table", ctx);
  const respostas: RawResponse[] = [];

  if (table.length) {
    const headers = table
      .find("thead th")
      .map((_, th) => {
        const span = $(th).find(".ui-column-title");
        return (span.length ? span.text() : $(th).text()).trim();
      })
      .get() as string[];

    const cols = {
      tipoLabel: colIdx(headers, RESPONSE_COLUMN_LABELS.tipoLabel),
      capacidade: colIdx(headers, RESPONSE_COLUMN_LABELS.capacidade),
      vagas: colIdx(headers, RESPONSE_COLUMN_LABELS.vagas),
      utentes: colIdx(headers, RESPONSE_COLUMN_LABELS.utentes),
      horario: colIdx(headers, RESPONSE_COLUMN_LABELS.horario),
      acordo: colIdx(headers, RESPONSE_COLUMN_LABELS.acordo),
      ultimaAtualizacao: colIdx(headers, RESPONSE_COLUMN_LABELS.ultimaAtualizacao),
    };

    table.find("tbody tr").each((_, tr) => {
      const cells = $(tr)
        .find("td")
        .map((_, td) => $(td).text().trim())
        .get() as string[];

      const tipoLabel = cols.tipoLabel >= 0 ? cells[cols.tipoLabel] : "";
      if (!tipoLabel) return;

      respostas.push({
        tipoLabel,
        capacidade: parseNumber(cols.capacidade >= 0 ? cells[cols.capacidade] : undefined),
        vagas: parseNumber(cols.vagas >= 0 ? cells[cols.vagas] : undefined),
        utentes: parseNumber(cols.utentes >= 0 ? cells[cols.utentes] : undefined),
        horario: cols.horario >= 0 && cells[cols.horario] ? cells[cols.horario] : null,
        acordoSS: parseAcordo(cols.acordo >= 0 ? cells[cols.acordo] : undefined),
        ultimaAtualizacao: cols.ultimaAtualizacao >= 0 && cells[cols.ultimaAtualizacao]
          ? cells[cols.ultimaAtualizacao]
          : null,
      });
    });
  }

  const equipment: RawEquipment = {
    idEquipment,
    nome,
    naturezaJuridica,
    entidadeProprietaria,
    morada,
    codigoPostal,
    telefone,
    email,
    website,
    respostas,
  };

  return { ok: true, equipment };
}
