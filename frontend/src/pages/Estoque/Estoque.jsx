import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ImageIcon,
  PackageSearch,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { api, fotoSrc } from '../../lib/api.js'
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format.js'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui/index.js'
import { useToast } from '../../context/ToastContext.jsx'

const TIPO_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'AJUSTE', label: 'Ajuste' },
]

const TIPO_BADGE = {
  ENTRADA: { variant: 'green', label: 'Entrada' },
  SAIDA: { variant: 'red', label: 'Saída' },
  AJUSTE: { variant: 'amber', label: 'Ajuste' },
}

const MOTIVO_LABELS = {
  AJUSTE: 'Ajuste',
  DEVOLUCAO: 'Devolução',
  COMPRA: 'Compra',
  ESTOQUE_INICIAL: 'Estoque Inicial',
  PRODUCAO: 'Produção',
  CONSUMO_INTERNO: 'Consumo Interno',
  PERDA: 'Perda',
  REPOSICAO: 'Reposição',
  VENDA: 'Venda',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
}

const MOTIVOS_ENTRADA = ['AJUSTE', 'DEVOLUCAO', 'COMPRA', 'ESTOQUE_INICIAL', 'PRODUCAO', 'OUTRO']
const MOTIVOS_SAIDA = ['AJUSTE', 'DEVOLUCAO', 'CONSUMO_INTERNO', 'PERDA', 'REPOSICAO', 'VENDA', 'PRODUCAO', 'OUTRO']
const MOTIVOS_AJUSTE = [...new Set([...MOTIVOS_ENTRADA, ...MOTIVOS_SAIDA])]

function motivosPorTipo(tipo) {
  if (tipo === 'ENTRADA') return MOTIVOS_ENTRADA
  if (tipo === 'SAIDA') return MOTIVOS_SAIDA
  return MOTIVOS_AJUSTE
}

const EMPTY_FORM = {
  tipo: 'ENTRADA',
  quantidade: '',
  custoUnit: '',
  motivo: '',
  categoria: '',
  fornecedorId: '',
}

export default function Estoque() {
  const [tab, setTab] = useState('movimentacoes')

  return (
    <div>
      <PageHeader title="Estoque" subtitle="Movimentações e controle de estoque" />

      <TabsHeader tab={tab} setTab={setTab} />

      {tab === 'movimentacoes' && <MovimentacoesTab />}
      {tab === 'baixo' && <EstoqueBaixoTab />}
      {tab === 'transferencias' && <TransferenciasTab />}
    </div>
  )
}

function TabsHeader({ tab, setTab }) {
  const { data: baixo } = useQuery({
    queryKey: ['estoque', 'baixo'],
    queryFn: () => api.get('/estoque/baixo'),
  })
  const baixoCount = baixo?.length || 0

  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200">
      <button
        type="button"
        onClick={() => setTab('movimentacoes')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          tab === 'movimentacoes'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <SlidersHorizontal size={16} />
        Movimentações
      </button>
      <button
        type="button"
        onClick={() => setTab('baixo')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          tab === 'baixo'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <PackageSearch size={16} />
        Estoque baixo
        {baixoCount > 0 && (
          <Badge variant="red" className="ml-1">
            {baixoCount}
          </Badge>
        )}
      </button>
      <button
        type="button"
        onClick={() => setTab('transferencias')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          tab === 'transferencias'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <ArrowLeftRight size={16} />
        Transferências
      </button>
    </div>
  )
}

function MovimentacoesTab() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <NovaMovimentacaoCard />
      </div>
      <div className="xl:col-span-3">
        <HistoricoCard />
      </div>
    </div>
  )
}

function NovaMovimentacaoCard() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [variacaoId, setVariacaoId] = useState('')
  const [lojaId, setLojaId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: lojas } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => api.get('/lojas'),
  })

  const { data: motivos } = useQuery({
    queryKey: ['estoque', 'motivos'],
    queryFn: () => api.get('/estoque/motivos'),
  })

  useEffect(() => {
    if (lojaId || !lojas || lojas.length === 0) return
    const matriz = lojas.find((l) => l.matriz)
    setLojaId(String((matriz || lojas[0]).id))
  }, [lojas, lojaId])

  const categoriasDisponiveis = useMemo(() => {
    const relevantes = motivosPorTipo(form.tipo)
    return (motivos || relevantes).filter((m) => relevantes.includes(m))
  }, [motivos, form.tipo])

  // Busca ao vivo (com debounce), igual à do PDV.
  const [termoBusca, setTermoBusca] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data: produtosResult, isFetching: buscandoProdutos } = useQuery({
    queryKey: ['produtos', 'busca-estoque', termoBusca],
    queryFn: () => api.get(`/produtos?q=${encodeURIComponent(termoBusca)}&limit=50`),
    enabled: termoBusca.length > 0,
  })

  const produtosEncontrados = produtosResult?.data || []

  function estoqueTotal(produto) {
    return (produto.variacoes || []).reduce((sum, v) => sum + (Number(v.estoqueAtual) || 0), 0)
  }

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'ativos'],
    queryFn: () => api.get('/fornecedores?q='),
    enabled: form.tipo === 'ENTRADA',
  })

  const variacaoAtual = useMemo(() => {
    if (!produtoSelecionado || !variacaoId) return null
    return produtoSelecionado.variacoes?.find((v) => String(v.id) === String(variacaoId)) || null
  }, [produtoSelecionado, variacaoId])

  const resetForm = () => {
    setQuery('')
    setShowDropdown(false)
    setProdutoSelecionado(null)
    setVariacaoId('')
    setForm(EMPTY_FORM)
  }

  const mutation = useMutation({
    mutationFn: (body) => api.post('/estoque/movimentacoes', body),
    onSuccess: () => {
      toast.success('Movimentação registrada com sucesso.')
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['estoque', 'movimentacoes'] })
      queryClient.invalidateQueries({ queryKey: ['estoque', 'baixo'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível registrar a movimentação.')
    },
  })

  const handleSelectProduto = (produto) => {
    setProdutoSelecionado(produto)
    setQuery(produto.nome)
    setShowDropdown(false)
    setVariacaoId('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!variacaoId) {
      toast.error('Selecione uma variação do produto.')
      return
    }
    const quantidade = Number(form.quantidade)
    if (!quantidade || quantidade < 1) {
      toast.error('Informe uma quantidade válida.')
      return
    }

    const body = {
      variacaoId,
      lojaId: lojaId || undefined,
      tipo: form.tipo,
      quantidade,
      motivo: form.motivo || undefined,
      categoria: form.categoria || undefined,
    }

    if (form.custoUnit !== '') {
      body.custoUnit = Number(form.custoUnit)
    }
    if (form.tipo === 'ENTRADA' && form.fornecedorId) {
      body.fornecedorId = form.fornecedorId
    }

    mutation.mutate(body)
  }

  return (
    <Card title="Nova movimentação">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Loja" value={lojaId} onChange={(e) => setLojaId(e.target.value)} required>
          <option value="">Selecione a loja</option>
          {(lojas || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
              {l.matriz ? ' (Matriz)' : ''}
            </option>
          ))}
        </Select>

        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">Produto</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowDropdown(true)
                setProdutoSelecionado(null)
                setVariacaoId('')
              }}
              onFocus={() => query.trim() && setShowDropdown(true)}
              placeholder="Buscar produto por nome..."
              className="pl-9"
            />
          </div>

          {showDropdown && query.trim().length > 0 && (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {buscandoProdutos && (
                <div className="px-4 py-3 text-sm text-gray-500">Buscando...</div>
              )}
              {!buscandoProdutos && produtosEncontrados.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">Nenhum produto encontrado.</div>
              )}
              {!buscandoProdutos &&
                produtosEncontrados.map((produto) => (
                  <button
                    type="button"
                    key={produto.id}
                    onClick={() => handleSelectProduto(produto)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50"
                  >
                    {fotoSrc(produto.fotoUrl) ? (
                      <img
                        src={fotoSrc(produto.fotoUrl)}
                        alt={produto.nome}
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{produto.nome}</div>
                      <div className="text-xs text-gray-500">Estoque: {formatNumber(estoqueTotal(produto))}</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {produtoSelecionado && (
          <Select
            label="Variação"
            value={variacaoId}
            onChange={(e) => setVariacaoId(e.target.value)}
            required
          >
            <option value="">Selecione a variação</option>
            {(produtoSelecionado.variacoes || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.tamanho} - {v.cor} ({v.sku}) — estoque: {v.estoqueAtual}
              </option>
            ))}
          </Select>
        )}

        {variacaoAtual && (
          <p className="text-xs text-gray-500">
            Estoque atual da variação selecionada:{' '}
            <span className="font-semibold text-gray-700">{formatNumber(variacaoAtual.estoqueAtual)}</span>
          </p>
        )}

        <Select
          label="Tipo de movimentação"
          value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, categoria: '' }))}
        >
          {TIPO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Categoria do motivo"
          value={form.categoria}
          onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
        >
          <option value="">Selecione a categoria (opcional)</option>
          {categoriasDisponiveis.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_LABELS[m] || m}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantidade"
            type="number"
            min={1}
            step={1}
            required
            value={form.quantidade}
            onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
          />
          <Input
            label="Custo unit. (R$)"
            type="number"
            min={0}
            step={0.01}
            value={form.custoUnit}
            onChange={(e) => setForm((f) => ({ ...f, custoUnit: e.target.value }))}
          />
        </div>

        <Input
          label="Observação (opcional)"
          value={form.motivo}
          onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          placeholder="Ex.: Compra de mercadoria, perda, correção..."
        />

        {form.tipo === 'ENTRADA' && (
          <Select
            label="Fornecedor (opcional)"
            value={form.fornecedorId}
            onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
          >
            <option value="">Nenhum</option>
            {(fornecedores || [])
              .filter((f) => f.ativo)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
          </Select>
        )}

        <Button type="submit" loading={mutation.isPending} className="w-full" icon={ArrowUpCircle}>
          Registrar movimentação
        </Button>
      </form>
    </Card>
  )
}

function HistoricoCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['estoque', 'movimentacoes'],
    queryFn: () => api.get('/estoque/movimentacoes'),
  })

  const movimentacoes = data || []

  return (
    <Card title="Histórico de movimentações">
      {isLoading ? (
        <Spinner />
      ) : movimentacoes.length === 0 ? (
        <EmptyState
          icon={ArrowDownCircle}
          title="Nenhuma movimentação encontrada"
          description="Registre uma movimentação de estoque para vê-la aqui."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Data</Th>
              <Th>Produto</Th>
              <Th>Variação</Th>
              <Th>Tipo</Th>
              <Th>Categoria</Th>
              <Th>Quantidade</Th>
              <Th>Custo Unit.</Th>
              <Th>Motivo</Th>
              <Th>Usuário</Th>
            </Tr>
          </Thead>
          <Tbody>
            {movimentacoes.map((mov) => {
              const badge = TIPO_BADGE[mov.tipo] || { variant: 'gray', label: mov.tipo }
              return (
                <Tr key={mov.id}>
                  <Td>{formatDateTime(mov.createdAt)}</Td>
                  <Td>{mov.variacao?.produto?.nome || '-'}</Td>
                  <Td>
                    {mov.variacao ? `${mov.variacao.tamanho} - ${mov.variacao.cor}` : '-'}
                  </Td>
                  <Td>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </Td>
                  <Td>
                    {mov.categoria ? (
                      <Badge variant="gray">{MOTIVO_LABELS[mov.categoria] || mov.categoria}</Badge>
                    ) : (
                      '-'
                    )}
                  </Td>
                  <Td>{formatNumber(mov.quantidade)}</Td>
                  <Td>{mov.custoUnit != null ? formatCurrency(mov.custoUnit) : '-'}</Td>
                  <Td>{mov.motivo || '-'}</Td>
                  <Td>{mov.usuario?.nome || '-'}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </Card>
  )
}

function TransferenciasTab() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <NovaTransferenciaCard />
      </div>
      <div className="xl:col-span-3">
        <HistoricoTransferenciasCard />
      </div>
    </div>
  )
}

function NovaTransferenciaCard() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [lojaOrigemId, setLojaOrigemId] = useState('')
  const [lojaDestinoId, setLojaDestinoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState([])

  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [variacaoId, setVariacaoId] = useState('')
  const [quantidadeNova, setQuantidadeNova] = useState('1')

  const { data: lojas } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => api.get('/lojas'),
  })

  useEffect(() => {
    if (lojaOrigemId || !lojas || lojas.length === 0) return
    const matriz = lojas.find((l) => l.matriz)
    setLojaOrigemId(String((matriz || lojas[0]).id))
  }, [lojas, lojaOrigemId])

  const [termoBusca, setTermoBusca] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data: produtosResult, isFetching: buscandoProdutos } = useQuery({
    queryKey: ['produtos', 'busca-transferencia', termoBusca],
    queryFn: () => api.get(`/produtos?q=${encodeURIComponent(termoBusca)}&limit=50`),
    enabled: termoBusca.length > 0,
  })

  const produtosEncontrados = produtosResult?.data || []

  function estoqueTotal(produto) {
    return (produto.variacoes || []).reduce((sum, v) => sum + (Number(v.estoqueAtual) || 0), 0)
  }

  const variacaoAtual = useMemo(() => {
    if (!produtoSelecionado || !variacaoId) return null
    return produtoSelecionado.variacoes?.find((v) => String(v.id) === String(variacaoId)) || null
  }, [produtoSelecionado, variacaoId])

  const handleSelectProduto = (produto) => {
    setProdutoSelecionado(produto)
    setQuery(produto.nome)
    setShowDropdown(false)
    setVariacaoId('')
  }

  function addItem() {
    if (!variacaoId || !variacaoAtual) {
      toast.error('Selecione um produto e uma variação.')
      return
    }
    const quantidade = Math.trunc(Number(quantidadeNova)) || 0
    if (quantidade < 1) {
      toast.error('Informe uma quantidade válida.')
      return
    }

    setItens((prev) => {
      const existente = prev.find((i) => i.variacaoId === variacaoAtual.id)
      if (existente) {
        return prev.map((i) =>
          i.variacaoId === variacaoAtual.id ? { ...i, quantidade: i.quantidade + quantidade } : i
        )
      }
      return [
        ...prev,
        {
          variacaoId: variacaoAtual.id,
          produtoNome: produtoSelecionado?.nome || 'Produto',
          tamanho: variacaoAtual.tamanho,
          cor: variacaoAtual.cor,
          quantidade,
        },
      ]
    })

    setQuery('')
    setShowDropdown(false)
    setProdutoSelecionado(null)
    setVariacaoId('')
    setQuantidadeNova('1')
  }

  function updateItem(variacaoIdAlvo, quantidade) {
    setItens((prev) =>
      prev.map((i) => {
        if (i.variacaoId !== variacaoIdAlvo) return i
        if (quantidade === '') return { ...i, quantidade: '' }
        const n = Math.trunc(Number(quantidade))
        return { ...i, quantidade: Number.isFinite(n) && n >= 1 ? n : 1 }
      })
    )
  }

  function removeItem(variacaoIdAlvo) {
    setItens((prev) => prev.filter((i) => i.variacaoId !== variacaoIdAlvo))
  }

  function resetForm() {
    setObservacao('')
    setItens([])
    setQuery('')
    setShowDropdown(false)
    setProdutoSelecionado(null)
    setVariacaoId('')
    setQuantidadeNova('1')
  }

  const mutation = useMutation({
    mutationFn: (body) => api.post('/estoque/transferencias', body),
    onSuccess: () => {
      toast.success('Transferência registrada com sucesso.')
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['estoque-transferencias'] })
      queryClient.invalidateQueries({ queryKey: ['estoque', 'baixo'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível registrar a transferência.')
    },
  })

  function handleSubmit(e) {
    e.preventDefault()

    if (!lojaOrigemId || !lojaDestinoId) {
      toast.error('Selecione a loja de origem e a de destino.')
      return
    }
    if (lojaOrigemId === lojaDestinoId) {
      toast.error('A loja de origem e a de destino devem ser diferentes.')
      return
    }
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item para transferir.')
      return
    }

    mutation.mutate({
      lojaOrigemId,
      lojaDestinoId,
      observacao: observacao || undefined,
      itens: itens.map((i) => ({
        variacaoId: i.variacaoId,
        quantidade: Math.max(1, Math.trunc(Number(i.quantidade) || 1)),
      })),
    })
  }

  return (
    <Card title="Nova transferência">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Loja de origem"
          value={lojaOrigemId}
          onChange={(e) => setLojaOrigemId(e.target.value)}
          required
        >
          <option value="">Selecione a loja de origem</option>
          {(lojas || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
              {l.matriz ? ' (Matriz)' : ''}
            </option>
          ))}
        </Select>

        <Select
          label="Loja de destino"
          value={lojaDestinoId}
          onChange={(e) => setLojaDestinoId(e.target.value)}
          required
        >
          <option value="">Selecione a loja de destino</option>
          {(lojas || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
              {l.matriz ? ' (Matriz)' : ''}
            </option>
          ))}
        </Select>

        <Input
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: Reposição para a filial..."
        />

        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">Produto</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowDropdown(true)
                setProdutoSelecionado(null)
                setVariacaoId('')
              }}
              onFocus={() => query.trim() && setShowDropdown(true)}
              placeholder="Buscar produto por nome..."
              className="pl-9"
            />
          </div>

          {showDropdown && query.trim().length > 0 && (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {buscandoProdutos && (
                <div className="px-4 py-3 text-sm text-gray-500">Buscando...</div>
              )}
              {!buscandoProdutos && produtosEncontrados.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">Nenhum produto encontrado.</div>
              )}
              {!buscandoProdutos &&
                produtosEncontrados.map((produto) => (
                  <button
                    type="button"
                    key={produto.id}
                    onClick={() => handleSelectProduto(produto)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50"
                  >
                    {fotoSrc(produto.fotoUrl) ? (
                      <img
                        src={fotoSrc(produto.fotoUrl)}
                        alt={produto.nome}
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{produto.nome}</div>
                      <div className="text-xs text-gray-500">Estoque: {formatNumber(estoqueTotal(produto))}</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {produtoSelecionado && (
          <Select
            label="Variação"
            value={variacaoId}
            onChange={(e) => setVariacaoId(e.target.value)}
          >
            <option value="">Selecione a variação</option>
            {(produtoSelecionado.variacoes || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.tamanho} - {v.cor} ({v.sku}) — estoque: {v.estoqueAtual}
              </option>
            ))}
          </Select>
        )}

        {variacaoAtual && (
          <p className="text-xs text-gray-500">
            Estoque atual da variação selecionada:{' '}
            <span className="font-semibold text-gray-700">{formatNumber(variacaoAtual.estoqueAtual)}</span>
          </p>
        )}

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Input
            label="Quantidade"
            type="number"
            min={1}
            step={1}
            value={quantidadeNova}
            onChange={(e) => setQuantidadeNova(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addItem}>
            Adicionar item
          </Button>
        </div>

        {itens.length > 0 && (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {itens.map((item) => (
              <div key={item.variacaoId} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{item.produtoNome}</div>
                  <div className="text-xs text-gray-500">
                    {item.tamanho} - {item.cor}
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantidade}
                  onChange={(e) => updateItem(item.variacaoId, e.target.value)}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.variacaoId)}
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover item"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button type="submit" loading={mutation.isPending} className="w-full" icon={ArrowLeftRight}>
          Registrar transferência
        </Button>
      </form>
    </Card>
  )
}

function HistoricoTransferenciasCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['estoque-transferencias'],
    queryFn: () => api.get('/estoque/transferencias'),
  })

  const transferencias = data || []

  return (
    <Card title="Histórico de transferências">
      {isLoading ? (
        <Spinner />
      ) : transferencias.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma transferência encontrada"
          description="Registre uma transferência entre lojas para vê-la aqui."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Data</Th>
              <Th>Origem → Destino</Th>
              <Th>Itens</Th>
              <Th>Usuário</Th>
              <Th>Observação</Th>
            </Tr>
          </Thead>
          <Tbody>
            {transferencias.map((t) => {
              const itensSaida = (t.movimentacoes || []).filter((m) => m.tipo === 'SAIDA')
              return (
                <Tr key={t.id}>
                  <Td>{formatDateTime(t.createdAt)}</Td>
                  <Td>
                    {t.lojaOrigem?.nome || '-'} → {t.lojaDestino?.nome || '-'}
                  </Td>
                  <Td>
                    <div className="space-y-0.5">
                      {itensSaida.map((m) => (
                        <div key={m.id} className="text-xs text-gray-700">
                          {formatNumber(m.quantidade)}x {m.variacao?.produto?.nome || '-'}
                          {m.variacao ? ` (${m.variacao.tamanho} - ${m.variacao.cor})` : ''}
                        </div>
                      ))}
                    </div>
                  </Td>
                  <Td>{t.usuario?.nome || '-'}</Td>
                  <Td>{t.observacao || '-'}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </Card>
  )
}

function EstoqueBaixoTab() {
  const [lojaFiltro, setLojaFiltro] = useState('')

  const { data: lojas } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => api.get('/lojas'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['estoque', 'baixo', lojaFiltro],
    queryFn: () => api.get(`/estoque/baixo${lojaFiltro ? `?lojaId=${lojaFiltro}` : ''}`),
  })

  const itens = data || []

  return (
    <Card
      title="Produtos com estoque baixo"
      action={
        <Select
          containerClassName="mb-0 w-56"
          value={lojaFiltro}
          onChange={(e) => setLojaFiltro(e.target.value)}
        >
          <option value="">Todas as lojas</option>
          {(lojas || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </Select>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : itens.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum item com estoque baixo"
          description="Todos os produtos estão com estoque acima do mínimo configurado."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Loja</Th>
              <Th>Produto</Th>
              <Th>Variação</Th>
              <Th>SKU</Th>
              <Th>Estoque Atual</Th>
              <Th>Estoque Mínimo</Th>
            </Tr>
          </Thead>
          <Tbody>
            {itens.map((item) => {
              const critico = Number(item.estoqueAtual) <= Number(item.estoqueMinimo)
              return (
                <Tr key={item.id}>
                  <Td>{item.loja || '-'}</Td>
                  <Td>{item.produto?.nome || '-'}</Td>
                  <Td>
                    {item.tamanho} - {item.cor}
                  </Td>
                  <Td>{item.sku}</Td>
                  <Td className={critico ? 'font-semibold text-red-600' : ''}>
                    {formatNumber(item.estoqueAtual)}
                  </Td>
                  <Td>{formatNumber(item.estoqueMinimo)}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </Card>
  )
}
