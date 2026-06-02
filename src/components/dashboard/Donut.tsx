/** 环形图（手写 SVG，无图表库）。整体 rotate(-90deg) 从 12 点起，圆角端点。 */
export interface DonutDatum {
  value: number
  color: string
}

export function Donut({
  data,
  size = 190,
  thickness = 26,
  center,
  centerSub = '进行中案件',
}: {
  data: DonutDatum[]
  size?: number
  thickness?: number
  center?: number | string
  centerSub?: string
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const sum = data.reduce((a, d) => a + d.value, 0)
  let off = 0
  const cx = size / 2
  return (
    <svg width={size} height={size} style={{ flex: 'none', transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e6eaf2" strokeWidth={thickness} />
      {sum > 0 &&
        data.map((d, i) => {
          const len = (d.value / sum) * c
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-off}
              strokeLinecap="round"
            />
          )
          off += len
          return el
        })}
      <text
        x={cx}
        y={cx - 3}
        textAnchor="middle"
        transform={`rotate(90 ${cx} ${cx})`}
        style={{ fontSize: 34, fontWeight: 700, fill: '#172033', fontVariantNumeric: 'tabular-nums' }}
      >
        {center ?? sum}
      </text>
      <text
        x={cx}
        y={cx + 19}
        textAnchor="middle"
        transform={`rotate(90 ${cx} ${cx})`}
        style={{ fontSize: 12, fill: '#9aa4b8' }}
      >
        {centerSub}
      </text>
    </svg>
  )
}
