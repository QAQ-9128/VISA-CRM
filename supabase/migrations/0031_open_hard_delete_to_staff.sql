-- ============================================================================
-- 0031 — 彻底删除全员开放（2026-06-06 用户拍板：两位用户均需删除权限）
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。可重复执行。
--
-- 背景：0001 起核心实体的 DELETE 仅 is_admin()；实际两位使用者都是 staff，
-- 应用内的彻底删除/撤销收款/删分期会被静默拒绝。Postgres RLS 多策略取 OR，
-- 这里**追加**一组 authenticated 可删的策略即可，不动旧策略（additive、零风险回滚=drop 本文件策略）。
-- 防误删仍有两道：UI 红色确认弹窗 + 软删（归档）作为默认删除语义。
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'cases', 'documents', 'employers', 'referrers',
    'payments', 'installments', 'payment_plans', 'payment_plan_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_delete_all_staff', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (true)',
      t || '_delete_all_staff', t
    );
  end loop;
end $$;
