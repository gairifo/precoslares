import { describe, it, expect } from "vitest";
import { decode, encode, MAX_HASH_LENGTH, PERMALINK_VERSION } from "..";
import { VALIDATOR_FIELDS } from "../validator";
import { FIELDS } from "../codec";
import type { ApoiosInput } from "../../calculator/types";

const baseline: ApoiosInput = {
  idade: 82,
  tipo_pensao: "regime_geral",
  valor_pensao_mensal: 350,
  outros_rendimentos_anuais: 0,
  estado_civil: "viuvo",
  valor_pensao_conjuge: null,
  outros_rendimentos_conjuge: null,
  residencia_pt_anos: 70,
  grau_dependencia: "2_grau",
  tem_atestado_multiusos: true,
  grau_incapacidade: 90,
  situacao_residencia: "lar_privado",
  mensalidade_lar: 1800,
  municipio: "lisboa",
  regime_especial: "nenhum",
  quem_paga_fatura: "filhos",
  nif_idoso_em_agregado: false,
  tem_cuidador_informal: null,
};

describe("permalink encode/decode round-trip", () => {
  it("round-trips the baseline scenario", () => {
    const enc = encode(baseline, "2026");
    const dec = decode(enc.hash);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.input).toEqual(baseline);
    expect(dec.constantsVersion).toBe("2026");
    expect(dec.v).toBe(PERMALINK_VERSION);
  });

  it("handles all-null optional fields", () => {
    const minimal: ApoiosInput = { idade: 78 } as ApoiosInput;
    // Fill defaults that match the empty wizard
    const filled: ApoiosInput = {
      ...minimal,
      tipo_pensao: null,
      valor_pensao_mensal: null,
      outros_rendimentos_anuais: null,
      estado_civil: null,
      valor_pensao_conjuge: null,
      outros_rendimentos_conjuge: null,
      residencia_pt_anos: null,
      grau_dependencia: null,
      tem_atestado_multiusos: null,
      grau_incapacidade: null,
      situacao_residencia: null,
      mensalidade_lar: null,
      municipio: null,
      regime_especial: null,
      quem_paga_fatura: null,
      nif_idoso_em_agregado: null,
      tem_cuidador_informal: null,
    };
    const enc = encode(filled, "2026");
    const dec = decode(enc.hash);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.input).toEqual(filled);
  });

  it("round-trips boolean true/false distinctly from null", () => {
    const a = encode({ ...baseline, tem_atestado_multiusos: true } as ApoiosInput, "2026");
    const b = encode({ ...baseline, tem_atestado_multiusos: false } as ApoiosInput, "2026");
    const c = encode({ ...baseline, tem_atestado_multiusos: null } as ApoiosInput, "2026");
    expect(a.hash).not.toBe(b.hash);
    expect(b.hash).not.toBe(c.hash);
    const da = decode(a.hash); const db = decode(b.hash); const dc = decode(c.hash);
    if (da.ok) expect(da.input.tem_atestado_multiusos).toBe(true);
    if (db.ok) expect(db.input.tem_atestado_multiusos).toBe(false);
    if (dc.ok) expect(dc.input.tem_atestado_multiusos).toBeNull();
  });

  it("URL-encodes municipio with non-ASCII safely", () => {
    const enc = encode({ ...baseline, municipio: "póvoa de varzim" } as ApoiosInput, "2026");
    const dec = decode(enc.hash);
    if (dec.ok) expect(dec.input.municipio).toBe("póvoa de varzim");
  });
});

describe("permalink failure modes", () => {
  it("rejects a hash without the i= prefix as malformed", () => {
    expect(decode("#garbage")).toEqual({ ok: false, kind: "malformed" });
  });

  it("rejects a hash with unknown version", () => {
    const r = decode("#i=2;2026;80");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("unknown_version");
      if (r.kind === "unknown_version") expect(r.v).toBe(2);
    }
  });

  it("rejects out-of-range numeric fields as validation_failed", () => {
    // idade = 999 (out of 0..120) → validation_failed
    const r = decode("#i=1;2026;999");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("validation_failed");
  });

  it("rejects negative pensão as null (silently degrades) but keeps idade valid", () => {
    // idade=80, tipo_pensao=regime_geral, valor_pensao_mensal=-100 → null
    const r = decode("#i=1;2026;80;regime_geral;-100");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.idade).toBe(80);
      expect(r.input.tipo_pensao).toBe("regime_geral");
      expect(r.input.valor_pensao_mensal).toBeNull();
    }
  });

  it("rejects bogus enum value as null", () => {
    const r = decode("#i=1;2026;80;BOGUS_ENUM_VALUE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.tipo_pensao).toBeNull();
  });
});

describe("permalink length", () => {
  it("baseline hash stays well under MAX_HASH_LENGTH", () => {
    const enc = encode(baseline, "2026");
    expect(enc.hash.length).toBeLessThan(MAX_HASH_LENGTH);
    expect(enc.truncationRisk).toBe(false);
    // sanity: typical case should be tiny
    expect(enc.hash.length).toBeLessThan(150);
  });
});

describe("permalink schema stability (fail-closed)", () => {
  // SCHEMA STABILITY: this snapshot guards against accidental rename or
  // reorder of FIELDS. Either change requires bumping PERMALINK_VERSION
  // and adding a v→2 migrator. If you intentionally bumped the version,
  // update this snapshot accordingly.
  it("FIELDS array order is stable (snapshot)", () => {
    expect(FIELDS).toMatchInlineSnapshot(`
      [
        "idade",
        "tipo_pensao",
        "valor_pensao_mensal",
        "outros_rendimentos_anuais",
        "estado_civil",
        "valor_pensao_conjuge",
        "outros_rendimentos_conjuge",
        "residencia_pt_anos",
        "grau_dependencia",
        "tem_atestado_multiusos",
        "grau_incapacidade",
        "situacao_residencia",
        "mensalidade_lar",
        "municipio",
        "regime_especial",
        "quem_paga_fatura",
        "nif_idoso_em_agregado",
        "tem_cuidador_informal",
      ]
    `);
  });

  it("VALIDATOR_FIELDS matches CODEC FIELDS exactly", () => {
    expect(VALIDATOR_FIELDS).toEqual(FIELDS);
  });
});
