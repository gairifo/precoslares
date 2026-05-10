// 4.3 Comparticipação SS para ERPI (vagas em lar com acordo)
// Base legal: Compromisso de Cooperação 2025-2026; Portaria 67/2012 e 349/2023.
//
// Não é um apoio em dinheiro pago ao idoso. É uma vaga subsidiada num lar
// IPSS / Misericórdia, em que a SS paga uma parte fixa e a família paga
// uma comparticipação proporcional ao rendimento.
//
// O calculador devolve:
//   • Estimativa da comparticipação familiar (intervalo)
//   • Estimativa da poupança anual face a um lar privado equivalente
//   • Próximo passo: inscrição em listas de espera

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";
import { num, round2 } from "../utils";

const ID = "erpi_acordo";
const NOME = "Comparticipação SS — vaga em lar IPSS / Misericórdia";

export function erpiAcordo(input: ApoiosInput): ApoioOutput {
  const sit = input.situacao_residencia ?? null;

  // Já está num lar IPSS com acordo → o apoio já está em curso.
  if (sit === "lar_ipss_acordo") {
    return baseAposVaga(input);
  }

  // Já está num lar privado / IPSS sem acordo → a oportunidade é mudar
  // (alta convicção que vale a pena explorar).
  if (sit === "lar_privado" || sit === "lar_ipss_sem_acordo") {
    return baseOportunidade(input, "ja_em_lar_pago");
  }

  // À procura de lar → este é o caminho a tentar primeiro.
  if (sit === "procura_lar") {
    return baseOportunidade(input, "procura_lar");
  }

  // Em casa, apoio domiciliário, casa de filho → ainda relevante mas como
  // futura opção, com confiança mais baixa.
  return baseFuturoPossivel(input);
}

function estimarComparticipacaoFamiliar(input: ApoiosInput): {
  min: number;
  max: number;
} {
  const rendimentoMensal =
    num(input.valor_pensao_mensal) +
    num(input.outros_rendimentos_anuais) / 12 +
    num(input.valor_pensao_conjuge) +
    num(input.outros_rendimentos_conjuge) / 12;

  const nMembros =
    input.estado_civil === "casado" || input.estado_civil === "uniao_facto" ? 2 : 1;
  const rPerCapita = rendimentoMensal / Math.max(1, nMembros);

  const pctMin = C.erpi_acordo.comparticipacao_familiar_pct_min;
  const pctMax = C.erpi_acordo.comparticipacao_familiar_pct_max;

  // Cap por regulamento interno: 75–90% do rendimento mensal do residente.
  const capMin = num(input.valor_pensao_mensal) * C.erpi_acordo.cap_rendimento_residente_min;
  const capMax = num(input.valor_pensao_mensal) * C.erpi_acordo.cap_rendimento_residente_max;

  const bruto_min = rPerCapita * pctMin;
  const bruto_max = rPerCapita * pctMax;

  return {
    min: round2(Math.min(bruto_min, capMin || bruto_min)),
    max: round2(Math.min(bruto_max, capMax || bruto_max)),
  };
}

function poupancaAnualEstimada(input: ApoiosInput, ipssMin: number, ipssMax: number): {
  min: number;
  max: number;
} {
  const privadoMin = C.erpi_acordo.preco_privado_referencia_min;
  const privadoMax = C.erpi_acordo.preco_privado_referencia_max;
  const refPrivado =
    num(input.mensalidade_lar) > 0
      ? num(input.mensalidade_lar)
      : (privadoMin + privadoMax) / 2;
  const min = Math.max(0, (refPrivado - ipssMax) * 12);
  const max = Math.max(0, (refPrivado - ipssMin) * 12);
  return { min: round2(min), max: round2(max) };
}

function baseAposVaga(input: ApoiosInput): ApoioOutput {
  const { min, max } = estimarComparticipacaoFamiliar(input);
  return {
    id: ID,
    nome: NOME,
    elegibilidade: "certa",
    valor_mensal_eur: null,
    valor_anual_eur: null,
    valor_anual_min_eur: round2(min * 12),
    valor_anual_max_eur: round2(max * 12),
    confianca: 0.7,
    explicacao: `Já tem vaga IPSS. Comparticipação familiar mensal estimada entre €${min} e €${max}, conforme regulamento interno do lar.`,
    regra_aplicada: "ja_com_vaga_acordo",
    constantes_usadas: [
      `pct_min=${C.erpi_acordo.comparticipacao_familiar_pct_min}`,
      `pct_max=${C.erpi_acordo.comparticipacao_familiar_pct_max}`,
    ],
    proximo_passo:
      "Confirme o regulamento interno do lar e a tabela de comparticipação que lhe foi aplicada — pode pedir revisão se a situação financeira mudou.",
    formulario_link: null,
    tempo_resposta_estimado_dias: null,
    notas: [
      "Cap típico: 75–90% do rendimento mensal do residente.",
      "Habitualmente cobrada 14× por ano (férias e Natal a dobrar).",
    ],
  };
}

function baseOportunidade(
  input: ApoiosInput,
  motivo: "ja_em_lar_pago" | "procura_lar"
): ApoioOutput {
  const { min: ipssMin, max: ipssMax } = estimarComparticipacaoFamiliar(input);
  const { min: poupMin, max: poupMax } = poupancaAnualEstimada(input, ipssMin, ipssMax);

  const explicacao =
    motivo === "ja_em_lar_pago"
      ? `Está num lar pago. Caso obtenha vaga IPSS com acordo, a mensalidade estimada cairia para €${ipssMin}–€${ipssMax}/mês — poupança anual potencial entre €${poupMin} e €${poupMax}.`
      : `Está à procura de lar. Vagas IPSS com acordo são as mais económicas: mensalidade estimada €${ipssMin}–€${ipssMax}/mês.`;

  return {
    id: ID,
    nome: NOME,
    elegibilidade: "possivel",
    valor_mensal_eur: null,
    valor_anual_eur: null,
    valor_anual_min_eur: round2(poupMin),
    valor_anual_max_eur: round2(poupMax),
    confianca: motivo === "ja_em_lar_pago" ? 0.55 : 0.6,
    explicacao,
    regra_aplicada: `oportunidade_${motivo}`,
    constantes_usadas: [
      `preco_ipss=€${C.erpi_acordo.preco_ipss_referencia_min}–€${C.erpi_acordo.preco_ipss_referencia_max}`,
      `preco_privado=€${C.erpi_acordo.preco_privado_referencia_min}–€${C.erpi_acordo.preco_privado_referencia_max}`,
    ],
    proximo_passo:
      "Inscreva-se em várias listas de espera de IPSS / Misericórdias com acordo na sua zona — gratuito, sem compromisso, em paralelo.",
    formulario_link: "https://www.cartasocial.pt",
    tempo_resposta_estimado_dias: 365,
    notas: [
      "Listas de espera reais: 1 a 3 anos típicos.",
      "Centro Distrital de Segurança Social pode emitir parecer social que acelera casos de risco.",
    ],
  };
}

function baseFuturoPossivel(_input: ApoiosInput): ApoioOutput {
  return {
    id: ID,
    nome: NOME,
    elegibilidade: "possivel",
    valor_mensal_eur: null,
    valor_anual_eur: null,
    confianca: 0.4,
    explicacao:
      "Caso venha a precisar de lar no futuro, a vaga IPSS com acordo é a opção financeiramente mais protegida — vale a pena ir conhecendo a oferta na zona.",
    regra_aplicada: "futuro_possivel",
    proximo_passo:
      "Identifique as IPSS / Misericórdias com acordo na zona e mantenha contacto, mesmo sem inscrição imediata.",
    formulario_link: "https://www.cartasocial.pt",
    tempo_resposta_estimado_dias: null,
    notas: [],
  };
}
