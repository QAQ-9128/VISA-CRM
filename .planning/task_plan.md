# Task: 快速新建客户弹窗 + 归属人（referrers 一表两用）

## Objective
①「新建客户」改弹窗小卡片（姓名/性别/生日/归属人/介绍人，无案件逻辑）②归属人=referrers 表 kind='owner'，介绍人页开关切换，客户表 owner_referrer_id 外键，OwnerSelect Notion 式选择/创建。

## Phases
- [x] 1. 迁移 0030 + database.ts/domain.ts 类型
- [x] 2. api：listReferrers kind 过滤、createReferrer kind、customers 透传 owner_referrer_id（TDD）
- [x] 3. OwnerSelect combobox（TDD：过滤/创建行/Enter 不冒泡/清空）
- [x] 4. lib/quickCustomer + QuickCustomerDialog（TDD：5 字段、无案件、成功导航）
- [x] 5. 两处新建客户按钮改弹窗 + DashboardPage.test 改断言
- [x] 6. 介绍人页 kind 开关 + ReferrerFormPage kind + ReferrerSelect 过滤 referrer
- [x] 7. customerForm/CustomerForm/SummaryBand 加归属人 + 测试
- [x] 8. 预览种子 + 截图验收 + 全量验证

## Constraints
- 迁移用户手动跑（交付提醒）；财务/回收站名字解析零改动；/customers/new 保留
- TDD 先红后绿；每阶段全量回归

## Success Criteria
- 全绿 + 截图验收弹窗/开关/概要带归属人
