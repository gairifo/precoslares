import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipmentHtml } from "../parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const F = (id: number) =>
  readFileSync(resolve(__dirname, "fixtures", `equipment-${id}.html`), "utf-8");

describe("parseEquipmentHtml", () => {
  describe("error detection", () => {
    it("returns service_error when the portlet shows the unavailable message", () => {
      // The Carta Social backend error message appears in the portlet-body
      // when the data service is unavailable.
      const html = `<div class="portlet-body">
        <div class="alert alert-error">
          Listagem das cartas sociais está temporariamente indisponível.
        </div>
      </div>`;
      const result = parseEquipmentHtml(html, 999);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("service_error");
    });

    it("returns not_found for the 'informação requerida' error page", () => {
      const html = `<div class="portlet-body">
        <p>A informação requerida não está disponível</p>
      </div>`;
      const result = parseEquipmentHtml(html, 999);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("not_found");
    });
  });

  describe("fixture 1001 — ERPI only, IPSS, Lisboa", () => {
    const result = parseEquipmentHtml(F(1001), 1001);

    it("parses successfully", () => {
      expect(result.ok).toBe(true);
    });

    it("extracts idEquipment", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.idEquipment).toBe(1001);
    });

    it("extracts nome from h2", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.nome).toBe("Lar São Francisco de Assis");
    });

    it("extracts naturezaJuridica", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Associação de Solidariedade Social");
    });

    it("extracts morada", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.morada).toBe("Rua do Lumiar, 15");
    });

    it("extracts codigoPostal with locality", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.codigoPostal).toBe("1750-150 LISBOA");
    });

    it("extracts telefone", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.telefone).toBe("213456780");
    });

    it("extracts email", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.email).toBe("geral@larsaofrancisco.pt");
    });

    it("extracts website as null when absent", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.website).toBeNull();
    });

    it("has 1 resposta (ERPI only)", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(1);
    });

    it("ERPI resposta has capacidade=45", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas[0]!.capacidade).toBe(45);
    });

    it("ERPI resposta has acordoSS=true", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas[0]!.acordoSS).toBe(true);
    });
  });

  describe("fixture 1003 — ERPI + Centro de Dia, Fundação, Porto", () => {
    const result = parseEquipmentHtml(F(1003), 1003);

    it("parses successfully", () => {
      expect(result.ok).toBe(true);
    });

    it("has 2 respostas (ERPI + CD)", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(2);
    });

    it("ERPI resposta has acordoSS=false", () => {
      if (!result.ok) throw new Error("expected ok");
      const erpi = result.equipment.respostas.find((r) =>
        r.tipoLabel.includes("Estrutura Residencial"),
      );
      expect(erpi?.acordoSS).toBe(false);
    });

    it("extracts website URL", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.website).toBe("https://www.csnsg.pt");
    });

    it("naturezaJuridica is Fundação", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Fundação de Solidariedade Social");
    });
  });

  describe("fixture 1004 — ERPI + Centro de Dia + SAD, IPSS, Braga", () => {
    const result = parseEquipmentHtml(F(1004), 1004);

    it("has 3 respostas", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(3);
    });

    it("all three respostas have their type labels", () => {
      if (!result.ok) throw new Error("expected ok");
      const labels = result.equipment.respostas.map((r) => r.tipoLabel);
      expect(labels).toContain(
        "Estrutura Residencial para Pessoas Idosas ( Lar de Idosos e Residência)",
      );
      expect(labels).toContain("Centro de Dia");
      expect(labels).toContain("Serviço de Apoio Domiciliário");
    });

    it("ERPI capacidade is 80", () => {
      if (!result.ok) throw new Error("expected ok");
      const erpi = result.equipment.respostas.find((r) =>
        r.tipoLabel.includes("Estrutura Residencial"),
      );
      expect(erpi?.capacidade).toBe(80);
    });

    it("codigoPostal contains Braga", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.codigoPostal).toContain("BRAGA");
    });
  });

  describe("fixture 1006 — Misericórdia, Coimbra", () => {
    const result = parseEquipmentHtml(F(1006), 1006);

    it("naturezaJuridica is Irmandade da Misericórdia", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Irmandade da Misericórdia / SCM");
    });
  });

  describe("fixture 1007 — Cooperativa, Setúbal", () => {
    const result = parseEquipmentHtml(F(1007), 1007);

    it("naturezaJuridica is Cooperativa", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Cooperativa de Solidariedade Social");
    });

    it("ERPI acordoSS=false", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas[0]!.acordoSS).toBe(false);
    });
  });

  describe("fixture 1008 — non-ERPI (Centro de Dia only)", () => {
    const result = parseEquipmentHtml(F(1008), 1008);

    it("parses successfully (parser does not filter — mapper does)", () => {
      expect(result.ok).toBe(true);
    });

    it("has 1 resposta (Centro de Dia)", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(1);
      expect(result.equipment.respostas[0]!.tipoLabel).toBe("Centro de Dia");
    });
  });

  describe("fixture 1009 — non-ERPI (SAD + Centro de Convívio)", () => {
    const result = parseEquipmentHtml(F(1009), 1009);

    it("has 2 respostas (SAD + CC)", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(2);
    });
  });

  describe("fixture 1011 — Privado (Sociedade), Faro", () => {
    const result = parseEquipmentHtml(F(1011), 1011);

    it("naturezaJuridica is Sociedade Comercial", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Sociedade Comercial ou Civil por Quotas");
    });
  });

  describe("fixture 1090 — multi-valência (ERPI+CD+SAD+CC), Instituto Religioso, Beja", () => {
    const result = parseEquipmentHtml(F(1090), 1090);

    it("has 4 respostas", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.respostas).toHaveLength(4);
    });

    it("naturezaJuridica is Institutos de Organizações Religiosas", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.naturezaJuridica).toBe("Institutos de Organizações Religiosas");
    });
  });

  describe("fixture 1200 — Açores (9xxx postal code)", () => {
    const result = parseEquipmentHtml(F(1200), 1200);

    it("codigoPostal starts with 9", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.codigoPostal?.startsWith("9")).toBe(true);
    });

    it("locality is PONTA DELGADA", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.codigoPostal).toContain("PONTA DELGADA");
    });
  });

  describe("fixture 1300 — Madeira (9xxx postal code), Misericórdia", () => {
    const result = parseEquipmentHtml(F(1300), 1300);

    it("parses successfully", () => {
      expect(result.ok).toBe(true);
    });

    it("codigoPostal is FUNCHAL", () => {
      if (!result.ok) throw new Error("expected ok");
      expect(result.equipment.codigoPostal).toContain("FUNCHAL");
    });
  });
});
