import { describe, it, expect } from "vitest";
import { irsArt87 } from "../apoios/irs-art-87";
import type { ApoiosInput } from "../types";

const base: ApoiosInput = {
  idade: 80,
  situacao_residencia: "lar_privado",
};

describe("IRS Art. 87º — Pessoa com deficiência (atestado multiusos)", () => {
  it("dedução fixa para grau 60–89%", () => {
    const r = irsArt87({ ...base, tem_atestado_multiusos: true, grau_incapacidade: 70 });
    // 2,5 × 537,13 = 1342,825 → arredondado 1342,83
    expect(r.valor_anual_eur).toBeCloseTo(1342.83, 2);
    expect(r.elegibilidade).toBe("certa");
    expect(r.regra_aplicada).toBe("grau_60");
  });

  it("dedução acrescida para grau ≥ 90%", () => {
    const r = irsArt87({ ...base, tem_atestado_multiusos: true, grau_incapacidade: 95 });
    // (2,5 + 4) × 537,13 = 3491,345 → 3491,35
    expect(r.valor_anual_eur).toBeCloseTo(3491.35, 2);
    expect(r.regra_aplicada).toBe("grau_90_acompanhamento");
  });

  it("nega abaixo do limiar fiscal de 60%", () => {
    const r = irsArt87({ ...base, tem_atestado_multiusos: true, grau_incapacidade: 40 });
    expect(r.elegibilidade).toBe("nao_elegivel");
  });

  it("flag-a oportunidade quando sem atestado mas com sinais de dependência", () => {
    const r = irsArt87({
      ...base,
      tem_atestado_multiusos: false,
      grau_dependencia: "2_grau",
    });
    expect(r.elegibilidade).toBe("possivel");
    expect(r.regra_aplicada).toBe("sem_atestado_oportunidade");
  });

  it("não flag-a oportunidade para idosos sem sinais de dependência", () => {
    const r = irsArt87({
      ...base,
      idade: 67,
      tem_atestado_multiusos: false,
      grau_dependencia: "nenhum",
    });
    expect(r.elegibilidade).toBe("nao_avaliado");
  });
});
