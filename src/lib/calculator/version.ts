// Constants version identifier. Encoded into permalinks as `c=...` so
// that re-decoded results carry their year-of-reference.
//
// Per Enhancement Summary §7: this lives in the engine, not the UI.
// Re-export from index.ts. Permalink and Wizard import from here.
//
// String, not number — supports mid-year corrections like "2026.1".

import { C } from "./constants";

export const CONSTANTS_VERSION: string = String(C.ano_referencia);
