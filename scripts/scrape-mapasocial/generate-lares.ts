/**
 * Merges listing data (concelho, distrito, tipo) with detail data (address,
 * phone, email, capacity, valencias) and generates lares.json entries.
 *
 * Usage:
 *   npx tsx scripts/scrape-mapasocial/generate-lares.ts
 *
 * Output:
 *   src/data/lares.json (overwrites)
 */

import slugify from "@sindresorhus/slugify";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

interface ListingEntry {
  nome: string;
  tipo: string;
  tipo_raw: string;
  concelho: string;
  distrito: string;
  detailPath: string;
}

interface DetailEntry {
  nome: string;
  tipo: string;
  tipo_raw: string;
  concelho: string;
  distrito: string;
  entidadeProprietaria: string | null;
  naturezaJuridica: string | null;
  morada: string | null;
  codigoPostal: string | null;
  localidade: string | null;
  telefone: string | null;
  email: string | null;
  fax: string | null;
  capacidade: number | null;
  utentes: number | null;
  valencias: string[];
  acordoSS: boolean | null;
  detailUrl: string;
}

interface LarEntry {
  slug: string;
  nome: string;
  tipo: string;
  acordoSS: boolean;
  valencias: string[];
  capacidade?: number;
  concelhoSlug: string;
  distritoSlug: string;
  freguesia?: string;
  morada?: string;
  codigoPostal?: string;
  telefone?: string;
  email?: string;
  website?: string;
  source: string;
  notas?: string[];
}

// Distrito name → slug
const DISTRITO_SLUG: Record<string, string> = {
  Aveiro: "aveiro",
  Beja: "beja",
  Braga: "braga",
  Bragança: "braganca",
  "Castelo Branco": "castelo-branco",
  Coimbra: "coimbra",
  Évora: "evora",
  Faro: "faro",
  Guarda: "guarda",
  Leiria: "leiria",
  Lisboa: "lisboa",
  Portalegre: "portalegre",
  Porto: "porto",
  Santarém: "santarem",
  Setúbal: "setubal",
  "Viana do Castelo": "viana-do-castelo",
  "Vila Real": "vila-real",
  Viseu: "viseu",
};

function titleCase(s: string): string {
  const lower = [
    "de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no",
    "nas", "nos", "por", "para", "com",
  ];
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !lower.includes(w))
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w
    )
    .join(" ");
}

function makeConcelhoSlug(concelho: string): string {
  return slugify(concelho, { lowercase: true, separator: "-" });
}

function generateSlug(nome: string, concelhoSlug: string, existing: Set<string>): string {
  let base = slugify(nome, { lowercase: true, separator: "-" });
  // Trim to reasonable length
  if (base.length > 60) {
    base = base.slice(0, 60).replace(/-$/, "");
  }

  let slug = base;
  let counter = 2;
  while (existing.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  existing.add(slug);
  return slug;
}

function formatPhone(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `+351 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith("351")) return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return undefined;
}

function cleanEmail(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(/[;,/]/)[0].trim().replace(/\s+/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) return first;
  return undefined;
}

function formatAddress(raw: string | null): string | undefined {
  if (!raw) return undefined;
  // Title-case the address while preserving abbreviations
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(", ")
    .map(part => titleCase(part))
    .join(", ")
    .replace(/\bN\.?º\b/gi, "nº");
}

function main() {
  const listingPath = join(__dirname, "output", "erpi-non-private.json");
  const detailPath = join(__dirname, "output", "erpi-ipss-details.json");
  const existingPath = join(ROOT, "src", "data", "lares.json");

  const listing: ListingEntry[] = JSON.parse(readFileSync(listingPath, "utf-8"));
  const details: DetailEntry[] = JSON.parse(readFileSync(detailPath, "utf-8"));
  const existing = JSON.parse(readFileSync(existingPath, "utf-8"));
  const existingLares: LarEntry[] = existing.lares || [];

  // Preserve hand-curated entries (especially those with preco data)
  const preservedSlugs = new Set<string>();
  const preservedNames = new Set<string>();
  for (const l of existingLares) {
    preservedSlugs.add(l.slug);
    preservedNames.add(l.nome.toLowerCase());
  }
  console.log(`Preserving ${existingLares.length} existing entries (${existingLares.filter((l: any) => l.preco).length} with pricing)`);

  // Build lookup from detailPath → listing entry (for concelho)
  const listingByPath = new Map<string, ListingEntry>();
  for (const l of listing) {
    listingByPath.set(l.detailPath, l);
  }

  const slugs = new Set<string>(preservedSlugs);
  const lares: LarEntry[] = [...existingLares];
  let skipped = 0;
  let duplicates = 0;

  for (const detail of details) {
    const path = detail.detailUrl.replace("https://mapasocial.pt", "");
    const listEntry = listingByPath.get(path);

    const concelho = listEntry?.concelho || detail.concelho;
    if (!concelho || concelho === "-") {
      skipped++;
      continue;
    }

    const distrito = detail.distrito;
    const distritoSlug = DISTRITO_SLUG[distrito];
    if (!distritoSlug) {
      skipped++;
      continue;
    }

    const nome = titleCase(detail.nome);

    // Skip if we already have this facility from hand-curated data
    if (preservedNames.has(nome.toLowerCase())) {
      duplicates++;
      continue;
    }

    const concelhoSlug = makeConcelhoSlug(concelho);
    const slug = generateSlug(nome, concelhoSlug, slugs);

    const tipo = detail.tipo as "ipss" | "misericordia" | "cooperativa";
    const phone = formatPhone(detail.telefone);
    const morada = formatAddress(detail.morada);

    const entry: LarEntry = {
      slug,
      nome,
      tipo,
      acordoSS: true,
      valencias: detail.valencias.length > 0 ? detail.valencias : ["erpi"],
      concelhoSlug,
      distritoSlug,
      source: "seeded",
    };

    if (detail.capacidade) entry.capacidade = detail.capacidade;
    if (morada) entry.morada = morada;
    if (detail.codigoPostal) entry.codigoPostal = detail.codigoPostal;
    if (phone) entry.telefone = phone;
    const email = cleanEmail(detail.email);
    if (email) entry.email = email;

    lares.push(entry);
  }

  const newCount = lares.length - existingLares.length;
  console.log(`Added ${newCount} new entries (skipped ${skipped}, ${duplicates} duplicates with existing)`);
  console.log(`Total: ${lares.length} entries`);

  const output = {
    _meta: {
      version: 2,
      source: "Hand-curated seed v0 + MapaSocial.pt scrape (2026-06-18). Public information only — IPSS / Misericórdia / Cooperativa ERPI facilities.",
      ingest_path: "Sustainable v1 path: request formal data agreement with GEP (cartasocial@gep.mtsss.pt) for the full ~2,700-record dataset.",
      lastUpdated: "2026-06-18",
      _field_legend: "tipo: ipss | misericordia | privado | cooperativa. acordoSS: true if has acordo de cooperação com Segurança Social. preco.source: operator_published | user_reported | estimated. preco.min/max in EUR/mês.",
    },
    lares,
  };

  const outputPath = join(ROOT, "src", "data", "lares.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${outputPath}`);

  // Stats
  const byTipo: Record<string, number> = {};
  const byDistrito: Record<string, number> = {};
  for (const l of lares) {
    byTipo[l.tipo] = (byTipo[l.tipo] || 0) + 1;
    byDistrito[l.distritoSlug] = (byDistrito[l.distritoSlug] || 0) + 1;
  }
  console.log("\nBy tipo:", JSON.stringify(byTipo));
  console.log("\nBy distrito:");
  for (const [d, n] of Object.entries(byDistrito).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(25)} ${n}`);
  }

  const totalCap = lares.reduce((sum, l) => sum + (l.capacidade || 0), 0);
  console.log(`\nTotal capacity: ${totalCap.toLocaleString()} places`);
}

main();
