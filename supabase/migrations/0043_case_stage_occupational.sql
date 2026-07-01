-- ============================================================================
-- 0043 — 案件阶段(case_stage) 新增「职业评估」专属 7 阶段（additive，零回归）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 仅用于 case_category='职业评估' 的案件（前端按大类切换阶段集合，签证类不受影响）：
--   oa_chn_verification  CHN Qualifications Verification Submitted
--   oa_skill_submitted   Skill Assessment Submitted
--   oa_rfe               Request further evidence
--   oa_responded         Responded
--   oa_approved          Approved
--   oa_positive          Positive Outcome
--   oa_negative          Negative Outcome
-- ↑ 与前端 src/types/domain.ts 的 OCCUPATIONAL_STAGES 逐字一致（全小写 + 下划线，无空格）。
--
-- 做法（Postgres 的 CHECK 不能原地加值，只能 drop + recreate）：
--   沿用 0016/0023/0033 同款「DROP + 用完整值列表 recreate」朴素写法（已多次成功运行）。
--   下面三个 check 的值列表 = 0033 的 13 个旧值【逐字照抄】 + 7 个职业评估值，
--   旧值一个不少（签证类案件零回归），可重复运行（drop if exists + add）。
--   只 additive 扩展三处 CHECK；不动其它列 / RLS / 账目 / 默认值（默认仍 'todo'）。
--
-- 注：上一版用 do $$…$$ 动态读取约束值，因 `regexp_matches(...) as m` 的 m[1] 对 record 下标
--     （cannot subscript type record）而报错；动态读取属过度设计，这里回退到朴素硬编码。
-- ============================================================================

alter table public.cases drop constraint if exists cases_current_stage_check;
alter table public.cases add constraint cases_current_stage_check
  check (current_stage in (
    -- 0033 累积的 13 个旧值（逐字照抄，零回归）
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    -- 新增 7 个职业评估阶段
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_to_check;
alter table public.case_stage_history add constraint cstage_hist_to_check
  check (to_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative'
  ));

alter table public.case_stage_history drop constraint if exists cstage_hist_from_check;
alter table public.case_stage_history add constraint cstage_hist_from_check
  check (from_stage is null or from_stage in (
    'todo','drafted','awaiting_payment','nomination_lodged','nomination_approved','visa_lodged',
    'docs_requested','docs_completed','additional_docs','granted','refused','appeal','withdrawn',
    'oa_chn_verification','oa_skill_submitted','oa_rfe','oa_responded','oa_approved','oa_positive','oa_negative'
  ));

-- 运行后复核（每个应能看到 13 旧值 + 7 个 oa_*）：
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname in ('cases_current_stage_check','cstage_hist_to_check','cstage_hist_from_check');
