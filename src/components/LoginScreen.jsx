import { useState } from 'react'

const USERNAME = 'master'
const PW_HASH = '96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const hash = await sha256(password)
      if (username === USERNAME && hash === PW_HASH) {
        onLogin()
      } else {
        setError('Usuário ou senha incorretos.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">

      {/* Atmosfera */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] bg-secondary/4 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-xl border border-outline-variant flex items-center justify-center mb-4"
               style={{ background: 'var(--color-surface-container-high)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 30 }}>smart_toy</span>
          </div>
          <h1 className="text-lg font-bold text-on-surface tracking-tight">SistemIA Prompt</h1>
          <p className="text-[11px] font-mono text-on-surface-variant/50 mt-0.5">BotConversa · Acesso Restrito</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-outline-variant overflow-hidden shadow-2xl"
             style={{ background: 'var(--color-surface-container)' }}>

          <div className="h-0.5" style={{
            background: 'linear-gradient(to right, var(--color-primary), color-mix(in srgb, var(--color-primary) 30%, transparent), transparent)',
          }} />

          <form onSubmit={handleSubmit} className="p-8 space-y-5">

            {/* Usuário */}
            <div>
              <label className="label-caps text-[10px] opacity-50 mb-2 block">USUÁRIO</label>
              <div className="flex items-center rounded-lg border border-outline-variant overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all"
                   style={{ background: 'var(--color-surface)' }}>
                <span className="material-symbols-outlined text-on-surface-variant/30 ml-3 flex-shrink-0" style={{ fontSize: 18 }}>person</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  placeholder="usuário"
                  autoComplete="username"
                  className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/20"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="label-caps text-[10px] opacity-50 mb-2 block">SENHA</label>
              <div className="flex items-center rounded-lg border border-outline-variant overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all"
                   style={{ background: 'var(--color-surface)' }}>
                <span className="material-symbols-outlined text-on-surface-variant/30 ml-3 flex-shrink-0" style={{ fontSize: 18 }}>lock</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="px-3 py-3 border-l border-outline-variant text-on-surface-variant/40 hover:text-on-surface-variant transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-error/30 text-[11px] font-mono text-error"
                   style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}>
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 14 }}>error</span>
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3 rounded-lg font-mono font-bold tracking-widest uppercase text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-on-primary technical-glow"
            >
              {loading
                ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>Entrando...</>
                : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>login</span>ENTRAR</>
              }
            </button>

          </form>
        </div>

      </div>
    </div>
  )
}
