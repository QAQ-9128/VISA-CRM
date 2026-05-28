# Supabase 运行手册

签证 CRM 的后端跑在 Supabase（DB + Auth + Storage + Realtime）。本目录是数据库迁移与运维说明。

## 1. 应用迁移

**方式 A：Dashboard（最简单，推荐首次用）**

1. 打开 Supabase 项目 → 左侧 **SQL Editor** → New query
2. 把 `migrations/0001_init.sql` 全文粘贴进去 → **Run**
3. ⚠️ 这是「初始 bootstrap」：第 R 段会 DROP 并重建全部业务表（保留 profiles 与已提升的 admin）。**全新项目无数据，安全；上线产生真实数据后请勿整段重跑**，改写 0002+ 增量迁移。

跑完验证 12 张表都在：

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
-- 期望：case_stage_history, cases, customers, documents, employers,
--       follow_ups, installments, lodgements, payment_plans, payments, profiles, tasks
```

**方式 B：Supabase CLI**

```bash
supabase link --project-ref <你的-project-ref>
supabase db push
```

## 2. 提升管理员（admin）

迁移**不硬编码任何邮箱**——所有用户默认 `role = 'staff'`。在 SQL Editor 里手动把自己提成 admin：

```sql
-- 看一眼有哪些用户
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id;

-- 把你自己提为 admin（用上面查到的 id 或直接按邮箱）
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = '你的邮箱');
```

提升后，前端重新登录（或刷新）即可看到「账号」菜单、进入 `/admin/users`。

## 3. 新建员工账号

注册已关闭，由 admin 建号：

- **现在**：Dashboard → Authentication → Users → **Add user**（勾 Auto Confirm）。
  触发器会自动建出对应 `profiles` 记录（默认 staff）。
- **以后**：`/admin/users` 页面会通过 Edge Function `create-user` 完成（Phase 7）。

## 4. 生成 TypeScript 类型（可选）

前端目前用手写的 `src/types/models.ts`。需要与库 schema 严格对齐时，用 CLI 生成：

```bash
supabase gen types typescript --project-id <project-ref> --schema public > ../src/types/database.ts
```

## 5. 长期运维（这是长期使用的生产工具）

Supabase free tier 有两个要注意的点：

- **7 天不活跃会被自动暂停** → 日常使用一般不触发；上线后可加保活定时任务（Vercel Cron / GitHub Action 定期跑一次只读查询）。
- **无自动备份 / 无 PITR** → 建议加定期 `pg_dump` 导出（`supabase db dump`）做备份；数据若重要到不能丢，可考虑升级 Pro（含每日备份）。

这两项会在上线阶段补上。

## 文件清单

- `migrations/0001_init.sql` — 9 个枚举 + 12 张表（profiles + 11 业务表）+ 四个函数/触发器 + 分权 RLS（DELETE 仅 admin）+ Storage(`case-files` 私有 bucket) + Realtime(cases / lodgements / tasks / installments)
- 数据模型权威定义见仓库根目录 `数据模型规格.md`
