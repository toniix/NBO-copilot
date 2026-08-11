import { useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'

const initialForm = {
  lineAge: '0-6 meses',
  dataUsage: 'bajo',
  monthlyTicket: '39.90',
  hasComplaints: false,
}

const ManualSimulatorModal = ({ isLoading, onClose, onSubmit }) => {
  const [formData, setFormData] = useState(initialForm)

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="simulator-title">
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Cerrar simulador"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#313235] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="pr-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#019DF4]">Simulación manual</p>
          <h2 id="simulator-title" className="mt-2 text-xl font-semibold text-[#313235]">Cliente Nuevo - Simulación de Oferta</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Completa estas variables para generar una recomendación inicial.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block text-sm font-medium text-[#313235]">
            Antigüedad de la línea
            <select value={formData.lineAge} onChange={(event) => updateField('lineAge', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/10">
              <option value="0-6 meses">0-6 meses</option>
              <option value="6-12 meses">6-12 meses</option>
              <option value="1-3 años">1-3 años</option>
              <option value="+3 años">+3 años</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-[#313235]">
            Consumo de Datos Promedio
            <select value={formData.dataUsage} onChange={(event) => updateField('dataUsage', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/10">
              <option value="bajo">Bajo &lt;10GB</option>
              <option value="medio">Medio 10-30GB</option>
              <option value="alto">Alto &gt;30GB</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-[#313235]">
            Ticket Promedio Mensual (Soles)
            <input type="number" min="0" step="0.01" required value={formData.monthlyTicket} onChange={(event) => updateField('monthlyTicket', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/10" />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-[#313235]">
            <input type="checkbox" checked={formData.hasComplaints} onChange={(event) => updateField('hasComplaints', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#019DF4] focus:ring-[#019DF4]" />
            Quejas o Reclamos en los últimos 30 días
          </label>

          <button type="submit" disabled={isLoading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#5BC500] px-5 text-sm font-semibold text-white transition hover:bg-[#4da900] focus:outline-none focus:ring-4 focus:ring-[#5BC500]/20 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Generando oferta...</> : 'Generar Oferta Sugerida'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ManualSimulatorModal