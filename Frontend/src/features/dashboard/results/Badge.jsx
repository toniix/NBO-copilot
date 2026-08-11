const TONES = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-[#019DF4]/10 text-[#0176b5] border-[#019DF4]/30',
  green: 'bg-[#5eb800]/10 text-[#3f8b00] border-[#5eb800]/40',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

const Badge = ({ tone = 'slate', icon: Icon, children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone] || TONES.slate} ${className}`}
  >
    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    {children}
  </span>
)

export default Badge