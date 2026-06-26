const NAV_ITEMS = [
  { id: 'editor-v2', icon: 'dashboard',    label: 'EDITOR', badge: null },
  { id: 'simulator', icon: 'science',       label: 'SIMULADOR' },
  { id: 'library',   icon: 'history',       label: 'HISTÓRICO' },
  { id: 'settings',  icon: 'manufacturing', label: 'CONFIGURAÇÕES' },
]

const EDITOR_SECTIONS = [
  { id: 'nav-assistente', label: 'Assistente',  icon: 'smart_toy',    show: 'always' },
  { id: 'nav-objetivo',   label: 'Objetivo',    icon: 'flag',         show: 'always' },
  { id: 'nav-tom',        label: 'Tom',         icon: 'tune',         show: 'always' },
  { id: 'nav-campos',     label: 'Campos',      icon: 'input',        show: 'sections' },
  { id: 'nav-saidas',     label: 'Saídas',      icon: 'account_tree', show: 'sections' },
  { id: 'nav-prompt',     label: 'Prompt',      icon: 'code',         show: 'prompt' },
  { id: 'nav-auditoria',  label: 'Auditoria',   icon: 'fact_check',   show: 'prompt' },
]

export default function SideNav({ view, setView, onNewPrompt, aiConfig, isCollapsed, onToggle, sectionsRevealed, hasPrompt, onNavTo }) {
  return (
    <aside
      className="fixed left-0 top-16 h-[calc(100vh-64px)] border-r border-outline-variant flex flex-col z-30 transition-all duration-200"
      style={{
        width: isCollapsed ? '64px' : '280px',
        background: 'var(--color-surface-container)',
      }}
    >
      {/* Cabeçalho: logo + botão de colapso */}
      <div className={`flex items-center border-b border-outline-variant/40 py-3 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center flex-shrink-0"
                 style={{ background: 'var(--color-surface-container-high)' }}>
              <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
            </div>
            <div>
              <p className="text-primary font-semibold text-[12px] leading-none">v1.0.0</p>
              <p className="label-caps text-[10px] mt-0.5 opacity-50">BotConversa</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isCollapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
      </div>

      {/* Botão Novo Prompt */}
      <div className={`${isCollapsed ? 'px-2' : 'px-4'} mt-4 mb-2`}>
        <button
          onClick={onNewPrompt}
          title={isCollapsed ? 'Novo Prompt' : undefined}
          className={`w-full font-mono text-[11px] font-semibold tracking-widest uppercase py-2.5 rounded flex items-center gap-2 hover:brightness-110 transition-all ${isCollapsed ? 'justify-center' : 'justify-center'}`}
          style={{ background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {!isCollapsed && 'NOVO PROMPT'}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex flex-col flex-1 mt-2 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isEditorItem = item.id === 'editor-v2'
          const isActive = view === item.id || (isEditorItem && view === 'editor')
          const showBadge = item.id === 'settings' && aiConfig?.apiKey

          const visibleSections = isEditorItem ? EDITOR_SECTIONS.filter(s => {
            if (s.show === 'sections') return sectionsRevealed
            if (s.show === 'prompt') return hasPrompt
            return true
          }) : []

          return (
            <div key={item.id}>
              <button
                onClick={() => setView(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full py-3 flex items-center transition-all text-left border-l-4 ${
                  isCollapsed ? 'justify-center px-0' : 'px-5 gap-3'
                } ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
                style={{ background: isActive ? 'var(--color-surface-variant)' : 'transparent' }}
              >
                <span className="material-symbols-outlined text-[20px] flex-shrink-0">{item.icon}</span>
                {!isCollapsed && <span className="label-caps flex-1">{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)', color: 'var(--color-secondary)' }}>
                    {item.badge}
                  </span>
                )}
                {!isCollapsed && showBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />
                )}
                {isCollapsed && showBadge && (
                  <span className="absolute ml-4 mt-[-8px] w-1.5 h-1.5 rounded-full bg-secondary" />
                )}
              </button>

              {/* Submenu de seções do editor */}
              {isEditorItem && isActive && !isCollapsed && visibleSections.length > 0 && (
                <div className="pb-2 border-l-4 border-primary/20 ml-0">
                  {visibleSections.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onNavTo?.(s.id)}
                      className="w-full flex items-center gap-2 pl-10 pr-4 py-1.5 text-left text-[11px] font-mono text-on-surface-variant/45 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 13 }}>{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Rodapé */}
      <div className={`border-t border-outline-variant pt-2 pb-2 space-y-0.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {[
          { icon: 'menu_book',    label: 'DOCS' },
          { icon: 'help_outline', label: 'SUPORTE' },
        ].map(item => (
          <button
            key={item.label}
            title={isCollapsed ? item.label : undefined}
            className={`w-full text-on-surface-variant py-2 flex items-center hover:text-primary transition-colors rounded-lg ${
              isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {!isCollapsed && <span className="label-caps text-[10px]">{item.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  )
}
