-- 0040: 费用款项明细加「方向种类」鉴别列，支撑「支出」两步流程（应付款项 → 记一笔实际支出）。
-- 加这一列后，payment_plan_items 既存「应收款项」（kind 为 null/'receivable'，全部历史行不变），
-- 又能存「应付款项」（kind='payable'，付主代理/付介绍人的欠付义务）。
-- 实付流水仍走 payments(direction)，净额算法不变；应收选择器一律排除 kind='payable' 行。
--
-- additive + nullable：历史行默认 null = 应收，行为完全不变；不动 RLS（沿用本表既有策略）。

alter table public.payment_plan_items
  add column if not exists kind text;

comment on column public.payment_plan_items.kind is
  '款项方向种类：null/''receivable''=应收（向客户收，默认）；''payable''=应付（付主代理/付介绍人）。应收聚合排除 payable 行。';
