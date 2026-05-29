-- ============================================================================
-- 0010 — 放开 tasks / follow_ups 的删除权限给登录用户
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 背景：0001 给所有业务表统一生成了 “delete 仅 admin” 的策略
--   (for delete to authenticated using public.is_admin())。
-- 于是非 admin 账号点「记录」表里的删除/标记转换时，DELETE 被 RLS 静默拦截，
-- 表现为「删不掉 / 转换后留下重复行」。
--
-- tasks / follow_ups 是低风险的个人记录（待办、跟进），且本工具仅 1–2 人内部使用，
-- 这里把这两张表的删除放开给任意登录用户。其它业务表（客户/案件/财务等）维持软删 + admin 删的约定不变。
-- 纯增量、可重复执行。
-- ============================================================================

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (true);

drop policy if exists follow_ups_delete on public.follow_ups;
create policy follow_ups_delete on public.follow_ups
  for delete to authenticated using (true);
