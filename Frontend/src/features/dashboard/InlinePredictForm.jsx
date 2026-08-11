import { useState } from 'react'
import useDashboardStore from '../../store/useDashboardStore.js'

const InlinePredictForm = () => {
  const { isLoading, simulateManualOffer, closeInlineForm, clientData } = useDashboardStore()
  const [antiguedad, setAntiguedad] = useState('0 a 6 meses')
  const [costo_plan, setCostoPlan] = useState('39.9')
  const [reclamos, setReclamos] = useState('No (0)')
  const [tipo_linea, setTipoLinea] = useState('Postpago')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const costoNum = Number(costo_plan)
    if (!costo_plan || Number.isNaN(costoNum) || costoNum <= 0) {
      setError('Ingrese un `costo_plan` válido mayor que 0')
      return
    }
    const formData = { antiguedad, costo_plan: costoNum, reclamos, tipo_linea }
    await simulateManualOffer(formData)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mt-6">
      <h3 className="text-base font-semibold text-[#313235]">Cliente no encontrado. Ingrese datos para simulación de riesgo</h3>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-slate-600">Antigüedad</label>
          <select value={antiguedad} onChange={(e) => setAntiguedad(e.target.value)} className="input-primary mt-1">
            <option>0 a 6 meses</option>
            <option>6 a 12 meses</option>
            <option>12 a 18 meses</option>
            <option>18 a 24 meses</option>
            <option>Más de 24 meses</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600">Costo del plan (S/)</label>
          <input type="number" min="0" step="0.01" value={costo_plan} onChange={(e) => setCostoPlan(e.target.value)} className="input-primary mt-1" inputMode="decimal" />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div>
          <label className="block text-sm text-slate-600">Reclamos</label>
          <div className="mt-1 flex items-center gap-4">
            <label className="flex items-center gap-2"><input type="radio" name="reclamos" value="No (0)" checked={reclamos === 'No (0)'} onChange={(e) => setReclamos(e.target.value)} /> No (0)</label>
            <label className="flex items-center gap-2"><input type="radio" name="reclamos" value="Sí (1)" checked={reclamos === 'Sí (1)'} onChange={(e) => setReclamos(e.target.value)} /> Sí (1)</label>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-600">Tipo de línea</label>
          <div className="mt-1 flex items-center gap-4">
            <label className="flex items-center gap-2"><input type="radio" name="tipo_linea" value="Prepago" checked={tipo_linea === 'Prepago'} onChange={(e) => setTipoLinea(e.target.value)} /> Prepago</label>
            <label className="flex items-center gap-2"><input type="radio" name="tipo_linea" value="Postpago" checked={tipo_linea === 'Postpago'} onChange={(e) => setTipoLinea(e.target.value)} /> Postpago</label>
          </div>
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Calculando riesgo...' : 'Calcular riesgo'}</button>
          <button type="button" onClick={() => { setError(''); closeInlineForm() }} className="btn-outline">Cancelar</button>
        </div>
      </form>

      {clientData && (
        <div className="mt-6">
          <p className="text-sm text-slate-500">Resultado de la simulación:</p>
          <p className="mt-2 text-lg font-semibold">Probabilidad estimada de churn: <span className="text-[#FF6B35]">{clientData.churnScore}%</span></p>
        </div>
      )}
    </section>
  )
}

export default InlinePredictForm
