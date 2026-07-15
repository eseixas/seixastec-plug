import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCcw, FileText, ExternalLink, QrCode, Ban, XCircle, Plus, Trash2, Download, FileArchive } from 'lucide-react'
import { api } from '../../lib/api.js'
import { downloadBlob } from '../../lib/download.js'
import { formatCurrency, formatDateTime } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Modal,
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

const STATUS_VARIANT = {
  PENDENTE: 'gray',
  ENVIADA: 'gray',
  AUTORIZADA: 'green',
  REJEITADA: 'red',
  CANCELADA: 'gray',
  INUTILIZADA: 'gray',
  ERRO: 'red',
}

const STATUS_LABEL = {
  PENDENTE: 'Pendente',
  ENVIADA: 'Enviada',
  AUTORIZADA: 'Autorizada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
  INUTILIZADA: 'Inutilizada',
  ERRO: 'Erro',
}

function DanfceModal({ notaId, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['danfce', notaId],
    queryFn: () => api.get(`/fiscal/notas/${notaId}/danfce`),
    enabled: Boolean(notaId),
  })

  return (
    <Modal open={Boolean(notaId)} onClose={onClose} title="DANFCE" size="sm" footer={<Button onClick={onClose}>Fechar</Button>}>
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-red-600">Não foi possível carregar a DANFCE desta nota.</p>
      ) : data ? (
        <div className="space-y-4 text-center">
          <img src={data.qrCodeDataUrl} alt="QR Code da NFC-e" className="mx-auto h-48 w-48" />
          <div className="space-y-1 text-left text-sm text-gray-700">
            <p><strong>Chave de acesso:</strong> <span className="break-all">{data.chaveAcesso}</span></p>
            <p><strong>Protocolo:</strong> {data.protocolo}</p>
            <p><strong>Loja:</strong> {data.loja?.nome}</p>
            <p><strong>Total:</strong> {formatCurrency(data.total)}</p>
            <p><strong>Autorizada em:</strong> {data.autorizadaEm ? formatDateTime(data.autorizadaEm) : '-'}</p>
          </div>
          <a
            href={data.qrCodeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Consultar na SEFAZ <ExternalLink size={14} />
          </a>
        </div>
      ) : null}
    </Modal>
  )
}

function CancelarModal({ nota, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [justificativa, setJustificativa] = useState('')

  const cancelarMutation = useMutation({
    mutationFn: () => api.post(`/fiscal/notas/${nota.id}/cancelar`, { justificativa }),
    onSuccess: () => {
      toast.success('NFC-e cancelada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      onClose()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao cancelar — cancelamento só funciona no edge da loja.'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (justificativa.trim().length < 15) {
      toast.error('A justificativa precisa ter pelo menos 15 caracteres.')
      return
    }
    cancelarMutation.mutate()
  }

  return (
    <Modal
      open={Boolean(nota)}
      onClose={onClose}
      title="Cancelar NFC-e"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancelarMutation.isPending}>
            Voltar
          </Button>
          <Button onClick={handleSubmit} loading={cancelarMutation.isPending} className="bg-red-600 hover:bg-red-700">
            Confirmar cancelamento
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Cancelar a série/número {nota?.serie}/{nota?.numero} é irreversível. A SEFAZ pode rejeitar
          o cancelamento se o prazo tiver passado.
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Justificativa (mín. 15 caracteres) *</label>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            placeholder="Ex: Venda cancelada a pedido do cliente"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </form>
    </Modal>
  )
}

const EMPTY_INUTILIZAR_FORM = { modelo: '65', serie: '1', numeroInicial: '', numeroFinal: '', justificativa: '' }

function InutilizarModal({ open, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_INUTILIZAR_FORM)

  const inutilizarMutation = useMutation({
    mutationFn: (payload) => api.post('/fiscal/inutilizar', payload),
    onSuccess: (data) => {
      toast.success(`Números inutilizados: ${data.numerosInutilizados.join(', ') || 'nenhum novo (já reservados)'}.`)
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      setForm(EMPTY_INUTILIZAR_FORM)
      onClose()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao inutilizar — só funciona no edge da loja.'),
  })

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (form.justificativa.trim().length < 15) {
      toast.error('A justificativa precisa ter pelo menos 15 caracteres.')
      return
    }
    inutilizarMutation.mutate({
      modelo: form.modelo,
      serie: Number(form.serie),
      numeroInicial: Number(form.numeroInicial),
      numeroFinal: Number(form.numeroFinal),
      justificativa: form.justificativa.trim(),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inutilizar numeração"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={inutilizarMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={inutilizarMutation.isPending}>
            Inutilizar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-500">
          Use quando um número foi pulado sem gerar nota (ex.: erro de sistema) — reserva a faixa
          na SEFAZ para nunca ser reutilizada.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Modelo" value={form.modelo} onChange={(e) => handleChange('modelo', e.target.value)}>
            <option value="65">NFC-e (65)</option>
            <option value="55">NF-e (55)</option>
          </Select>
          <input
            type="number"
            min="1"
            value={form.serie}
            onChange={(e) => handleChange('serie', e.target.value)}
            placeholder="Série"
            className="mt-6 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            min="1"
            value={form.numeroInicial}
            onChange={(e) => handleChange('numeroInicial', e.target.value)}
            placeholder="Número inicial"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            value={form.numeroFinal}
            onChange={(e) => handleChange('numeroFinal', e.target.value)}
            placeholder="Número final"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.justificativa}
          onChange={(e) => handleChange('justificativa', e.target.value)}
          rows={3}
          placeholder="Justificativa (mín. 15 caracteres)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </form>
    </Modal>
  )
}

function ExportarZipModal({ open, onClose }) {
  const toast = useToast()
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [exportando, setExportando] = useState(false)

  async function handleExportar() {
    if (!de || !ate) {
      toast.error('Informe a data inicial e a data final.')
      return
    }
    setExportando(true)
    try {
      const blob = await api.getBlob(`/fiscal/notas/exportar-zip?de=${de}&ate=${ate}`)
      downloadBlob(blob, `notas-fiscais-${de}_a_${ate}.zip`)
      toast.success('ZIP com os XMLs do período gerado com sucesso.')
      onClose()
    } catch (err) {
      toast.error(err?.message || 'Erro ao exportar XMLs do período.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar ZIP do período"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={exportando}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} loading={exportando}>
            Exportar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Gera um .zip com os XMLs (padrão nfeProc) de todas as notas autorizadas no período.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Data inicial *" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <Input label="Data final *" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

const EMPTY_ITEM = { nome: '', ncm: '', cfop: '5152', quantidade: '1', valorUnitario: '', unidade: 'UN' }
const EMPTY_NFE_FORM = {
  naturezaOperacao: 'Transferência entre lojas',
  destinatario: { cnpj: '', nome: '', ie: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' },
  itens: [{ ...EMPTY_ITEM }],
}

function NfeManualModal({ open, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_NFE_FORM)

  const emitirMutation = useMutation({
    mutationFn: (payload) => api.post('/fiscal/notas/nfe-manual', payload),
    onSuccess: () => {
      toast.success('NF-e enfileirada para emissão — acompanhe o status na lista.')
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
      setForm(EMPTY_NFE_FORM)
      onClose()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao emitir NF-e — só funciona no edge da loja.'),
  })

  function handleDestChange(field, value) {
    setForm((prev) => ({ ...prev, destinatario: { ...prev.destinatario, [field]: value } }))
  }

  function handleItemChange(idx, field, value) {
    setForm((prev) => ({
      ...prev,
      itens: prev.itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }))
  }

  function addItem() {
    setForm((prev) => ({ ...prev, itens: [...prev.itens, { ...EMPTY_ITEM }] }))
  }

  function removeItem(idx) {
    setForm((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.destinatario.cnpj && !form.destinatario.cpf) {
      toast.error('Informe o CNPJ ou CPF do destinatário.')
      return
    }
    if (form.itens.some((it) => !it.nome || !it.ncm || !it.cfop || !it.valorUnitario)) {
      toast.error('Preencha nome, NCM, CFOP e valor de todos os itens.')
      return
    }
    emitirMutation.mutate({
      naturezaOperacao: form.naturezaOperacao,
      destinatario: form.destinatario,
      itens: form.itens.map((it) => ({
        ...it,
        quantidade: Number(it.quantidade),
        valorUnitario: Number(it.valorUnitario),
      })),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Emitir NF-e manual"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={emitirMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={emitirMutation.isPending}>
            Emitir
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-gray-500">
          Use para operações sem venda no PDV: transferência entre lojas, devolução a fornecedor,
          venda B2B. A nota entra na mesma fila de emissão da NFC-e.
        </p>

        <Input
          label="Natureza da operação"
          value={form.naturezaOperacao}
          onChange={(e) => setForm((p) => ({ ...p, naturezaOperacao: e.target.value }))}
        />

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Destinatário</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CNPJ"
              value={form.destinatario.cnpj}
              onChange={(e) => handleDestChange('cnpj', e.target.value)}
              placeholder="Ou preencha CPF abaixo"
            />
            <Input
              label="CPF"
              value={form.destinatario.cpf || ''}
              onChange={(e) => handleDestChange('cpf', e.target.value)}
              placeholder="Se pessoa física"
            />
          </div>
          <Input
            containerClassName="mt-3"
            label="Nome / Razão social *"
            value={form.destinatario.nome}
            onChange={(e) => handleDestChange('nome', e.target.value)}
          />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Input label="IE" value={form.destinatario.ie} onChange={(e) => handleDestChange('ie', e.target.value)} placeholder="Se contribuinte" />
            <Input label="Cidade" value={form.destinatario.cidade} onChange={(e) => handleDestChange('cidade', e.target.value)} />
            <Input label="UF" value={form.destinatario.uf} onChange={(e) => handleDestChange('uf', e.target.value.toUpperCase())} maxLength={2} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Itens</p>
            <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addItem}>
              Adicionar item
            </Button>
          </div>
          <div className="space-y-3">
            {form.itens.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 grid grid-cols-2 gap-3">
                  <Input
                    label="Descrição *"
                    value={item.nome}
                    onChange={(e) => handleItemChange(idx, 'nome', e.target.value)}
                  />
                  <Input
                    label="NCM *"
                    value={item.ncm}
                    onChange={(e) => handleItemChange(idx, 'ncm', e.target.value)}
                    placeholder="Ex: 6109.10.00"
                  />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Input label="CFOP *" value={item.cfop} onChange={(e) => handleItemChange(idx, 'cfop', e.target.value)} />
                  <Input label="Qtd." type="number" min="0" value={item.quantidade} onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)} />
                  <Input label="Valor unit. *" type="number" min="0" step="0.01" value={item.valorUnitario} onChange={(e) => handleItemChange(idx, 'valorUnitario', e.target.value)} />
                  <div className="flex items-end">
                    {form.itens.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" icon={Trash2} className="text-red-600" onClick={() => removeItem(idx)} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function NotasFiscais() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [danfceId, setDanfceId] = useState(null)
  const [cancelandoNota, setCancelandoNota] = useState(null)
  const [inutilizarOpen, setInutilizarOpen] = useState(false)
  const [nfeManualOpen, setNfeManualOpen] = useState(false)
  const [exportarZipOpen, setExportarZipOpen] = useState(false)
  const [baixandoXmlId, setBaixandoXmlId] = useState(null)

  const { data: notas = [], isLoading, isError } = useQuery({
    queryKey: ['notas-fiscais', status],
    queryFn: () => api.get(`/fiscal/notas${status ? `?status=${status}` : ''}`),
  })

  const reenviarMutation = useMutation({
    mutationFn: (id) => api.post(`/fiscal/notas/${id}/reenviar`, {}),
    onSuccess: () => {
      toast.success('Nota marcada para reenvio.')
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao reenviar nota — reenvio só funciona no edge da loja.'),
  })

  async function handleBaixarXml(nota) {
    setBaixandoXmlId(nota.id)
    try {
      const blob = await api.getBlob(`/fiscal/notas/${nota.id}/xml`)
      downloadBlob(blob, `nota-${nota.serie}-${nota.numero}.xml`)
    } catch (err) {
      toast.error(err?.message || 'Erro ao baixar XML da nota.')
    } finally {
      setBaixandoXmlId(null)
    }
  }

  const hasNotas = notas.length > 0

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle="NFC-e/NF-e emitidas pelas lojas (edge) — status sincronizado com a central"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileArchive} onClick={() => setExportarZipOpen(true)}>
              Exportar ZIP do período
            </Button>
            <Button variant="secondary" icon={XCircle} onClick={() => setInutilizarOpen(true)}>
              Inutilizar numeração
            </Button>
            <Button icon={Plus} onClick={() => setNfeManualOpen(true)}>
              Emitir NF-e manual
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <Select
          containerClassName="w-56"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState icon={FileText} title="Erro ao carregar notas fiscais" description="Tente novamente." />
      ) : !hasNotas ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma nota fiscal encontrada"
          description="As NFC-e aparecem aqui conforme as vendas forem finalizadas nas lojas com emissão fiscal habilitada."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Modelo</Th>
              <Th>Série/Número</Th>
              <Th>Ambiente</Th>
              <Th>Status</Th>
              <Th>Protocolo</Th>
              <Th>Motivo (se rejeitada)</Th>
              <Th>Criada em</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {notas.map((nota) => (
              <Tr key={nota.id}>
                <Td>{nota.modelo === '65' ? 'NFC-e' : 'NF-e'}</Td>
                <Td>{nota.serie}/{nota.numero}</Td>
                <Td>
                  {nota.ambiente === 'homologacao' ? (
                    <Badge variant="amber">Homologação</Badge>
                  ) : (
                    <Badge variant="indigo">Produção</Badge>
                  )}
                </Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[nota.status] || 'gray'}>
                    {STATUS_LABEL[nota.status] || nota.status}
                  </Badge>
                </Td>
                <Td>{nota.protocolo || '-'}</Td>
                <Td className="max-w-xs truncate" title={nota.motivoRejeicao || ''}>
                  {nota.motivoRejeicao || '-'}
                </Td>
                <Td>{formatDateTime(nota.createdAt)}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    {nota.status === 'AUTORIZADA' && (
                      <>
                        {nota.modelo === '65' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={QrCode}
                            onClick={() => setDanfceId(nota.id)}
                            aria-label="Ver DANFCE"
                          >
                            DANFCE
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Ban}
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setCancelandoNota(nota)}
                          aria-label="Cancelar NFC-e"
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {nota.status === 'REJEITADA' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={RefreshCcw}
                        onClick={() => reenviarMutation.mutate(nota.id)}
                        loading={reenviarMutation.isPending && reenviarMutation.variables === nota.id}
                      >
                        Reenviar
                      </Button>
                    )}
                    {(nota.status === 'AUTORIZADA' || nota.status === 'CANCELADA') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Download}
                        onClick={() => handleBaixarXml(nota)}
                        loading={baixandoXmlId === nota.id}
                        aria-label="Baixar XML"
                      >
                        Baixar XML
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <DanfceModal notaId={danfceId} onClose={() => setDanfceId(null)} />
      <CancelarModal nota={cancelandoNota} onClose={() => setCancelandoNota(null)} />
      <InutilizarModal open={inutilizarOpen} onClose={() => setInutilizarOpen(false)} />
      <NfeManualModal open={nfeManualOpen} onClose={() => setNfeManualOpen(false)} />
      <ExportarZipModal open={exportarZipOpen} onClose={() => setExportarZipOpen(false)} />
    </div>
  )
}
