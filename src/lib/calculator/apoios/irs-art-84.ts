// 4.4 IRS — Encargos com Lares (Art. 84º CIRS)
//
// Dedução à coleta de 25% das despesas, com limite anual de 403,75 €.
// O calculador devolve o cenário óptimo ("máximo possível") e nota os
// 3 cenários de roteamento da fatura (NIF do idoso vs NIF dos filhos vs
// idoso no agregado de um filho).

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { emQualquerLar, num, round2 } from "../utils";

const ID = "irs_art_84";
const NOME = "IRS — Dedução de encargos com lares (Art. 84º)";

export function irsArt84(input: ApoiosInput): ApoioOutput {
  const sit = input.situacao_residencia ?? null;
  const aplicaSeAoCaso =
    emQualquerLar(sit) || sit === "apoio_domiciliario" || sit === "casa_filho_familiar";

  if (!aplicaSeAoCaso) {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.85,
      explicacao:
        "Sem despesas elegíveis com lar, apoio domiciliário ou centro de dia.",
      regra_aplicada: "sem_despesa_elegivel",
    });
  }

  const mensalidade = num(input.mensalidade_lar);
  const anual = mensalidade * 12;
  const pct = C.irs_art_84_lares.percentagem_dedutivel;
  const limite = C.irs_art_84_lares.limite_anual;

  // Sem mensalidade conhecida → assumir o cenário máximo (limite),
  // sinalizando confiança média.
  if (mensalidade <= 0) {
    return base({
      elegibilidade: "provavel",
      valor_mensal_eur: round2(limite / 12),
      valor_anual_eur: limite,
      confianca: 0.5,
      explicacao: `Pode deduzir ao IRS 25% das despesas com lar / apoio domiciliário, até ao limite anual de €${limite.toFixed(2)}. Confirme a mensalidade para uma estimativa mais precisa.`,
      regra_aplicada: "sem_mensalidade_assumido_limite",
    });
  }

  const calculado = round2(Math.min(anual * pct, limite));
  const atingiuLimite = anual * pct >= limite;

  return base({
    elegibilidade: "provavel",
    valor_mensal_eur: round2(calculado / 12),
    valor_anual_eur: calculado,
    confianca: 0.8,
    explicacao: atingiuLimite
      ? `Despesas anuais (€${round2(anual)}) × 25% = €${round2(anual * pct)}, mas limitado ao máximo de €${limite.toFixed(2)}/ano.`
      : `Despesas anuais (€${round2(anual)}) × 25% = €${calculado}/ano (abaixo do limite de €${limite.toFixed(2)}).`,
    regra_aplicada: atingiuLimite ? "atingiu_limite" : "abaixo_limite",
    constantes_usadas: [
      `pct_dedutivel=${pct}`,
      `limite_anual=${limite}`,
      `cae_validos=${C.irs_art_84_lares.cae_validos.join(", ")}`,
    ],
    notas: notasPorCenario(input),
  });
}

function notasPorCenario(input: ApoiosInput): string[] {
  const notas: string[] = [
    "Aplica-se a lares, residências, centros de dia e apoio domiciliário com CAE 873 ou 8810 e licenciados pela SS.",
    "Faturas têm de estar comunicadas no e-Fatura e classificadas como \"Lares\".",
  ];
  switch (input.quem_paga_fatura) {
    case "idoso":
      notas.push(
        "Cenário A: faturas no NIF do idoso → dedução vai para o IRS dele (até €403,75/ano)."
      );
      break;
    case "filhos":
      notas.push(
        "Cenário B: faturas em nome dos filhos → dedução fica no IRS de quem paga; faz sentido concentrar nas faturas do filho com IRS mais alto."
      );
      break;
    case "partilhada":
      notas.push(
        "Cenário B: custos repartidos → cada filho deduz nas suas faturas, mas o limite total para o mesmo idoso continua a ser €403,75/ano."
      );
      break;
    default:
      notas.push(
        "Decida quem fica como sujeito passivo nas faturas (idoso ou filho). A escolha tem impacto fiscal."
      );
  }
  if (input.nif_idoso_em_agregado) {
    notas.push(
      `Cenário C: idoso integrado no agregado de um filho — adiciona dedução fixa por ascendente (rendimento ≤ €${C.pensao_minima_regime_geral.toFixed(2)}/mês) e despesas dele entram nas despesas gerais familiares.`
    );
  }
  notas.push(
    "Simule sempre na declaração antes de submeter — o ganho real depende da coleta."
  );
  return notas;
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
      "Confirme que as faturas do lar / apoio domiciliário aparecem como \"Lares\" no e-Fatura. Se não, peça reclassificação.",
    formulario_link: C.formularios.anexo_h_irs.url,
    tempo_resposta_estimado_dias: null,
    notas: [],
    ...partial,
  };
}
