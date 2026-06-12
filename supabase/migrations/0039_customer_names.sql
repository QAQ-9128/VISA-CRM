-- ============================================================================
-- 0039 — 客户「中文名 + 英文名」（customers.chinese_name / english_name）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 姓名拆成两栏：中文名 / 英文名（英文名录入约定「姓全大写 + 名首字母大写」，如 DENG Tao，
-- 系统不自动改大小写）。显示规则在前端统一解析（lib/customerName）：中文 ?? 英文 ?? 旧 full_name。
-- full_name 保留并继续 not null：表单保存时同步写为「中文 ?? 英文」，
-- 老数据只有 full_name 也照常显示（兜底），排序/搜索沿用 full_name。
--
-- 纯增量（两列均可空）、可重复执行；不动 RLS。
-- ============================================================================

alter table public.customers add column if not exists chinese_name text;
alter table public.customers add column if not exists english_name text;
