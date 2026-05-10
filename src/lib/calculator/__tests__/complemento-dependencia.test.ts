import { describe, it, expect } from "vitest";
import { complementoDependencia } from "../apoios/complemento-dependencia";
import type { ApoiosInput } from "../types";

const baseInput: ApoiosInput = {
  idade: 80,
  tipo_pensao: "regime_geral",
  valor_pensao_mensal: 500,
  estado_civil: "viuvo",
  situacao_residencia: "casa_propria",
  grau_dependencia: "1_grau",
};

describe("Complemento por Dependência", () => {
  it("paga regime geral 1.º grau", () => {
    const r = complementoDependencia({ ...baseInput, grau_dependencia: "1_grau" });
    expect(r.valor_mensal_eur).toBe(131.20);
    expect(r.valor_anual_eur).toBeCloseTo(131.20 * 14, 1);
    expect(r.elegibilidade).toBe("provavel");
    expect(r.regra_aplicada).toBe("regime_geral_1grau");
  });

  it("paga regime geral 2.º grau quando não está em lar com acordo", () => {
    const r = complementoDependencia({
      ...baseInput,
      grau_dependencia: "2_grau",
      situacao_residencia: "casa_propria",
    });
    expect(r.valor_mensal_eur).toBe(236.16);
    expect(r.regra_aplicada).toBe("regime_geral_2grau");
  });

  it("limita a 1.º grau quando em lar IPSS com acordo, mesmo com 2.º grau reconhecido", () => {
    const r = complementoDependencia({
      ...baseInput,
      grau_dependencia: "2_grau",
      situacao_residencia: "lar_ipss_acordo",
    });
    expect(r.valor_mensal_eur).toBe(131.20);
    expect(r.regra_aplicada).toBe("regime_geral_2grau_capado_acordo");
  });

  it("usa tabela de regime agrícola / não contributivo / PSI", () => {
    const r = complementoDependencia({
      ...baseInput,
      tipo_pensao: "regime_agricola",
      grau_dependencia: "2_grau",
    });
    expect(r.valor_mensal_eur).toBe(223.04);
  });

  it("flag-a possível quando o grau não foi avaliado", () => {
    const r = complementoDependencia({
      ...baseInput,
      grau_dependencia: "nao_avaliado",
    });
    expect(r.elegibilidade).toBe("possivel");
    expect(r.valor_mensal_eur).toBeNull();
    expect(r.proximo_passo).toMatch(/RP 5027/);
  });

  it("nega quando não há pensão", () => {
    const r = complementoDependencia({ ...baseInput, tipo_pensao: "nenhuma" });
    expect(r.elegibilidade).toBe("nao_elegivel");
  });

  it("nega quando 'nenhum' grau", () => {
    const r = complementoDependencia({ ...baseInput, grau_dependencia: "nenhum" });
    expect(r.elegibilidade).toBe("nao_elegivel");
  });
});
