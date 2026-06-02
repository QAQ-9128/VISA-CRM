-- 0028_referrer_total.sql
-- 给付款计划增加「介绍人应付总额」字段，与 company_total（主代理应付）对称。
-- 系统早已支持 to_referrer（付介绍人）方向的收款，但此前无处登记「应付介绍人总额」，
-- 故算不出「还欠介绍人多少」。本字段补齐双流之外的第三方应付。
-- additive：可空、无默认强制，存量行保持 NULL（视为未设介绍人应付），不影响现有逻辑。

alter table public.payment_plans
  add column if not exists referrer_total numeric;

comment on column public.payment_plans.referrer_total is '介绍人应付总额（AUD）；NULL=未设。已付介绍人由 payments(direction=to_referrer) 求和。';
