-- ============================================================================
-- 0021 — 副申请案件「三态关系」之进度同步（parent_sync_progress + 触发器）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、additive、可重复执行。
--
-- 三态（与既有 sync_tracking「合并账单」互不影响、并存）：
--   独立        parent_case_id IS NULL
--   关联(独立)  parent_case_id 有值, parent_sync_progress = false   （软关联，仅展示，如 482 SE）
--   关联(同步)  parent_case_id 有值, parent_sync_progress = true    （stage 跟随主案件自动变）
--
-- 本迁移自带 parent_case_id 列（与 0020 重复但 if not exists，0020 没跑也能独立生效）。
-- ============================================================================

-- ── 列 ───────────────────────────────────────────────────────────────────────
alter table public.cases
  add column if not exists parent_case_id uuid
    references public.cases(id) on delete set null;
alter table public.cases
  add column if not exists parent_sync_progress boolean not null default false;
create index if not exists idx_cases_parent on public.cases(parent_case_id);

-- ── 不变量：parent_case_id 为空时 parent_sync_progress 必为 false ───────────────
-- 覆盖「on delete set null 把 parent_case_id 置空」与「手动改回独立」两种场景（H）：
-- FK 级联置空走的也是 UPDATE，会触发此 BEFORE 触发器，顺带把同步关掉。
create or replace function public.enforce_case_parent_invariant()
returns trigger language plpgsql as $$
begin
  if new.parent_case_id is null then
    new.parent_sync_progress := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_cases_parent_invariant on public.cases;
create trigger trg_cases_parent_invariant
  before insert or update on public.cases
  for each row execute function public.enforce_case_parent_invariant();

-- ── 进度同步：主案件 current_stage 变化 → 同步到「关联(同步)」的子案件（D）─────────
-- 原子（同一事务）：UPDATE 子案件 stage + 写一条 case_stage_history（理由「进度同步自主案件」）。
-- 安全网：事务级递归深度计数器，>=5 层即停（同时兜住 A→B、B→A 这类环——环会在累计深度处终止）。
-- 前端另有 wouldCreateCycle 在建立关系时就排除成环候选（双重保险）。
create or replace function public.sync_child_case_stages()
returns trigger language plpgsql as $$
declare
  child   record;
  v_depth int;
begin
  v_depth := coalesce(nullif(current_setting('app.case_sync_depth', true), '')::int, 0);
  if v_depth >= 5 then
    return new;  -- 深度超限：停止级联，防失控 / 防环
  end if;
  perform set_config('app.case_sync_depth', (v_depth + 1)::text, true);  -- true = 事务级，自动复位

  for child in
    select id, current_stage
    from public.cases
    where parent_case_id = new.id
      and parent_sync_progress = true
      and current_stage is distinct from new.current_stage
  loop
    -- 更新子案件 stage（会再次触发本触发器，递归同步孙案件，受深度计数器约束）
    update public.cases set current_stage = new.current_stage where id = child.id;
    insert into public.case_stage_history (case_id, from_stage, to_stage, note, changed_by)
      values (child.id, child.current_stage, new.current_stage, '进度同步自主案件', null);
  end loop;

  perform set_config('app.case_sync_depth', v_depth::text, true);  -- 复位本层计数
  return new;
end $$;

drop trigger if exists trg_cases_sync_children on public.cases;
create trigger trg_cases_sync_children
  after update of current_stage on public.cases
  for each row
  when (old.current_stage is distinct from new.current_stage)
  execute function public.sync_child_case_stages();
