import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Plus, Search, Eye, ShoppingBag } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
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

const STATUS_BADGE = {
  ABERTA: { variant: 'gray', label: 'Aberta' },
  PARCIAL: { variant: 'amber', label: 'Parcial' },
  RECEBIDA: { variant: 'green', label: 'Recebida' },
  CANCELADA: { variant: 'red', label: 'Cancelada' },
}

function valorTotal(compra) {
  return (compra.itens || []).reduce(
    (sum, i) => sum + (Number(i.quantidade) || 0) * (Number(i.custoUnitario) || 0),
    0
  )
}

export default function ComprasList() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [page, setPage] = useState(1)

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'select'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['compras', { q, fornecedorId, dataDe, dataAte, page }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (fornecedorId) params.set('fornecedorId', fornecedorId)
      if (dataDe) params.set('dataDe', dataDe)
      if (dataAte) params.set('dataAte', dataAte)
      params.set('page', String(page))
      params.set('limit', String(LIMIT))
      return api.get(`/compras?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const compras = data?.data ?? []
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

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="Gerencie as compras de mercadoria"
        action={
          <Button icon={Plus} onClick={() => navigate('/compras/nova')}>
            Nova compra
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-64">
          <Input
            label="Buscar"
            placeholder="Número da nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
        </div>

        <Select
          containerClassName="w-full sm:w-56"
          label="Fornecedor"
          value={fornecedorId}
          onChange={(e) => {
            setPage(1)
            setFornecedorId(e.target.value)
          }}
        >
          <option value="">Todos</option>
          {(fornecedores || []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>

        <Input
          containerClassName="w-full sm:w-44"
          label="Data de"
          type="date"
          value={dataDe}
          onChange={(e) => {
            setPage(1)
            setDataDe(e.target.value)
          }}
        />
        <Input
          containerClassName="w-full sm:w-44"
          label="Data até"
          type="date"
          value={dataAte}
          onChange={(e) => {
            setPage(1)
            setDataAte(e.target.value)
          }}
        />

        {isFetching && <span className="pb-2.5 text-xs text-gray-400">Buscando…</span>}
      </div>

      {isLoading ? (
        <Spinner />
      ) : compras.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma compra encontrada"
          description="Ajuste os filtros ou cadastre uma nova compra."
          action={
            <Button icon={Plus} onClick={() => navigate('/compras/nova')}>
              Nova compra
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Número</Th>
                <Th>Fornecedor</Th>
                <Th>Data</Th>
                <Th>Nota Fiscal</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {compras.map((compra) => {
                const badge = STATUS_BADGE[compra.status] || { variant: 'gray', label: compra.status }
                return (
                  <Tr key={compra.id}>
                    <Td className="font-medium text-gray-900">#{compra.numero}</Td>
                    <Td>{compra.fornecedor?.nome || '-'}</Td>
                    <Td>{formatDate(compra.dataCompra)}</Td>
                    <Td>{compra.numeroNota || '-'}</Td>
                    <Td>{formatCurrency(valorTotal(compra))}</Td>
                    <Td>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => navigate(`/compras/${compra.id}`)}
                          aria-label="Ver compra"
                        />
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Página {page} de {totalPages} · {total} compra{total === 1 ? '' : 's'}
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
