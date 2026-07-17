import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setCarregando(true)
    try {
      await login(email, senha)
    } catch (err) {
      toast.error(err.message || 'Falha no login')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShoppingCart size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">SeixasTec — PDV</h1>
          <p className="text-sm text-gray-500">Frente de caixa</p>
        </div>
        <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <label className="mb-1 block text-sm font-medium text-gray-700">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          className="mb-6 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="mt-4 text-center text-xs text-gray-400">
          Teste: admin@seixastec.local / admin123
        </p>
      </form>
    </div>
  )
}
