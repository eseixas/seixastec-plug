export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.icon && <t.icon size={16} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}
