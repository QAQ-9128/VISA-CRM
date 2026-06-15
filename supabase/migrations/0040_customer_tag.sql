-- 0040 客户标签（tag）
-- 给 customers 加一个可空文本列，存中文标签值（傻逼 / 大傻逼 / 正常人 / 聪明人）。
-- 纯 additive、nullable，不改 RLS、不影响既有数据（旧行 tag = null = 未打标）。
alter table public.customers
  add column if not exists tag text;

comment on column public.customers.tag is '客户标签（可空）：傻逼 / 大傻逼 / 正常人 / 聪明人，前端下拉选择，存中文值直显';
