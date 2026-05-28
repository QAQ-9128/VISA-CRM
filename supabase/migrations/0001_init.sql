-- ============================================================================
-- 签证 CRM（澳洲移民/签证中介）—— 初始 schema
-- 依据《数据模型规格.md》。在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 角色：所有新用户默认 role = 'staff'，不硬编码任何 admin 邮箱。
-- 跑完后自行提升（用你的登录邮箱）：
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = '你的邮箱');
--
-- ⚠️ 本文件是「初始 bootstrap」：第 R 段会 DROP 并重建所有业务表，确保 schema 与规格一致。
--    全新项目无业务数据，安全。**上线产生真实数据后，请勿再整段重跑本文件**，改写 0002+ 增量迁移。
--    profiles 与 app_role 不在重置范围内（保留你已提升的 admin）。
-- ============================================================================

-- ── R. 重置业务对象（保留 profiles / app_role）─────────────────────────────
drop table if exists public.tasks               cascade;
drop table if exists public.payments            cascade;
drop table if exists public.installments        cascade;
drop table if exists public.payment_plans       cascade;
drop table if exists public.documents           cascade;
drop table if exists public.follow_ups          cascade;
drop table if exists public.case_stage_history  cascade;
drop table if exists public.case_status_history cascade; -- 旧名（如曾建过）
drop table if exists public.lodgements          cascade;
drop table if exists public.cases               cascade;
drop table if exists public.customers           cascade;
drop table if exists public.employers           cascade;

drop type if exists public.case_stage         cascade;
drop type if exists public.case_status        cascade; -- 旧枚举
drop type if exists public.visa_type          cascade; -- 旧枚举
drop type if exists public.lodgement_type     cascade;
drop type if exists public.lodgement_outcome  cascade;
drop type if exists public.payment_direction  cascade;
drop type if exists public.payment_method     cascade;
drop type if exists public.follow_up_channel  cascade;
drop type if exists public.doc_type           cascade;
drop type if exists public.customer_tier      cascade;

-- ── 1. 枚举类型 ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','staff');
  end if;
  -- case_stage：咨询→准备材料→递提名→提名批→递签证→补件→授签/拒签/撤案
  create type public.case_stage as enum
    ('consulting','preparing','nomination_lodged','nomination_approved',
     'visa_lodged','additional_docs','granted','refused','withdrawn');
  create type public.lodgement_type    as enum ('nomination','visa');
  create type public.lodgement_outcome as enum ('pending','approved','refused','withdrawn');
  create type public.payment_direction as enum ('from_client','to_company');
  create type public.payment_method    as enum ('cash','transfer','wechat','alipay','card','other');
  create type public.follow_up_channel as enum ('call','wechat','email','meeting','other');
  create type public.doc_type as enum
    ('passport','medical','police_check','english_test','photo',
     'employment','financial','form','other');
  create type public.customer_tier as enum ('vip','a','b','c');
end $$;

-- ── 2. 通用：维护 updated_at ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 3. profiles：扩展 auth.users（保留，不重置）─────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null default 'staff',
  full_name  text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 新用户注册 → 自动建 profile（默认 staff）。security definer 以绕过 RLS 写入。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 回填：已存在的 auth.users 补成 profile（全部 staff，不动已有记录）
insert into public.profiles (id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email), 'staff'
from auth.users u
on conflict (id) do nothing;

-- 判断当前请求者是否 admin。security definer → 绕过 profiles 的 RLS，避免策略递归。
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 防越权：非 admin 不得修改自己的 role / active
create or replace function public.prevent_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new; -- admin 可改任意字段
  end if;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    raise exception '只有管理员可以修改 role 或 active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_no_escalation on public.profiles;
create trigger trg_profiles_no_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_escalation();

-- ── 4. employers：担保雇主 ──────────────────────────────────────────────────
create table public.employers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  abn           text,
  contact_name  text,
  contact_phone text,
  contact_email text,
  notes         text,
  is_archived   boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 5. customers：客户 / 申请人 ─────────────────────────────────────────────
create table public.customers (
  id                      uuid primary key default gen_random_uuid(),
  full_name               text not null,
  birth_date              date,
  passport_no             text,
  nationality             text,
  phone                   text,
  email                   text,
  wechat                  text,
  address                 text,
  sponsor_employer_id     uuid references public.employers(id) on delete set null,
  -- 自引用：null=主申请人；指向某人=该人的副申请人
  primary_applicant_id    uuid references public.customers(id) on delete set null,
  relationship_to_primary text,
  priority_tier           public.customer_tier,
  is_starred              boolean not null default false,
  notes                   text,
  assigned_to             uuid references public.profiles(id) on delete set null,
  created_by              uuid references public.profiles(id) on delete set null,
  is_archived             boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_customers_primary_applicant on public.customers(primary_applicant_id);
create index idx_customers_assigned_to        on public.customers(assigned_to);
create index idx_customers_starred            on public.customers(is_starred);

-- ── 6. cases：案件 = 一次签证申请 ───────────────────────────────────────────
-- 注：应收客户总额放 payment_plans.client_total（规格建议），不在此处冗余 fee_total。
create table public.cases (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  visa_subclass       text not null,                 -- 如 '482'，非枚举
  destination_country text default 'Australia',
  current_stage       public.case_stage not null default 'consulting',
  currency            text not null default 'AUD',
  assigned_to         uuid references public.profiles(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_cases_customer_id   on public.cases(customer_id);
create index idx_cases_current_stage on public.cases(current_stage);
create index idx_cases_assigned_to   on public.cases(assigned_to);

-- ── 7. lodgements：递交记录（核心）─────────────────────────────────────────
-- 进度条/颜色（已递天数、剩余天数、绿/黄/红）在前端按 lodged_date + dha_processing_days 计算，不入库。
create table public.lodgements (
  id                        uuid primary key default gen_random_uuid(),
  case_id                   uuid not null references public.cases(id) on delete cascade,
  type                      public.lodgement_type not null,
  lodged_date               date,
  reference_number          text,
  dha_processing_days       integer,
  dha_processing_updated_at date,
  outcome                   public.lodgement_outcome not null default 'pending',
  outcome_date              date,
  note                      text,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (case_id, type) -- 一个案件最多一条 nomination + 一条 visa
);
create index idx_lodgements_case_id on public.lodgements(case_id);

-- ── 8. case_stage_history：阶段变更时间线 ───────────────────────────────────
create table public.case_stage_history (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases(id) on delete cascade,
  from_stage public.case_stage,
  to_stage   public.case_stage not null,
  note       text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index idx_stage_history_case_id on public.case_stage_history(case_id);

-- ── 9. documents：文件 + 有效期 ─────────────────────────────────────────────
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  case_id      uuid references public.cases(id) on delete cascade, -- 可空
  doc_type     public.doc_type not null,
  title        text,
  storage_path text,  -- 可空：允许只登记到期日、暂不上传
  file_name    text,
  issue_date   date,
  expiry_date  date,  -- 预警系统核心
  note         text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_documents_customer_id on public.documents(customer_id);
create index idx_documents_case_id     on public.documents(case_id);
create index idx_documents_expiry      on public.documents(expiry_date);

-- ── 10. payment_plans：付款计划（双流账目）每案一份 ─────────────────────────
create table public.payment_plans (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null unique references public.cases(id) on delete cascade,
  client_total  numeric(12,2),  -- 应收客户总额
  company_total numeric(12,2),  -- 应付主代理总额
  currency      text not null default 'AUD',
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 11. installments：分期节点 ─────────────────────────────────────────────
create table public.installments (
  id              uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans(id) on delete cascade,
  label           text,
  due_date        date,
  amount          numeric(12,2) not null,
  is_paid         boolean not null default false,
  paid_at         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_installments_plan     on public.installments(payment_plan_id);
create index idx_installments_due_date on public.installments(due_date);

-- ── 12. payments：实际收付记录（带方向）────────────────────────────────────
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references public.cases(id) on delete cascade,
  direction      public.payment_direction not null,
  installment_id uuid references public.installments(id) on delete set null,
  amount         numeric(12,2) not null,
  currency       text not null default 'AUD',
  method         public.payment_method not null default 'other',
  paid_at        date,
  note           text,
  recorded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index idx_payments_case_id   on public.payments(case_id);
create index idx_payments_direction on public.payments(direction);

-- ── 13. follow_ups：跟进记录（归属客户，可挂案件）──────────────────────────
create table public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete cascade,
  channel     public.follow_up_channel not null default 'other',
  content     text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_follow_ups_customer_id on public.follow_ups(customer_id);
create index idx_follow_ups_case_id     on public.follow_ups(case_id);

-- ── 14. tasks：任务 / 待办 ──────────────────────────────────────────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete cascade,
  title       text not null,
  due_date    date,
  is_done     boolean not null default false,
  done_at     timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_tasks_assigned_to on public.tasks(assigned_to);
create index idx_tasks_due_date     on public.tasks(due_date);
create index idx_tasks_customer_id  on public.tasks(customer_id);
create index idx_tasks_case_id      on public.tasks(case_id);

-- ── 15. updated_at 触发器（所有带 updated_at 的表）──────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'employers','customers','cases','lodgements','documents',
    'payment_plans','installments','tasks'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'trg_' || t || '_updated', t
    );
  end loop;
end $$;

-- ── 16. RLS ──────────────────────────────────────────────────────────────────
-- 团队全信任 + 软删除：业务表 SELECT/INSERT/UPDATE 全员可，DELETE 仅 admin（日常删除=置 is_archived）。
alter table public.profiles           enable row level security;
alter table public.employers          enable row level security;
alter table public.customers          enable row level security;
alter table public.cases              enable row level security;
alter table public.lodgements         enable row level security;
alter table public.case_stage_history enable row level security;
alter table public.documents          enable row level security;
alter table public.payment_plans      enable row level security;
alter table public.installments       enable row level security;
alter table public.payments           enable row level security;
alter table public.follow_ups         enable row level security;
alter table public.tasks              enable row level security;

-- profiles：全员可读；admin 可全写；本人可改自己（受 trg_profiles_no_escalation 约束不能提权）
drop policy if exists profiles_select      on public.profiles;
drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_admin_write on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 业务表：SELECT/INSERT/UPDATE → authenticated；DELETE → 仅 admin
do $$
declare t text;
begin
  foreach t in array array[
    'employers','customers','cases','lodgements','case_stage_history','documents',
    'payment_plans','installments','payments','follow_ups','tasks'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true)',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      t || '_delete', t);
  end loop;
end $$;

-- ── 17. Storage：私有 bucket + 策略 ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('case-files', 'case-files', false)
on conflict (id) do nothing;

-- 仅登录用户可读写该 bucket；未登录 / 匿名 → 无策略命中 → 403。
-- 前端通过 createSignedUrl 提供短时链接，绝不暴露公开 URL。建议路径 case_id/文件名。
drop policy if exists case_files_authenticated on storage.objects;
create policy case_files_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'case-files')
  with check (bucket_id = 'case-files');

-- ── 18. Realtime：纳入发布（实时刷新 Dashboard 与看板）──────────────────────
do $$
declare t text;
begin
  foreach t in array array['cases','lodgements','tasks','installments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
