// Anonymous lar/price report sent to PUBLIC_REPORT_ENDPOINT when the
// wizard user opts in.
//
// CRITICAL: this shape MUST NOT contain personal identifiers about the
// idoso. The wizard inputs (idade, pensão, dependência, etc.) stay in
// the browser. Only the lar/price/services data is sent server-side,
// and only with explicit opt-in.
//
// Maps loosely to spec §9.2 in 03-wizard-spec.md.

export type LarReportTipo =
  | "ipss_com_acordo"
  | "ipss_sem_acordo"
  | "misericordia"
  | "privado"
  | "nao_sei";

export type ServicoIncluido =
  | "alimentacao"
  | "fraldas"
  | "medicamentos"
  | "fisioterapia"
  | "cabeleireiro"
  | "transporte"
  | "quarto_privado"
  | "lavandaria"
  | "atividades";

export type TenureBand = "lt_6m" | "6m_to_1y" | "1y_to_3y" | "gt_3y";

export type DependenciaBand =
  | "nenhum_ou_1_grau"
  | "2_grau_ou_atestado_60_plus"
  | "nao_avaliado";

export interface LarReport {
  /** Schema version. Bump when this shape evolves. */
  v: 1;
  /** ISO 8601 submission timestamp (browser local). */
  submitted_at: string;
  /** Concelho slug (matches src/lib/lares/concelhos.ts). */
  concelho_slug: string;
  /** Slug of a known lar from the seed/Carta Social, if matched. */
  lar_slug?: string;
  /** Free-text name when the lar wasn't in the autocomplete list. */
  lar_name_freetext?: string;
  /** Lar type as the user understands it. */
  lar_tipo: LarReportTipo;
  /** Mensalidade média paga, em EUR. */
  monthly_price_eur: number;
  /** Multi-select of what's included in the mensalidade. */
  services_included: ServicoIncluido[];
  /** Time range the user has been at this lar. Granular = data freshness. */
  tenure_band: TenureBand;
  /** Coarse band only (no exact grau). For comparison segmentation. */
  dependencia_band?: DependenciaBand;
}

export const SERVICOS_LABELS: Record<ServicoIncluido, string> = {
  alimentacao: "Alimentação completa",
  fraldas: "Fraldas",
  medicamentos: "Medicamentos",
  fisioterapia: "Fisioterapia",
  cabeleireiro: "Cabeleireiro",
  transporte: "Transporte (consultas, etc.)",
  quarto_privado: "Quarto privado",
  lavandaria: "Lavandaria",
  atividades: "Atividades / animação",
};

export const TENURE_LABELS: Record<TenureBand, string> = {
  lt_6m: "Menos de 6 meses",
  "6m_to_1y": "6 meses a 1 ano",
  "1y_to_3y": "1 a 3 anos",
  gt_3y: "Mais de 3 anos",
};

export const TIPO_LABELS: Record<LarReportTipo, string> = {
  ipss_com_acordo: "IPSS com acordo de cooperação",
  ipss_sem_acordo: "IPSS sem acordo",
  misericordia: "Misericórdia",
  privado: "Privado lucrativo",
  nao_sei: "Não sei",
};
