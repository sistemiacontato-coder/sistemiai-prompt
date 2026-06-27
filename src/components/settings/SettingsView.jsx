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

const MODELS_BY_PROVIDER = {
  gemini:  ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'],
  claude:  ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  default: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo',
            'openai/gpt-4o-mini', 'openai/gpt-4o', 'openai/gpt-4.1-mini', 'openai/gpt-4.1',
            'claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022',
            'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro',
            'meta-llama/llama-3.3-70b-instruct', 'mistral-small-latest'],
}

function ModelSelector({ value, onChange, apiKey, endpoint, label, provider, defaultModel }) {
  const [isOpen, setIsOpen] = useState(false)
  const defaultList = MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.default
  const [models, setModels] = useState(defaultList)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    if (!apiKey || !endpoint) return
    const fetchModels = async () => {
      setLoading(true)
      try {
        const list = await fetchOpenAIModels(apiKey, endpoint)
        if (active && list?.length > 0) setModels(list)
      } catch {}
      finally { if (active) setLoading(false) }
    }
    const timer = setTimeout(fetchModels, 800)
    return () => { active = false; clearTimeout(timer) }
  }, [apiKey, endpoint])

  const filtered = models.filter(m => !value || m.toLowerCase().includes(value.toLowerCase()))

  return (
    <div className="space-y-1.5 relative">
      <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 uppercase">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder={`Ex: ${defaultModel || defaultList[0] || 'gpt-4o-mini'}`}
          className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all bg-surface"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {loading && <span className="material-symbols-outlined animate-spin text-on-surface-variant/40" style={{ fontSize: 13 }}>progress_activity</span>}
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>arrow_drop_down</span>
        </div>
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 left-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-high p-1 z-[99] shadow-2xl divide-y divide-outline-variant/30">
            {filtered.length === 0
              ? <div className="p-3 text-[10px] font-mono text-on-surface-variant/40 text-center">Nenhum modelo encontrado</div>
              : filtered.map(m => (
                <button key={m} type="button"
                  onClick={() => { onChange(m); setIsOpen(false) }}
                  className={`w-full text-left px-3 py-2 hover:bg-primary/15 hover:text-primary transition-colors text-[11px] font-mono block truncate ${value === m ? 'text-primary font-bold bg-primary/10' : 'text-on-surface-variant'}`}>
                  {m}
                </button>
              ))
            }
          </div>
        </>
      )}
    </div>
  )
}

// Retorna o endpoint a usar baseado na chave — zero configuração necessária
function getEffectiveEndpoint(detected, customEndpoint) {
  if (detected?.endpoint) return detected.endpoint          // OpenRouter, Groq, Mistral, Together
  if (detected?.provider === 'compat') return customEndpoint || 'https://api.openai.com/v1'
  return ''  // Claude e Gemini não usam endpoint aqui
}

function AIKeyBlock({ title, subtitle, badge, accentColor,
  apiKey, setApiKey, showKey, setShowKey,
  model, setModel,
  temperature, setTemperature,
  customEndpoint, setCustomEndpoint,
  testing, setTesting, testResult, setTestResult,
  defaultModel, fallbackKey,
}) {
  const detected = detectProviderFromKey(apiKey)
  const isCompat = detected?.provider === 'compat'
  const isGeneric = detected?.name === 'API Compatível'
  const needsCustomEndpoint = isGeneric  // só para APIs desconhecidas

  // Quando o provedor muda: preenche modelo se vazio, ou corrige formato OpenRouter → OpenAI
  useEffect(() => {
    if (!detected?.model) return
    if (!model || model.includes('/')) setModel(detected.model)
  }, [detected?.name])

  const effectiveEndpoint = getEffectiveEndpoint(detected, customEndpoint)

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    const result = await testAIConnection({
      provider: detected?.provider || 'compat',
      apiKey: apiKey.trim(),
      endpoint: effectiveEndpoint,
      model: model.trim() || (isCompat ? defaultModel || 'gpt-4o-mini' : ''),
    })
    setTestResult(result)
    setTesting(false)
  }

  return (
    <SectionCard accentColor={accentColor} icon="auto_awesome" title={title} subtitle={subtitle} badge={badge}>
      <div className="space-y-5">
        {/* Chave */}
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
                onChange={e => { setApiKey(e.target.value); setTestResult(null) }}
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

        {/* Endpoint auto-detectado — apenas informativo */}
        {apiKey && effectiveEndpoint && !needsCustomEndpoint && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/50"
               style={{ background: 'var(--color-surface)' }}>
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>link</span>
            <span className="text-[10px] font-mono text-on-surface-variant/50 truncate">{effectiveEndpoint}</span>
            <span className="ml-auto text-[9px] font-mono text-on-surface-variant/30 flex-shrink-0">auto</span>
          </div>
        )}

        {/* Endpoint customizado — só para provedores desconhecidos */}
        {needsCustomEndpoint && (
          <div>
            <p className="label-caps text-[10px] opacity-60 mb-2">ENDPOINT DA API</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMPAT_ENDPOINTS.map(ep => (
                <button key={ep.id} type="button"
                  onClick={() => { setCustomEndpoint(ep.url); setModel(ep.model); setTestResult(null) }}
                  className="text-[10px] font-mono px-2.5 py-1 rounded border transition-all"
                  style={{
                    borderColor: customEndpoint === ep.url ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                    background: customEndpoint === ep.url ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface)',
                    color: customEndpoint === ep.url ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  }}>
                  {ep.label}
                </button>
              ))}
            </div>
            <input type="text" value={customEndpoint}
              onChange={e => { setCustomEndpoint(e.target.value); setTestResult(null) }}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
              style={{ background: 'var(--color-surface)' }} />
          </div>
        )}

        {/* Modelo — para provedores compat e Gemini */}
        {(isCompat || detected?.provider === 'gemini') && (
          <ModelSelector
            label="MODELO"
            value={model}
            onChange={v => { setModel(v); setTestResult(null) }}
            apiKey={isCompat ? (apiKey || fallbackKey) : undefined}
            endpoint={isCompat ? effectiveEndpoint : undefined}
            provider={detected?.provider}
            defaultModel={defaultModel}
          />
        )}

        {/* Temperatura — só para provedores compat e quando setTemperature foi fornecido */}
        {isCompat && setTemperature && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 uppercase">Temperatura</label>
              <span className="text-[11px] font-mono font-bold text-primary tabular-nums">{(temperature ?? 0.2).toFixed(2)}</span>
            </div>
            <input
              type="range" min="0.01" max="1" step="0.01"
              value={temperature ?? 0.2}
              onChange={e => { setTemperature(parseFloat(e.target.value)); setTestResult(null) }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary"
              style={{ background: `linear-gradient(to right, var(--color-primary) ${(temperature ?? 0.2) * 100}%, var(--color-outline-variant) ${(temperature ?? 0.2) * 100}%)` }}
            />
            <div className="flex justify-between mt-1.5">
              {[
                { val: 0.1, label: 'Analítico' },
                { val: 0.4, label: 'Equilibrado' },
                { val: 0.8, label: 'Criativo' },
              ].map(p => (
                <button key={p.val} type="button"
                  onClick={() => { setTemperature(p.val); setTestResult(null) }}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all ${Math.abs((temperature ?? 0.2) - p.val) < 0.05 ? 'text-primary font-bold' : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resultado do teste */}
        {testResult && (
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
            testResult.success ? 'border-secondary/30 text-secondary' : 'border-error/30 text-error'
          }`}
          style={{ background: testResult.success ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)' }}>
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>
              {testResult.success ? 'check_circle' : 'error'}
            </span>
            <span>{testResult.success ? 'Conexão bem-sucedida!' : testResult.error}</span>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

export default function SettingsView({ aiConfig, onSaveAIConfig }) {
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [model, setModel] = useState(aiConfig?.model || '')
  const [temperature, setTemperature] = useState(typeof aiConfig?.temperature === 'number' ? aiConfig.temperature : 0.2)
  const [customEndpoint, setCustomEndpoint] = useState(aiConfig?.endpoint || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const [refinerApiKey, setRefinerApiKey] = useState(aiConfig?.refinerApiKey || '')
  const [refinerModel, setRefinerModel] = useState(aiConfig?.refinerModel || '')
  const [customRefinerEndpoint, setCustomRefinerEndpoint] = useState(aiConfig?.refinerEndpoint || '')
  const [showRefinerKey, setShowRefinerKey] = useState(false)
  const [testingRefiner, setTestingRefiner] = useState(false)
  const [testRefinerResult, setTestRefinerResult] = useState(null)

  const [scenarioApiKey, setScenarioApiKey] = useState(aiConfig?.scenarioApiKey || '')
  const [scenarioModel, setScenarioModel] = useState(aiConfig?.scenarioModel || '')
  const [customScenarioEndpoint, setCustomScenarioEndpoint] = useState(aiConfig?.scenarioEndpoint || '')
  const [showScenarioKey, setShowScenarioKey] = useState(false)
  const [testingScenario, setTestingScenario] = useState(false)
  const [testScenarioResult, setTestScenarioResult] = useState(null)

  const [saved, setSaved] = useState(false)

  const detected = detectProviderFromKey(apiKey)
  const detectedRefiner = detectProviderFromKey(refinerApiKey)
  const detectedScenario = detectProviderFromKey(scenarioApiKey)

  const effectiveEndpoint = getEffectiveEndpoint(detected, customEndpoint)
  const effectiveRefinerEndpoint = getEffectiveEndpoint(detectedRefiner, customRefinerEndpoint)
  const effectiveScenarioEndpoint = getEffectiveEndpoint(detectedScenario, customScenarioEndpoint)

  const currentConfig = {
    provider: detected?.provider || 'compat',
    apiKey: apiKey.trim(),
    endpoint: effectiveEndpoint,
    model: model.trim() || (detected?.model || 'gpt-4o-mini'),
    temperature,
    refinerApiKey: refinerApiKey.trim(),
    refinerEndpoint: effectiveRefinerEndpoint,
    refinerModel: refinerModel.trim() || (detectedRefiner?.model || 'gpt-4o-mini'),
    scenarioApiKey: scenarioApiKey.trim(),
    scenarioEndpoint: effectiveScenarioEndpoint,
    scenarioModel: scenarioModel.trim() || (detectedScenario?.model || ''),
  }

  const isDirty = apiKey !== (aiConfig?.apiKey || '')
    || model !== (aiConfig?.model || '')
    || temperature !== (typeof aiConfig?.temperature === 'number' ? aiConfig.temperature : 0.2)
    || effectiveEndpoint !== (aiConfig?.endpoint || '')
    || refinerApiKey !== (aiConfig?.refinerApiKey || '')
    || refinerModel !== (aiConfig?.refinerModel || '')
    || effectiveRefinerEndpoint !== (aiConfig?.refinerEndpoint || '')
    || scenarioApiKey !== (aiConfig?.scenarioApiKey || '')
    || scenarioModel !== (aiConfig?.scenarioModel || '')
    || effectiveScenarioEndpoint !== (aiConfig?.scenarioEndpoint || '')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAIConfig(currentConfig)
      onSaveAIConfig(currentConfig)
      setSaved(true)
      setTestResult(null)
      setTestRefinerResult(null)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5 pb-16">

        <div className="mb-2 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-on-surface leading-none">Configurações</h2>
            <p className="text-[11px] font-mono text-on-surface-variant/50 mt-1">SistemIA Prompt v1.0.0 · BotConversa</p>
          </div>
          {(isDirty || saveError) && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[11px] font-mono font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-60">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{saving ? 'hourglass_empty' : 'save'}</span>
              {saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
            </button>
          )}
        </div>

        <AIKeyBlock
          title="IA Engine Principal"
          subtitle="Chave usada para gerar e auditar prompts, e no simulador de conversas"
          badge="PRINCIPAL"
          accentColor="secondary"
          apiKey={apiKey} setApiKey={v => { setApiKey(v); setSaved(false) }}
          showKey={showKey} setShowKey={setShowKey}
          model={model} setModel={v => { setModel(v); setSaved(false) }}
          temperature={temperature} setTemperature={v => { setTemperature(v); setSaved(false) }}
          customEndpoint={customEndpoint} setCustomEndpoint={v => { setCustomEndpoint(v); setSaved(false) }}
          testing={testing} setTesting={setTesting}
          testResult={testResult} setTestResult={setTestResult}
          defaultModel="gpt-4o-mini"
        />

        <AIKeyBlock
          title="IA de Lapidação & Maturação"
          subtitle="Chave dedicada a reprocessar e corrigir o prompt a partir de feedbacks (opcional — usa a principal se vazio)"
          badge="LAPIDADOR"
          accentColor="primary"
          apiKey={refinerApiKey} setApiKey={v => { setRefinerApiKey(v); setSaved(false) }}
          showKey={showRefinerKey} setShowKey={setShowRefinerKey}
          model={refinerModel} setModel={v => { setRefinerModel(v); setSaved(false) }}
          customEndpoint={customRefinerEndpoint} setCustomEndpoint={v => { setCustomRefinerEndpoint(v); setSaved(false) }}
          testing={testingRefiner} setTesting={setTestingRefiner}
          testResult={testRefinerResult} setTestResult={setTestRefinerResult}
          defaultModel="gpt-4o"
          fallbackKey={apiKey}
        />

        <AIKeyBlock
          title="IA de Geração de Cenários"
          subtitle="Chave usada para gerar cenários de teste automaticamente — recomendamos Gemini Flash (gratuito). Usa a principal se vazio."
          badge="CENÁRIOS"
          accentColor="tertiary"
          apiKey={scenarioApiKey} setApiKey={v => { setScenarioApiKey(v); setSaved(false) }}
          showKey={showScenarioKey} setShowKey={setShowScenarioKey}
          model={scenarioModel} setModel={v => { setScenarioModel(v); setSaved(false) }}
          customEndpoint={customScenarioEndpoint} setCustomEndpoint={v => { setCustomScenarioEndpoint(v); setSaved(false) }}
          testing={testingScenario} setTesting={setTestingScenario}
          testResult={testScenarioResult} setTestResult={setTestScenarioResult}
          defaultModel="gemini-2.0-flash"
          fallbackKey={apiKey}
        />

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

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/60">
          <div>
            {saved && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>check</span>
                <span className="text-[11px] font-mono text-secondary">Salvo com sucesso!</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 16 }}>error</span>
                <span className="text-[11px] font-mono text-error">{saveError}</span>
              </div>
            )}
          </div>
          {(isDirty || saveError) && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-on-primary text-xs font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-all active:scale-95 disabled:opacity-60">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{saving ? 'hourglass_empty' : 'save'}</span>
              {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
