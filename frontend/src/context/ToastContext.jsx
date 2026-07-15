import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const push = useCallback((message, type = 'info') => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, type }])
    timers.current[id] = setTimeout(() => remove(id), 4000)
    return id
  }, [remove])

  const toast = {
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'error'),
    info: (msg) => push(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 rounded-lg shadow-lg px-4 py-3 text-sm text-white animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle size={18} className="shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info size={18} className="shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
