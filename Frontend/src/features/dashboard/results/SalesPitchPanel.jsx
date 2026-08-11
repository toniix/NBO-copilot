import { useState } from 'react'
import { Check, Copy, MessageSquareText, Sparkles } from 'lucide-react'
import SectionCard from './SectionCard'
import Badge from './Badge'

const SalesPitchPanel = ({ clientData }) => {
  const { salesPitch, pitchType } = clientData
  const [copied, setCopied] = useState(false)

  if (!salesPitch) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(salesPitch)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = salesPitch
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <SectionCard
      title="Guion de venta"
      subtitle="Argumentario generado por IA para esta conversación"
      icon={<MessageSquareText className="h-5 w-5 text-[#019DF4]" aria-hidden="true" />}
      action={
        <div className="flex items-center gap-2">
          {pitchType && (
            <Badge tone={pitchType === 'fidelizacion' ? 'amber' : 'green'}>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {pitchType === 'fidelizacion' ? 'Retención' : 'Upselling'}
            </Badge>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-[#019DF4]/15 bg-[#019DF4]/[0.04] p-5">
        <p className="text-[15px] leading-7 text-[#313235]">{salesPitch}</p>
      </div>
    </SectionCard>
  )
}

export default SalesPitchPanel