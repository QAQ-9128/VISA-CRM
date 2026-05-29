-- ============================================================================
-- 0007 — 案件签证「子类别 / stream」字段
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 cases 增加 visa_stream（可空 text）：记录某签证类别下的具体 stream，
-- 例如 visa_subclass='482' 时 visa_stream='Core Skills'。
-- 没有子类别的签证类型（如 820/801）visa_stream 留空。
--
-- 子类别的可选项配置放在前端常量（src/types/visaCatalog.ts），不入库，
-- 以便随移民政策变化随时增改，不必再跑迁移。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.cases add column if not exists visa_stream text;
