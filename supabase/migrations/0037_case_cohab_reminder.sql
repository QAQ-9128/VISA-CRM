-- ============================================================================
-- 0037 — 案件「3 个月提醒 · 更新同居材料」（186 ENS + 配偶签 820/801、309/100）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 cases 加两列：
--   cohab_reminder_enabled  boolean 默认 false —— 勾选启用（勾选框仅在 186/配偶签渲染并写入）
--   cohab_reminder_last     date 可空 —— 「本次已更新」的顺延锚点；空 = 尚未确认过，
--                           锚点回退到递交日（无递交日再回退建档日），由前端派生（lib/cohab.ts）
--
-- 为何用独立列而非塞进 case_details(jsonb)：case_details 在每次编辑案件时由级联表单
-- (pruneDetails) 整体重建覆盖，标记会被洗掉；独立列在编辑时不被表单触碰，标记得以保留。
-- 与 0017 trt_reminder_enabled / 0036 trt_reminder_dismissed 同构。
-- 纯增量、可重复执行、不动 RLS、无回填。
-- ============================================================================

alter table public.cases
  add column if not exists cohab_reminder_enabled boolean not null default false;

alter table public.cases
  add column if not exists cohab_reminder_last date;
