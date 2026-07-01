-- 0042: 「预支出」携带付款对象，支撑费用卡支出侧「预支出 → 实际支出」列式流转。
--
-- 背景：支出列式录入分两态——
--   · 实际支出 = payments(direction in to_company/to_referrer)，amount=实付，计入净额（口径不变）；
--   · 预支出   = payment_plan_items(kind='payable')，无 payment → 天然不进净额、各处已用 isPayableItem 排除。
-- 但 payable 行原本不带「付给公司/付给介绍人」方向，故「记支出」转实际时不知该写哪个 direction。
-- 加一列 expense_direction 存付款对象（to_company/to_referrer），仅对 payable 支出行有意义。
--
-- additive + nullable：历史行/应收行默认 null，行为完全不变；computeAccounting / 财务双流 / RLS 均不动。

alter table public.payment_plan_items
  add column if not exists expense_direction text;

comment on column public.payment_plan_items.expense_direction is
  '仅「预支出」(kind=''payable'')用：付款对象 to_company=付给公司 / to_referrer=付给介绍人。记支出转实际时据此写 payments.direction。应收行恒为 null。';
