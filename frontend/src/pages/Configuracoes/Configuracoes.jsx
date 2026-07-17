import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Tag,
  Tags,
  KeyRound,
  Copy,
  Power,
  Info,
  Ruler,
  Palette,
  Landmark,
  ImageIcon,
  ShieldCheck,
  Upload,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react'
import { api, uploadFile, uploadWithFields, fotoSrc } from '../../lib/api.js'
import { formatDateTime } from '../../lib/format.js'
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
import { useToast } from '../../context/ToastContext.jsx'

const ORIGENS_MERCADORIA = [
  { value: '0', label: '0 — Nacional (exceto 3 a 5)' },
  { value: '1', label: '1 — Estrangeira - Importação direta' },
  { value: '2', label: '2 — Estrangeira - Adquirida no mercado interno' },
  {
    value: '3',
    label: '3 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 40%',
  },
  {
    value: '4',
    label: '4 — Nacional - Produção em conformidade com processos produtivos básicos',
  },
  {
    value: '5',
    label: '5 — Nacional - Mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%',
  },
  { value: '6', label: '6 — Estrangeira - Importação direta, sem similar nacional' },
  { value: '7', label: '7 — Estrangeira - Adquirida no mercado interno, sem similar nacional' },
  {
    value: '8',
    label: '8 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 70%',
  },
]

const OPCOES_CSOSN = [
  { value: '101', label: '101 — Tributada com permissão de crédito' },
  { value: '102', label: '102 — Tributada sem permissão de crédito' },
  { value: '103', label: '103 — Isenção do ICMS para faixa de receita bruta' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada' },
  { value: '500', label: '500 — ICMS cobrado anteriormente por substituição tributária' },
  { value: '900', label: '900 — Outros' },
]

const EMPTY_FISCAL_FORM = {
  origemMercadoria: '0',
  csosn: '101',
  cfop: '',
  ncmPadrao: '',
  cest: '',
  ambiente: 'homologacao',
  serieNfce: '1',
  serieNfe: '1',
}

const EMPTY_ESCALA_FORM = {
  nome: '',
  tamanhos: '',
  ordem: '',
  ativo: true,
}

const EMPTY_COR_FORM = {
  nome: '',
  hex: '#000000',
  ordem: '',
  ativo: true,
}

const EMPTY_CATEGORIA_FORM = {
  nome: '',
  descricao: '',
  ativo: true,
}

const EMPTY_MARCA_FORM = {
  nome: '',
  ativo: true,
}

const EMPTY_PDV_FORM = {
  exigirGerenteCancelamento: false,
  exigirGerenteDesconto: false,
  descontoHabilitado: true,
  descontoMaximoPercentual: '',
  bloquearVendaSemEstoque: false,
  exigirAprovacaoFechamento: false,
}

const CAMPOS_CLIENTE = [
  { value: 'cpfCnpj', label: 'CPF/CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'endereco', label: 'Endereço (CEP, logradouro, número, cidade, UF)' },
]

const EMPTY_CLIENTE_CFG_FORM = {
  camposObrigatoriosPF: [],
  camposObrigatoriosPJ: [],
  aplicarNoPdv: true,
}

function CategoriasPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_CATEGORIA_FORM)

  const {
    data: categorias = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['categorias', search],
    queryFn: () =>
      api.get(`/categorias${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/categorias', payload),
    onSuccess: () => {
      toast.success('Categoria criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao criar categoria.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/categorias/${id}`, payload),
    onSuccess: () => {
      toast.success('Categoria atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar categoria.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/categorias/${id}`),
    onSuccess: () => {
      toast.success('Categoria excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao excluir categoria.')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_CATEGORIA_FORM)
    setModalOpen(true)
  }

  function openEditModal(categoria) {
    setEditingId(categoria.id)
    setForm({
      nome: categoria.nome || '',
      descricao: categoria.descricao || '',
      ativo: categoria.ativo ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_CATEGORIA_FORM)
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
      descricao: form.descricao.trim(),
      ativo: form.ativo,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(categoria) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a categoria "${categoria.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(categoria.id)
  }

  const hasCategorias = categorias.length > 0

  return (
    <Card
      title="Categorias"
      action={
        <Button icon={Plus} size="sm" onClick={openCreateModal}>
          Nova categoria
        </Button>
      }
    >
      <div className="mb-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Buscar categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Tags}
          title="Erro ao carregar categorias"
          description="Não foi possível carregar a lista de categorias. Tente novamente."
        />
      ) : !hasCategorias ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria encontrada"
          description={
            search
              ? 'Nenhuma categoria corresponde à sua busca.'
              : 'Cadastre sua primeira categoria para começar.'
          }
          action={
            !search && (
              <Button icon={Plus} onClick={openCreateModal}>
                Nova categoria
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Descrição</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {categorias.map((categoria) => (
              <Tr key={categoria.id}>
                <Td className="font-medium text-gray-900">{categoria.nome}</Td>
                <Td>{categoria.descricao || '-'}</Td>
                <Td>
                  {categoria.ativo ? (
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
                      onClick={() => openEditModal(categoria)}
                      aria-label="Editar categoria"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(categoria)}
                      aria-label="Excluir categoria"
                    >
                      Excluir
                    </Button>
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
        title={editingId ? 'Editar categoria' : 'Nova categoria'}
        size="md"
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
            placeholder="Nome da categoria"
            required
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descrição
            </label>
            <textarea
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              rows={3}
              placeholder="Descrição da categoria"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Categoria ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

function MarcasPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_MARCA_FORM)

  const {
    data: marcas = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['marcas', search],
    queryFn: () =>
      api.get(`/marcas${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/marcas', payload),
    onSuccess: () => {
      toast.success('Marca criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['marcas'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao criar marca.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/marcas/${id}`, payload),
    onSuccess: () => {
      toast.success('Marca atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['marcas'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar marca.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/marcas/${id}`),
    onSuccess: () => {
      toast.success('Marca excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['marcas'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao excluir marca.')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_MARCA_FORM)
    setModalOpen(true)
  }

  function openEditModal(marca) {
    setEditingId(marca.id)
    setForm({
      nome: marca.nome || '',
      ativo: marca.ativo ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_MARCA_FORM)
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
      ativo: form.ativo,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(marca) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a marca "${marca.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(marca.id)
  }

  const hasMarcas = marcas.length > 0

  return (
    <Card
      title="Marcas"
      action={
        <Button icon={Plus} size="sm" onClick={openCreateModal}>
          Nova marca
        </Button>
      }
    >
      <div className="mb-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Buscar marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Tag}
          title="Erro ao carregar marcas"
          description="Não foi possível carregar a lista de marcas. Tente novamente."
        />
      ) : !hasMarcas ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma marca encontrada"
          description={
            search
              ? 'Nenhuma marca corresponde à sua busca.'
              : 'Cadastre sua primeira marca para começar.'
          }
          action={
            !search && (
              <Button icon={Plus} onClick={openCreateModal}>
                Nova marca
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {marcas.map((marca) => (
              <Tr key={marca.id}>
                <Td className="font-medium text-gray-900">{marca.nome}</Td>
                <Td>
                  {marca.ativo ? (
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
                      onClick={() => openEditModal(marca)}
                      aria-label="Editar marca"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(marca)}
                      aria-label="Excluir marca"
                    >
                      Excluir
                    </Button>
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
        title={editingId ? 'Editar marca' : 'Nova marca'}
        size="sm"
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
            placeholder="Nome da marca"
            required
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Marca ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

function ApiKeysPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [novaChave, setNovaChave] = useState(null)

  const {
    data: apikeys = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['apikeys'],
    queryFn: () => api.get('/apikeys'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/apikeys', payload),
    onSuccess: (data) => {
      toast.success('Chave de API criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['apikeys'] })
      setModalOpen(false)
      setNome('')
      setNovaChave(data)
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar chave de API.'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => api.put(`/apikeys/${id}`, { ativo }),
    onSuccess: () => {
      toast.success('Chave de API atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['apikeys'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar chave de API.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/apikeys/${id}`),
    onSuccess: () => {
      toast.success('Chave de API excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['apikeys'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir chave de API.'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }
    createMutation.mutate({ nome: nome.trim() })
  }

  function handleToggle(key) {
    toggleMutation.mutate({ id: key.id, ativo: !key.ativo })
  }

  function handleDelete(key) {
    const confirmado = window.confirm(`Tem certeza que deseja excluir a chave "${key.nome}"?`)
    if (!confirmado) return
    deleteMutation.mutate(key.id)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(novaChave?.chave || '')
      toast.success('Chave copiada para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar a chave. Copie manualmente.')
    }
  }

  const hasKeys = apikeys.length > 0

  return (
    <Card
      title="Chaves de API"
      action={
        <Button icon={Plus} size="sm" onClick={() => setModalOpen(true)}>
          Nova chave
        </Button>
      }
    >
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          Use as chaves de API para permitir acesso externo à API. Envie a chave no header{' '}
          <code className="rounded bg-indigo-100 px-1 py-0.5">x-api-key</code> nas requisições.
        </p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={KeyRound}
          title="Erro ao carregar chaves"
          description="Não foi possível carregar as chaves de API. Tente novamente."
        />
      ) : !hasKeys ? (
        <EmptyState
          icon={KeyRound}
          title="Nenhuma chave de API cadastrada"
          description="Crie uma chave para permitir acesso externo à API."
          action={
            <Button icon={Plus} onClick={() => setModalOpen(true)}>
              Nova chave
            </Button>
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Prefixo</Th>
              <Th>Criado por</Th>
              <Th>Último uso</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {apikeys.map((key) => (
              <Tr key={key.id}>
                <Td className="font-medium text-gray-900">{key.nome}</Td>
                <Td>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{key.prefixo}...</code>
                </Td>
                <Td>{key.usuario?.nome || '-'}</Td>
                <Td>{key.ultimoUso ? formatDateTime(key.ultimoUso) : 'Nunca'}</Td>
                <Td>
                  {key.ativo ? (
                    <Badge variant="green">Ativa</Badge>
                  ) : (
                    <Badge variant="gray">Inativa</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Power}
                      onClick={() => handleToggle(key)}
                      aria-label={key.ativo ? 'Desativar chave' : 'Ativar chave'}
                    >
                      {key.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(key)}
                      aria-label="Excluir chave"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova chave de API"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending}>
              Criar chave
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Integração e-commerce"
            required
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(novaChave)}
        onClose={() => setNovaChave(null)}
        title="Chave de API criada"
        size="md"
        footer={
          <Button onClick={() => setNovaChave(null)}>Concluído</Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Copie esta chave agora — ela não será mostrada novamente por motivos de segurança.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              {novaChave?.chave}
            </code>
            <Button variant="secondary" icon={Copy} onClick={handleCopy} aria-label="Copiar chave" />
          </div>
        </div>
      </Modal>
    </Card>
  )
}

function EmpresaLogoPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa'],
    queryFn: () => api.get('/empresa'),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadWithFields('/empresa/logo', 'logo', file, {}, { method: 'PUT' }),
    onSuccess: () => {
      toast.success('Logotipo atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao enviar o logotipo.'),
  })

  const removeMutation = useMutation({
    mutationFn: () => api.delete('/empresa/logo'),
    onSuccess: () => {
      toast.success('Logotipo removido.')
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao remover o logotipo.'),
  })

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <Card
      title="Logotipo"
      action={
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            icon={Upload}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
          >
            {empresa?.logoUrl ? 'Trocar logotipo' : 'Enviar logotipo'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        O logotipo aparece em documentos e telas do sistema (ex.: etiquetas e comprovantes).
      </p>
      {isLoading ? (
        <Spinner />
      ) : empresa?.logoUrl ? (
        <div className="flex items-center gap-4">
          <img
            src={fotoSrc(empresa.logoUrl)}
            alt="Logotipo da empresa"
            className="h-24 w-24 rounded-lg border border-gray-200 bg-white object-contain p-1"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-red-600 hover:bg-red-50"
            onClick={() => removeMutation.mutate()}
            loading={removeMutation.isPending}
          >
            Remover
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum logotipo enviado"
          description="Envie uma imagem (PNG/JPG) com o logotipo da empresa."
        />
      )}
    </Card>
  )
}

function EmpresaCertificadoPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [arquivo, setArquivo] = useState(null)
  const [senha, setSenha] = useState('')

  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa'],
    queryFn: () => api.get('/empresa'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, senha }) =>
      uploadWithFields('/empresa/certificado', 'certificado', file, senha ? { senha } : {}, { method: 'PUT' }),
    onSuccess: () => {
      toast.success('Certificado digital salvo com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
      setArquivo(null)
      setSenha('')
    },
    onError: (err) => toast.error(err?.message || 'Erro ao enviar o certificado.'),
  })

  const senhaMutation = useMutation({
    mutationFn: (senha) => api.put('/empresa/certificado/senha', { senha }),
    onSuccess: () => {
      toast.success('Senha do certificado atualizada.')
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
      setSenha('')
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar a senha.'),
  })

  const removeMutation = useMutation({
    mutationFn: () => api.delete('/empresa/certificado'),
    onSuccess: () => {
      toast.success('Certificado removido.')
      queryClient.invalidateQueries({ queryKey: ['empresa'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao remover o certificado.'),
  })

  function handleSalvar() {
    if (arquivo) {
      uploadMutation.mutate({ file: arquivo, senha: senha.trim() || undefined })
    } else if (senha.trim()) {
      if (!empresa?.temCertificado) {
        toast.error('Envie o arquivo do certificado (.pfx/.p12) junto com a senha.')
        return
      }
      senhaMutation.mutate(senha.trim())
    } else {
      toast.error('Selecione o arquivo .pfx/.p12 e informe a senha.')
    }
  }

  const isSaving = uploadMutation.isPending || senhaMutation.isPending

  return (
    <Card title="Certificado Digital A1">
      <p className="mb-4 text-xs text-gray-500">
        O certificado A1 (.pfx/.p12) é usado na emissão de NFC-e/NF-e e desce automaticamente
        para o servidor da loja pela sincronização. A senha é armazenada criptografada e usada
        apenas na emissão de notas fiscais — ela nunca é exibida novamente.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {empresa?.temCertificado ? (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>
                  Certificado enviado: <strong>{empresa.certificadoNome || 'certificado.pfx'}</strong>
                  {empresa.certificadoValidade && (
                    <> — válido até <strong>{formatDateTime(empresa.certificadoValidade)}</strong></>
                  )}
                </span>
              </div>
              {!empresa.temSenha && (
                <p className="mt-1 text-xs text-amber-700">
                  A senha ainda não foi informada — informe abaixo para habilitar a emissão.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              Nenhum certificado enviado.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Arquivo do certificado (.pfx/.p12)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            <Input
              label="Senha do certificado"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={empresa?.temSenha ? 'Senha já cadastrada (preencha para trocar)' : 'Senha do .pfx'}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSalvar} loading={isSaving}>
              Salvar
            </Button>
            {empresa?.temCertificado && (
              <Button
                variant="ghost"
                icon={Trash2}
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (window.confirm('Remover o certificado digital? A emissão de notas ficará indisponível.')) {
                    removeMutation.mutate()
                  }
                }}
                loading={removeMutation.isPending}
              >
                Remover certificado
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function CertificadoFiscalPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['certificado-fiscal-status'],
    queryFn: () => api.get('/fiscal/certificado/status'),
    retry: false,
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadFile('/fiscal/certificado', 'certificado', file),
    onSuccess: (data) => {
      toast.success(`Certificado carregado — válido até ${formatDateTime(data.validade)}.`)
      queryClient.invalidateQueries({ queryKey: ['certificado-fiscal-status'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao enviar o certificado.'),
  })

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <Card
      title="Certificado digital (A1)"
      action={
        <>
          <input ref={fileInputRef} type="file" accept=".pfx,.p12" className="hidden" onChange={handleFileChange} />
          <Button
            icon={KeyRound}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
          >
            Enviar certificado (.pfx)
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        O certificado A1 assina as NFC-e/NF-e enviadas à SEFAZ. Só o arquivo é enviado por aqui —
        a senha, CSC e idCSC continuam configurados no <code>.env.edge</code> do servidor da loja
        (trocar esses exige reiniciar o container do edge).
      </p>
      {isLoading ? (
        <Spinner />
      ) : data?.ok ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Certificado válido até <strong>{formatDateTime(data.validade)}</strong>.
        </div>
      ) : (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {data?.erro || 'Nenhum certificado configurado, ou esta tela está apontando para a central (o certificado só existe no edge da loja).'}
        </div>
      )}
    </Card>
  )
}

function ConfiguracoesFiscaisPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_FISCAL_FORM)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['config-fiscal'],
    queryFn: () => api.get('/config/fiscal'),
  })

  useEffect(() => {
    if (data) {
      setForm({
        origemMercadoria: data.origemMercadoria ?? '0',
        csosn: data.csosn ?? '101',
        cfop: data.cfop ?? '',
        ncmPadrao: data.ncmPadrao ?? '',
        cest: data.cest ?? '',
        ambiente: data.ambiente ?? 'homologacao',
        serieNfce: String(data.serieNfce ?? 1),
        serieNfe: String(data.serieNfe ?? 1),
      })
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/config/fiscal', payload),
    onSuccess: () => {
      toast.success('Configurações fiscais atualizadas com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['config-fiscal'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao salvar configurações fiscais.')
    },
  })

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      origemMercadoria: form.origemMercadoria,
      csosn: form.csosn,
      cfop: form.cfop.trim(),
      ncmPadrao: form.ncmPadrao.trim(),
      cest: form.cest.trim(),
      ambiente: form.ambiente,
      serieNfce: Number(form.serieNfce) || 1,
      serieNfe: Number(form.serieNfe) || 1,
    }
    updateMutation.mutate(payload)
  }

  return (
    <Card
      title="Configurações Fiscais"
      action={
        <Button onClick={handleSubmit} loading={updateMutation.isPending}>
          Salvar
        </Button>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        Esses valores são usados para pré-preencher os campos fiscais ao cadastrar um novo
        produto, e para configurar a emissão de NFC-e/NF-e.
      </p>

      {form.ambiente === 'homologacao' && !isLoading && !isError && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Ambiente de <strong>homologação</strong> — as notas emitidas são só de teste, sem
          valor fiscal. Troque para produção somente depois de validar a emissão.
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Landmark}
          title="Erro ao carregar configurações fiscais"
          description="Não foi possível carregar as configurações fiscais. Tente novamente."
        />
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Origem da mercadoria"
            value={form.origemMercadoria}
            onChange={(e) => handleChange('origemMercadoria', e.target.value)}
          >
            {ORIGENS_MERCADORIA.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            label="CSOSN"
            value={form.csosn}
            onChange={(e) => handleChange('csosn', e.target.value)}
          >
            {OPCOES_CSOSN.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Input
            label="CFOP padrão"
            value={form.cfop}
            onChange={(e) => handleChange('cfop', e.target.value)}
            placeholder="Ex: 5102"
          />

          <Input
            label="NCM padrão"
            value={form.ncmPadrao}
            onChange={(e) => handleChange('ncmPadrao', e.target.value)}
            placeholder="Ex: 6109.10.00"
          />

          <Input
            label="CEST"
            value={form.cest}
            onChange={(e) => handleChange('cest', e.target.value)}
            placeholder="Opcional"
          />

          <Select
            label="Ambiente de emissão (NFC-e/NF-e)"
            value={form.ambiente}
            onChange={(e) => handleChange('ambiente', e.target.value)}
          >
            <option value="homologacao">Homologação (testes)</option>
            <option value="producao">Produção</option>
          </Select>

          <div />

          <Input
            label="Série NFC-e"
            type="number"
            min="1"
            value={form.serieNfce}
            onChange={(e) => handleChange('serieNfce', e.target.value)}
          />

          <Input
            label="Série NF-e"
            type="number"
            min="1"
            value={form.serieNfe}
            onChange={(e) => handleChange('serieNfe', e.target.value)}
          />
        </form>
      )}
    </Card>
  )
}

function EscalasPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_ESCALA_FORM)

  const {
    data: escalas = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['escalas'],
    queryFn: () => api.get('/escalas'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/escalas', payload),
    onSuccess: () => {
      toast.success('Escala criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao criar escala.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/escalas/${id}`, payload),
    onSuccess: () => {
      toast.success('Escala atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar escala.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/escalas/${id}`),
    onSuccess: () => {
      toast.success('Escala excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao excluir escala.')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_ESCALA_FORM)
    setModalOpen(true)
  }

  function openEditModal(escala) {
    setEditingId(escala.id)
    setForm({
      nome: escala.nome || '',
      tamanhos: Array.isArray(escala.tamanhos) ? escala.tamanhos.join(', ') : '',
      ordem: escala.ordem ?? '',
      ativo: escala.ativo ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_ESCALA_FORM)
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

    const tamanhos = form.tamanhos
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const payload = {
      nome: form.nome.trim(),
      tamanhos,
      ativo: form.ativo,
    }
    if (form.ordem !== '') {
      payload.ordem = Number(form.ordem)
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(escala) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a escala "${escala.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(escala.id)
  }

  const hasEscalas = escalas.length > 0

  return (
    <Card
      title="Escalas de Tamanho"
      action={
        <Button icon={Plus} size="sm" onClick={openCreateModal}>
          Nova escala
        </Button>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Ruler}
          title="Erro ao carregar escalas"
          description="Não foi possível carregar a lista de escalas. Tente novamente."
        />
      ) : !hasEscalas ? (
        <EmptyState
          icon={Ruler}
          title="Nenhuma escala encontrada"
          description="Cadastre sua primeira escala de tamanho para começar."
          action={
            <Button icon={Plus} onClick={openCreateModal}>
              Nova escala
            </Button>
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Tamanhos</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {escalas.map((escala) => (
              <Tr key={escala.id}>
                <Td className="font-medium text-gray-900">{escala.nome}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {(escala.tamanhos || []).map((tamanho) => (
                      <Badge key={tamanho} variant="indigo">
                        {tamanho}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  {escala.ativo ? (
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
                      onClick={() => openEditModal(escala)}
                      aria-label="Editar escala"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(escala)}
                      aria-label="Excluir escala"
                    >
                      Excluir
                    </Button>
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
        title={editingId ? 'Editar escala' : 'Nova escala'}
        size="md"
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
            placeholder="Nome da escala"
            required
          />

          <Input
            label="Tamanhos"
            value={form.tamanhos}
            onChange={(e) => handleChange('tamanhos', e.target.value)}
            placeholder="Ex: P, M, G, GG"
          />

          <Input
            label="Ordem"
            type="number"
            value={form.ordem}
            onChange={(e) => handleChange('ordem', e.target.value)}
            placeholder="Opcional"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Escala ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

function CoresPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_COR_FORM)

  const {
    data: cores = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['cores'],
    queryFn: () => api.get('/cores'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/cores', payload),
    onSuccess: () => {
      toast.success('Cor criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['cores'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao criar cor.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/cores/${id}`, payload),
    onSuccess: () => {
      toast.success('Cor atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['cores'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar cor.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/cores/${id}`),
    onSuccess: () => {
      toast.success('Cor excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['cores'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao excluir cor.')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_COR_FORM)
    setModalOpen(true)
  }

  function openEditModal(cor) {
    setEditingId(cor.id)
    setForm({
      nome: cor.nome || '',
      hex: cor.hex || '#000000',
      ordem: cor.ordem ?? '',
      ativo: cor.ativo ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_COR_FORM)
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
      hex: form.hex,
      ativo: form.ativo,
    }
    if (form.ordem !== '') {
      payload.ordem = Number(form.ordem)
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(cor) {
    const confirmed = window.confirm(`Tem certeza que deseja excluir a cor "${cor.nome}"?`)
    if (!confirmed) return
    deleteMutation.mutate(cor.id)
  }

  const hasCores = cores.length > 0

  return (
    <Card
      title="Cores"
      action={
        <Button icon={Plus} size="sm" onClick={openCreateModal}>
          Nova cor
        </Button>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Palette}
          title="Erro ao carregar cores"
          description="Não foi possível carregar a lista de cores. Tente novamente."
        />
      ) : !hasCores ? (
        <EmptyState
          icon={Palette}
          title="Nenhuma cor encontrada"
          description="Cadastre sua primeira cor para começar."
          action={
            <Button icon={Plus} onClick={openCreateModal}>
              Nova cor
            </Button>
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Amostra</Th>
              <Th>Nome</Th>
              <Th>Hex</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {cores.map((cor) => (
              <Tr key={cor.id}>
                <Td>
                  <span
                    className="inline-block h-5 w-5 rounded-full border border-gray-300"
                    style={{ backgroundColor: cor.hex }}
                  />
                </Td>
                <Td className="font-medium text-gray-900">{cor.nome}</Td>
                <Td>{cor.hex}</Td>
                <Td>
                  {cor.ativo ? (
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
                      onClick={() => openEditModal(cor)}
                      aria-label="Editar cor"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(cor)}
                      aria-label="Excluir cor"
                    >
                      Excluir
                    </Button>
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
        title={editingId ? 'Editar cor' : 'Nova cor'}
        size="md"
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
            placeholder="Nome da cor"
            required
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cor</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.hex}
                onChange={(e) => handleChange('hex', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1"
              />
              <Input
                value={form.hex}
                onChange={(e) => handleChange('hex', e.target.value)}
                placeholder="#rrggbb"
                containerClassName="flex-1"
              />
            </div>
          </div>

          <Input
            label="Ordem"
            type="number"
            value={form.ordem}
            onChange={(e) => handleChange('ordem', e.target.value)}
            placeholder="Opcional"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Cor ativa
          </label>
        </form>
      </Modal>
    </Card>
  )
}

function ConfiguracoesPdvPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_PDV_FORM)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['config-pdv'],
    queryFn: () => api.get('/config/pdv'),
  })

  useEffect(() => {
    if (data) {
      setForm({
        exigirGerenteCancelamento: data.exigirGerenteCancelamento ?? false,
        exigirGerenteDesconto: data.exigirGerenteDesconto ?? false,
        descontoHabilitado: data.descontoHabilitado ?? true,
        descontoMaximoPercentual: data.descontoMaximoPercentual ?? '',
        bloquearVendaSemEstoque: data.bloquearVendaSemEstoque ?? false,
        exigirAprovacaoFechamento: data.exigirAprovacaoFechamento ?? false,
      })
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/config/pdv', payload),
    onSuccess: () => {
      toast.success('Configurações do PDV atualizadas com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['config-pdv'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar configurações do PDV.'),
  })

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      exigirGerenteCancelamento: form.exigirGerenteCancelamento,
      exigirGerenteDesconto: form.exigirGerenteDesconto,
      descontoHabilitado: form.descontoHabilitado,
      descontoMaximoPercentual:
        form.descontoMaximoPercentual === '' ? null : Number(form.descontoMaximoPercentual),
      bloquearVendaSemEstoque: form.bloquearVendaSemEstoque,
      exigirAprovacaoFechamento: form.exigirAprovacaoFechamento,
    }
    updateMutation.mutate(payload)
  }

  return (
    <Card
      title="PDV"
      action={
        <Button onClick={handleSubmit} loading={updateMutation.isPending}>
          Salvar
        </Button>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        Regras de comportamento aplicadas no ponto de venda: aprovação de gerente, desconto e
        bloqueio de venda sem estoque.
      </p>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={SettingsIcon}
          title="Erro ao carregar configurações do PDV"
          description="Não foi possível carregar as configurações. Tente novamente."
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.exigirGerenteCancelamento}
              onChange={(e) => handleChange('exigirGerenteCancelamento', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Cancelar venda exige credencial de gerente
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.exigirAprovacaoFechamento}
              onChange={(e) => handleChange('exigirAprovacaoFechamento', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Fechamento de caixa exige credencial de gerente
          </label>

          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.descontoHabilitado}
                onChange={(e) => handleChange('descontoHabilitado', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Desconto habilitado no PDV
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.exigirGerenteDesconto}
                onChange={(e) => handleChange('exigirGerenteDesconto', e.target.checked)}
                disabled={!form.descontoHabilitado}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Aplicar desconto exige credencial de gerente
            </label>

            <Input
              label="Desconto máximo (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={!form.descontoHabilitado}
              value={form.descontoMaximoPercentual}
              onChange={(e) => handleChange('descontoMaximoPercentual', e.target.value)}
              placeholder="Vazio = sem limite"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.bloquearVendaSemEstoque}
              onChange={(e) => handleChange('bloquearVendaSemEstoque', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Bloquear finalização de venda com estoque zerado/negativo
          </label>
        </form>
      )}
    </Card>
  )
}

function ConfiguracoesClientePanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_CLIENTE_CFG_FORM)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['config-cliente'],
    queryFn: () => api.get('/config/cliente'),
  })

  useEffect(() => {
    if (data) {
      setForm({
        camposObrigatoriosPF: data.camposObrigatoriosPF || [],
        camposObrigatoriosPJ: data.camposObrigatoriosPJ || [],
        aplicarNoPdv: data.aplicarNoPdv ?? true,
      })
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/config/cliente', payload),
    onSuccess: () => {
      toast.success('Configurações de cadastro de clientes atualizadas com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['config-cliente'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar configurações de clientes.'),
  })

  function toggleCampo(grupo, campo) {
    setForm((prev) => {
      const atual = prev[grupo]
      const novo = atual.includes(campo) ? atual.filter((c) => c !== campo) : [...atual, campo]
      return { ...prev, [grupo]: novo }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  return (
    <Card
      title="Cadastro de Clientes"
      action={
        <Button onClick={handleSubmit} loading={updateMutation.isPending}>
          Salvar
        </Button>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        Define quais campos são obrigatórios no cadastro de cliente (nome é sempre obrigatório),
        separadamente para Pessoa Física e Pessoa Jurídica (identificadas pelo tamanho do
        CPF/CNPJ preenchido).
      </p>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Users}
          title="Erro ao carregar configurações de clientes"
          description="Não foi possível carregar as configurações. Tente novamente."
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pessoa Física
              </h3>
              <div className="space-y-2">
                {CAMPOS_CLIENTE.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.camposObrigatoriosPF.includes(c.value)}
                      onChange={() => toggleCampo('camposObrigatoriosPF', c.value)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pessoa Jurídica
              </h3>
              <div className="space-y-2">
                {CAMPOS_CLIENTE.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.camposObrigatoriosPJ.includes(c.value)}
                      onChange={() => toggleCampo('camposObrigatoriosPJ', c.value)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 border-t pt-4">
            <input
              type="checkbox"
              checked={form.aplicarNoPdv}
              onChange={(e) => setForm((prev) => ({ ...prev, aplicarNoPdv: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Aplicar também no cadastro feito pelo PDV
          </label>
        </form>
      )}
    </Card>
  )
}

export default function Configuracoes() {
  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie dados da empresa, categorias, marcas, escalas de tamanho, cores, configurações fiscais e chaves de API"
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EmpresaLogoPanel />
        <EmpresaCertificadoPanel />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoriasPanel />
        <MarcasPanel />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EscalasPanel />
        <CoresPanel />
      </div>

      <div className="mb-6">
        <ConfiguracoesFiscaisPanel />
      </div>

      <div className="mb-6">
        <CertificadoFiscalPanel />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConfiguracoesPdvPanel />
        <ConfiguracoesClientePanel />
      </div>

      <ApiKeysPanel />
    </div>
  )
}
