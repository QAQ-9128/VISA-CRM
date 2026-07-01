# Findings

## Key Discoveries
- Planning session initialized for project onboarding.

## Decisions Made
- Use a dedicated .planning/project-onboarding-2026-06-30 folder: preserves existing root-level planning files that may belong to previous work.

## Open Questions
- Which feature or area will be changed next?
- Are existing modified files all intentional and should they be preserved as-is?

- Stack confirmed: Vite + React 19 + TypeScript, Tailwind CSS v4, React Router v7, TanStack Query, Zustand, Supabase, Vitest/Testing Library.
- Project domain: Australian migration/visa-agency CRM for 1-2 internal users. Core areas include customers, cases, lodgements, documents, dual-flow accounting, follow-ups, tasks, employers, dashboard.
- Local instructions say all spec entities are built; remaining documented work is deployment plus free-tier keep-alive/backup jobs.
- Worktree is heavily dirty. Modified files concentrate around dashboard, cases table/progress, customer overview fees, login/auth layout, referrers, finance/status helpers, database types, and package files. Many preview screenshots are untracked.

- Source inventory shows a mature modular app: api/, hooks/queries/, lib/ pure selectors/helpers, components/, pages/, routes/, providers/, layouts/, store/, test/.
- Routes: /login is under AuthLayout; protected AppLayout contains dashboard, customers, customer group management, cases table/new/edit, calendar, employers, referrers, immi-accounts, finance, storage/archive, and admin/users.
- Case detail route is intentionally absent; case functionality is selected inside CustomerDetailPage via query state, while /cases is a cross-case lodgement/progress table entry point.
- Supabase migrations run from 0001 through 0042, indicating many post-initial feature additions: referrers, finance, checklist, case details, reminders, immi accounts, customer names, payable expense direction.

- Runtime structure: main.tsx mounts AppProviders; AppProviders nests QueryClientProvider > AuthProvider > RouterProvider.
- AuthProvider deliberately keeps onAuthStateChange synchronous and loads profile in a separate effect keyed by user id. This is a hard project convention to avoid Supabase auth deadlocks.
- Layout is responsive AppLayout with Sidebar on desktop, BottomTabBar on mobile, and global Toaster.
- Query invalidation should use hooks/queries/keys.ts. Each entity has an 'all' prefix key where broad invalidation is expected.
- Build/test config: Vite + Tailwind v4 plugin, Vitest jsdom/globals/setup, strict TS with noUnusedLocals/noUnusedParameters/verbatimModuleSyntax/erasableSyntaxOnly. npm run build runs tsc -b before bundling.

- Domain/types layer: domain.ts owns app role, case stages, lodgement types/outcomes, payment directions/methods, fee categories, record/follow-up/doc/customer source/referrer/gender/case category constants. models.ts exports short aliases from database.ts.
- Recent migrations show active evolution beyond the original spec: 0039 adds customers.chinese_name/english_name; 0040 adds payment_plan_items.kind for receivable/payable split; 0041 adds case_reminders; 0042 adds payment_plan_items.expense_direction for payable pre-expense conversion.
- Supabase README confirms backend is Supabase DB/Auth/Storage/Realtime, migrations are manually runnable or CLI-pushable, admin promotion is manual SQL, and long-term ops still need keep-alive/backup work.

- API layer is consistently thin, async, and Supabase-focused. Each module exports list/get/create/update/archive/delete functions as applicable, with errors thrown upward.
- Hooks layer wraps APIs in TanStack Query. Mutations invalidate entity prefix keys and important derived dashboard/lodgement/finance keys. Mutation meta carries success/error copy for global UX.
- Customer archive cascades archive to all cases the customer participates in; hard delete has special multi-person case transfer logic before deleting the customer.
- Case stage changes must use updateCaseStage because it updates cases.current_stage and inserts case_stage_history. Deleting the latest stage history recomputes current_stage from remaining history.
- Payments are split into payment_plans, payment_plan_items, installments, and payments. Actual receipts/payments are payments rows; planned receivable/payable items are payment_plan_items.
- Dashboard hook fetches flat datasets and derives visible cases, debts, todo/action cases, TRT/cohab reminders, stats, and expiring docs client-side. It intentionally avoids Supabase joins.

- Pure business logic is extensive and well-tested. Important hubs: dashboard.ts, finance.ts/financeRows.ts, casesTable.ts/casesList.ts/caseBoard.ts, caseFees.ts/caseExpenses.ts, feeEntry.ts/expenseEntry.ts, planItems.ts, dateDiff/dateRules/month, stageHistory/stageSteps/statusColor, caseCalendar/reminders, family/familyLinks.
- Financial logic now derives receivables from payment_plan_items rather than payment_plans.client_total in many views; payable items are excluded from receivable totals via isPayableItem.
- /cases progress rows are one row per case with primary + secondary participants in columns. Progress tracking is always synchronized; sync_tracking affects finance only.
- Case progress durations derive lodged dates from case_stage_history and freeze on granted/refused decision dates. DHA processing days still come from lodgement rows.
- Status colors are centralized in statusColor.ts as six categories: todo, waiting, inProgress, action, done, terminated. UI should not hard-code per-stage colors.

- Page structure: DashboardPage is an attention dashboard with checklist/action cases/due soon/progress/money widgets; CasesPage is a filtered table-or-board view; CustomerDetailPage is the case-centered customer workspace; FinancePage is monthly/FY income-expense ledger; CalendarPage combines case dates, tasks, reminders, and auto reminders.
- CaseFeesCard is a large current work area: it handles per-case receivables, receipts, invoice uploads, actual expenses, pending payable expenses, undoable deletes, and conversions between pending expense items and actual payment rows.
- LodgementProgressTable is presentation-heavy but derives rows externally. It supports sortable grouped wide-table display, sticky case number, participant links, stage badges, nomination/visa duration/status columns, and task previews.
- ChecklistCard supports standalone and embedded dashboard modes, loose checklist items, and source chips for linked customer/case items.

- Existing root planning files are themselves untracked and appear to document recent/ongoing work: calendar/reminders plan, customer Chinese/English name split, UI/UX fixes, Dashboard adjustments, and prior green verification counts.
- git diff --stat shows 37 tracked files changed: 2132 insertions, 1682 deletions. Biggest tracked changes are CaseFeesCard, DashboardPage, ChecklistCard, LodgementProgressTable, package files, dashboardView/dashboard/casesTable/status libs, login/auth layout, and referrers.
- package.json added class-variance-authority, clsx, framer-motion, lucide-react, and tailwind-merge, likely supporting newer UI/auth/login components.
- Several files under 图片/ are deleted in tracked diff; many .preview-shot assets and mockups are untracked.

- Verification on 2026-06-30: npm run test:run passed 125 test files / 1194 tests. npm run build passed tsc -b and Vite production build. npm run lint passed with no output/errors.
- Build warning: Vite reports the main JS chunk is larger than 500 kB after minification (~1018 kB, gzip ~293 kB). This is not a failure, but code-splitting may be useful later if load time matters.
