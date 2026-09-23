# Money Calendar

An auditable UAE personal finance demo that turns a household's cash flow into a money calendar, loan affordability checks, and rent-vs-buy analysis.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/money-calendar` — React/Vite web app with the calendar, borrowing, and rent-vs-buy flows.
- `artifacts/api-server/src/routes/money.ts` — hand-written money engine and demo API endpoints.
- `lib/api-spec/openapi.yaml` — source of truth for the typed money API contract.
- `lib/api-client-react` and `lib/api-zod` — generated API hooks and validation schemas.

## Architecture decisions

- Calculations stay in the API server; the UI only collects inputs and renders auditable outputs.
- The seeded persona is intentionally a salaried expat with two rent cheques, school fees, and an existing car loan so the demo has a tight month immediately.
- The affordability verdict uses the worst calendar month, not an average month, and applies the CBUAE-style recognized-income rules.
- The frontend uses the same calendar data for the dashboard, loan checks, and home decision handoff.

## Product

The user can open a seeded September cash-flow calendar, see safe-to-spend and the tightest day, run a UAE loan affordability check across legal/calendar/resilience tests, compare rent versus buy across three price scenarios, run a no-income stress check, and hold a home decision for calendar review.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
