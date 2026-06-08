import { useState, useEffect } from 'react'
import { COMPAT_ENDPOINTS, detectProviderFromKey, saveAIConfig, testAIConnection } from '../../lib/claude'

function SectionCard({ accentColor = 'primary', icon, title, subtitle, badge, children }) {
  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>
      <div className="h-0.5 bg-gradient-to-r to-transparent"
           style={{ backgroundImage: `linear-gradient(to right, var(--color-${accentColor}), color-mix(in srgb, var(--color-${accentColor}) 30%, transparent), transparent)` }} />
      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, var(--color-${accentColor}) 12%, transparent)` }}>
          <span className={`material-symbols-outlined text-${accentColor}`} style={{ fontSize: 16 }}>{icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-on-surface leading-none">{title}</h3>
          {subtitle && <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="label-caps text-[9px] text-on-surface-variant/40 border border-outline-variant px-2 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

export default function SettingsView({ aiConfig, onSaveAIConfig }) {
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint || '')
  const [model, setModel] = useState(aiConfig?.model || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saved, setSaved] = useState(false)

  const detected = detectProviderFromKey(apiKey)
  const isCompat = detected?.provider === 'compat'

  // Quando detecta um provider com endpoint padrão, preenche automaticamente
  useEffect(() => {
    if (detected?.endpoint && !aiConfig?.endpoint) {
      setEndpoint(detected.endpoint)
      setModel(detected.model || '')
    }
  }, [detected?.provider])

  const currentConfig = {
    provider: detected?.provider || 'compat',
    apiKey: apiKey.trim(),
    endpoint: endpoint.trim() || (isCompat ? 'https://api.openai.com/v1' : ''),
    model: model.trim() || (isCompat ? 'gpt-4o-mini' : ''),
  }

  const isDirty = apiKey !== (aiConfig?.apiKey || '')
    || endpoint !== (aiConfig?.endpoint || '')
    || model !== (aiConfig?.model || '')

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    const result = await testAIConnection(currentConfig)
    setTestResult(result)
    setTesting(false)
  }

  const handleSave = () => {
    saveAIConfig(currentConfig)
    onSaveAIConfig(currentConfig)
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 3000)
  }

  const applyEndpoint = (ep) => {
    setEndpoint(ep.url)
    setModel(ep.model)
    setTestResult(null)
    setSaved(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5 pb-16">

        <div className="mb-2">
          <h2 className="text-lg font-bold text-on-surface leading-none">Configurações</h2>
          <p className="text-[11px] font-mono text-on-surface-variant/50 mt-1">SistemIA Prompt v1.0.0 · BotConversa</p>
        </div>

        {/* ── IA Engine ── */}
        <SectionCard accentColor="secondary" icon="auto_awesome" title="IA Engine" subtitle="Cole a chave de qualquer API — o provedor é identificado automaticamente" badge="ANÁLISE AUTOMÁTICA">
          <div className="space-y-5">

            {/* Campo de chave */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps text-[10px] opacity-60">CHAVE DE API</p>
                {detected && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: `var(--color-${detected.color})` }}>{detected.icon}</span>
                    <span className="text-[10px] font-mono font-semibold" style={{ color: `var(--color-${detected.color})` }}>
                      {detected.name} detectado
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-lg border border-outline-variant overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all"
                     style={{ background: 'var(--color-surface)' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setTestResult(null); setSaved(false) }}
                    placeholder="Cole sua chave aqui: sk-ant-..., AIza..., sk-..., gsk_..."
                    className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/25"
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)}
                    className="px-3 py-3 border-l border-outline-variant text-on-surface-variant/50 hover:text-on-surface transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showKey ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <button onClick={handleTest} disabled={!apiKey.trim() || testing}
                  className="flex items-center gap-1.5 px-3 py-3 rounded-lg border border-outline-variant text-[11px] font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ background: 'var(--color-surface)' }}>
                  {testing
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>Testando</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>network_check</span>Testar</>}
                </button>
              </div>

              {/* Dicas de onde conseguir chave grátis */}
              {!apiKey && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: 'Gemini · gratuito', hint: 'aistudio.google.com/apikey' },
                    { label: 'Groq · gratuito',   hint: 'console.groq.com' },
                    { label: 'OpenRouter',         hint: 'openrouter.ai/keys' },
                  ].map(t => (
                    <a key={t.hint} href={`https://${t.hint}`} target="_blank" rel="noreferrer"
                       className="text-[10px] font-mono text-on-surface-variant/40 hover:text-primary transition-colors flex items-center gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>open_in_new</span>
                      {t.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Endpoint customizado (só para APIs compatíveis) */}
            {isCompat && (
              <div>
                <p className="label-caps text-[10px] opacity-60 mb-2">ENDPOINT DA API</p>

                {/* Atalhos */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMPAT_ENDPOINTS.map(ep => (
                    <button key={ep.id} type="button" onClick={() => applyEndpoint(ep)}
                      className="text-[10px] font-mono px-2.5 py-1 rounded border transition-all"
                      style={{
                        borderColor: endpoint === ep.url ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                        background: endpoint === ep.url ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface)',
                        color: endpoint === ep.url ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                      }}>
                      {ep.label}
                    </button>
                  ))}
                </div>

                <input type="text" value={endpoint}
                  onChange={e => { setEndpoint(e.target.value); setTestResult(null); setSaved(false) }}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all mb-2"
                  style={{ background: 'var(--color-surface)' }} />

                {/* Hint do endpoint selecionado */}
                {COMPAT_ENDPOINTS.find(e => e.url === endpoint)?.hint && (
                  <p className="text-[10px] font-mono text-on-surface-variant/35">
                    {COMPAT_ENDPOINTS.find(e => e.url === endpoint).hint}
                  </p>
                )}

                <p className="label-caps text-[10px] opacity-60 mb-2 mt-3">MODELO</p>
                <input type="text" value={model}
                  onChange={e => { setModel(e.target.value); setTestResult(null); setSaved(false) }}
                  placeholder="gpt-4o-mini"
                  className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all"
                  style={{ background: 'var(--color-surface)' }} />
              </div>
            )}

            {/* Resultado do teste */}
            {testResult && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
                testResult.success ? 'border-secondary/30 text-secondary' : 'border-error/30 text-error'
              }`}
              style={{
                background: testResult.success
                  ? 'color-mix(in srgb, var(--color-secondary) 6%, transparent)'
                  : 'color-mix(in srgb, var(--color-error) 6%, transparent)',
              }}>
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <span>{testResult.success ? 'Conexão bem-sucedida! Chave válida.' : testResult.error}</span>
              </div>
            )}

            {/* Rodapé: status + salvar */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/50">
              <div className="min-h-[20px]">
                {aiConfig?.apiKey && !isDirty && !saved && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    <span className="text-[10px] font-mono text-secondary/70">
                      {detectProviderFromKey(aiConfig.apiKey)?.name || 'API'} ativo
                    </span>
                  </div>
                )}
                {saved && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 14 }}>check</span>
                    <span className="text-[10px] font-mono text-secondary">Salvo com sucesso</span>
                  </div>
                )}
              </div>
              <button onClick={handleSave} disabled={!apiKey.trim() || !isDirty}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[11px] font-mono font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                SALVAR
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Supabase ── */}
        <SectionCard accentColor="tertiary" icon="database" title="Supabase" subtitle="Histórico de agentes e deploy de prompts" badge="OPCIONAL">
          <div className="space-y-3">
            <p className="text-[12px] font-mono text-on-surface-variant/60 leading-relaxed">
              Configure no arquivo <code className="text-primary/70">.env</code> para habilitar histórico e deploy.
            </p>
            <div className="rounded-lg border border-outline-variant p-4 space-y-2" style={{ background: 'var(--color-surface)' }}>
              <code className="block text-[11px] font-mono text-on-surface/70">VITE_SUPABASE_URL=https://seu-projeto.supabase.co</code>
              <code className="block text-[11px] font-mono text-on-surface/70">VITE_SUPABASE_ANON_KEY=sua-chave-anonima</code>
            </div>
            <p className="text-[10px] font-mono text-on-surface-variant/35">Após editar o .env, reinicie o servidor de desenvolvimento.</p>
          </div>
        </SectionCard>

      </div>
    </div>
  )
}
