-- ============================================================================
-- 0036 — 案件「2 年转 186 TRT 提醒」手动停止标记
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 cases 加 trt_reminder_dismissed（boolean, 默认 false）：用户在提醒卡点「不再提醒」
-- 后置此标记，该案 TRT 提醒永久停止（与「已开 186 TRT 案后自动消失」是两条独立的隐藏路径）。
--
-- 为何用独立列而非塞进 case_details(jsonb)：case_details 在每次编辑案件时由级联表单
-- (pruneDetails) 整体重建覆盖，标记会被洗掉；独立列在编辑时不被表单触碰，标记得以保留。
-- 与 0017 的 trt_reminder_enabled 同构。纯增量、可重复执行、不动 RLS、无回填。
-- ============================================================================

alter table public.cases
  add column if not exists trt_reminder_dismissed boolean not null default false;
