import { CLIENT_SOURCES } from '../types/domain'
import type { ClientSource } from '../types/domain'
import type { Customer } from '../types/models'

/** 来源筛选值：三种来源 + 「未分类」(client_source 为空/无效)。 */
export type SourceFilterValue = ClientSource | 'unclassified'

export interface CustomerFilter {
  /** 选中的来源（空 = 不限） */
  sources: ReadonlySet<SourceFilterValue>
  /** 选中的担保雇主 id（空 = 不限） */
  employerIds: ReadonlySet<string>
  /** 选中的介绍人 id（空 = 不限） */
  referrerIds: ReadonlySet<string>
  /** 选中的签证类别（空 = 不限）；按客户名下案件的 visa_subclass 匹配 */
  subclasses: ReadonlySet<string>
  /** 只看星标（优先）客户 */
  starredOnly: boolean
}

export const EMPTY_CUSTOMER_FILTER: CustomerFilter = {
  sources: new Set(),
  employerIds: new Set(),
  referrerIds: new Set(),
  subclasses: new Set(),
  starredOnly: false,
}

/** 已选条件数（用于筛选按钮角标）。 */
export function customerFilterCount(f: CustomerFilter): number {
  return f.sources.size + f.employerIds.size + f.referrerIds.size + f.subclasses.size + (f.starredOnly ? 1 : 0)
}

/** 客户来源归一：空 / 非法值 → 'unclassified'。 */
export function customerSource(c: Customer): SourceFilterValue {
  return c.client_source && (CLIENT_SOURCES as readonly string[]).includes(c.client_source)
    ? (c.client_source as ClientSource)
    : 'unclassified'
}

/**
 * 客户属性是否命中（来源 / 雇主 / 介绍人 / 星标）；签证类别另由 matchesVisaFilter 判。
 * 同维度「或」、跨维度「且」；空维度不限。
 */
export function matchesCustomerFilter(c: Customer, f: CustomerFilter): boolean {
  if (f.starredOnly && !c.is_starred) return false
  if (f.sources.size && !f.sources.has(customerSource(c))) return false
  if (f.employerIds.size && (!c.sponsor_employer_id || !f.employerIds.has(c.sponsor_employer_id)))
    return false
  if (f.referrerIds.size && (!c.referrer_id || !f.referrerIds.has(c.referrer_id))) return false
  return true
}

/**
 * 签证类别过滤：空集不限；否则给定签证集合与已选签证有交集才算命中。
 * 列表传客户名下所有案件的签证集。
 */
export function matchesVisaFilter(f: Pick<CustomerFilter, 'subclasses'>, subclasses: readonly string[]): boolean {
  if (!f.subclasses.size) return true
  return subclasses.some((s) => f.subclasses.has(s))
}
