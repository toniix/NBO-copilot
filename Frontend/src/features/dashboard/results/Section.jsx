const Section = ({ title, subtitle, icon: Icon, accent = 'text-[#313235]', children, actions }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-label={title}>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Icon className={`h-5 w-5 ${accent}`} aria-hidden="true" />
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold text-[#313235]">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
    {children}
  </section>
)

export default Section