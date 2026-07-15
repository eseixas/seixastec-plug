import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, PackageSearch } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency } from '../../lib/format.js'
import { Input, Spinner } from '../../components/ui/index.js'

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Descreve a variação (tamanho/cor) de forma tolerante a formatos.
function variacaoLabel(v) {
  const partes = [v?.tamanho, v?.cor].filter(Boolean)
  return partes.join(' / ')
}

export default function ProdutoBusca({ onAdd }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(term.trim(), 300)
  const containerRef = useRef(null)

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['produtos', 'busca', debounced],
    queryFn: () => api.get(`/produtos/busca?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 1,
  })

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleAdd(variacao) {
    onAdd(variacao)
    setTerm('')
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const first = Array.isArray(resultados) ? resultados[0] : null
      if (first) handleAdd(first)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && debounced.length >= 1
  const lista = Array.isArray(resultados) ? resultados : []

  return (
    <div ref={containerRef} className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <Input
        placeholder="Buscar produto por nome, SKU ou código de barras..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-9"
      />

      {showDropdown && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isFetching && lista.length === 0 ? (
            <Spinner size={20} className="py-6" />
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
              <PackageSearch size={20} className="text-gray-400" />
              Nenhum resultado encontrado.
            </div>
          ) : (
            lista.map((v) => {
              const nome = v?.produto?.nome ?? 'Produto'
              const marca = v?.produto?.marca?.nome
              const varLabel = variacaoLabel(v)
              const estoque = Number(v?.estoqueAtual)
              return (
                <button
                  key={v?.id ?? `${nome}-${v?.sku}`}
                  type="button"
                  onClick={() => handleAdd(v)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-50 px-4 py-2.5 text-left last:border-b-0 hover:bg-indigo-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {nome}
                      {marca ? <span className="ml-1 text-xs text-gray-400">· {marca}</span> : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">
                      {varLabel ? `${varLabel} · ` : ''}
                      SKU: {v?.sku || '-'}
                      {Number.isFinite(estoque) ? ` · Estoque: ${estoque}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-gray-900">
                    {formatCurrency(v?.precoVenda)}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
