import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Monitor, KeyRound, RefreshCcw } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatDateTime } from '../../lib/format.js'
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
} from '../../components/ui/index.js'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

function TokenGeradoModal({ open, onClose, resultado }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Token de sincronização gerado"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {resultado && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Copie este token agora — ele <strong>não será exibido novamente</strong>.
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Loja</p>
            <p className="text-sm text-gray-900">{resultado.nome}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">EDGE_SYNC_TOKEN</p>
            <code className="block break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900">
              {resultado.token}
            </code>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">LOJA_ID</p>
            <code className="block break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900">
              {resultado.lojaId}
            </code>
          </div>
          <p className="text-xs text-gray-500">
            Configure essas variáveis no ambiente do edge desta loja: <code>EDGE_SYNC_TOKEN</code> com o token
            acima e <code>LOJA_ID</code> com o ID da loja.
          </p>
        </div>
      )}
    </Modal>
  )
}

function EdgesStatusCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tokenResultado, setTokenResultado] = useState(null)

  const { data: edges = [], isLoading } = useQuery({
    queryKey: ['lojas-edges'],
    queryFn: () => api.get('/lojas/edges'),
  })

  const gerarTokenMutation = useMutation({
    mutationFn: (lojaId) => api.post('/lojas/edges', { lojaId }),
    onSuccess: (data) => {
      toast.success('Token de sincronização gerado com sucesso.')
      setTokenResultado(data)
      queryClient.invalidateQueries({ queryKey: ['lojas-edges'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao gerar token de sincronização.'),
  })

  function handleGerarToken(edge) {
    const confirmado = window.confirm(
      `Gerar/regenerar o token de sincronização da loja "${edge.nome}"? O token atual (se existir) deixará de funcionar.`
    )
    if (!confirmado) return
    gerarTokenMutation.mutate(edge.lojaId)
  }

  function isOnline(ultimoPull) {
    if (!ultimoPull) return false
    const d = new Date(ultimoPull)
    if (isNaN(d.getTime())) return false
    return Date.now() - d.getTime() < ONLINE_THRESHOLD_MS
  }

  return (
    <Card title="Status das lojas (edges)" className="mb-6">
      {isLoading ? (
        <Spinner />
      ) : edges.length === 0 ? (
        <EmptyState
          icon={RefreshCcw}
          title="Nenhum edge configurado"
          description="Nenhuma loja possui status de sincronização disponível."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Loja</Th>
              <Th>Versão</Th>
              <Th>Último envio (push)</Th>
              <Th>Último recebimento (pull)</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {edges.map((edge) => (
              <Tr key={edge.lojaId}>
                <Td className="font-medium text-gray-900">{edge.nome}</Td>
                <Td>{edge.versao || '-'}</Td>
                <Td>{edge.ultimoPush ? formatDateTime(edge.ultimoPush) : 'nunca'}</Td>
                <Td>{edge.ultimoPull ? formatDateTime(edge.ultimoPull) : 'nunca'}</Td>
                <Td>
                  {isOnline(edge.ultimoPull) ? (
                    <Badge variant="green">Online recente</Badge>
                  ) : (
                    <Badge variant="gray">Offline</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={KeyRound}
                      onClick={() => handleGerarToken(edge)}
                      loading={gerarTokenMutation.isPending && gerarTokenMutation.variables === edge.lojaId}
                    >
                      Gerar token de sync
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <TokenGeradoModal
        open={Boolean(tokenResultado)}
        onClose={() => setTokenResultado(null)}
        resultado={tokenResultado}
      />
    </Card>
  )
}

const EMPTY_LOJA_FORM = {
  nome: '',
  cnpj: '',
  ie: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  matriz: false,
  crt: '',
  inscricaoMunicipal: '',
  codigoMunicipioIbge: '',
}

const OPCOES_CRT = [
  { value: '', label: 'Selecione...' },
  { value: '1', label: '1 — Simples Nacional' },
  { value: '2', label: '2 — Simples Nacional, excesso de sublimite' },
  { value: '3', label: '3 — Regime Normal' },
]

const EMPTY_TERMINAL_FORM = { nome: '', identificador: '' }

function TerminalModal({ open, onClose, lojaId, terminal, onSaved }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_TERMINAL_FORM)
  const isEdit = Boolean(terminal)

  useEffect(() => {
    if (!open) return
    setForm(
      terminal
        ? { nome: terminal.nome || '', identificador: terminal.identificador || '' }
        : EMPTY_TERMINAL_FORM
    )
  }, [open, terminal])

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/lojas/terminais', { ...payload, lojaId }),
    onSuccess: () => {
      toast.success('Terminal criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
      onSaved()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar terminal.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/lojas/terminais/${id}`, payload),
    onSuccess: () => {
      toast.success('Terminal atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
      onSaved()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar terminal.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome do terminal é obrigatório.')
      return
    }
    const payload = { nome: form.nome.trim(), identificador: form.identificador.trim() || undefined }
    if (isEdit) {
      updateMutation.mutate({ id: terminal.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar terminal' : 'Novo terminal'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={isSaving}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome *"
          value={form.nome}
          onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
          placeholder="Ex: Caixa 1"
          required
        />
        <Input
          label="Identificador"
          value={form.identificador}
          onChange={(e) => setForm((p) => ({ ...p, identificador: e.target.value }))}
          placeholder="Código/identificador do terminal"
        />
      </form>
    </Modal>
  )
}

function LojaCard({ loja, onEdit, onDelete }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [terminalModalOpen, setTerminalModalOpen] = useState(false)
  const [editingTerminal, setEditingTerminal] = useState(null)

  const deleteTerminalMutation = useMutation({
    mutationFn: (id) => api.delete(`/lojas/terminais/${id}`),
    onSuccess: () => {
      toast.success('Terminal excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir terminal.'),
  })

  function openNewTerminal() {
    setEditingTerminal(null)
    setTerminalModalOpen(true)
  }

  function openEditTerminal(terminal) {
    setEditingTerminal(terminal)
    setTerminalModalOpen(true)
  }

  function handleDeleteTerminal(terminal) {
    const confirmado = window.confirm(`Excluir o terminal "${terminal.nome}"?`)
    if (!confirmado) return
    deleteTerminalMutation.mutate(terminal.id)
  }

  const terminais = loja.terminais || []
  const enderecoLine = [loja.cidade, loja.uf].filter(Boolean).join(' / ')

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {loja.nome}
          {loja.matriz && <Badge variant="indigo">Matriz</Badge>}
          {loja.ativo ? (
            <Badge variant="green">Ativa</Badge>
          ) : (
            <Badge variant="gray">Inativa</Badge>
          )}
        </span>
      }
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={Plus} onClick={openNewTerminal}>
            Novo terminal
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={() => onEdit(loja)}
            aria-label="Editar loja"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-red-600 hover:bg-red-50"
            onClick={() => onDelete(loja)}
            aria-label="Excluir loja"
          />
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-500 sm:grid-cols-2">
        <p>CNPJ: {loja.cnpj || '-'}</p>
        <p>IE: {loja.ie || '-'}</p>
        <p>Cidade/UF: {enderecoLine || '-'}</p>
      </div>

      {terminais.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum terminal (PDV) cadastrado para esta loja.</p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Identificador</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {terminais.map((terminal) => (
              <Tr key={terminal.id}>
                <Td className="font-medium text-gray-900">{terminal.nome}</Td>
                <Td>{terminal.identificador || '-'}</Td>
                <Td>
                  {terminal.ativo ? (
                    <Badge variant="green">Ativo</Badge>
                  ) : (
                    <Badge variant="gray">Inativo</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      onClick={() => openEditTerminal(terminal)}
                      aria-label="Editar terminal"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteTerminal(terminal)}
                      aria-label="Excluir terminal"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <TerminalModal
        open={terminalModalOpen}
        onClose={() => setTerminalModalOpen(false)}
        lojaId={loja.id}
        terminal={editingTerminal}
        onSaved={() => setTerminalModalOpen(false)}
      />
    </Card>
  )
}

export default function Lojas() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_LOJA_FORM)

  const {
    data: lojas = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => api.get('/lojas'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/lojas', payload),
    onSuccess: () => {
      toast.success('Loja criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar loja.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/lojas/${id}`, payload),
    onSuccess: () => {
      toast.success('Loja atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar loja.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/lojas/${id}`),
    onSuccess: () => {
      toast.success('Loja excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['lojas'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir loja.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_LOJA_FORM)
    setModalOpen(true)
  }

  function openEditModal(loja) {
    setEditingId(loja.id)
    setForm({
      nome: loja.nome || '',
      cnpj: loja.cnpj || '',
      ie: loja.ie || '',
      cep: loja.cep || '',
      logradouro: loja.logradouro || '',
      numero: loja.numero || '',
      bairro: loja.bairro || '',
      cidade: loja.cidade || '',
      uf: loja.uf || '',
      matriz: loja.matriz ?? false,
      crt: loja.crt ? String(loja.crt) : '',
      inscricaoMunicipal: loja.inscricaoMunicipal || '',
      codigoMunicipioIbge: loja.codigoMunicipioIbge || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_LOJA_FORM)
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim(),
      ie: form.ie.trim(),
      cep: form.cep.trim(),
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim().toUpperCase(),
      matriz: form.matriz,
      crt: form.crt ? Number(form.crt) : null,
      inscricaoMunicipal: form.inscricaoMunicipal.trim(),
      codigoMunicipioIbge: form.codigoMunicipioIbge.trim(),
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(loja) {
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir a loja "${loja.nome}"? Os terminais associados também serão removidos.`
    )
    if (!confirmado) return
    deleteMutation.mutate(loja.id)
  }

  const hasLojas = lojas.length > 0

  return (
    <div>
      <PageHeader
        title="Lojas & PDVs"
        subtitle="Gerencie as lojas e os terminais (PDVs) de cada unidade"
        action={
          <Button icon={Plus} onClick={openCreateModal}>
            Nova loja
          </Button>
        }
      />

      <EdgesStatusCard />

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Building2}
          title="Erro ao carregar lojas"
          description="Não foi possível carregar a lista de lojas. Tente novamente."
        />
      ) : !hasLojas ? (
        <EmptyState
          icon={Monitor}
          title="Nenhuma loja cadastrada"
          description="Cadastre sua primeira loja para começar a gerenciar os terminais."
          action={
            <Button icon={Plus} onClick={openCreateModal}>
              Nova loja
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {lojas.map((loja) => (
            <LojaCard key={loja.id} loja={loja} onEdit={openEditModal} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar loja' : 'Nova loja'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={isSaving}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome *"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="Nome da loja"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="CNPJ"
              value={form.cnpj}
              onChange={(e) => handleChange('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <Input
              label="Inscrição Estadual"
              value={form.ie}
              onChange={(e) => handleChange('ie', e.target.value)}
              placeholder="IE"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="CEP"
              value={form.cep}
              onChange={(e) => handleChange('cep', e.target.value)}
              placeholder="00000-000"
            />
            <Input
              containerClassName="col-span-2"
              label="Logradouro"
              value={form.logradouro}
              onChange={(e) => handleChange('logradouro', e.target.value)}
              placeholder="Rua, avenida..."
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Input
              label="Número"
              value={form.numero}
              onChange={(e) => handleChange('numero', e.target.value)}
            />
            <Input
              containerClassName="col-span-2"
              label="Bairro"
              value={form.bairro}
              onChange={(e) => handleChange('bairro', e.target.value)}
            />
            <Input
              label="UF"
              value={form.uf}
              onChange={(e) => handleChange('uf', e.target.value.toUpperCase())}
              maxLength={2}
              className="uppercase"
            />
          </div>

          <Input
            label="Cidade"
            value={form.cidade}
            onChange={(e) => handleChange('cidade', e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.matriz}
              onChange={(e) => handleChange('matriz', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Esta loja é a matriz
          </label>

          <div className="border-t border-gray-200 pt-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Dados fiscais (obrigatórios para emitir NFC-e/NF-e nesta loja)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Regime tributário (CRT)"
                value={form.crt}
                onChange={(e) => handleChange('crt', e.target.value)}
              >
                {OPCOES_CRT.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Código IBGE do município"
                value={form.codigoMunicipioIbge}
                onChange={(e) => handleChange('codigoMunicipioIbge', e.target.value)}
                placeholder="Ex: 3305109"
              />
            </div>
            <Input
              containerClassName="mt-4"
              label="Inscrição municipal"
              value={form.inscricaoMunicipal}
              onChange={(e) => handleChange('inscricaoMunicipal', e.target.value)}
              placeholder="Opcional"
            />
            <p className="mt-2 text-xs text-gray-500">
              Não sabe o código IBGE do município? Consulte em{' '}
              <a
                href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                ibge.gov.br
              </a>
              .
            </p>
          </div>
        </form>
      </Modal>
    </div>
  )
}
