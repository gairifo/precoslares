// Emit a slim lares index suitable for client-side bundling.
//
// Source: src/data/lares.json (full dataset, ~400 bytes/entry at scale).
// Output: src/data/lares-slim.json (~30-50 bytes/entry).
//
// Consumed by: src/lib/lares/client.ts (imported by React islands).
//
// Rationale: at ~2,700 entries the full JSON is ~1.5 MB; importing it
// from a client island would balloon the Wizard chunk. The slim shape
// is { slug, nome, concelhoSlug } only — enough for the autocomplete
// <datalist> in Stage 2 Branch A.
//
// Wired into npm run build (package.json scripts.build). Pedro never
// edits lares-slim.json by hand — it regenerates on every build.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = resolve(__dirname, "..", "src", "data", "lares.json");
const OUT = resolve(__dirname, "..", "src", "data", "lares-slim.json");

interface LarFull {
  slug: string;
  nome: string;
  concelhoSlug: string;
}

const raw = JSON.parse(await readFile(IN, "utf8")) as { lares: LarFull[] };

const slim = raw.lares.map((l) => ({
  slug: l.slug,
  nome: l.nome,
  concelhoSlug: l.concelhoSlug,
}));

await writeFile(OUT, JSON.stringify(slim) + "\n", "utf8");
console.log(`Wrote ${OUT} (${slim.length} entries)`);
