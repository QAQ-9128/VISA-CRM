-- ============================================================================
-- 0038 — 移民局系统账号（immi_accounts）+ 案件「所属账号」（cases.immi_account_id）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 代理名下有数个移民局递交账号（ImmiAccount，目前 3 个）：做成可复用 lookup
--（参照 0002 referrers，更精简——业务字段仅名称），案件挂可空关联列记录
--「本案用哪个账号递交」，便于按账号区分案件。
--
-- ⚠️ 纯增量迁移：只 CREATE / ALTER ADD，不动既有表的任何 RLS 策略；
--    新表自带四策略（同 referrers：select/insert/update=authenticated，delete=admin）。
--    可安全重复执行（全部带 IF NOT EXISTS / 幂等守卫）。
-- ============================================================================

-- ── 1. immi_accounts：移民局系统账号（参照 referrers，仅名称）────────────────
create table if not exists public.immi_accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_archived boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at 触发器（复用 0001 的 public.set_updated_at）
drop trigger if exists trg_immi_accounts_updated on public.immi_accounts;
create trigger trg_immi_accounts_updated
  before update on public.immi_accounts
  for each row execute function public.set_updated_at();

-- ── 2. cases.immi_account_id：本案所属账号（可空，一账号对多案件）─────────────
alter table public.cases
  add column if not exists immi_account_id uuid references public.immi_accounts(id) on delete set null;
create index if not exists idx_cases_immi_account_id on public.cases(immi_account_id);

-- ── 3. RLS：immi_accounts（沿用业务表策略：增删改查 authenticated，DELETE 仅 admin）──
alter table public.immi_accounts enable row level security;

drop policy if exists immi_accounts_select on public.immi_accounts;
drop policy if exists immi_accounts_insert on public.immi_accounts;
drop policy if exists immi_accounts_update on public.immi_accounts;
drop policy if exists immi_accounts_delete on public.immi_accounts;

create policy immi_accounts_select on public.immi_accounts
  for select to authenticated using (true);
create policy immi_accounts_insert on public.immi_accounts
  for insert to authenticated with check (true);
create policy immi_accounts_update on public.immi_accounts
  for update to authenticated using (true) with check (true);
create policy immi_accounts_delete on public.immi_accounts
  for delete to authenticated using (public.is_admin());
