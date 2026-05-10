// Public entrypoint for the Lar Ajuda apoios calculator.
//
// Pure: no DOM, no fetch, no I/O. Same input → same output. Safe to call
// from the browser (client-side privacy guarantee) or from Node.
//
//   import { calcular } from "~/lib/calculator";
//   const result = calcular({ idade: 82, ... });

import type { ApoioOutput, ApoiosInput, ApoiosResult } from "./types";
import { C } from "./constants";
import { adseIasfaSad } from "./apoios/adse-iasfa-sad";
import { apoiosMunicipais } from "./apoios/apoios-municipais";
import { complementoDependencia } from "./apoios/complemento-dependencia";
import { csi } from "./apoios/csi";
import { cuidadorInformal } from "./apoios/cuidador-informal";
import { erpiAcordo } from "./apoios/erpi-acordo";
import { irsArt84 } from "./apoios/irs-art-84";
import { irsArt87 } from "./apoios/irs-art-87";

const DISCLAIMERS = [
  "Esta ferramenta é informativa e não substitui aconselhamento profissional.",
  "Os valores apresentados são estimativas baseadas nas regras públicas de 2026.",
  "Confirme sempre com a Segurança Social, a Autoridade Tributária ou um técnico de serviço social.",
  "A ferramenta não tem qualquer relação com lares ou prestadores de serviços.",
];

export function calcular(input: ApoiosInput): ApoiosResult {
  const apoios: ApoioOutput[] = [
    complementoDependencia(input),
    csi(input),
    erpiAcordo(input),
    irsArt84(input),
    irsArt87(input),
    adseIasfaSad(input),
    apoiosMunicipais(input),
    cuidadorInformal(input),
  ];

  // Sort by descending estimated annual value, with non-elegíveis at the end.
  const sortable = apoios.map((a) => ({
    apoio: a,
    valor: rankValue(a),
  }));
  sortable.sort((a, b) => b.valor - a.valor);

  const total = totals(sortable.map((s) => s.apoio));
  const alertas = construirAlertas(input, apoios);
  const checklist = construirChecklist(apoios);

  return {
    ano_referencia: C.ano_referencia,
    input_summary: input,
    apoios: sortable.map((s) => s.apoio),
    total_anual_estimado_eur: total.medio,
    total_anual_min_eur: total.min,
    total_anual_max_eur: total.max,
    alertas,
    checklist_pendente: checklist,
    disclaimers: DISCLAIMERS,
  };
}

function rankValue(a: ApoioOutput): number {
  if (a.elegibilidade === "nao_elegivel") return -1;
  if (a.valor_anual_eur != null) return a.valor_anual_eur;
  if (a.valor_anual_max_eur != null) return a.valor_anual_max_eur;
  if (a.valor_anual_min_eur != null) return a.valor_anual_min_eur;
  return 0;
}

function totals(apoios: ApoioOutput[]): { min: number; medio: number; max: number } {
  let min = 0, medio = 0, max = 0;
  for (const a of apoios) {
    if (a.elegibilidade === "nao_elegivel") continue;
    const lo = a.valor_anual_min_eur ?? a.valor_anual_eur ?? 0;
    const hi = a.valor_anual_max_eur ?? a.valor_anual_eur ?? 0;
    const mid = a.valor_anual_eur ?? (lo + hi) / 2;
    min += lo;
    medio += mid;
    max += hi;
  }
  return {
    min: round(min),
    medio: round(medio),
    max: round(max),
  };
}

function construirAlertas(input: ApoiosInput, apoios: ApoioOutput[]): string[] {
  const out: string[] = [];

  // Sem atestado multiusos → alerta de oportunidade.
  const art87 = apoios.find((a) => a.id === "irs_art_87");
  if (art87 && art87.regra_aplicada === "sem_atestado_oportunidade") {
    out.push(
      "Sem atestado multiusos — pode desbloquear até €1 343/ano em dedução IRS adicional. Pedir junta médica."
    );
  }

  // Em lar privado e sem CSI → flag a oportunidade.
  const csiOut = apoios.find((a) => a.id === "csi");
  const sit = input.situacao_residencia;
  if (
    csiOut?.elegibilidade === "nao_elegivel" &&
    (sit === "lar_privado" || sit === "lar_ipss_sem_acordo") &&
    (input.valor_pensao_mensal ?? 0) < 700
  ) {
    out.push(
      "Está em lar pago e sem CSI. Verifique se cumpre os critérios — pode desbloquear apoio mensal significativo."
    );
  }

  // Sem grau de dependência avaliado.
  const dep = apoios.find((a) => a.id === "complemento_dependencia");
  if (dep?.regra_aplicada === "avaliacao_svi_pendente") {
    out.push(
      "Grau de dependência ainda não avaliado pelo SVI. Avaliação é gratuita, demora ~150 dias."
    );
  }

  return out;
}

function construirChecklist(apoios: ApoioOutput[]): string[] {
  return apoios
    .filter(
      (a) =>
        a.elegibilidade === "provavel" ||
        a.elegibilidade === "possivel" ||
        a.elegibilidade === "certa"
    )
    .filter((a) => a.proximo_passo)
    .map((a) => `${a.nome}: ${a.proximo_passo}`);
}

function round(n: number): number {
  return Math.round(n);
}

export type { ApoiosInput, ApoiosResult, ApoioOutput } from "./types";
export { C as constantes } from "./constants";
