# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

`crm-app` is an **Australian migration/visa-agency CRM** — an internal tool (1-2 users) meant for long-term production use. Core jobs: track visa application progress in real time (DHA processing-time alerts), dual-flow accounting (charge client / pay master agent), document-expiry alerts, and primary/secondary applicant family groups. Stack: Vite + React 19 + TypeScript SPA, Tailwind CSS v4, React Router v7, TanStack Query v5 (server state) + Zustand (light UI state), and **Supabase** (DB/Auth/Storage/Realtime). Runs entirely within Supabase free + Vercel free tiers.

**The authoritative data model is `数据模型规格.md` at the repo root.** Entities (11 business tables + `profiles`): `employers`, `customers` (self-referencing `primary_applicant_id` for family groups), `cases` (`visa_subclass` is free `text` — UI label「案件类型」; `case_category` nullable `text` 案件大类 constrained by `CASE_CATEGORIES`; `case_details` nullable `jsonb` 0035 — Chinese-keyed dynamic sub-fields from the **case cascade form** (`CaseTypeCascade` + `lib/caseTypeCascade.ts`: 大类→签证类型→动态子字段, sponsor/employer fields only for 482/186/407 (see SPONSOR_TYPES/EMPLOYER_TYPES in lib/caseTypeCascade.ts); **the single case-type input for both new AND edit** — edit reverse-fills via `cascadeFromCase`, old visas outside the 7 cascade types open blank「旧值打开即空」; the legacy `VISA_CATALOG`/`VisaSubclassField`/`visaCategoryLabel`「签证大类」 are deleted, `lib/visa.ts` keeps only `formatVisaType`); `current_stage` enum), `lodgements` (the core — nomination/visa rows; progress bars computed in the frontend from `lodged_date` + `dha_processing_days`, never stored), `case_stage_history`, `documents` (with `expiry_date`), `payment_plans` + `installments` + `payments` (with `direction`), `follow_ups`, `tasks`. `profiles` extends `auth.users` with role `admin`/`staff`. The earlier simplified enums (tourist/business/etc.) are obsolete — do not reintroduce.

**Build progress:** Phase 1 (frontend infra), Phase 2 (Supabase schema — see `supabase/migrations/0001_init.sql`, applied), Phase 3 (customers/cases/lodgements/documents/payments) and the Phase 4 **Dashboard** are done. All modules are end-to-end (TDD'd api + tests, hooks, pages) and are the reference pattern for the rest:
- **customers**: list/detail/form, family groups (`primary_applicant_id`), tier, starring, soft-delete archive.
- **cases**: under a customer; `visa_subclass` dropdown+freeform; stage flow via `updateCaseStage` (writes a `case_stage_history` row); detail page with stage control + timeline; soft-delete. Shown in customer detail.
- **lodgements**: nomination/visa per case; remaining-days/colour progress bar computed in the frontend (never stored). DHA processing-times link in `LodgementSection`.
- **documents**: per customer, optionally attached to a case. Files go to the private `case-files` bucket via `uploadFile` (path `customerId/caseId-or-general/uniq-safeName`); downloads use short-lived `createSignedUrl` (`getDocumentSignedUrl`) — never public URLs. `storage_path` is nullable (can register an expiry date with no file). Expiry alerts computed in the frontend. `DocumentsSection` is reused on both customer and case detail pages.
- **payments** (dual-flow accounting): `payment_plans` (one per case: `client_total` receivable / `company_total` payable), `installments` (real DELETE — not soft, admin-only per RLS; no `is_archived` column), `payments` (`direction` from_client/to_company/to_referrer/`misc_expense` 垫付杂项(0034) — expenses = the latter three, recorded per-case in `CaseFeesCard`'s 本案支出 block via `lib/caseExpenses.ts`, surfaced as three groups in the ledger; misc never counts toward receivables; optional `installment_id`). `api/payments.ts` holds all three. `lib/accounting.ts` `computeAccounting(plan, payments)` derives client/company paid+owed in the frontend (coerces numeric strings); `isInstallmentOverdue` flags overdue unpaid via `utcDayDiff`. `PaymentsSection` (in case detail) shows the two flow cards + plan/installments/payment panels. Single currency, default AUD, no FX. Money display via `lib/money.ts` `formatMoney`.

**Date math**: all day-diff logic goes through `src/lib/dateDiff.ts` `utcDayDiff` (UTC-based, **DST-safe** — the machine is in an Australian TZ). Built on it: `lib/lodgementProgress.ts` and `lib/expiry.ts` (`computeExpiryStatus`: overdue / ≤30d soon / ok). All three have tests.

Tests that touch Storage mock `supabase.storage.from(...).upload/createSignedUrl` (see `api/documents.test.ts`); the shared chainable `from()` builder mock is `src/test/sbMock.ts` (`makeBuilder`/`wireFrom`).

- **follow_ups** & **tasks**: both hang on a customer (and optionally a case); `FollowUpsSection` (reverse-chron timeline + add) and `TasksSection` (add / toggle done / delete; overdue red via `lib/tasks.ts` `isTaskOverdue`) reused on customer + case detail. Tasks default `assigned_to` to the current user. `lib/tasks.ts` `selectMyOpenTasks` powers the Dashboard "我的待办" block (mine, open, due ≤7d or overdue). No `is_archived` on these tables → real DELETE (admin per RLS).
- **Dashboard** (home `/`): `lib/dashboard.ts` pure selectors (tested) over candidate rows fetched flat by `api/dashboard.ts` (+ `getOpenTasks`) and stitched via id-maps in `useDashboard` — my open tasks, upcoming decisions (≤14d), expiring docs (≤30d), overdue installments, priority (starred) customers, and per-customer debts (`selectCustomerDebts`, aggregated across a customer's cases) with grand totals. No joins (avoids the Relationships-typing issue); enrichment is client-side. Cards link to the relevant case/customer.

- **employers** (sponsor employers): `api/employers.ts` list(excl. archived)/get/create/update/archive (soft delete). Standalone management at `/employers` (`雇主` nav item) + `EmployerForm`. `EmployerSelect` (dropdown of existing + inline create) is embedded in `CustomerForm` for `sponsor_employer_id`; customer detail shows the sponsor name. One employer → many customers.

- **lodgement table** (`/cases`, `LodgementTablePage`): Excel-style table of **lodged** lodgements (one row per nomination/visa), aligned to the client's spreadsheet. Replaced the old kanban board. `api/lodgements.ts` `listLodged` (lodged_date not null) → `useLodgedLodgements`; `lib/lodgementTable.ts` (tested) holds `selectLodgedRows` (joins case+customer, default sort by time-since-lodged desc), `sortLodgedRows` (column sort), `joinFamilyNames` (case customer + family group, `&`-joined), and `elapsedMonthsDays`/`formatElapsed` ("X 个月 Y 天", calendar months via UTC, built on `utcDayDiff`). Columns: 客户 / 签证类型 / 递交日期 / 状态 (from the lodgement's own `outcome`) / 至今多久 / 备注 (`lodgements.note`). Sortable headers; mobile = horizontal scroll. Lodgement mutations invalidate `lodgements.lodged` so case-detail edits sync here.

All spec entities are now built. Remaining work is deployment (Vercel static) + the free-tier keep-alive/backup jobs noted in `[[supabase-free-tier-longevity-risks]]`.

## Environment / Supabase

- Secrets live in `.env.local` (gitignored via `*.local`); `.env.example` is the committed template. Vite requires the **`VITE_`** prefix — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (holds the publishable/anon client key, safe to expose). Never put a `service_role`/secret key in the frontend.
- `src/lib/supabase.ts` is the single client. "Remember me" is implemented via a storage adapter that routes the session to `localStorage` (persist) or `sessionStorage` (tab-only) based on a flag set by `setRememberMe()` before sign-in.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server with HMR
npm run build      # type-check (tsc -b) then production build to dist/
npm run lint       # run ESLint across the repo
npm run preview    # serve the built dist/ locally
```

```bash
npm run test       # vitest watch mode
npm run test:run   # vitest single run (CI/verify)
# single file:  npx vitest run src/api/customers.test.ts
```

Vitest config lives in `vite.config.ts` (`test` block: jsdom, globals on, `setupFiles: ./src/test/setup.ts`). `tsconfig.app.json` includes `vitest/globals`, so `tsc -b` type-checks test files too — keep them type-clean.

## Code structure (src/)

Three type files, complementary — keep them in sync:
- `types/database.ts` — table-structure types (`Database` with per-table `Row`/`Insert`/`Update`). **Hand-written** equivalent of `supabase gen types` (CLI not linked yet; regenerate with `supabase gen types typescript --linked > src/types/database.ts` once linked). The typed client `createClient<Database>` flows from here.
- `types/models.ts` — short aliases derived from `database.ts` (`Customer = Tables<'customers'>`, plus `*Insert`/`*Update`). Business code imports these.
- `types/domain.ts` — enum value arrays + TS unions + **Chinese label/style maps; the single source of truth for stages/types — UI reads labels here, no magic strings**. No deps; `database.ts` imports enum unions from it.

- `lib/` — `supabase.ts` (`createClient<Database>` singleton + remember-me), `queryClient.ts`.
- `api/` — thin pure-function wrappers over Supabase, **no React** (`auth.ts`, `customers.ts`). Co-located `*.test.ts` mock `../lib/supabase`.
- `hooks/queries/` — `keys.ts` (query-key factory) + per-entity hooks (`useCustomers.ts`); mutations invalidate via the key factory.
- `providers/` — `AuthProvider.tsx` (+ `auth-context.ts` holds the context so the component file only exports a component, keeping react-refresh happy), `AppProviders.tsx` (QueryClient → Auth → Router).
- `hooks/` — `useAuth.ts`.
- `routes/` — `index.tsx` (`createBrowserRouter`; put literal paths like `customers/new` before `customers/:id`), `ProtectedRoute.tsx`, `RoleRoute.tsx`.
- `layouts/` — `AppLayout.tsx`, `AuthLayout.tsx`. `components/layout/` — `Sidebar`, `BottomTabBar`, `navItems.ts`. `components/ui/` — `Button`, `TextField`, `Select`, `Textarea`, `Badge`, `StarToggle`, `states.tsx` (Loading/Error/Empty), `FullScreenLoader`, `PagePlaceholder`, `icons.tsx`. `components/<entity>/` — entity forms (e.g. `customers/CustomerForm.tsx`).
- `store/ui.ts` — Zustand, **UI-only state** (never server data, that's TanStack Query's job).
- `pages/` — one folder per area; non-customer pages are still `PagePlaceholder` stubs.

## Conventions

- **Mobile-first**: core flows must be fully usable at 375px. Build the base (mobile) styles first, then expand with `md:`/`lg:`. Wide tables (lodgement table, finance) degrade to horizontal scroll on mobile.
- Tap targets ≥44px (`min-h-11`). UI text is Chinese.
- Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`; `@import 'tailwindcss'` in `src/index.css`).
- **TDD** (per global config): write a failing `*.test.ts` first, then implement. `api/customers.test.ts` is the template — it mocks `../lib/supabase` with a chainable builder via `vi.hoisted`.
- **Soft delete**: "deleting" a business record = set `is_archived = true` (e.g. `archiveCustomer`), never a real `DELETE`. RLS only grants `DELETE` to admins. List queries exclude archived by default.
- **Adding a new table to `database.ts`**: every table needs `Row`/`Insert`/`Update` **and `Relationships: []`**, and the schema needs `Views`/`Functions`/`CompositeTypes` (empty `{ [_ in never]: never }`). Omitting these makes supabase-js infer `insert`/`update` args as `never`.
- **Never `await` a supabase call inside an `onAuthStateChange` callback** — it deadlocks the auth client's internal lock and the callback never returns (symptom: infinite "加载中…", worse on refresh). In `AuthProvider` the callback only does synchronous `setSession`; profile fetching lives in a separate effect keyed on `session?.user?.id`. Always settle loading on every branch (success/error/no-session), including a catch fallback.

## Build / type-check architecture

- `npm run build` runs `tsc -b` **before** `vite build`. TypeScript here only type-checks (`noEmit: true`); Vite handles transpilation and bundling. A type error fails the build.
- TypeScript uses **project references** (`tsconfig.json` → `tsconfig.app.json` for `src/`, `tsconfig.node.json` for config files like `vite.config.ts`).
- App config (`tsconfig.app.json`) enables strict-ish flags worth respecting: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no TS-only runtime constructs like enums/parameter properties).
- ESLint uses the flat-config format (`eslint.config.js`) with `typescript-eslint`, `react-hooks`, and `react-refresh` rules; `dist/` is ignored.

## Entry points

- `index.html` → loads `src/main.tsx`, which mounts `<AppProviders />` into `#root` under `<StrictMode>`.
- Static assets served as-is live in `public/`.
