const Gauge = ({ value = 0, label = '', size = 88, stroke = 9 }) => {
  const pct = Math.round(Math.min(100, Math.max(0, Number(value) || 0)))
  const color = pct <= 25 ? '#2E9E5B' : pct <= 60 ? '#E09F1E' : '#DE3B2E'
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`${label}: ${pct} por ciento`}
          className="-rotate-90"
        >
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#EDF2F7" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute text-center">
          <span className="block text-xl font-bold text-[#313235]">{pct}%</span>
        </div>
      </div>
    </div>
  )
}

export default Gauge