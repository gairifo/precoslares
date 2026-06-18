// Maps RawEquipment (parser output) → CartaSocialLar (schema.ts shape).
//
// Rules (from plan Enhancement Summary §B5 + spec-flow findings):
// - ERPI filter: skip entries with no ERPI response. Log at WARN level.
// - Multi-tipo precedence: misericordia > ipss > cooperativa > privado
// - acordoSS: boolean (true when ERPI row has "Sim", false otherwise).
// - concelhoSlug: derived from the postal-code locality field (best-effort;
//   full concelho → distritoSlug mapping happens in the merge step).
// - distritoSlug: approximated from postal-code prefix; overridden in merge.
// - valencias: all response types present (not filtered to ERPI-only).
// - Unknown naturezaJuridica values: controlled by `allowUnknownTipo`.
//   When false (default), throws MapError. When true, maps to "privado"
//   with a warning (--allow-unknown-tipo first-run survivability flag).
//
// No slug derivation here — caller (batch scrape script) threads
// existingSlugs and calls generateLarSlug.

import slugify from "@sindresorhus/slugify";
import type { RawEquipment } from "./types";
import type { CartaSocialLar, LarValencia, LarTipo } from "../../src/lib/lares/schema";

// ── Natureza Jurídica → LarTipo mapping ──────────────────────────────
// Discovered across fixture probe runs + plan §B4.
// Add new values here if encountered during a scrape run.
const NATUREZA_TIPO_MAP: Record<string, LarTipo> = {
  // Misericórdias
  "irmandade da misericórdia / scm": "misericordia",
  "irmandade da misericordia / scm": "misericordia",
  "união das misericórdias portuguesas": "misericordia",
  "uniao das misericordias portuguesas": "misericordia",

  // IPSS variants
  "associação de solidariedade social": "ipss",
  "associacao de solidariedade social": "ipss",
  "fundação de solidariedade social": "ipss",
  "fundacao de solidariedade social": "ipss",
  "centro social paroquial": "ipss",
  "institutos de organizações religiosas": "ipss",
  "institutos de organizacoes religiosas": "ipss",
  "associação mutualista": "ipss",
  "associacao mutualista": "ipss",

  // Cooperativas
  "cooperativa de solidariedade social": "cooperativa",

  // Privado
  "sociedade comercial ou civil por quotas": "privado",
  "sociedade anónima": "privado",
  "sociedade anonima": "privado",
  "individual": "privado",
  "entidade pública empresarial": "privado",
  "entidade publica empresarial": "privado",
};

// ERPI response label (verbatim from cartasocial.pt).
const ERPI_LABEL = "Estrutura Residencial para Pessoas Idosas ( Lar de Idosos e Residência)";

// Response label → LarValencia enum value.
const VALENCIA_LABEL_MAP: Record<string, LarValencia> = {
  "estrutura residencial para pessoas idosas ( lar de idosos e residência)": "erpi",
  "estrutura residencial para pessoas idosas ( lar de idosos e residencia)": "erpi",
  "centro de dia": "centro_dia",
  "serviço de apoio domiciliário": "sad",
  "servico de apoio domiciliario": "sad",
  "centro de convívio": "centro_convivio",
  "centro de convivio": "centro_convivio",
};

// Tipo precedence: misericordia beats ipss beats cooperativa beats privado.
const TIPO_RANK: Record<LarTipo, number> = {
  misericordia: 3,
  ipss: 2,
  cooperativa: 1,
  privado: 0,
};

export class MapError extends Error {
  constructor(
    public readonly idEquipment: number,
    message: string,
  ) {
    super(`idEquipment=${idEquipment}: ${message}`);
    this.name = "MapError";
  }
}

export interface MapOptions {
  /** When true, unknown naturezaJuridica values map to "privado" + warning. */
  allowUnknownTipo?: boolean;
  /** Warn callback — defaults to console.warn. */
  warn?: (msg: string) => void;
}

/** Extract the locality part from "4700-326 BRAGA" → "BRAGA". */
export function localityFromPostalCode(codigoPostal: string): string | null {
  const m = codigoPostal.match(/\d{4}-\d{3}\s+(.+)/);
  return m ? m[1].trim() : null;
}

/**
 * Best-effort distritoSlug from the first two digits of the postal code.
 * Only populated if the prefix is in the known mapping; otherwise "unknown".
 * The merge step overwrites this from the CONCELHOS table.
 */
function distritoFromPostalCode(codigoPostal: string): string {
  const prefix = parseInt(codigoPostal.slice(0, 2), 10);
  // Azores: 9xxx, Madeira: 9xxx (9000-9499 roughly)
  if (prefix >= 90 && prefix <= 99) return "acores-ou-madeira";
  // Minimal continental mapping (overridden by merge).
  return "unknown";
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export interface MappedLar extends Omit<CartaSocialLar, "slug" | "_meta"> {
  /** Caller must populate slug via generateLarSlug. */
  slug: string;
  _meta: CartaSocialLar["_meta"];
}

/**
 * Map one RawEquipment to the CartaSocialLar shape (minus slug).
 * Returns null if the entry has no ERPI response (should be skipped).
 */
export function mapEquipment(
  raw: RawEquipment,
  options: MapOptions = {},
): MappedLar | null {
  const { allowUnknownTipo = false, warn = console.warn } = options;

  // ERPI filter: at least one response must be ERPI.
  const erpiRows = raw.respostas.filter(
    (r) => r.tipoLabel.trim() === ERPI_LABEL || normKey(r.tipoLabel) === normKey(ERPI_LABEL),
  );
  if (erpiRows.length === 0) {
    warn(`[mapper] skip idEquipment=${raw.idEquipment} "${raw.nome}": no ERPI response`);
    return null;
  }

  // Tipo derivation.
  const njKey = normKey(raw.naturezaJuridica);
  let tipo: LarTipo | undefined = NATUREZA_TIPO_MAP[njKey];
  if (!tipo) {
    if (allowUnknownTipo) {
      warn(
        `[mapper] unknown naturezaJuridica "${raw.naturezaJuridica}" (idEquipment=${raw.idEquipment}) → mapped to "privado"`,
      );
      tipo = "privado";
    } else {
      throw new MapError(
        raw.idEquipment,
        `unknown naturezaJuridica: "${raw.naturezaJuridica}". Add to NATUREZA_TIPO_MAP in mapper.ts or use --allow-unknown-tipo.`,
      );
    }
  }

  // Multi-tipo: if the equipment has multiple rows with different natureza
  // (unusual but possible), pick by precedence. Currently naturaleza is per
  // equipment, so this is defensive.
  const tipoResolved = tipo;

  // acordoSS: true if ERPI row has Sim.
  const acordoSS = erpiRows.some((r) => r.acordoSS);

  // Valencias: all response types present.
  const valenciaSet = new Set<LarValencia>();
  for (const r of raw.respostas) {
    const v = VALENCIA_LABEL_MAP[normKey(r.tipoLabel)];
    if (v) valenciaSet.add(v);
  }
  const valencias = Array.from(valenciaSet);
  if (valencias.length === 0) {
    throw new MapError(raw.idEquipment, `no mappable valencias for "${raw.nome}"`);
  }

  // Capacidade: sum of ERPI rows (plan: collapse multi-valência to one Lar,
  // capacidade = ERPI capacity only since that's what the Lar page shows).
  const capacidade = erpiRows.reduce((acc, r) => acc + (r.capacidade ?? 0), 0) || undefined;

  // Postal code / geo fields.
  const locality = raw.codigoPostal ? localityFromPostalCode(raw.codigoPostal) : null;
  const concelhoSlug = locality ? slugify(locality) : "unknown";
  const distritoSlug = raw.codigoPostal ? distritoFromPostalCode(raw.codigoPostal) : "unknown";

  const cartaSocialUrl =
    `https://www.cartasocial.pt/resultados-da-pesquisa?p_p_id=SocialLetterPortlet_WAR_cartasocialportlet` +
    `&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-2&p_p_col_count=1` +
    `&_SocialLetterPortlet_WAR_cartasocialportlet_facesViewIdRender=%2Fequipment-detail.xhtml` +
    `&_SocialLetterPortlet_WAR_cartasocialportlet_idEquipment=${raw.idEquipment}`;

  return {
    slug: "", // caller fills this via generateLarSlug
    source: "carta_social",
    nome: raw.nome,
    tipo: tipoResolved,
    acordoSS,
    valencias,
    capacidade,
    concelhoSlug,
    distritoSlug,
    morada: raw.morada ?? undefined,
    codigoPostal: raw.codigoPostal ?? undefined,
    telefone: raw.telefone ?? undefined,
    email: raw.email ?? undefined,
    website: raw.website ?? undefined,
    _meta: {
      carta_social_id: raw.idEquipment,
      carta_social_url: cartaSocialUrl,
      last_seen_at: new Date().toISOString().slice(0, 10),
    },
  };
}

export { NATUREZA_TIPO_MAP, VALENCIA_LABEL_MAP, ERPI_LABEL, TIPO_RANK };
