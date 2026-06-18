import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipmentHtml } from "../parser";
import {
  mapEquipment,
  localityFromPostalCode,
  MapError,
  NATUREZA_TIPO_MAP,
  VALENCIA_LABEL_MAP,
  ERPI_LABEL,
} from "../mapper";
import type { RawEquipment } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const F = (id: number) =>
  readFileSync(resolve(__dirname, "fixtures", `equipment-${id}.html`), "utf-8");

function parseOk(id: number): RawEquipment {
  const r = parseEquipmentHtml(F(id), id);
  if (!r.ok) throw new Error(`Expected ok parse for ${id}: ${JSON.stringify(r)}`);
  return r.equipment;
}

describe("localityFromPostalCode", () => {
  it("extracts locality from standard PT postal code", () => {
    expect(localityFromPostalCode("4700-326 BRAGA")).toBe("BRAGA");
  });

  it("handles multi-word locality", () => {
    expect(localityFromPostalCode("9500-047 PONTA DELGADA")).toBe("PONTA DELGADA");
  });

  it("returns null for unrecognised format", () => {
    expect(localityFromPostalCode("invalid")).toBeNull();
  });
});

describe("NATUREZA_TIPO_MAP coverage", () => {
  const entries = Object.entries(NATUREZA_TIPO_MAP);

  it("has entries for all 4 tipos", () => {
    const tipos = new Set(entries.map(([, v]) => v));
    expect(tipos).toContain("misericordia");
    expect(tipos).toContain("ipss");
    expect(tipos).toContain("cooperativa");
    expect(tipos).toContain("privado");
  });

  it("Irmandade maps to misericordia", () => {
    expect(NATUREZA_TIPO_MAP["irmandade da misericórdia / scm"]).toBe("misericordia");
  });

  it("Associação maps to ipss", () => {
    expect(NATUREZA_TIPO_MAP["associação de solidariedade social"]).toBe("ipss");
  });

  it("Cooperativa maps to cooperativa", () => {
    expect(NATUREZA_TIPO_MAP["cooperativa de solidariedade social"]).toBe("cooperativa");
  });

  it("Sociedade maps to privado", () => {
    expect(NATUREZA_TIPO_MAP["sociedade comercial ou civil por quotas"]).toBe("privado");
  });
});

describe("VALENCIA_LABEL_MAP coverage", () => {
  it("maps ERPI label to erpi", () => {
    const key = ERPI_LABEL.toLowerCase();
    expect(VALENCIA_LABEL_MAP[key]).toBe("erpi");
  });

  it("maps Centro de Dia to centro_dia", () => {
    expect(VALENCIA_LABEL_MAP["centro de dia"]).toBe("centro_dia");
  });

  it("maps SAD to sad", () => {
    expect(VALENCIA_LABEL_MAP["serviço de apoio domiciliário"]).toBe("sad");
  });

  it("maps Centro de Convívio to centro_convivio", () => {
    expect(VALENCIA_LABEL_MAP["centro de convívio"]).toBe("centro_convivio");
  });
});

describe("mapEquipment", () => {
  describe("fixture 1001 — ERPI only, IPSS, Lisboa", () => {
    const raw = parseOk(1001);
    const mapped = mapEquipment(raw);

    it("returns a non-null result", () => {
      expect(mapped).not.toBeNull();
    });

    it("source is carta_social", () => {
      expect(mapped?.source).toBe("carta_social");
    });

    it("tipo is ipss", () => {
      expect(mapped?.tipo).toBe("ipss");
    });

    it("acordoSS is true", () => {
      expect(mapped?.acordoSS).toBe(true);
    });

    it("valencias contains erpi", () => {
      expect(mapped?.valencias).toContain("erpi");
    });

    it("concelhoSlug is derived from LISBOA", () => {
      expect(mapped?.concelhoSlug).toBe("lisboa");
    });

    it("capacidade is 45", () => {
      expect(mapped?.capacidade).toBe(45);
    });

    it("_meta has carta_social_id", () => {
      expect(mapped?._meta.carta_social_id).toBe(1001);
    });

    it("_meta has carta_social_url with idEquipment", () => {
      expect(mapped?._meta.carta_social_url).toContain("idEquipment=1001");
    });

    it("_meta.last_seen_at is an ISO date", () => {
      expect(mapped?._meta.last_seen_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("fixture 1003 — ERPI + CD, Fundação, Porto", () => {
    const raw = parseOk(1003);
    const mapped = mapEquipment(raw);

    it("valencias contains erpi and centro_dia", () => {
      expect(mapped?.valencias).toContain("erpi");
      expect(mapped?.valencias).toContain("centro_dia");
    });

    it("tipo is ipss (Fundação maps to ipss)", () => {
      expect(mapped?.tipo).toBe("ipss");
    });

    it("acordoSS is false", () => {
      expect(mapped?.acordoSS).toBe(false);
    });

    it("concelhoSlug is porto", () => {
      expect(mapped?.concelhoSlug).toBe("porto");
    });
  });

  describe("fixture 1004 — ERPI + CD + SAD, multi-valência", () => {
    const raw = parseOk(1004);
    const mapped = mapEquipment(raw);

    it("valencias has 3 types", () => {
      expect(mapped?.valencias).toHaveLength(3);
      expect(mapped?.valencias).toContain("erpi");
      expect(mapped?.valencias).toContain("centro_dia");
      expect(mapped?.valencias).toContain("sad");
    });

    it("capacidade is ERPI capacidade only (80)", () => {
      expect(mapped?.capacidade).toBe(80);
    });
  });

  describe("fixture 1006 — Misericórdia, Coimbra", () => {
    const raw = parseOk(1006);
    const mapped = mapEquipment(raw);

    it("tipo is misericordia", () => {
      expect(mapped?.tipo).toBe("misericordia");
    });
  });

  describe("fixture 1007 — Cooperativa, Setúbal", () => {
    const raw = parseOk(1007);
    const mapped = mapEquipment(raw);

    it("tipo is cooperativa", () => {
      expect(mapped?.tipo).toBe("cooperativa");
    });
  });

  describe("fixture 1008 — non-ERPI (Centro de Dia only)", () => {
    const raw = parseOk(1008);

    it("returns null (no ERPI response)", () => {
      expect(mapEquipment(raw)).toBeNull();
    });

    it("calls warn with a meaningful message", () => {
      const warn = vi.fn();
      mapEquipment(raw, { warn });
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]![0]).toContain("no ERPI response");
    });
  });

  describe("fixture 1009 — non-ERPI (SAD + Centro de Convívio)", () => {
    const raw = parseOk(1009);

    it("returns null (no ERPI response)", () => {
      expect(mapEquipment(raw)).toBeNull();
    });
  });

  describe("fixture 1011 — Privado, Faro", () => {
    const raw = parseOk(1011);
    const mapped = mapEquipment(raw);

    it("tipo is privado", () => {
      expect(mapped?.tipo).toBe("privado");
    });

    it("acordoSS is false", () => {
      expect(mapped?.acordoSS).toBe(false);
    });
  });

  describe("fixture 1030 — Misericórdia, Tomar (ERPI + CD)", () => {
    const raw = parseOk(1030);
    const mapped = mapEquipment(raw);

    it("tipo is misericordia", () => {
      expect(mapped?.tipo).toBe("misericordia");
    });

    it("valencias has erpi and centro_dia", () => {
      expect(mapped?.valencias).toContain("erpi");
      expect(mapped?.valencias).toContain("centro_dia");
    });
  });

  describe("fixture 1090 — multi-valência (ERPI+CD+SAD+CC), Institutos Religiosos", () => {
    const raw = parseOk(1090);
    const mapped = mapEquipment(raw);

    it("tipo is ipss (Institutos de Organizações Religiosas)", () => {
      expect(mapped?.tipo).toBe("ipss");
    });

    it("valencias has all 4 types", () => {
      expect(mapped?.valencias).toContain("erpi");
      expect(mapped?.valencias).toContain("centro_dia");
      expect(mapped?.valencias).toContain("sad");
      expect(mapped?.valencias).toContain("centro_convivio");
    });
  });

  describe("fixture 1200 — Açores", () => {
    const raw = parseOk(1200);
    const mapped = mapEquipment(raw);

    it("concelhoSlug is ponta-delgada", () => {
      expect(mapped?.concelhoSlug).toBe("ponta-delgada");
    });

    it("distritoSlug indicates acores-ou-madeira", () => {
      expect(mapped?.distritoSlug).toBe("acores-ou-madeira");
    });
  });

  describe("unknown naturezaJuridica handling", () => {
    const rawWithUnknown: RawEquipment = {
      idEquipment: 9999,
      nome: "Lar Desconhecido",
      naturezaJuridica: "Entidade Não Mapeada",
      entidadeProprietaria: null,
      morada: null,
      codigoPostal: "1000-001 LISBOA",
      telefone: null,
      email: null,
      website: null,
      respostas: [
        {
          tipoLabel: ERPI_LABEL,
          capacidade: 10,
          vagas: 0,
          utentes: 10,
          horario: "24 horas",
          acordoSS: false,
          ultimaAtualizacao: null,
        },
      ],
    };

    it("throws MapError by default", () => {
      expect(() => mapEquipment(rawWithUnknown)).toThrowError(MapError);
    });

    it("maps to privado with allowUnknownTipo=true", () => {
      const warn = vi.fn();
      const mapped = mapEquipment(rawWithUnknown, { allowUnknownTipo: true, warn });
      expect(mapped?.tipo).toBe("privado");
      expect(warn).toHaveBeenCalled();
    });
  });
});
