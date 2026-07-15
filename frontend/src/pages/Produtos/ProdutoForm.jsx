import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Copy, Barcode, Pencil } from 'lucide-react'
import { api, uploadFoto, fotoSrc } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Button, Input, Select, Card, Spinner, Table, Thead, Th, Tbody, Td, Tr } from '../../components/ui/index.js'

const GENEROS = [
  { value: '', label: 'Selecione...' },
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'UNISSEX', label: 'Unissex' },
]

const ORIGENS_MERCADORIA = [
  { value: '0', label: '0 — Nacional (exceto 3 a 5)' },
  { value: '1', label: '1 — Estrangeira - Importação direta' },
  { value: '2', label: '2 — Estrangeira - Adquirida no mercado interno' },
  { value: '3', label: '3 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 40%' },
  { value: '4', label: '4 — Nacional - Produção em conformidade com processos produtivos básicos' },
  { value: '5', label: '5 — Nacional - Mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%' },
  { value: '6', label: '6 — Estrangeira - Importação direta, sem similar nacional' },
  { value: '7', label: '7 — Estrangeira - Adquirida no mercado interno, sem similar nacional' },
  { value: '8', label: '8 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 70%' },
]

const CSOSN_OPCOES = [
  { value: '101', label: '101 — Tributada com permissão de crédito' },
  { value: '102', label: '102 — Tributada sem permissão de crédito' },
  { value: '103', label: '103 — Isenção do ICMS para faixa de receita bruta' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada' },
  { value: '500', label: '500 — ICMS cobrado anteriormente por substituição tributária' },
  { value: '900', label: '900 — Outros' },
]

const emptyForm = {
  referencia: '',
  nome: '',
  descricao: '',
  categoriaId: '',
  marcaId: '',
  fornecedorPadraoId: '',
  escalaId: '',
  genero: '',
  colecao: '',
  estacao: '',
  ncm: '',
  cest: '',
  origemMercadoria: '',
  csosn: '',
  cfop: '',
  precoCusto: '',
  precoVenda: '',
  ativo: true,
}

function combinacaoKey(tamanho, cor) {
  return `${tamanho}::${cor}`
}

export default function ProdutoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(emptyForm)
  const [markup, setMarkup] = useState('')
  const [coresSelecionadas, setCoresSelecionadas] = useState(new Set())
  const [gradeCores, setGradeCores] = useState({})
  const [saving, setSaving] = useState(false)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null)
  const [removendoFoto, setRemovendoFoto] = useState(false)
  const [fiscalPreenchidoAuto, setFiscalPreenchidoAuto] = useState(false)
  const [gerandoIds, setGerandoIds] = useState(new Set())
  const [editandoBarcodeId, setEditandoBarcodeId] = useState(null)
  const [barcodeValor, setBarcodeValor] = useState('')
  const [salvandoBarcodeId, setSalvandoBarcodeId] = useState(null)

  const { data: categorias } = useQuery({
    queryKey: ['categorias', 'select'],
    queryFn: () => api.get('/categorias'),
  })

  const { data: marcas } = useQuery({
    queryKey: ['marcas', 'select'],
    queryFn: () => api.get('/marcas'),
  })

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'select'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data: escalas } = useQuery({
    queryKey: ['escalas', 'select'],
    queryFn: () => api.get('/escalas'),
  })

  const { data: cores } = useQuery({
    queryKey: ['cores', 'select'],
    queryFn: () => api.get('/cores'),
  })

  const { data: configFiscal } = useQuery({
    queryKey: ['config', 'fiscal'],
    queryFn: () => api.get('/config/fiscal'),
    enabled: !isEdit,
  })

  const { data: produto, isLoading: isLoadingProduto } = useQuery({
    queryKey: ['produtos', id],
    queryFn: () => api.get(`/produtos/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (produto) {
      setForm({
        referencia: produto.referencia || '',
        nome: produto.nome || '',
        descricao: produto.descricao || '',
        categoriaId: produto.categoriaId || '',
        marcaId: produto.marcaId || '',
        fornecedorPadraoId: produto.fornecedorPadraoId || '',
        escalaId: produto.escalaId || '',
        genero: produto.genero || '',
        colecao: produto.colecao || '',
        estacao: produto.estacao || '',
        ncm: produto.ncm || '',
        cest: produto.cest || '',
        origemMercadoria: produto.origemMercadoria ?? '',
        csosn: produto.csosn || '',
        cfop: produto.cfop || '',
        precoCusto: produto.precoCusto ?? '',
        precoVenda: produto.precoVenda ?? '',
        ativo: produto.ativo ?? true,
      })

      const custo = Number(produto.precoCusto)
      const venda = Number(produto.precoVenda)
      if (custo > 0 && venda >= 0) {
        setMarkup((((venda - custo) / custo) * 100).toFixed(2))
      }

      const ativas = (produto.variacoes || []).filter((v) => v.ativo)
      const coresAtivas = new Set(ativas.map((v) => v.cor))
      setCoresSelecionadas(coresAtivas)

      const grade = {}
      for (const cor of coresAtivas) {
        const dessaCor = ativas.filter((v) => v.cor === cor)
        const tamanhosSelecionados = new Set(dessaCor.map((v) => v.tamanho))
        const precos = new Set(dessaCor.map((v) => String(v.precoVenda ?? '')))
        const precoVenda = precos.size === 1 ? [...precos][0] : ''
        grade[cor] = { tamanhosSelecionados, precoVenda }
      }
      setGradeCores(grade)
    }
  }, [produto])

  useEffect(() => {
    if (!isEdit && configFiscal && !fiscalPreenchidoAuto) {
      setForm((prev) => {
        if (prev.ncm || prev.cest || prev.origemMercadoria || prev.csosn || prev.cfop) {
          return prev
        }
        return {
          ...prev,
          ncm: configFiscal.ncmPadrao || '',
          cest: configFiscal.cest || '',
          origemMercadoria: configFiscal.origemMercadoria ?? '',
          csosn: configFiscal.csosn || '',
          cfop: configFiscal.cfop || '',
        }
      })
      setFiscalPreenchidoAuto(true)
    }
  }, [isEdit, configFiscal, fiscalPreenchidoAuto])

  useEffect(() => {
    if (!fotoFile) {
      setFotoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(fotoFile)
    setFotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [fotoFile])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handlePrecoCustoChange(value) {
    setForm((prev) => {
      const custo = Number(value)
      const venda = Number(prev.precoVenda)
      if (custo > 0 && prev.precoVenda !== '' && !isNaN(venda)) {
        setMarkup((((venda - custo) / custo) * 100).toFixed(2))
      }
      return { ...prev, precoCusto: value }
    })
  }

  function handlePrecoVendaChange(value) {
    setForm((prev) => {
      const venda = Number(value)
      const custo = Number(prev.precoCusto)
      if (custo > 0 && value !== '' && !isNaN(venda)) {
        setMarkup((((venda - custo) / custo) * 100).toFixed(2))
      }
      return { ...prev, precoVenda: value }
    })
  }

  function handleMarkupChange(value) {
    setMarkup(value)
    setForm((prev) => {
      const custo = Number(prev.precoCusto)
      const markupNum = Number(value)
      if (custo > 0 && value !== '' && !isNaN(markupNum)) {
        const novoPrecoVenda = custo * (1 + markupNum / 100)
        return { ...prev, precoVenda: novoPrecoVenda.toFixed(2) }
      }
      return prev
    })
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo deve ser uma imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo deve ter no máximo 5MB.')
      return
    }
    setFotoFile(file)
  }

  async function handleRemoverFoto() {
    if (!isEdit) return
    const confirmado = window.confirm('Remover a foto deste produto?')
    if (!confirmado) return

    setRemovendoFoto(true)
    try {
      await api.delete(`/produtos/${id}/foto`)
      toast.success('Foto removida com sucesso.')
      setFotoFile(null)
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      queryClient.invalidateQueries({ queryKey: ['produtos', id] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao remover foto.')
    } finally {
      setRemovendoFoto(false)
    }
  }

  async function handleCopyCodigoBarras(codigoBarras) {
    try {
      await navigator.clipboard.writeText(codigoBarras || '')
      toast.success('Código de barras copiado para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar o código de barras. Copie manualmente.')
    }
  }

  async function handleGerarCodigoBarras(variacaoId) {
    setGerandoIds((prev) => new Set(prev).add(variacaoId))
    try {
      await api.post(`/produtos/${id}/variacoes/${variacaoId}/codigo-barras`)
      toast.success('Código de barras gerado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['produtos', id] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar código de barras.')
    } finally {
      setGerandoIds((prev) => {
        const next = new Set(prev)
        next.delete(variacaoId)
        return next
      })
    }
  }

  function handleAbrirEdicaoBarcode(variacao) {
    setEditandoBarcodeId(variacao.id)
    setBarcodeValor(variacao.codigoBarras || '')
  }

  function handleCancelarEdicaoBarcode() {
    setEditandoBarcodeId(null)
    setBarcodeValor('')
  }

  async function handleSalvarBarcode(variacaoId) {
    const valor = barcodeValor.trim()
    if (valor && !/^\d{8,14}$/.test(valor)) {
      toast.error('Código de barras deve ter entre 8 e 14 dígitos numéricos.')
      return
    }
    setSalvandoBarcodeId(variacaoId)
    try {
      await api.post(`/produtos/${id}/variacoes/${variacaoId}/codigo-barras`, valor ? { codigoBarras: valor } : {})
      toast.success('Código de barras salvo com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['produtos', id] })
      handleCancelarEdicaoBarcode()
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar código de barras.')
    } finally {
      setSalvandoBarcodeId(null)
    }
  }

  const variacoesAtivasOrdenadas = useMemo(() => {
    return (produto?.variacoes || [])
      .filter((v) => v.ativo)
      .sort((a, b) => a.cor.localeCompare(b.cor) || a.tamanho.localeCompare(b.tamanho))
  }, [produto])

  const escalaSelecionada = useMemo(() => {
    if (!escalas || !form.escalaId) return null
    return escalas.find((e) => e.id === form.escalaId) || null
  }, [escalas, form.escalaId])

  const tamanhosDaEscala = escalaSelecionada?.tamanhos || []

  function handleToggleCor(corNome) {
    setCoresSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(corNome)) {
        next.delete(corNome)
      } else {
        next.add(corNome)
      }
      return next
    })
    setGradeCores((prev) => {
      if (prev[corNome]) return prev
      return {
        ...prev,
        [corNome]: { tamanhosSelecionados: new Set(tamanhosDaEscala), precoVenda: '' },
      }
    })
  }

  function handleToggleTamanhoCor(corNome, tamanho) {
    setGradeCores((prev) => {
      const atual = prev[corNome] || { tamanhosSelecionados: new Set(), precoVenda: '' }
      const tamanhosSelecionados = new Set(atual.tamanhosSelecionados)
      if (tamanhosSelecionados.has(tamanho)) {
        tamanhosSelecionados.delete(tamanho)
      } else {
        tamanhosSelecionados.add(tamanho)
      }
      return { ...prev, [corNome]: { ...atual, tamanhosSelecionados } }
    })
  }

  function handlePrecoCorChange(corNome, value) {
    setGradeCores((prev) => {
      const atual = prev[corNome] || { tamanhosSelecionados: new Set(), precoVenda: '' }
      return { ...prev, [corNome]: { ...atual, precoVenda: value } }
    })
  }

  const combinacoesSelecionadas = useMemo(() => {
    const lista = []
    for (const cor of coresSelecionadas) {
      const info = gradeCores[cor]
      if (!info) continue
      for (const tamanho of info.tamanhosSelecionados) {
        lista.push({ cor, tamanho, precoVenda: info.precoVenda })
      }
    }
    return lista
  }, [coresSelecionadas, gradeCores])

  const resumoGrade = useMemo(() => {
    const existentesMap = new Map()
    for (const v of produto?.variacoes || []) {
      existentesMap.set(combinacaoKey(v.tamanho, v.cor), v.ativo)
    }

    let novos = 0
    let reativar = 0
    const combinacoesAtuaisKeys = new Set()

    for (const c of combinacoesSelecionadas) {
      const key = combinacaoKey(c.tamanho, c.cor)
      combinacoesAtuaisKeys.add(key)
      if (!existentesMap.has(key)) {
        novos++
      } else if (existentesMap.get(key) === false) {
        reativar++
      }
    }

    let inativar = 0
    for (const v of produto?.variacoes || []) {
      if (v.ativo && !combinacoesAtuaisKeys.has(combinacaoKey(v.tamanho, v.cor))) {
        inativar++
      }
    }

    return { novos, reativar, inativar }
  }, [combinacoesSelecionadas, produto])

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nome.trim()) {
      toast.error('A descrição (nome) do produto é obrigatória.')
      return
    }
    if (!form.categoriaId) {
      toast.error('A categoria é obrigatória.')
      return
    }
    if (!form.colecao.trim()) {
      toast.error('A coleção é obrigatória.')
      return
    }
    if (!form.escalaId) {
      toast.error('A escala de tamanho é obrigatória.')
      return
    }
    if (form.precoCusto === '' || form.precoCusto === null) {
      toast.error('O preço de custo é obrigatório.')
      return
    }
    if (form.precoVenda === '' || form.precoVenda === null) {
      toast.error('O preço de venda é obrigatório.')
      return
    }
    if (!form.ncm.trim()) {
      toast.error('O NCM é obrigatório.')
      return
    }
    if (form.origemMercadoria === '') {
      toast.error('A origem da mercadoria é obrigatória.')
      return
    }
    if (!form.csosn) {
      toast.error('O CSOSN é obrigatório.')
      return
    }
    if (combinacoesSelecionadas.length === 0) {
      toast.error('Marque ao menos uma combinação de cor e tamanho na grade de variações.')
      return
    }

    const payload = {
      referencia: form.referencia || undefined,
      nome: form.nome.trim(),
      descricao: form.descricao || undefined,
      categoriaId: form.categoriaId || undefined,
      marcaId: form.marcaId || undefined,
      fornecedorPadraoId: form.fornecedorPadraoId || undefined,
      escalaId: form.escalaId,
      genero: form.genero || undefined,
      colecao: form.colecao || undefined,
      estacao: form.estacao || undefined,
      ncm: form.ncm || undefined,
      cest: form.cest || undefined,
      origemMercadoria: form.origemMercadoria,
      csosn: form.csosn,
      cfop: form.cfop || undefined,
      precoCusto: Number(form.precoCusto),
      precoVenda: Number(form.precoVenda),
      variacoes: combinacoesSelecionadas.map((c) => ({
        tamanho: c.tamanho,
        cor: c.cor,
        precoVenda: c.precoVenda === '' || c.precoVenda === null || c.precoVenda === undefined
          ? null
          : Number(c.precoVenda),
      })),
    }

    setSaving(true)
    try {
      let produtoId = id
      if (isEdit) {
        await api.put(`/produtos/${id}`, payload)
      } else {
        const result = await api.post('/produtos', payload)
        produtoId = result?.id
      }

      if (fotoFile && produtoId) {
        try {
          await uploadFoto(produtoId, fotoFile)
        } catch (fotoErr) {
          toast.error(`Produto salvo, mas houve erro ao enviar a foto: ${fotoErr?.message || 'erro desconhecido'}`)
        }
      }

      toast.success(isEdit ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['produtos', id] })
      }
      navigate('/produtos')
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && isLoadingProduto) {
    return <Spinner />
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Editar produto' : 'Novo produto'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isEdit ? 'Atualize as informações do produto.' : 'Preencha os dados para cadastrar um novo produto.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/produtos')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Foto do produto">
          <div className="flex flex-wrap items-center gap-4">
            {fotoPreviewUrl ? (
              <img
                src={fotoPreviewUrl}
                alt="Pré-visualização da foto"
                className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
              />
            ) : fotoSrc(produto?.fotoUrl) ? (
              <img
                src={fotoSrc(produto.fotoUrl)}
                alt={produto?.nome || 'Foto do produto'}
                className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700">
                {produto?.fotoUrl || fotoPreviewUrl ? 'Alterar foto' : 'Nenhuma foto'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="text-xs text-gray-500">Imagens até 5MB.</p>

              {isEdit && produto?.fotoUrl && !fotoFile && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={removendoFoto}
                  onClick={handleRemoverFoto}
                  className="w-fit text-red-600 hover:bg-red-50"
                >
                  Remover foto
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Dados gerais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Referência"
              value={form.referencia}
              onChange={(e) => handleChange('referencia', e.target.value)}
            />

            <Input
              label="Descrição"
              value={form.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              required
            />

            <Select
              label="Categoria"
              value={form.categoriaId}
              onChange={(e) => handleChange('categoriaId', e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {(categorias || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>

            <Input
              label="Coleção"
              value={form.colecao}
              onChange={(e) => handleChange('colecao', e.target.value)}
              placeholder="Ex: Verão 2026"
              required
            />

            <Select
              label="Marca"
              value={form.marcaId}
              onChange={(e) => handleChange('marcaId', e.target.value)}
            >
              <option value="">Sem marca</option>
              {(marcas || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>

            <Select
              label="Fornecedor padrão"
              value={form.fornecedorPadraoId}
              onChange={(e) => handleChange('fornecedorPadraoId', e.target.value)}
            >
              <option value="">Sem fornecedor padrão</option>
              {(fornecedores || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>

            <div>
              <Select
                label="Escala de tamanho"
                value={form.escalaId}
                onChange={(e) => handleChange('escalaId', e.target.value)}
                disabled={isEdit}
                required
              >
                <option value="">Selecione...</option>
                {(escalas || []).map((esc) => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nome}
                  </option>
                ))}
              </Select>
              {isEdit && (
                <p className="mt-1 text-xs text-gray-500">A escala não pode ser trocada após a criação.</p>
              )}
            </div>

            <Select
              label="Gênero"
              value={form.genero}
              onChange={(e) => handleChange('genero', e.target.value)}
            >
              {GENEROS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>

            <Input
              label="Preço de custo (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.precoCusto}
              onChange={(e) => handlePrecoCustoChange(e.target.value)}
              required
            />

            <Input
              label="Preço de venda padrão (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.precoVenda}
              onChange={(e) => handlePrecoVendaChange(e.target.value)}
              required
            />

            <Input
              label="Markup sugerido (%)"
              type="number"
              step="0.01"
              value={markup}
              onChange={(e) => handleMarkupChange(e.target.value)}
            />

            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={form.ativo}
                onChange={(e) => handleChange('ativo', e.target.checked)}
              />
              Produto ativo
            </label>
          </div>
        </Card>

        <Card title="Dados fiscais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="NCM"
              value={form.ncm}
              onChange={(e) => handleChange('ncm', e.target.value)}
              required
            />

            <Input
              label="CEST"
              value={form.cest}
              onChange={(e) => handleChange('cest', e.target.value.replace(/\D/g, ''))}
              maxLength={7}
              placeholder="7 dígitos"
            />

            <Select
              label="Origem da mercadoria"
              value={form.origemMercadoria}
              onChange={(e) => handleChange('origemMercadoria', e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {ORIGENS_MERCADORIA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              label="CSOSN"
              value={form.csosn}
              onChange={(e) => handleChange('csosn', e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {CSOSN_OPCOES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>

            <Input
              label="CFOP padrão"
              value={form.cfop}
              onChange={(e) => handleChange('cfop', e.target.value)}
              placeholder="Ex: 5102"
            />
          </div>
        </Card>

        <Card title="Grade de variações (cores × tamanhos)">
          <div className="mb-5">
            <h4 className="mb-2 text-sm font-medium text-gray-700">Cores do produto</h4>
            {(cores || []).length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma cor cadastrada.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {(cores || []).map((cor) => (
                  <label
                    key={cor.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={coresSelecionadas.has(cor.nome)}
                      onChange={() => handleToggleCor(cor.nome)}
                    />
                    <span
                      style={{ backgroundColor: cor.hex }}
                      className="h-4 w-4 rounded-full border border-gray-300 inline-block"
                    />
                    {cor.nome}
                  </label>
                ))}
              </div>
            )}
          </div>

          {!form.escalaId ? (
            <p className="text-sm text-gray-500">
              Escolha a escala de tamanho na seção Dados gerais para montar a grade.
            </p>
          ) : coresSelecionadas.size === 0 ? (
            <p className="text-sm text-gray-500">Selecione ao menos uma cor para montar a grade.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Cor
                    </th>
                    {tamanhosDaEscala.map((tamanho) => (
                      <th
                        key={tamanho}
                        className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {tamanho}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Preço venda da cor (R$, opcional)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {[...coresSelecionadas].map((corNome) => {
                    const corInfo = (cores || []).find((c) => c.nome === corNome)
                    const gradeInfo = gradeCores[corNome] || { tamanhosSelecionados: new Set(), precoVenda: '' }
                    return (
                      <tr key={corNome}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              style={{ backgroundColor: corInfo?.hex || '#ccc' }}
                              className="h-4 w-4 rounded-full border border-gray-300 inline-block"
                            />
                            {corNome}
                          </div>
                        </td>
                        {tamanhosDaEscala.map((tamanho) => (
                          <td key={tamanho} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={gradeInfo.tamanhosSelecionados.has(tamanho)}
                              onChange={() => handleToggleTamanhoCor(corNome, tamanho)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={gradeInfo.precoVenda}
                            onChange={(e) => handlePrecoCorChange(corNome, e.target.value)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              {resumoGrade.novos} SKU(s) novo(s) a gerar, {resumoGrade.reativar} a reativar,{' '}
              {resumoGrade.inativar} a inativar ao salvar.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              SKUs existentes nunca são excluídos — apenas inativados. O código de barras é preservado e
              nunca reaproveitado. Novas variações nascem sem código de barras; gere-o manualmente quando
              necessário, na seção "Códigos de barras (SKUs)" abaixo.
            </p>
          </div>
        </Card>

        {isEdit && variacoesAtivasOrdenadas.length > 0 && (
          <Card title="Códigos de barras (SKUs)">
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Cor</Th>
                    <Th>Tamanho</Th>
                    <Th>SKU</Th>
                    <Th>Código de barras</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {variacoesAtivasOrdenadas.map((v) => (
                    <Tr key={v.id}>
                      <Td>{v.cor}</Td>
                      <Td>{v.tamanho}</Td>
                      <Td className="font-mono">{v.sku}</Td>
                      <Td className="font-mono">
                        {editandoBarcodeId === v.id ? (
                          <Input
                            className="w-40"
                            value={barcodeValor}
                            onChange={(e) => setBarcodeValor(e.target.value)}
                            placeholder="13 dígitos ou deixe vazio para gerar automático"
                          />
                        ) : (
                          v.codigoBarras || '—'
                        )}
                      </Td>
                      <Td>
                        {editandoBarcodeId === v.id ? (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              loading={salvandoBarcodeId === v.id}
                              onClick={() => handleSalvarBarcode(v.id)}
                            >
                              Salvar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleCancelarEdicaoBarcode}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {v.codigoBarras ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={Copy}
                                onClick={() => handleCopyCodigoBarras(v.codigoBarras)}
                              >
                                Copiar
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={Barcode}
                                loading={gerandoIds.has(v.id)}
                                onClick={() => handleGerarCodigoBarras(v.id)}
                              >
                                Gerar
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={Pencil}
                              onClick={() => handleAbrirEdicaoBarcode(v)}
                            >
                              Editar
                            </Button>
                          </div>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/produtos')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </div>
      </form>
    </div>
  )
}
