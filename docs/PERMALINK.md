# Permalink format

The `precoslares` calculator encodes user inputs into the URL **fragment** (the part after `#`) so families can share results without a backend, and so personal financial data **never reaches a server**.

This document is a stable contract. Out-of-process consumers (LLM agents, sibling tools, external scripts) can rely on it.

## URL format

```
https://precoslares.pt/calculadora#i=<v>;<c>;<f1>;<f2>;...;<fN>
```

- **Prefix:** `i=` (literal)
- **Separator:** `;`
- **`<v>`:** schema version (currently `1`)
- **`<c>`:** constants year (currently `2026`; URL-encoded; supports mid-year corrections like `2026.1`)
- **`<f1>...<fN>`:** field values, in the **frozen positional order** below

## Field schema (v=1)

Order is **stable**. Adding a NEW field at the END is forward-compatible. Renaming, reordering, or removing requires a **`v` bump** to 2 and adding a `v=1 → v=2` migrator at `src/lib/permalink/`. The schema-stability snapshot test (`src/lib/permalink/__tests__/permalink.test.ts`) catches drift in CI.

| # | Field | Type | Encoding |
|---|---|---|---|
| 1 | `idade` | int 0..120 | decimal |
| 2 | `tipo_pensao` | enum or null | string (one of `regime_geral`, `regime_agricola`, `nao_contributivo_social`, `prestacao_social_inclusao`, `nenhuma`) |
| 3 | `valor_pensao_mensal` | num 0..50000 or null | decimal |
| 4 | `outros_rendimentos_anuais` | num 0..1000000 or null | decimal |
| 5 | `estado_civil` | enum or null | string (one of `solteiro`, `casado`, `uniao_facto`, `viuvo`, `divorciado`) |
| 6 | `valor_pensao_conjuge` | num 0..50000 or null | decimal |
| 7 | `outros_rendimentos_conjuge` | num 0..1000000 or null | decimal |
| 8 | `residencia_pt_anos` | int 0..120 or null | decimal |
| 9 | `grau_dependencia` | enum or null | string (one of `nenhum`, `1_grau`, `2_grau`, `nao_avaliado`) |
| 10 | `tem_atestado_multiusos` | bool or null | `1` true, `0` false, empty null |
| 11 | `grau_incapacidade` | int 0..100 or null | decimal |
| 12 | `situacao_residencia` | enum or null | string (one of `casa_propria`, `casa_filho_familiar`, `apoio_domiciliario`, `lar_privado`, `lar_ipss_acordo`, `lar_ipss_sem_acordo`, `procura_lar`) |
| 13 | `mensalidade_lar` | num 0..50000 or null | decimal |
| 14 | `municipio` | string ≤80 chars or null | URL-encoded |
| 15 | `regime_especial` | enum or null | string (one of `nenhum`, `adse`, `iasfa_adm`, `sad_psp`, `outro`) |
| 16 | `quem_paga_fatura` | enum or null | string (one of `idoso`, `filhos`, `partilhada`) |
| 17 | `nif_idoso_em_agregado` | bool or null | `1` true, `0` false, empty null |
| 18 | `tem_cuidador_informal` | bool or null | `1` true, `0` false, empty null |

**Null encoding:** empty string between separators. Example: `i=1;2026;80;regime_geral;350;;viuvo;;;;;;;lisboa;;;;` keeps `idade=80, tipo_pensao=regime_geral, valor_pensao_mensal=350, estado_civil=viuvo, municipio=lisboa` and `null` for everything else.

## Length limits

- **Hard cap:** 1,800 characters (messenger truncation safety — WhatsApp/SMS).
- Typical baseline scenario: ~80 characters.
- The encoder warns (does not refuse) above the cap; the URL still works in modern browsers.

## Decoder behavior

Out-of-process consumers should mirror the canonical TypeScript decoder at [`src/lib/permalink/`](../src/lib/permalink/).

| Failure mode | Result |
|---|---|
| Wrong/missing `i=` prefix | `{ ok: false, kind: "malformed" }` |
| Non-numeric `v` | `{ ok: false, kind: "malformed" }` |
| `v` ≠ 1 | `{ ok: false, kind: "unknown_version", v }` |
| Numeric field out of range | Field silently coerced to `null`; other fields preserved |
| Unknown enum value | Field silently coerced to `null`; other fields preserved |
| `idade` invalid | `{ ok: false, kind: "validation_failed", reason }` (idade is the only hard-required field) |

All other field-level garbage degrades to `null`. The calculator engine handles `null` gracefully and the user can always edit the form after restoration.

## Privacy contract

- The fragment **never reaches the server** per RFC 7231 (`Referer` strips fragments).
- **Plausible analytics is configured to send `pathname` only**; verify in network panel that the `u` POST to `/api/event` contains no `#i=...`.
- The "Reportar erro" mailto **explicitly does NOT include the fragment** in the email body — see `src/layouts/Base.astro` server-side construction.
- The user-shared URL **does** carry the data to the recipient. The privacy page (`/privacidade`) explains this clearly. Browser sync (iCloud Tabs, Chrome Sync) and clipboard sync (Universal Clipboard, Windows Cloud Clipboard) do propagate URLs.

## Schema migration policy (when v=2 ships)

When a wizard input field is renamed or removed:

1. Bump `PERMALINK_VERSION` in `src/lib/permalink/codec.ts` to `2`.
2. Add a `migrators[1]` entry in `src/lib/permalink/index.ts` that converts a v=1 raw payload to the v=2 shape.
3. Add a v=2 schema snapshot test alongside the existing one.
4. Existing v=1 permalinks remain valid forever via the migrator.

When a wizard input field is **added**:

- No version bump needed. The decoder fills the new field as `null` for old links.

## Programmatic use

```ts
import { encode, decode, CONSTANTS_VERSION } from "@precoslares/calculator/permalink";

const url = encode({ idade: 82, tipo_pensao: "regime_geral", /* ... */ }).url;
// → "https://precoslares.pt/calculadora#i=1;2026;82;regime_geral;..."

const result = decode(url.slice(url.indexOf("#")));
if (result.ok) {
  // result.input is a typed ApoiosInput
  // result.constantsVersion is the year from the link
}
```

For agents: a JSON Schema for `ApoiosInput` is published at `https://precoslares.pt/schema/apoios-input.json` (see `docs/AUTHORING.md`).
