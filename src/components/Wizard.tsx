import { useMemo, useState } from "react";
import { calcular } from "~/lib/calculator";
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
// Phase 0: progressive disclosure — Stage 1 (apoios) + Stage 2 (situação),
// then a single result page. Stage 3 comparison comes in Phase 2.

type Stage = "stage1" | "stage2" | "result";

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

  const result = useMemo<ApoiosResult | null>(
    () => (stage === "result" ? calcular(input) : null),
    [stage, input]
  );

  function set<K extends keyof ApoiosInput>(key: K, value: ApoiosInput[K]) {
    setInput((p) => ({ ...p, [key]: value }));
  }

  if (stage === "result" && result) {
    return (
      <ResultView
        result={result}
        onRestart={() => {
          setInput(empty);
          setStage("stage1");
          setShowOptional(false);
        }}
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
        <>
          <FieldNum
            label="Mensalidade média paga (€/mês)"
            value={input.mensalidade_lar}
            onChange={(v) => set("mensalidade_lar", v)}
            hint="Inclui mensalidade base + extras regulares."
          />
          <FieldText
            label="Concelho do lar (slug)"
            value={input.municipio}
            onChange={(v) => set("municipio", v)}
            hint="Ex: lisboa, porto, cascais. Opcional na Phase 0."
          />
        </>
      )}

      {situacao === "procura_lar" && (
        <FieldText
          label="Em que concelho procura?"
          value={input.municipio}
          onChange={(v) => set("municipio", v)}
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
        <button type="button" className="btn-primary" onClick={() => setStage("result")}>
          Calcular apoios →
        </button>
      </div>
    </StageShell>
  );
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
          <span aria-hidden>·</span>
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

function ResultView({ result, onRestart }: { result: ApoiosResult; onRestart: () => void }) {
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
      <div className="text-center mb-8">
        <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">
          Estimativa anual de apoios públicos
        </div>
        <div className="text-5xl sm:text-6xl font-bold text-brand-500 mb-2 tabular-nums">{totalEur}</div>
        <div className="text-sm text-ink-muted">
          Intervalo: {minEur} – {maxEur}/ano · Ano de referência {result.ano_referencia}
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={onRestart}>← Recomeçar</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.print()}
          >
            Imprimir / PDF
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
