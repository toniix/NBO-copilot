import { useState } from 'react'
import { Check, Copy, MessageSquareText } from 'lucide-react'
import Section from './Section'

const GuionPanel = ({ clientData }) => {
  const [copied, setCopied] = useState(false)
  const pitch = clientData.salesPitch

  if (!pitch) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pitch)
    } catch {
      const area = document.createElement('textarea')
      area.value = pitch
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Section
      title="Guion sugerido por IA"
      subtitle="Ábrelo o léelo tal cual durante la llamada"
      icon={MessageSquareText}
      accent="text-[#019DF4]"
      actions={
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4]"
        >
          {copied ? <Check className="h-4 w-4 text-[#2E9E5B]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar guion'}
        </button>
      }
    >
      <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">{pitch}</p>
    </Section>
  )
}

export default GuionPanel