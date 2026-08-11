const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return ''

  const rawValue = String(value)
  const stringValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)

  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export const exportToCSV = (data, filename = 'reporte.csv') => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No hay datos para exportar')
  }

  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))]
  const rows = [
    headers,
    ...data.map((row) => headers.map((header) => row[header])),
  ]
  const csvContent = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')
  downloadBlob(`\uFEFF${csvContent}`, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8;')
}

export const exportToHTML = (data, filename = 'reporte-visual.html', options = {}) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No hay datos para exportar')
  }

  const title = options.title || 'Reporte de métricas'
  const subtitle = options.subtitle || 'Resumen generado desde el Dashboard del Supervisor'
  const summary = options.summary || []
  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))]
  const summaryMarkup = summary.map((item) => `
    <article class="metric">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.description)}</small>
    </article>
  `).join('')
  const tableHeaders = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')
  const tableRows = data.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`).join('')
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #313235; background: #f5f6f8; }
    body { margin: 0; padding: 32px 16px; }
    main { max-width: 980px; margin: 0 auto; }
    header { background: #019df4; color: white; padding: 28px 32px; border-radius: 14px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    header p { margin: 0; opacity: .9; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .metric, section { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(49, 50, 53, .06); }
    .metric span, .metric small { display: block; color: #64748b; }
    .metric strong { display: block; margin: 10px 0 4px; font-size: 28px; color: #019df4; }
    section h2 { margin: 0 0 16px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { color: #64748b; font-size: 12px; text-transform: uppercase; }
    @media (max-width: 640px) { body { padding: 16px 10px; } header { padding: 22px 20px; } h1 { font-size: 22px; } .metrics { grid-template-columns: 1fr; } }
  </style>
</head>
<body><main>
  <header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></header>
  <div class="metrics">${summaryMarkup}</div>
  <section><h2>Retención de clientes</h2><table><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRows}</tbody></table></section>
</main></body>
</html>`

  downloadBlob(html, filename.endsWith('.html') ? filename : `${filename}.html`, 'text/html;charset=utf-8;')
}

export const exportToPDF = async (elementId = 'supervisor-report', filename = 'reporte-supervisor.pdf') => {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const el = document.getElementById(elementId)
  if (!el) throw new Error('Elemento de reporte no encontrado')

  const canvas = await html2canvas(el, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgProps = { width: canvas.width, height: canvas.height }
  const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height)
  const imgWidth = imgProps.width * ratio
  const imgHeight = imgProps.height * ratio

  pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, 20, imgWidth, imgHeight)
  pdf.save(filename)
}
