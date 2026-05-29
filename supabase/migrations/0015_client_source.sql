-- ============================================================================
-- 0015 — 客户「等级」改为「客户来源」（priority_tier → client_source）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 语义彻底改变：原 vip/a/b/c「等级」→ 现 red/green/yellow「来源」
--   red    = 公司派的
--   green  = 自己的
--   yellow = 帮别人擦屁股的
-- 旧值不迁移（语义不对应）：新列 client_source 默认 NULL，让用户重新打标。
-- 与 gender 一致：纯 text 列、可空、不加 DB check 约束，可选项配置放前端
-- (src/types/domain.ts CLIENT_SOURCES)，以便随时增改类别不必跑迁移。
-- 纯增量、可重复执行。
-- ============================================================================

-- 1) 新增来源列（text，可空，全 NULL）
alter table public.customers add column if not exists client_source text;

-- 2) 丢弃旧「等级」列（旧 vip/a/b/c 数据随列一并删除 = 等价于全部归 NULL）
alter table public.customers drop column if exists priority_tier;

-- 3) 删除不再使用的旧枚举类型（列已删除，无依赖）
drop type if exists public.customer_tier cascade;
