import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Store, Lock, Mail, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Input } from '../components/ui/index.js'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, senha)
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.message || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg">
            <Store size={24} />
          </span>
          <h1 className="text-lg font-semibold text-gray-900">SeixasTec — Gestão Total</h1>
          <p className="text-sm text-gray-500">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Input
            label="E-mail"
            type="email"
            required
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <Input
            label="Senha"
            type="password"
            required
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={loading} icon={LogIn}>
            Entrar
          </Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Lock size={12} />
          Teste: admin@seixastec.local / admin123
        </p>
      </div>
    </div>
  )
}
