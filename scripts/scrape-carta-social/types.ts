// Shared types for the Carta Social scrape pipeline.
// Raw* types = cheerio parser output (no Zod, no domain logic).
// These flow into mapper.ts → Lar (schema.ts).

export interface RawResponse {
  tipoLabel: string;
  capacidade: number | null;
  vagas: number | null;
  utentes: number | null;
  horario: string | null;
  /** Parsed from "Sim"/"Não" in the "Acordo com SS" column. */
  acordoSS: boolean;
  ultimaAtualizacao: string | null;
}

export interface RawEquipment {
  idEquipment: number;
  nome: string;
  naturezaJuridica: string;
  entidadeProprietaria: string | null;
  morada: string | null;
  /** Postal code with embedded locality, e.g. "4700-326 BRAGA". */
  codigoPostal: string | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  respostas: RawResponse[];
}

export type ParseResult =
  | { ok: true; equipment: RawEquipment }
  | { ok: false; reason: "not_found" | "service_error" | "parse_error"; detail?: string };
