import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Barcode, Printer, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { downloadBlob } from '../../lib/download.js'
import { useToast } from '../../context/ToastContext.jsx'
import ModelosEtiqueta from './ModelosEtiqueta.jsx'
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
  Card,
  PageHeader,
  EmptyState,
  Spinner,
  Tabs,
} from '../../components/ui/index.js'

const ABAS = [
  { id: 'imprimir', label: 'Imprimir' },
  { id: 'modelos', label: 'Modelos' },
]

function ImprimirEtiquetasPanel() {
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [produtoSelId, setProdutoSelId] = useState(null)
  const [modeloId, setModeloId] = useState('')
  const [posicaoInicial, setPosicaoInicial] = useState(1)
  const [imprimirBorda, setImprimirBorda] = useState(false)
  const [gerando, setGerando] = useState(false)

  const { data: modelos = [] } = useQuery({
    queryKey: ['etiquetas', 'modelos'],
    queryFn: () => api.get('/etiquetas/modelos'),
  })

  useEffect(() => {
    if (!modeloId && modelos.length > 0) setModeloId(modelos[0].id)
  }, [modelos, modeloId])

  // Lista de impressão acumulada: variacaoId -> { variacaoId, produtoNome, cor, tamanho, quantidade }
  const [lista, setLista] = useState({})

  // Busca com debounce (mesmo padrão de ProdutosList).
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: resultados, isFetching } = useQuery({
    queryKey: ['etiquetas', 'produtos', q],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      params.set('ativo', 'true')
      params.set('limit', '10')
      return api.get(`/produtos?${params.toString()}`)
    },
    enabled: q.length > 0,
  })

  const { data: produtoSel, isLoading: loadingProduto } = useQuery({
    queryKey: ['etiquetas', 'produto', produtoSelId],
    queryFn: () => api.get(`/produtos/${produtoSelId}`),
    enabled: !!produtoSelId,
  })

  const produtos = resultados?.data ?? []

  const variacoesAtivas = useMemo(
    () => (produtoSel?.variacoes || []).filter((v) => v.ativo),
    [produtoSel]
  )

  function setQuantidade(variacao, produtoNome, valor) {
    const qtd = Math.max(0, Number(valor) || 0)
    setLista((prev) => {
      const next = { ...prev }
      if (qtd <= 0) {
        delete next[variacao.id]
      } else {
        next[variacao.id] = {
          variacaoId: variacao.id,
          produtoNome,
          cor: variacao.cor,
          tamanho: variacao.tamanho,
          quantidade: qtd,
        }
      }
      return next
    })
  }

  function removerDaLista(variacaoId) {
    setLista((prev) => {
      const next = { ...prev }
      delete next[variacaoId]
      return next
    })
  }

  const itensLista = Object.values(lista)
  const totalEtiquetas = itensLista.reduce((s, i) => s + i.quantidade, 0)
  const podeGerar = itensLista.length > 0

  async function handleGerar() {
    if (!podeGerar) return
    if (!modeloId) {
      toast.error('Selecione um modelo de etiqueta.')
      return
    }
    setGerando(true)
    try {
      const payload = {
        itens: itensLista.map((i) => ({ variacaoId: i.variacaoId, quantidade: i.quantidade })),
        modeloId,
        posicaoInicial: Number(posicaoInicial) || 1,
        imprimirBorda,
      }
      const blob = await api.postBlob('/etiquetas/pdf', payload)
      downloadBlob(blob, 'etiquetas.pdf')
      toast.success('PDF de etiquetas gerado.')
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar etiquetas.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna de busca + variações */}
        <div className="space-y-4 lg:col-span-2">
          <Card title="Buscar produto">
            <div className="relative">
              <Input
                placeholder="Nome, referência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              <Search size={16} className="pointer-events-none absolute left-3 top-[10px] text-gray-400" />
            </div>

            {q.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {isFetching && produtos.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-400">Buscando…</div>
                ) : produtos.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-400">Nenhum produto encontrado.</div>
                ) : (
                  produtos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProdutoSelId(p.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        produtoSelId === p.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <span className="font-medium text-gray-800">{p.nome}</span>
                      <span className="text-xs text-gray-400">{p.referencia || ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </Card>

          {produtoSelId && (
            <Card title={produtoSel?.nome ? `Variações — ${produtoSel.nome}` : 'Variações'}>
              {loadingProduto ? (
                <Spinner />
              ) : variacoesAtivas.length === 0 ? (
                <p className="text-sm text-gray-400">Este produto não tem variações ativas.</p>
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Cor</Th>
                      <Th>Tamanho</Th>
                      <Th>Código de barras</Th>
                      <Th className="text-right">Qtd. etiquetas</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {variacoesAtivas.map((v) => (
                      <Tr key={v.id}>
                        <Td>{v.cor}</Td>
                        <Td>{v.tamanho}</Td>
                        <Td>
                          {v.codigoBarras ? (
                            <span className="font-mono text-xs text-gray-700">{v.codigoBarras}</span>
                          ) : (
                            <Badge variant="amber">será gerado</Badge>
                          )}
                        </Td>
                        <Td className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={lista[v.id]?.quantidade ?? 0}
                            onChange={(e) => setQuantidade(v, produtoSel.nome, e.target.value)}
                            className="w-20 text-right"
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Card>
          )}

          {!produtoSelId && (
            <EmptyState
              icon={Barcode}
              title="Busque um produto para começar"
              description="Selecione um produto e defina quantas etiquetas imprimir de cada variação."
            />
          )}
        </div>

        {/* Coluna da lista de impressão */}
        <div className="space-y-4">
          <Card title="Lista de impressão">
            {itensLista.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma etiqueta selecionada. Defina quantidades nas variações.
              </p>
            ) : (
              <ul className="space-y-2">
                {itensLista.map((i) => (
                  <li
                    key={i.variacaoId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-800">{i.produtoNome}</div>
                      <div className="text-xs text-gray-500">
                        {[i.cor, i.tamanho].filter(Boolean).join(' · ')} — {i.quantidade}x
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => removerDaLista(i.variacaoId)}
                      aria-label="Remover"
                      className="text-red-600 hover:bg-red-50"
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <Select
                label="Modelo"
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
              >
                {modelos.length === 0 && <option value="">Nenhum modelo cadastrado</option>}
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} — {m.codigo}
                  </option>
                ))}
              </Select>

              <Input
                label="Começar na posição"
                type="number"
                min="1"
                value={posicaoInicial}
                onChange={(e) => setPosicaoInicial(e.target.value)}
              />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={imprimirBorda}
                  onChange={(e) => setImprimirBorda(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Imprimir borda na etiqueta
              </label>
            </div>

            <Button
              icon={Printer}
              onClick={handleGerar}
              disabled={!podeGerar}
              loading={gerando}
              className="mt-4 w-full justify-center"
            >
              Baixar PDF{totalEtiquetas > 0 ? ` (${totalEtiquetas})` : ''}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function Etiquetas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')
  const aba = ABAS.some((a) => a.id === abaParam) ? abaParam : ABAS[0].id

  function selecionarAba(id) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('aba', id)
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="Etiquetas"
        subtitle="Gere etiquetas com código de barras e gerencie os modelos de impressão"
      />

      <Tabs tabs={ABAS} active={aba} onChange={selecionarAba} />

      <div key={aba} className="animate-fadeIn">
        {aba === 'imprimir' && <ImprimirEtiquetasPanel />}
        {aba === 'modelos' && <ModelosEtiqueta />}
      </div>
    </div>
  )
}
