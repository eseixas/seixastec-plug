import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext.jsx'

// Modal de aprovação de gerente: pede e-mail+senha de um usuário ADMIN/GERENTE,
// valida contra POST /auth/validar-gerente e devolve { aprovadorId, nome } via
// onConfirm. Reutilizado em desconto, cancelamento e fechamento de caixa.
export default function AprovacaoGerente({ titulo = 'Aprovação de gerente', onConfirm, onClose }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [validando, setValidando] = useState(false)

  async function confirmar(e) {
    e.preventDefault()
    setValidando(true)
    try {
      const r = await api.post('/auth/validar-gerente', { email, senha }, { auth: false })
      onConfirm(r.usuarioId, r.nome)
    } catch (err) {
      toast.error(err.message || 'Credenciais inválidas')
    } finally {
      setValidando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck size={20} className="text-brand-600" /> {titulo}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Esta ação exige a confirmação de um gerente ou administrador.
        </p>
        <form onSubmit={confirmar}>
          <label className="mb-1 block text-sm font-medium text-gray-700">E-mail do gerente</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2"
            required
          />
          <label className="mb-1 block text-sm font-medium text-gray-700">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mb-6 w-full rounded-lg border border-gray-300 px-3 py-2"
            required
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2.5 font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={validando}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {validando ? 'Validando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
