import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, CircleDollarSign, CheckCircle2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  Badge,
  PageHeader,
  EmptyState,
  Spinner,
} from '../../components/ui/index.js'

const LIMIT = 20

export default function ContasPagarList() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [pagoFiltro, setPagoFiltro] = useState('pendentes') // 'pendentes' | 'pagos' | 'todos'
  const [categoriaId, setCategoriaId] = useState('')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [vencDe, setVencDe] = useState('')
  const [vencAte, setVencAte] = useState('')
  const [page, setPage] = useState(1)
  const [payingId, setPayingId] = useState(null)

  const { data: categorias } = useQuery({
    queryKey: ['financeiro-categorias', 'select'],
    queryFn: () => api.get('/financeiro/categorias'),
  })

  const { data: contasBancarias } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['financeiro-contas-pagar', { q, pagoFiltro, categoriaId, contaBancariaId, vencDe, vencAte, page }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (pagoFiltro === 'pendentes') params.set('pago', 'false')
      else if (pagoFiltro === 'pagos') params.set('pago', 'true')
      if (categoriaId) params.set('categoriaId', categoriaId)
      if (contaBancariaId) params.set('contaBancariaId', contaBancariaId)
      if (vencDe) params.set('vencDe', vencDe)
      if (vencAte) params.set('vencAte', vencAte)
      params.set('page', String(page))
      params.set('limit', String(LIMIT))
      return api.get(`/financeiro/contas-pagar?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const contasPagar = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.limit ?? LIMIT)))

  // Busca ao vivo (com debounce), sem precisar clicar em "Buscar".
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQ(search.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function handlePagar(contaPagar) {
    const confirmado = window.confirm(`Marcar "${contaPagar.descricao}" como paga?`)
    if (!confirmado) return
    setPayingId(contaPagar.id)
    try {
      await api.post(`/financeiro/contas-pagar/${contaPagar.id}/pagar`, {})
      toast.success('Conta marcada como paga.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-bancarias'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao marcar conta como paga.')
    } finally {
      setPayingId(null)
    }
  }

  async function handleDelete(contaPagar) {
    const confirmado = window.confirm(
      `Excluir a conta a pagar "${contaPagar.descricao}"? Esta ação não pode ser desfeita.`
    )
    if (!confirmado) return
    try {
      await api.delete(`/financeiro/contas-pagar/${contaPagar.id}`)
      toast.success('Conta a pagar excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir conta a pagar.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie as despesas e obrigações financeiras"
        action={
          <Button icon={Plus} onClick={() => navigate('/financeiro/contas-pagar/novo')}>
            Nova conta a pagar
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-64">
          <Input
            label="Buscar"
            placeholder="Descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
            {[
              { value: 'pendentes', label: 'Pendentes' },
              { value: 'pagos', label: 'Pagos' },
              { value: 'todos', label: 'Todos' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPage(1)
                  setPagoFiltro(opt.value)
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pagoFiltro === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Select
          containerClassName="w-full sm:w-52"
          label="Categoria"
          value={categoriaId}
          onChange={(e) => {
            setPage(1)
            setCategoriaId(e.target.value)
          }}
        >
          <option value="">Todas</option>
          {(categorias || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>

        <Select
          containerClassName="w-full sm:w-52"
          label="Conta bancária"
          value={contaBancariaId}
          onChange={(e) => {
            setPage(1)
            setContaBancariaId(e.target.value)
          }}
        >
          <option value="">Todas</option>
          {(contasBancarias || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>

        <Input
          containerClassName="w-full sm:w-44"
          label="Vencimento de"
          type="date"
          value={vencDe}
          onChange={(e) => {
            setPage(1)
            setVencDe(e.target.value)
          }}
        />
        <Input
          containerClassName="w-full sm:w-44"
          label="Vencimento até"
          type="date"
          value={vencAte}
          onChange={(e) => {
            setPage(1)
            setVencAte(e.target.value)
          }}
        />

        {isFetching && <span className="pb-2.5 text-xs text-gray-400">Buscando…</span>}
      </div>

      {isLoading ? (
        <Spinner />
      ) : contasPagar.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Nenhuma conta a pagar encontrada"
          description="Ajuste os filtros ou cadastre uma nova conta a pagar."
          action={
            <Button icon={Plus} onClick={() => navigate('/financeiro/contas-pagar/novo')}>
              Nova conta a pagar
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Fornecedor</Th>
                <Th>Vencimento</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {contasPagar.map((contaPagar) => (
                <Tr key={contaPagar.id}>
                  <Td className="font-medium text-gray-900">{contaPagar.descricao}</Td>
                  <Td>{contaPagar.categoria?.nome || '-'}</Td>
                  <Td>{contaPagar.fornecedor?.nome || '-'}</Td>
                  <Td>{formatDate(contaPagar.vencimento)}</Td>
                  <Td>{formatCurrency(contaPagar.valor)}</Td>
                  <Td>
                    {contaPagar.pago ? (
                      <Badge variant="green">Pago</Badge>
                    ) : (
                      <Badge variant="amber">Pendente</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {!contaPagar.pago && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={CheckCircle2}
                          loading={payingId === contaPagar.id}
                          onClick={() => handlePagar(contaPagar)}
                          className="text-emerald-600 hover:bg-emerald-50"
                        >
                          Pagar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => navigate(`/financeiro/contas-pagar/${contaPagar.id}`)}
                        aria-label="Editar conta a pagar"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(contaPagar)}
                        aria-label="Excluir conta a pagar"
                        className="text-red-600 hover:bg-red-50"
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Página {page} de {totalPages} · {total} conta{total === 1 ? '' : 's'}
              {isFetching && ' · atualizando...'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
