import { describe, it, expect } from "vitest";
import { erpiAcordo } from "../apoios/erpi-acordo";
import type { ApoiosInput } from "../types";

const base: ApoiosInput = {
  idade: 82,
  estado_civil: "viuvo",
  valor_pensao_mensal: 500,
  situacao_residencia: "procura_lar",
};

describe("ERPI com acordo SS", () => {
  it("é uma oportunidade para quem está em lar pago", () => {
    const r = erpiAcordo({
      ...base,
      situacao_residencia: "lar_privado",
      mensalidade_lar: 1800,
    });
    expect(r.elegibilidade).toBe("possivel");
    expect(r.regra_aplicada).toBe("oportunidade_ja_em_lar_pago");
    expect(r.valor_anual_max_eur!).toBeGreaterThan(0);
  });

  it("é uma oportunidade primária para quem procura lar", () => {
    const r = erpiAcordo(base);
    expect(r.regra_aplicada).toBe("oportunidade_procura_lar");
  });

  it("já tem vaga: marca certa e calcula intervalo de comparticipação", () => {
    const r = erpiAcordo({ ...base, situacao_residencia: "lar_ipss_acordo" });
    expect(r.elegibilidade).toBe("certa");
    expect(r.regra_aplicada).toBe("ja_com_vaga_acordo");
  });

  it("para casa própria, devolve cenário futuro com baixa confiança", () => {
    const r = erpiAcordo({ ...base, situacao_residencia: "casa_propria" });
    expect(r.regra_aplicada).toBe("futuro_possivel");
    expect(r.confianca).toBeLessThan(0.5);
  });
});
