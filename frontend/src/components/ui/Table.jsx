export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className={`min-w-full divide-y divide-gray-200 text-sm ${className}`}>{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return <thead className="bg-gray-50">{children}</thead>
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>
      {children}
    </th>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>
}

export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}

export function Tr({ children, className = '', ...rest }) {
  return (
    <tr className={`hover:bg-gray-50 ${className}`} {...rest}>
      {children}
    </tr>
  )
}
