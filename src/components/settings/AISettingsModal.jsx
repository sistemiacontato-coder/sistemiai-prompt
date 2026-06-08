import { useState } from 'react'
import { PROVIDERS, saveAIConfig, testAIConnection } from '../../lib/claude'

export default function AISettingsModal({ currentConfig, onSave, onClose }) {
  const [provider, setProvider] = useState(currentConfig?.provider || 'gemini')
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const selectedProvider = PROVIDERS.find(p => p.id === provider)

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    const result = await testAIConnection(provider, apiKey.trim())
    setTestResult(result)
    setTesting(false)
  }

  const handleSave = () => {
    const cfg = { provider, apiKey: apiKey.trim() }
    saveAIConfig(cfg)
    onSave(cfg)
    onClose()
  }

  const maskedKey = apiKey
    ? apiKey.slice(0, 6) + '•'.repeat(Math.max(0, apiKey.length - 10)) + apiKey.slice(-4)
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="rounded-xl border border-outline-variant w-full max-w-lg shadow-2xl overflow-hidden"
           style={{ background: 'var(--color-surface-container)' }}>

        {/* Accent */}
        <div className="h-0.5 bg-gradient-to-r from-tertiary via-tertiary/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center"
               style={{ background: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>manufacturing</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-none">Configuração de IA</h3>
            <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Provedor para geração automática de campos e saídas</p>
          </div>
          <button onClick={onClose} className="ml-auto text-on-surface-variant/40 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Seleção de provedor */}
          <div>
            <label className="label-caps block mb-2">PROVEDOR DE IA</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(p => (
                <button key={p.id} type="button" onClick={() => { setProvider(p.id); setTestResult(null) }}
                  className={`flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                    provider === p.id ? 'border-2' : 'border hover:border-outline'
                  }`}
                  style={{
                    borderColor: provider === p.id
                      ? `var(--color-${p.badgeColor})`
                      : 'var(--color-outline-variant)',
                    background: provider === p.id
                      ? `color-mix(in srgb, var(--color-${p.badgeColor}) 10%, transparent)`
                      : 'var(--color-surface)',
                  }}>
                  <div className="flex items-center justify-between w-full">
                    <span className="material-symbols-outlined"
                      style={{ fontSize: 18, color: provider === p.id ? `var(--color-${p.badgeColor})` : 'var(--color-on-surface-variant)' }}>
                      {p.icon}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `color-mix(in srgb, var(--color-${p.badgeColor}) 15%, transparent)`,
                        color: `var(--color-${p.badgeColor})`,
                      }}>
                      {p.badge}
                    </span>
                  </div>
                  <div>
                    <p className={`text-[11px] font-semibold leading-none ${provider === p.id ? '' : 'text-on-surface'}`}
                       style={{ color: provider === p.id ? `var(--color-${p.badgeColor})` : undefined }}>
                      {p.name}
                    </p>
                    <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">{p.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chave de API */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-caps">CHAVE DE API</label>
              <a href={`https://${selectedProvider?.keyHint}`} target="_blank" rel="noreferrer"
                 className="text-[10px] font-mono text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                {selectedProvider?.keyHint}
              </a>
            </div>
            <div className="flex items-center gap-0 rounded-lg border border-outline-variant overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all"
                 style={{ background: 'var(--color-surface)' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setTestResult(null) }}
                placeholder={selectedProvider?.keyPlaceholder}
                className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/25"
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="px-3 py-3 border-l border-outline-variant text-on-surface-variant/50 hover:text-on-surface transition-colors flex-shrink-0">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {!showKey && apiKey && (
              <p className="text-[10px] font-mono text-on-surface-variant/30 mt-1">{maskedKey}</p>
            )}
          </div>

          {/* Resultado do teste */}
          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              testResult.success
                ? 'border-secondary/30'
                : 'border-error/30'
            }`}
            style={{
              background: testResult.success
                ? 'color-mix(in srgb, var(--color-secondary) 8%, transparent)'
                : 'color-mix(in srgb, var(--color-error) 8%, transparent)',
            }}>
              <span className={`material-symbols-outlined ${testResult.success ? 'text-secondary' : 'text-error'}`} style={{ fontSize: 16 }}>
                {testResult.success ? 'check_circle' : 'error'}
              </span>
              <p className={`text-[11px] font-mono ${testResult.success ? 'text-secondary' : 'text-error'}`}>
                {testResult.success ? 'Conexão bem-sucedida!' : testResult.error}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-outline-variant"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <button onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-[11px] font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {testing ? (
              <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>Testando...</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>network_check</span>Testar</>
            )}
          </button>
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all">
            Cancelar
          </button>
          <button onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-5 py-2 rounded-lg bg-primary text-on-primary text-sm font-mono font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
