-- ============================================================================
-- 0008 — 客户性别(gender)
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 customers 增加 gender（可空 text）：前端存英文键 male/female/other，显示中文 男/女/其他。
-- 选项配置放前端常量（src/types/domain.ts GENDERS），不加 DB check 约束以便灵活增改。
--
-- 说明：本次同时精简了客户表单/详情（移除 电话/微信/邮箱/护照号/国籍/地址 的录入与展示），
-- 但这些列在数据库里**保留不删**，以防以后想加回来、避免现有数据丢失。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.customers add column if not exists gender text;
