-- ============================================================================
-- 0027 — 待办清单可选关联客户 / 案件
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给概览待办清单(checklist_items)加两个可空外键：customer_id / case_id。
--   - 关联可选：不填即纯文字随手记（现有行为不变）。
--   - 归档隐藏：客户/案件「归档」是软删(is_archived)，由前端读取时过滤隐藏，
--     取消归档会重新出现；本迁移不做硬删。
--   - on delete set null：仅当客户/案件被「真删除」(admin) 时清掉关联、保留这条待办。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.checklist_items
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists case_id     uuid references public.cases(id)     on delete set null;

create index if not exists idx_checklist_customer on public.checklist_items(customer_id);
create index if not exists idx_checklist_case on public.checklist_items(case_id);
