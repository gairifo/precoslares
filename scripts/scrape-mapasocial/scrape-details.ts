/**
 * Fetches detail pages for non-private ERPI facilities from MapaSocial.
 * Reads erpi-non-private.json (from scrape-erpi.ts) and fetches each
 * facility's detail page to extract address, phone, email, capacity, etc.
 *
 * Usage:
 *   npx tsx scripts/scrape-mapasocial/scrape-details.ts
 *
 * Output:
 *   scripts/scrape-mapasocial/output/erpi-ipss-details.json
 */

import * as cheerio from "cheerio";
import PQueue from "p-queue";
import pRetry from "p-retry";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

interface ParsedEntry {
  nome: string;
  tipo: string;
  tipo_raw: string;
  concelho: string;
  distrito: string;
  detailPath: string;
}

interface FacilityDetail {
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

const VALENCIA_MAP: Record<string, string> = {
  "estrutura residencial para pessoas idosas": "erpi",
  "centro de dia": "centro_dia",
  "serviço de apoio domiciliário (idosos)": "sad",
  "serviço de apoio domiciliário": "sad",
  "centro de convívio": "centro_convivio",
};

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "precoslares-bot/1.0 (+https://precoslares.pt; non-commercial research)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractField(
  $: cheerio.CheerioAPI,
  label: string
): string | null {
  let result: string | null = null;
  $("strong").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes(label.toLowerCase())) {
      // Structure 1: <td><strong>Label</strong></td><td>Value</td>
      const parentTd = $(el).closest("td");
      if (parentTd.length) {
        const nextTd = parentTd.next("td");
        if (nextTd.length) {
          const val = nextTd.text().trim().replace(/\s+/g, " ");
          if (val) { result = val; return false; }
        }
      }
      // Structure 2: <strong>Label</strong><br/> Value (in same div)
      const parent = $(el).parent();
      const fullText = parent.text().trim();
      const labelText = $(el).text().trim();
      const afterLabel = fullText.slice(fullText.indexOf(labelText) + labelText.length).trim();
      if (afterLabel) { result = afterLabel.replace(/\s+/g, " "); return false; }
    }
  });
  return result;
}

function scrapeDetail(
  html: string,
  entry: ParsedEntry
): FacilityDetail {
  const $ = cheerio.load(html);

  const nome =
    $("h1").first().text().trim() ||
    extractField($, "Designação") ||
    entry.nome;

  const entidade = extractField($, "Entidade Proprietária");
  const natureza = extractField($, "Natureza Jurídica");
  const morada = extractField($, "Morada");
  const codigoPostalRaw = extractField($, "Código postal") ||
    extractField($, "Codigo postal");

  let codigoPostal: string | null = null;
  let localidade: string | null = null;
  if (codigoPostalRaw) {
    const m = codigoPostalRaw.match(/^(\d{4}-\d{3})\s*(.*)$/);
    if (m) {
      codigoPostal = m[1];
      localidade = m[2].trim() || null;
    } else {
      codigoPostal = codigoPostalRaw;
    }
  }

  const telefoneRaw = extractField($, "Telefone") || extractField($, "Telefones");
  const telefone = telefoneRaw
    ? telefoneRaw.replace(/\s+/g, "").split(/[;,/]/).filter(Boolean)[0] || null
    : null;

  const email = extractField($, "Email") || extractField($, "Emails");
  const fax = extractField($, "Fax");

  // Parse services table for valencias and capacity
  const valencias: string[] = [];
  let capacidade: number | null = null;
  let utentes: number | null = null;
  let acordoSS: boolean | null = null;

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const serviceName = $(cells[0]).text().trim().toLowerCase();
      const cap = parseInt($(cells[1]).text().trim(), 10);

      for (const [pattern, valencia] of Object.entries(VALENCIA_MAP)) {
        if (serviceName.includes(pattern)) {
          if (!valencias.includes(valencia)) valencias.push(valencia);
          if (valencia === "erpi" && !isNaN(cap)) {
            capacidade = (capacidade || 0) + cap;
          }
          break;
        }
      }

      // Check for utentes column (usually 3rd)
      if (cells.length >= 3 && serviceName.includes("estrutura residencial")) {
        const ut = parseInt($(cells[2]).text().trim(), 10);
        if (!isNaN(ut)) utentes = ut;
      }

      // Check for acordo SS (look for "Sim" in any cell)
      if (serviceName.includes("estrutura residencial")) {
        const rowText = $(row).text().toLowerCase();
        if (rowText.includes("sim")) acordoSS = true;
        else if (rowText.includes("não") || rowText.includes("nao"))
          acordoSS = acordoSS ?? false;
      }
    }
  });

  if (valencias.length === 0) valencias.push("erpi");

  return {
    nome,
    tipo: entry.tipo,
    tipo_raw: entry.tipo_raw,
    concelho: localidade || entry.concelho,
    distrito: entry.distrito,
    entidadeProprietaria: entidade,
    naturezaJuridica: natureza,
    morada,
    codigoPostal,
    localidade,
    telefone,
    email,
    fax,
    capacidade,
    utentes,
    valencias,
    acordoSS,
    detailUrl: `https://mapasocial.pt${entry.detailPath}`,
  };
}

async function main() {
  const inputPath = join(OUTPUT_DIR, "erpi-non-private.json");
  const entries: ParsedEntry[] = JSON.parse(
    readFileSync(inputPath, "utf-8")
  );
  console.log(`Loaded ${entries.length} non-private ERPI facilities`);

  const queue = new PQueue({ concurrency: 5, interval: 300, intervalCap: 5 });
  const details: FacilityDetail[] = [];
  let processed = 0;
  let errors = 0;

  for (const entry of entries) {
    if (!entry.detailPath) continue;

    queue.add(async () => {
      try {
        const url = `https://mapasocial.pt${entry.detailPath}`;
        const html = await pRetry(() => fetchPage(url), {
          retries: 3,
          minTimeout: 2000,
        });
        const detail = scrapeDetail(html, entry);
        details.push(detail);
      } catch (err) {
        errors++;
        if (errors <= 10) console.error(`  ❌ ${entry.nome}: ${err}`);
      }
      processed++;
      if (processed % 100 === 0)
        console.log(`  Processed ${processed}/${entries.length} (${errors} errors)...`);
    });
  }

  await queue.onIdle();
  console.log(`\nDone! Processed ${processed}, errors: ${errors}`);
  console.log(`Details extracted: ${details.length}`);

  // Stats
  const withAddress = details.filter((d) => d.morada).length;
  const withPhone = details.filter((d) => d.telefone).length;
  const withEmail = details.filter((d) => d.email).length;
  const withCapacity = details.filter((d) => d.capacidade).length;

  console.log(`\nData quality:`);
  console.log(`  With address:  ${withAddress} (${Math.round((withAddress / details.length) * 100)}%)`);
  console.log(`  With phone:    ${withPhone} (${Math.round((withPhone / details.length) * 100)}%)`);
  console.log(`  With email:    ${withEmail} (${Math.round((withEmail / details.length) * 100)}%)`);
  console.log(`  With capacity: ${withCapacity} (${Math.round((withCapacity / details.length) * 100)}%)`);

  const outputPath = join(OUTPUT_DIR, "erpi-ipss-details.json");
  writeFileSync(outputPath, JSON.stringify(details, null, 2), "utf-8");
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(console.error);
