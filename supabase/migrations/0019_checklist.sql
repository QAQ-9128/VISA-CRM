-- ============================================================================
-- 0019 — 概览独立待办清单（checklist_items）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 一个跟客户/案件都不关联的「随手清单」：一句话 + 一个勾选框（像 Excel 那样）。
-- 团队共享（1-2 人），authed 可读/增/改/删。纯增量、可重复执行。
-- ============================================================================

create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  is_done    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checklist_created_at on public.checklist_items(created_at);

-- updated_at 触发器（复用 0001 的 set_updated_at）
drop trigger if exists trg_checklist_items_updated on public.checklist_items;
create trigger trg_checklist_items_updated
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

-- RLS：随手清单，authed 全开（含删除，无需 admin）
alter table public.checklist_items enable row level security;
drop policy if exists checklist_select on public.checklist_items;
drop policy if exists checklist_insert on public.checklist_items;
drop policy if exists checklist_update on public.checklist_items;
drop policy if exists checklist_delete on public.checklist_items;
create policy checklist_select on public.checklist_items for select to authenticated using (true);
create policy checklist_insert on public.checklist_items for insert to authenticated with check (true);
create policy checklist_update on public.checklist_items for update to authenticated using (true) with check (true);
create policy checklist_delete on public.checklist_items for delete to authenticated using (true);
