// Field-level sanitizers for scraped Lar data.
//
// Carta Social HTML can contain user-entered, occasionally hostile, or
// just plain malformed contact fields. The mapper invokes these helpers
// at the source boundary and DROPS the field when the helper returns
// null — better a sparse record than an unsafe one.
//
// All helpers are pure and accept `unknown` so a mapper can pipe raw
// cheerio `.text()` output without casting.
//
// Re-checked at build time by the Zod schema (.email() / .url() / regex
// on telefone). These helpers exist so the mapper rejects loudly with
// useful logs before the data ever hits Zod.

const PHONE_REGEX = /^[+\d\s()\-]{6,20}$/;
const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function asTrimmed(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Accept only http(s) URLs. Rejects `javascript:`, `data:`, `file:`,
 * malformed URLs, and URLs over 2 kB. Returns the canonicalized form
 * (via WHATWG URL) or null.
 */
export function safeHttpUrl(v: unknown): string | null {
  const s = asTrimmed(v);
  if (!s || s.length > 2048) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || u.hostname.length > 253) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Accept only well-formed email addresses, length capped. Returns the
 * lowercased local + domain or null.
 */
export function safeEmail(v: unknown): string | null {
  const s = asTrimmed(v);
  if (!s || s.length > 254) return null;
  if (!EMAIL_REGEX.test(s)) return null;
  // Reject control / whitespace chars that the regex's character classes
  // already exclude, but double-check after lowercasing.
  const lower = s.toLowerCase();
  if (/\s/.test(lower)) return null;
  return lower;
}

/**
 * Accept only phone-shaped strings (digits + +-()/space, 6–20 chars).
 * Returns the trimmed input or null.
 */
export function safePhone(v: unknown): string | null {
  const s = asTrimmed(v);
  if (!s) return null;
  return PHONE_REGEX.test(s) ? s : null;
}
