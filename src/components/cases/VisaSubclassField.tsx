import { useState } from 'react'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { COMMON_VISA_SUBCLASSES } from '../../types/domain'

const OTHER = '__other__'
const COMMON: readonly string[] = COMMON_VISA_SUBCLASSES

/** 签证类别：常用类别下拉 + 「其他（手填）」任意值。 */
export function VisaSubclassField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [other, setOther] = useState(value !== '' && !COMMON.includes(value))

  const options = [
    ...COMMON_VISA_SUBCLASSES.map((s) => ({ value: s, label: `${s} 类` })),
    { value: OTHER, label: '其他（手填）' },
  ]

  return (
    <div className="space-y-3">
      <Select
        label="签证类别 *"
        placeholder="选择签证类别"
        options={options}
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true)
            onChange('')
          } else {
            setOther(false)
            onChange(e.target.value)
          }
        }}
      />
      {other && (
        <TextField
          label="自定义签证类别"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="如 494 / 500 / 887"
        />
      )}
    </div>
  )
}
