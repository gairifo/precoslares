import { describe, it, expect } from "vitest";
import { csi } from "../apoios/csi";
import type { ApoiosInput } from "../types";

const idoso = (over: Partial<ApoiosInput> = {}): ApoiosInput => ({
  idade: 80,
  tipo_pensao: "regime_geral",
  valor_pensao_mensal: 350,
  estado_civil: "viuvo",
  residencia_pt_anos: 50,
  grau_dependencia: "nenhum",
  situacao_residencia: "casa_propria",
  ...over,
});

describe("CSI — Complemento Solidário para Idosos", () => {
  it("nega antes da idade legal de reforma", () => {
    const r = csi(idoso({ idade: 60 }));
    expect(r.elegibilidade).toBe("nao_elegivel");
    expect(r.regra_aplicada).toBe("idade_insuficiente");
  });

  it("nega sem pensão", () => {
    const r = csi(idoso({ tipo_pensao: "nenhuma" }));
    expect(r.elegibilidade).toBe("nao_elegivel");
  });

  it("nega com residência insuficiente", () => {
    const r = csi(idoso({ residencia_pt_anos: 3 }));
    expect(r.elegibilidade).toBe("nao_elegivel");
    expect(r.regra_aplicada).toBe("residencia_insuficiente");
  });

  it("calcula CSI singular para pensionista de baixos rendimentos", () => {
    const r = csi(idoso({ valor_pensao_mensal: 350 })); // recursos = 350×14 = 4900
    expect(r.elegibilidade).toBe("provavel");
    expect(r.valor_mensal_eur).toBeGreaterThan(0);
    // Limite singular 8040; recursos 4900; CSI anual ≈ 3140; mensal ≈ 261,67
    expect(r.valor_mensal_eur!).toBeCloseTo((8040 - 4900) / 12, 1);
  });

  it("aplica o cap mensal de 670€", () => {
    const r = csi(idoso({ valor_pensao_mensal: 0, residencia_pt_anos: 60 }));
    expect(r.valor_mensal_eur).toBeLessThanOrEqual(670);
  });

  it("nega quando recursos excedem o limite singular", () => {
    const r = csi(idoso({ valor_pensao_mensal: 800 })); // 800×14 = 11.200 > 8.040
    expect(r.elegibilidade).toBe("nao_elegivel");
    expect(r.regra_aplicada).toBe("recursos_excedem_limite_singular");
  });

  it("usa o limite de casal quando casado", () => {
    const r = csi(
      idoso({
        estado_civil: "casado",
        valor_pensao_mensal: 400,
        valor_pensao_conjuge: 400,
      })
    );
    // Recursos = (400+400)×14 = 11.200, limite casal 14.070 → CSI > 0
    expect(r.elegibilidade).toBe("provavel");
    expect(r.regra_aplicada).toBe("calculado_casal");
    expect(r.valor_mensal_eur!).toBeGreaterThan(0);
  });
});
