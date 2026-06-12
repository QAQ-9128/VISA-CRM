import type { KeyboardEventHandler } from 'react'
import { TextField } from '../ui/TextField'

/** 英文名占位提示（录入约定；系统按录入原样保存/显示，不自动改大小写）。 */
export const ENGLISH_NAME_PLACEHOLDER = '如 DENG Tao（姓全大写 + 名首字母大写）'

/**
 * 「中文名 + 英文名」两栏（2026-06 姓名拆两栏）：主客户表单与案件快速建档共用，
 * 字段/占位/校验口径一处定义。至少填一个名的校验由调用方按各自保存门禁做
 * （本组件不标 required——两栏任填其一即可）。
 */
export function NameFields({
  chineseName,
  englishName,
  onChineseChange,
  onEnglishChange,
  onNameKeyDown,
}: {
  chineseName: string
  englishName: string
  onChineseChange: (v: string) => void
  onEnglishChange: (v: string) => void
  /** 可选：两个输入框共用的 keydown（快速建档卡用来拦 Enter=创建，不冒泡提交外层表单） */
  onNameKeyDown?: KeyboardEventHandler<HTMLInputElement>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="中文名"
        value={chineseName}
        onChange={(e) => onChineseChange(e.target.value)}
        onKeyDown={onNameKeyDown}
        placeholder="如 邓韬"
      />
      <TextField
        label="英文名"
        value={englishName}
        onChange={(e) => onEnglishChange(e.target.value)}
        onKeyDown={onNameKeyDown}
        placeholder={ENGLISH_NAME_PLACEHOLDER}
      />
    </div>
  )
}
