-- ============================================================================
-- 0024 — 分阶段收费（staged billing）：plan 开关 + item 期数（纯乘数）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。纯增量、additive、可重复执行。
--
-- 中介按阶段/里程碑报价（例：意向金 5000×1=5000、递交签证 80000×1=80000）。
--   payment_plans.staged_billing  —— 该计划是否用「阶段表」录入（false=现有款项明细）
--   payment_plan_items.periods    —— 期数（纯乘数）；阶段总额 amount_due = 应收金额(每期) × periods
--                                    与现有「分期节点(installments)」无关，互不干扰
--
-- 阶段名复用现有 fee_category（自由文本）；amount_due 仍是行总额，故已付/未付/欠款聚合不变。
-- 不新增表、不改 RLS、不动 #1(payment_plan_items) 现有数据（periods 回填默认 1）。
-- ============================================================================

alter table public.payment_plans
  add column if not exists staged_billing boolean not null default false;

alter table public.payment_plan_items
  add column if not exists periods integer not null default 1;

-- 期数为正整数（防脏写；已有数据 default 1 满足）
alter table public.payment_plan_items drop constraint if exists ppi_periods_positive;
alter table public.payment_plan_items add constraint ppi_periods_positive check (periods >= 1);
