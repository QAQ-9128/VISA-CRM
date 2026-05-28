# 签证 CRM（crm-app）

澳洲移民/签证中介的内部 CRM —— 实时跟进客户的签证申请进度、双流账目（收客户 / 付主代理）、文件到期预警、主副申请人家庭组、跟进与待办。供小团队（1–2 人）长期使用。

## 技术栈

- 前端：Vite + React 19 + TypeScript（纯静态 SPA）、Tailwind CSS v4、React Router v7
- 状态：TanStack Query（服务端数据）+ Zustand（轻量 UI 态）
- 后端：Supabase（Postgres + Auth + Storage + Realtime）
- 测试：Vitest + Testing Library

目标跑在 Supabase free + Vercel free 额度内。

## 本地开发

```bash
npm install
# 配置环境变量：复制 .env.example 为 .env.local 并填入 Supabase 项目值
npm run dev        # 启动开发服务器
npm run test:run   # 跑测试
npm run build      # 类型检查 + 生产构建
npm run lint       # 代码检查
```

## 环境变量

见 `.env.example`。需要 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`（publishable/anon 客户端公钥，可暴露）。`.env.local` 已被 git 忽略，切勿提交任何密钥；service_role/secret key 永远不要放进前端。

## 数据库

Schema 在 `supabase/migrations/0001_init.sql`，运维说明见 `supabase/README.md`。数据模型的权威定义在 `数据模型规格.md`。

## 给 AI 助手

`CLAUDE.md` 记录了架构约定与代码结构，供 Claude Code 等工具参考。
