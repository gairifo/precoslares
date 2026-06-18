/**
 * Scrapes all ERPI (Estrutura Residencial para Pessoas Idosas) facilities
 * from mapasocial.pt for every district in Portugal.
 *
 * Usage:
 *   npx tsx scripts/scrape-mapasocial/scrape-erpi.ts
 *
 * Output:
 *   scripts/scrape-mapasocial/output/erpi-raw.json
 */

import * as cheerio from "cheerio";
import PQueue from "p-queue";
import pRetry from "p-retry";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

const BASE_URL =
  "https://mapasocial.pt/pt/estrutura-residencial-para-pessoas-idosas-lar-de-idosos-e-residencia-/V18";

// Portuguese district codes used by mapasocial.pt
const DISTRICTS: Record<string, string> = {
  "01": "Aveiro",
  "02": "Beja",
  "03": "Braga",
  "04": "Bragança",
  "05": "Castelo Branco",
  "06": "Coimbra",
  "07": "Évora",
  "08": "Faro",
  "09": "Guarda",
  "10": "Leiria",
  "11": "Lisboa",
  "12": "Portalegre",
  "13": "Porto",
  "14": "Santarém",
  "15": "Setúbal",
  "16": "Viana do Castelo",
  "17": "Vila Real",
  "18": "Viseu",
  "31": "Ilha da Madeira",
  "41": "Ilha de Santa Maria",
  "42": "Ilha de São Miguel",
  "43": "Ilha Terceira",
  "44": "Ilha da Graciosa",
  "45": "Ilha de São Jorge",
  "46": "Ilha do Pico",
  "47": "Ilha do Faial",
  "48": "Ilha das Flores",
  "49": "Ilha do Corvo",
};

interface RawFacility {
  nome: string;
  tipo: string;
  concelho: string;
  distrito: string;
  distritoCode: string;
  detailPath: string | null;
}

interface FacilityDetail {
  nome: string;
  tipo: string;
  concelho: string;
  distrito: string;
  morada: string | null;
  codigoPostal: string | null;
  freguesia: string | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  capacidade: number | null;
  acordoSS: boolean | null;
  valencias: string[];
  naturezaJuridica: string | null;
  entidadeProprietaria: string | null;
  detailUrl: string;
}

// Known type mappings from mapasocial tipo → our LarTipo
const TIPO_MAP: Record<string, string> = {
  "associação de solidariedade social": "ipss",
  "associação": "ipss",
  "associacao de solidariedade social": "ipss",
  "fundação de solidariedade social": "ipss",
  "fundação": "ipss",
  "fundacao de solidariedade social": "ipss",
  "centro social paroquial": "ipss",
  "institutos de organizações religiosas": "ipss",
  "institutos de organizacoes religiosas": "ipss",
  "instituto de organização religiosa": "ipss",
  "irmandade da misericórdia": "misericordia",
  "irmandade da misericórdia / scm": "misericordia",
  "santa casa da misericórdia de lisboa": "misericordia",
  "misericórdia": "misericordia",
  "cooperativa de solidariedade social": "cooperativa",
  "cooperativa": "cooperativa",
  "entidade privada lucrativa": "privado",
  "privada lucrativa": "privado",
  "entidade privada": "privado",
  "casa do povo": "ipss",
  "união/federação/confederação": "ipss",
  "instituto da segurança social": "privado",
};

function classifyTipo(rawTipo: string): string {
  const key = rawTipo.toLowerCase().trim();
  if (TIPO_MAP[key]) return TIPO_MAP[key];
  if (key.includes("misericórdia") || key.includes("misericordia"))
    return "misericordia";
  if (
    key.includes("solidariedade") ||
    key.includes("paroquial") ||
    key.includes("ipss") ||
    key.includes("religiosa")
  )
    return "ipss";
  if (key.includes("cooperativa")) return "cooperativa";
  if (key.includes("privad") || key.includes("lucrativ")) return "privado";
  return "privado";
}

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

async function scrapeListPage(
  districtCode: string,
  page: number
): Promise<{ facilities: RawFacility[]; hasMore: boolean }> {
  const url = `${BASE_URL}?district=${districtCode}&pageid=${page}`;
  const html = await pRetry(() => fetchPage(url), {
    retries: 3,
    minTimeout: 2000,
  });
  const $ = cheerio.load(html);

  const facilities: RawFacility[] = [];

  // Each facility is in a card/list item with name, type, and location
  $("table tbody tr, .list-group-item, .card, article").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;
  });

  // MapaSocial uses a table or list format - let's parse the actual structure
  // Look for links to individual facilities
  $("a[href*='/pt/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const name = $(el).text().trim();
    if (href.match(/\/I\d+/) && name && name.length > 3) {
      facilities.push({
        nome: name,
        tipo: "",
        concelho: "",
        distrito: DISTRICTS[districtCode] || districtCode,
        distritoCode: districtCode,
        detailPath: href,
      });
    }
  });

  // Check for pagination - if there's a next page link
  const hasMore =
    $(`a[href*="pageid=${page + 1}"]`).length > 0 ||
    html.includes(`pageid=${page + 1}`);

  return { facilities, hasMore };
}

async function scrapeDetailPage(path: string): Promise<Partial<FacilityDetail>> {
  const url = `https://mapasocial.pt${path}`;
  const html = await pRetry(() => fetchPage(url), {
    retries: 3,
    minTimeout: 2000,
  });
  const $ = cheerio.load(html);

  const detail: Partial<FacilityDetail> = { detailUrl: url };

  // Extract key-value pairs from the detail page
  const textContent = $("body").text();

  // Name
  const h1 = $("h1").first().text().trim();
  if (h1) detail.nome = h1;

  // Look for labeled fields
  $("dt, label, .field-label, th").each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    const value = $(el).next("dd, p, span, .field-value, td").text().trim();
    if (!value) return;

    if (label.includes("morada") || label.includes("endereço"))
      detail.morada = value;
    if (label.includes("código postal") || label.includes("codigo postal"))
      detail.codigoPostal = value;
    if (label.includes("freguesia")) detail.freguesia = value;
    if (label.includes("telefone") || label.includes("contacto"))
      detail.telefone = value;
    if (label.includes("email") || label.includes("e-mail"))
      detail.email = value;
    if (label.includes("website") || label.includes("sítio"))
      detail.website = value;
    if (label.includes("capacidade")) {
      const cap = parseInt(value, 10);
      if (!isNaN(cap)) detail.capacidade = cap;
    }
    if (label.includes("natureza")) detail.naturezaJuridica = value;
    if (label.includes("entidade") || label.includes("proprietária"))
      detail.entidadeProprietaria = value;
    if (label.includes("concelho") || label.includes("município"))
      detail.concelho = value;
    if (label.includes("distrito")) detail.distrito = value;
    if (
      label.includes("acordo") &&
      (label.includes("social") || label.includes("cooperação"))
    ) {
      detail.acordoSS =
        value.toLowerCase().includes("sim") ||
        value.toLowerCase().includes("yes");
    }
  });

  // Extract tipo from natureza juridica
  if (detail.naturezaJuridica) {
    detail.tipo = classifyTipo(detail.naturezaJuridica);
  }

  return detail;
}

async function scrapeDistrict(
  districtCode: string
): Promise<RawFacility[]> {
  const districtName = DISTRICTS[districtCode] || districtCode;
  console.log(`\n📍 Scraping ${districtName} (code ${districtCode})...`);

  const allFacilities: RawFacility[] = [];
  let page = 1;

  while (true) {
    process.stdout.write(`  Page ${page}...`);
    const { facilities, hasMore } = await scrapeListPage(districtCode, page);
    console.log(` ${facilities.length} facilities`);
    allFacilities.push(...facilities);

    if (!hasMore || facilities.length === 0) break;
    page++;

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`  Total: ${allFacilities.length} facilities in ${districtName}`);
  return allFacilities;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("=== MapaSocial ERPI Scraper ===");
  console.log(`Scraping all districts for ERPI facilities...\n`);

  const allFacilities: RawFacility[] = [];

  // Scrape all districts sequentially (to be polite to the server)
  for (const [code, name] of Object.entries(DISTRICTS)) {
    try {
      const facilities = await scrapeDistrict(code);
      allFacilities.push(...facilities);
    } catch (err) {
      console.error(`  ❌ Error scraping ${name}: ${err}`);
    }
    // Rate limit between districts
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Deduplicate by detailPath
  const seen = new Set<string>();
  const unique = allFacilities.filter((f) => {
    if (!f.detailPath || seen.has(f.detailPath)) return false;
    seen.add(f.detailPath);
    return true;
  });

  console.log(`\n=== Summary ===`);
  console.log(`Total facilities found: ${unique.length}`);

  // Save raw listing
  const listOutput = join(OUTPUT_DIR, "erpi-listing.json");
  writeFileSync(listOutput, JSON.stringify(unique, null, 2), "utf-8");
  console.log(`Saved listing to ${listOutput}`);

  // Now fetch details for IPSS/misericordia/cooperativa facilities
  // (skip privado to focus on what the user wants)
  console.log(`\nFetching detail pages for non-private facilities...`);

  const queue = new PQueue({ concurrency: 3, interval: 500, intervalCap: 3 });
  const details: FacilityDetail[] = [];
  let processed = 0;

  for (const facility of unique) {
    if (!facility.detailPath) continue;

    queue.add(async () => {
      try {
        const detail = await scrapeDetailPage(facility.detailPath!);
        const merged: FacilityDetail = {
          nome: detail.nome || facility.nome,
          tipo: detail.tipo || classifyTipo(facility.tipo || ""),
          concelho: detail.concelho || facility.concelho,
          distrito: detail.distrito || facility.distrito,
          morada: detail.morada || null,
          codigoPostal: detail.codigoPostal || null,
          freguesia: detail.freguesia || null,
          telefone: detail.telefone || null,
          email: detail.email || null,
          website: detail.website || null,
          capacidade: detail.capacidade || null,
          acordoSS: detail.acordoSS ?? null,
          valencias: detail.valencias || ["erpi"],
          naturezaJuridica: detail.naturezaJuridica || null,
          entidadeProprietaria: detail.entidadeProprietaria || null,
          detailUrl: detail.detailUrl || `https://mapasocial.pt${facility.detailPath}`,
        };
        details.push(merged);
      } catch (err) {
        console.error(`  ❌ ${facility.nome}: ${err}`);
      }
      processed++;
      if (processed % 50 === 0)
        console.log(`  Processed ${processed}/${unique.length}...`);
    });
  }

  await queue.onIdle();

  console.log(`\nDetail pages fetched: ${details.length}`);

  // Classify and count
  const byTipo: Record<string, number> = {};
  for (const d of details) {
    byTipo[d.tipo] = (byTipo[d.tipo] || 0) + 1;
  }
  console.log("By tipo:", JSON.stringify(byTipo, null, 2));

  // Save full details
  const detailOutput = join(OUTPUT_DIR, "erpi-details.json");
  writeFileSync(detailOutput, JSON.stringify(details, null, 2), "utf-8");
  console.log(`Saved details to ${detailOutput}`);

  // Save IPSS-only subset
  const ipssOnly = details.filter(
    (d) => d.tipo === "ipss" || d.tipo === "misericordia" || d.tipo === "cooperativa"
  );
  const ipssOutput = join(OUTPUT_DIR, "erpi-ipss.json");
  writeFileSync(ipssOutput, JSON.stringify(ipssOnly, null, 2), "utf-8");
  console.log(`Saved IPSS/misericordia/cooperativa to ${ipssOutput} (${ipssOnly.length} entries)`);
}

main().catch(console.error);
