import { useState } from 'react'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { VISA_CATALOG, OTHER_TYPE, OTHER_STREAM } from '../../types/visaCatalog'
import { findVisaType } from '../../lib/visa'

const inputCls =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-100'

/**
 * 案件类型（visa_subclass）+ 子类别(stream) 选择：
 * - 类型：单一标签「案件类型」+ 按业务大类 optgroup 分组的下拉 + 过滤搜索框（选项很多）。
 *   选项/取值即 VISA_CATALOG 现有枚举，不变；可选「其他(手填)」自由文本。
 * - 子类别：仅当所选类型有子类别时出现；可空、不强制；支持「其他(手填)」自由文本。
 */
export function VisaSubclassField({
  subclass,
  stream,
  onChange,
}: {
  subclass: string
  stream: string | null
  onChange: (subclass: string, stream: string | null) => void
}) {
  const selectedType = findVisaType(subclass)
  // subclass 非空且不在目录里 → 视为手填类别
  const [otherType, setOtherType] = useState(subclass !== '' && !selectedType)
  // stream 非空且不在该类别子类别列表里 → 视为手填子类别
  const [otherStream, setOtherStream] = useState(
    !!stream && !!selectedType && !selectedType.streams.some((s) => s.value === stream),
  )
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  // 过滤：匹配类别号或名称；当前已选项始终保留，避免下拉值落空
  const matches = (t: { subclass: string; name: string }) =>
    t.subclass === subclass ||
    q === '' ||
    t.subclass.toLowerCase().includes(q) ||
    t.name.toLowerCase().includes(q)

  function pickType(v: string) {
    setQuery('')
    setOtherStream(false)
    if (v === OTHER_TYPE) {
      setOtherType(true)
      onChange('', null)
    } else {
      setOtherType(false)
      onChange(v, null) // 换类别时清空子类别
    }
  }

  function pickStream(v: string) {
    if (v === OTHER_STREAM) {
      setOtherStream(true)
      onChange(subclass, '')
    } else {
      setOtherStream(false)
      onChange(subclass, v || null)
    }
  }

  const showStream =
    !otherType && !!selectedType && (selectedType.streams.length > 0 || !!selectedType.allowOtherStream)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">案件类型<span className="ml-0.5 text-rose-500">*</span></label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入类别号或名称过滤，如 482 / partner"
          className={inputCls}
        />
        <select
          aria-label="案件类型"
          className={inputCls}
          value={otherType ? OTHER_TYPE : subclass}
          onChange={(e) => pickType(e.target.value)}
        >
          <option value="">选择案件类型</option>
          {VISA_CATALOG.map((cat) => {
            const types = cat.types.filter(matches)
            if (types.length === 0) return null
            return (
              <optgroup key={cat.label} label={cat.label}>
                {types.map((t) => (
                  <option key={t.subclass} value={t.subclass}>
                    {t.subclass} {t.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
          <optgroup label="其他">
            <option value={OTHER_TYPE}>其他（手填）</option>
          </optgroup>
        </select>
      </div>

      {otherType && (
        <TextField
          label="自定义案件类型"
          value={subclass}
          onChange={(e) => onChange(e.target.value, null)}
          placeholder="如 887 / 132 / 188A"
        />
      )}

      {showStream && (
        <Select
          label="子类别（可选）"
          placeholder="（可选）选择子类别"
          options={[
            ...selectedType!.streams,
            ...(selectedType!.allowOtherStream ? [{ value: OTHER_STREAM, label: '其他（手填）' }] : []),
          ]}
          value={otherStream ? OTHER_STREAM : stream ?? ''}
          onChange={(e) => pickStream(e.target.value)}
        />
      )}

      {showStream && otherStream && (
        <TextField
          label="自定义子类别"
          value={stream ?? ''}
          onChange={(e) => onChange(subclass, e.target.value)}
          placeholder="如 Subsequent Entrant"
        />
      )}
    </div>
  )
}
