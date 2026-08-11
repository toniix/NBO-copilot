const ProgressBar = ({ value, color = '#019DF4', label, suffix }) => {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="font-semibold text-[#313235]">{Math.round(pct)}%{suffix}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default ProgressBar