-- ============================================================================
-- 0011 — 合并 tasks + follow_ups 为单表 records（根治类型切换需跨表搬数据的问题）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 一张 records 表同时承载「待办(task)」与「跟进(follow_up)」：
--   公共：customer_id(必填) / case_id(可空) / type / content
--   待办专用(可空)：due_date / is_done / done_at / assigned_to
--   跟进专用(可空)：channel / emoji_marker
-- 类型切换从此只是 UPDATE records SET type=...（同一行、id 不变），不再跨表。
--
-- 安全网：旧表 tasks / follow_ups 先保留不删；代码全切到 records；
-- 运行确认无误后，再单独写迁移删除旧表。可重复执行。
-- ============================================================================

create table if not exists public.records (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  case_id      uuid references public.cases(id) on delete cascade,
  type         text not null check (type in ('task','follow_up')),
  content      text not null,
  -- 待办专用
  due_date     date,
  is_done      boolean not null default false,
  done_at      timestamptz,
  assigned_to  uuid references public.profiles(id) on delete set null,
  -- 跟进专用
  channel      text,
  emoji_marker text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_records_customer on public.records(customer_id);
create index if not exists idx_records_case     on public.records(case_id);
create index if not exists idx_records_type_due on public.records(type, due_date);

drop trigger if exists trg_records_updated on public.records;
create trigger trg_records_updated before update on public.records
  for each row execute function public.set_updated_at();

-- RLS：SELECT/INSERT/UPDATE/DELETE 均开放给登录用户（与 0010 放开 tasks/follow_ups 删除一致）
alter table public.records enable row level security;
drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select to authenticated using (true);
create policy records_insert on public.records for insert to authenticated with check (true);
create policy records_update on public.records for update to authenticated using (true) with check (true);
create policy records_delete on public.records for delete to authenticated using (true);

-- ── 迁移现有数据（沿用旧 id 作为 records.id，保留作者/时间；可重复执行）────────────
-- 注：records.customer_id 必填；极少数 customer_id 为空的旧待办会跳过（仍留在旧表里）。
insert into public.records
  (id, customer_id, case_id, type, content, due_date, is_done, done_at, assigned_to, created_by, created_at, updated_at)
select id, customer_id, case_id, 'task', title, due_date, is_done, done_at, assigned_to, created_by, created_at, updated_at
from public.tasks
where customer_id is not null
on conflict (id) do nothing;

insert into public.records
  (id, customer_id, case_id, type, content, channel, emoji_marker, created_by, created_at)
select id, customer_id, case_id, 'follow_up', content, channel, emoji_marker, created_by, created_at
from public.follow_ups
on conflict (id) do nothing;
