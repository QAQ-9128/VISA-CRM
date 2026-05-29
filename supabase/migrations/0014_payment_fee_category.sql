-- ============================================================================
-- 0014 — 付款费用类别(fee_category)
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 payments 增加 fee_category（可空 text）：主要用于客户收款(from_client)的记账，
-- 标注这笔钱是哪类费用（律师费 / 文案费 / 其他自填）。前端存中文常量值，
-- "其他" 时存用户手填文本。付主代理 / 付介绍人(outbound) 不强制有，留 null 即可。
-- 选项配置放前端常量（src/types/domain.ts FEE_CATEGORIES），不加 DB check 约束以便灵活增改。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.payments add column if not exists fee_category text;
