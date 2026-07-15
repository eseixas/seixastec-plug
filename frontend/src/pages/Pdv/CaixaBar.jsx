import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDateTime } from '../../lib/format.js'
import { Button, Input, Modal } from '../../components/ui/index.js'
import { useToast } from '../../context/ToastContext.jsx'

function MovimentoModal({ open, onClose, caixaId, tipo }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')

  const isSuprimento = tipo === 'SUPRIMENTO'
  const titulo = isSuprimento ? 'Suprimento (entrada de dinheiro)' : 'Sangria (saída de dinheiro)'

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/caixa/${caixaId}/movimento`, {
        tipo,
        valor: Number(valor),
        motivo: motivo.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(isSuprimento ? 'Suprimento registrado.' : 'Sangria registrada.')
      queryClient.invalidateQueries({ queryKey: ['caixa', 'atual'] })
      handleClose()
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível registrar o movimento.')
    },
  })

  function handleClose() {
    if (mutation.isPending) return
    setValor('')
    setMotivo('')
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    const n = Number(valor)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={titulo}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Confirmar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Valor"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Motivo (opcional)</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}

function ResumoLinha({ label, value, strong = false, highlight }) {
  let valueClass = 'text-gray-900'
  if (highlight === 'green') valueClass = 'text-emerald-600'
  else if (highlight === 'red') valueClass = 'text-red-600'
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={strong ? 'font-semibold text-gray-800' : 'text-gray-500'}>{label}</span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} ${valueClass}`}>{value}</span>
    </div>
  )
}

function FecharCaixaModal({ open, onClose, caixaId }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [valorFechamento, setValorFechamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [resumo, setResumo] = useState(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/caixa/${caixaId}/fechar`, {
        valorFechamento: Number(valorFechamento),
        observacao: observacao.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success('Caixa fechado com sucesso.')
      setResumo(data?.resumo ?? null)
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível fechar o caixa.')
    },
  })

  function resetState() {
    setValorFechamento('')
    setObservacao('')
    setResumo(null)
  }

  // Fechar sem ter concluído o processo (ainda no formulário).
  function handleCancel() {
    if (mutation.isPending) return
    resetState()
    onClose()
  }

  // Após visualizar o resumo, confirma e volta para a tela de abrir caixa.
  function handleAcknowledge() {
    resetState()
    onClose()
    queryClient.invalidateQueries({ queryKey: ['caixa', 'atual'] })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const n = Number(valorFechamento)
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Informe o valor de fechamento (contado em dinheiro).')
      return
    }
    mutation.mutate()
  }

  const diferenca = Number(resumo?.diferenca) || 0

  return (
    <Modal
      open={open}
      onClose={resumo ? handleAcknowledge : handleCancel}
      title="Fechar caixa"
      size="md"
      footer={
        resumo ? (
          <Button onClick={handleAcknowledge}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleCancel} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleSubmit} loading={mutation.isPending}>
              Fechar caixa
            </Button>
          </>
        )
      }
    >
      {resumo ? (
        <div className="space-y-1">
          <p className="mb-3 text-sm text-gray-500">Resumo do fechamento:</p>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4 py-1">
            <ResumoLinha label="Valor de abertura" value={formatCurrency(resumo.valorAbertura)} />
            <ResumoLinha label="Vendas em dinheiro" value={formatCurrency(resumo.dinheiroVendas)} />
            <ResumoLinha label="Suprimentos" value={formatCurrency(resumo.suprimentos)} />
            <ResumoLinha label="Sangrias" value={formatCurrency(resumo.sangrias)} />
            <ResumoLinha
              label="Esperado em dinheiro"
              value={formatCurrency(resumo.esperadoDinheiro)}
              strong
            />
            <ResumoLinha label="Informado (contado)" value={formatCurrency(resumo.informado)} />
            <ResumoLinha
              label="Diferença"
              value={formatCurrency(resumo.diferenca)}
              strong
              highlight={diferenca >= 0 ? 'green' : 'red'}
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Informe o valor contado em dinheiro na gaveta para conferência.
          </p>
          <Input
            label="Valor de fechamento (dinheiro contado)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            value={valorFechamento}
            onChange={(e) => setValorFechamento(e.target.value)}
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observação (opcional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </form>
      )}
    </Modal>
  )
}

export default function CaixaBar({ caixa }) {
  const [modal, setModal] = useState(null) // 'SUPRIMENTO' | 'SANGRIA' | 'FECHAR' | null

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-gray-600">
        <span className="font-medium text-gray-800">Caixa aberto</span> às{' '}
        {formatDateTime(caixa?.aberturaEm)} — Abertura:{' '}
        <span className="font-medium text-gray-800">{formatCurrency(caixa?.valorAbertura)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowDownCircle}
          onClick={() => setModal('SUPRIMENTO')}
        >
          Suprimento
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowUpCircle}
          onClick={() => setModal('SANGRIA')}
        >
          Sangria
        </Button>
        <Button variant="danger" size="sm" icon={Lock} onClick={() => setModal('FECHAR')}>
          Fechar caixa
        </Button>
      </div>

      <MovimentoModal
        open={modal === 'SUPRIMENTO'}
        onClose={() => setModal(null)}
        caixaId={caixa?.id}
        tipo="SUPRIMENTO"
      />
      <MovimentoModal
        open={modal === 'SANGRIA'}
        onClose={() => setModal(null)}
        caixaId={caixa?.id}
        tipo="SANGRIA"
      />
      <FecharCaixaModal open={modal === 'FECHAR'} onClose={() => setModal(null)} caixaId={caixa?.id} />
    </div>
  )
}
