const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatCurrency = (v) => brl.format(Number(v || 0))

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const fotoSrc = (fotoUrl) => (fotoUrl ? `${API_ORIGIN}${fotoUrl}` : null)

export const labelForma = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  DEBITO: 'Cartão de Débito',
  CREDITO: 'Cartão de Crédito',
  DEPOSITO: 'Depósito em Conta',
  LINK: 'Link de Pagamento',
}
