// Emit a draft-07 JSON Schema for ApoiosInput at build time.
//
// Output: public/schema/apoios-input.json (will end up at
// https://lar-ajuda.pt/schema/apoios-input.json post-deploy)
//
// Designed for out-of-process LLM agents to declare a tool that calls
// the lar-ajuda calculator. Mirror this file when adding/renaming a
// field in src/lib/calculator/types.ts. The hand-rolled approach here
// avoids depending on zod-to-json-schema; the calculator stays pure.
//
// Run: `npx tsx scripts/emit-schema.ts` (or wire into npm run build later).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "schema", "apoios-input.json");

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lar-ajuda.pt/schema/apoios-input.json",
  title: "ApoiosInput",
  description:
    "Input para a calculadora de apoios sociais para idosos em Portugal (lar-ajuda.pt). Apenas idade é obrigatório; restantes campos opcionais (null) — o motor calcula com a informação disponível.",
  type: "object",
  required: ["idade"],
  additionalProperties: false,
  properties: {
    idade: {
      type: "integer", minimum: 0, maximum: 120,
      description: "Idade da pessoa idosa.",
    },
    tipo_pensao: {
      type: ["string", "null"],
      enum: ["regime_geral", "regime_agricola", "nao_contributivo_social", "prestacao_social_inclusao", "nenhuma", null],
      description: "Tipo de pensão recebida.",
    },
    valor_pensao_mensal: {
      type: ["number", "null"], minimum: 0, maximum: 50000,
      description: "Pensão mensal líquida em EUR.",
    },
    outros_rendimentos_anuais: {
      type: ["number", "null"], minimum: 0, maximum: 1000000,
      description: "Outros rendimentos anuais (rendas, juros, dividendos) em EUR.",
    },
    estado_civil: {
      type: ["string", "null"],
      enum: ["solteiro", "casado", "uniao_facto", "viuvo", "divorciado", null],
    },
    valor_pensao_conjuge: { type: ["number", "null"], minimum: 0, maximum: 50000 },
    outros_rendimentos_conjuge: { type: ["number", "null"], minimum: 0, maximum: 1000000 },
    residencia_pt_anos: {
      type: ["integer", "null"], minimum: 0, maximum: 120,
      description: "Anos de residência em Portugal (CSI exige ≥ 6).",
    },
    grau_dependencia: {
      type: ["string", "null"],
      enum: ["nenhum", "1_grau", "2_grau", "nao_avaliado", null],
    },
    tem_atestado_multiusos: { type: ["boolean", "null"] },
    grau_incapacidade: {
      type: ["integer", "null"], minimum: 0, maximum: 100,
      description: "Percentagem do atestado multiusos. Limiar fiscal ≥ 60.",
    },
    situacao_residencia: {
      type: ["string", "null"],
      enum: ["casa_propria", "casa_filho_familiar", "apoio_domiciliario", "lar_privado", "lar_ipss_acordo", "lar_ipss_sem_acordo", "procura_lar", null],
    },
    mensalidade_lar: { type: ["number", "null"], minimum: 0, maximum: 50000 },
    municipio: {
      type: ["string", "null"], maxLength: 80,
      description: "Slug do concelho (ex: 'lisboa', 'porto', 'cascais').",
    },
    regime_especial: {
      type: ["string", "null"],
      enum: ["nenhum", "adse", "iasfa_adm", "sad_psp", "outro", null],
    },
    quem_paga_fatura: {
      type: ["string", "null"],
      enum: ["idoso", "filhos", "partilhada", null],
    },
    nif_idoso_em_agregado: {
      type: ["boolean", "null"],
      description: "Se o idoso vive em comunhão de habitação (>183 dias) com um filho — relevante para IRS.",
    },
    tem_cuidador_informal: { type: ["boolean", "null"] },
  },
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(schema, null, 2) + "\n", "utf8");
console.log(`Wrote ${OUT}`);
