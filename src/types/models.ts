/**
 * 应用层数据模型：从 database.ts（表结构）派生的便捷别名。
 * database.ts 给查询/类型对齐用；domain.ts 给 UI 中文映射用；本文件让业务代码用更短的名字。
 */
import type { Tables, TablesInsert, TablesUpdate } from './database'

export type Profile = Tables<'profiles'>
export type Employer = Tables<'employers'>
export type Referrer = Tables<'referrers'>
/** 移民局系统账号（ImmiAccount）lookup：案件「所属账号」指向它。 */
export type ImmiAccount = Tables<'immi_accounts'>
export type Customer = Tables<'customers'>
export type Case = Tables<'cases'>
export type CaseApplicant = Tables<'case_applicants'>
export type Lodgement = Tables<'lodgements'>
export type CaseStageHistory = Tables<'case_stage_history'>
export type CaseDocument = Tables<'documents'>
export type PaymentPlan = Tables<'payment_plans'>
export type PaymentPlanItem = Tables<'payment_plan_items'>
export type Installment = Tables<'installments'>
export type Payment = Tables<'payments'>
export type FollowUp = Tables<'follow_ups'>
export type Task = Tables<'tasks'>
/** 合并后的记录行（待办 + 跟进同表）。命名避开 TS 内置 Record<K,V>。 */
export type RecordRow = Tables<'records'>
/** 概览独立待办清单项（不关联客户/案件）。 */
export type ChecklistItem = Tables<'checklist_items'>
/** 案件自定义提醒（挂在已有案件上，日历紫点）。 */
export type CaseReminder = Tables<'case_reminders'>
export type CaseReminderInsert = TablesInsert<'case_reminders'>

/** 家庭成员关联（把已有独立客户关联为某主申的副申；与 primary_applicant_id 并存）。 */
export type FamilyMemberLink = Tables<'family_member_links'>
export type FamilyMemberLinkInsert = TablesInsert<'family_member_links'>

// 写入类型（新建 / 更新）
export type CustomerInsert = TablesInsert<'customers'>
export type CustomerUpdate = TablesUpdate<'customers'>
export type CaseInsert = TablesInsert<'cases'>
export type CaseUpdate = TablesUpdate<'cases'>
export type CaseApplicantInsert = TablesInsert<'case_applicants'>
export type EmployerInsert = TablesInsert<'employers'>
export type ReferrerInsert = TablesInsert<'referrers'>
export type ReferrerUpdate = TablesUpdate<'referrers'>
export type ImmiAccountInsert = TablesInsert<'immi_accounts'>
export type LodgementInsert = TablesInsert<'lodgements'>
export type PaymentInsert = TablesInsert<'payments'>
export type FollowUpInsert = TablesInsert<'follow_ups'>
export type TaskInsert = TablesInsert<'tasks'>
export type RecordInsert = TablesInsert<'records'>
export type RecordUpdate = TablesUpdate<'records'>
