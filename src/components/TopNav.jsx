import { isSupabaseConfigured } from '../lib/supabase'

export default function TopNav({ view, setView, onGenerate, isGenerating, isDark, onToggleTheme }) {
  return (
    <nav className="fixed top-0 w-full z-40 bg-surface border-b border-outline-variant flex justify-between items-center h-16 px-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-container rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-[18px]">psychology</span>
          </div>
          <span className="text-primary font-bold text-lg tracking-tight">SistemIA Prompt</span>
        </div>

        <div className="hidden md:flex items-center gap-1 ml-4">
          {['editor', 'library'].map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-3 py-1.5 rounded text-[11px] font-mono font-semibold tracking-widest uppercase transition-colors
                ${view === tab
                  ? 'text-primary border-b-2 border-primary rounded-none pb-3'
                  : 'text-on-surface-variant hover:text-primary'}`}
            >
              {tab === 'editor' ? 'Editor' : 'Library'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Botão lua/sol */}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          className="w-9 h-9 flex items-center justify-center rounded border border-outline-variant bg-surface-container hover:border-primary hover:text-primary text-on-surface-variant transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <div className={`flex items-center gap-2 px-3 py-1 rounded border ${
          isSupabaseConfigured
            ? 'border-secondary/40 bg-secondary/5'
            : 'border-outline-variant bg-surface-container'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-secondary pulse-glow' : 'bg-outline'}`} />
          <span className="label-caps text-[10px]">
            {isSupabaseConfigured ? 'SUPABASE_CONNECTED' : 'SUPABASE_OFFLINE'}
          </span>
        </div>

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="bg-primary text-on-primary px-5 py-2 rounded text-[11px] font-mono font-semibold tracking-widest uppercase hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          {isGenerating ? 'PROCESSANDO...' : 'GERAR PROMPT'}
        </button>
      </div>
    </nav>
  )
}
