-- ============================================================================
-- 0035 — 案件动态子字段（case_details）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 新建案件级联表单（案件大类 → 案件类型 → 动态子字段）中无现有列可放的子字段：
-- 评估机构 / 评估职位 / 用途 / 文件类型 / ABN / 就读院校 —— 统一存进一列 jsonb
-- （键为中文字段名，值为文本；空对象不入库存 NULL）。
-- 有现有列的照旧复用：签证子类别/Stream → visa_stream，担保职位 → sponsor_position，
-- 担保雇主 → sponsor_employer_id，案件大类 → case_category（0032）。
-- 纯增量、可空、可重复执行；不动 RLS。
-- ============================================================================

alter table public.cases add column if not exists case_details jsonb;
