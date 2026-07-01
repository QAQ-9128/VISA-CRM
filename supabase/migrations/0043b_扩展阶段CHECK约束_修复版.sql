-- ============================================================================
-- 0043b — 案件阶段(case_stage) 扩展「De Facto 关系认定」专属 5 阶段（additive，零回归）
--          ＝ 0043 的修复/续作版：把 De Facto 的 5 个 code 一并并入三处 CHECK。
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。可重复运行（drop if exists + add，幂等）。
--
-- De Facto（仅用于 case_category='De Facto 关系认定' 的案件，前端按大类切换阶段集合，签证类/职业评估不受影响）：
--   df_prep        同居关系材料准备
--   df_submitted   Submitted
--   df_rfe         Request Further evidence
--   df_responded   Responded
--   df_registered  Registered
-- ↑ 与前端 src/types/domain.ts 的 DE_FACTO_STAGES 逐字一致（全小写 + 下划线，无空格），共 5 个。
-- ★「28days Reminder!!!」不是阶段★——它是「Submitted + 28 天」的派生型自动提醒（日历紫点），
--   不进 current_stage / case_stage_history / 本 CHECK。故此处不含 df_reminder。
--
-- 做法：沿用 0043 同款「DROP + 用完整值列表 recreate」朴素写法（Postgres 的 CHECK 不能原地加值）。
--   值列表 = 0033 的 13 个旧值【逐字照抄】 + 0043 的 7 个职业评估值 + 本次 5 个 De Facto 值。
--   旧值/职业评估值一个不少（已有案件零回归）；只 additive 扩展三处 CHECK，
--   不动其它列 / RLS / 账目 / 默认值（默认仍 'todo'）。
--   ★ 若已跑过 0043，本脚本会把三处 CHECK 重建为「旧值 + OA 7 + DF 5」的并集——OA 7 重复包含是有意的（幂等）。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in (
    -- 0033 累积的 13 个旧值（逐字照抄，零回归）
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    -- 0043 的 7 个职业评估阶段
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative',
    -- 新增 5 个 De Facto 阶段（28days Reminder 不是阶段，不在此）
    'df_prep','df_submitted','df_rfe','df_responded','df_registered'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative',
    'df_prep','df_submitted','df_rfe','df_responded','df_registered'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative',
    'df_prep','df_submitted','df_rfe','df_responded','df_registered'
  ));

-- 运行后复核（每个应能看到 13 旧值 + 7 个 oa_* + 5 个 df_*）：
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname in ('cases_current_stage_check','cstage_hist_to_check','cstage_hist_from_check');
