import { useEffect, useMemo, useRef, useState } from "react";
import { calcular } from "~/lib/calculator";
import { CONSTANTS_VERSION } from "~/lib/calculator/version";
import { decode, encode, type DecodeResult } from "~/lib/permalink";
import { Events, track } from "~/lib/analytics";
import { CONCELHOS } from "~/lib/lares/concelhos";
import { getAllLares, getLaresByConcelho } from "~/lib/lares";
import {
  SERVICOS_LABELS,
  TENURE_LABELS,
  TIPO_LABELS,
  type LarReport,
  type LarReportTipo,
  type ServicoIncluido,
  type TenureBand,
} from "~/lib/report/types";
import { isSubmissionConfigured, submitReport } from "~/lib/report/submit";
import type {
  ApoioOutput,
  ApoiosInput,
  ApoiosResult,
  EstadoCivil,
  GrauDependencia,
  RegimeEspecial,
  SituacaoResidencia,
  TipoPensao,
  QuemPagaFatura,
} from "~/lib/calculator/types";

// ── Wizard state ────────────────────────────────────────────────────────
//
// SCHEMA STABILITY: the shape of `ApoiosInput` (in src/lib/calculator/types.ts)
// is encoded into permalinks via src/lib/permalink. Adding a NEW optional
// field is safe (decoder fills missing as null). RENAMING, REORDERING, or
// REMOVING a field requires bumping PERMALINK_VERSION in
// src/lib/permalink/codec.ts and adding a v→2 migrator. The schema
// stability snapshot test will fail loudly otherwise.

type Stage = "stage1" | "stage2" | "result";

type HydrationBanner =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "version_too_new" }
  | { kind: "constants_drift"; year: string };

type ReportStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted" }
  | { kind: "skipped"; reason: "no_consent" | "endpoint_disabled" | "incomplete" }
  | { kind: "failed" };

/** UI-side draft of the LarReport. concelho_slug + lar_tipo + monthly_price
 *  derive from the calculator input; tenure / services / consent are
 *  Branch-A-only. */
interface ReportDraft {
  lar_slug?: string;
  lar_name_freetext?: string;
  services_included: ServicoIncluido[];
  tenure_band?: TenureBand;
  consent_share: boolean;
}

const emptyReport: ReportDraft = {
  services_included: [],
  consent_share: true, // default ON per spec §3 Branch A.7
};

const ALL_SERVICOS: ServicoIncluido[] = [
  "alimentacao", "fraldas", "medicamentos", "fisioterapia",
  "cabeleireiro", "transporte", "quarto_privado", "lavandaria", "atividades",
];

const ALL_TENURE: TenureBand[] = ["lt_6m", "6m_to_1y", "1y_to_3y", "gt_3y"];

const empty: ApoiosInput = {
  idade: 80,
  tipo_pensao: null,
  valor_pensao_mensal: null,
  outros_rendimentos_anuais: null,
  estado_civil: null,
  valor_pensao_conjuge: null,
  outros_rendimentos_conjuge: null,
  residencia_pt_anos: null,
  grau_dependencia: null,
  tem_atestado_multiusos: null,
  grau_incapacidade: null,
  situacao_residencia: null,
  mensalidade_lar: null,
  municipio: null,
  regime_especial: null,
  quem_paga_fatura: null,
  nif_idoso_em_agregado: null,
  tem_cuidador_informal: null,
};

export default function Wizard() {
  const [stage, setStage] = useState<Stage>("stage1");
  const [input, setInput] = useState<ApoiosInput>(empty);
  const [showOptional, setShowOptional] = useState(false);
  const [banner, setBanner] = useState<HydrationBanner>({ kind: "none" });
  const [toast, setToast] = useState<string | null>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(emptyReport);
  const [reportStatus, setReportStatus] = useState<ReportStatus>({ kind: "idle" });

  // Race guard: prevents StrictMode double-effect-fire and any future
  // parent re-mount from re-firing permalink_loaded.
  const hydratedRef = useRef(false);

  // Guard: calculator_completed fires once per session via the wizard's
  // submit handler ONLY. NEVER from a useEffect — that would fire on
  // permalink hydration too and corrupt the success metric.
  const completedSession = useCalculatorCompletedFlag();

  // ── Permalink hydration on mount (one-shot) ─────────────────────────
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const rawHash = typeof window !== "undefined" ? window.location.hash : "";
    if (!rawHash || rawHash.length <= 1) return;
    const result: DecodeResult = decode(rawHash);
    if (result.ok) {
      setInput(result.input);
      setStage("result");
      track(Events.PermalinkLoaded);
      if (result.constantsVersion !== CONSTANTS_VERSION) {
        setBanner({ kind: "constants_drift", year: result.constantsVersion });
      }
    } else {
      track(Events.PermalinkInvalid, { kind: result.kind });
      if (result.kind === "unknown_version") {
        setBanner({ kind: "version_too_new" });
      } else {
        setBanner({ kind: "invalid" });
      }
    }
  }, []);

  // ── Print: open all <details> on print, restore after ───────────────
  // Belt-and-braces per spec-flow analyzer: matchMedia primary,
  // beforeprint/afterprint fallback, setTimeout safety net (Safari).
  useEffect(() => {
    if (stage !== "result") return;
    const snapshot = new WeakMap<HTMLDetailsElement, boolean>();
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;

    const expand = () => {
      document.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => {
        if (!snapshot.has(d)) snapshot.set(d, d.open);
        d.open = true;
      });
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(restore, 30_000);
    };
    const restore = () => {
      document.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => {
        if (snapshot.has(d)) d.open = snapshot.get(d) ?? false;
      });
      if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
    };

    const beforePrint = () => expand();
    const afterPrint = () => restore();
    const mql = window.matchMedia("print");
    const onChange = (e: MediaQueryListEvent) => (e.matches ? expand() : restore());

    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    mql.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      mql.removeEventListener?.("change", onChange);
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, [stage]);

  // ── Toast auto-dismiss ──────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const result = useMemo<ApoiosResult | null>(
    () => (stage === "result" ? calcular(input) : null),
    [stage, input]
  );

  function set<K extends keyof ApoiosInput>(key: K, value: ApoiosInput[K]) {
    setInput((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit() {
    setStage("result");
    // CRITICAL: fire CalculatorCompleted ONLY from the submit handler.
    // Permalink hydration uses setStage("result") directly and bypasses
    // this — that boundary keeps the funnel metric honest.
    if (completedSession.checkAndSet()) {
      track(Events.CalculatorCompleted);
    }
    // Fire-and-forget price report when user opted in AND it's a Branch A
    // case AND endpoint is configured. Failures are silent at the user
    // level — calculator result still renders.
    maybeSubmitReport();
  }

  function maybeSubmitReport() {
    if (!reportDraft.consent_share) {
      setReportStatus({ kind: "skipped", reason: "no_consent" });
      return;
    }
    if (!isSubmissionConfigured()) {
      setReportStatus({ kind: "skipped", reason: "endpoint_disabled" });
      return;
    }
    const built = buildReport(input, reportDraft);
    if (!built) {
      setReportStatus({ kind: "skipped", reason: "incomplete" });
      return;
    }
    setReportStatus({ kind: "submitting" });
    submitReport(built).then((res) => {
      if (res.ok) {
        setReportStatus({ kind: "submitted" });
        track(Events.ReportSubmitted, {
          concelho: built.concelho_slug,
          tipo: built.lar_tipo,
        });
      } else if (res.kind === "disabled") {
        setReportStatus({ kind: "skipped", reason: "endpoint_disabled" });
      } else {
        setReportStatus({ kind: "failed" });
        track(Events.ReportFailed, { kind: res.kind });
      }
    });
  }

  function handleRestart() {
    setInput(empty);
    setStage("stage1");
    setShowOptional(false);
    setBanner({ kind: "none" });
    setReportDraft(emptyReport);
    setReportStatus({ kind: "idle" });
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  function handleCopyLink() {
    if (typeof window === "undefined") return;
    const enc = encode(input);
    window.history.replaceState(null, "", `${window.location.pathname}#${enc.hash}`);
    if (!navigator.clipboard?.writeText) {
      setToast(`Selecione e copie: ${enc.url}`);
      return;
    }
    navigator.clipboard.writeText(enc.url).then(
      () => {
        setToast("Link copiado — qualquer pessoa que o abra verá o mesmo resultado.");
        track(Events.PermalinkCopied);
      },
      () => {
        setToast(`Não foi possível copiar. Selecione: ${enc.url}`);
      }
    );
  }

  if (stage === "result" && result) {
    return (
      <ResultView
        result={result}
        banner={banner}
        toast={toast}
        canCopy={hydratedRef.current}
        reportStatus={reportStatus}
        onRestart={handleRestart}
        onCopyLink={handleCopyLink}
      />
    );
  }

  if (stage === "stage1") {
    return (
      <StageShell
        title="Sobre o seu familiar"
        subtitle="5 perguntas. Cerca de 90 segundos. Pode escolher 'não sei' em qualquer ponto."
        progress={1}
      >
        {banner.kind === "invalid" && (
          <div className="banner banner-warn">
            <span>Link inválido ou desatualizado. Preencha os campos para uma nova estimativa.</span>
          </div>
        )}
        {banner.kind === "version_too_new" && (
          <div className="banner banner-warn">
            <span>Este link foi gerado com uma versão mais recente da calculadora. Atualize a página ou preencha de novo.</span>
          </div>
        )}

        <FieldNum label="Idade" value={input.idade} onChange={(v) => set("idade", v ?? 0)} hint="Idade da pessoa idosa." />
        <FieldEnum<TipoPensao>
          label="Que pensão recebe?"
          value={input.tipo_pensao}
          onChange={(v) => set("tipo_pensao", v)}
          options={[
            { v: "regime_geral", l: "Regime geral (carreira contributiva)" },
            { v: "regime_agricola", l: "Regime agrícola" },
            { v: "nao_contributivo_social", l: "Não contributivo / Pensão social" },
            { v: "prestacao_social_inclusao", l: "Prestação Social para a Inclusão" },
            { v: "nenhuma", l: "Nenhuma / não sei" },
          ]}
        />
        <FieldNum
          label="Valor mensal aproximado da pensão (€)"
          value={input.valor_pensao_mensal}
          onChange={(v) => set("valor_pensao_mensal", v)}
          hint="Líquido. Aproximado é suficiente."
        />
        <FieldEnum<EstadoCivil>
          label="Estado civil"
          value={input.estado_civil}
          onChange={(v) => set("estado_civil", v)}
          options={[
            { v: "solteiro", l: "Solteiro(a)" },
            { v: "casado", l: "Casado(a)" },
            { v: "uniao_facto", l: "União de facto" },
            { v: "viuvo", l: "Viúvo(a)" },
            { v: "divorciado", l: "Divorciado(a)" },
          ]}
        />
        <FieldEnum<GrauDependencia>
          label="Grau de dependência avaliado pela Segurança Social"
          value={input.grau_dependencia}
          onChange={(v) => set("grau_dependencia", v)}
          options={[
            { v: "1_grau", l: "1.º grau (dependência parcial)" },
            { v: "2_grau", l: "2.º grau (dependência total)" },
            { v: "nao_avaliado", l: "Ainda não avaliado" },
            { v: "nenhum", l: "Sem dependência reconhecida" },
          ]}
        />

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="text-sm text-brand-500 underline mt-1 mb-3"
        >
          {showOptional ? "Esconder" : "Mostrar"} perguntas opcionais (atestado, residência, ADSE…)
        </button>

        {showOptional && (
          <>
            <FieldBool
              label="Tem atestado multiusos?"
              value={input.tem_atestado_multiusos}
              onChange={(v) => set("tem_atestado_multiusos", v)}
            />
            {input.tem_atestado_multiusos && (
              <FieldNum
                label="Grau de incapacidade do atestado (%)"
                value={input.grau_incapacidade}
                onChange={(v) => set("grau_incapacidade", v)}
              />
            )}
            <FieldNum
              label="Reside em Portugal há quantos anos?"
              value={input.residencia_pt_anos}
              onChange={(v) => set("residencia_pt_anos", v)}
              hint="Necessário para calcular o CSI."
            />
            <FieldNum
              label="Outros rendimentos anuais (rendas, juros…)"
              value={input.outros_rendimentos_anuais}
              onChange={(v) => set("outros_rendimentos_anuais", v)}
            />
            {(input.estado_civil === "casado" || input.estado_civil === "uniao_facto") && (
              <>
                <FieldNum
                  label="Pensão mensal do cônjuge (€)"
                  value={input.valor_pensao_conjuge}
                  onChange={(v) => set("valor_pensao_conjuge", v)}
                />
                <FieldNum
                  label="Outros rendimentos anuais do cônjuge"
                  value={input.outros_rendimentos_conjuge}
                  onChange={(v) => set("outros_rendimentos_conjuge", v)}
                />
              </>
            )}
            <FieldEnum<RegimeEspecial>
              label="Vínculo a função pública / militar / PSP (próprio ou cônjuge)?"
              value={input.regime_especial}
              onChange={(v) => set("regime_especial", v)}
              options={[
                { v: "nenhum", l: "Nenhum" },
                { v: "adse", l: "ADSE (função pública)" },
                { v: "iasfa_adm", l: "IASFA / ADM (militar)" },
                { v: "sad_psp", l: "SAD/PSP (polícia)" },
                { v: "outro", l: "Outro subsistema" },
              ]}
            />
          </>
        )}

        <div className="flex justify-between items-center mt-6">
          <a href="/" className="text-sm text-ink-soft no-underline hover:underline">← Cancelar</a>
          <button type="button" className="btn-primary" onClick={() => setStage("stage2")}>
            Continuar →
          </button>
        </div>
      </StageShell>
    );
  }

  // Stage 2 — situação atual + branch-specific fields
  const situacao = input.situacao_residencia;
  const branchA = situacao === "lar_privado" || situacao === "lar_ipss_acordo" || situacao === "lar_ipss_sem_acordo";
  const branchD = situacao === "casa_filho_familiar";

  return (
    <StageShell
      title="A situação atual"
      subtitle="Esta resposta determina que apoios fazem sentido para si."
      progress={2}
    >
      <FieldEnum<SituacaoResidencia>
        label="Onde se encontra atualmente o seu familiar?"
        value={input.situacao_residencia}
        onChange={(v) => set("situacao_residencia", v)}
        options={[
          { v: "casa_propria", l: "Em casa própria" },
          { v: "casa_filho_familiar", l: "Em casa de um filho ou familiar" },
          { v: "apoio_domiciliario", l: "Em casa, com apoio domiciliário" },
          { v: "lar_privado", l: "Num lar privado" },
          { v: "lar_ipss_acordo", l: "Num lar IPSS / Misericórdia (com acordo SS)" },
          { v: "lar_ipss_sem_acordo", l: "Num lar IPSS / Misericórdia (sem acordo)" },
          { v: "procura_lar", l: "À procura de lar" },
        ]}
      />

      {branchA && (
        <BranchAFields
          input={input}
          onSetInput={set}
          report={reportDraft}
          onSetReport={setReportDraft}
        />
      )}

      {situacao === "procura_lar" && (
        <FieldEnum<string>
          label="Em que concelho procura?"
          value={input.municipio}
          onChange={(v) => set("municipio", v)}
          options={CONCELHOS.map((c) => ({ v: c.slug, l: c.nome }))}
        />
      )}

      {branchD && (
        <>
          <FieldEnum<QuemPagaFatura>
            label="Quem paga as faturas do lar / apoio?"
            value={input.quem_paga_fatura}
            onChange={(v) => set("quem_paga_fatura", v)}
            options={[
              { v: "idoso", l: "O próprio idoso" },
              { v: "filhos", l: "Um filho" },
              { v: "partilhada", l: "Repartido entre filhos" },
            ]}
          />
          <FieldBool
            label="O idoso vive em comunhão de habitação (>183 dias) num filho?"
            value={input.nif_idoso_em_agregado}
            onChange={(v) => set("nif_idoso_em_agregado", v)}
          />
        </>
      )}

      {(situacao === "casa_propria" || situacao === "apoio_domiciliario" || branchD) && (
        <FieldBool
          label="Tem cuidador familiar reconhecido?"
          value={input.tem_cuidador_informal}
          onChange={(v) => set("tem_cuidador_informal", v)}
        />
      )}

      <div className="flex justify-between items-center mt-6">
        <button type="button" className="text-sm text-ink-soft no-underline hover:underline" onClick={() => setStage("stage1")}>
          ← Voltar
        </button>
        <button type="button" className="btn-primary" onClick={handleSubmit}>
          Calcular apoios →
        </button>
      </div>
    </StageShell>
  );
}

// ── Branch A field group (in-lar respondents) ──────────────────────────

function BranchAFields({
  input, onSetInput, report, onSetReport,
}: {
  input: ApoiosInput;
  onSetInput: <K extends keyof ApoiosInput>(key: K, value: ApoiosInput[K]) => void;
  report: ReportDraft;
  onSetReport: (next: ReportDraft) => void;
}) {
  const concelhoSlug = input.municipio ?? "";
  const laresInConcelho = concelhoSlug ? getLaresByConcelho(concelhoSlug) : [];

  // Map situacao_residencia (engine input) → LarReport tipo
  const tipoFromSituacao: LarReportTipo =
    input.situacao_residencia === "lar_ipss_acordo" ? "ipss_com_acordo"
    : input.situacao_residencia === "lar_ipss_sem_acordo" ? "ipss_sem_acordo"
    : input.situacao_residencia === "lar_privado" ? "privado"
    : "nao_sei";

  const submissionConfigured = isSubmissionConfigured();

  function toggleService(s: ServicoIncluido) {
    const has = report.services_included.includes(s);
    onSetReport({
      ...report,
      services_included: has
        ? report.services_included.filter((x) => x !== s)
        : [...report.services_included, s],
    });
  }

  return (
    <>
      <FieldEnum<string>
        label="Concelho do lar"
        value={concelhoSlug || null}
        onChange={(v) => {
          onSetInput("municipio", v);
          // Reset lar selection when concelho changes
          if (v !== concelhoSlug) onSetReport({ ...report, lar_slug: undefined, lar_name_freetext: undefined });
        }}
        options={CONCELHOS.map((c) => ({ v: c.slug, l: c.nome }))}
      />

      {concelhoSlug && (
        <div className="field">
          <label htmlFor="lar-name">Nome do lar (opcional)</label>
          <input
            id="lar-name"
            type="text"
            list="lar-options"
            value={report.lar_name_freetext ?? (report.lar_slug ? laresInConcelho.find((l) => l.slug === report.lar_slug)?.nome ?? "" : "")}
            onChange={(e) => {
              const typed = e.target.value;
              const match = laresInConcelho.find((l) => l.nome === typed);
              if (match) {
                onSetReport({ ...report, lar_slug: match.slug, lar_name_freetext: undefined });
              } else if (typed.length > 0) {
                onSetReport({ ...report, lar_slug: undefined, lar_name_freetext: typed });
              } else {
                onSetReport({ ...report, lar_slug: undefined, lar_name_freetext: undefined });
              }
            }}
            placeholder="Ex: Santa Casa da Misericórdia, Lar São José…"
          />
          <datalist id="lar-options">
            {laresInConcelho.map((l) => (
              <option key={l.slug} value={l.nome} />
            ))}
          </datalist>
          <small>
            Se aparece na lista, escolha. Se não, escreva o nome — vamos adicioná-lo ao diretório.
          </small>
        </div>
      )}

      <FieldNum
        label="Mensalidade média paga (€/mês)"
        value={input.mensalidade_lar}
        onChange={(v) => onSetInput("mensalidade_lar", v)}
        hint="Inclui mensalidade base + extras regulares (fraldas, fisioterapia, etc.)."
      />

      <fieldset className="field">
        <legend className="text-sm font-semibold text-ink mb-2">O que está incluído na mensalidade?</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_SERVICOS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={report.services_included.includes(s)}
                onChange={() => toggleService(s)}
              />
              <span>{SERVICOS_LABELS[s]}</span>
            </label>
          ))}
        </div>
        <small>Selecione tudo o que se aplica.</small>
      </fieldset>

      <fieldset className="field">
        <legend className="text-sm font-semibold text-ink mb-2">Há quanto tempo está neste lar?</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_TENURE.map((t) => (
            <label key={t} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${report.tenure_band === t ? "bg-brand-500 text-white border-brand-500" : "bg-white border-rule"}`}>
              <input
                type="radio"
                name="tenure"
                value={t}
                checked={report.tenure_band === t}
                onChange={() => onSetReport({ ...report, tenure_band: t })}
                className="sr-only"
              />
              {TENURE_LABELS[t]}
            </label>
          ))}
        </div>
        <small>Sinaliza a frescura dos dados de comparação.</small>
      </fieldset>

      <div className="field bg-brand-50 border border-brand-100 rounded-lg p-4 mt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={report.consent_share}
            onChange={(e) => onSetReport({ ...report, consent_share: e.target.checked })}
            className="mt-1"
          />
          <span className="text-sm">
            <strong>Partilhar este preço, anonimamente, para ajudar outras famílias.</strong>
            <br />
            <span className="text-ink-muted text-xs">
              Enviamos apenas: tipo de lar, concelho, mensalidade, serviços incluídos, tempo no lar.
              Nunca enviamos a sua idade, pensão, dependência ou identificação.
              {!submissionConfigured && (
                <>
                  {" "}<em>(submissão ainda não configurada — o opt-in fica registado para quando estiver.)</em>
                </>
              )}
            </span>
          </span>
        </label>
      </div>

      {/* Hidden tipo derived from situacao — exposed for debugging */}
      <input type="hidden" name="lar_tipo" value={tipoFromSituacao} />
    </>
  );
}

// ── Helpers: build LarReport from wizard state ─────────────────────────

function buildReport(input: ApoiosInput, draft: ReportDraft): LarReport | null {
  if (!input.municipio) return null;
  if (input.mensalidade_lar == null || input.mensalidade_lar <= 0) return null;
  if (!draft.tenure_band) return null;

  const tipo: LarReportTipo =
    input.situacao_residencia === "lar_ipss_acordo" ? "ipss_com_acordo"
    : input.situacao_residencia === "lar_ipss_sem_acordo" ? "ipss_sem_acordo"
    : input.situacao_residencia === "lar_privado" ? "privado"
    : "nao_sei";

  const dependenciaBand: LarReport["dependencia_band"] =
    input.grau_dependencia === "2_grau" || (input.grau_incapacidade ?? 0) >= 60
      ? "2_grau_ou_atestado_60_plus"
      : input.grau_dependencia === "1_grau" || input.grau_dependencia === "nenhum"
        ? "nenhum_ou_1_grau"
        : "nao_avaliado";

  return {
    v: 1,
    submitted_at: new Date().toISOString(),
    concelho_slug: input.municipio,
    lar_slug: draft.lar_slug,
    lar_name_freetext: draft.lar_name_freetext,
    lar_tipo: tipo,
    monthly_price_eur: input.mensalidade_lar,
    services_included: draft.services_included,
    tenure_band: draft.tenure_band,
    dependencia_band: dependenciaBand,
  };
}

// ── Once-per-session flag (sessionStorage, SSR-safe) ────────────────────

function useCalculatorCompletedFlag() {
  return {
    checkAndSet(): boolean {
      if (typeof window === "undefined") return false;
      try {
        if (window.sessionStorage.getItem("calc_completed_session")) return false;
        window.sessionStorage.setItem("calc_completed_session", "1");
        return true;
      } catch {
        // Safari private mode etc. — fall through and return true so the
        // event still fires once per page load instead of never.
        return true;
      }
    },
  };
}

// ── Stage shell ─────────────────────────────────────────────────────────

function StageShell({
  title,
  subtitle,
  progress,
  children,
}: {
  title: string;
  subtitle: string;
  progress: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft mb-2 uppercase tracking-wide">
          <span>Passo {progress} de 2</span>
          <span aria-hidden="true">·</span>
          <span>{progress === 1 ? "Sobre o familiar" : "Situação atual"}</span>
        </div>
        <div className="h-1.5 bg-rule rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: progress === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-1">{title}</h1>
      <p className="text-ink-muted mb-6">{subtitle}</p>
      <div className="bg-white border border-rule rounded-2xl p-6 sm:p-8 shadow-sm">{children}</div>
    </div>
  );
}

// ── Field primitives ───────────────────────────────────────────────────

function FieldNum({
  label, value, onChange, hint,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

function FieldText({
  label, value, onChange, hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

function FieldEnum<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  options: { v: T; l: string }[];
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as T))}
      >
        <option value="">— Não sei / prefiro não responder —</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function FieldBool({
  label, value, onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value === true ? "true" : value === false ? "false" : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : v === "true");
        }}
      >
        <option value="">— Não sei —</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    </div>
  );
}

// ── Result view ─────────────────────────────────────────────────────────

function ResultView({
  result, banner, toast, canCopy, reportStatus, onRestart, onCopyLink,
}: {
  result: ApoiosResult;
  banner: HydrationBanner;
  toast: string | null;
  canCopy: boolean;
  reportStatus: ReportStatus;
  onRestart: () => void;
  onCopyLink: () => void;
}) {
  const totalEur = formatEur(result.total_anual_estimado_eur);
  const minEur = formatEur(result.total_anual_min_eur);
  const maxEur = formatEur(result.total_anual_max_eur);

  const elegiveis = result.apoios.filter(
    (a) => a.elegibilidade !== "nao_elegivel" && a.elegibilidade !== "nao_avaliado"
  );
  const nao = result.apoios.filter(
    (a) => a.elegibilidade === "nao_elegivel" || a.elegibilidade === "nao_avaliado"
  );

  return (
    <div className="max-w-3xl mx-auto">
      {banner.kind === "constants_drift" && (
        <div className="banner banner-warn">
          <span>
            Este link foi gerado com valores de <strong>{banner.year}</strong>.
            A estimativa atual usa valores de <strong>{result.ano_referencia}</strong> —
            recomenda-se recalcular preenchendo de novo.
          </span>
        </div>
      )}

      {reportStatus.kind === "submitted" && (
        <div className="banner banner-info">
          <span>
            <strong>Obrigada por contribuir.</strong> O seu reporte de preço (anónimo) entra na
            mediana do concelho assim que tivermos pelo menos 10 reportes.
          </span>
        </div>
      )}
      {reportStatus.kind === "failed" && (
        <div className="banner banner-warn">
          <span>
            Não foi possível enviar o seu reporte de preço — mas o seu cálculo está abaixo.
            Tente partilhar mais tarde.
          </span>
        </div>
      )}

      <div className="text-center mb-8">
        <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">
          Estimativa anual de apoios públicos · valores de {result.ano_referencia}
        </div>
        <div className="text-5xl sm:text-6xl font-bold text-brand-500 mb-2 tabular-nums">{totalEur}</div>
        <div className="text-sm text-ink-muted">
          Intervalo: {minEur} – {maxEur}/ano
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 no-print">
          <button type="button" className="btn-secondary" onClick={onRestart}>← Recomeçar</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCopyLink}
            disabled={!canCopy}
            title={canCopy ? "" : "A carregar…"}
          >
            Copiar link
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.print()}
          >
            Imprimir / Guardar como PDF
          </button>
        </div>
      </div>

      {result.alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="text-sm font-semibold text-amber-900 mb-1.5">Atenção</div>
          <ul className="text-sm text-amber-900 list-disc pl-5 space-y-1">
            {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">O que pode receber</h2>
      <div className="space-y-3 mb-8">
        {elegiveis.map((a) => <ApoioCard key={a.id} apoio={a} />)}
      </div>

      {result.checklist_pendente.length > 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-5 mb-8">
          <h3 className="text-base font-bold mb-3 text-brand-700">Plano de ação</h3>
          <ol className="text-sm text-ink list-decimal pl-5 space-y-1.5">
            {result.checklist_pendente.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </div>
      )}

      {nao.length > 0 && (
        <details className="border border-rule rounded-xl p-4 mb-8">
          <summary className="cursor-pointer text-sm font-semibold text-ink-muted">
            Apoios não elegíveis ou ainda não avaliados ({nao.length})
          </summary>
          <div className="mt-3 space-y-2">
            {nao.map((a) => (
              <div key={a.id} className="text-sm">
                <span className="font-semibold">{a.nome}</span> — {a.explicacao || "sem dados suficientes."}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="border-t border-rule pt-5 text-xs text-ink-soft space-y-1">
        {result.disclaimers.map((d, i) => <p key={i}>{d}</p>)}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ApoioCard({ apoio }: { apoio: ApoioOutput }) {
  const valor =
    apoio.valor_anual_eur != null
      ? formatEur(apoio.valor_anual_eur) + "/ano"
      : apoio.valor_anual_max_eur != null
        ? `${formatEur(apoio.valor_anual_min_eur ?? 0)}–${formatEur(apoio.valor_anual_max_eur)}/ano`
        : "—";

  return (
    <div className="border border-rule rounded-xl p-5 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-ink leading-snug">{apoio.nome}</h3>
        <span className={`chip badge-elig-${apoio.elegibilidade}`}>{labelElig(apoio.elegibilidade)}</span>
      </div>
      <div className="text-2xl font-bold text-brand-500 tabular-nums mb-2">{valor}</div>
      <p className="text-sm text-ink-muted mb-3">{apoio.explicacao}</p>
      {apoio.proximo_passo && (
        <div className="text-sm bg-brand-50 border border-brand-100 rounded-md p-3 mb-2">
          <span className="font-semibold text-brand-700">Próximo passo: </span>
          {apoio.proximo_passo}
        </div>
      )}
      {apoio.formulario_link && (
        <a href={apoio.formulario_link} target="_blank" rel="noopener" className="text-sm font-semibold">
          Ver formulário →
        </a>
      )}
      {apoio.notas && apoio.notas.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-ink-soft cursor-pointer">Como é calculado / notas</summary>
          <ul className="text-xs text-ink-muted list-disc pl-5 mt-1.5 space-y-0.5">
            {apoio.notas.map((n, i) => <li key={i}>{n}</li>)}
            {apoio.constantes_usadas && apoio.constantes_usadas.length > 0 && (
              <li className="text-ink-soft">Constantes: {apoio.constantes_usadas.join(", ")}</li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}

function labelElig(e: string): string {
  switch (e) {
    case "certa": return "Direito reconhecido";
    case "provavel": return "Provável";
    case "possivel": return "Possível";
    case "nao_elegivel": return "Não elegível";
    default: return "A avaliar";
  }
}

function formatEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return "€" + Math.round(n).toLocaleString("pt-PT");
}
