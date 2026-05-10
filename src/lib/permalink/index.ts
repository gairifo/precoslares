// Public API for the permalink module.
//
// Two exports:
//   encode(input, constantsVersion?) → "i=1;2026;80;..."
//   decode(hash)                     → discriminated union (success or
//                                       one of malformed | unknown_version
//                                       | validation_failed)
//
// Designed to be safe to call from the React island AND from a Node
// script. Pure: no DOM, no fetch.

import type { ApoiosInput } from "../calculator/types";
import { CONSTANTS_VERSION } from "../calculator/version";
import {
  decodePayload,
  encodePayload,
  MAX_HASH_LENGTH,
  PERMALINK_VERSION,
} from "./codec";
import { validateAndCoerce } from "./validator";

export interface EncodeResult {
  hash: string;             // includes "i=" prefix
  url: string;              // pathname + "#" + hash, ready for clipboard
  truncationRisk: boolean;  // true if longer than MAX_HASH_LENGTH
}

export type DecodeResult =
  | {
      ok: true;
      input: ApoiosInput;
      constantsVersion: string;
      v: number;
    }
  | { ok: false; kind: "malformed" }
  | { ok: false; kind: "unknown_version"; v: number }
  | { ok: false; kind: "validation_failed"; reason: string };

export function encode(
  input: ApoiosInput,
  constantsVersion: string = CONSTANTS_VERSION
): EncodeResult {
  const hash = encodePayload(input, constantsVersion);
  const truncationRisk = hash.length > MAX_HASH_LENGTH;
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/calculadora";
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}#${hash}`
      : `https://precoslares.pt${path}#${hash}`;
  return { hash, url, truncationRisk };
}

export function decode(rawHash: string): DecodeResult {
  const decoded = decodePayload(rawHash);
  if (!decoded.ok) {
    if (decoded.kind === "unknown_version") {
      return { ok: false, kind: "unknown_version", v: decoded.v ?? 0 };
    }
    return { ok: false, kind: "malformed" };
  }
  const validated = validateAndCoerce(decoded.payload.raw);
  if (!validated.ok) {
    return {
      ok: false,
      kind: "validation_failed",
      reason: validated.reason,
    };
  }
  return {
    ok: true,
    input: validated.input,
    constantsVersion: decoded.payload.c,
    v: decoded.payload.v,
  };
}

export { PERMALINK_VERSION, MAX_HASH_LENGTH } from "./codec";
export { CONSTANTS_VERSION } from "../calculator/version";
