import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import { toInputDate } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Button, Input, Select, Card, PageHeader } from '../../components/ui/index.js'

const EMPTY_HEADER = {
  fornecedorId: '',
  numeroNota: '',
  serie: '',
  dataCompra: toInputDate(new Date()),
  anexoUrl: '',
  observacoes: '',
}

let itemUid = 0
let parcelaUid = 0

export default function CompraForm() {
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState(EMPTY_HEADER)
  const [itens, setItens] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [saving, setSaving] = useState(false)

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'select'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data: lojas } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => api.get('/lojas'),
  })

  const { data: categorias } = useQuery({
    queryKey: ['financeiro-categorias', 'select', 'DESPESA'],
    queryFn: () => api.get('/financeiro/categorias?tipo=DESPESA'),
  })

  const { data: contasBancarias } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---- Itens ----
  function addItem(produto, variacao) {
    setItens((prev) => [
      ...prev,
      {
        uid: `it-${++itemUid}`,
        variacaoId: variacao.id,
        produtoNome: produto.nome,
        tamanho: variacao.tamanho,
        cor: variacao.cor,
        lojaId: '',
        quantidade: 1,
        custoUnitario: '',
        valorVenda: '',
        previsaoChegada: '',
      },
    ])
  }

  function updateItem(uid, field, value) {
    setItens((prev) => prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)))
  }

  function removeItem(uid) {
    setItens((prev) => prev.filter((i) => i.uid !== uid))
  }

  // ---- Parcelas ----
  function addParcela() {
    setParcelas((prev) => [
      ...prev,
      { uid: `pc-${++parcelaUid}`, valor: '', vencimento: '', categoriaId: '', contaBancariaId: '' },
    ])
  }

  function updateParcela(uid, field, value) {
    setParcelas((prev) => prev.map((p) => (p.uid === uid ? { ...p, [field]: value } : p)))
  }

  function removeParcela(uid) {
    setParcelas((prev) => prev.filter((p) => p.uid !== uid))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.fornecedorId) {
      toast.error('O fornecedor é obrigatório.')
      return
    }
    if (!form.dataCompra) {
      toast.error('A data da compra é obrigatória.')
      return
    }
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item.')
      return
    }
    for (const item of itens) {
      if (!item.lojaId) {
        toast.error(`Selecione a loja para o item "${item.produtoNome}".`)
        return
      }
      if (!item.quantidade || Number(item.quantidade) <= 0) {
        toast.error(`Informe uma quantidade válida para o item "${item.produtoNome}".`)
        return
      }
      if (item.custoUnitario === '' || Number(item.custoUnitario) < 0) {
        toast.error(`Informe um custo unitário válido para o item "${item.produtoNome}".`)
        return
      }
    }
    for (const parcela of parcelas) {
      if (!parcela.valor || Number(parcela.valor) <= 0) {
        toast.error('Informe um valor válido para todas as parcelas.')
        return
      }
      if (!parcela.vencimento) {
        toast.error('Informe o vencimento de todas as parcelas.')
        return
      }
      if (!parcela.categoriaId) {
        toast.error('Selecione a categoria de todas as parcelas.')
        return
      }
    }

    const payload = {
      fornecedorId: form.fornecedorId,
      numeroNota: form.numeroNota.trim() || undefined,
      serie: form.serie.trim() || undefined,
      dataCompra: form.dataCompra,
      observacoes: form.observacoes.trim() || undefined,
      anexoUrl: form.anexoUrl.trim() || undefined,
      itens: itens.map((i) => ({
        variacaoId: i.variacaoId,
        lojaId: i.lojaId,
        quantidade: Number(i.quantidade),
        custoUnitario: Number(i.custoUnitario),
        valorVenda: i.valorVenda === '' ? undefined : Number(i.valorVenda),
        previsaoChegada: i.previsaoChegada || undefined,
      })),
      parcelas: parcelas.map((p) => ({
        valor: Number(p.valor),
        vencimento: p.vencimento,
        categoriaId: p.categoriaId,
        contaBancariaId: p.contaBancariaId || undefined,
      })),
    }

    setSaving(true)
    try {
      await api.post('/compras', payload)
      toast.success('Compra criada com sucesso.')
      navigate('/compras')
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar compra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Nova compra"
        subtitle="Preencha os dados para cadastrar uma nova compra de mercadoria."
        action={
          <Button variant="secondary" onClick={() => navigate('/compras')}>
            Cancelar
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Dados da compra">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Fornecedor *"
              value={form.fornecedorId}
              onChange={(e) => handleChange('fornecedorId', e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {(fornecedores || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>

            <Input
              label="Data da compra *"
              type="date"
              value={form.dataCompra}
              onChange={(e) => handleChange('dataCompra', e.target.value)}
              required
            />

            <Input
              label="Número da nota"
              value={form.numeroNota}
              onChange={(e) => handleChange('numeroNota', e.target.value)}
            />

            <Input
              label="Série"
              value={form.serie}
              onChange={(e) => handleChange('serie', e.target.value)}
            />

            <Input
              label="Link do anexo (opcional)"
              value={form.anexoUrl}
              onChange={(e) => handleChange('anexoUrl', e.target.value)}
              placeholder="https://..."
              containerClassName="sm:col-span-2"
            />

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </Card>

        <Card title="Itens">
          <ProdutoBusca onAdd={addItem} />

          {itens.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">Nenhum item adicionado ainda.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {itens.map((item) => (
                <ItemRow
                  key={item.uid}
                  item={item}
                  lojas={lojas || []}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Parcelas"
          action={
            <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addParcela}>
              Adicionar parcela
            </Button>
          }
        >
          {parcelas.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma parcela adicionada (opcional).</p>
          ) : (
            <div className="space-y-3">
              {parcelas.map((parcela) => (
                <ParcelaRow
                  key={parcela.uid}
                  parcela={parcela}
                  categorias={categorias || []}
                  contasBancarias={contasBancarias || []}
                  onUpdate={updateParcela}
                  onRemove={removeParcela}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/compras')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Criar compra
          </Button>
        </div>
      </form>
    </div>
  )
}

function ItemRow({ item, lojas, onUpdate, onRemove }) {
  const varLabel = [item.tamanho, item.cor].filter(Boolean).join(' / ')

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-gray-900">{item.produtoNome}</div>
          {varLabel && <div className="text-xs text-gray-500">{varLabel}</div>}
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.uid)}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remover item"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Select
          label="Loja *"
          value={item.lojaId}
          onChange={(e) => onUpdate(item.uid, 'lojaId', e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </Select>
        <Input
          label="Quantidade *"
          type="number"
          min="1"
          step="1"
          value={item.quantidade}
          onChange={(e) => onUpdate(item.uid, 'quantidade', e.target.value)}
          required
        />
        <Input
          label="Custo unit. (R$) *"
          type="number"
          min="0"
          step="0.01"
          value={item.custoUnitario}
          onChange={(e) => onUpdate(item.uid, 'custoUnitario', e.target.value)}
          required
        />
        <Input
          label="Valor de venda (R$)"
          type="number"
          min="0"
          step="0.01"
          value={item.valorVenda}
          onChange={(e) => onUpdate(item.uid, 'valorVenda', e.target.value)}
        />
        <Input
          label="Previsão de chegada"
          type="date"
          value={item.previsaoChegada}
          onChange={(e) => onUpdate(item.uid, 'previsaoChegada', e.target.value)}
        />
      </div>
    </div>
  )
}

function ParcelaRow({ parcela, categorias, contasBancarias, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onRemove(parcela.uid)}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remover parcela"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input
          label="Valor (R$) *"
          type="number"
          min="0"
          step="0.01"
          value={parcela.valor}
          onChange={(e) => onUpdate(parcela.uid, 'valor', e.target.value)}
          required
        />
        <Input
          label="Vencimento *"
          type="date"
          value={parcela.vencimento}
          onChange={(e) => onUpdate(parcela.uid, 'vencimento', e.target.value)}
          required
        />
        <Select
          label="Categoria *"
          value={parcela.categoriaId}
          onChange={(e) => onUpdate(parcela.uid, 'categoriaId', e.target.value)}
          required
        >
          <option value="">Selecione...</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Conta bancária"
          value={parcela.contaBancariaId}
          onChange={(e) => onUpdate(parcela.uid, 'contaBancariaId', e.target.value)}
        >
          <option value="">Sem conta definida</option>
          {contasBancarias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

// Busca de produtos por nome (mesma UX de Estoque.jsx/NovaMovimentacaoCard): digita,
// escolhe o produto na lista, depois escolhe a variação para adicionar o item.
function ProdutoBusca({ onAdd }) {
  const [query, setQuery] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [variacaoId, setVariacaoId] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const { data: produtosResult, isFetching: buscando } = useQuery({
    queryKey: ['produtos', 'busca-compra', termoBusca],
    queryFn: () => api.get(`/produtos?q=${encodeURIComponent(termoBusca)}&limit=50`),
    enabled: termoBusca.length > 0,
  })

  const produtosEncontrados = produtosResult?.data || []

  function handleSelectProduto(produto) {
    setProdutoSelecionado(produto)
    setQuery(produto.nome)
    setShowDropdown(false)
    setVariacaoId('')
  }

  function handleAddVariacao() {
    const variacao = produtoSelecionado?.variacoes?.find((v) => String(v.id) === String(variacaoId))
    if (!produtoSelecionado || !variacao) return
    onAdd(produtoSelecionado, variacao)
    setQuery('')
    setTermoBusca('')
    setProdutoSelecionado(null)
    setVariacaoId('')
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-gray-700">Adicionar produto</label>
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
          {buscando && <div className="px-4 py-3 text-sm text-gray-500">Buscando...</div>}
          {!buscando && produtosEncontrados.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">Nenhum produto encontrado.</div>
          )}
          {!buscando &&
            produtosEncontrados.map((produto) => (
              <button
                type="button"
                key={produto.id}
                onClick={() => handleSelectProduto(produto)}
                className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{produto.nome}</div>
                  <div className="text-xs text-gray-500">{(produto.variacoes || []).length} variação(ões)</div>
                </div>
              </button>
            ))}
        </div>
      )}

      {produtoSelecionado && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Select
            label="Variação"
            containerClassName="flex-1"
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
          <Button type="button" icon={Plus} disabled={!variacaoId} onClick={handleAddVariacao}>
            Adicionar item
          </Button>
        </div>
      )}
    </div>
  )
}
