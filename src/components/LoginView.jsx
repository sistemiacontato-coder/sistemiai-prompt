import { useState } from 'react'
import { signIn, signUp } from '../lib/supabaseAuth'

export default function LoginView({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        onLogin()
      } else {
        await signUp(email, password)
        setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar e depois faça login.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-[22px]">psychology</span>
          </div>
          <span className="text-primary font-bold text-xl tracking-tight">SistemIA Prompt</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>
          <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />

          <div className="px-6 py-5 border-b border-outline-variant"
               style={{ background: 'var(--color-surface-container-high)' }}>
            <h2 className="text-sm font-semibold text-on-surface">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </h2>
            <p className="text-[11px] font-mono text-on-surface-variant/50 mt-0.5">
              {mode === 'login' ? 'Acesse seu espaço de trabalho' : 'Crie sua conta para começar'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="label-caps text-[10px] text-on-surface-variant/60 mb-1.5 block">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-on-surface-variant/30"
              />
            </div>

            <div>
              <label className="label-caps text-[10px] text-on-surface-variant/60 mb-1.5 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-on-surface-variant/30"
              />
            </div>

            {error && (
              <p className="text-[11px] font-mono text-error leading-snug">{error}</p>
            )}
            {successMsg && (
              <p className="text-[11px] font-mono text-secondary leading-snug">{successMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-sm font-mono font-semibold transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); setSuccessMsg(null) }}
                className="text-[11px] font-mono text-on-surface-variant/50 hover:text-primary transition-colors"
              >
                {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
