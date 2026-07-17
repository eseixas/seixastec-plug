import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
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
  Spinner,
} from '../../components/ui/index.js'

const ABAS = [
  { id: 'grupos', label: 'Grupos de Tributação' },
  { id: 'series', label: 'Séries de NF' },
  { id: 'naturezas', label: 'Naturezas de Operação' },
]

const MODELOS = [
  { value: '65', label: 'NFC-e (65)' },
  { value: '55', label: 'NF-e (55)' },
]

function modeloLabel(modelo) {
  return MODELOS.find((m) => m.value === modelo)?.label || modelo
}

// --- Grupos de Tributação ---
const EMPTY_GRUPO = { nome: '', origemMercadoria: '0', csosn: '102', cfop: '5102', ncm: '', cest: '', ativo: true }

function GruposTributacao() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_GRUPO)

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['grupos-tributacao'],
    queryFn: () => api.get('/fiscal-config/grupos-tributacao'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/fiscal-config/grupos-tributacao', payload),
    onSuccess: onSaved('Grupo criado com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao criar grupo.'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/fiscal-config/grupos-tributacao/${id}`, payload),
    onSuccess: onSaved('Grupo atualizado com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar grupo.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/fiscal-config/grupos-tributacao/${id}`),
    onSuccess: () => {
      toast.success('Grupo desativado.')
      queryClient.invalidateQueries({ queryKey: ['grupos-tributacao'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao desativar grupo.'),
  })

  function onSaved(msg) {
    return () => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['grupos-tributacao'] })
      closeModal()
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_GRUPO)
    setModalOpen(true)
  }
  function openEdit(g) {
    setEditing(g.id)
    setForm({
      nome: g.nome || '',
      origemMercadoria: g.origemMercadoria ?? '0',
      csosn: g.csosn || '102',
      cfop: g.cfop || '5102',
      ncm: g.ncm || '',
      cest: g.cest || '',
      ativo: g.ativo ?? true,
    })
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return toast.error('O nome é obrigatório.')
    const payload = {
      nome: form.nome.trim(),
      origemMercadoria: form.origemMercadoria,
      csosn: form.csosn,
      cfop: form.cfop,
      ncm: form.ncm || null,
      cest: form.cest || null,
      ativo: form.ativo,
    }
    if (editing) updateMutation.mutate({ id: editing, payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card
      title="Grupos de tributação"
      action={<Button icon={Plus} size="sm" onClick={openCreate}>Novo grupo</Button>}
    >
      {isLoading ? (
        <Spinner />
      ) : grupos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum grupo cadastrado.</p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Origem</Th>
              <Th>CSOSN</Th>
              <Th>CFOP</Th>
              <Th>NCM</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {grupos.map((g) => (
              <Tr key={g.id}>
                <Td className="font-medium text-gray-900">{g.nome}</Td>
                <Td>{g.origemMercadoria}</Td>
                <Td>{g.csosn}</Td>
                <Td>{g.cfop}</Td>
                <Td>{g.ncm || '-'}</Td>
                <Td>{g.ativo ? <Badge variant="green">Ativo</Badge> : <Badge variant="gray">Inativo</Badge>}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(g)} aria-label="Editar" />
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => window.confirm(`Desativar o grupo "${g.nome}"?`) && deleteMutation.mutate(g.id)} aria-label="Desativar" />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar grupo' : 'Novo grupo'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={isSaving}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome *" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Padrão Simples Nacional" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Origem da mercadoria" value={form.origemMercadoria} onChange={(e) => setForm((p) => ({ ...p, origemMercadoria: e.target.value }))} placeholder="0" />
            <Input label="CSOSN" value={form.csosn} onChange={(e) => setForm((p) => ({ ...p, csosn: e.target.value }))} placeholder="102" />
            <Input label="CFOP" value={form.cfop} onChange={(e) => setForm((p) => ({ ...p, cfop: e.target.value }))} placeholder="5102" />
            <Input label="NCM" value={form.ncm} onChange={(e) => setForm((p) => ({ ...p, ncm: e.target.value }))} />
            <Input label="CEST" value={form.cest} onChange={(e) => setForm((p) => ({ ...p, cest: e.target.value.replace(/\D/g, '') }))} maxLength={7} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Grupo ativo
          </label>
        </form>
      </Modal>
    </Card>
  )
}

// --- Séries de NF ---
const EMPTY_SERIE = { modelo: '65', serie: '', descricao: '', padrao: false, ativo: true }

function SeriesNf() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_SERIE)

  const { data: series = [], isLoading } = useQuery({
    queryKey: ['series-nf'],
    queryFn: () => api.get('/fiscal-config/series'),
  })

  function onSaved(msg) {
    return () => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['series-nf'] })
      closeModal()
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/fiscal-config/series', payload),
    onSuccess: onSaved('Série criada com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao criar série.'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/fiscal-config/series/${id}`, payload),
    onSuccess: onSaved('Série atualizada com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar série.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/fiscal-config/series/${id}`),
    onSuccess: () => {
      toast.success('Série desativada.')
      queryClient.invalidateQueries({ queryKey: ['series-nf'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao desativar série.'),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_SERIE)
    setModalOpen(true)
  }
  function openEdit(s) {
    setEditing(s.id)
    setForm({ modelo: s.modelo, serie: s.serie ?? '', descricao: s.descricao || '', padrao: s.padrao ?? false, ativo: s.ativo ?? true })
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (form.serie === '' || form.serie === null) return toast.error('O número da série é obrigatório.')
    const payload = {
      modelo: form.modelo,
      serie: Number(form.serie),
      descricao: form.descricao || null,
      padrao: form.padrao,
      ativo: form.ativo,
    }
    if (editing) updateMutation.mutate({ id: editing, payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card
      title="Séries de nota fiscal"
      action={<Button icon={Plus} size="sm" onClick={openCreate}>Nova série</Button>}
    >
      {isLoading ? (
        <Spinner />
      ) : series.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma série cadastrada.</p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Modelo</Th>
              <Th>Série</Th>
              <Th>Descrição</Th>
              <Th>Padrão</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {series.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium text-gray-900">{modeloLabel(s.modelo)}</Td>
                <Td>{s.serie}</Td>
                <Td>{s.descricao || '-'}</Td>
                <Td>{s.padrao ? <Badge variant="green">Padrão</Badge> : '-'}</Td>
                <Td>{s.ativo ? <Badge variant="green">Ativa</Badge> : <Badge variant="gray">Inativa</Badge>}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(s)} aria-label="Editar" />
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => window.confirm(`Desativar a série ${s.serie} (${modeloLabel(s.modelo)})?`) && deleteMutation.mutate(s.id)} aria-label="Desativar" />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar série' : 'Nova série'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={isSaving}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Modelo *" value={form.modelo} onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))}>
            {MODELOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Input label="Número da série *" type="number" min="0" value={form.serie} onChange={(e) => setForm((p) => ({ ...p, serie: e.target.value }))} required />
          <Input label="Descrição" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Caixa 01" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.padrao} onChange={(e) => setForm((p) => ({ ...p, padrao: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Série padrão do modelo (usada na emissão)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Série ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

// --- Naturezas de Operação ---
const EMPTY_NATUREZA = { descricao: '', cfop: '5102', padrao: false, ativo: true }

function NaturezasOperacao() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_NATUREZA)

  const { data: naturezas = [], isLoading } = useQuery({
    queryKey: ['naturezas-operacao'],
    queryFn: () => api.get('/fiscal-config/naturezas-operacao'),
  })

  function onSaved(msg) {
    return () => {
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] })
      closeModal()
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/fiscal-config/naturezas-operacao', payload),
    onSuccess: onSaved('Natureza criada com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao criar natureza.'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/fiscal-config/naturezas-operacao/${id}`, payload),
    onSuccess: onSaved('Natureza atualizada com sucesso.'),
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar natureza.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/fiscal-config/naturezas-operacao/${id}`),
    onSuccess: () => {
      toast.success('Natureza desativada.')
      queryClient.invalidateQueries({ queryKey: ['naturezas-operacao'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao desativar natureza.'),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_NATUREZA)
    setModalOpen(true)
  }
  function openEdit(n) {
    setEditing(n.id)
    setForm({ descricao: n.descricao || '', cfop: n.cfop || '', padrao: n.padrao ?? false, ativo: n.ativo ?? true })
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.descricao.trim()) return toast.error('A descrição é obrigatória.')
    if (!form.cfop.trim()) return toast.error('O CFOP é obrigatório.')
    const payload = { descricao: form.descricao.trim(), cfop: form.cfop.trim(), padrao: form.padrao, ativo: form.ativo }
    if (editing) updateMutation.mutate({ id: editing, payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Card
      title="Naturezas de operação"
      action={<Button icon={Plus} size="sm" onClick={openCreate}>Nova natureza</Button>}
    >
      {isLoading ? (
        <Spinner />
      ) : naturezas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma natureza cadastrada.</p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Descrição</Th>
              <Th>CFOP</Th>
              <Th>Padrão</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {naturezas.map((n) => (
              <Tr key={n.id}>
                <Td className="font-medium text-gray-900">{n.descricao}</Td>
                <Td>{n.cfop}</Td>
                <Td>{n.padrao ? <Badge variant="green">Padrão</Badge> : '-'}</Td>
                <Td>{n.ativo ? <Badge variant="green">Ativa</Badge> : <Badge variant="gray">Inativa</Badge>}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(n)} aria-label="Editar" />
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => window.confirm(`Desativar a natureza "${n.descricao}"?`) && deleteMutation.mutate(n.id)} aria-label="Desativar" />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar natureza' : 'Nova natureza'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={isSaving}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Descrição *" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Venda ao consumidor" required />
          <Input label="CFOP *" value={form.cfop} onChange={(e) => setForm((p) => ({ ...p, cfop: e.target.value }))} placeholder="5102" required />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.padrao} onChange={(e) => setForm((p) => ({ ...p, padrao: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Natureza padrão (usada no natOp da NF)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Natureza ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

export default function ConfiguracoesFiscais() {
  const [aba, setAba] = useState('grupos')

  return (
    <div>
      <PageHeader
        title="Configurações Fiscais"
        subtitle="Grupos de tributação reutilizáveis, séries de nota fiscal e naturezas de operação (Simples Nacional)"
      />

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === a.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'grupos' && <GruposTributacao />}
      {aba === 'series' && <SeriesNf />}
      {aba === 'naturezas' && <NaturezasOperacao />}
    </div>
  )
}
