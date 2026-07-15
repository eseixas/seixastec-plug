import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Package, ImageIcon } from 'lucide-react'
import { api, fotoSrc } from '../../lib/api.js'
import { formatCurrency, formatNumber } from '../../lib/format.js'
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

export default function ProdutosList() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('ativos') // 'ativos' | 'inativos' | 'todos'
  const [page, setPage] = useState(1)

  const { data: categorias } = useQuery({
    queryKey: ['categorias', 'select'],
    queryFn: () => api.get('/categorias'),
  })

  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['produtos', { q, categoriaId, statusFiltro, page }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (categoriaId) params.set('categoriaId', categoriaId)
      if (statusFiltro === 'ativos') params.set('ativo', 'true')
      else if (statusFiltro === 'inativos') params.set('ativo', 'false')
      params.set('page', String(page))
      params.set('limit', String(LIMIT))
      return api.get(`/produtos?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const produtos = data?.data ?? []
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

  function handleCategoriaChange(e) {
    setPage(1)
    setCategoriaId(e.target.value)
  }

  async function handleDelete(produto) {
    const confirmado = window.confirm(`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      await api.delete(`/produtos/${produto.id}`)
      toast.success('Produto excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir produto.')
    }
  }

  function estoqueTotal(produto) {
    return (produto.variacoes || []).reduce((sum, v) => sum + (Number(v.estoqueAtual) || 0), 0)
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Gerencie o catálogo de produtos"
        action={
          <Button icon={Plus} onClick={() => navigate('/produtos/novo')}>
            Novo produto
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Input
            label="Buscar"
            placeholder="Nome, referência..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
        </div>
        <Select
          containerClassName="w-full sm:w-56"
          label="Categoria"
          value={categoriaId}
          onChange={handleCategoriaChange}
        >
          <option value="">Todas as categorias</option>
          {(categorias || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        {/* Filtro de status: ativos / inativos / todos */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
            {[
              { value: 'ativos', label: 'Ativos' },
              { value: 'inativos', label: 'Inativos' },
              { value: 'todos', label: 'Todos' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPage(1)
                  setStatusFiltro(opt.value)
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFiltro === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {isFetching && <span className="pb-2.5 text-xs text-gray-400">Buscando…</span>}
      </div>

      {isLoading ? (
        <Spinner />
      ) : produtos.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros ou cadastre um novo produto."
          action={
            <Button icon={Plus} onClick={() => navigate('/produtos/novo')}>
              Novo produto
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Foto</Th>
                <Th>Nome</Th>
                <Th>Categoria</Th>
                <Th>Marca</Th>
                <Th>Estação</Th>
                <Th>Preço</Th>
                <Th>Estoque total</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {produtos.map((produto) => (
                <Tr key={produto.id}>
                  <Td>
                    {fotoSrc(produto.fotoUrl) ? (
                      <img
                        src={fotoSrc(produto.fotoUrl)}
                        alt={produto.nome}
                        className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </Td>
                  <Td className="font-medium text-gray-900">{produto.nome}</Td>
                  <Td>{produto.categoria?.nome || '-'}</Td>
                  <Td>{produto.marca?.nome || '-'}</Td>
                  <Td>
                    {produto.estacao ? (
                      <Badge variant="indigo">{produto.estacao}</Badge>
                    ) : (
                      '-'
                    )}
                  </Td>
                  <Td>{formatCurrency(produto.precoVenda)}</Td>
                  <Td>{formatNumber(estoqueTotal(produto))}</Td>
                  <Td>
                    {produto.ativo ? (
                      <Badge variant="green">Ativo</Badge>
                    ) : (
                      <Badge variant="gray">Inativo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => navigate(`/produtos/${produto.id}`)}
                        aria-label="Editar produto"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(produto)}
                        aria-label="Excluir produto"
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
              Página {page} de {totalPages} · {total} produto{total === 1 ? '' : 's'}
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
