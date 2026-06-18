import { describe, it, expect } from "vitest";
import { safeHttpUrl, safeEmail, safePhone } from "../safe-fields";

describe("safeHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(safeHttpUrl("https://www.scml.pt")).toBe("https://www.scml.pt/");
    expect(safeHttpUrl("http://example.pt/lar/1")).toBe("http://example.pt/lar/1");
  });

  it("rejects non-http schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeHttpUrl("ftp://example.com")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
  });

  it("rejects 2 kB+ URLs", () => {
    const long = "https://example.com/" + "a".repeat(2048);
    expect(safeHttpUrl(long)).toBeNull();
  });
});

describe("safeEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(safeEmail("geral@scml.pt")).toBe("geral@scml.pt");
    expect(safeEmail("Foo.Bar+tag@example.co.uk")).toBe("foo.bar+tag@example.co.uk");
  });

  it("rejects malformed addresses", () => {
    expect(safeEmail("not-an-email")).toBeNull();
    expect(safeEmail("a@b")).toBeNull();
    expect(safeEmail("@example.com")).toBeNull();
    expect(safeEmail("a@b@c.com")).toBeNull();
    expect(safeEmail("")).toBeNull();
    expect(safeEmail(null)).toBeNull();
  });

  it("rejects overly long addresses", () => {
    expect(safeEmail("a".repeat(250) + "@b.com")).toBeNull();
  });
});

describe("safePhone", () => {
  it("accepts PT-style phone strings", () => {
    expect(safePhone("+351 213 235 000")).toBe("+351 213 235 000");
    expect(safePhone("213235000")).toBe("213235000");
    expect(safePhone("(351) 213-235-000")).toBe("(351) 213-235-000");
  });

  it("rejects garbage and overlong input", () => {
    expect(safePhone("call us!")).toBeNull();
    expect(safePhone("12345")).toBeNull(); // < 6
    expect(safePhone("1".repeat(25))).toBeNull(); // > 20
    expect(safePhone("")).toBeNull();
    expect(safePhone(null)).toBeNull();
    expect(safePhone(213235000)).toBeNull(); // not a string
  });
});
