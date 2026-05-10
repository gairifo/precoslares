// 4.8 Subsídio de Apoio ao Cuidador Informal
// Base legal: Lei 100/2019 (Estatuto do Cuidador Informal); Portarias anuais.
//
// Pago ao cuidador familiar reconhecido (não ao idoso). Relevante apenas
// se a família optar por manter o idoso em casa. Não cumulável com lar.

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { bool, emQualquerLar, round2 } from "../utils";

const ID = "cuidador_informal";
const NOME = "Subsídio de Apoio ao Cuidador Informal";

export function cuidadorInformal(input: ApoiosInput): ApoioOutput {
  const sit = input.situacao_residencia ?? null;
  const grau = input.grau_dependencia ?? null;
  const tem = bool(input.tem_cuidador_informal);

  // Em lar → não cumulável.
  if (emQualquerLar(sit)) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.95,
      explicacao:
        "O subsídio ao cuidador informal não é cumulável com a permanência num lar.",
      regra_aplicada: "em_lar_nao_cumulavel",
    });
  }

  // Idoso em casa, com grau de dependência reconhecido → provável se houver cuidador.
  if (
    (sit === "casa_propria" ||
      sit === "casa_filho_familiar" ||
      sit === "apoio_domiciliario") &&
    (grau === "1_grau" || grau === "2_grau")
  ) {
    if (tem) {
      const valorMin = C.cuidador_informal.valor_base_min;
      const valorMax = C.cuidador_informal.valor_base_max;
      const valorMedio = round2((valorMin + valorMax) / 2);
      return base({
        elegibilidade: "provavel",
        valor_mensal_eur: valorMedio,
        valor_anual_eur: round2(valorMedio * 12),
        valor_anual_min_eur: round2(valorMin * 12),
        valor_anual_max_eur: round2(valorMax * 12),
        confianca: 0.7,
        explicacao: `Cuidador informal reconhecido + grau de dependência reconhecido. Valor mensal típico €${valorMin}–€${valorMax} (referência IAS).`,
        regra_aplicada: "elegivel_com_cuidador",
        notas: [
          "Em 2026, este subsídio deixa de contar como rendimento para outras prestações.",
          "Não cumulável com a permanência num lar.",
        ],
      });
    }
    return base({
      elegibilidade: "possivel",
      valor_mensal_eur: null,
      valor_anual_eur: null,
      valor_anual_min_eur: round2(C.cuidador_informal.valor_base_min * 12),
      valor_anual_max_eur: round2(C.cuidador_informal.valor_base_max * 12),
      confianca: 0.55,
      explicacao:
        "Ainda sem cuidador informal reconhecido. Caso um familiar assuma esse papel, pode requerer o estatuto e o subsídio.",
      regra_aplicada: "potencial_sem_cuidador_reconhecido",
    });
  }

  // Sem grau ou ambíguo → flag-ar como possível se em casa.
  if (sit === "casa_propria" || sit === "casa_filho_familiar" || sit === "apoio_domiciliario") {
    return base({
      elegibilidade: "possivel",
      valor_mensal_eur: null,
      valor_anual_eur: null,
      confianca: 0.4,
      explicacao:
        "Pode haver direito caso seja reconhecido grau de dependência e haja um familiar a assumir o estatuto de cuidador.",
      regra_aplicada: "em_casa_avaliacao_pendente",
    });
  }

  return base({
    elegibilidade: "nao_avaliado",
    confianca: 0,
    explicacao: "Não foi possível avaliar — esclareça a situação atual.",
    regra_aplicada: "sem_dados",
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
    proximo_passo:
      "Iniciar o pedido de Estatuto do Cuidador Informal junto da Segurança Social, em paralelo com a avaliação do grau de dependência.",
    formulario_link: C.formularios.cuidador_informal.url,
    tempo_resposta_estimado_dias: 90,
    notas: [],
    ...partial,
  };
}
