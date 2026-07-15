import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus, Pencil, Trash2, CheckCircle2, ChevronDown, ArrowLeftRight, Wallet } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDate, toInputDate } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Modal,
  Card,
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
  StatCard,
} from '../../components/ui/index.js'

const EMPTY_TRANSFERENCIA_FORM = {
  contaOrigemId: '',
  contaDestinoId: '',
  valor: '',
  data: '',
  descricao: '',
}

const EMPTY_ENTRADA_FORM = {
  descricao: '',
  categoriaId: '',
  valorBruto: '',
  dataPrevista: '',
  clienteId: '',
  contaBancariaId: '',
}

const EMPTY_SAIDA_FORM = {
  descricao: '',
  categoriaId: '',
  fornecedorId: '',
  contaBancariaId: '',
  valor: '',
  desconto: '0',
  juros: '0',
  vencimento: '',
}

function ResumoContas({ resumo }) {
  const contas = resumo?.contas ?? []
  if (contas.length === 0) return null

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Contas ({contas.length})
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contas.map((c) => (
            <StatCard key={c.id} label={c.nome} value={formatCurrency(c.saldo)} icon={Wallet} accent="sky" />
          ))}
        </div>
      </div>
      <div className="lg:w-56">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Totais</p>
        <StatCard label="Saldo atual" value={formatCurrency(resumo.saldoTotal)} icon={Landmark} accent="indigo" />
      </div>
    </div>
  )
}

function RegistrarDropdown({ onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(action) {
    setOpen(false)
    onSelect(action)
  }

  return (
    <div className="relative" ref={ref}>
      <Button icon={Plus} onClick={() => setOpen((v) => !v)}>
        Registrar
        <ChevronDown size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => select('entrada')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} className="text-emerald-600" /> Recebimento
          </button>
          <button
            type="button"
            onClick={() => select('saida')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} className="text-red-600" /> Pagamento
          </button>
          <button
            type="button"
            onClick={() => select('transferencia')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeftRight size={16} className="text-indigo-600" /> Transferência
          </button>
        </div>
      )}
    </div>
  )
}

function ExtratoContaCard({ conta, saldoInicial, movimentos, pendencias, onAction }) {
  const pendRecebiveis = pendencias?.recebiveis ?? []
  const pendContasPagar = pendencias?.contasPagar ?? []

  return (
    <Card
      title={conta.nome}
      action={
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(conta.saldo)}</span>
      }
    >
      <p className="mb-3 text-xs text-gray-500">
        Saldo inicial: {formatCurrency(saldoInicial)}
      </p>

      {(pendRecebiveis.length > 0 || pendContasPagar.length > 0) && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Pendências</p>
          <Table>
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Tipo</Th>
                <Th>Valor</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pendRecebiveis.map((r) => (
                <Tr key={`rp-${r.id}`}>
                  <Td>{formatDate(r.data)}</Td>
                  <Td>{r.descricao}</Td>
                  <Td><Badge variant="amber">A receber</Badge></Td>
                  <Td className="font-medium text-emerald-600">+ {formatCurrency(r.valor)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => onAction('receber', r, conta)}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        Recebido
                      </Button>
                      {r.manual && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Pencil}
                            onClick={() => onAction('editar-entrada', r, conta)}
                            aria-label="Editar entrada"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => onAction('excluir-entrada', r, conta)}
                            aria-label="Excluir entrada"
                            className="text-red-600 hover:bg-red-50"
                          />
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {pendContasPagar.map((c) => (
                <Tr key={`cp-${c.id}`}>
                  <Td>{formatDate(c.data)}</Td>
                  <Td>{c.descricao}</Td>
                  <Td><Badge variant="amber">A pagar</Badge></Td>
                  <Td className="font-medium text-red-600">- {formatCurrency(c.valor)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => onAction('pagar', c, conta)}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        Pago
                      </Button>
                      {c.manual && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Pencil}
                            onClick={() => onAction('editar-saida', c, conta)}
                            aria-label="Editar saída"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => onAction('excluir-saida', c, conta)}
                            aria-label="Excluir saída"
                            className="text-red-600 hover:bg-red-50"
                          />
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {movimentos.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma movimentação encontrada"
          description="Ajuste o período para ver outras movimentações."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Tipo</Th>
              <Th>Valor</Th>
              <Th>Saldo</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {movimentos.map((mov, idx) => (
              <Tr key={mov.id ? `${mov.origem}-${mov.id}` : idx}>
                <Td>{formatDate(mov.data)}</Td>
                <Td>{mov.descricao}</Td>
                <Td>
                  {mov.tipo === 'RECEBIMENTO' ? (
                    <Badge variant="green">Recebimento</Badge>
                  ) : (
                    <Badge variant="red">Pagamento</Badge>
                  )}
                </Td>
                <Td
                  className={
                    mov.tipo === 'RECEBIMENTO' ? 'font-medium text-emerald-600' : 'font-medium text-red-600'
                  }
                >
                  {mov.tipo === 'RECEBIMENTO' ? '+' : '-'} {formatCurrency(Math.abs(mov.valor))}
                </Td>
                <Td className="font-medium text-gray-900">{formatCurrency(mov.saldoAposMovimento)}</Td>
                <Td>
                  {mov.manual && mov.origem === 'TRANSFERENCIA' && (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => onAction('excluir-transferencia', mov, conta)}
                        aria-label="Excluir transferência"
                        className="text-red-600 hover:bg-red-50"
                      />
                    </div>
                  )}
                  {mov.manual && mov.origem !== 'TRANSFERENCIA' && (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() =>
                          onAction(mov.tipo === 'RECEBIMENTO' ? 'editar-entrada' : 'editar-saida', mov, conta)
                        }
                        aria-label="Editar lançamento"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() =>
                          onAction(mov.tipo === 'RECEBIMENTO' ? 'excluir-entrada' : 'excluir-saida', mov, conta)
                        }
                        aria-label="Excluir lançamento"
                        className="text-red-600 hover:bg-red-50"
                      />
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  )
}

export default function Extrato() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [contaBancariaId, setContaBancariaId] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const [entradaModalOpen, setEntradaModalOpen] = useState(false)
  const [entradaForm, setEntradaForm] = useState(EMPTY_ENTRADA_FORM)
  const [entradaEditId, setEntradaEditId] = useState(null)
  const [savingEntrada, setSavingEntrada] = useState(false)

  const [saidaModalOpen, setSaidaModalOpen] = useState(false)
  const [saidaForm, setSaidaForm] = useState(EMPTY_SAIDA_FORM)
  const [saidaEditId, setSaidaEditId] = useState(null)
  const [savingSaida, setSavingSaida] = useState(false)

  const [transferenciaModalOpen, setTransferenciaModalOpen] = useState(false)
  const [transferenciaForm, setTransferenciaForm] = useState(EMPTY_TRANSFERENCIA_FORM)
  const [savingTransferencia, setSavingTransferencia] = useState(false)

  const { data: contasBancarias } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  const { data: categoriasReceita } = useQuery({
    queryKey: ['financeiro-categorias', 'select', 'RECEITA'],
    queryFn: () => api.get('/financeiro/categorias?tipo=RECEITA'),
  })

  const { data: categoriasDespesa } = useQuery({
    queryKey: ['financeiro-categorias', 'select', 'DESPESA'],
    queryFn: () => api.get('/financeiro/categorias?tipo=DESPESA'),
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes', 'select'],
    queryFn: () => api.get('/clientes'),
  })

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'select'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['financeiro-extrato', { contaBancariaId, de, ate }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (contaBancariaId) params.set('contaBancariaId', contaBancariaId)
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      const qs = params.toString()
      return api.get(`/financeiro/extrato${qs ? `?${qs}` : ''}`)
    },
  })

  const contas = contaBancariaId ? (data ? [data] : []) : data?.contas ?? []
  const resumoContas = data?.resumoContas

  function invalidateExtrato() {
    queryClient.invalidateQueries({ queryKey: ['financeiro-extrato'] })
  }

  function openNovaEntrada() {
    setEntradaEditId(null)
    setEntradaForm({ ...EMPTY_ENTRADA_FORM, contaBancariaId })
    setEntradaModalOpen(true)
  }

  function openEditarEntrada(mov) {
    setEntradaEditId(mov.id)
    setEntradaForm({
      descricao: mov.descricao || '',
      categoriaId: '',
      valorBruto: mov.valor ?? '',
      dataPrevista: toInputDate(mov.data),
      clienteId: '',
      contaBancariaId,
    })
    setEntradaModalOpen(true)
  }

  function closeEntradaModal() {
    setEntradaModalOpen(false)
    setEntradaEditId(null)
    setEntradaForm(EMPTY_ENTRADA_FORM)
  }

  async function handleEntradaSubmit(e) {
    e.preventDefault()
    if (!entradaForm.descricao.trim()) {
      toast.error('A descrição é obrigatória.')
      return
    }
    if (!entradaEditId && !entradaForm.categoriaId) {
      toast.error('A categoria é obrigatória.')
      return
    }
    if (entradaForm.valorBruto === '' || Number(entradaForm.valorBruto) <= 0) {
      toast.error('O valor deve ser maior que zero.')
      return
    }
    if (!entradaForm.dataPrevista) {
      toast.error('A data prevista é obrigatória.')
      return
    }

    const payload = {
      descricao: entradaForm.descricao.trim(),
      valorBruto: Number(entradaForm.valorBruto),
      dataPrevista: entradaForm.dataPrevista,
      clienteId: entradaForm.clienteId || undefined,
      contaBancariaId: entradaForm.contaBancariaId || undefined,
      ...(entradaForm.categoriaId ? { categoriaId: entradaForm.categoriaId } : {}),
    }

    setSavingEntrada(true)
    try {
      if (entradaEditId) {
        await api.put(`/recebiveis/${entradaEditId}`, payload)
        toast.success('Entrada atualizada com sucesso.')
      } else {
        await api.post('/recebiveis', payload)
        toast.success('Entrada criada com sucesso.')
      }
      invalidateExtrato()
      closeEntradaModal()
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar entrada.')
    } finally {
      setSavingEntrada(false)
    }
  }

  async function handleExcluirEntrada(item) {
    const confirmado = window.confirm(`Excluir a entrada "${item.descricao}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      await api.delete(`/recebiveis/${item.id}`)
      toast.success('Entrada excluída com sucesso.')
      invalidateExtrato()
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir entrada.')
    }
  }

  async function handleReceber(item, conta) {
    const confirmado = window.confirm(`Marcar "${item.descricao}" como recebido?`)
    if (!confirmado) return
    try {
      await api.post(`/recebiveis/${item.id}/receber`, { contaBancariaId: conta?.id })
      toast.success('Marcado como recebido.')
      invalidateExtrato()
    } catch (err) {
      toast.error(err?.message || 'Erro ao marcar como recebido.')
    }
  }

  function openNovaSaida() {
    setSaidaEditId(null)
    setSaidaForm({ ...EMPTY_SAIDA_FORM, contaBancariaId })
    setSaidaModalOpen(true)
  }

  function openEditarSaida(mov) {
    setSaidaEditId(mov.id)
    setSaidaForm({
      descricao: mov.descricao || '',
      categoriaId: '',
      fornecedorId: '',
      contaBancariaId,
      valor: mov.valor ?? '',
      desconto: '0',
      juros: '0',
      vencimento: toInputDate(mov.data),
    })
    setSaidaModalOpen(true)
  }

  function closeSaidaModal() {
    setSaidaModalOpen(false)
    setSaidaEditId(null)
    setSaidaForm(EMPTY_SAIDA_FORM)
  }

  async function handleSaidaSubmit(e) {
    e.preventDefault()
    if (!saidaForm.descricao.trim()) {
      toast.error('A descrição é obrigatória.')
      return
    }
    if (!saidaEditId && !saidaForm.categoriaId) {
      toast.error('A categoria é obrigatória.')
      return
    }
    if (saidaForm.valor === '' || Number(saidaForm.valor) <= 0) {
      toast.error('O valor deve ser maior que zero.')
      return
    }
    if (!saidaForm.vencimento) {
      toast.error('O vencimento é obrigatório.')
      return
    }

    const payload = {
      descricao: saidaForm.descricao.trim(),
      valor: Number(saidaForm.valor),
      desconto: Number(saidaForm.desconto || 0),
      juros: Number(saidaForm.juros || 0),
      vencimento: saidaForm.vencimento,
      fornecedorId: saidaForm.fornecedorId || undefined,
      contaBancariaId: saidaForm.contaBancariaId || undefined,
      ...(saidaForm.categoriaId ? { categoriaId: saidaForm.categoriaId } : {}),
    }

    setSavingSaida(true)
    try {
      if (saidaEditId) {
        await api.put(`/financeiro/contas-pagar/${saidaEditId}`, payload)
        toast.success('Saída atualizada com sucesso.')
      } else {
        await api.post('/financeiro/contas-pagar', payload)
        toast.success('Saída criada com sucesso.')
      }
      invalidateExtrato()
      closeSaidaModal()
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar saída.')
    } finally {
      setSavingSaida(false)
    }
  }

  async function handleExcluirSaida(item) {
    const confirmado = window.confirm(`Excluir a saída "${item.descricao}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      await api.delete(`/financeiro/contas-pagar/${item.id}`)
      toast.success('Saída excluída com sucesso.')
      invalidateExtrato()
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir saída.')
    }
  }

  async function handlePagar(item, conta) {
    const confirmado = window.confirm(`Marcar "${item.descricao}" como pago?`)
    if (!confirmado) return
    try {
      await api.post(`/financeiro/contas-pagar/${item.id}/pagar`, { contaBancariaId: conta?.id })
      toast.success('Marcado como pago.')
      invalidateExtrato()
    } catch (err) {
      toast.error(err?.message || 'Erro ao marcar como pago.')
    }
  }

  function openNovaTransferencia() {
    setTransferenciaForm({ ...EMPTY_TRANSFERENCIA_FORM, contaOrigemId: contaBancariaId })
    setTransferenciaModalOpen(true)
  }

  function closeTransferenciaModal() {
    setTransferenciaModalOpen(false)
    setTransferenciaForm(EMPTY_TRANSFERENCIA_FORM)
  }

  async function handleTransferenciaSubmit(e) {
    e.preventDefault()
    if (!transferenciaForm.contaOrigemId) {
      toast.error('A conta de origem é obrigatória.')
      return
    }
    if (!transferenciaForm.contaDestinoId) {
      toast.error('A conta de destino é obrigatória.')
      return
    }
    if (transferenciaForm.contaOrigemId === transferenciaForm.contaDestinoId) {
      toast.error('A conta de origem e destino não podem ser a mesma.')
      return
    }
    if (transferenciaForm.valor === '' || Number(transferenciaForm.valor) <= 0) {
      toast.error('O valor deve ser maior que zero.')
      return
    }

    const payload = {
      contaOrigemId: transferenciaForm.contaOrigemId,
      contaDestinoId: transferenciaForm.contaDestinoId,
      valor: Number(transferenciaForm.valor),
      data: transferenciaForm.data || undefined,
      descricao: transferenciaForm.descricao.trim() || undefined,
    }

    setSavingTransferencia(true)
    try {
      await api.post('/financeiro/transferencias', payload)
      toast.success('Transferência realizada com sucesso.')
      invalidateExtrato()
      closeTransferenciaModal()
    } catch (err) {
      toast.error(err?.message || 'Erro ao realizar transferência.')
    } finally {
      setSavingTransferencia(false)
    }
  }

  async function handleExcluirTransferencia(item) {
    const confirmado = window.confirm(`Excluir a transferência "${item.descricao}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      await api.delete(`/financeiro/transferencias/${item.id}`)
      toast.success('Transferência excluída com sucesso.')
      invalidateExtrato()
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir transferência.')
    }
  }

  function handleAction(action, item, conta) {
    if (action === 'receber') return handleReceber(item, conta)
    if (action === 'pagar') return handlePagar(item, conta)
    if (action === 'editar-entrada') return openEditarEntrada(item)
    if (action === 'excluir-entrada') return handleExcluirEntrada(item)
    if (action === 'editar-saida') return openEditarSaida(item)
    if (action === 'excluir-saida') return handleExcluirSaida(item)
    if (action === 'excluir-transferencia') return handleExcluirTransferencia(item)
  }

  function handleRegistrar(action) {
    if (action === 'entrada') return openNovaEntrada()
    if (action === 'saida') return openNovaSaida()
    if (action === 'transferencia') return openNovaTransferencia()
  }

  return (
    <div>
      <PageHeader
        title="Extrato"
        subtitle="Acompanhe as movimentações financeiras por conta e registre entradas, saídas e transferências manualmente"
      />

      <ResumoContas resumo={resumoContas} />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <RegistrarDropdown onSelect={handleRegistrar} />
        <Select
          containerClassName="w-full sm:w-64"
          label="Conta bancária"
          value={contaBancariaId}
          onChange={(e) => setContaBancariaId(e.target.value)}
        >
          <option value="">Todas as contas</option>
          {(contasBancarias || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Data inicial</label>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Data final</label>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : contas.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta bancária encontrada"
          description="Cadastre uma conta bancária para visualizar o extrato."
        />
      ) : (
        <div className="space-y-6">
          {contas.map((c) => (
            <ExtratoContaCard
              key={c.conta.id}
              conta={c.conta}
              saldoInicial={c.saldoInicial}
              movimentos={c.movimentos || []}
              pendencias={c.pendencias}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      <Modal
        open={entradaModalOpen}
        onClose={closeEntradaModal}
        title={entradaEditId ? 'Editar Entrada' : 'Nova Entrada'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeEntradaModal} disabled={savingEntrada}>
              Cancelar
            </Button>
            <Button onClick={handleEntradaSubmit} loading={savingEntrada}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleEntradaSubmit} className="space-y-4">
          <Input
            label="Descrição *"
            value={entradaForm.descricao}
            onChange={(e) => setEntradaForm((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descrição da entrada"
            required
          />

          <Select
            label={entradaEditId ? 'Categoria' : 'Categoria *'}
            value={entradaForm.categoriaId}
            onChange={(e) => setEntradaForm((prev) => ({ ...prev, categoriaId: e.target.value }))}
            required={!entradaEditId}
          >
            <option value="">Selecione...</option>
            {(categoriasReceita || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={entradaForm.valorBruto}
              onChange={(e) => setEntradaForm((prev) => ({ ...prev, valorBruto: e.target.value }))}
              required
            />
            <Input
              label="Data prevista *"
              type="date"
              value={entradaForm.dataPrevista}
              onChange={(e) => setEntradaForm((prev) => ({ ...prev, dataPrevista: e.target.value }))}
              required
            />
          </div>

          <Select
            label="Cliente"
            value={entradaForm.clienteId}
            onChange={(e) => setEntradaForm((prev) => ({ ...prev, clienteId: e.target.value }))}
          >
            <option value="">Sem cliente</option>
            {(clientes || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <Select
            label="Conta bancária"
            value={entradaForm.contaBancariaId}
            onChange={(e) => setEntradaForm((prev) => ({ ...prev, contaBancariaId: e.target.value }))}
          >
            <option value="">Sem conta definida</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={saidaModalOpen}
        onClose={closeSaidaModal}
        title={saidaEditId ? 'Editar Saída' : 'Nova Saída'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeSaidaModal} disabled={savingSaida}>
              Cancelar
            </Button>
            <Button onClick={handleSaidaSubmit} loading={savingSaida}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaidaSubmit} className="space-y-4">
          <Input
            label="Descrição *"
            value={saidaForm.descricao}
            onChange={(e) => setSaidaForm((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descrição da saída"
            required
          />

          <Select
            label={saidaEditId ? 'Categoria' : 'Categoria *'}
            value={saidaForm.categoriaId}
            onChange={(e) => setSaidaForm((prev) => ({ ...prev, categoriaId: e.target.value }))}
            required={!saidaEditId}
          >
            <option value="">Selecione...</option>
            {(categoriasDespesa || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={saidaForm.valor}
              onChange={(e) => setSaidaForm((prev) => ({ ...prev, valor: e.target.value }))}
              required
            />
            <Input
              label="Vencimento *"
              type="date"
              value={saidaForm.vencimento}
              onChange={(e) => setSaidaForm((prev) => ({ ...prev, vencimento: e.target.value }))}
              required
            />
          </div>

          <Select
            label="Fornecedor"
            value={saidaForm.fornecedorId}
            onChange={(e) => setSaidaForm((prev) => ({ ...prev, fornecedorId: e.target.value }))}
          >
            <option value="">Sem fornecedor</option>
            {(fornecedores || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>

          <Select
            label="Conta bancária"
            value={saidaForm.contaBancariaId}
            onChange={(e) => setSaidaForm((prev) => ({ ...prev, contaBancariaId: e.target.value }))}
          >
            <option value="">Sem conta definida</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={transferenciaModalOpen}
        onClose={closeTransferenciaModal}
        title="Nova Transferência"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeTransferenciaModal} disabled={savingTransferencia}>
              Cancelar
            </Button>
            <Button onClick={handleTransferenciaSubmit} loading={savingTransferencia}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleTransferenciaSubmit} className="space-y-4">
          <Select
            label="Conta de origem *"
            value={transferenciaForm.contaOrigemId}
            onChange={(e) => setTransferenciaForm((prev) => ({ ...prev, contaOrigemId: e.target.value }))}
            required
          >
            <option value="">Selecione...</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <Select
            label="Conta de destino *"
            value={transferenciaForm.contaDestinoId}
            onChange={(e) => setTransferenciaForm((prev) => ({ ...prev, contaDestinoId: e.target.value }))}
            required
          >
            <option value="">Selecione...</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={transferenciaForm.valor}
              onChange={(e) => setTransferenciaForm((prev) => ({ ...prev, valor: e.target.value }))}
              required
            />
            <Input
              label="Data"
              type="date"
              value={transferenciaForm.data}
              onChange={(e) => setTransferenciaForm((prev) => ({ ...prev, data: e.target.value }))}
            />
          </div>

          <Input
            label="Descrição"
            value={transferenciaForm.descricao}
            onChange={(e) => setTransferenciaForm((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Ex.: Reforço de caixa"
          />
        </form>
      </Modal>
    </div>
  )
}
