import type { ApoiosInput, SituacaoResidencia } from "./types";

export function num(v: number | null | undefined, fallback = 0): number {
  if (v == null || Number.isNaN(v)) return fallback;
  return Number(v);
}

export function bool(v: boolean | null | undefined): boolean {
  return v === true;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emLarComAcordo(situacao: SituacaoResidencia | null | undefined): boolean {
  return situacao === "lar_ipss_acordo";
}

export function emQualquerLar(situacao: SituacaoResidencia | null | undefined): boolean {
  return situacao === "lar_privado"
    || situacao === "lar_ipss_acordo"
    || situacao === "lar_ipss_sem_acordo";
}

export function isCasal(input: ApoiosInput): boolean {
  return input.estado_civil === "casado" || input.estado_civil === "uniao_facto";
}

/** Recursos anuais brutos (próprio + cônjuge se aplicável). */
export function recursosAnuais(input: ApoiosInput): number {
  const pensaoAnual = num(input.valor_pensao_mensal) * 14;
  const outros = num(input.outros_rendimentos_anuais);
  let total = pensaoAnual + outros;
  if (isCasal(input)) {
    total += num(input.valor_pensao_conjuge) * 14;
    total += num(input.outros_rendimentos_conjuge);
  }
  return total;
}

/** Idade legal de reforma (em anos decimais) — 2026: 66 anos e 9 meses. */
export function idadeLegalReforma(meses: number, anos: number): number {
  return anos + meses / 12;
}
