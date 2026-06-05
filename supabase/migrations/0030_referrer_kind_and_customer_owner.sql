-- ============================================================================
-- 0030 — referrers 一表两用（介绍人 / 归属人）+ 客户「归属人」外键
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。additive、可重复执行。
--
-- 背景（2026-06-06 用户需求）：「归属人」是客户的新归口维度，和介绍人一样是
-- 人员实体，存同一张 referrers 表，用 kind 区分；介绍人管理页用开关切换两个列表。
-- 与 client_source（客户来源·三色）完全独立、并存。
-- ============================================================================

-- ① referrers 加 kind：'referrer' 介绍人（存量行默认）/ 'owner' 归属人
alter table public.referrers
  add column if not exists kind text not null default 'referrer'
  check (kind in ('referrer', 'owner'));

comment on column public.referrers.kind is '人员类型：referrer=介绍人 / owner=归属人（一表两用，介绍人页开关切换）';

-- ② 客户「归属人」：关联 referrers（约定 kind=owner），可空 = 未归属；
--    删除归属人实体时置空，不级联删客户
alter table public.customers
  add column if not exists owner_referrer_id uuid references public.referrers(id) on delete set null;

create index if not exists idx_customers_owner on public.customers(owner_referrer_id);

comment on column public.customers.owner_referrer_id is '客户归属人（referrers.kind=owner 的实体）；与 client_source（来源·三色）无关、并存';
