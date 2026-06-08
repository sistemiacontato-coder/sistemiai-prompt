const NAV_ITEMS = [
  { id: 'editor',   icon: 'dashboard',     label: 'EDITOR' },
  { id: 'library',  icon: 'history',       label: 'HISTÓRICO' },
  { id: 'settings', icon: 'manufacturing', label: 'CONFIG IA' },
]

export default function SideNav({ view, setView, onNewPrompt, aiConfig }) {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-[280px] border-r border-outline-variant flex flex-col py-6 z-30"
           style={{ background: 'var(--color-surface-container)' }}>

      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-outline-variant flex items-center justify-center"
               style={{ background: 'var(--color-surface-container-high)' }}>
            <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
          </div>
          <div>
            <p className="text-primary font-semibold text-sm leading-none">v1.0.0</p>
            <p className="label-caps text-[10px] mt-0.5 opacity-60">BotConversa</p>
          </div>
        </div>
      </div>

      <button
        onClick={onNewPrompt}
        className="mx-6 mb-6 font-mono text-[11px] font-semibold tracking-widest uppercase py-2.5 rounded flex items-center justify-center gap-2 hover:brightness-110 transition-all"
        style={{ background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        NOVO PROMPT
      </button>

      <nav className="flex flex-col flex-1">
        {NAV_ITEMS.map(item => {
          const isActive = view === item.id
          const showBadge = item.id === 'settings' && aiConfig?.apiKey
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`px-6 py-3 flex items-center gap-3 transition-all text-left border-l-4 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
              style={{
                background: isActive ? 'var(--color-surface-variant)' : 'transparent',
              }}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="label-caps flex-1">{item.label}</span>
              {showBadge && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />
              )}
            </button>
          )
        })}

      </nav>

      <div className="mt-auto px-4 border-t border-outline-variant pt-3 space-y-1">
        {[{ icon: 'menu_book', label: 'DOCS' }, { icon: 'help_outline', label: 'SUPORTE' }].map(item => (
          <button key={item.label} className="w-full text-on-surface-variant py-2 px-3 flex items-center gap-3 hover:text-primary transition-colors rounded-lg">
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="label-caps">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
