# precoslares.pt

[![CI](https://github.com/gairifo/precoslares/actions/workflows/ci.yml/badge.svg)](https://github.com/gairifo/precoslares/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> Calculadora pública de apoios sociais para idosos em Portugal. Open-source. Sem fins lucrativos. Sem encaminhamento para lares.

## O que é

Uma ferramenta para famílias portuguesas perceberem que apoios públicos podem reclamar quando um familiar idoso precisa de cuidados. Em 90 segundos, aplica as regras dos 8 principais apoios e devolve uma estimativa anual + plano de ação.

Inspirado no [tempodeespera.pt](https://tempodeespera.pt): pequeno, neutro, durável.

## Estado

Phase 0 (uso pessoal) — calculadora funcional para o caso do autor. Phase 1 (público): próximos 6–8 weekends.

Ver [`docs/`](./docs) para os specs detalhados:
- `01-apoios-calculator-spec.md` — regras de cada apoio
- `02-product-roadmap.md` — fases, métricas
- `03-wizard-spec.md` — fluxo, branching, comparação

## Apoios cobertos

1. Complemento por Dependência (1.º / 2.º grau)
2. Complemento Solidário para Idosos (CSI)
3. Comparticipação SS para ERPI (IPSS / Misericórdia)
4. IRS — Encargos com lares (Art. 84º)
5. IRS — Pessoa com deficiência (Art. 87º)
6. ADSE / IASFA / SAD-PSP
7. Apoios municipais
8. Subsídio de Apoio ao Cuidador Informal

## Stack

- **Astro 5** + **React 19** islands + **Tailwind 3**
- **TypeScript** estrito
- **Vitest** para o motor de cálculo
- Estático em **Cloudflare Pages** ou **Vercel**

## Estrutura

```
src/
├── lib/calculator/         # motor — pure TS, sem DOM, sem fetch
│   ├── index.ts            # calcular(input) → result
│   ├── types.ts
│   ├── constants_2026.json # valores anuais; 1 PR/ano para atualizar
│   ├── apoios/             # 1 ficheiro por apoio
│   └── __tests__/          # vitest, 35 testes
├── components/Wizard.tsx   # ilha React (única) — UI da calculadora
├── pages/                  # rotas Astro
└── layouts/Base.astro
```

## Comandos

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # roda os 35 testes do calculator
npm run build        # build estático
```

## Atualizar para um novo ano fiscal

1. Editar `src/lib/calculator/constants_2026.json` — bump `ano_referencia`, novos IAS, novos limites CSI, novas tabelas de complemento por dependência.
2. Renomear ficheiro: `constants_2027.json`. Atualizar import em `constants.ts`.
3. Ajustar testes que dependem de valores absolutos.
4. Abrir PR.

## Licença

Motor de cálculo: **MIT**. Conteúdo do site: **CC BY 4.0**.
