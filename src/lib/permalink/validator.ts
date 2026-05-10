// Hand-rolled validator for ApoiosInput from a decoded permalink payload.
//
// Per Enhancement Summary §1: we DO NOT use Zod at the client runtime.
// This module is the single boundary that turns untrusted hash content
// into a typed `ApoiosInput`. Any field that fails validation falls back
// to null (the canonical "unknown" value across the calculator engine).
//
// Hard rejections (returns ok:false): only the structural cases. Field-
// level garbage degrades to null silently — the calculator engine
// handles nulls gracefully and the user can always edit the form.
//
// Acceptance rules per field:
//   idade               integer 0..120 (required > 0 to be useful, but
//                       we accept 0 to keep round-trip strict)
//   tipo_pensao         must match enum
//   valor_*_mensal      number 0..50_000  (€/mês, generous upper bound)
//   outros_rendimentos_anuais  number 0..1_000_000
//   estado_civil        must match enum
//   residencia_pt_anos  integer 0..120
//   grau_dependencia    must match enum
//   tem_atestado_multiusos  boolean
//   grau_incapacidade   integer 0..100
//   situacao_residencia must match enum
//   mensalidade_lar     number 0..50_000
//   municipio           string, max 80 chars (matches the mailto path
//                       allowlist budget)
//   regime_especial     must match enum
//   quem_paga_fatura    must match enum
//   nif_idoso_em_agregado boolean
//   tem_cuidador_informal boolean

import type {
  ApoiosInput,
  EstadoCivil,
  GrauDependencia,
  QuemPagaFatura,
  RegimeEspecial,
  SituacaoResidencia,
  TipoPensao,
} from "../calculator/types";
import { FIELDS } from "./codec";

/** Snapshot exported for the schema-stability test in __tests__. If this
 *  list changes, every existing permalink breaks. Bump PERMALINK_VERSION
 *  in codec.ts and add a migrator. */
export const VALIDATOR_FIELDS = [...FIELDS] as const;

const TIPO_PENSAO_VALUES: readonly TipoPensao[] = [
  "regime_geral",
  "regime_agricola",
  "nao_contributivo_social",
  "prestacao_social_inclusao",
  "nenhuma",
];
const ESTADO_CIVIL_VALUES: readonly EstadoCivil[] = [
  "solteiro", "casado", "uniao_facto", "viuvo", "divorciado",
];
const GRAU_DEP_VALUES: readonly GrauDependencia[] = [
  "nenhum", "1_grau", "2_grau", "nao_avaliado",
];
const SITUACAO_VALUES: readonly SituacaoResidencia[] = [
  "casa_propria", "casa_filho_familiar", "apoio_domiciliario",
  "lar_privado", "lar_ipss_acordo", "lar_ipss_sem_acordo", "procura_lar",
];
const REGIME_VALUES: readonly RegimeEspecial[] = [
  "nenhum", "adse", "iasfa_adm", "sad_psp", "outro",
];
const QUEM_PAGA_VALUES: readonly QuemPagaFatura[] = [
  "idoso", "filhos", "partilhada",
];

function asInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return Math.trunc(v);
}
function asNum(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}
function asEnum<T extends string>(v: unknown, values: readonly T[]): T | null {
  return typeof v === "string" && (values as readonly string[]).includes(v)
    ? (v as T)
    : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asStr(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  if (v.length === 0 || v.length > maxLen) return null;
  return v;
}

export interface ValidationFailure {
  ok: false;
  kind: "validation_failed";
  reason: string;
}

export function validateAndCoerce(
  raw: Record<string, unknown>
): { ok: true; input: ApoiosInput } | ValidationFailure {
  const idade = asInt(raw.idade, 0, 120);
  if (idade == null) {
    return {
      ok: false,
      kind: "validation_failed",
      reason: "idade obrigatória (0–120)",
    };
  }

  const input: ApoiosInput = {
    idade,
    tipo_pensao: asEnum(raw.tipo_pensao, TIPO_PENSAO_VALUES),
    valor_pensao_mensal: asNum(raw.valor_pensao_mensal, 0, 50_000),
    outros_rendimentos_anuais: asNum(raw.outros_rendimentos_anuais, 0, 1_000_000),
    estado_civil: asEnum(raw.estado_civil, ESTADO_CIVIL_VALUES),
    valor_pensao_conjuge: asNum(raw.valor_pensao_conjuge, 0, 50_000),
    outros_rendimentos_conjuge: asNum(raw.outros_rendimentos_conjuge, 0, 1_000_000),
    residencia_pt_anos: asInt(raw.residencia_pt_anos, 0, 120),
    grau_dependencia: asEnum(raw.grau_dependencia, GRAU_DEP_VALUES),
    tem_atestado_multiusos: asBool(raw.tem_atestado_multiusos),
    grau_incapacidade: asInt(raw.grau_incapacidade, 0, 100),
    situacao_residencia: asEnum(raw.situacao_residencia, SITUACAO_VALUES),
    mensalidade_lar: asNum(raw.mensalidade_lar, 0, 50_000),
    municipio: asStr(raw.municipio, 80),
    regime_especial: asEnum(raw.regime_especial, REGIME_VALUES),
    quem_paga_fatura: asEnum(raw.quem_paga_fatura, QUEM_PAGA_VALUES),
    nif_idoso_em_agregado: asBool(raw.nif_idoso_em_agregado),
    tem_cuidador_informal: asBool(raw.tem_cuidador_informal),
  };

  return { ok: true, input };
}
