// 4.5 IRS — Pessoa com Deficiência (Atestado Multiusos ≥ 60%)
// Base legal: CIRS Art. 87º; DL 14/2013 (atestado multiusos).

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { bool, num, round2 } from "../utils";

const ID = "irs_art_87";
const NOME = "IRS — Dedução por pessoa com deficiência (Art. 87º)";

export function irsArt87(input: ApoiosInput): ApoioOutput {
  const tem = bool(input.tem_atestado_multiusos);
  const grau = num(input.grau_incapacidade, 0);

  // Sem atestado mas com sinais de dependência → flag-ar oportunidade alta.
  if (!tem) {
    const possivelMente =
      input.grau_dependencia === "1_grau" ||
      input.grau_dependencia === "2_grau" ||
      input.idade >= 75;
    return base({
      elegibilidade: possivelMente ? "possivel" : "nao_avaliado",
      valor_mensal_eur: null,
      valor_anual_eur: null,
      valor_anual_min_eur: round2(C.irs_art_87_deficiencia.deducao_fixa_factor_ias * C.ias),
      valor_anual_max_eur: round2(
        (C.irs_art_87_deficiencia.deducao_fixa_factor_ias +
          C.irs_art_87_deficiencia.deducao_acompanhamento_factor_ias) *
          C.ias
      ),
      confianca: possivelMente ? 0.65 : 0.4,
      explicacao: possivelMente
        ? "Sem atestado multiusos, mas com sinais de dependência — pedir junta médica pode desbloquear deduções fiscais significativas."
        : "Sem atestado multiusos. Caso exista condição clínica relevante (demência, AVC, Parkinson, fragilidade severa), vale a pena pedir avaliação.",
      regra_aplicada: possivelMente ? "sem_atestado_oportunidade" : "sem_atestado",
      proximo_passo:
        "Pedir avaliação numa junta médica via centro de saúde de residência (gratuito, espera 2–6 meses). Atestado é vitalício se a condição for permanente.",
      formulario_link: C.formularios.atestado_multiusos.url,
      tempo_resposta_estimado_dias: C.formularios.atestado_multiusos.tempo_resposta_dias_max,
    });
  }

  if (grau < C.irs_art_87_deficiencia.grau_minimo_atestado) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.85,
      explicacao: `Grau de incapacidade (${grau}%) inferior ao limiar fiscal de ${C.irs_art_87_deficiencia.grau_minimo_atestado}%.`,
      regra_aplicada: "grau_abaixo_limiar",
    });
  }

  const deducaoFixa = round2(
    C.irs_art_87_deficiencia.deducao_fixa_factor_ias * C.ias
  );
  const deducaoAcompanhamento =
    grau >= C.irs_art_87_deficiencia.grau_minimo_acompanhamento
      ? round2(C.irs_art_87_deficiencia.deducao_acompanhamento_factor_ias * C.ias)
      : 0;
  const total = round2(deducaoFixa + deducaoAcompanhamento);

  return base({
    elegibilidade: "certa",
    valor_mensal_eur: round2(total / 12),
    valor_anual_eur: total,
    confianca: 0.85,
    explicacao:
      deducaoAcompanhamento > 0
        ? `Atestado multiusos com ${grau}% (≥ 90%) — dedução fixa de €${deducaoFixa} (2,5 × IAS) + dedução de acompanhamento de €${deducaoAcompanhamento} (4 × IAS).`
        : `Atestado multiusos com ${grau}% (≥ 60%) — dedução fixa de €${deducaoFixa} (2,5 × IAS) à coleta.`,
    regra_aplicada:
      deducaoAcompanhamento > 0 ? "grau_90_acompanhamento" : "grau_60",
    constantes_usadas: [
      `IAS=${C.ias}`,
      `factor_fixa=${C.irs_art_87_deficiencia.deducao_fixa_factor_ias}`,
      `factor_acompanhamento=${C.irs_art_87_deficiencia.deducao_acompanhamento_factor_ias}`,
    ],
    proximo_passo:
      "Inclua o Anexo H da declaração de IRS, indicando o grau de incapacidade. Mantenha o atestado disponível.",
    formulario_link: C.formularios.anexo_h_irs.url,
    tempo_resposta_estimado_dias: null,
    notas: [
      "A dedução do Art. 84º (encargos com lares) acumula com esta — não são alternativas.",
      "Outros benefícios: isenção de IUC (com limites), isenção parcial de IMI em casos específicos, cartão de estacionamento, transportes públicos com tarifas reduzidas.",
      "Demência, AVC, Parkinson avançado e fragilidade severa qualificam-se em geral para grau ≥ 60% — não é só para deficiência congénita.",
    ],
  });
}

function base(partial: Partial<ApoioOutput>): ApoioOutput {
  return {
    id: ID,
    nome: NOME,
    elegibilidade: "nao_avaliado",
    valor_mensal_eur: null,
    valor_anual_eur: null,
    confianca: 0,
    explicacao: "",
    regra_aplicada: "",
    proximo_passo: "",
    formulario_link: null,
    tempo_resposta_estimado_dias: null,
    notas: [],
    ...partial,
  };
}
