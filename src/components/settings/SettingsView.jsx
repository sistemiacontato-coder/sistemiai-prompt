import { useState, useEffect } from 'react'
import { COMPAT_ENDPOINTS, detectProviderFromKey, saveAIConfig, testAIConnection, fetchOpenAIModels } from '../../lib/claude'
import { isSupabaseConfigured } from '../../lib/supabase'

function SectionCard({ accentColor = 'primary', icon, title, subtitle, badge, children }) {
  return (
    <section className="rounded-lg border border-outline-variant"
             style={{ background: 'var(--color-surface-container)' }}>
      <div className="h-0.5 bg-gradient-to-r to-transparent rounded-t-lg"
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

function ModelSelector({ value, onChange, apiKey, endpoint, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState([
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!apiKey) return

    const fetchModels = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await fetchOpenAIModels(apiKey, endpoint)
        if (active && list && list.length > 0) {
          setModels(list)
        }
      } catch (err) {
        console.error('Erro ao buscar modelos:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(fetchModels, 800)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [apiKey, endpoint])

  const filtered = models.filter(m => 
    !value || m.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <div className="space-y-1.5 relative">
      <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 uppercase">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Ex: gpt-4o-mini"
          className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all bg-surface"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {loading && (
            <span className="material-symbols-outlined animate-spin text-on-surface-variant/40" style={{ fontSize: 13 }}>
              progress_activity
            </span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>
            arrow_drop_down
          </span>
        </div>
      </div>

      {error && <p className="text-[9px] font-mono text-error mt-0.5">{error}</p>}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 left-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-high p-1 z-[99] shadow-2xl divide-y divide-outline-variant/30">
            {filtered.length === 0 ? (
              <div className="p-3 text-[10px] font-mono text-on-surface-variant/40 text-center">Nenhum modelo encontrado</div>
            ) : (
              filtered.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onChange(m)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-primary/15 hover:text-primary transition-colors text-[11px] font-mono block truncate ${
                    value === m ? 'text-primary font-bold bg-primary/10' : 'text-on-surface-variant'
                  }`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SettingsView({ aiConfig, onSaveAIConfig }) {
  // Config Principal
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint || '')
  const [model, setModel] = useState(aiConfig?.model || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // Config Lapidador/Otimizador
  const [refinerApiKey, setRefinerApiKey] = useState(aiConfig?.refinerApiKey || '')
  const [refinerEndpoint, setRefinerEndpoint] = useState(aiConfig?.refinerEndpoint || '')
  const [refinerModel, setRefinerModel] = useState(aiConfig?.refinerModel || '')
  const [showRefinerKey, setShowRefinerKey] = useState(false)
  const [testingRefiner, setTestingRefiner] = useState(false)
  const [testRefinerResult, setTestRefinerResult] = useState(null)

  const [saved, setSaved] = useState(false)

  const detected = detectProviderFromKey(apiKey)
  const isCompat = detected?.provider === 'compat'

  const detectedRefiner = detectProviderFromKey(refinerApiKey)
  const isRefinerCompat = detectedRefiner?.provider === 'compat'

  // Quando a chave muda para um provedor com endpoint fixo (OpenRouter, Groq, etc.),
  // sempre sobrescreve o endpoint — evita endpoint errado de configuração anterior
  useEffect(() => {
    if (detected?.endpoint) {
      setEndpoint(detected.endpoint)
      if (!model) setModel(detected.model || '')
    }
  }, [detected?.name])

  useEffect(() => {
    if (detectedRefiner?.endpoint) {
      setRefinerEndpoint(detectedRefiner.endpoint)
      if (!refinerModel) setRefinerModel(detectedRefiner.model || 'gpt-4o')
    }
  }, [detectedRefiner?.name])

  const currentConfig = {
    provider: detected?.provider || 'compat',
    apiKey: apiKey.trim(),
    endpoint: endpoint.trim() || (isCompat ? 'https://api.openai.com/v1' : ''),
    model: model.trim() || (isCompat ? 'gpt-4o-mini' : ''),
    
    // Lapidador
    refinerApiKey: refinerApiKey.trim(),
    refinerEndpoint: refinerEndpoint.trim() || (isRefinerCompat ? 'https://api.openai.com/v1' : ''),
    refinerModel: refinerModel.trim() || (isRefinerCompat ? 'gpt-4o' : '')
  }

  const isDirty = apiKey !== (aiConfig?.apiKey || '')
    || endpoint !== (aiConfig?.endpoint || '')
    || model !== (aiConfig?.model || '')
    || refinerApiKey !== (aiConfig?.refinerApiKey || '')
    || refinerEndpoint !== (aiConfig?.refinerEndpoint || '')
    || refinerModel !== (aiConfig?.refinerModel || '')

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    const result = await testAIConnection({
      provider: currentConfig.provider,
      apiKey: currentConfig.apiKey,
      endpoint: currentConfig.endpoint,
      model: currentConfig.model
    })
    setTestResult(result)
    setTesting(false)
  }

  const handleTestRefiner = async () => {
    if (!refinerApiKey.trim()) return
    setTestingRefiner(true)
    setTestRefinerResult(null)
    const result = await testAIConnection({
      provider: detectedRefiner?.provider || 'compat',
      apiKey: currentConfig.refinerApiKey,
      endpoint: currentConfig.refinerEndpoint,
      model: currentConfig.refinerModel
    })
    setTestRefinerResult(result)
    setTestingRefiner(false)
  }

  const handleSave = () => {
    saveAIConfig(currentConfig)
    onSaveAIConfig(currentConfig)
    setSaved(true)
    setTestResult(null)
    setTestRefinerResult(null)
    setTimeout(() => setSaved(false), 3000)
  }

  const applyEndpoint = (ep) => {
    setEndpoint(ep.url)
    setModel(ep.model)
    setTestResult(null)
    setSaved(false)
  }

  const applyRefinerEndpoint = (ep) => {
    setRefinerEndpoint(ep.url)
    setRefinerModel(ep.model)
    setTestRefinerResult(null)
    setSaved(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5 pb-16">

        <div className="mb-2 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-on-surface leading-none">Configurações</h2>
            <p className="text-[11px] font-mono text-on-surface-variant/50 mt-1">SistemIA Prompt v1.0.0 · BotConversa</p>
          </div>
          {isDirty && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[11px] font-mono font-semibold hover:opacity-90 transition-all active:scale-95">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
              SALVAR CONFIGURAÇÕES
            </button>
          )}
        </div>

        {/* ── IA Engine Principal (Simulação / Bot) ── */}
        <SectionCard accentColor="secondary" icon="auto_awesome" title="IA Engine Principal" subtitle="Configure a chave usada no simulador de conversas do WhatsApp" badge="PRINCIPAL">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps text-[10px] opacity-60">CHAVE DE API PRINCIPAL</p>
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
                    placeholder="Cole sua chave aqui: sk-..."
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
                  {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
            </div>

            {isCompat && (
              <div className="space-y-4">
                <div>
                  <p className="label-caps text-[10px] opacity-60 mb-2">ENDPOINT CUSTOMIZADO (OPCIONAL)</p>
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
                    className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                    style={{ background: 'var(--color-surface)' }} />
                </div>

                <ModelSelector
                  label="MODELO PRINCIPAL"
                  value={model}
                  onChange={v => { setModel(v); setSaved(false) }}
                  apiKey={apiKey}
                  endpoint={endpoint}
                />
              </div>
            )}

            {testResult && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
                testResult.success ? 'border-secondary/30 text-secondary' : 'border-error/30 text-error'
              }`}
              style={{ background: testResult.success ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)' }}>
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <span>{testResult.success ? 'Conexão principal bem-sucedida!' : testResult.error}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── IA de Lapidação & Maturação ── */}
        <SectionCard accentColor="primary" icon="auto_awesome" title="IA de Lapidação & Maturação" subtitle="Configure a chave dedicada a reprocessar e corrigir o prompt a partir de feedbacks" badge="LAPIDADOR">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps text-[10px] opacity-60">CHAVE DE API DE LAPIDAÇÃO</p>
                {detectedRefiner && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: `var(--color-${detectedRefiner.color})` }}>{detectedRefiner.icon}</span>
                    <span className="text-[10px] font-mono font-semibold" style={{ color: `var(--color-${detectedRefiner.color})` }}>
                      {detectedRefiner.name} detectado
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-lg border border-outline-variant overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all"
                     style={{ background: 'var(--color-surface)' }}>
                  <input
                    type={showRefinerKey ? 'text' : 'password'}
                    value={refinerApiKey}
                    onChange={e => { setRefinerApiKey(e.target.value); setTestRefinerResult(null); setSaved(false) }}
                    placeholder="Deixe em branco para usar a chave principal, ou informe uma dedicada"
                    className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/25"
                  />
                  <button type="button" onClick={() => setShowRefinerKey(v => !v)}
                    className="px-3 py-3 border-l border-outline-variant text-on-surface-variant/50 hover:text-on-surface transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showRefinerKey ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <button onClick={handleTestRefiner} disabled={!refinerApiKey.trim() || testingRefiner}
                  className="flex items-center gap-1.5 px-3 py-3 rounded-lg border border-outline-variant text-[11px] font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ background: 'var(--color-surface)' }}>
                  {testingRefiner ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>
            </div>

            {isRefinerCompat && (
              <div className="space-y-4">
                <div>
                  <p className="label-caps text-[10px] opacity-60 mb-2">ENDPOINT DE LAPIDAÇÃO</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {COMPAT_ENDPOINTS.map(ep => (
                      <button key={ep.id} type="button" onClick={() => applyRefinerEndpoint(ep)}
                        className="text-[10px] font-mono px-2.5 py-1 rounded border transition-all"
                        style={{
                          borderColor: refinerEndpoint === ep.url ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          background: refinerEndpoint === ep.url ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface)',
                          color: refinerEndpoint === ep.url ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                        }}>
                        {ep.label}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={refinerEndpoint}
                    onChange={e => { setRefinerEndpoint(e.target.value); setTestRefinerResult(null); setSaved(false) }}
                    placeholder="https://api.openai.com/v1"
                    className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                    style={{ background: 'var(--color-surface)' }} />
                </div>

                <ModelSelector
                  label="MODELO DE LAPIDAÇÃO"
                  value={refinerModel}
                  onChange={v => { setRefinerModel(v); setSaved(false) }}
                  apiKey={refinerApiKey || apiKey}
                  endpoint={refinerEndpoint || endpoint}
                />
              </div>
            )}

            {testRefinerResult && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
                testRefinerResult.success ? 'border-secondary/30 text-secondary' : 'border-error/30 text-error'
              }`}
              style={{ background: testRefinerResult.success ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)' }}>
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>
                  {testRefinerResult.success ? 'check_circle' : 'error'}
                </span>
                <span>{testRefinerResult.success ? 'Conexão de lapidação bem-sucedida!' : testRefinerResult.error}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Banco de Dados ── */}
        <SectionCard accentColor="tertiary" icon="database" title="Banco de Dados" subtitle="Persistência automática de prompts gerados">
          <div className="flex items-center gap-3">
            {isSupabaseConfigured ? (
              <>
                <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.6)' }} />
                <p className="text-[12px] font-mono text-secondary">Conectado — prompts salvos automaticamente</p>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-error/60 flex-shrink-0" />
                <p className="text-[12px] font-mono text-on-surface-variant/50">Não conectado</p>
              </>
            )}
          </div>
        </SectionCard>

        {/* Rodapé geral para status de alteração */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/60">
          <div>
            {saved && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary animate-pulse" style={{ fontSize: 16 }}>check</span>
                <span className="text-[11px] font-mono text-secondary">Todas as alterações salvas com sucesso!</span>
              </div>
            )}
          </div>
          {isDirty && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-on-primary text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-all active:scale-95">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
              SALVAR ALTERAÇÕES
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
