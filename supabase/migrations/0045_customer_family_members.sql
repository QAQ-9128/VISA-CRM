-- ============================================================================
-- 0045 — 客户级「family（家庭成员）」（additive，零回归）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、可重复执行。
--
-- family = 挂在【客户】身上的家庭成员（纯关系信息）：名字 + 关系 + 可选关联到已有客户档案。
--   - **不建客户档案、不参与任何账目分账**（不进 applicant / 不进 getCaseTotals）；
--   - 客户级：只要该客户有 family，整个客户页面（任意案件 tab）都显示；
--   - linked_customer_id：该成员本身若也有客户档案，可关联（跳档案）；没有则 null。
-- 与既有 family_member_links（关联两个已建档客户）不同：本表存自由文本成员，member 可无档案。
-- RLS 仅给本新表（authed 全开，单租户），不改现有表 RLS。
-- ============================================================================

create table if not exists public.customer_family_members (
  id                 uuid primary key default gen_random_uuid(),
  -- 所属客户（外键 + 客户删除级联清理）
  customer_id        uuid not null references public.customers(id) on delete cascade,
  name               text not null,
  relation           text,
  -- 该成员若也有客户档案 → 关联其 id；档案被删则置空（不删本条 family 记录）
  linked_customer_id uuid references public.customers(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists idx_customer_family_members_customer on public.customer_family_members(customer_id);

-- RLS：团队共享（1-2 人，单租户），authed 可读/增/改/删；只作用于本新表，不改现有表策略。
alter table public.customer_family_members enable row level security;
drop policy if exists customer_family_members_select on public.customer_family_members;
drop policy if exists customer_family_members_insert on public.customer_family_members;
drop policy if exists customer_family_members_update on public.customer_family_members;
drop policy if exists customer_family_members_delete on public.customer_family_members;
create policy customer_family_members_select on public.customer_family_members for select to authenticated using (true);
create policy customer_family_members_insert on public.customer_family_members for insert to authenticated with check (true);
create policy customer_family_members_update on public.customer_family_members for update to authenticated using (true) with check (true);
create policy customer_family_members_delete on public.customer_family_members for delete to authenticated using (true);
