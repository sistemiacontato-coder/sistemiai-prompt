import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { checkSession, logout as authLogout } from './lib/auth'
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
import { deployAgent, updateAgent, renameAgent, fetchAgentHistory, deleteAgent, isSupabaseConfigured, makeLogEntry } from './lib/supabase'
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

function AgentSelectorBar({ agents, loadedAgentId, currentName, view, onLoad, onSave, onSaveAs, onSimulate, onNew, isSaving, saveStatus, isDirty, isSupabaseConfigured }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = loadedAgentId
    ? (agents.find(a => a.id === loadedAgentId)?.agent_name || currentName || 'Agente')
    : (currentName || 'Novo agente')

  const saveLabel = isSaving ? 'Salvando...'
    : saveStatus === 'ok' ? 'Salvo!'
    : saveStatus === 'error' ? 'Erro'
    : loadedAgentId ? 'Atualizar'
    : 'Salvar novo prompt'

  const saveIcon = isSaving ? 'progress_activity'
    : saveStatus === 'ok' ? 'check_circle'
    : saveStatus === 'error' ? 'error'
    : loadedAgentId ? 'save' : 'cloud_upload'

  const saveBtnStyle = isSaving
    ? { borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }
    : saveStatus === 'ok'
    ? { borderColor: 'rgba(74,222,128,0.6)', color: '#4ade80', background: 'rgba(74,222,128,0.07)' }
    : saveStatus === 'error'
    ? { borderColor: 'rgba(248,113,113,0.6)', color: '#f87171' }
    : isDirty
    ? { borderColor: 'rgba(251,146,60,0.7)', color: '#fb923c', background: 'rgba(251,146,60,0.10)', boxShadow: '0 0 8px rgba(251,146,60,0.25)' }
    : { borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }

  return (
    <div className="flex items-center justify-between">
      {/* Seletor — alinhado à esquerda */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-outline-variant bg-surface-container hover:border-primary/50 transition-colors"
          style={{ minWidth: 150 }}
        >
          <span className="material-symbols-outlined text-primary/70 text-[15px] flex-shrink-0">smart_toy</span>
          <span className="text-[11px] font-mono font-semibold text-on-surface">{label}</span>
          <span className="material-symbols-outlined text-on-surface-variant/50 text-[14px] flex-shrink-0">{open ? 'expand_less' : 'expand_more'}</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-surface-container border border-outline-variant rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Novo agente */}
            <button
              onClick={() => { onNew?.(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[11px] font-mono transition-colors hover:bg-secondary/10 text-secondary border-b border-outline-variant/40"
            >
              <span className="material-symbols-outlined text-[14px] flex-shrink-0">add_circle</span>
              <span className="font-semibold">Novo agente</span>
            </button>
            <div className="px-3 py-1.5 border-b border-outline-variant/30">
              <p className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/40">Agentes salvos</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {agents.length === 0
                ? <p className="text-[11px] font-mono text-on-surface-variant/50 px-3 py-3">Nenhum agente salvo.</p>
                : agents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { onLoad(a, view); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[11px] font-mono transition-colors hover:bg-primary/10 ${a.id === loadedAgentId ? 'text-primary bg-primary/5' : 'text-on-surface'}`}
                  >
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 flex-shrink-0">
                      {a.id === loadedAgentId ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                    <span className="truncate">{a.agent_name}</span>
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Botões — alinhados à direita */}
      <div className="flex items-center gap-2">
        {/* Botão Simular — só aparece quando há agente salvo carregado */}
        {loadedAgentId && (
          <button
            onClick={onSimulate}
            title="Abrir no Simulador"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono font-semibold transition-all active:scale-95"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_circle</span>
            Simular
          </button>
        )}

        {isSupabaseConfigured && (
          <>
            {loadedAgentId && (
              <button onClick={onSaveAs} disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save_as</span>
                Salvar como
              </button>
            )}
            <button onClick={onSave} disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={saveBtnStyle}
            >
              <span className={`material-symbols-outlined ${isSaving ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>{saveIcon}</span>
              {saveLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
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
  const [authed, setAuthed] = useState(null) // null = verificando

  useEffect(() => {
    checkSession().then(ok => setAuthed(ok))
  }, [])

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
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null)
  const [configChangedAt, setConfigChangedAt] = useState(null)
  const isPromptStale = !!generatedPrompt && !!configChangedAt && !!lastGeneratedAt && configChangedAt > lastGeneratedAt
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
  const skipNextMensagemDirtyRef = useRef(true)
  const handleGenerateRef = useRef(null)

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('pm-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  // Marca dirty em qualquer edição (agente salvo ou novo)
  useEffect(() => {
    if (skipNextDirtyRef.current) { skipNextDirtyRef.current = false; return }
    setIsDirty(true)
    setConfigChangedAt(Date.now())
  }, [config])

  // Marca dirty quando mensagemInicial muda (Instruções Individuais, Pré-mensagem, etc.)
  useEffect(() => {
    if (skipNextMensagemDirtyRef.current) { skipNextMensagemDirtyRef.current = false; return }
    setIsDirty(true)
    setConfigChangedAt(Date.now())
  }, [mensagemInicial])

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
    } catch (err) {
      if (err.message === 'SEM_MUDANCAS' && isPromptStale) {
        // Info já está na config mas o prompt está desatualizado — regenerar
        setIsReviewing(false)
        handleGenerateRef.current?.()
        return
      }
      const msg = err.message === 'SEM_MUDANCAS'
        ? 'A IA não identificou mudanças necessárias para esta instrução.'
        : err.message
      throw new Error(msg)
    } finally {
      setIsReviewing(false)
    }
  }, [config, aiConfig, filterIdenticalChanges, isPromptStale])

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
    setLastGeneratedAt(Date.now())
    setConfigChangedAt(null)

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
    if (!authed) return
    if (view === 'library' || view === 'simulator' || view === 'editor' || view === 'editor-v2') loadAgents()
  }, [view, authed])

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
        const now = Date.now()
        setLastGeneratedAt(now)
        setConfigChangedAt(null)
        setTimeout(() => promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      } finally {
        setIsGenerating(false)
      }
    }, 400)
  }, [config, settings])
  handleGenerateRef.current = handleGenerate

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
    setLastGeneratedAt(Date.now())
    setConfigChangedAt(null)
    skipNextMensagemDirtyRef.current = true
    setMensagemInicial({ textoFixo: '', instrucoesIndividuais: '', preInstrucaoIA: '' })
    setAuditResult(null)
    setAnalyzeResult(null)
    setPendingChanges(null)
    setSectionsRevealed(true)
    setView(targetView)
  }, [])

  const handleNewPrompt = useCallback(async () => {
    const agentName = loadedAgentId
      ? (agents.find(a => a.id === loadedAgentId)?.agent_name || config.agentName || 'este agente')
      : null
    const message = agentName
      ? `O editor será limpo para um novo prompt em branco.\n\nO agente "${agentName}" continua salvo na Biblioteca — apenas edições não salvas serão descartadas.`
      : generatedPrompt
        ? 'O rascunho atual (não salvo) será descartado. Essa ação não pode ser desfeita.'
        : 'Iniciar um novo prompt em branco?'
    const ok = await showDialog({ type: 'confirm', message })
    if (ok) {
      skipNextDirtyRef.current = true
      skipNextMensagemDirtyRef.current = true
      setConfig(getDefaultConfig())
      setGeneratedPrompt('')
      setValidationResults([])
      setAuditResult(null)
      setAnalyzeResult(null)
      setPendingChanges(null)
      setSectionsRevealed(false)
      setLoadedAgentId(null)
      setIsDirty(false)
      setLastGeneratedAt(null)
      setConfigChangedAt(null)
      setMensagemInicial({ textoFixo: '', instrucoesIndividuais: '', preInstrucaoIA: '' })
      setView('editor')
    }
  }, [showDialog, loadedAgentId, agents, config.agentName, generatedPrompt])

  const handleLogout = useCallback(async () => {
    if (isDirty || (generatedPrompt && !loadedAgentId)) {
      const ok = await showDialog({ type: 'confirm', message: 'Há edições não salvas. Sair mesmo assim?' })
      if (!ok) return
    }
    await authLogout()
    setAuthed(false)
  }, [isDirty, generatedPrompt, loadedAgentId, showDialog])

  const handleSaveToDatabase = useCallback(async () => {
    if (!generatedPrompt || isSaving) return
    if (loadedAgentId) {
      setIsSaving(true)
      setSaveStatus(null)
      try {
        if (isSupabaseConfigured) {
          const currentLogs = agents.find(a => a.id === loadedAgentId)?.logs || []
          const data = await updateAgent(loadedAgentId, { config, generatedPrompt, logs: currentLogs, logAction: 'Salvo manualmente' })
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
  }, [generatedPrompt, isSaving, loadedAgentId, config, agents, isSupabaseConfigured, showDialog])

  const handleConfirmSave = useCallback(async (desc) => {
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

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    )
  }

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
              <div className="col-span-8 h-full overflow-y-auto border-r border-outline-variant">
                {/* Barra sticky: seletor de agente + botões de salvar */}
                <div className="sticky top-0 z-20 px-6 py-3 border-b border-outline-variant bg-background backdrop-blur-sm">
                  <AgentSelectorBar
                    agents={agents}
                    loadedAgentId={loadedAgentId}
                    currentName={config.agentName}
                    view={view}
                    onLoad={handleLoadAgent}
                    onSave={handleSaveToDatabase}
                    onSaveAs={() => setShowSaveModal(true)}
                    onSimulate={() => setView('simulator')}
                    onNew={handleNewPrompt}
                    isSaving={isSaving}
                    saveStatus={saveStatus}
                    isDirty={isDirty}
                    isSupabaseConfigured={isSupabaseConfigured}
                  />
                </div>
                <div className="p-6">
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
                            opacity: 1,
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
                          ) : canAnalyze ? (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
                              <span className="text-[12px] font-mono font-semibold">ANALISAR E GERAR CAMPOS + SAÍDAS</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>do_not_disturb_on</span>
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
                        {/* Requisitos para habilitar o botão */}
                        {!canAnalyze && !isAnalyzing && (() => {
                          const domainLen = config.domain.trim().length
                          const MIN_CHARS = 21
                          const reasons = []
                          if (!hasAIKey) reasons.push({ icon: 'key', text: 'Chave de IA não configurada', detail: 'Acesse Config IA na barra lateral e insira sua chave de API.', color: 'error' })
                          if (hasAIKey && domainLen < MIN_CHARS) reasons.push({ icon: 'edit_note', text: `Objetivo muito curto (${domainLen}/${MIN_CHARS} caracteres)`, detail: `Descreva o que o agente faz com mais detalhes. Faltam ${MIN_CHARS - domainLen} caractere${MIN_CHARS - domainLen !== 1 ? 's' : ''}.`, color: 'tertiary', progress: domainLen / MIN_CHARS })
                          return (
                            <div className="space-y-2">
                              {reasons.map((r, i) => (
                                <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-lg border"
                                     style={{ borderColor: `rgb(var(--color-${r.color}) / 0.35)`, background: `rgb(var(--color-${r.color}) / 0.07)` }}>
                                  <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 16, color: `rgb(var(--color-${r.color}))` }}>{r.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-mono font-semibold" style={{ color: `rgb(var(--color-${r.color}))` }}>{r.text}</p>
                                    <p className="text-[10px] font-mono text-on-surface-variant/60 mt-0.5 leading-relaxed">{r.detail}</p>
                                    {r.progress !== undefined && (
                                      <div className="mt-2 h-1 rounded-full bg-outline-variant/40 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(r.progress * 100, 100)}%`, background: `rgb(var(--color-${r.color}))` }} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}

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
                        {!generatedPrompt ? (
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
                        ) : (
                          isPromptStale ? (
                            <button
                              onClick={handleGenerate}
                              disabled={isGenerating || !canGenerate}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all active:scale-95 animate-pulse disabled:opacity-40"
                              style={{
                                borderColor: 'rgba(251,146,60,0.6)',
                                color: '#fb923c',
                                background: 'rgba(251,146,60,0.10)',
                                boxShadow: '0 0 8px rgba(251,146,60,0.20)',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                {isGenerating ? 'sync' : 'sync_problem'}
                              </span>
                              {isGenerating ? 'Regenerando...' : 'Configuração alterada — Regenerar prompt'}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                const ok = await showDialog({ type: 'confirm', message: 'Regenerar o prompt a partir das configurações atuais?\n\nIsso vai sobrescrever o prompt atual, incluindo edições manuais e ajustes do simulador.' })
                                if (ok) handleGenerate()
                              }}
                              disabled={isGenerating || !canGenerate}
                              className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface-variant/35 hover:text-on-surface-variant/60 transition-colors disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                {isGenerating ? 'sync' : 'refresh'}
                              </span>
                              {isGenerating ? 'Regenerando...' : 'Regenerar prompt'}
                            </button>
                          )
                        )}
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
                </div>{/* /p-6 */}
              </div>

              {/* Painel Direito — Validator + State Machine + Campos */}
              <aside className="col-span-4 h-full bg-surface-container-low flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <div className="bg-surface-container border border-outline-variant rounded p-4">
                    <ValidatorPanel validationResults={validationResults} />
                  </div>
                  <div className="bg-surface-container border border-outline-variant rounded p-4">
                    <StateMachineMap exitDestinations={config.exitDestinations} />
                  </div>
                  {/* Campos personalizados capturados */}
                  {config.variables?.filter(v => v.name?.trim()).length > 0 && (
                    <div className="bg-surface-container border border-outline-variant rounded overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/50"
                           style={{ background: 'var(--color-surface-container-high)' }}>
                        <span className="material-symbols-outlined text-secondary/70 text-[16px]">database</span>
                        <span className="text-[10px] font-mono font-semibold text-on-surface-variant/60 tracking-wider uppercase">
                          Campos Capturados
                        </span>
                        <span className="ml-auto text-[9px] font-mono text-on-surface-variant/40 bg-outline-variant/20 px-1.5 py-0.5 rounded">
                          {config.variables.filter(v => v.name?.trim()).length}
                        </span>
                      </div>
                      <div className="divide-y divide-outline-variant/20">
                        {config.variables.filter(v => v.name?.trim()).map(v => {
                          const isEnum = v.type === 'enum'
                          const opts = isEnum ? (v.options || '').split('\n').map(l => l.trim()).filter(Boolean) : []
                          return (
                            <div key={v.id} className="px-4 py-3 flex items-start gap-3">
                              <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
                                   style={{ background: isEnum ? 'rgba(var(--color-tertiary)/0.12)' : 'rgba(var(--color-secondary)/0.12)' }}>
                                <span className="material-symbols-outlined text-[13px]"
                                      style={{ color: isEnum ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-secondary))' }}>
                                  {isEnum ? 'list' : 'text_fields'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <code className="text-[11px] font-mono font-semibold text-primary">{v.name}</code>
                                  <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded"
                                        style={{
                                          background: isEnum ? 'rgba(var(--color-tertiary)/0.12)' : 'rgba(var(--color-secondary)/0.12)',
                                          color: isEnum ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-secondary))'
                                        }}>
                                    {isEnum ? 'enum' : 'texto'}
                                  </span>
                                </div>
                                {isEnum && opts.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {opts.slice(0, 6).map((o, i) => (
                                      <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-outline-variant/30 text-on-surface-variant/70">
                                        {o}
                                      </span>
                                    ))}
                                    {opts.length > 6 && (
                                      <span className="text-[9px] font-mono text-on-surface-variant/40">+{opts.length - 6}</span>
                                    )}
                                  </div>
                                ) : v.description ? (
                                  <p className="text-[10px] font-mono text-on-surface-variant/55 leading-snug line-clamp-2">
                                    {v.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
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
              loadedAgentId={loadedAgentId}
              onAgentUpdated={(data) => setAgents(prev => prev.map(a => a.id === data.id ? data : a))}
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
              onRestoreLogPrompt={(prompt) => {
                setGeneratedPrompt(prompt)
                setView('editor')
              }}
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
