-- ============================================================================
-- 0029 — 移除旧「主副案件进度同步」触发器（一案一组模型遗留清理）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。可重复执行。
--
-- 背景：2026-06「案件即组」重构后，前端已彻底拆除跨案件进度同步
-- （CaseForm 不再写 parent_case_id / parent_sync_progress，lib/caseRelationship 已废）。
-- 0021 的 trg_cases_sync_children 触发器却仍在库内生效：任何遗留
-- parent_sync_progress=true 的行，会在主案推进阶段时被静默改写 current_stage
-- 并补 case_stage_history——而当前 UI 完全不展示这层关系，出错无从察觉。
--
-- 最小侵入：只删同步触发器与其函数；保留 parent_case_id / parent_sync_progress
-- 列与不变量触发器 trg_cases_parent_invariant（无害且防脏数据）。
-- 不动 payments / 账目相关任何表与触发器。
-- ============================================================================

drop trigger if exists trg_cases_sync_children on public.cases;
drop function if exists public.sync_child_case_stages();

-- 兜底：遗留的同步标记全部关掉（列保留，仅清值；触发器已删，此 UPDATE 不会级联任何东西）
update public.cases set parent_sync_progress = false where parent_sync_progress = true;
