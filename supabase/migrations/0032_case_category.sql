-- ============================================================================
-- 0032 — 案件大类（case_category）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 cases 增加 case_category（可空 text）：业务粗分类，与「案件类型」（visa_subclass）
-- 并存形成两级——大类（粗）→ 案件类型（细），相互独立、不级联。
-- 取值由前端常量约束（src/types/domain.ts CASE_CATEGORIES：
-- 签证申请 / 职业评估 / De Facto 关系认定 / 定制文件），不做 DB 枚举，
-- 以便日后增改选项不必再跑迁移。旧案件留空（null）。
-- 纯增量、可重复执行；不动 RLS。
-- ============================================================================

alter table public.cases add column if not exists case_category text;
