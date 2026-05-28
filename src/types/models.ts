/**
 * 应用层数据模型：从 database.ts（表结构）派生的便捷别名。
 * database.ts 给查询/类型对齐用；domain.ts 给 UI 中文映射用；本文件让业务代码用更短的名字。
 */
import type { Tables, TablesInsert, TablesUpdate } from './database'

export type Profile = Tables<'profiles'>
export type Employer = Tables<'employers'>
export type Customer = Tables<'customers'>
export type Case = Tables<'cases'>
export type Lodgement = Tables<'lodgements'>
export type CaseStageHistory = Tables<'case_stage_history'>
export type CaseDocument = Tables<'documents'>
export type PaymentPlan = Tables<'payment_plans'>
export type Installment = Tables<'installments'>
export type Payment = Tables<'payments'>
export type FollowUp = Tables<'follow_ups'>
export type Task = Tables<'tasks'>

// 写入类型（新建 / 更新）
export type CustomerInsert = TablesInsert<'customers'>
export type CustomerUpdate = TablesUpdate<'customers'>
export type CaseInsert = TablesInsert<'cases'>
export type CaseUpdate = TablesUpdate<'cases'>
export type EmployerInsert = TablesInsert<'employers'>
export type LodgementInsert = TablesInsert<'lodgements'>
export type PaymentInsert = TablesInsert<'payments'>
export type FollowUpInsert = TablesInsert<'follow_ups'>
export type TaskInsert = TablesInsert<'tasks'>
