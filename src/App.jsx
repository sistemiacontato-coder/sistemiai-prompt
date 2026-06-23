import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { isAuthenticated, logout as authLogout } from './lib/auth'
import LoginView from './components/LoginView'
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
import { deployAgent, updateAgent, renameAgent, fetchAgentHistory, deleteAgent, isSupabaseConfigured } from './lib/supabase'
import { analyzeAgentObjective, generateExitMessage, loadAIConfig, saveAIConfig, detectProviderFromKey } from './lib/claude'
import { reviewPromptChanges, refinePromptChanges } from './lib/promptReviewer'
import { auditPrompt } from './lib/promptAuditor'
import PromptAuditor from './components/output/PromptAuditor'
import { saveSnapshot, loadHistory, deleteSnapshot } from './lib/promptHistory'
import PromptVersionPanel from './components/history/PromptVersionPanel'
import SettingsView from './components/settings/SettingsView'
import ToneRulesPanel from './components/editor/ToneRulesPanel'
import SimulatorView from './components/simulator/SimulatorView'
import MensagemInicialPanel from './components/editor/MensagemInicialPanel'

const SETTINGS_DEFAULT = {
  enforceJson: true,
  lineBreakRules: true,
  communicationRules: true,
}

function SaveVersionModal({ isOpen, onClose, onSave, isSaving }) {
  const [description, setDescription] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    onSave(description)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-outline-variant w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ background: 'rgb(var(--color-surface-container))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent */}
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant"
             style={{ background: 'rgb(var(--color-surface-container-high))' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center"
               style={{ background: 'rgb(var(--color-primary) / 0.12)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
              cloud_upload
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-none">
              Salvar Nova Versão
            </h3>
            <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
              Identifique esta versão do prompt no histórico
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-on-surface-variant/40 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4" style={{ background: 'rgb(var(--color-surface-container))' }}>
          <div>
            <label className="label-caps block mb-1.5">DESCRIÇÃO / IDENTIFICADOR</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: V1 Estável, Ajuste de Variáveis"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/30"
            />
            <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1.5 leading-normal">
              Esta descrição ficará visível no histórico de versões para você restaurar quando quiser.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant"
             style={{ background: 'rgb(var(--color-surface-container-high))' }}>
          <button onClick={onClose} disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-outline-variant text-xs font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleConfirm}
            disabled={isSaving}
            className="px-5 py-2 bg-primary text-on-primary hover:opacity-90 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
            {isSaving && <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CustomDialogModal({ isOpen, type, message, placeholder, defaultValue, resolve, onClose }) {
  const [value, setValue] = useState(defaultValue || '')

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue || '')
    }
  }, [isOpen, defaultValue])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (type === 'prompt') {
      resolve(value)
    } else {
      resolve(true)
    }
    onClose()
  }

  const handleCancel = () => {
    if (type === 'prompt') {
      resolve(null)
    } else {
      resolve(false)
    }
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={handleCancel}
    >
      <div
        className="rounded-xl border border-outline-variant w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ background: 'rgb(var(--color-surface-container))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent */}
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant"
             style={{ background: 'rgb(var(--color-surface-container-high))' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center"
               style={{ background: 'rgb(var(--color-primary) / 0.12)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
              {type === 'prompt' ? 'edit' : type === 'confirm' ? 'help_outline' : 'info'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-none">
              {type === 'prompt' ? 'Entrada' : type === 'confirm' ? 'Confirmação' : 'Aviso'}
            </h3>
          </div>
          <button onClick={handleCancel} className="ml-auto text-on-surface-variant/40 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4" style={{ background: 'rgb(var(--color-surface-container))' }}>
          <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
            {message}
          </p>

          {type === 'prompt' && (
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder || 'Digite aqui...'}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/30"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant"
             style={{ background: 'rgb(var(--color-surface-container-high))' }}>
          {type !== 'alert' && (
            <button onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-outline-variant text-xs font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all">
              {type === 'prompt' ? 'Cancelar' : 'Não'}
            </button>
          )}
          <button onClick={handleConfirm}
            className="px-5 py-2 bg-primary text-on-primary hover:opacity-90 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95">
            {type === 'alert' ? 'OK' : type === 'prompt' ? 'Confirmar' : 'Sim'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthenticated())

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pm-theme')
    return saved ? saved === 'dark' : false
  })
  const [view, setView] = useState(() => {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
    const hashMap = { biblioteca: 'library', simulador: 'simulator', config: 'settings' }
    return hashMap[hash] || 'editor'
  })
  const [config, setConfig] = useState(getDefaultConfig)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [dialogState, setDialogState] = useState(null)

  const showDialog = useCallback(({ type, message, placeholder, defaultValue }) => {
    return new Promise((resolve) => {
      setDialogState({ type, message, placeholder, defaultValue, resolve })
    })
  }, [])

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

  useEffect(() => {
    setHistory(loadHistory())
  }, [view])
  const [generatingExitId, setGeneratingExitId] = useState(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'ok' | 'error' | null
  const [loadedAgentId, setLoadedAgentId] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [mensagemInicial, setMensagemInicial] = useState({
    textoFixo: '',
    instrucoesIndividuais: '',
    preInstrucaoIA: '',
  })
  const [pendingFixIssueIdx, setPendingFixIssueIdx] = useState(null)
  const [dismissedIssueTitles, setDismissedIssueTitles] = useState([])
  const [analyzeOptions, setAnalyzeOptions] = useState({
    includeNomeCliente: true,
    includeSaidaAtendente: true,
    includeSaidaEscopo: true,
    includeMultiIntencoes: true,
  })
  const settings = useMemo(() => ({
    ...SETTINGS_DEFAULT,
    multiIntencoes: analyzeOptions.includeMultiIntencoes,
  }), [analyzeOptions.includeMultiIntencoes])

  const agentKey = (config.agentName || '').trim()

  const filteredHistory = useMemo(() => {
    if (!agentKey) return []
    return history.filter(e => {
      // snapshots novos têm agentKey direto; snapshots antigos usam config.agentName
      const key = e.agentKey !== undefined
        ? e.agentKey
        : (e.config?.agentName || '').trim()
      return key === agentKey
    })
  }, [history, agentKey])
  const [sectionsRevealed, setSectionsRevealed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('pm-sidebar') === 'collapsed'
  )
  const promptRef = useRef(null)
  const skipNextDirtyRef = useRef(false)

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('pm-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  // Marca como "tem edições não salvas" quando o usuário edita após ter um agente salvo
  // (ignora mudanças que vêm de carregar um agente)
  useEffect(() => {
    if (skipNextDirtyRef.current) { skipNextDirtyRef.current = false; return }
    if (loadedAgentId) setIsDirty(true)
  }, [config])

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

  const VIEW_HASH = { editor: '', 'editor-v2': 'v2', library: 'biblioteca', simulator: 'simulador', settings: 'config' }

  useEffect(() => {
    const hash = VIEW_HASH[view] ? `#/${VIEW_HASH[view]}` : '#/'
    if (window.location.hash !== hash) window.location.hash = hash
  }, [view])

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
      const hashMap = { v2: 'editor-v2', biblioteca: 'library', simulador: 'simulator', config: 'settings' }
      const next = hashMap[hash] || 'editor'
      setView(prev => (prev !== next ? next : prev))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleSaveAIConfig = useCallback((cfg) => {
    saveAIConfig(cfg)
    setAIConfig(cfg)
  }, [])

  // Remove campos cujo valor proposto é idêntico ao atual — evita diffs vazios
  const filterIdenticalChanges = useCallback((changes, cfg) => {
    return {
      ...changes,
      new_agent_name:    changes.new_agent_name    && changes.new_agent_name.trim()    !== (cfg.agentName    || '').trim()    ? changes.new_agent_name    : '',
      new_agent_persona: changes.new_agent_persona && changes.new_agent_persona.trim() !== (cfg.agentPersona || '').trim()    ? changes.new_agent_persona : '',
      new_domain:        changes.new_domain        && changes.new_domain.trim()        !== (cfg.domain       || '').trim()    ? changes.new_domain        : '',
    }
  }, [])

  const handleReview = useCallback(async (instruction) => {
    setIsReviewing(true)
    setPendingChanges(null)
    try {
      const raw = await reviewPromptChanges(instruction, config, aiConfig)
      const changes = filterIdenticalChanges(raw, config)
      setPendingChanges({ ...changes, originalInstruction: instruction })
    } finally {
      setIsReviewing(false)
    }
  }, [config, aiConfig, filterIdenticalChanges])

  const handleApplyChanges = useCallback(() => {
    if (!pendingChanges) return

    const { new_agent_name, new_agent_persona, new_domain, add_variables, remove_variables, add_exits, remove_exits } = pendingChanges
    const baseId = Date.now()

    setConfig(prev => {
      const agentName    = new_agent_name    || prev.agentName
      const agentPersona = new_agent_persona || prev.agentPersona
      const domain       = new_domain        || prev.domain

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

      const newConfig = { ...prev, agentName, agentPersona, domain, variables, exitDestinations }
      const newPrompt = buildPrompt(newConfig, settings)
      setGeneratedPrompt(newPrompt)
      return newConfig
    })

    setPendingChanges(null)

    // Remove apenas o issue específico que foi corrigido; mantém o restante da auditoria visível
    setPendingFixIssueIdx(prev => {
      if (prev !== null) {
        setAuditResult(audit => {
          if (!audit) return null
          const remaining = audit.issues.filter((_, i) => i !== prev)
          if (remaining.length === 0) return null
          return { ...audit, issues: remaining }
        })
        return null
      }
      setAuditResult(null)
      return null
    })
  }, [pendingChanges, settings, config, generatedPrompt])

  const handleDiscardChanges = useCallback(() => {
    setPendingChanges(null)
  }, [])

  const handleDismissIssue = useCallback((idx) => {
    setAuditResult(prev => {
      if (!prev) return null
      const issue = prev.issues[idx]
      if (issue?.title) setDismissedIssueTitles(d => [...d, issue.title])
      const remaining = prev.issues.filter((_, i) => i !== idx)
      return { ...prev, issues: remaining }
    })
  }, [])

  const handleAudit = useCallback(async () => {
    setIsAuditing(true)
    setAuditResult(null)
    try {
      const result = await auditPrompt(generatedPrompt, config, aiConfig)
      // Filtra issues cujos títulos foram marcados como "correto" pelo usuário
      const filtered = dismissedIssueTitles.length > 0
        ? { ...result, issues: result.issues.filter(i => !dismissedIssueTitles.includes(i.title)) }
        : result
      setAuditResult(filtered)
    } catch (err) {
      setAuditResult({ issues: [], overallScore: null, summary: err.message, isError: true })
    } finally {
      setIsAuditing(false)
    }
  }, [generatedPrompt, config, aiConfig, dismissedIssueTitles])

  const handleRestoreIssues = useCallback(() => {
    setDismissedIssueTitles([])
    handleAudit()
  }, [handleAudit])

  const handleRefine = useCallback(async (correction) => {
    if (!pendingChanges) return
    setIsReviewing(true)
    try {
      const raw = await refinePromptChanges(correction, pendingChanges, config, aiConfig)
      const refined = filterIdenticalChanges(raw, config)
      setPendingChanges(refined)
    } finally {
      setIsReviewing(false)
    }
  }, [pendingChanges, config, aiConfig, filterIdenticalChanges])

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
      let newVars = result.variables.map((v, i) => ({
        id: baseId + i,
        name: (v.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14),
        type: v.type === 'enum' ? 'enum' : 'text',
        description: v.description || '',
        options: v.options || '',
        generated: true,
      })).filter(v => v.name)

      // Filtrar nome_cliente se desabilitado
      if (!analyzeOptions.includeNomeCliente) {
        newVars = newVars.filter(v => v.name !== 'nome_cliente')
      }

      const systemExits = config.exitDestinations.filter(e => e.isSystem)
      const defaultExits = config.exitDestinations.filter(e => e.isDefault)
      let newExits = result.exits.map((e, i) => {
        const key = (e.key || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
        return {
          id: baseId + 100 + i,
          key,
          label: e.label || key,
          description: normalizeCondition(e.description || ''),
          isDefault: false,
          generated: true,
          sendExitMessage: true,
          exitMessage: '',
        }
      }).filter(e => e.key.startsWith('saida_') && e.key !== 'saida_atendente')

      // Saída atendente: manter a existente ou criar nova se habilitado
      const existingAtendente = defaultExits.find(e => e.key === 'saida_atendente')
      const atendenteExit = analyzeOptions.includeSaidaAtendente
        ? (existingAtendente || {
            id: baseId + 200,
            key: 'saida_atendente',
            label: 'Atendente Humano',
            description: 'Interrompa a IA quando o cliente pedir para falar com um atendente humano, expressar insatisfação ou quando a situação exigir análise humana.',
            isDefault: true,
            generated: true,
            sendExitMessage: true,
            exitMessage: '',
          })
        : null

      // Saída fora do escopo: adicionar se habilitado
      if (analyzeOptions.includeSaidaEscopo) {
        newExits.push({
          id: baseId + 201,
          key: 'saida_fora_escopo',
          label: 'Fora do Escopo',
          description: 'Interrompa a IA quando o cliente fizer perguntas completamente fora do domínio de atendimento do agente.',
          isDefault: false,
          generated: true,
          sendExitMessage: false,
          exitMessage: '',
        })
      }

      // Reconstruir exits: sistema + success + atendente (se habilitado) + personalizadas
      const successExit = defaultExits.find(e => e.key === 'success') || config.exitDestinations.find(e => e.key === 'success')
      const builtExits = [
        ...systemExits,
        ...(successExit ? [successExit] : []),
        ...(atendenteExit ? [atendenteExit] : []),
        ...newExits,
      ]

      setSectionsRevealed(true)
      setConfig(prev => ({ ...prev, variables: newVars, exitDestinations: builtExits }))

      // Gerar mensagens apenas para saídas personalizadas com sendExitMessage
      const exitsNeedingMsg = newExits.filter(e => e.sendExitMessage)
      const messageResults = await Promise.allSettled(
        exitsNeedingMsg.map(exit =>
          generateExitMessage({
            exit,
            agentName: config.agentName,
            agentPersona: config.agentPersona,
            domain: config.domain,
            aiConfig,
          }).then(message => ({ key: exit.key, message }))
        )
      )

      const messages = messageResults.filter(r => r.status === 'fulfilled').map(r => r.value)
      if (messages.length > 0) {
        setConfig(prev => ({
          ...prev,
          exitDestinations: prev.exitDestinations.map(e => {
            const found = messages.find(m => m.key === e.key)
            return found ? { ...e, exitMessage: found.message } : e
          }),
        }))
      }

      const customExitCount = newExits.length + (atendenteExit && !existingAtendente ? 1 : 0)
      setAnalyzeResult({ vars: newVars.length, exits: customExitCount })
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
    if (view === 'library' || view === 'simulator') loadAgents()
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
      } finally {
        setIsGenerating(false)
      }
    }, 400)
  }, [config, settings])

  const handleDeleteAgent = useCallback(async (id) => {
    const ok = await showDialog({ type: 'confirm', message: 'Deseja realmente excluir este agente? Esta ação é irreversível.' })
    if (!ok) return
    try {
      await deleteAgent(id)
      setAgents(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('Erro ao excluir:', e)
    }
  }, [showDialog])

  const handleRenameAgent = useCallback(async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      const data = await renameAgent(id, trimmed)
      setAgents(prev => prev.map(a => a.id === id ? { ...a, agent_name: data.agent_name } : a))
    } catch (e) {
      console.error('Erro ao renomear:', e)
    }
  }, [])

  const handleLoadAgent = useCallback((agent, targetView = 'editor') => {
    const rawName = agent.agent_name || ''
    const cleanName = rawName.replace(/\s*\[[^\]]+\]$/, '')
    skipNextDirtyRef.current = true
    setConfig({
      agentName: cleanName,
      agentPersona: agent.agent_persona || '',
      domain: agent.domain || '',
      variables: agent.variables || [],
      exitDestinations: agent.exit_destinations || getDefaultConfig().exitDestinations,
      maxAttempts: agent.max_attempts || 3,
    })
    setGeneratedPrompt(agent.generated_prompt || '')
    setLoadedAgentId(agent.id || null)
    setIsDirty(false)
    setAuditResult(null)
    setAnalyzeResult(null)
    setPendingChanges(null)
    setSectionsRevealed(true)
    setView(targetView)
  }, [])

  const handleNewPrompt = useCallback(async () => {
    const ok = await showDialog({ type: 'confirm', message: 'Criar novo prompt? O editor atual será limpo.' })
    if (ok) {
      setConfig(getDefaultConfig())
      setGeneratedPrompt('')
      setValidationResults([])
      setAuditResult(null)
      setAnalyzeResult(null)
      setPendingChanges(null)
      setSectionsRevealed(false)
      setLoadedAgentId(null)
      setView('editor')
    }
  }, [showDialog])

  const handleLogout = useCallback(async () => {
    if (isDirty || (generatedPrompt && !loadedAgentId)) {
      const ok = await showDialog({ type: 'confirm', message: 'Há edições não salvas. Sair mesmo assim?' })
      if (!ok) return
    }
    authLogout()
    setAuthed(false)
  }, [isDirty, generatedPrompt, loadedAgentId, showDialog])

  const handleSaveToDatabase = useCallback(async () => {
    if (!generatedPrompt || isSaving) return
    if (loadedAgentId) {
      setIsSaving(true)
      setSaveStatus(null)
      try {
        if (isSupabaseConfigured) {
          const data = await updateAgent(loadedAgentId, { config, generatedPrompt })
          setAgents(prev => prev.map(a => a.id === data.id ? data : a))
        }
        setIsDirty(false)
        setSaveStatus('ok')
        setTimeout(() => setSaveStatus(null), 3000)
      } catch (err) {
        console.error('Erro ao salvar:', err)
        setSaveStatus('error')
        await showDialog({ type: 'alert', message: `Erro ao salvar: ${err.message}` })
        setTimeout(() => setSaveStatus(null), 6000)
      } finally {
        setIsSaving(false)
      }
    } else {
      setShowSaveModal(true)
    }
  }, [generatedPrompt, isSaving, loadedAgentId, config, isSupabaseConfigured, showDialog])

  const handleConfirmSave = useCallback(async (desc) => {
    const finalDesc = desc.trim() || `Versão salva — ${new Date().toLocaleDateString('pt-BR')}`
    setIsSaving(true)
    setSaveStatus(null)
    try {
      if (isSupabaseConfigured) {
        const data = await deployAgent({ config, generatedPrompt })
        setLoadedAgentId(data.id)
        setAgents(prev => [data, ...prev])
      }

      setIsDirty(false)
      setSaveStatus('ok')
      setShowSaveModal(false)
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      setSaveStatus('error')
      await showDialog({ type: 'alert', message: `Erro ao salvar: ${err.message}` })
      setTimeout(() => setSaveStatus(null), 6000)
    } finally {
      setIsSaving(false)
    }
  }, [config, generatedPrompt, isSupabaseConfigured, showDialog])

  const criticalCount = validationResults.filter(r => r.type === 'critical').length
  const canGenerate = criticalCount === 0

  if (!authed) {
    return <LoginView onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans">
      <TopNav
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
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
          {(view === 'editor' || view === 'editor-v2') && (
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

                  {/* Botão Salvar/Atualizar — alinhado à direita, acima da Identidade do Agente */}
                  {generatedPrompt && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveToDatabase}
                        disabled={isSaving || !isSupabaseConfigured}
                        title={isSupabaseConfigured ? (loadedAgentId ? 'Atualizar' : 'Salvar') : 'Banco offline'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={
                          isSaving ? { borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }
                          : saveStatus === 'ok' ? { borderColor: 'rgba(74,222,128,0.6)', color: '#4ade80', background: 'rgba(74,222,128,0.07)' }
                          : saveStatus === 'error' ? { borderColor: 'rgba(248,113,113,0.6)', color: '#f87171' }
                          : isDirty ? { borderColor: 'rgba(251,146,60,0.7)', color: '#fb923c', background: 'rgba(251,146,60,0.10)', boxShadow: '0 0 8px rgba(251,146,60,0.25)' }
                          : { borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }
                        }
                      >
                        <span className={`material-symbols-outlined ${isSaving ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>
                          {isSaving ? 'progress_activity' : saveStatus === 'ok' ? 'check_circle' : saveStatus === 'error' ? 'error' : loadedAgentId ? 'save' : 'cloud_upload'}
                        </span>
                        {isSaving ? 'Salvando...' : saveStatus === 'ok' ? 'Salvo!' : saveStatus === 'error' ? 'Erro' : loadedAgentId ? 'Atualizar' : 'Salvar'}
                      </button>
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

                        {/* Opções de geração — mesmo design que ToneRulesPanel */}
                        <section className="rounded-lg border border-outline-variant overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
                          <div className="h-0.5 bg-gradient-to-r from-tertiary/60 via-tertiary/20 to-transparent" />
                          <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
                               style={{ background: 'var(--color-surface-container-high)' }}>
                            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                                 style={{ background: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
                              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>auto_awesome</span>
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-on-surface leading-none">Geração Automática</h3>
                              <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Campos e saídas gerados pela IA ao analisar o objetivo</p>
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="space-y-2">
                              {[
                                { key: 'includeNomeCliente',    label: 'Campo: nome do cliente',          detail: 'Captura e armazena o nome do cliente na variável nome_cliente.' },
                                { key: 'includeSaidaAtendente', label: 'Saída: atendente humano',         detail: 'Gera saida_atendente como saída padrão de transferência para humano.' },
                                { key: 'includeSaidaEscopo',    label: 'Saída: perguntas fora do escopo', detail: 'Gera saida_fora_escopo para transferir quando cliente sai do domínio.' },
                              ].map(opt => {
                                const on = analyzeOptions[opt.key]
                                return (
                                  <div key={opt.key}
                                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-outline-variant/50 transition-all cursor-pointer"
                                    style={{
                                      background: on
                                        ? 'color-mix(in srgb, var(--color-tertiary) 4%, var(--color-surface-container-high))'
                                        : 'var(--color-surface-container-high)',
                                    }}
                                    onClick={() => setAnalyzeOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); setAnalyzeOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] })) }}
                                      className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${on ? 'bg-tertiary' : 'bg-outline-variant'}`}>
                                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[12px] font-mono font-semibold leading-none ${on ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>{opt.label}</p>
                                      <p className={`text-[10px] font-mono mt-0.5 leading-relaxed ${on ? 'text-on-surface-variant/55' : 'text-on-surface-variant/25'}`}>{opt.detail}</p>
                                    </div>
                                  </div>
                                )
                              })}

                              <div className="mt-3 pt-3 border-t border-outline-variant/30">
                                <p className="text-[9px] font-mono font-semibold tracking-widest uppercase text-on-surface-variant/35 mb-2 px-1">Regras do Prompt</p>
                                {(() => {
                                  const on = analyzeOptions.includeMultiIntencoes
                                  return (
                                    <div
                                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-outline-variant/50 transition-all cursor-pointer"
                                      style={{
                                        background: on
                                          ? 'color-mix(in srgb, var(--color-primary) 4%, var(--color-surface-container-high))'
                                          : 'var(--color-surface-container-high)',
                                      }}
                                      onClick={() => setAnalyzeOptions(prev => ({ ...prev, includeMultiIntencoes: !prev.includeMultiIntencoes }))}>
                                      <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setAnalyzeOptions(prev => ({ ...prev, includeMultiIntencoes: !prev.includeMultiIntencoes })) }}
                                        className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${on ? 'bg-primary' : 'bg-outline-variant'}`}>
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-[12px] font-mono font-semibold leading-none ${on ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>Regra: múltiplas intenções</p>
                                        <p className={`text-[10px] font-mono mt-0.5 leading-relaxed ${on ? 'text-on-surface-variant/55' : 'text-on-surface-variant/25'}`}>Instrui o agente a perguntar qual intenção priorizar quando o cliente mencionar mais de uma na mesma mensagem.</p>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          </div>
                        </section>

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

                        {/* Link para configurar manualmente sem usar IA */}
                        {!sectionsRevealed && (
                          <div className="flex justify-center pt-1">
                            <button
                              onClick={() => setSectionsRevealed(true)}
                              className="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>settings</span>
                              Configurar campos e saídas manualmente
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {sectionsRevealed && (
                    <>
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
                    </>
                  )}

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
                      onNavigateToSimulator={() => setView('simulator')}
                    />
                  </div>

                  {/* Auditoria de Prompt */}
                  {generatedPrompt && (
                    <PromptAuditor
                      onAudit={handleAudit}
                      isAuditing={isAuditing}
                      auditResult={auditResult}
                      aiConfig={aiConfig}
                      prompt={generatedPrompt}
                      config={config}
                      onDismissIssue={handleDismissIssue}
                      dismissedCount={dismissedIssueTitles.length}
                      onRestoreIssues={handleRestoreIssues}
                      onApplyFix={async (fix, issueIdx) => {
                        setPendingFixIssueIdx(issueIdx ?? null)
                        await handleReview(fix)
                      }}
                    />
                  )}

                  {/* Mensagem Inicial — Editor V2 */}
                  {view === 'editor-v2' && (
                    <MensagemInicialPanel
                      config={config}
                      mensagemInicial={mensagemInicial}
                      setMensagemInicial={setMensagemInicial}
                      aiConfig={aiConfig}
                    />
                  )}

                  {/* Histórico de Versões */}
                  <PromptVersionPanel
                    history={filteredHistory}
                    currentPrompt={generatedPrompt}
                    agentKey={agentKey}
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

          {view === 'simulator' && (
            <SimulatorView
              config={config}
              setConfig={setConfig}
              generatedPrompt={generatedPrompt}
              setGeneratedPrompt={setGeneratedPrompt}
              aiConfig={aiConfig}
              showDialog={showDialog}
              agents={agents}
            />
          )}

          {view === 'library' && (
            <HistoryPanel
              agents={agents}
              isLoading={isLoadingAgents}
              onLoad={handleLoadAgent}
              onDelete={handleDeleteAgent}
              onRename={handleRenameAgent}
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

      {showSaveModal && (
        <SaveVersionModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleConfirmSave}
          isSaving={isSaving}
        />
      )}

      {dialogState && (
        <CustomDialogModal
          isOpen={!!dialogState}
          type={dialogState.type}
          message={dialogState.message}
          placeholder={dialogState.placeholder}
          defaultValue={dialogState.defaultValue}
          resolve={dialogState.resolve}
          onClose={() => setDialogState(null)}
        />
      )}
    </div>
  )
}
