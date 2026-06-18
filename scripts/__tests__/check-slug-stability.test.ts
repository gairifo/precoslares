import { describe, it, expect } from "vitest";
import { checkSlugStability, main } from "../check-slug-stability.js";

describe("checkSlugStability — clean diff", () => {
  it("passes when all previous slugs are still present", () => {
    const { ok, missing } = checkSlugStability(
      ["slug-a", "slug-b"],
      ["slug-a", "slug-b", "slug-c"], // slug-c is new — allowed
      [],
    );
    expect(ok).toBe(true);
    expect(missing).toEqual([]);
  });

  it("passes when previous is empty (no slugs to lose)", () => {
    const { ok } = checkSlugStability([], ["slug-a", "slug-b"], []);
    expect(ok).toBe(true);
  });

  it("allows new slugs that were not in previous", () => {
    const { ok } = checkSlugStability(["slug-a"], ["slug-a", "slug-new-1", "slug-new-2"], []);
    expect(ok).toBe(true);
  });
});

describe("checkSlugStability — removed without tombstone", () => {
  it("fails when a slug is removed and has no tombstone", () => {
    const { ok, missing } = checkSlugStability(
      ["slug-a", "slug-b"],
      ["slug-a"], // slug-b gone
      [],
    );
    expect(ok).toBe(false);
    expect(missing).toEqual(["slug-b"]);
  });

  it("reports all slugs missing tombstones", () => {
    const { ok, missing } = checkSlugStability(
      ["slug-a", "slug-b", "slug-c"],
      [],
      ["slug-b"], // only slug-b tombstoned
    );
    expect(ok).toBe(false);
    expect(missing).toContain("slug-a");
    expect(missing).toContain("slug-c");
    expect(missing).not.toContain("slug-b");
  });
});

describe("checkSlugStability — removed with tombstone", () => {
  it("passes when every removed slug has a tombstone", () => {
    const { ok, missing } = checkSlugStability(
      ["slug-a", "slug-b"],
      ["slug-a"],
      ["slug-b"], // tombstoned
    );
    expect(ok).toBe(true);
    expect(missing).toEqual([]);
  });

  it("passes when multiple removed slugs all have tombstones", () => {
    const { ok } = checkSlugStability(
      ["slug-a", "slug-b", "slug-c"],
      [],
      ["slug-a", "slug-b", "slug-c"],
    );
    expect(ok).toBe(true);
  });
});

describe("main — bootstrap mode via override flag", () => {
  it("exits 0 with --bootstrap flag without reading any files", () => {
    const code = main(["--bootstrap"]);
    expect(code).toBe(0);
  });

  it("--bootstrap takes precedence over other args", () => {
    const code = main(["--bootstrap", "--some-other-flag"]);
    expect(code).toBe(0);
  });
});
