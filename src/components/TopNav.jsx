import { isSupabaseConfigured } from '../lib/supabase'

export default function TopNav({ isDark, onToggleTheme, onLogout, center }) {
  return (
    <nav className="fixed top-0 w-full z-40 bg-surface border-b border-outline-variant flex items-center h-16 px-6 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 bg-primary-container rounded flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary-container text-[18px]">psychology</span>
        </div>
        <span className="text-primary font-bold text-lg tracking-tight">SistemIA Prompt</span>
      </div>

      {/* Centro — seletor de agente quando no editor */}
      <div className="flex-1 flex items-center justify-center px-4">
        {center}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          className="w-9 h-9 flex items-center justify-center rounded border border-outline-variant bg-surface-container hover:border-primary hover:text-primary text-on-surface-variant transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button
          onClick={onLogout}
          title="Sair"
          className="w-9 h-9 flex items-center justify-center rounded border border-outline-variant bg-surface-container hover:border-error hover:text-error text-on-surface-variant transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </nav>
  )
}
