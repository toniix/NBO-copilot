import { Activity, AlertTriangle, CheckCircle2, HardDriveUpload, Sparkles, Zap } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Section from './Section'

const ConsumoDataChart = ({ clientData }) => {
  const profile = clientData?.profile || {}
  const offer = clientData?.offer || {}

  const consumoGB = Number(profile.consumo_datos_gb_prom) || 0
  const planGBRaw = Number(profile.gb_plan_actual)
  const isPlanUnlimited = planGBRaw >= 9999 || profile.plan_actual_desc?.toLowerCase().includes('ilimitado')
  const planGB = isPlanUnlimited ? Math.max(consumoGB * 1.3, 100) : (planGBRaw || 25)

  const offerGBRaw = Number(offer.gb_incluidos)
  const isOfferUnlimited = offerGBRaw >= 9999 || offer.nombre_oferta?.toLowerCase().includes('ilimitado') || offer.nombre_oferta?.toLowerCase().includes('total')
  const offerGB = isOfferUnlimited ? Math.max(consumoGB * 1.5, 120) : (offerGBRaw || planGB)

  const brechaGB = profile.brecha_datos != null ? Number(profile.brecha_datos) : (isPlanUnlimited ? 0 : consumoGB - planGB)
  const isExcedido = brechaGB > 0 && !isPlanUnlimited

  const pctUso = isPlanUnlimited
    ? 45
    : Math.min(Math.round((consumoGB / (planGB || 1)) * 100), 250)

  const chartData = [
    {
      name: 'Consumo Real',
      gb: consumoGB,
      display: `${consumoGB.toFixed(1)} GB`,
      fill: isExcedido ? '#EF4444' : '#019DF4',
    },
    {
      name: 'Plan Actual',
      gb: isPlanUnlimited ? Math.max(consumoGB * 1.1, 80) : planGB,
      display: isPlanUnlimited ? 'Ilimitado' : `${planGB} GB`,
      fill: '#94A3B8',
    },
    {
      name: 'Oferta NBO',
      gb: isOfferUnlimited ? Math.max(consumoGB * 1.4, 110) : offerGB,
      display: isOfferUnlimited ? 'Ilimitado' : `${offerGB} GB`,
      fill: '#5BC500',
    },
  ]

  return (
    <Section
      title="Uso de Datos vs Plan Actual"
      subtitle="Evaluación de capacidad contratada vs consumo real del cliente"
      icon={Activity}
      accent="text-[#019DF4]"
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis type="number" unit=" GB" tick={{ fill: '#64748B', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#313235', fontSize: 12, fontWeight: 600 }} width={100} />
            <Tooltip
              formatter={(value, name, props) => [props.payload.display, 'Capacidad / Consumo']}
              contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
            />
            <Bar dataKey="gb" radius={[0, 8, 8, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mini-cards de texto en horizontal */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Diagnóstico de Brecha de Datos */}
        <div
          className={`rounded-2xl border p-4 transition-all ${
            isExcedido
              ? 'border-rose-200 bg-rose-50/70'
              : isPlanUnlimited
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-blue-200 bg-blue-50/70'
          }`}
        >
          <div className="flex items-center gap-2">
            {isExcedido ? (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            )}
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#313235]">
              {isExcedido
                ? 'Exceso de Consumo Detectado'
                : isPlanUnlimited
                ? 'Plan Ilimitado Sin Restricciones'
                : 'Consumo Dentro del Límite'}
            </h4>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            {isExcedido
              ? `El cliente consume en promedio ${consumoGB.toFixed(1)} GB al mes, superando por +${brechaGB.toFixed(1)} GB su plan contratado (${planGB} GB).`
              : isPlanUnlimited
              ? `El cliente disfruta de datos ilimitados con un consumo mensual promedio de ${consumoGB.toFixed(1)} GB.`
              : `El cliente utiliza el ${pctUso}% de la capacidad total de su plan (${consumoGB.toFixed(1)} de ${planGB} GB).`}
          </p>

          {/* Barra de progreso de uso del plan */}
          {!isPlanUnlimited && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                <span>Capacidad Utilizada</span>
                <span className={isExcedido ? 'text-rose-600 font-extrabold' : 'text-[#019DF4]'}>
                  {pctUso}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isExcedido ? 'bg-rose-500' : 'bg-[#019DF4]'
                  }`}
                  style={{ width: `${Math.min(pctUso, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Solución NBO */}
        {offer.nombre_oferta && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs font-semibold text-[#3f8b00]">
            <Sparkles className="h-4 w-4 shrink-0 text-[#5BC500]" />
            <span>
              La oferta <strong className="text-slate-800">{offer.nombre_oferta}</strong> resuelve la necesidad del cliente ofreciendo {isOfferUnlimited ? 'datos ilimitados' : `${offerGB} GB al mes`}.
            </span>
          </div>
        )}
      </div>
    </Section>
  )
}

export default ConsumoDataChart
