// 4.7 Apoios municipais
//
// Muitos municípios têm subsídios próprios (€50–€200/mês) para idosos
// dependentes ou famílias cuidadoras. Quase nunca divulgados, frequentemente
// sub-reclamados.
//
// MVP: hardcoded por slug de concelho (top 4). Para os restantes,
// devolvemos uma orientação genérica com link para a Câmara.

import type { ApoioOutput, ApoiosInput } from "../types";
import { C } from "../constants";

const ID = "apoios_municipais";
const NOME = "Apoios municipais";

const DESTAQUES = C.apoios_municipais_destacados as Record<
  string,
  { nome: string; url: string }
>;

export function apoiosMunicipais(input: ApoiosInput): ApoioOutput {
  const slug = (input.municipio || "").trim().toLowerCase();
  const destaque = slug ? DESTAQUES[slug] : null;

  if (destaque) {
    return {
      id: ID,
      nome: NOME,
      elegibilidade: "possivel",
      valor_mensal_eur: null,
      valor_anual_eur: null,
      valor_anual_min_eur: 600,
      valor_anual_max_eur: 2400,
      confianca: 0.5,
      explicacao: `O concelho de ${capitalizar(slug)} tem programa próprio: ${destaque.nome}. Tipicamente €50–€200/mês.`,
      regra_aplicada: "municipio_destacado",
      proximo_passo: `Consultar a página do programa: ${destaque.nome}.`,
      formulario_link: destaque.url,
      tempo_resposta_estimado_dias: 60,
      notas: [
        "Os apoios municipais são frequentemente sub-reclamados — vale sempre a pena perguntar.",
      ],
    };
  }

  return {
    id: ID,
    nome: NOME,
    elegibilidade: "possivel",
    valor_mensal_eur: null,
    valor_anual_eur: null,
    valor_anual_min_eur: 0,
    valor_anual_max_eur: 2400,
    confianca: 0.3,
    explicacao:
      "A maioria dos municípios tem apoios próprios para idosos dependentes ou famílias cuidadoras (cartão sénior, subsídio mensal, transportes). Nem sempre divulgados.",
    regra_aplicada: "municipio_generico",
    proximo_passo:
      "Telefone para o Pelouro da Ação Social da Câmara Municipal e pergunte por apoios para idosos / cuidadores.",
    formulario_link: null,
    tempo_resposta_estimado_dias: null,
    notas: ["MVP cobre apenas Lisboa, Porto, Cascais e Oeiras com link direto."],
  };
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
