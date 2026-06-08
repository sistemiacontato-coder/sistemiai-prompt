import { useState, useCallback, useEffect, useRef } from 'react'
import TopNav from './components/TopNav'
import SideNav from './components/SideNav'
import AgentConfigPanel from './components/editor/AgentConfigPanel'
import VariableManager from './components/editor/VariableManager'
import ExitDestinations from './components/editor/ExitDestinations'
import PromptPreview from './components/output/PromptPreview'
import StateMachineMap from './components/output/StateMachineMap'
import ValidatorPanel from './components/output/ValidatorPanel'
import HistoryPanel from './components/history/HistoryPanel'
import { buildPrompt, getDefaultConfig, normalizeCondition } from './engine/promptBuilder'
import { validateConfig, hasCriticalErrors } from './engine/ruleValidator'
import { deployAgent, fetchAgentHistory, deleteAgent, isSupabaseConfigured } from './lib/supabase'
import { analyzeAgentObjective, generateExitMessage, loadAIConfig, saveAIConfig, detectProviderFromKey } from './lib/claude'
import { reviewPromptChanges, refinePromptChanges } from './lib/promptReviewer'
import { auditPrompt } from './lib/promptAuditor'
import PromptAuditor from './components/output/PromptAuditor'
import { saveSnapshot, loadHistory, deleteSnapshot } from './lib/promptHistory'
import PromptVersionPanel from './components/history/PromptVersionPanel'
import SettingsView from './components/settings/SettingsView'
import ToneRulesPanel from './components/editor/ToneRulesPanel'

const SETTINGS_DEFAULT = {
  enforceJson: true,
  lineBreakRules: true,
  communicationRules: true,
}

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pm-theme')
    return saved ? saved === 'dark' : true
  })
  const [view, setView] = useState('editor')
  const [config, setConfig] = useState(getDefaultConfig)
  const settings = SETTINGS_DEFAULT
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [validationResults, setValidationResults] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [agents, setAgents] = useState([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [hasAttemptedGenerate, setHasAttemptedGenerate] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [aiConfig, setAIConfig] = useState(() => loadAIConfig())
  const [pendingChanges, setPendingChanges] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [history, setHistory] = useState(() => loadHistory())
  const [generatingExitId, setGeneratingExitId] = useState(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('pm-sidebar') === 'collapsed'
  )
  const promptRef = useRef(null)

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('pm-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
      localStorage.setItem('pm-theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('pm-theme', 'light')
    }
  }, [isDark])

  const handleToggleTheme = useCallback(() => setIsDark(prev => !prev), [])

  const handleSaveAIConfig = useCallback((cfg) => {
    saveAIConfig(cfg)
    setAIConfig(cfg)
  }, [])

  const handleReview = useCallback(async (instruction) => {
    setIsReviewing(true)
    setPendingChanges(null)
    try {
      const changes = await reviewPromptChanges(instruction, config, aiConfig)
      setPendingChanges({ ...changes, originalInstruction: instruction })
    } finally {
      setIsReviewing(false)
    }
  }, [config, aiConfig])

  const handleApplyChanges = useCallback(() => {
    if (!pendingChanges) return

    if (generatedPrompt) {
      const updated = saveSnapshot({ config, prompt: generatedPrompt, description: pendingChanges.summary || 'Mudanças aplicadas pelo revisor' })
      setHistory(updated)
    }
    const { new_domain, add_variables, remove_variables, add_exits, remove_exits } = pendingChanges
    const baseId = Date.now()

    setConfig(prev => {
      const domain = new_domain || prev.domain

      let variables = prev.variables.filter(v => !remove_variables.includes(v.name))
      const newVars = add_variables
        .map((v, i) => ({
          id: baseId + i,
          name: (v.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14),
          type: v.type === 'enum' ? 'enum' : 'text',
          description: v.description || '',
          options: v.options || '',
          generated: true,
        }))
        .filter(v => v.name && !variables.some(e => e.name === v.name))
      variables = [...variables, ...newVars]

      let exitDestinations = prev.exitDestinations.filter(
        e => e.isSystem || e.isDefault || !remove_exits.includes(e.key)
      )
      const newExits = add_exits
        .map((e, i) => ({
          id: baseId + 100 + i,
          key: (e.key || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
          label: e.label || e.key,
          description: e.description || '',
          isDefault: false,
          isSystem: false,
          generated: true,
          sendExitMessage: false,
          exitMessage: '',
        }))
        .filter(e => e.key.startsWith('saida_') && !exitDestinations.some(ex => ex.key === e.key))
      exitDestinations = [...exitDestinations, ...newExits]

      const newConfig = { ...prev, domain, variables, exitDestinations }
      const newPrompt = buildPrompt(newConfig, settings)
      setGeneratedPrompt(newPrompt)
      if (isSupabaseConfigured) {
        deployAgent({ config: newConfig, generatedPrompt: newPrompt }).catch(() => {})
      }
      return newConfig
    })

    setPendingChanges(null)
    setAuditResult(null)
  }, [pendingChanges, settings, config, generatedPrompt])

  const handleDiscardChanges = useCallback(() => {
    setPendingChanges(null)
  }, [])

  const handleAudit = useCallback(async () => {
    setIsAuditing(true)
    setAuditResult(null)
    try {
      const result = await auditPrompt(generatedPrompt, config, aiConfig)
      setAuditResult(result)
    } catch (err) {
      setAuditResult({ issues: [], overallScore: null, summary: `Erro: ${err.message}` })
    } finally {
      setIsAuditing(false)
    }
  }, [generatedPrompt, config, aiConfig])

  const handleRefine = useCallback(async (correction) => {
    if (!pendingChanges) return
    setIsReviewing(true)
    try {
      const refined = await refinePromptChanges(correction, pendingChanges, config, aiConfig)
      setPendingChanges(refined)
    } finally {
      setIsReviewing(false)
    }
  }, [pendingChanges, config, aiConfig])

  const handleGenerateExitMessage = useCallback(async (exitId) => {
    const exit = config.exitDestinations.find(e => e.id === exitId)
    if (!exit) return
    setGeneratingExitId(exitId)
    try {
      const message = await generateExitMessage({
        exit,
        agentName: config.agentName,
        agentPersona: config.agentPersona,
        domain: config.domain,
        aiConfig,
      })
      setConfig(prev => ({
        ...prev,
        exitDestinations: prev.exitDestinations.map(e =>
          e.id === exitId ? { ...e, exitMessage: message, sendExitMessage: true } : e
        ),
      }))
    } catch (err) {
      console.error('Erro ao gerar mensagem de saída:', err.message)
    } finally {
      setGeneratingExitId(null)
    }
  }, [config, aiConfig])

  const handleAnalyzeObjective = useCallback(async () => {
    if (!config.domain.trim()) return
    setIsAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const result = await analyzeAgentObjective({
        agentName: config.agentName,
        domain: config.domain,
        aiConfig,
      })

      const baseId = Date.now()
      const newVars = result.variables.map((v, i) => ({
        id: baseId + i,
        name: (v.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14),
        type: v.type === 'enum' ? 'enum' : 'text',
        description: v.description || '',
        options: v.options || '',
        generated: true,
      })).filter(v => v.name)

      const systemExits = config.exitDestinations.filter(e => e.isSystem)
      const newExits = result.exits.map((e, i) => {
        const key = (e.key || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
        return {
          id: baseId + 100 + i,
          key,
          label: e.label || key,
          description: normalizeCondition(e.description || ''),
          isDefault: key === 'saida_atendente',
          generated: true,
          sendExitMessage: true,
          exitMessage: '',
        }
      }).filter(e => e.key.startsWith('saida_'))

      setConfig(prev => ({
        ...prev,
        variables: newVars,
        exitDestinations: [...systemExits, ...newExits],
      }))

      const messageResults = await Promise.allSettled(
        newExits.map(exit =>
          generateExitMessage({
            exit,
            agentName: config.agentName,
            agentPersona: config.agentPersona,
            domain: config.domain,
            aiConfig,
          }).then(message => ({ key: exit.key, message }))
        )
      )

      const messages = messageResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

      if (messages.length > 0) {
        setConfig(prev => ({
          ...prev,
          exitDestinations: prev.exitDestinations.map(e => {
            const found = messages.find(m => m.key === e.key)
            return found ? { ...e, exitMessage: found.message } : e
          }),
        }))
      }

      setAnalyzeResult({ vars: newVars.length, exits: newExits.length })
      setTimeout(() => setAnalyzeResult(null), 6000)
    } catch (err) {
      setAnalyzeResult({ error: err.message })
      setTimeout(() => setAnalyzeResult(null), 8000)
    } finally {
      setIsAnalyzing(false)
    }
  }, [config.domain, config.agentName, config.agentPersona, config.exitDestinations, aiConfig])

  useEffect(() => {
    const results = validateConfig(config)
    setValidationResults(results)
  }, [config])

  useEffect(() => {
    if (view === 'library') loadAgents()
  }, [view])

  const loadAgents = useCallback(async () => {
    if (!isSupabaseConfigured) { setAgents([]); return }
    setIsLoadingAgents(true)
    try {
      const data = await fetchAgentHistory()
      setAgents(data)
    } catch (e) {
      console.error('Erro ao carregar histórico:', e)
    } finally {
      setIsLoadingAgents(false)
    }
  }, [])

  const handleGenerate = useCallback(() => {
    const results = validateConfig(config)
    setValidationResults(results)
    setHasAttemptedGenerate(true)
    if (hasCriticalErrors(results)) return

    setIsGenerating(true)
    setTimeout(() => {
      try {
        const prompt = buildPrompt(config, settings)
        setGeneratedPrompt(prompt)
        setTimeout(() => promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
        if (isSupabaseConfigured) {
          deployAgent({ config, generatedPrompt: prompt }).catch(() => {})
        }
      } finally {
        setIsGenerating(false)
      }
    }, 400)
  }, [config, settings])

  const handleDeleteAgent = useCallback(async (id) => {
    if (!window.confirm('Excluir este agente?')) return
    try {
      await deleteAgent(id)
      setAgents(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('Erro ao excluir:', e)
    }
  }, [])

  const handleLoadAgent = useCallback((agent) => {
    setConfig({
      agentName: agent.agent_name || '',
      agentPersona: agent.agent_persona || '',
      domain: agent.domain || '',
      variables: agent.variables || [],
      exitDestinations: agent.exit_destinations || getDefaultConfig().exitDestinations,
      maxAttempts: agent.max_attempts || 3,
    })
    if (agent.generated_prompt) setGeneratedPrompt(agent.generated_prompt)
    setView('editor')
  }, [])

  const handleNewPrompt = useCallback(() => {
    if (window.confirm('Criar novo prompt? O editor atual será limpo.')) {
      setConfig(getDefaultConfig())
      setGeneratedPrompt('')
      setValidationResults([])
      setView('editor')
    }
  }, [])

  const criticalCount = validationResults.filter(r => r.type === 'critical').length
  const canGenerate = criticalCount === 0

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      <TopNav
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex h-screen pt-16">
        <SideNav
          view={view}
          setView={setView}
          onNewPrompt={handleNewPrompt}
          aiConfig={aiConfig}
          isCollapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />

        <main
          className="flex-1 overflow-hidden transition-all duration-200"
          style={{ marginLeft: sidebarCollapsed ? '64px' : '280px' }}
        >
          {view === 'editor' && (
            <div className="h-full grid grid-cols-12 overflow-hidden">
              {/* Painel Central — Editor */}
              <div className="col-span-8 h-full overflow-y-auto p-6 border-r border-outline-variant">
                <div className="max-w-3xl mx-auto space-y-4 pb-24">

                  {hasAttemptedGenerate && criticalCount > 0 && (
                    <div className="border border-outline-variant rounded px-4 py-3 flex items-center gap-3"
                         style={{ background: 'var(--color-surface-container-high)' }}>
                      <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">assignment_late</span>
                      <p className="text-[12px] font-mono text-on-surface-variant/70">
                        {criticalCount === 1
                          ? 'Há 1 campo obrigatório não preenchido.'
                          : `Há ${criticalCount} campos obrigatórios não preenchidos.`}
                      </p>
                    </div>
                  )}

                  <AgentConfigPanel config={config} setConfig={setConfig} />
                  <ToneRulesPanel config={config} setConfig={setConfig} />

                  {(() => {
                    const hasAIKey = !!aiConfig?.apiKey
                    const canAnalyze = config.domain.trim().length > 20 && hasAIKey && !isAnalyzing
                    const activeProvider = aiConfig?.apiKey ? detectProviderFromKey(aiConfig.apiKey) : null
                    return (
                      <div className="space-y-3">
                        <button
                          onClick={handleAnalyzeObjective}
                          disabled={!canAnalyze}
                          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg border-2 transition-all active:scale-[0.99] disabled:cursor-not-allowed"
                          style={{
                            borderColor: canAnalyze
                              ? 'color-mix(in srgb, var(--color-secondary) 60%, transparent)'
                              : 'var(--color-outline-variant)',
                            background: canAnalyze
                              ? 'color-mix(in srgb, var(--color-secondary) 8%, transparent)'
                              : 'transparent',
                            color: canAnalyze ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)',
                            opacity: !hasAIKey || (!isAnalyzing && !config.domain.trim()) ? 0.45 : 1,
                            boxShadow: canAnalyze
                              ? '0 4px 16px color-mix(in srgb, var(--color-secondary) 20%, transparent)'
                              : 'none',
                          }}
                        >
                          {isAnalyzing ? (
                            <>
                              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                              <span className="text-[12px] font-mono font-semibold">Analisando objetivo...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
                              <span className="text-[12px] font-mono font-semibold">ANALISAR E GERAR CAMPOS + SAÍDAS</span>
                            </>
                          )}
                        </button>

                        {analyzeResult && !analyzeResult.error && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                               style={{
                                 borderColor: 'color-mix(in srgb, var(--color-secondary) 40%, transparent)',
                                 background: 'color-mix(in srgb, var(--color-secondary) 8%, transparent)',
                               }}>
                            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>check_circle</span>
                            <p className="text-[11px] font-mono text-secondary">
                              {analyzeResult.vars} campo{analyzeResult.vars !== 1 ? 's' : ''} e{' '}
                              {analyzeResult.exits} saída{analyzeResult.exits !== 1 ? 's' : ''} gerados automaticamente
                            </p>
                          </div>
                        )}
                        {analyzeResult?.error && (
                          <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-error/30"
                               style={{ background: 'color-mix(in srgb, var(--color-error) 8%, transparent)' }}>
                            <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 16 }}>error</span>
                            <p className="text-[11px] font-mono text-error leading-relaxed">{analyzeResult.error}</p>
                          </div>
                        )}
                        {hasAIKey && activeProvider && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant/50 w-fit"
                               style={{ background: 'var(--color-surface-container-high)' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            <span className="text-[10px] font-mono text-on-surface-variant/60">
                              via <span className="text-secondary font-semibold">{activeProvider.name}</span>
                            </span>
                          </div>
                        )}
                        {!hasAIKey && (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-outline-variant/50"
                               style={{ background: 'var(--color-surface-container-high)' }}>
                            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>manufacturing</span>
                            <p className="text-[10px] font-mono text-on-surface-variant/50">
                              Configure uma IA em <span className="text-primary/70 font-semibold">Config IA</span> na barra lateral
                            </p>
                          </div>
                        )}
                        {hasAIKey && config.domain.trim().length <= 20 && (
                          <p className="text-[10px] font-mono text-on-surface-variant/35 text-center">
                            Descreva o objetivo com mais detalhes para habilitar a geração automática
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <VariableManager config={config} setConfig={setConfig} pendingChanges={pendingChanges} />
                  <ExitDestinations
                    config={config} setConfig={setConfig} pendingChanges={pendingChanges}
                    aiConfig={aiConfig} generatingExitId={generatingExitId}
                    onGenerateExitMessage={handleGenerateExitMessage}
                    hasGeneratedPrompt={!!generatedPrompt}
                    onRegeneratePrompt={handleGenerate}
                  />

                  {/* Botão de Geração */}
                  <div className="flex flex-col items-center py-6">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !canGenerate}
                      className={`px-12 py-4 rounded font-mono font-bold tracking-widest uppercase text-base
                        flex items-center gap-4 transition-all active:scale-95 relative overflow-hidden group
                        ${canGenerate
                          ? 'bg-primary text-on-primary technical-glow hover:opacity-95'
                          : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                        } disabled:opacity-60`}
                    >
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="material-symbols-outlined text-[28px]">
                        {isGenerating ? 'sync' : 'bolt'}
                      </span>
                      {isGenerating ? 'COMPILANDO...' : 'GERAR PROMPT'}
                    </button>
                  </div>

                  {/* Preview do Prompt Gerado */}
                  <div ref={promptRef}>
                    <PromptPreview
                      prompt={generatedPrompt}
                      pendingChanges={pendingChanges}
                      onReview={handleReview}
                      isReviewing={isReviewing}
                      onApplyChanges={handleApplyChanges}
                      onDiscardChanges={handleDiscardChanges}
                      onRefine={handleRefine}
                      aiConfig={aiConfig}
                      config={config}
                    />
                  </div>

                  {/* Auditoria de Prompt */}
                  {generatedPrompt && (
                    <PromptAuditor
                      onAudit={handleAudit}
                      isAuditing={isAuditing}
                      auditResult={auditResult}
                      aiConfig={aiConfig}
                      onApplyFix={async (fix) => {
                        await handleReview(fix)
                      }}
                    />
                  )}

                  {/* Histórico de Versões */}
                  <PromptVersionPanel
                    history={history}
                    currentPrompt={generatedPrompt}
                    onRevert={(entry) => {
                      setConfig({ ...getDefaultConfig(), ...entry.config })
                      setGeneratedPrompt(entry.prompt || '')
                      setPendingChanges(null)
                    }}
                    onHistoryChange={setHistory}
                  />
                </div>
              </div>

              {/* Painel Direito — Validator + State Machine */}
              <aside className="col-span-4 h-full bg-surface-container-low flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <div className="bg-surface-container border border-outline-variant rounded p-4">
                    <ValidatorPanel validationResults={validationResults} />
                  </div>
                  <div className="bg-surface-container border border-outline-variant rounded p-4">
                    <StateMachineMap exitDestinations={config.exitDestinations} />
                  </div>
                </div>
              </aside>
            </div>
          )}

          {view === 'library' && (
            <HistoryPanel
              agents={agents}
              isLoading={isLoadingAgents}
              onLoad={handleLoadAgent}
              onDelete={handleDeleteAgent}
              onRefresh={loadAgents}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              aiConfig={aiConfig}
              onSaveAIConfig={handleSaveAIConfig}
            />
          )}
        </main>
      </div>

      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[15%] right-[5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] left-[15%] w-[400px] h-[400px] bg-secondary/3 rounded-full blur-[120px]" />
      </div>
    </div>
  )
}
