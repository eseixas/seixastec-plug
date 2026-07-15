const variants = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  sky: 'bg-sky-100 text-sky-700',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
