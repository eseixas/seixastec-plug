import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { User, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import { Input } from '../../components/ui/index.js'

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function ClienteBusca({ cliente, onSelect, onClear }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(term.trim(), 300)
  const containerRef = useRef(null)

  const { data: resultados = [] } = useQuery({
    queryKey: ['clientes', 'pdv', debounced],
    queryFn: () => api.get(`/clientes?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 1 && !cliente,
  })

  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <User size={14} className="text-indigo-500" />
            <span className="truncate">{cliente.nome}</span>
          </div>
          {cliente.cpfCnpj && <div className="mt-0.5 text-xs text-gray-500">{cliente.cpfCnpj}</div>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-white hover:text-red-600"
          aria-label="Remover cliente"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  const lista = Array.isArray(resultados) ? resultados : []
  const showDropdown = open && debounced.length >= 1

  return (
    <div ref={containerRef} className="relative">
      <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <Input
        placeholder="Buscar cliente (opcional)..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="pl-9"
      />
      {showDropdown && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {lista.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-gray-500">Nenhum cliente encontrado.</div>
          ) : (
            lista.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c)
                  setTerm('')
                  setOpen(false)
                }}
                className="flex w-full flex-col border-b border-gray-50 px-4 py-2 text-left last:border-b-0 hover:bg-indigo-50"
              >
                <span className="text-sm font-medium text-gray-900">{c.nome}</span>
                {c.cpfCnpj && <span className="text-xs text-gray-500">{c.cpfCnpj}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
