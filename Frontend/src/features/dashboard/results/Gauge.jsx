const Gauge = ({ value, label, sublabel, size = 132, stroke = 11, color = '#019DF4' }) => {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EDF2F7"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 900ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#313235]">{Math.round(pct)}%</span>
          {sublabel && <span className="text-[11px] font-medium text-slate-400">{sublabel}</span>}
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  )
}

export default Gauge