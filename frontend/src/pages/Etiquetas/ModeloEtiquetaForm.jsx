import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Button, Input, Select, Card, Spinner, PageHeader } from '../../components/ui/index.js'

const CAMPOS = [
  { value: 'COMPANY_NAME', label: 'Nome da Empresa' },
  { value: 'PRODUCT_CODE', label: 'Código do Produto' },
  { value: 'PRODUCT_NAME', label: 'Nome do Produto' },
  { value: 'PRODUCT_CODE_NAME', label: 'Código + Nome do Produto' },
  { value: 'PRODUCT_CATEGORY', label: 'Categoria do Produto' },
  { value: 'PRODUCT_VALUE', label: 'Valor do Produto' },
  { value: 'TEXT', label: 'Texto personalizado' },
]

const EMPTY_FORM = {
  nome: '',
  codigo: '',
  folhaLargura: '',
  folhaAltura: '',
  margemEsquerda: '0',
  margemTopo: '0',
  colunas: '1',
  espacamentoColunas: '0',
  linhasFolha: '1',
  espacamentoLinhas: '0',
  etiquetaLargura: '',
  etiquetaAltura: '',
  espacoSuperior: '0',
  espacoInferior: '0',
  espacoEsquerda: '0',
  espacoDireita: '0',
  fonteTipo: 'Helvetica',
  fonteTamanho: '8',
  alinhamento: 'C',
  imagemLeituraTipo: 'NENHUMA',
}

export default function ModeloEtiquetaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_FORM)
  const [linhas, setLinhas] = useState([{ campo: 'PRODUCT_NAME', texto: '' }])
  const [saving, setSaving] = useState(false)

  const { data: modelo, isLoading } = useQuery({
    queryKey: ['etiquetas', 'modelo', id],
    queryFn: () => api.get(`/etiquetas/modelos/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!modelo) return
    setForm({
      nome: modelo.nome || '',
      codigo: modelo.codigo || '',
      folhaLargura: String(modelo.folhaLargura ?? ''),
      folhaAltura: String(modelo.folhaAltura ?? ''),
      margemEsquerda: String(modelo.margemEsquerda ?? '0'),
      margemTopo: String(modelo.margemTopo ?? '0'),
      colunas: String(modelo.colunas ?? '1'),
      espacamentoColunas: String(modelo.espacamentoColunas ?? '0'),
      linhasFolha: String(modelo.linhasFolha ?? '1'),
      espacamentoLinhas: String(modelo.espacamentoLinhas ?? '0'),
      etiquetaLargura: String(modelo.etiquetaLargura ?? ''),
      etiquetaAltura: String(modelo.etiquetaAltura ?? ''),
      espacoSuperior: String(modelo.espacoSuperior ?? '0'),
      espacoInferior: String(modelo.espacoInferior ?? '0'),
      espacoEsquerda: String(modelo.espacoEsquerda ?? '0'),
      espacoDireita: String(modelo.espacoDireita ?? '0'),
      fonteTipo: modelo.fonteTipo || 'Helvetica',
      fonteTamanho: String(modelo.fonteTamanho ?? '8'),
      alinhamento: modelo.alinhamento || 'C',
      imagemLeituraTipo: modelo.imagemLeituraTipo || 'NENHUMA',
    })
    setLinhas(
      (modelo.linhasConteudo || []).map((l) => ({ campo: l.campo, texto: l.texto || '' }))
    )
  }, [modelo])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addLinha() {
    setLinhas((prev) => [...prev, { campo: 'PRODUCT_NAME', texto: '' }])
  }

  function removeLinha(idx) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLinha(idx, patch) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nome.trim()) return toast.error('O nome é obrigatório.')
    if (!form.codigo.trim()) return toast.error('O código é obrigatório.')
    if (linhas.length === 0) return toast.error('Adicione ao menos uma linha de conteúdo.')
    if (linhas.some((l) => l.campo === 'TEXT' && !l.texto.trim())) {
      return toast.error('Preencha o texto das linhas de Texto personalizado.')
    }

    const payload = {
      nome: form.nome.trim(),
      codigo: form.codigo.trim(),
      folhaLargura: Number(form.folhaLargura),
      folhaAltura: Number(form.folhaAltura),
      margemEsquerda: Number(form.margemEsquerda),
      margemTopo: Number(form.margemTopo),
      colunas: Number(form.colunas),
      espacamentoColunas: Number(form.espacamentoColunas),
      linhasFolha: Number(form.linhasFolha),
      espacamentoLinhas: Number(form.espacamentoLinhas),
      etiquetaLargura: Number(form.etiquetaLargura),
      etiquetaAltura: Number(form.etiquetaAltura),
      espacoSuperior: Number(form.espacoSuperior),
      espacoInferior: Number(form.espacoInferior),
      espacoEsquerda: Number(form.espacoEsquerda),
      espacoDireita: Number(form.espacoDireita),
      linhasConteudo: linhas.map((l) =>
        l.campo === 'TEXT' ? { campo: 'TEXT', texto: l.texto.trim() } : { campo: l.campo }
      ),
      fonteTipo: form.fonteTipo,
      fonteTamanho: Number(form.fonteTamanho),
      alinhamento: form.alinhamento,
      imagemLeituraTipo: form.imagemLeituraTipo,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/etiquetas/modelos/${id}`, payload)
      } else {
        await api.post('/etiquetas/modelos', payload)
      }
      toast.success(isEdit ? 'Modelo atualizado com sucesso.' : 'Modelo criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['etiquetas', 'modelos'] })
      navigate('/etiquetas/modelos')
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar modelo.')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar modelo de etiqueta' : 'Novo modelo de etiqueta'}
        subtitle="Todas as medidas são em milímetros (mm)."
        action={
          <Button variant="secondary" onClick={() => navigate('/etiquetas/modelos')}>
            Cancelar
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Dados do Modelo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nome *"
              value={form.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              required
            />
            <Input
              label="Código *"
              value={form.codigo}
              onChange={(e) => handleChange('codigo', e.target.value)}
              required
            />
          </div>
        </Card>

        <Card title="Folha (mm)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Input label="Largura" type="number" step="0.01" min="0" value={form.folhaLargura} onChange={(e) => handleChange('folhaLargura', e.target.value)} required />
            <Input label="Altura" type="number" step="0.01" min="0" value={form.folhaAltura} onChange={(e) => handleChange('folhaAltura', e.target.value)} required />
            <Input label="Margem esquerda" type="number" step="0.01" min="0" value={form.margemEsquerda} onChange={(e) => handleChange('margemEsquerda', e.target.value)} />
            <Input label="Margem topo" type="number" step="0.01" min="0" value={form.margemTopo} onChange={(e) => handleChange('margemTopo', e.target.value)} />
          </div>
        </Card>

        <Card title="Colunas e Linhas da Folha">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Input label="Colunas" type="number" min="1" value={form.colunas} onChange={(e) => handleChange('colunas', e.target.value)} required />
            <Input label="Espaçamento colunas (mm)" type="number" step="0.01" min="0" value={form.espacamentoColunas} onChange={(e) => handleChange('espacamentoColunas', e.target.value)} />
            <Input label="Linhas" type="number" min="1" value={form.linhasFolha} onChange={(e) => handleChange('linhasFolha', e.target.value)} required />
            <Input label="Espaçamento linhas (mm)" type="number" step="0.01" min="0" value={form.espacamentoLinhas} onChange={(e) => handleChange('espacamentoLinhas', e.target.value)} />
          </div>
        </Card>

        <Card title="Etiqueta - Dimensões (mm)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Largura" type="number" step="0.01" min="0" value={form.etiquetaLargura} onChange={(e) => handleChange('etiquetaLargura', e.target.value)} required />
            <Input label="Altura" type="number" step="0.01" min="0" value={form.etiquetaAltura} onChange={(e) => handleChange('etiquetaAltura', e.target.value)} required />
            <div />
            <Input label="Espaço superior" type="number" step="0.01" min="0" value={form.espacoSuperior} onChange={(e) => handleChange('espacoSuperior', e.target.value)} />
            <Input label="Espaço inferior" type="number" step="0.01" min="0" value={form.espacoInferior} onChange={(e) => handleChange('espacoInferior', e.target.value)} />
            <div />
            <Input label="Espaço esquerda" type="number" step="0.01" min="0" value={form.espacoEsquerda} onChange={(e) => handleChange('espacoEsquerda', e.target.value)} />
            <Input label="Espaço direita" type="number" step="0.01" min="0" value={form.espacoDireita} onChange={(e) => handleChange('espacoDireita', e.target.value)} />
          </div>
        </Card>

        <Card
          title="Exibir na Etiqueta"
          action={
            <Button variant="ghost" size="sm" icon={Plus} onClick={addLinha} type="button">
              Adicionar linha
            </Button>
          }
        >
          {linhas.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma linha adicionada.</p>
          ) : (
            <div className="space-y-3">
              {linhas.map((linha, idx) => (
                <div key={idx} className="flex items-end gap-3">
                  <Select
                    containerClassName="w-full sm:w-64"
                    label="Campo"
                    value={linha.campo}
                    onChange={(e) => updateLinha(idx, { campo: e.target.value })}
                  >
                    {CAMPOS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  {linha.campo === 'TEXT' && (
                    <Input
                      containerClassName="flex-1"
                      label="Texto"
                      value={linha.texto}
                      onChange={(e) => updateLinha(idx, { texto: e.target.value })}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    type="button"
                    onClick={() => removeLinha(idx)}
                    aria-label="Excluir linha"
                    className="mb-1 text-red-600 hover:bg-red-50"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Fonte">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Tipo" value={form.fonteTipo} onChange={(e) => handleChange('fonteTipo', e.target.value)}>
              <option value="Helvetica">Helvetica</option>
              <option value="Times">Times</option>
              <option value="Courier">Courier</option>
            </Select>
            <Select label="Tamanho" value={form.fonteTamanho} onChange={(e) => handleChange('fonteTamanho', e.target.value)}>
              {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select label="Alinhamento" value={form.alinhamento} onChange={(e) => handleChange('alinhamento', e.target.value)}>
              <option value="L">Esquerda</option>
              <option value="C">Centro</option>
              <option value="R">Direita</option>
            </Select>
          </div>
        </Card>

        <Card title="Imagem de Leitura">
          <Select
            containerClassName="sm:w-64"
            label="Tipo"
            value={form.imagemLeituraTipo}
            onChange={(e) => handleChange('imagemLeituraTipo', e.target.value)}
          >
            <option value="NENHUMA">Nenhuma</option>
            <option value="BARCODE">Código de Barras</option>
            <option value="QRCODE">QrCode</option>
          </Select>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/etiquetas/modelos')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Salvar alterações' : 'Criar modelo'}
          </Button>
        </div>
      </form>
    </div>
  )
}
