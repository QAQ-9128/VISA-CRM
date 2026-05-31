-- ============================================================================
-- 0017 — 案件「2 年转 186 TRT 提醒」开关
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 cases 加 trt_reminder_enabled（boolean, 默认 false）：482 持有人工作满 2 年(技术上 22 个月)
-- 可转 186 TRT 永居，勾选后系统在下签满 22 个月时提醒中介启动。是否真正提醒是前端派生
-- （结合 case_stage_history 的下签日期 + 是否已开 186 TRT 案），此列只存「是否开启提醒」开关。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.cases
  add column if not exists trt_reminder_enabled boolean not null default false;
