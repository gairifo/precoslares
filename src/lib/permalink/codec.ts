// Positional-CSV permalink codec.
//
// Format: `v,c,idade,tipo_pensao,valor_pensao_mensal,outros_rendimentos_anuais,
//          estado_civil,valor_pensao_conjuge,outros_rendimentos_conjuge,
//          residencia_pt_anos,grau_dependencia,tem_atestado_multiusos,
//          grau_incapacidade,situacao_residencia,mensalidade_lar,municipio,
//          regime_especial,quem_paga_fatura,nif_idoso_em_agregado,
//          tem_cuidador_informal`
//
// Rationale (see plan §Enhancement Summary #2): for ~10 short fields,
// positional CSV produces 30–80 char URLs without any compression
// dependency. Schema is FROZEN — adding a field is OK (decoder fills as
// null), but RENAMING or REORDERING requires bumping `v` to 2 and adding
// a migrator path.
//
// Field order MUST match the FIELDS array below and the order in
// src/lib/calculator/types.ts:ApoiosInput. The schema-stability test
// (snapshot) catches accidental drift in CI.
//
// Encoding rules per field:
//   number | null         → "" for null, otherwise toString()
//   string enum | null    → "" for null, otherwise the string value
//   boolean | null        → "" for null, "1" for true, "0" for false
//   string | null         → URL-encoded for safety; "" for null
//
// We use semicolons as separators because municipio strings could
// theoretically contain commas; semicolons are extremely rare in PT
// place names and are URL-safe in fragments.

import type { ApoiosInput } from "../calculator/types";

export const PERMALINK_VERSION = 1;

/** Frozen schema. Adding a field at the END is forward-compatible.
 *  Renaming, reordering, or removing requires a `v` bump. */
export const FIELDS = [
  "idade",
  "tipo_pensao",
  "valor_pensao_mensal",
  "outros_rendimentos_anuais",
  "estado_civil",
  "valor_pensao_conjuge",
  "outros_rendimentos_conjuge",
  "residencia_pt_anos",
  "grau_dependencia",
  "tem_atestado_multiusos",
  "grau_incapacidade",
  "situacao_residencia",
  "mensalidade_lar",
  "municipio",
  "regime_especial",
  "quem_paga_fatura",
  "nif_idoso_em_agregado",
  "tem_cuidador_informal",
] as const satisfies ReadonlyArray<keyof ApoiosInput>;

const SEP = ";";
const PREFIX = "i=";

function encodeField(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return encodeURIComponent(String(v));
}

function decodeField(s: string, kind: "number" | "boolean" | "string"): unknown {
  if (s === "") return null;
  switch (kind) {
    case "number": {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return s === "1" ? true : s === "0" ? false : null;
    case "string":
      return decodeURIComponent(s);
  }
}

const FIELD_KINDS: Record<(typeof FIELDS)[number], "number" | "boolean" | "string"> = {
  idade: "number",
  tipo_pensao: "string",
  valor_pensao_mensal: "number",
  outros_rendimentos_anuais: "number",
  estado_civil: "string",
  valor_pensao_conjuge: "number",
  outros_rendimentos_conjuge: "number",
  residencia_pt_anos: "number",
  grau_dependencia: "string",
  tem_atestado_multiusos: "boolean",
  grau_incapacidade: "number",
  situacao_residencia: "string",
  mensalidade_lar: "number",
  municipio: "string",
  regime_especial: "string",
  quem_paga_fatura: "string",
  nif_idoso_em_agregado: "boolean",
  tem_cuidador_informal: "boolean",
};

export interface RawPayload {
  v: number;
  c: string;
  raw: Record<string, unknown>;
}

/** Encode v=1 payload. Caller is responsible for validating input shape. */
export function encodePayload(input: ApoiosInput, constantsVersion: string): string {
  const parts: string[] = [
    String(PERMALINK_VERSION),
    encodeURIComponent(constantsVersion),
  ];
  for (const f of FIELDS) {
    parts.push(encodeField((input as Record<string, unknown>)[f]));
  }
  return PREFIX + parts.join(SEP);
}

/** Decode a hash fragment. Returns the raw shape (numbers/strings/booleans/null
 *  per the field-kinds table). Validation happens in validator.ts. */
export function decodePayload(hash: string):
  | { ok: true; payload: RawPayload }
  | { ok: false; kind: "malformed" | "unknown_version"; v?: number } {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed.startsWith(PREFIX)) return { ok: false, kind: "malformed" };

  const body = trimmed.slice(PREFIX.length);
  const parts = body.split(SEP);
  if (parts.length < 2) return { ok: false, kind: "malformed" };

  const v = Number(parts[0]);
  if (!Number.isFinite(v)) return { ok: false, kind: "malformed" };
  if (v !== PERMALINK_VERSION) return { ok: false, kind: "unknown_version", v };

  let c: string;
  try {
    c = decodeURIComponent(parts[1] ?? "");
  } catch {
    return { ok: false, kind: "malformed" };
  }

  const raw: Record<string, unknown> = {};
  for (let i = 0; i < FIELDS.length; i++) {
    const field = FIELDS[i];
    const slot = parts[2 + i] ?? "";
    try {
      raw[field] = decodeField(slot, FIELD_KINDS[field]);
    } catch {
      return { ok: false, kind: "malformed" };
    }
  }

  return { ok: true, payload: { v, c, raw } };
}

/** Hard cap per Enhancement Summary §1.7 / §plan B1. Messengers truncate
 *  longer URLs. With 18 short fields this should comfortably stay under. */
export const MAX_HASH_LENGTH = 1800;
