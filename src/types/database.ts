/**
 * 数据库表结构类型（手写，对齐 supabase/migrations/0001_init.sql）。
 *
 * 注：本应由 `supabase gen types typescript --linked > src/types/database.ts` 生成，
 * 但当前 CLI 尚未 link，故手写等价版本。完成 CLI login + link 后可用该命令覆盖重生成。
 *
 * 枚举的字面量类型从 domain.ts 复用（domain.ts 是枚举值的单一事实源）。
 * 应用层行类型从这里派生，见 models.ts。
 *
 * 每张表都带 `Relationships: []`，且 schema 含 Views/Functions/CompositeTypes 空对象——
 * 这是 supabase-js 的 GenericSchema/GenericTable 约束，缺失会导致 insert/update 被推断为 never。
 */
import type {
  AppRole,
  CaseStage,
  DocType,
  FollowUpChannel,
  LodgementOutcome,
  LodgementType,
  PaymentDirection,
  PaymentMethod,
  RecordType,
  ReferrerKind,
} from './domain'

type Timestamp = string // ISO 时间戳
type DateStr = string // 'YYYY-MM-DD'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: AppRole
          full_name: string | null
          active: boolean
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id: string
          role?: AppRole
          full_name?: string | null
          active?: boolean
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: {
          id?: string
          role?: AppRole
          full_name?: string | null
          active?: boolean
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Relationships: []
      }
      employers: {
        Row: {
          id: string
          name: string
          abn: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          notes: string | null
          is_archived: boolean
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          name: string
          abn?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          notes?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['employers']['Insert']>
        Relationships: []
      }
      referrers: {
        Row: {
          id: string
          name: string
          /** 一表两用：referrer=介绍人 / owner=归属人（介绍人页开关切换） */
          kind: ReferrerKind
          contact_phone: string | null
          contact_email: string | null
          notes: string | null
          is_archived: boolean
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          name: string
          kind?: ReferrerKind
          contact_phone?: string | null
          contact_email?: string | null
          notes?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['referrers']['Insert']>
        Relationships: []
      }
      /** 移民局系统账号（ImmiAccount）lookup：代理有多个递交账号，案件记录用哪个账号递交（0038） */
      immi_accounts: {
        Row: {
          id: string
          name: string
          is_archived: boolean
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          name: string
          is_archived?: boolean
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['immi_accounts']['Insert']>
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          /** 旧姓名字段（not null，保存时同步为「中文 ?? 英文」；展示一律走 lib/customerName 解析） */
          full_name: string
          /** 中文名（0039，可空） */
          chinese_name: string | null
          /** 英文名（0039，可空；录入约定「姓全大写 + 名首字母大写」如 DENG Tao，系统不改大小写） */
          english_name: string | null
          birth_date: DateStr | null
          gender: string | null
          passport_no: string | null
          nationality: string | null
          phone: string | null
          email: string | null
          wechat: string | null
          address: string | null
          sponsor_employer_id: string | null
          sponsor_position: string | null
          referrer_id: string | null
          /** 归属人（referrers.kind=owner）；与 client_source（来源·三色）无关、并存 */
          owner_referrer_id: string | null
          primary_applicant_id: string | null
          relationship_to_primary: string | null
          client_source: string | null
          is_starred: boolean
          notes: string | null
          assigned_to: string | null
          created_by: string | null
          is_archived: boolean
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          full_name: string
          chinese_name?: string | null
          english_name?: string | null
          birth_date?: DateStr | null
          gender?: string | null
          passport_no?: string | null
          nationality?: string | null
          phone?: string | null
          email?: string | null
          wechat?: string | null
          address?: string | null
          sponsor_employer_id?: string | null
          sponsor_position?: string | null
          referrer_id?: string | null
          owner_referrer_id?: string | null
          primary_applicant_id?: string | null
          relationship_to_primary?: string | null
          client_source?: string | null
          is_starred?: boolean
          notes?: string | null
          assigned_to?: string | null
          created_by?: string | null
          is_archived?: boolean
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
        Relationships: []
      }
      cases: {
        Row: {
          id: string
          case_number: string
          customer_id: string
          visa_subclass: string
          visa_stream: string | null
          case_category: string | null
          case_details: Record<string, string> | null
          destination_country: string | null
          sponsor_position: string | null
          sponsor_employer_id: string | null
          /** 所属账号：本案用哪个移民局系统账号递交（immi_accounts，可空；0038） */
          immi_account_id: string | null
          current_stage: CaseStage
          currency: string
          sync_tracking: boolean
          trt_reminder_enabled: boolean
          trt_reminder_dismissed: boolean
          cohab_reminder_enabled: boolean
          cohab_reminder_last: DateStr | null
          parent_case_id: string | null
          parent_sync_progress: boolean
          assigned_to: string | null
          created_by: string | null
          is_archived: boolean
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          case_number?: string // DB 触发器自动生成 8 位随机编号
          customer_id: string
          visa_subclass: string
          visa_stream?: string | null
          case_category?: string | null
          case_details?: Record<string, string> | null
          destination_country?: string | null
          sponsor_position?: string | null
          sponsor_employer_id?: string | null
          immi_account_id?: string | null
          current_stage?: CaseStage
          currency?: string
          sync_tracking?: boolean
          trt_reminder_enabled?: boolean
          trt_reminder_dismissed?: boolean
          cohab_reminder_enabled?: boolean
          cohab_reminder_last?: DateStr | null
          parent_case_id?: string | null
          parent_sync_progress?: boolean
          assigned_to?: string | null
          created_by?: string | null
          is_archived?: boolean
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['cases']['Insert']>
        Relationships: []
      }
      case_applicants: {
        Row: {
          id: string
          case_id: string
          customer_id: string
          created_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          customer_id: string
          created_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['case_applicants']['Insert']>
        Relationships: []
      }
      lodgements: {
        Row: {
          id: string
          case_id: string
          type: LodgementType
          lodged_date: DateStr | null
          reference_number: string | null
          dha_processing_days: number | null
          dha_processing_updated_at: DateStr | null
          outcome: LodgementOutcome
          outcome_date: DateStr | null
          note: string | null
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          type: LodgementType
          lodged_date?: DateStr | null
          reference_number?: string | null
          dha_processing_days?: number | null
          dha_processing_updated_at?: DateStr | null
          outcome?: LodgementOutcome
          outcome_date?: DateStr | null
          note?: string | null
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['lodgements']['Insert']>
        Relationships: []
      }
      case_stage_history: {
        Row: {
          id: string
          case_id: string
          from_stage: CaseStage | null
          to_stage: CaseStage
          note: string | null
          changed_by: string | null
          changed_at: Timestamp
          effective_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          from_stage?: CaseStage | null
          to_stage: CaseStage
          note?: string | null
          changed_by?: string | null
          changed_at?: Timestamp
          effective_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['case_stage_history']['Insert']>
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          customer_id: string
          case_id: string | null
          doc_type: DocType
          title: string | null
          storage_path: string | null
          file_name: string | null
          issue_date: DateStr | null
          expiry_date: DateStr | null
          note: string | null
          uploaded_by: string | null
          is_archived: boolean
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          customer_id: string
          case_id?: string | null
          doc_type: DocType
          title?: string | null
          storage_path?: string | null
          file_name?: string | null
          issue_date?: DateStr | null
          expiry_date?: DateStr | null
          note?: string | null
          uploaded_by?: string | null
          is_archived?: boolean
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
        Relationships: []
      }
      payment_plans: {
        Row: {
          id: string
          case_id: string
          applicant_id: string | null
          billed_to_customer_id: string | null
          client_total: number | null
          company_total: number | null
          referrer_total: number | null
          staged_billing: boolean
          currency: string
          note: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          applicant_id?: string | null
          billed_to_customer_id?: string | null
          client_total?: number | null
          company_total?: number | null
          referrer_total?: number | null
          staged_billing?: boolean
          currency?: string
          note?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['payment_plans']['Insert']>
        Relationships: []
      }
      payment_plan_items: {
        Row: {
          id: string
          plan_id: string
          fee_category: string
          amount_due: number
          periods: number
          note: string | null
          /** 款项方向：null/'receivable'=应收（默认），'payable'=应付（付主代理/付介绍人）。 */
          kind: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          plan_id: string
          fee_category: string
          amount_due?: number
          periods?: number
          note?: string | null
          kind?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['payment_plan_items']['Insert']>
        Relationships: []
      }
      installments: {
        Row: {
          id: string
          payment_plan_id: string
          label: string | null
          due_date: DateStr | null
          amount: number
          is_paid: boolean
          paid_at: DateStr | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          payment_plan_id: string
          label?: string | null
          due_date?: DateStr | null
          amount: number
          is_paid?: boolean
          paid_at?: DateStr | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['installments']['Insert']>
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          case_id: string
          applicant_id: string | null
          direction: PaymentDirection
          installment_id: string | null
          plan_item_id: string | null
          from_client_customer_id: string | null
          amount: number
          currency: string
          method: PaymentMethod
          paid_at: DateStr | null
          note: string | null
          fee_category: string | null
          invoice_path: string | null
          invoice_name: string | null
          recorded_by: string | null
          created_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          applicant_id?: string | null
          direction: PaymentDirection
          installment_id?: string | null
          plan_item_id?: string | null
          from_client_customer_id?: string | null
          amount: number
          currency?: string
          method?: PaymentMethod
          paid_at?: DateStr | null
          note?: string | null
          fee_category?: string | null
          invoice_path?: string | null
          invoice_name?: string | null
          recorded_by?: string | null
          created_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
        Relationships: []
      }
      follow_ups: {
        Row: {
          id: string
          customer_id: string
          case_id: string | null
          channel: FollowUpChannel
          content: string
          emoji_marker: string | null
          created_by: string | null
          created_at: Timestamp
        }
        Insert: {
          id?: string
          customer_id: string
          case_id?: string | null
          channel?: FollowUpChannel
          content: string
          emoji_marker?: string | null
          created_by?: string | null
          created_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['follow_ups']['Insert']>
        Relationships: []
      }
      records: {
        Row: {
          id: string
          customer_id: string
          case_id: string | null
          type: RecordType
          content: string
          due_date: DateStr | null
          is_done: boolean
          done_at: Timestamp | null
          assigned_to: string | null
          channel: FollowUpChannel | null
          emoji_marker: string | null
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          customer_id: string
          case_id?: string | null
          type: RecordType
          content: string
          due_date?: DateStr | null
          is_done?: boolean
          done_at?: Timestamp | null
          assigned_to?: string | null
          channel?: FollowUpChannel | null
          emoji_marker?: string | null
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['records']['Insert']>
        Relationships: []
      }
      checklist_items: {
        Row: {
          id: string
          content: string
          is_done: boolean
          /** 可选关联客户（归档时前端过滤隐藏） */
          customer_id: string | null
          /** 可选关联案件（归档时前端过滤隐藏） */
          case_id: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          content: string
          is_done?: boolean
          customer_id?: string | null
          case_id?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['checklist_items']['Insert']>
        Relationships: []
      }
      family_member_links: {
        Row: {
          id: string
          primary_customer_id: string
          member_customer_id: string
          relationship: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          primary_customer_id: string
          member_customer_id: string
          relationship?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['family_member_links']['Insert']>
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          customer_id: string | null
          case_id: string | null
          title: string
          due_date: DateStr | null
          is_done: boolean
          done_at: Timestamp | null
          assigned_to: string | null
          created_by: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: {
          id?: string
          customer_id?: string | null
          case_id?: string | null
          title: string
          due_date?: DateStr | null
          is_done?: boolean
          done_at?: Timestamp | null
          assigned_to?: string | null
          created_by?: string | null
          created_at?: Timestamp
          updated_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: []
      }
      case_reminders: {
        Row: {
          id: string
          case_id: string
          content: string
          /** 基准日（点「+」的日期格，本地日期）；到期 = base_date + offset */
          base_date: DateStr
          offset_value: number
          /** 'day' | 'month' | 'year' */
          offset_unit: string
          /** never/hourly/daily/weekdays/weekends/weekly/biweekly/monthly/every3months/every6months/yearly/custom */
          repeat_rule: string
          enabled: boolean
          created_by: string | null
          created_at: Timestamp
        }
        Insert: {
          id?: string
          case_id: string
          content: string
          base_date: DateStr
          offset_value?: number
          offset_unit?: string
          repeat_rule?: string
          enabled?: boolean
          created_by?: string | null
          created_at?: Timestamp
        }
        Update: Partial<Database['public']['Tables']['case_reminders']['Insert']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
    Enums: {
      app_role: AppRole
      case_stage: CaseStage
      lodgement_type: LodgementType
      lodgement_outcome: LodgementOutcome
      payment_direction: PaymentDirection
      payment_method: PaymentMethod
      follow_up_channel: FollowUpChannel
      doc_type: DocType
    }
  }
}

/** 便捷别名 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
