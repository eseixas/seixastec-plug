import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ShoppingCart, CheckCircle2, Receipt } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency } from '../../lib/format.js'
import { Button, Card, Modal, PageHeader, Spinner } from '../../components/ui/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import AbrirCaixaForm from './AbrirCaixaForm.jsx'
import CaixaBar from './CaixaBar.jsx'
import ProdutoBusca from './ProdutoBusca.jsx'
import Carrinho from './Carrinho.jsx'
import ClienteBusca from './ClienteBusca.jsx'
import Pagamentos, { FORMAS_PAGAMENTO, aceitaParcelas } from './Pagamentos.jsx'
import {
  subtotalCents,
  totalCents,
  pagamentosCents,
  toReais,
  toCents,
} from './pdvMath.js'

let pagamentoUid = 0
function novoPagamento(forma = 'DINHEIRO', valor = '') {
  return { uid: `pg-${++pagamentoUid}`, forma, valor, parcelas: 1 }
}

const formaLabel = (forma) => FORMAS_PAGAMENTO.find((f) => f.value === forma)?.label || forma

export default function Pdv() {
  const toast = useToast()

  const {
    data: caixa,
    isLoading: caixaLoading,
  } = useQuery({
    queryKey: ['caixa', 'atual'],
    queryFn: () => api.get('/caixa/atual'),
  })

  // Estado da venda
  const [itens, setItens] = useState([])
  const [cliente, setCliente] = useState(null)
  const [descontoGeral, setDescontoGeral] = useState('')
  const [acrescimoGeral, setAcrescimoGeral] = useState('')
  const [observacao, setObservacao] = useState('')
  const [pagamentos, setPagamentos] = useState([])
  const [comprovante, setComprovante] = useState(null)

  // ---- Carrinho ----
  function addItem(variacao) {
    if (!variacao?.id) return
    setItens((prev) => {
      const existente = prev.find((i) => i.variacaoId === variacao.id)
      if (existente) {
        return prev.map((i) =>
          i.variacaoId === variacao.id
            ? { ...i, quantidade: (Math.trunc(Number(i.quantidade) || 0) || 0) + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          variacaoId: variacao.id,
          nome: variacao?.produto?.nome ?? 'Produto',
          tamanho: variacao?.tamanho ?? '',
          cor: variacao?.cor ?? '',
          precoUnit: Number(variacao?.precoVenda) || 0,
          quantidade: 1,
          desconto: 0,
        },
      ]
    })
  }

  function updateItem(variacaoId, field, value) {
    setItens((prev) =>
      prev.map((i) => {
        if (i.variacaoId !== variacaoId) return i
        if (field === 'quantidade') {
          // Permite string vazia temporária no input; normaliza na saída.
          if (value === '') return { ...i, quantidade: '' }
          const n = Math.trunc(Number(value))
          return { ...i, quantidade: Number.isFinite(n) && n >= 1 ? n : 1 }
        }
        return { ...i, [field]: value }
      })
    )
  }

  function removeItem(variacaoId) {
    setItens((prev) => prev.filter((i) => i.variacaoId !== variacaoId))
  }

  // ---- Pagamentos ----
  function addPagamento() {
    // Sugere preencher com o restante atual.
    const restante = toReais(restanteCents)
    setPagamentos((prev) => [
      ...prev,
      novoPagamento('DINHEIRO', restante > 0 ? String(restante.toFixed(2)) : ''),
    ])
  }

  function updatePagamento(uid, field, value) {
    setPagamentos((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, [field]: value } : p))
    )
  }

  function removePagamento(uid) {
    setPagamentos((prev) => prev.filter((p) => p.uid !== uid))
  }

  // ---- Totais (centavos) ----
  const subCents = useMemo(() => subtotalCents(itens), [itens])
  const totCents = useMemo(
    () => totalCents(itens, descontoGeral, acrescimoGeral),
    [itens, descontoGeral, acrescimoGeral]
  )
  const pagoCents = useMemo(() => pagamentosCents(pagamentos), [pagamentos])
  const restanteCents = totCents - pagoCents

  const quitado = restanteCents === 0
  const podeFinalizar = itens.length > 0 && quitado && totCents > 0

  function resetVenda() {
    setItens([])
    setCliente(null)
    setDescontoGeral('')
    setAcrescimoGeral('')
    setObservacao('')
    setPagamentos([])
  }

  const vendaMutation = useMutation({
    mutationFn: () => {
      const body = {
        caixaId: caixa?.id,
        clienteId: cliente?.id ?? undefined,
        desconto: toReais(toCents(descontoGeral)),
        acrescimo: toReais(toCents(acrescimoGeral)),
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({
          variacaoId: i.variacaoId,
          quantidade: Math.max(1, Math.trunc(Number(i.quantidade) || 1)),
          precoUnit: toReais(toCents(i.precoUnit)),
          desconto: toReais(toCents(i.desconto)),
        })),
        pagamentos: pagamentos.map((p) => {
          const pag = { forma: p.forma, valor: toReais(toCents(p.valor)) }
          const parc = Math.max(1, Math.trunc(Number(p.parcelas) || 1))
          if (aceitaParcelas(p.forma) && parc > 1) pag.parcelas = parc
          return pag
        }),
      }
      return api.post('/vendas', body)
    },
    onSuccess: (venda) => {
      toast.success('Venda finalizada com sucesso.')
      // Snapshot para o comprovante antes de limpar o estado.
      setComprovante({
        venda,
        itens,
        cliente,
        subtotalCents: subCents,
        descontoCents: toCents(descontoGeral),
        acrescimoCents: toCents(acrescimoGeral),
        totalCents: totCents,
        pagamentos,
      })
      resetVenda()
    },
    onError: (err) => {
      // Não limpa o carrinho: o usuário pode corrigir os pagamentos.
      toast.error(err?.message || 'Não foi possível finalizar a venda.')
    },
  })

  function handleFinalizar() {
    if (!podeFinalizar || vendaMutation.isPending) return
    vendaMutation.mutate()
  }

  // ---- Render ----
  if (caixaLoading) {
    return (
      <div>
        <PageHeader title="PDV" subtitle="Ponto de venda" />
        <Spinner />
      </div>
    )
  }

  if (!caixa) {
    return (
      <div>
        <PageHeader title="PDV" subtitle="Ponto de venda" />
        <AbrirCaixaForm />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="PDV" subtitle="Ponto de venda" />

      <CaixaBar caixa={caixa} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna esquerda: busca + carrinho */}
        <div className="space-y-4 lg:col-span-2">
          <ProdutoBusca onAdd={addItem} />
          <Carrinho itens={itens} onUpdate={updateItem} onRemove={removeItem} />
        </div>

        {/* Coluna direita: cliente + totais + pagamentos */}
        <div className="space-y-4">
          <Card title="Cliente">
            <ClienteBusca
              cliente={cliente}
              onSelect={setCliente}
              onClear={() => setCliente(null)}
            />
          </Card>

          <Card title="Resumo">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Desconto geral</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={descontoGeral}
                    onChange={(e) => setDescontoGeral(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Acréscimo geral</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={acrescimoGeral}
                    onChange={(e) => setAcrescimoGeral(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="text-gray-800">{formatCurrency(toReais(subCents))}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Desconto</span>
                  <span className="text-gray-800">- {formatCurrency(toReais(toCents(descontoGeral)))}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Acréscimo</span>
                  <span className="text-gray-800">+ {formatCurrency(toReais(toCents(acrescimoGeral)))}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-base font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(toReais(totCents))}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Pagamentos">
            <Pagamentos
              pagamentos={pagamentos}
              onAdd={addPagamento}
              onUpdate={updatePagamento}
              onRemove={removePagamento}
            />

            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Total pago</span>
                <span className="font-medium text-gray-800">{formatCurrency(toReais(pagoCents))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Restante</span>
                <span className={`font-semibold ${quitado ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(toReais(restanteCents))}
                </span>
              </div>
            </div>

            <Button
              icon={CheckCircle2}
              className="mt-4 w-full"
              size="lg"
              disabled={!podeFinalizar}
              loading={vendaMutation.isPending}
              onClick={handleFinalizar}
            >
              Finalizar venda
            </Button>
            {itens.length > 0 && !quitado && (
              <p className="mt-2 text-center text-xs text-gray-400">
                O total dos pagamentos deve ser igual ao total da venda.
              </p>
            )}
          </Card>
        </div>
      </div>

      <ComprovanteModal
        comprovante={comprovante}
        onClose={() => setComprovante(null)}
      />
    </div>
  )
}

function ComprovanteModal({ comprovante, onClose }) {
  if (!comprovante) return null
  const { venda, itens, cliente, subtotalCents: sub, descontoCents, acrescimoCents, totalCents: tot, pagamentos } =
    comprovante

  const numero = venda?.numero ?? venda?.id ?? '-'

  return (
    <Modal
      open={!!comprovante}
      onClose={onClose}
      title="Venda concluída"
      size="md"
      footer={<Button icon={ShoppingCart} onClick={onClose}>Nova venda</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
          <Receipt size={18} />
          <div className="text-sm">
            <div className="font-semibold">Venda nº {numero}</div>
            {cliente && <div className="text-emerald-600">Cliente: {cliente.nome}</div>}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Itens</h4>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {itens.map((i) => {
              const varLabel = [i.tamanho, i.cor].filter(Boolean).join(' / ')
              const qtd = Math.max(1, Math.trunc(Number(i.quantidade) || 1))
              const linha = qtd * toCents(i.precoUnit) - toCents(i.desconto)
              return (
                <div key={i.variacaoId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{i.nome}</div>
                    <div className="text-xs text-gray-500">
                      {varLabel ? `${varLabel} · ` : ''}
                      {qtd} x {formatCurrency(i.precoUnit)}
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(toReais(Math.max(0, linha)))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-gray-200 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="text-gray-800">{formatCurrency(toReais(sub))}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Desconto</span>
            <span className="text-gray-800">- {formatCurrency(toReais(descontoCents))}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Acréscimo</span>
            <span className="text-gray-800">+ {formatCurrency(toReais(acrescimoCents))}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1.5 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(toReais(tot))}</span>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pagamentos</h4>
          <div className="space-y-1 text-sm">
            {pagamentos.map((p) => (
              <div key={p.uid} className="flex justify-between text-gray-600">
                <span>
                  {formaLabel(p.forma)}
                  {aceitaParcelas(p.forma) && Number(p.parcelas) > 1 ? ` (${Math.trunc(Number(p.parcelas))}x)` : ''}
                </span>
                <span className="font-medium text-gray-900">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
