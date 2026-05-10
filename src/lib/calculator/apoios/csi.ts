// 4.2 Complemento Solidário para Idosos (CSI)
// Base legal: DL 232/2005, 29 dezembro; Portaria 480-D/2025.
//
// Apoio mensal a pensionistas com baixos rendimentos, pago durante 14 meses.

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { idadeLegalReforma, isCasal, num, recursosAnuais, round2 } from "../utils";
import { complementoDependencia } from "./complemento-dependencia";

const ID = "csi";
const NOME = "Complemento Solidário para Idosos (CSI)";
const FORM = C.formularios.csi_1;

export function csi(input: ApoiosInput): ApoioOutput {
  const idadeMinima = idadeLegalReforma(
    C.idade_legal_reforma.meses,
    C.idade_legal_reforma.anos
  );
  const residencia = num(input.residencia_pt_anos, NaN);
  const tipoPensao = input.tipo_pensao ?? null;
  const casal = isCasal(input);

  // Idade — regra dura.
  if (input.idade < idadeMinima) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.95,
      explicacao: `Idade inferior aos ${idadeMinima.toFixed(2)} anos exigidos (idade legal de reforma 2026).`,
      regra_aplicada: "idade_insuficiente",
    });
  }

  // Pensão — só pensionistas têm direito.
  if (tipoPensao === "nenhuma") {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.9,
      explicacao:
        "CSI é exclusivo para pensionistas de velhice, invalidez ou sobrevivência.",
      regra_aplicada: "sem_pensao",
    });
  }

  // Residência — campo opcional, apenas baixa confiança quando ausente.
  if (Number.isNaN(residencia)) {
    // Continua, mas sinaliza.
  } else if (residencia < C.csi.residencia_pt_anos_min) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.9,
      explicacao: `Residência em Portugal (${residencia} anos) inferior aos ${C.csi.residencia_pt_anos_min} anos consecutivos exigidos.`,
      regra_aplicada: "residencia_insuficiente",
    });
  }

  // Cálculo de recursos. Spec §4.2: para o cálculo, mesmo quando recebe
  // complemento por dependência de 2.º grau, conta apenas o 1.º grau.
  const limite = casal ? C.csi.limite_anual_casal : C.csi.limite_anual_singular;
  const recursosBase = recursosAnuais(input);
  const dep = complementoDependencia(input);
  const dependencia1Grau = dep.elegibilidade === "provavel" || dep.elegibilidade === "certa"
    ? estimar1GrauAnual(input)
    : 0;

  const recursos = recursosBase + dependencia1Grau;
  const csiAnualBruto = Math.max(0, limite - recursos);
  let csiMensal = csiAnualBruto / 12;
  if (csiMensal > C.csi.limite_mensal_max) csiMensal = C.csi.limite_mensal_max;
  const csiAnual = csiMensal * 14; // CSI também é pago em 14 mensalidades

  if (csiMensal <= 0) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.85,
      explicacao: `Recursos anuais (€${round2(recursos)}) já igualam ou ultrapassam o limite ${casal ? "do casal" : "singular"} (€${limite.toFixed(2)}).`,
      regra_aplicada: casal ? "recursos_excedem_limite_casal" : "recursos_excedem_limite_singular",
      constantes_usadas: [
        `limite_singular=${C.csi.limite_anual_singular}`,
        `limite_casal=${C.csi.limite_anual_casal}`,
      ],
    });
  }

  return base({
    elegibilidade: Number.isNaN(residencia) ? "possivel" : "provavel",
    valor_mensal_eur: round2(csiMensal),
    valor_anual_eur: round2(csiAnual),
    confianca: Number.isNaN(residencia) ? 0.55 : 0.8,
    explicacao: `Recursos anuais estimados em €${round2(recursos)} face ao limite ${casal ? "para casal" : "singular"} (€${limite.toFixed(2)}). CSI mensal estimado: €${round2(csiMensal)}.`,
    regra_aplicada: casal ? "calculado_casal" : "calculado_singular",
    constantes_usadas: [
      `limite_singular=${C.csi.limite_anual_singular}`,
      `limite_casal=${C.csi.limite_anual_casal}`,
      `limite_mensal_max=${C.csi.limite_mensal_max}`,
    ],
    notas: [
      "Recebendo CSI desbloqueia: medicamentos com receita gratuitos, comparticipação de 75% em óculos e próteses dentárias, cheque-dentista, Passe Social+ e tarifa social de internet.",
      "Residência permanente é excluída do património para efeitos do cálculo.",
      "Se receber complemento por dependência de 2.º grau, no cálculo dos recursos só conta o valor do 1.º grau.",
      ...(Number.isNaN(residencia)
        ? ["Indique há quantos anos reside em Portugal para confirmar elegibilidade."]
        : []),
    ],
  });
}

/** Estimativa anual do complemento por dependência limitado ao 1.º grau,
 * usado apenas no cálculo dos recursos para o CSI. */
function estimar1GrauAnual(input: ApoiosInput): number {
  const meses = C.complemento_dependencia.meses_pagamento;
  const tabela =
    input.tipo_pensao === "regime_geral"
      ? C.complemento_dependencia.regime_geral
      : C.complemento_dependencia.regime_agricola_nao_contributivo_psi;
  return tabela.grau_1 * meses;
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
      "Entregar Mod. CSI 1-DGSS na Segurança Social, com Mod. CSI 1/2 (rendimentos do agregado).",
    formulario_link: FORM.url,
    tempo_resposta_estimado_dias: FORM.tempo_resposta_dias,
    notas: [],
    ...partial,
  };
}
