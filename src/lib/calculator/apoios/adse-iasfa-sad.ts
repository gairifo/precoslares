// 4.6 ADSE / IASFA / SAD-PSP — comparticipação em lar / apoio domiciliário
//
// Apenas se o idoso ou cônjuge tem/teve vínculo a função pública (ADSE),
// militar (IASFA/ADM) ou PSP (SAD/PSP). Calculado por capitação.
// As tabelas exatas variam por subsistema e atualizam-se em portarias
// próprias — devolvemos uma estimativa por escalão de capitação e
// reencaminhamos para o portal correto.

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { isCasal, num, round2 } from "../utils";

const ID = "adse_iasfa_sad";

export function adseIasfaSad(input: ApoiosInput): ApoioOutput {
  const regime = input.regime_especial ?? "nenhum";

  if (regime === "nenhum") {
    return base({
      elegibilidade: "nao_elegivel",
      valor_mensal_eur: 0,
      valor_anual_eur: 0,
      confianca: 0.95,
      explicacao:
        "Sem vínculo a função pública (ADSE), militar (IASFA/ADM) ou PSP (SAD/PSP).",
      regra_aplicada: "sem_regime_especial",
      nome: "ADSE / IASFA / SAD-PSP — comparticipação em lar",
      proximo_passo: "",
      formulario_link: null,
    });
  }

  const cfg = configRegime(regime);
  const capitacao = capitacaoMensal(input);
  const escalao = escalaoCapitacao(capitacao, cfg.escaloes);
  const apoioMensal = round2(escalao.diario * 30);
  const apoioAnual = round2(apoioMensal * 12);

  return base({
    elegibilidade: "provavel",
    valor_mensal_eur: apoioMensal,
    valor_anual_eur: apoioAnual,
    valor_anual_min_eur: round2(cfg.escaloes.at(-1)!.diario * 30 * 12),
    valor_anual_max_eur: round2(cfg.escaloes[0].diario * 30 * 12),
    confianca: 0.55,
    explicacao: `${cfg.nome}. Capitação mensal estimada €${round2(capitacao)} → escalão ${escalao.label} → apoio diário €${escalao.diario}.`,
    regra_aplicada: `${regime}_escalao_${escalao.label}`,
    constantes_usadas: [`tabela=${cfg.nome} (estimada)`],
    nome: `${cfg.nome} — comparticipação em lar / apoio domiciliário`,
    proximo_passo: cfg.proximo_passo,
    formulario_link: cfg.formulario_link,
    tempo_resposta_estimado_dias: 60,
    notas: [
      "Cobre o diferencial após complemento por dependência, quando aplicável.",
      "Faturas têm prazo de submissão de 180 dias (ADSE).",
      "Pedido prévio com aprovação do Diretor-Geral (ADSE).",
      "A tabela exata atualiza-se anualmente — confirme no portal do subsistema.",
    ],
  });
}

function configRegime(regime: string) {
  switch (regime) {
    case "adse":
      return {
        nome: "ADSE",
        proximo_passo:
          "Aceder à ADSE Direta → Documentos relativos a Processo de Pedido de Apoio em Lar.",
        formulario_link: C.formularios.adse_apoio_lar.url,
        escaloes: [
          { label: "1", capMax: 1.5 * C.ias, diario: 13 },
          { label: "2", capMax: 2.5 * C.ias, diario: 9 },
          { label: "3", capMax: Infinity, diario: 6 },
        ],
      };
    case "iasfa_adm":
      return {
        nome: "IASFA / ADM",
        proximo_passo:
          "Contactar o Centro de Apoio Social (IASFA) da área de residência.",
        formulario_link: C.formularios.iasfa_centro_apoio_social.url,
        escaloes: [
          { label: "1", capMax: 1.5 * C.ias, diario: 14 },
          { label: "2", capMax: 2.5 * C.ias, diario: 10 },
          { label: "3", capMax: Infinity, diario: 7 },
        ],
      };
    case "sad_psp":
      return {
        nome: "SAD / PSP",
        proximo_passo: "Aceder ao Portal Social PSP para iniciar o pedido.",
        formulario_link: C.formularios.sad_psp.url,
        escaloes: [
          { label: "1", capMax: 1.5 * C.ias, diario: 12 },
          { label: "2", capMax: 2.5 * C.ias, diario: 8 },
          { label: "3", capMax: Infinity, diario: 5 },
        ],
      };
    default:
      return {
        nome: "Outro subsistema",
        proximo_passo:
          "Confirme as condições no portal do seu subsistema de saúde / proteção social.",
        formulario_link: null,
        escaloes: [{ label: "1", capMax: Infinity, diario: 8 }],
      };
  }
}

function capitacaoMensal(input: ApoiosInput): number {
  const rendimento =
    num(input.valor_pensao_mensal) +
    num(input.outros_rendimentos_anuais) / 12 +
    num(input.valor_pensao_conjuge) +
    num(input.outros_rendimentos_conjuge) / 12;
  const n = isCasal(input) ? 2 : 1;
  return rendimento / n;
}

function escalaoCapitacao(
  cap: number,
  escaloes: Array<{ label: string; capMax: number; diario: number }>
) {
  return escaloes.find((e) => cap <= e.capMax) ?? escaloes.at(-1)!;
}

function base(partial: Partial<ApoioOutput>): ApoioOutput {
  return {
    id: ID,
    nome: "ADSE / IASFA / SAD-PSP",
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
