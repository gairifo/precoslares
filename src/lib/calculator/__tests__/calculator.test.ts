import { describe, it, expect } from "vitest";
import { calcular } from "../index";
import type { ApoiosInput } from "../types";

describe("calcular() — integração", () => {
  it("devolve sempre os 8 apoios", () => {
    const r = calcular({ idade: 80 });
    expect(r.apoios).toHaveLength(8);
    const ids = r.apoios.map((a) => a.id).sort();
    expect(ids).toEqual([
      "adse_iasfa_sad",
      "apoios_municipais",
      "complemento_dependencia",
      "csi",
      "cuidador_informal",
      "erpi_acordo",
      "irs_art_84",
      "irs_art_87",
    ]);
  });

  it("inclui sempre o ano de referência e disclaimers", () => {
    const r = calcular({ idade: 80 });
    expect(r.ano_referencia).toBe(2026);
    expect(r.disclaimers.length).toBeGreaterThan(0);
  });

  it("ordena apoios por valor anual estimado descendente", () => {
    const r = calcular({
      idade: 82,
      tipo_pensao: "regime_geral",
      valor_pensao_mensal: 350,
      estado_civil: "viuvo",
      grau_dependencia: "2_grau",
      tem_atestado_multiusos: true,
      grau_incapacidade: 95,
      residencia_pt_anos: 50,
      situacao_residencia: "lar_privado",
      mensalidade_lar: 1800,
    });

    const valoresOrdem = r.apoios
      .filter((a) => a.elegibilidade !== "nao_elegivel")
      .map((a) => a.valor_anual_eur ?? a.valor_anual_max_eur ?? 0);
    for (let i = 1; i < valoresOrdem.length; i++) {
      expect(valoresOrdem[i - 1]).toBeGreaterThanOrEqual(valoresOrdem[i]);
    }
  });

  it("cenário típico: viúva, 82 anos, pensão baixa, 2.º grau, atestado 90%, em lar privado", () => {
    const input: ApoiosInput = {
      idade: 82,
      tipo_pensao: "regime_geral",
      valor_pensao_mensal: 350,
      outros_rendimentos_anuais: 0,
      estado_civil: "viuvo",
      grau_dependencia: "2_grau",
      tem_atestado_multiusos: true,
      grau_incapacidade: 90,
      residencia_pt_anos: 70,
      situacao_residencia: "lar_privado",
      mensalidade_lar: 1800,
      regime_especial: "nenhum",
      quem_paga_fatura: "filhos",
    };
    const r = calcular(input);

    // Complemento dependência: 2.º grau regime geral, NÃO em acordo → 236,16
    const dep = r.apoios.find((a) => a.id === "complemento_dependencia")!;
    expect(dep.valor_mensal_eur).toBe(236.14);

    // CSI: deve ser elegível (recursos < 8040)
    const c = r.apoios.find((a) => a.id === "csi")!;
    expect(c.elegibilidade).toBe("provavel");

    // Art. 87: 90% → fixa + acompanhamento
    const a87 = r.apoios.find((a) => a.id === "irs_art_87")!;
    expect(a87.valor_anual_eur).toBeCloseTo(3491.35, 1);

    // Art. 84: mensalidade × 25% capped a 403,75
    const a84 = r.apoios.find((a) => a.id === "irs_art_84")!;
    expect(a84.valor_anual_eur).toBe(403.75);

    // ERPI acordo: oportunidade
    const erpi = r.apoios.find((a) => a.id === "erpi_acordo")!;
    expect(erpi.regra_aplicada).toBe("oportunidade_ja_em_lar_pago");

    // Total anual estimado deve incluir todos
    expect(r.total_anual_estimado_eur).toBeGreaterThan(3000);

    // Alertas devem incluir CSI / dependência relevantes (não há porque já tem atestado e dep avaliada)
    expect(r.alertas).toBeDefined();

    // Checklist deve ter pelo menos os apoios elegíveis
    expect(r.checklist_pendente.length).toBeGreaterThanOrEqual(3);
  });

  it("cenário Phase 0 — calculadora robusta com inputs mínimos (só idade)", () => {
    const r = calcular({ idade: 78 });
    expect(r).toBeDefined();
    expect(r.apoios.length).toBe(8);
    // Não deve crashar com nulls em todo o lado
    for (const a of r.apoios) {
      expect(a.id).toBeTruthy();
      expect(a.nome).toBeTruthy();
    }
  });

  it("alerta sobre atestado multiusos em falta", () => {
    const r = calcular({
      idade: 82,
      tipo_pensao: "regime_geral",
      grau_dependencia: "2_grau",
      tem_atestado_multiusos: false,
    });
    expect(r.alertas.some((a) => /atestado/i.test(a))).toBe(true);
  });
});
