import { describe, it, expect } from "vitest";
import { generateLarSlug, generateAllLarSlugs, type SlugInputs } from "../slug";
import { SLUG_REGEX } from "../schema";

const empty: ReadonlySet<string> = new Set();

describe("generateLarSlug — base case", () => {
  it("kebab-cases nome and strips diacritics", () => {
    const s = generateLarSlug(
      { nome: "Santa Casa da Misericórdia de Aveiro", concelhoSlug: "aveiro" },
      empty,
    );
    expect(s).toBe("santa-casa-misericordia-aveiro");
    expect(SLUG_REGEX.test(s)).toBe(true);
  });

  it("drops PT stopwords (de/da/do/dos/das/e)", () => {
    expect(
      generateLarSlug({ nome: "Lar de São José", concelhoSlug: "braga" }, empty),
    ).toBe("lar-sao-jose");
    expect(
      generateLarSlug(
        { nome: "Centro Comunitário do Barreiro", concelhoSlug: "barreiro" },
        empty,
      ),
    ).toBe("centro-comunitario-barreiro");
  });

  it("trims em-dash trailing subtitle clauses", () => {
    expect(
      generateLarSlug(
        {
          nome: "Santa Casa da Misericórdia de Lisboa — Centros de Vida e Saúde",
          concelhoSlug: "lisboa",
        },
        empty,
      ),
    ).toBe("santa-casa-misericordia-lisboa");
  });
});

describe("generateLarSlug — PT edge cases", () => {
  it("handles Ç correctly", () => {
    const s = generateLarSlug(
      { nome: "Lar Coração de Jesus", concelhoSlug: "porto" },
      empty,
    );
    expect(SLUG_REGEX.test(s)).toBe(true);
    expect(s).toContain("coracao");
  });

  it("handles Æ → ae or a-e", () => {
    const s = generateLarSlug({ nome: "Æquor", concelhoSlug: "lisboa" }, empty);
    expect(SLUG_REGEX.test(s)).toBe(true);
  });

  it("handles smart quotes and apostrophes", () => {
    const s = generateLarSlug(
      { nome: "Lar D'Ouro", concelhoSlug: "porto" },
      empty,
    );
    expect(SLUG_REGEX.test(s)).toBe(true);
    expect(s).toBe("lar-d-ouro");
  });

  it("handles numeric suffixes like nº 1", () => {
    const s = generateLarSlug(
      { nome: "Lar nº 1", concelhoSlug: "evora" },
      empty,
    );
    expect(SLUG_REGEX.test(s)).toBe(true);
    expect(s).toContain("1");
  });
});

describe("generateLarSlug — cascade", () => {
  it("appends concelho when base is taken", () => {
    const taken = new Set(["domus-vida-junqueira"]);
    const s = generateLarSlug(
      { nome: "Domus Vida Junqueira", concelhoSlug: "porto" },
      taken,
    );
    expect(s).toBe("domus-vida-junqueira-porto");
  });

  it("appends freguesia when base + concelho is taken", () => {
    const taken = new Set([
      "lar-flores",
      "lar-flores-sintra",
    ]);
    const s = generateLarSlug(
      { nome: "Lar das Flores", concelhoSlug: "sintra", freguesia: "Algueirão" },
      taken,
    );
    expect(s).toBe("lar-flores-sintra-algueirao");
  });

  it("appends alvará tail when base + concelho + freguesia are taken", () => {
    const taken = new Set([
      "lar-flores",
      "lar-flores-sintra",
      "lar-flores-sintra-algueirao",
    ]);
    const s = generateLarSlug(
      {
        nome: "Lar das Flores",
        concelhoSlug: "sintra",
        freguesia: "Algueirão",
        alvara: "PT/2024/12345",
      },
      taken,
    );
    expect(s).toBe("lar-flores-sintra-2345");
  });

  it("throws when cascade exhausts without alvará", () => {
    const taken = new Set(["lar-x", "lar-x-porto"]);
    expect(() =>
      generateLarSlug(
        { nome: "Lar X", concelhoSlug: "porto" },
        taken,
      ),
    ).toThrow(/unresolvable collision/);
  });

  it("throws when full cascade exhausts", () => {
    const taken = new Set([
      "lar-x",
      "lar-x-porto",
      "lar-x-porto-foz",
      "lar-x-porto-2345",
    ]);
    expect(() =>
      generateLarSlug(
        {
          nome: "Lar X",
          concelhoSlug: "porto",
          freguesia: "Foz",
          alvara: "PT/2024/12345",
        },
        taken,
      ),
    ).toThrow(/unresolvable collision/);
  });
});

describe("generateLarSlug — determinism + safety", () => {
  it("is deterministic across runs", () => {
    const inputs: SlugInputs = {
      nome: "Santa Casa da Misericórdia de Évora",
      concelhoSlug: "evora",
    };
    const a = generateLarSlug(inputs, empty);
    const b = generateLarSlug(inputs, empty);
    expect(a).toBe(b);
  });

  it("always produces a slug matching SLUG_REGEX", () => {
    const cases = [
      "Lar São José",
      "Residência Sénior Foz Atlântico",
      "Centro Social Paroquial de Nossa Senhora de Fátima",
      "Lar nº 1",
      "Lar D'Ouro",
      "Æquor",
      "Lar dos Plátanos",
    ];
    for (const nome of cases) {
      const s = generateLarSlug({ nome, concelhoSlug: "lisboa" }, empty);
      expect(SLUG_REGEX.test(s)).toBe(true);
    }
  });

  it("truncates oversized base to <= 80 chars", () => {
    const nome = "Lar " + "Antibanditismo ".repeat(20);
    const s = generateLarSlug({ nome, concelhoSlug: "lisboa" }, empty);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(SLUG_REGEX.test(s)).toBe(true);
  });
});

describe("generateAllLarSlugs — batch", () => {
  it("returns unique slugs across the batch", () => {
    const records: SlugInputs[] = [
      { nome: "Lar Aurora", concelhoSlug: "porto" },
      { nome: "Lar Aurora", concelhoSlug: "lisboa" },
      {
        nome: "Lar Aurora",
        concelhoSlug: "porto",
        freguesia: "Foz do Douro",
        alvara: "PT/2024/9999",
      },
    ];
    const slugs = generateAllLarSlugs(records);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(SLUG_REGEX.test(s)).toBe(true);
  });

  it("respects seed slugs (cascades around them)", () => {
    const seed = new Set(["lar-aurora"]);
    const slugs = generateAllLarSlugs(
      [{ nome: "Lar Aurora", concelhoSlug: "porto" }],
      seed,
    );
    expect(slugs[0]).toBe("lar-aurora-porto");
  });
});
