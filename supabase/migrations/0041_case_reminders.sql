-- ============================================================================
-- 0041 — 案件自定义提醒（case_reminders）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、可重复执行。
--
-- 给「已有案件」挂自定义提醒（不在此建案件）：自由文本内容 + 【数字】+【天/月/年】后首次到期
-- （从创建日起算，前端按本地日期推算）+ 重复规则（iOS 提醒事项整套）。
-- 提醒在日历以紫点呈现，不参与账目。RLS 仅给本新表（团队 1-2 人，单租户，authed 全开），不动现有表 RLS。
-- ============================================================================

create table if not exists public.case_reminders (
  id           uuid primary key default gen_random_uuid(),
  -- 必须挂在已有案件上（外键 + 案件删除级联清理）
  case_id      uuid not null references public.cases(id) on delete cascade,
  content      text not null,
  -- 基准日 = 在日历点「+」的那个日期格（本地日期）；首次到期 = base_date + offset_value 个 offset_unit
  base_date    date not null,
  offset_value integer not null default 0,
  offset_unit  text not null default 'day' check (offset_unit in ('day', 'month', 'year')),
  -- 重复规则（never/hourly/daily/weekdays/weekends/weekly/biweekly/monthly/every3months/every6months/yearly/custom）
  repeat_rule  text not null default 'never',
  enabled      boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_case_reminders_case on public.case_reminders(case_id);

-- RLS：团队共享（1-2 人，单租户），authed 可读/增/改/删；只作用于本新表，不改现有表策略。
alter table public.case_reminders enable row level security;
drop policy if exists case_reminders_select on public.case_reminders;
drop policy if exists case_reminders_insert on public.case_reminders;
drop policy if exists case_reminders_update on public.case_reminders;
drop policy if exists case_reminders_delete on public.case_reminders;
create policy case_reminders_select on public.case_reminders for select to authenticated using (true);
create policy case_reminders_insert on public.case_reminders for insert to authenticated with check (true);
create policy case_reminders_update on public.case_reminders for update to authenticated using (true) with check (true);
create policy case_reminders_delete on public.case_reminders for delete to authenticated using (true);
