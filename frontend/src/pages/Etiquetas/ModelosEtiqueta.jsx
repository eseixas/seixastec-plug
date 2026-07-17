import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  PageHeader,
  EmptyState,
  Spinner,
} from '../../components/ui/index.js'

function mm(valor) {
  return `${Number(valor).toFixed(2).replace('.', ',')}`
}

export default function ModelosEtiqueta() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['etiquetas', 'modelos'],
    queryFn: () => api.get('/etiquetas/modelos'),
  })

  async function handleDelete(modelo) {
    const confirmado = window.confirm(`Excluir o modelo "${modelo.nome}"?`)
    if (!confirmado) return
    try {
      await api.delete(`/etiquetas/modelos/${modelo.id}`)
      toast.success('Modelo excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['etiquetas', 'modelos'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir modelo.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Modelos de Etiqueta"
        subtitle="Cadastre formatos de etiqueta para impressão (Pimaco, térmica e customizados)"
        action={
          <Button icon={Plus} onClick={() => navigate('/etiquetas/modelos/novo')}>
            Novo modelo
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : modelos.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhum modelo cadastrado"
          description="Cadastre seu primeiro modelo de etiqueta para começar a imprimir."
          action={
            <Button icon={Plus} onClick={() => navigate('/etiquetas/modelos/novo')}>
              Novo modelo
            </Button>
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Código</Th>
              <Th>Tamanho da etiqueta</Th>
              <Th>Colunas x Linhas</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {modelos.map((modelo) => (
              <Tr key={modelo.id}>
                <Td className="font-medium text-gray-900">{modelo.nome}</Td>
                <Td className="font-mono text-xs text-gray-600">{modelo.codigo}</Td>
                <Td>
                  {mm(modelo.etiquetaLargura)} x {mm(modelo.etiquetaAltura)} mm
                </Td>
                <Td>
                  {modelo.colunas} x {modelo.linhasFolha}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      onClick={() => navigate(`/etiquetas/modelos/${modelo.id}`)}
                      aria-label="Editar modelo"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(modelo)}
                      aria-label="Excluir modelo"
                      className="text-red-600 hover:bg-red-50"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
