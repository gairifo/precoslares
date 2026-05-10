// ── Public input ────────────────────────────────────────────────────────
//
// Every field is optional except `idade`. The calculator handles `null` /
// `undefined` gracefully, returning `não_avaliado` for apoios it cannot
// evaluate without that field.

export type TipoPensao =
  | "regime_geral"
  | "regime_agricola"
  | "nao_contributivo_social"
  | "prestacao_social_inclusao"
  | "nenhuma";

export type EstadoCivil =
  | "solteiro"
  | "casado"
  | "uniao_facto"
  | "viuvo"
  | "divorciado";

export type GrauDependencia = "nenhum" | "1_grau" | "2_grau" | "nao_avaliado";

export type SituacaoResidencia =
  | "casa_propria"
  | "casa_filho_familiar"
  | "apoio_domiciliario"
  | "lar_privado"
  | "lar_ipss_acordo"
  | "lar_ipss_sem_acordo"
  | "procura_lar";

export type RegimeEspecial =
  | "nenhum"
  | "adse"
  | "iasfa_adm"
  | "sad_psp"
  | "outro";

export type QuemPagaFatura = "idoso" | "filhos" | "partilhada";

export interface ApoiosInput {
  // Stage 1 — calculator inputs
  idade: number;
  tipo_pensao?: TipoPensao | null;
  valor_pensao_mensal?: number | null;
  outros_rendimentos_anuais?: number | null;

  estado_civil?: EstadoCivil | null;
  valor_pensao_conjuge?: number | null;
  outros_rendimentos_conjuge?: number | null;

  residencia_pt_anos?: number | null;

  grau_dependencia?: GrauDependencia | null;
  tem_atestado_multiusos?: boolean | null;
  grau_incapacidade?: number | null;          // 0–100

  situacao_residencia?: SituacaoResidencia | null;
  mensalidade_lar?: number | null;
  municipio?: string | null;                  // freguesia/concelho code or slug

  regime_especial?: RegimeEspecial | null;

  // IRS routing
  quem_paga_fatura?: QuemPagaFatura | null;
  nif_idoso_em_agregado?: boolean | null;     // "vive em comunhão de habitação"

  // Cuidador informal
  tem_cuidador_informal?: boolean | null;
}

// ── Output ──────────────────────────────────────────────────────────────

export type Elegibilidade =
  | "certa"
  | "provavel"
  | "possivel"
  | "nao_elegivel"
  | "nao_avaliado";

export interface ApoioOutput {
  id: string;
  nome: string;
  elegibilidade: Elegibilidade;
  valor_mensal_eur: number | null;
  valor_anual_eur: number | null;
  /** Range when a single number is misleading. */
  valor_anual_min_eur?: number | null;
  valor_anual_max_eur?: number | null;
  /** 0–1 confidence in the estimate. */
  confianca: number;
  /** One-line plain-Portuguese explanation of *why* this is the result. */
  explicacao: string;
  /** Internal rule id that produced the result (for debugging / audit). */
  regra_aplicada: string;
  /** Human-readable list of the constants used. */
  constantes_usadas?: string[];
  /** What the user should do next, in one short imperative sentence. */
  proximo_passo: string;
  formulario_link?: string | null;
  tempo_resposta_estimado_dias?: number | null;
  notas?: string[];
}

export interface ApoiosResult {
  ano_referencia: number;
  input_summary: ApoiosInput;
  apoios: ApoioOutput[];
  total_anual_estimado_eur: number;
  total_anual_min_eur: number;
  total_anual_max_eur: number;
  alertas: string[];
  checklist_pendente: string[];
  disclaimers: string[];
}
