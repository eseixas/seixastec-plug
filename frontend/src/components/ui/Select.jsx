import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

const Select = forwardRef(function Select(
  { label, error, className = '', containerClassName = '', children, ...rest },
  ref
) {
  return (
    <div className={containerClassName}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={`w-full appearance-none rounded-lg border px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 ${
            error ? 'border-red-400' : 'border-gray-300'
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Select
