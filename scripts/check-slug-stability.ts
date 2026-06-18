// CI guard: every slug present in the previous commit's lares.json must appear
// either in the current lares.json or in lares.tombstones.json.
//
// New slugs in current are allowed. Removed slugs without a tombstone fail.
//
// Escape hatches:
//   --bootstrap            skips the check (flag, for first-ever dataset commit)
//   [skip slug-stability]  in HEAD commit message also skips
//
// Wired into .github/workflows/ci.yml (after install, before build).

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LARES_PATH = resolve(ROOT, "src", "data", "lares.json");
const TOMBSTONES_PATH = resolve(ROOT, "src", "data", "lares.tombstones.json");

// Pure predicate — separated for testability.
export function checkSlugStability(
  previousSlugs: string[],
  currentSlugs: string[],
  tombstoneSlugs: string[],
): { ok: boolean; missing: string[] } {
  const current = new Set(currentSlugs);
  const tombstoned = new Set(tombstoneSlugs);
  const missing = previousSlugs.filter((s) => !current.has(s) && !tombstoned.has(s));
  return { ok: missing.length === 0, missing };
}

function headCommitMessage(): string {
  try {
    return execSync("git log -1 --format=%B HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function previousLaresSlugs(): string[] | null {
  try {
    const json = execSync("git show HEAD~1:src/data/lares.json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = JSON.parse(json) as { lares?: { slug: string }[] };
    return (data.lares ?? []).map((l) => l.slug);
  } catch {
    // No previous commit or file absent in HEAD~1 — bootstrap scenario.
    return null;
  }
}

function currentLaresSlugs(): string[] {
  const data = JSON.parse(readFileSync(LARES_PATH, "utf-8")) as {
    lares?: { slug: string }[];
  };
  return (data.lares ?? []).map((l) => l.slug);
}

function tombstoneSlugs(): string[] {
  if (!existsSync(TOMBSTONES_PATH)) return [];
  const data = JSON.parse(readFileSync(TOMBSTONES_PATH, "utf-8")) as {
    tombstones?: { slug: string }[];
  };
  return (data.tombstones ?? []).map((t) => t.slug);
}

export function main(args: string[]): number {
  if (args.includes("--bootstrap")) {
    console.log("[slug-stability] --bootstrap flag set — skipping check");
    return 0;
  }

  const msg = headCommitMessage();
  if (msg.includes("[skip slug-stability]")) {
    console.log('[slug-stability] "[skip slug-stability]" in commit message — skipping check');
    return 0;
  }

  const prev = previousLaresSlugs();
  if (prev === null) {
    console.log("[slug-stability] No previous commit with lares.json — bootstrap mode, skipping");
    return 0;
  }

  const current = currentLaresSlugs();
  const tombstones = tombstoneSlugs();

  const { ok, missing } = checkSlugStability(prev, current, tombstones);

  if (!ok) {
    console.error(`[slug-stability] ❌ ${missing.length} slug(s) removed without a tombstone:`);
    for (const slug of missing) {
      console.error(`  - ${slug}`);
    }
    console.error("");
    console.error("Add each slug to src/data/lares.tombstones.json before committing,");
    console.error('or include "[skip slug-stability]" in the commit message to bypass.');
    return 1;
  }

  console.log(`[slug-stability] ✓ ${prev.length} slug(s) stable, 0 missing tombstones`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
