import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, KeyRound, Users as UsersIcon } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
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

const ROLES = [
  { value: 'ADMIN', label: 'Administrador', badge: 'indigo' },
  { value: 'GERENTE', label: 'Gerente', badge: 'sky' },
  { value: 'FINANCEIRO', label: 'Financeiro', badge: 'amber' },
  { value: 'CAIXA', label: 'Caixa', badge: 'green' },
  { value: 'VENDEDOR', label: 'Vendedor', badge: 'gray' },
]

function roleInfo(role) {
  return ROLES.find((r) => r.value === role) || { label: role, badge: 'gray' }
}

const EMPTY_USER_FORM = {
  nome: '',
  email: '',
  role: 'VENDEDOR',
  lojaId: '',
  ativo: true,
  senha: '',
  confirmarSenha: '',
}

export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('ativos') // 'ativos' | 'inativos' | 'todos'

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_USER_FORM)

  const [senhaModalUser, setSenhaModalUser] = useState(null)
  const [novaSenha, setNovaSenha] = useState('')

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas', 'select'],
    queryFn: () => api.get('/lojas'),
  })

  const {
    data: usuarios = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['usuarios', search, statusFiltro],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (statusFiltro === 'ativos') params.set('ativo', 'true')
      else if (statusFiltro === 'inativos') params.set('ativo', 'false')
      const qs = params.toString()
      return api.get(`/usuarios${qs ? `?${qs}` : ''}`)
    },
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/usuarios', payload),
    onSuccess: () => {
      toast.success('Usuário criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar usuário.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/usuarios/${id}`, payload),
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar usuário.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`),
    onSuccess: () => {
      toast.success('Usuário excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir usuário.'),
  })

  const redefinirSenhaMutation = useMutation({
    mutationFn: ({ id, senha }) => api.post(`/usuarios/${id}/redefinir-senha`, { senha }),
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso.')
      closeSenhaModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao redefinir senha.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_USER_FORM)
    setModalOpen(true)
  }

  function openEditModal(usuario) {
    setEditingId(usuario.id)
    setForm({
      nome: usuario.nome || '',
      email: usuario.email || '',
      role: usuario.role || 'VENDEDOR',
      lojaId: usuario.lojaId || '',
      ativo: usuario.ativo ?? true,
      senha: '',
      confirmarSenha: '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_USER_FORM)
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
    if (!form.email.trim()) {
      toast.error('O email é obrigatório.')
      return
    }

    if (!editingId) {
      if (form.senha.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres.')
        return
      }
      if (form.senha !== form.confirmarSenha) {
        toast.error('As senhas não coincidem.')
        return
      }
    }

    if (editingId) {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
        lojaId: form.lojaId || null,
        ativo: form.ativo,
      }
      updateMutation.mutate({ id: editingId, payload })
    } else {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        role: form.role,
        lojaId: form.lojaId || null,
        ativo: form.ativo,
      }
      createMutation.mutate(payload)
    }
  }

  function handleDelete(usuario) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o usuário "${usuario.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(usuario.id)
  }

  function openSenhaModal(usuario) {
    setSenhaModalUser(usuario)
    setNovaSenha('')
  }

  function closeSenhaModal() {
    setSenhaModalUser(null)
    setNovaSenha('')
  }

  function handleRedefinirSenha(e) {
    e.preventDefault()
    if (novaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    redefinirSenhaMutation.mutate({ id: senhaModalUser.id, senha: novaSenha })
  }

  const hasUsuarios = usuarios.length > 0

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie os usuários do sistema"
        action={
          <Button icon={Plus} onClick={openCreateModal}>
            Novo usuário
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-72">
            <Input
              label="Buscar"
              placeholder="Nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            <Search size={16} className="pointer-events-none absolute left-3 top-[38px] text-gray-400" />
          </div>
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
                  onClick={() => setStatusFiltro(opt.value)}
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
        </div>

        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <EmptyState
            icon={UsersIcon}
            title="Erro ao carregar usuários"
            description="Não foi possível carregar a lista de usuários. Tente novamente."
          />
        ) : !hasUsuarios ? (
          <EmptyState
            icon={UsersIcon}
            title="Nenhum usuário encontrado"
            description={
              search
                ? 'Nenhum usuário corresponde à sua busca.'
                : 'Cadastre o primeiro usuário para começar.'
            }
            action={
              !search && (
                <Button icon={Plus} onClick={openCreateModal}>
                  Novo usuário
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Email</Th>
                <Th>Perfil</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usuarios.map((usuario) => {
                const info = roleInfo(usuario.role)
                const isSelf = usuario.id === currentUser?.id
                return (
                  <Tr key={usuario.id}>
                    <Td className="font-medium text-gray-900">
                      {usuario.nome}
                      {isSelf && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                    </Td>
                    <Td>{usuario.email}</Td>
                    <Td>
                      <Badge variant={info.badge}>{info.label}</Badge>
                    </Td>
                    <Td>
                      {usuario.ativo ? (
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
                          icon={KeyRound}
                          onClick={() => openSenhaModal(usuario)}
                          aria-label="Redefinir senha"
                        >
                          Senha
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          onClick={() => openEditModal(usuario)}
                          aria-label="Editar usuário"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(usuario)}
                          disabled={isSelf}
                          aria-label="Excluir usuário"
                        >
                          Excluir
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar usuário' : 'Novo usuário'}
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
            placeholder="Nome completo"
            required
          />

          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@exemplo.com"
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Perfil *"
              value={form.role}
              onChange={(e) => handleChange('role', e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>

            <Select
              label="Loja"
              value={form.lojaId}
              onChange={(e) => handleChange('lojaId', e.target.value)}
            >
              <option value="">Sem loja associada</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </Select>
          </div>

          {!editingId && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Senha *"
                type="password"
                value={form.senha}
                onChange={(e) => handleChange('senha', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <Input
                label="Confirmar senha *"
                type="password"
                value={form.confirmarSenha}
                onChange={(e) => handleChange('confirmarSenha', e.target.value)}
                placeholder="Repita a senha"
                required
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Usuário ativo
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(senhaModalUser)}
        onClose={closeSenhaModal}
        title={`Redefinir senha — ${senhaModalUser?.nome || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeSenhaModal} disabled={redefinirSenhaMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleRedefinirSenha} loading={redefinirSenhaMutation.isPending}>
              Redefinir
            </Button>
          </>
        }
      >
        <form onSubmit={handleRedefinirSenha} className="space-y-4">
          <Input
            label="Nova senha *"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </form>
      </Modal>
    </div>
  )
}
