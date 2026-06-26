import { useState } from 'react'

const ALL_ITEMS = [
  { id: 'nav-assistente', label: 'Assistente', icon: 'smart_toy',    show: 'always' },
  { id: 'nav-objetivo',   label: 'Objetivo',   icon: 'flag',         show: 'always' },
  { id: 'nav-tom',        label: 'Tom',        icon: 'tune',         show: 'always' },
  { id: 'nav-campos',     label: 'Campos',     icon: 'input',        show: 'sections' },
  { id: 'nav-saidas',     label: 'Saídas',     icon: 'account_tree', show: 'sections' },
  { id: 'nav-prompt',     label: 'Prompt',     icon: 'code',         show: 'prompt' },
  { id: 'nav-auditoria',  label: 'Auditoria',  icon: 'fact_check',   show: 'prompt' },
]

export default function QuickNavBar({ sectionsRevealed, hasPrompt }) {
  const [open, setOpen] = useState(true)

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const items = ALL_ITEMS.filter(n => {
    if (n.show === 'sections') return sectionsRevealed
    if (n.show === 'prompt')   return hasPrompt
    return true
  })

  return (
    <div className="border-b border-outline-variant/50 px-4 py-1 flex items-center gap-1 bg-background/90 backdrop-blur-sm">
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'Ocultar navegação' : 'Mostrar navegação'}
        className="p-1 rounded text-on-surface-variant/35 hover:text-on-surface-variant/70 transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {open ? 'menu_open' : 'menu'}
        </span>
      </button>

      {open && (
        <>
          <div className="w-px h-3.5 bg-outline-variant/40 mx-0.5 flex-shrink-0" />
          {items.map(n => (
            <button
              key={n.id}
              onClick={() => scrollTo(n.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-on-surface-variant/45 hover:text-on-surface hover:bg-surface-container-high transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
