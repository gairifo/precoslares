import { describe, it, expect } from "vitest";
import { irsArt84 } from "../apoios/irs-art-84";
import type { ApoiosInput } from "../types";

const base: ApoiosInput = {
  idade: 80,
  situacao_residencia: "lar_privado",
  mensalidade_lar: 1500,
};

describe("IRS Art. 84º — Encargos com lares", () => {
  it("aplica 25% das despesas até ao limite", () => {
    const r = irsArt84({ ...base, mensalidade_lar: 1500 }); // 1500×12=18.000; ×25%=4.500 → cap 403,75
    expect(r.valor_anual_eur).toBe(403.75);
    expect(r.regra_aplicada).toBe("atingiu_limite");
  });

  it("não atinge o limite com mensalidade baixa", () => {
    const r = irsArt84({ ...base, mensalidade_lar: 100 }); // 1.200×25%=300
    expect(r.valor_anual_eur).toBeLessThan(403.75);
    expect(r.regra_aplicada).toBe("abaixo_limite");
  });

  it("assume o limite quando a mensalidade é desconhecida", () => {
    const r = irsArt84({ ...base, mensalidade_lar: null });
    expect(r.valor_anual_eur).toBe(403.75);
    expect(r.regra_aplicada).toBe("sem_mensalidade_assumido_limite");
  });

  it("não aplica se a situação não envolve lar / apoio domiciliário / casa de filho", () => {
    const r = irsArt84({ ...base, situacao_residencia: "casa_propria" });
    expect(r.elegibilidade).toBe("nao_elegivel");
  });

  it("inclui nota do cenário B quando filhos pagam", () => {
    const r = irsArt84({ ...base, quem_paga_fatura: "filhos" });
    expect(r.notas?.some((n) => /Cenário B/.test(n))).toBe(true);
  });

  it("inclui nota do cenário C quando idoso está no agregado de um filho", () => {
    const r = irsArt84({
      ...base,
      situacao_residencia: "casa_filho_familiar",
      nif_idoso_em_agregado: true,
    });
    expect(r.notas?.some((n) => /Cenário C/.test(n))).toBe(true);
  });
});
