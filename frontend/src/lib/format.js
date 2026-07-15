export function formatCurrency(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '-'
  // Datas "puras" (sem hora) chegam do backend como meia-noite UTC. Formatar em UTC
  // evita que o fuso horário local (ex: UTC-3) empurre a data exibida um dia para trás.
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

export function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatNumber(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('pt-BR').format(n)
}

export function toInputDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
