import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LockOpen } from 'lucide-react'
import { api } from '../../lib/api.js'
import { Button, Input, Card } from '../../components/ui/index.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function AbrirCaixaForm() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [valorAbertura, setValorAbertura] = useState('')

  const abrirMutation = useMutation({
    mutationFn: (valor) => api.post('/caixa/abrir', { valorAbertura: valor }),
    onSuccess: (caixa) => {
      toast.success('Caixa aberto com sucesso.')
      // Atualiza imediatamente o cache e refetch para desbloquear o PDV.
      if (caixa) queryClient.setQueryData(['caixa', 'atual'], caixa)
      queryClient.invalidateQueries({ queryKey: ['caixa', 'atual'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível abrir o caixa.')
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    const valor = valorAbertura === '' ? 0 : Number(valorAbertura)
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Informe um valor de abertura válido.')
      return
    }
    abrirMutation.mutate(valor)
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card title="Abrir caixa">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Para iniciar as vendas, informe o valor de abertura do caixa.
          </p>
          <Input
            label="Valor de abertura"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            value={valorAbertura}
            onChange={(e) => setValorAbertura(e.target.value)}
            autoFocus
          />
          <Button
            type="submit"
            icon={LockOpen}
            className="w-full"
            loading={abrirMutation.isPending}
          >
            Abrir caixa
          </Button>
        </form>
      </Card>
    </div>
  )
}
