-- ============================================================================
-- 0026 — 家庭成员关联（把已存在的客户关联为某主申的副申，不改其 primary_applicant_id）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、additive、可重复执行。
--
-- 现状 customers.primary_applicant_id 是 1:1：设了就把该客户变成附属副申、丢掉顶层身份。
-- 本表让一个【已有独立档案/case 的客户 B】同时作为【主申 A 的副申】出现在 A 家庭组里，
-- 而不动 B 自己的身份（B 仍 primary_applicant_id=null、顶层显示、case 照常）。与现有
-- primary_applicant_id 并存、互不影响。纯展示/家庭关系层：不合并计费、不动 case、不触发 sync。
-- ============================================================================

create table if not exists public.family_member_links (
  id                  uuid primary key default gen_random_uuid(),
  primary_customer_id uuid not null references public.customers(id) on delete cascade, -- 家庭组主申 A
  member_customer_id  uuid not null references public.customers(id) on delete cascade, -- 被关联进来的现有客户 B
  relationship        text,                                                            -- 配偶/子女/父母…（此关联专用）
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fml_no_self check (member_customer_id <> primary_customer_id),
  constraint fml_unique  unique (primary_customer_id, member_customer_id)
);
create index if not exists idx_fml_primary on public.family_member_links(primary_customer_id);
create index if not exists idx_fml_member  on public.family_member_links(member_customer_id);

drop trigger if exists trg_fml_updated on public.family_member_links;
create trigger trg_fml_updated before update on public.family_member_links
  for each row execute function public.set_updated_at();

alter table public.family_member_links enable row level security;
drop policy if exists fml_select on public.family_member_links;
drop policy if exists fml_insert on public.family_member_links;
drop policy if exists fml_update on public.family_member_links;
drop policy if exists fml_delete on public.family_member_links;
create policy fml_select on public.family_member_links for select to authenticated using (true);
create policy fml_insert on public.family_member_links for insert to authenticated with check (true);
create policy fml_update on public.family_member_links for update to authenticated using (true) with check (true);
create policy fml_delete on public.family_member_links for delete to authenticated using (public.is_admin());
