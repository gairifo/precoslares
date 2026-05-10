import data from "./constants_2026.json" with { type: "json" };

// Frozen at module load. To update for a new fiscal year, replace the JSON
// file and bump `ano_referencia`.
export const C = Object.freeze(data);
export type Constantes = typeof data;
