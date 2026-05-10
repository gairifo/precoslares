// 4.1 Complemento por Dependência
// Base legal: DL 265/99, 17 julho.
//
// Mensal, pago juntamente com a pensão, a dobrar em julho e dezembro
// (14 mensalidades por ano). Subsidia 1.º ou 2.º grau de dependência
// reconhecidos pelo SVI.

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { emLarComAcordo, num, round2 } from "../utils";

const ID = "complemento_dependencia";
const NOME = "Complemento por Dependência";
const FORM = C.formularios.rp_5027_dependencia;

export function complementoDependencia(input: ApoiosInput): ApoioOutput {
  const grau = input.grau_dependencia ?? null;
  const tipoPensao = input.tipo_pensao ?? null;
  const emAcordo = emLarComAcordo(input.situacao_residencia);

  // Sem pensão elegível → sem direito.
  if (tipoPensao === "nenhuma") {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.95,
      explicacao:
        "Não recebe pensão de invalidez, velhice, sobrevivência ou PSI — requisito do complemento por dependência.",
      regra_aplicada: "sem_pensao_elegivel",
    });
  }

  // Sem grau ou ainda não avaliado → sugerir avaliação SVI.
  if (!grau || grau === "nao_avaliado" || grau === "nenhum") {
    if (grau === "nenhum") {
      return base({
        elegibilidade: "nao_elegivel",
        valor_mensal_eur: 0,
        valor_anual_eur: 0,
        confianca: 0.85,
        explicacao:
          "Sem grau de dependência reconhecido pelo Serviço de Verificação de Incapacidades.",
        regra_aplicada: "sem_grau_reconhecido",
      });
    }
    return base({
      elegibilidade: "possivel",
      valor_mensal_eur: null,
      valor_anual_eur: null,
      confianca: 0.5,
      explicacao:
        "Pode ter direito caso a Segurança Social reconheça grau de dependência. Vale sempre a pena pedir avaliação.",
      regra_aplicada: "avaliacao_svi_pendente",
    });
  }

  // Mesa de valores 2026 conforme regime e grau.
  const tabelaGeral = C.complemento_dependencia.regime_geral;
  const tabelaOutros = C.complemento_dependencia.regime_agricola_nao_contributivo_psi;
  const meses = C.complemento_dependencia.meses_pagamento;

  const tabela =
    tipoPensao === "regime_geral" ? tabelaGeral
    : tipoPensao === "regime_agricola"
      || tipoPensao === "nao_contributivo_social"
      || tipoPensao === "prestacao_social_inclusao"
      ? tabelaOutros
    : null;

  // Tipo de pensão desconhecido → assumir regime geral mas baixar confiança.
  const tabelaUsada = tabela ?? tabelaGeral;
  const regimeRotulo = tabela ? tipoPensao : "presumido_regime_geral";

  // Cap obrigatório a 1.º grau se o utente está em lar IPSS com acordo,
  // ainda que tenha 2.º grau reconhecido. (Spec §4.1.)
  let valor: number;
  let regraAplicada: string;
  if (grau === "2_grau" && emAcordo) {
    valor = tabelaUsada.grau_1;
    regraAplicada = `${regimeRotulo}_2grau_capado_acordo`;
  } else if (grau === "2_grau") {
    valor = tabelaUsada.grau_2;
    regraAplicada = `${regimeRotulo}_2grau`;
  } else {
    valor = tabelaUsada.grau_1;
    regraAplicada = `${regimeRotulo}_1grau`;
  }

  const anual = round2(valor * meses);

  const notas: string[] = [
    "Pago a dobrar em julho e dezembro (14 mensalidades).",
    "Não acumula com Subsídio por Assistência de Terceira Pessoa.",
  ];
  if (grau === "2_grau" && emAcordo) {
    notas.push(
      "Embora tenha 2.º grau reconhecido, em lar IPSS com acordo o complemento é pago apenas pelo 1.º grau."
    );
  }

  return base({
    elegibilidade: tabela ? "provavel" : "possivel",
    valor_mensal_eur: round2(valor),
    valor_anual_eur: anual,
    confianca: tabela ? 0.85 : 0.6,
    explicacao: explicacao(grau, regimeRotulo, valor, emAcordo),
    regra_aplicada: regraAplicada,
    constantes_usadas: [
      `regime_geral_grau_1=${tabelaGeral.grau_1}`,
      `regime_geral_grau_2=${tabelaGeral.grau_2}`,
      `regime_outros_grau_1=${tabelaOutros.grau_1}`,
      `regime_outros_grau_2=${tabelaOutros.grau_2}`,
    ],
    notas,
  });
}

function explicacao(
  grau: string,
  regime: string,
  valor: number,
  emAcordo: boolean
): string {
  const grauTxt = grau === "2_grau" ? "2.º grau" : "1.º grau";
  if (grau === "2_grau" && emAcordo) {
    return `Tem 2.º grau reconhecido, mas como o lar tem acordo de cooperação com a Segurança Social, recebe o valor do 1.º grau (€${valor.toFixed(2)}/mês × 14).`;
  }
  return `Recebe pensão (${regime.replace(/_/g, " ")}) e tem ${grauTxt} de dependência reconhecido. Valor mensal: €${valor.toFixed(2)} × 14 meses/ano.`;
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
      "Pedir avaliação do grau de dependência ao SVI com o formulário RP 5027-DGSS (Segurança Social Direta → Família).",
    formulario_link: FORM.url,
    tempo_resposta_estimado_dias: FORM.tempo_resposta_dias,
    notas: [],
    ...partial,
  };
}
