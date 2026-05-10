// Anonymous lar/price report submission.
//
// Privacy contract:
//   - Sends ONLY the LarReport shape (no idade/pensão/dependência exata).
//   - Only fires when user explicitly opts in.
//   - Only fires when REPORT_ENDPOINT env is configured at build.
//   - All errors are silent at the user level — the calculator result
//     renders regardless of submission outcome.
//
// Failure modes:
//   - REPORT_ENDPOINT unset → returns { ok: false, kind: "disabled" }.
//   - Network error → returns { ok: false, kind: "network" }.
//   - Non-2xx response → returns { ok: false, kind: "rejected", status }.

import { REPORT_ENDPOINT } from "astro:env/client";
import type { LarReport } from "./types";

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "disabled" }
  | { ok: false; kind: "network"; message: string }
  | { ok: false; kind: "rejected"; status: number };

export function isSubmissionConfigured(): boolean {
  return typeof REPORT_ENDPOINT === "string" && REPORT_ENDPOINT.length > 0;
}

export async function submitReport(report: LarReport): Promise<SubmitResult> {
  if (!isSubmissionConfigured()) return { ok: false, kind: "disabled" };
  const endpoint = REPORT_ENDPOINT as string;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      // Don't send cookies even if endpoint is same-origin.
      credentials: "omit",
      mode: "cors",
      keepalive: true,
    });
    if (!res.ok) return { ok: false, kind: "rejected", status: res.status };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      kind: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
