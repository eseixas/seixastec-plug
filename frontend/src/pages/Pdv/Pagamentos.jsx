import { Plus, X } from 'lucide-react'
import { Button, Select } from '../../components/ui/index.js'

export const FORMAS_PAGAMENTO = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIARIO', label: 'Crediário' },
]

// Formas que aceitam parcelamento.
export function aceitaParcelas(forma) {
  return forma === 'CREDITO' || forma === 'CREDIARIO'
}

export default function Pagamentos({ pagamentos, onAdd, onUpdate, onRemove }) {
  return (
    <div className="space-y-3">
      {pagamentos.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum pagamento adicionado.</p>
      )}

      {pagamentos.map((p) => (
        <div key={p.uid} className="flex items-start gap-2">
          <Select
            value={p.forma}
            onChange={(e) => onUpdate(p.uid, 'forma', e.target.value)}
            containerClassName="flex-1"
            className="py-1.5"
          >
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>

          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={p.valor}
            onChange={(e) => onUpdate(p.uid, 'valor', e.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {aceitaParcelas(p.forma) && (
            <input
              type="number"
              min="1"
              step="1"
              title="Parcelas"
              placeholder="Parc."
              value={p.parcelas}
              onChange={(e) => onUpdate(p.uid, 'parcelas', e.target.value)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}

          <button
            type="button"
            onClick={() => onRemove(p.uid)}
            className="mt-1.5 shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Remover pagamento"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      <Button variant="outline" size="sm" icon={Plus} onClick={onAdd} className="w-full">
        Adicionar pagamento
      </Button>
    </div>
  )
}
