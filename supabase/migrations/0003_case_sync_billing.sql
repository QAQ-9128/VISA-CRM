-- ============================================================================
-- 0003 — 案件编号 + 同步追踪 + 案件申请人关联 + 账单按申请人拆分
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- ⚠️ 纯增量迁移：只 CREATE / ALTER ADD / 改约束，绝不 DROP 业务表或改动 0001/0002 数据。
--    幂等（IF NOT EXISTS / IF EXISTS 守卫），可重复执行。
--
-- 背景：一个案件可含主申 + 多个副申（case_applicants）。cases.sync_tracking 决定账单粒度：
--   同步  → 一份案件级账单（payment_plans.applicant_id 为空，覆盖主+副）
--   不同步 → 主申 + 每个副申各一份账单（applicant_id = 各申请人）
-- payments.applicant_id 把每笔款归到对应申请人（同步时留空=合并）。
-- ============================================================================

-- ── 1. cases：案件编号（8 位随机，唯一，自动生成）+ 同步追踪开关 ──────────────
alter table public.cases add column if not exists case_number   text;
alter table public.cases add column if not exists sync_tracking boolean not null default true;

-- 自动生成 8 位数字编号（不足补零），碰撞则重试，保证唯一
create or replace function public.set_case_number()
returns trigger
language plpgsql
as $$
declare candidate text;
begin
  if new.case_number is null or new.case_number = '' then
    loop
      candidate := lpad((floor(random() * 100000000))::int::text, 8, '0');
      exit when not exists (select 1 from public.cases where case_number = candidate);
    end loop;
    new.case_number := candidate;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cases_case_number on public.cases;
create trigger trg_cases_case_number
  before insert on public.cases
  for each row execute function public.set_case_number();

-- 回填已存在案件（无则空操作）
do $$
declare r record; cand text;
begin
  for r in select id from public.cases where case_number is null loop
    loop
      cand := lpad((floor(random() * 100000000))::int::text, 8, '0');
      exit when not exists (select 1 from public.cases where case_number = cand);
    end loop;
    update public.cases set case_number = cand where id = r.id;
  end loop;
end $$;

create unique index if not exists cases_case_number_key on public.cases(case_number);
alter table public.cases alter column case_number set not null;

-- ── 2. case_applicants：案件的副申请人关联（主申仍是 cases.customer_id）─────────
create table if not exists public.case_applicants (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (case_id, customer_id)
);
create index if not exists idx_case_applicants_case     on public.case_applicants(case_id);
create index if not exists idx_case_applicants_customer on public.case_applicants(customer_id);

-- ── 3. 账单按申请人拆分：payment_plans / payments 加 applicant_id ───────────────
alter table public.payment_plans
  add column if not exists applicant_id uuid references public.customers(id) on delete set null;
alter table public.payments
  add column if not exists applicant_id uuid references public.customers(id) on delete set null;
create index if not exists idx_payments_applicant on public.payments(applicant_id);

-- 唯一约束：原「每案一份」(case_id 唯一) → 每个 (案件, 申请人) 一份。
-- applicant_id 为空（合并账单）以固定 sentinel 参与唯一，确保每案最多一份合并账单。
alter table public.payment_plans drop constraint if exists payment_plans_case_id_key;
create unique index if not exists payment_plans_case_applicant_key
  on public.payment_plans (case_id, coalesce(applicant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── 4. RLS：case_applicants（链接表，登录用户可全 CRUD，便于增减案件申请人）──────
alter table public.case_applicants enable row level security;

drop policy if exists case_applicants_select on public.case_applicants;
drop policy if exists case_applicants_insert on public.case_applicants;
drop policy if exists case_applicants_update on public.case_applicants;
drop policy if exists case_applicants_delete on public.case_applicants;

create policy case_applicants_select on public.case_applicants
  for select to authenticated using (true);
create policy case_applicants_insert on public.case_applicants
  for insert to authenticated with check (true);
create policy case_applicants_update on public.case_applicants
  for update to authenticated using (true) with check (true);
create policy case_applicants_delete on public.case_applicants
  for delete to authenticated using (true);
