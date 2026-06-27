import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { runTestSuite, runTestCase, refineConfigWithFeedback, refineAdjustment } from '../../lib/promptTuner'
import { generateTestScenarios } from '../../lib/scenarioGenerator'
import { buildPrompt } from '../../engine/promptBuilder'
import { detectProviderFromKey, fetchOpenAIModels, detectProviderFromModel } from '../../lib/claude'
import { loadHistory, saveSnapshot } from '../../lib/promptHistory'
import { diffLines } from '../../lib/promptDiff'
import { deployAgent, updateAgent, isSupabaseConfigured, makeLogEntry, saveAgentExamples } from '../../lib/supabase'


function ModelSelector({ value, onChange, apiKey, endpoint }) {
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState([
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
  ])
  const [search, setSearch] = useState('')
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

  const filtered = models.filter(m => m.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-1 relative">
      <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60">MODELO DE IA</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Ex: gpt-4o-mini"
          className="w-full text-[11px] font-mono bg-surface border border-outline-variant rounded px-2.5 py-1.5 focus:outline-none focus:border-primary pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {loading && (
            <span className="material-symbols-outlined animate-spin text-on-surface-variant/40" style={{ fontSize: 12 }}>
              progress_activity
            </span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>
            arrow_drop_down
          </span>
        </div>
      </div>

      {error && <p className="text-[9px] font-mono text-error mt-0.5">{error}</p>}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 left-0 mt-1 max-h-56 overflow-y-auto rounded border border-outline-variant bg-surface-container-high p-2.5 z-50 shadow-xl space-y-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full bg-surface text-[11px] font-mono border border-outline-variant rounded px-2 py-1 focus:outline-none focus:border-primary"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto divide-y divide-outline-variant/30 font-mono text-[10px]">
              {filtered.length === 0 ? (
                <div className="p-1.5 text-on-surface-variant/40 text-center">Nenhum modelo</div>
              ) : (
                filtered.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(m)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-2 py-1.5 hover:bg-primary/15 hover:text-primary transition-colors block truncate ${
                      value === m ? 'text-primary font-bold bg-primary/10' : 'text-on-surface-variant'
                    }`}
                  >
                    {m}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Modelo vazio = usa o modelo configurado em Configurações (sempre compatível com a chave)
const DEFAULT_PRESETS = [
  { id: 'creative', name: 'Criativo (Temp 1.0)', model: '', temperature: 1.0, isDefault: false },
  { id: 'balanced', name: 'Balanceado (Temp 0.5)', model: '', temperature: 0.5, isDefault: true },
  { id: 'precise', name: 'Preciso (Temp 0.1)', model: '', temperature: 0.1, isDefault: false }
]

export default function SimulatorView({ config, setConfig, generatedPrompt, setGeneratedPrompt, aiConfig, showDialog, agents = [], loadedAgentId, onAgentUpdated }) {
  const [promptSource, setPromptSource] = useState('current')

  // historyList construído a partir dos agentes do Supabase (sem duplicatas, sem localStorage)
  const historyList = useMemo(() => {
    const seen = new Set()
    return (agents || []).filter(a => {
      if (!a.agent_name || seen.has(a.agent_name)) return false
      seen.add(a.agent_name)
      return true
    }).map(a => ({
      id: a.id,
      agentKey: a.agent_name,
      description: a.agent_name,
      prompt: a.generated_prompt || '',
      domain: a.domain || '',
      variables: a.variables || [],
      exitDestinations: a.exit_destinations || [],
    }))
  }, [agents])

  const activePromptText = useMemo(() => {
    if (promptSource === 'current') return generatedPrompt || ''
    const found = historyList.find(h => h.id?.toString() === promptSource?.toString())
    return found ? found.prompt : ''
  }, [promptSource, historyList, generatedPrompt])

  // Config efetivo: usa o agente salvo quando não está no modo 'current'
  const activeConfig = useMemo(() => {
    if (promptSource === 'current') return config
    const found = historyList.find(h => h.id?.toString() === promptSource?.toString())
    if (!found) return config
    return {
      ...config,
      domain: found.domain,
      variables: found.variables,
      exitDestinations: found.exitDestinations,
    }
  }, [promptSource, historyList, config])

  // Exemplos de classificação persistidos no Supabase
  const [savedExamples, setSavedExamples] = useState([])

  useEffect(() => {
    const agentId = promptSource === 'current' ? loadedAgentId : promptSource
    if (!agentId) { setSavedExamples([]); return }
    const agent = agents.find(a => a.id?.toString() === agentId?.toString())
    setSavedExamples(agent?.classification_examples || [])
  }, [promptSource, loadedAgentId, agents])

  const activeAgentId = promptSource === 'current' ? loadedAgentId : promptSource

  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'automated'
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('pm-test-presets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {}
    }
    return DEFAULT_PRESETS
  })

  const [activePresetId, setActivePresetId] = useState(() => {
    const saved = localStorage.getItem('pm-test-presets')
    let list = DEFAULT_PRESETS
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed
      } catch {}
    }
    const def = list.find(p => p.isDefault)
    return def ? def.id : (list[0]?.id || '')
  })

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === activePresetId)
  }, [presets, activePresetId])

  const [model, setModel] = useState(() => {
    if (config?.testModel) return config.testModel
    const saved = localStorage.getItem('pm-test-presets')
    let list = DEFAULT_PRESETS
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed
      } catch {}
    }
    const def = list.find(p => p.isDefault)
    // modelo vazio = usa o de Configurações em targetModelConfig
    return def ? (def.model || '') : ''
  })

  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('pm-test-presets')
    let list = DEFAULT_PRESETS
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed
      } catch {}
    }
    const def = list.find(p => p.isDefault)
    return def ? def.temperature : 0.1
  })

  // Sincronizar o modelo quando carregar outro rascunho
  useEffect(() => {
    if (config?.testModel && config.testModel !== model) {
      setModel(config.testModel)
    }
  }, [config?.testModel])

  // Persistir presets no LocalStorage
  useEffect(() => {
    localStorage.setItem('pm-test-presets', JSON.stringify(presets))
  }, [presets])

  const [isEditingPreset, setIsEditingPreset] = useState(false)
  const [editPresetName, setEditPresetName] = useState('')
  const [originalPresetValues, setOriginalPresetValues] = useState(null)

  // Cancelar modo edição ao mudar de aba
  const handleCancelEditPreset = useCallback(() => {
    if (originalPresetValues) {
      setModel(originalPresetValues.model)
      setTemperature(originalPresetValues.temperature)
      setConfig(c => ({ ...c, testModel: originalPresetValues.model }))
    }
    setIsEditingPreset(false)
    setOriginalPresetValues(null)
  }, [originalPresetValues, setConfig])

  useEffect(() => {
    if (isEditingPreset && originalPresetValues) {
      setModel(originalPresetValues.model)
      setTemperature(originalPresetValues.temperature)
      setConfig(c => ({ ...c, testModel: originalPresetValues.model }))
      setIsEditingPreset(false)
      setOriginalPresetValues(null)
    }
  }, [activeTab])

  // Handlers para presets
  const handleSavePreset = async () => {
    const name = await showDialog({ type: 'prompt', message: "Digite o nome para o novo preset de teste:" })
    if (!name || !name.trim()) return
    const newId = Date.now().toString()
    const newPreset = {
      id: newId,
      name: name.trim(),
      model: model,
      temperature: temperature,
      isDefault: false
    }
    setPresets(prev => [...prev, newPreset])
    setActivePresetId(newId)
  }

  const handleStartEditPreset = () => {
    const p = presets.find(pr => pr.id === activePresetId)
    if (!p) return
    setOriginalPresetValues({ name: p.name, model: model, temperature: temperature })
    setEditPresetName(p.name)
    setIsEditingPreset(true)
  }

  const handleSavePresetEdits = () => {
    if (!editPresetName.trim()) return
    setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, name: editPresetName.trim(), model, temperature } : p))
    setIsEditingPreset(false)
    setOriginalPresetValues(null)
  }

  const handleToggleDefaultPreset = async () => {
    setPresets(prev => prev.map(p => ({
      ...p,
      isDefault: p.id === activePresetId
    })))
    await showDialog({ type: 'alert', message: "Este preset foi configurado como padrão inicial!" })
  }

  const handleDeletePreset = async () => {
    if (presets.length <= 1) return
    const ok = await showDialog({ type: 'confirm', message: "Tem certeza de que deseja excluir este preset de teste?" })
    if (!ok) return
    const index = presets.findIndex(p => p.id === activePresetId)
    const nextActive = presets[index === 0 ? 1 : index - 1]
    setPresets(prev => prev.filter(p => p.id !== activePresetId))
    setActivePresetId(nextActive.id)
    setModel(nextActive.model)
    setTemperature(nextActive.temperature)
    setConfig(prev => ({ ...prev, testModel: nextActive.model }))
  }

  const handleSelectPreset = (nextId) => {
    if (isEditingPreset) {
      setIsEditingPreset(false)
      setOriginalPresetValues(null)
    }
    setActivePresetId(nextId)
    const p = presets.find(pr => pr.id === nextId)
    if (p) {
      setModel(p.model)
      setTemperature(p.temperature)
      setConfig(prev => ({ ...prev, testModel: p.model }))
    }
  }

  const handleModelChange = (newModel) => {
    setModel(newModel)
    setConfig(prev => ({ ...prev, testModel: newModel }))
    if (activePresetId) {
      setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, model: newModel } : p))
    }
  }

  // Usa exatamente o que está configurado em Configurações — sem nenhum valor pré-definido
  const targetModelConfig = useMemo(() => {
    const mainKey = aiConfig?.apiKey
    const mainDetected = detectProviderFromKey(mainKey)
    const mainProvider = mainDetected?.provider || 'compat'
    const mainEndpoint = mainDetected?.endpoint || aiConfig?.endpoint
    // Modelo: o que o usuário digitou no simulador, senão o de Configurações — nunca hardcoda
    const resolvedModel = (model && model.trim()) || (aiConfig?.model || '').trim()
    return { provider: mainProvider, apiKey: mainKey, endpoint: mainEndpoint, model: resolvedModel, temperature }
  }, [aiConfig, model, temperature])

  // Chaves corretas para o ModelSelector buscar a lista oficial de modelos
  const selectorApiKey = useMemo(() => {
    const mainKey = aiConfig?.apiKey
    const refinerKey = aiConfig?.refinerApiKey
    if (mainKey && (mainKey.startsWith('sk-') || mainKey.startsWith('gsk_'))) return mainKey
    if (refinerKey && (refinerKey.startsWith('sk-') || refinerKey.startsWith('gsk_'))) return refinerKey
    return mainKey
  }, [aiConfig])

  const selectorEndpoint = useMemo(() => {
    const mainKey = aiConfig?.apiKey
    const refinerKey = aiConfig?.refinerApiKey
    if (mainKey && (mainKey.startsWith('sk-') || mainKey.startsWith('gsk_'))) return aiConfig?.endpoint
    if (refinerKey && (refinerKey.startsWith('sk-') || refinerKey.startsWith('gsk_'))) return aiConfig?.refinerEndpoint
    return aiConfig?.endpoint
  }, [aiConfig])

  // --- MODO MANUAL (CHAT) ---
  const [chatMessages, setChatMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [chatHistoryJson, setChatHistoryJson] = useState([]) // Armazena a conversa pura do chat para passar ao modelo
  const [isSending, setIsSending] = useState(false)
  const [lastResponseJson, setLastResponseJson] = useState(null)
  const [variableChanges, setVariableChanges] = useState({}) // Rastreia quais variáveis mudaram para animação
  const [ratings, setRatings] = useState({}) // { messageIndex: { rating, feedback } }
  const [isRefiningManual, setIsRefiningManual] = useState(false)
  const [manualRefineResult, setManualRefineResult] = useState(null)
  const [modalTab, setModalTab] = useState('summary') // 'summary' | 'diff'
  const [adjustmentFeedback, setAdjustmentFeedback] = useState('')
  const [isRefiningAdjustment, setIsRefiningAdjustment] = useState(false)
  const [enabledItems, setEnabledItems] = useState(new Set())


  // Estado atualizado do Bot (valores acumulados na conversa)
  const [botState, setBotState] = useState({
    status: 'in_process',
    summary: 'Aguardando início de conversa...',
    variables: {}
  })

  // --- MODO AUTOMÁTICO (TEST SUITE) ---
  const [testCases, setTestCases] = useState(() => {
    const saved = localStorage.getItem('pm-test-cases')
    if (saved) {
      try { return JSON.parse(saved) } catch {}
    }
    // Caso padrão inicial de demonstração
    return [
      {
        id: 1,
        name: 'Fluxo Padrão de Identificação',
        steps: [
          {
            clientMessage: 'Olá, sou o Saymon e gostaria de agendar uma consulta.',
            expectedStatus: 'in_process',
            expectedVariables: { nome_cliente: 'Saymon' }
          },
          {
            clientMessage: 'Na verdade, quero falar com um atendente humano.',
            expectedStatus: 'saida_atendente'
          }
        ]
      },
      {
        id: 2,
        name: 'Tratamento de Pergunta Fora do Escopo',
        steps: [
          {
            clientMessage: 'Vocês vendem passagens aéreas?',
            expectedStatus: 'saida_atendente' // Pelo domínio restrito ou dadas tentativas
          }
        ]
      }
    ]
  })

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [suiteResults, setSuiteResults] = useState(null)
  const [expandedResults, setExpandedResults] = useState(new Set())
  const [isRefiningAuto, setIsRefiningAuto] = useState(false)
  const [isApplyingAdjustments, setIsApplyingAdjustments] = useState(false)
  const [autoRefineResult, setAutoRefineResult] = useState(null)
  const [editingTestCase, setEditingTestCase] = useState(null)
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false)
  const [generatedScenarios, setGeneratedScenarios] = useState(null)
  const [selectedGenerated, setSelectedGenerated] = useState(new Set())
  const [generateError, setGenerateError] = useState(null)

  // Revisão de passos com falha
  const [stepReviews, setStepReviews] = useState({})
  const [reviewModal, setReviewModal] = useState(null) // { tcIdx, sIdx }
  const [reviewDraft, setReviewDraft] = useState({ status: '', response: '', variables: {} })

  const chatEndRef = useRef(null)

  const oldPrompt = activePromptText

  const nextConfig = useMemo(() => {
    const res = manualRefineResult || autoRefineResult
    if (!res || !config) return null
    
    let variables = config.variables ? [...config.variables] : []
    let exitDestinations = config.exitDestinations ? [...config.exitDestinations] : []

    if (res.update_variables) {
      res.update_variables.forEach(uv => {
        variables = variables.map(v => 
          v.name === uv.name ? { ...v, description: uv.description } : v
        )
      })
    }

    if (res.update_exits) {
      res.update_exits.forEach(ue => {
        exitDestinations = exitDestinations.map(e => 
          e.key === ue.key ? { ...e, description: ue.description, exitMessage: ue.exitMessage || e.exitMessage } : e
        )
      })
    }

    return {
      ...config,
      agentPersona: res.agentPersona || config.agentPersona || '',
      domain: res.domain || config.domain || '',
      variables,
      exitDestinations
    }
  }, [manualRefineResult, autoRefineResult, config])

  const nextPromptText = useMemo(() => {
    if (!nextConfig) return ''
    return buildPrompt(nextConfig)
  }, [nextConfig])

  const promptDiffResult = useMemo(() => {
    if (!oldPrompt || !nextPromptText) return []
    return diffLines(oldPrompt, nextPromptText)
  }, [oldPrompt, nextPromptText])

  useEffect(() => {
    localStorage.setItem('pm-test-cases', JSON.stringify(testCases))
  }, [testCases])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isSending])

  // Inicializa todos os itens do ajuste como habilitados quando chega um novo resultado
  useEffect(() => {
    const res = manualRefineResult || autoRefineResult
    if (!res) { setEnabledItems(new Set()); return }
    const keys = new Set()
    if (res.agentPersona) keys.add('persona')
    res.domain_add?.forEach((_, i) => keys.add(`domain_add_${i}`))
    res.domain_remove?.forEach((_, i) => keys.add(`domain_remove_${i}`))
    res.update_variables?.forEach((_, i) => keys.add(`var_${i}`))
    res.update_exits?.forEach((_, i) => keys.add(`exit_${i}`))
    setEnabledItems(keys)
  }, [manualRefineResult, autoRefineResult])

  // Monitora alterações de variáveis para aplicar animação piscante
  const updateBotState = (newState) => {
    setBotState(prev => {
      const changed = {}
      const allKeys = new Set([...Object.keys(prev.variables || {}), ...Object.keys(newState.variables || {})])
      
      allKeys.forEach(k => {
        const prevVal = prev.variables?.[k]
        const newVal = newState.variables?.[k]
        if (newVal !== undefined && prevVal !== newVal) {
          changed[k] = true
        }
      })

      if (Object.keys(changed).length > 0) {
        setVariableChanges(changed)
        setTimeout(() => setVariableChanges({}), 2000)
      }

      return {
        status: newState.status || prev.status,
        summary: newState.summary || prev.summary,
        variables: { ...prev.variables, ...newState.variables }
      }
    })
  }

  // Envia mensagem no chat manual
  const handleSendManual = async () => {
    if (!userInput.trim() || isSending) return
    const userMsg = userInput.trim()
    setUserInput('')
    setIsSending(true)

    // Adiciona na conversa visual
    const newVisualMsgs = [...chatMessages, { role: 'user', content: userMsg }]
    setChatMessages(newVisualMsgs)

    // Adiciona na conversa técnica
    const newTechnicalMsgs = [...chatHistoryJson, { role: 'user', content: userMsg }]
    setChatHistoryJson(newTechnicalMsgs)

    try {
      const messagesToSend = [
        { role: 'system', content: activePromptText },
        ...newTechnicalMsgs
      ]

      const callConfig = {
        ...targetModelConfig,
        temperature: temperature
      }

      // Executa a chamada chamando o chat completions direto
      // Importamos a lógica estendida de promptTuner que executa chatAPI
      const responseText = await runChatDirect(messagesToSend, callConfig)
      
      let parsed = {}
      let jsonValid = true
      let errorText = ''

      try {
        parsed = extractJson(responseText)
      } catch (e) {
        jsonValid = false
        errorText = `Resposta da IA não é um JSON válido. Retorno bruto: "${responseText}"`
      }

      if (jsonValid) {
        setLastResponseJson(parsed)
        updateBotState({
          status: parsed.status,
          summary: parsed.summary,
          variables: parsed.variables
        })
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: parsed.message || '*(Sem mensagem - Transferência)*',
          json: parsed
        }])
        setChatHistoryJson(prev => [...prev, { role: 'assistant', content: responseText }])
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Erro de Formatação: O modelo respondeu fora do padrão JSON obrigatório.`,
          error: errorText,
          raw: responseText
        }])
      }

    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Erro na chamada da API: ${err.message}`
      }])
    } finally {
      setIsSending(false)
    }
  }

  const handleResetManual = () => {
    setChatMessages([])
    setChatHistoryJson([])
    setLastResponseJson(null)
    setRatings({})
    setBotState({
      status: 'in_process',
      summary: 'Conversa resetada.',
      variables: {}
    })
  }

  // Salva nota/avaliação de um turno
  const handleRateTurn = (index, rating, feedbackText = '') => {
    setRatings(prev => ({
      ...prev,
      [index]: { rating, feedback: feedbackText }
    }))
  }

  // Refina o prompt com base no feedback manual das notas
  const handleRefineManual = async () => {
    const ratedTurns = Object.entries(ratings).map(([indexStr, data]) => {
      const idx = parseInt(indexStr)
      const assistantMsg = chatMessages[idx]
      // Encontrar a pergunta do usuário correspondente (geralmente anterior)
      const userMsg = chatMessages[idx - 1]
      return {
        userInput: userMsg ? userMsg.content : '',
        assistantOutput: assistantMsg.json ? JSON.stringify(assistantMsg.json) : (assistantMsg.raw || assistantMsg.content),
        rating: data.rating,
        feedback: data.feedback
      }
    }).filter(t => t.rating <= 3) // Focar nas avaliações regulares/ruins/péssimas para correção

    if (ratedTurns.length === 0) {
      await showDialog({ type: 'alert', message: 'Por favor, dê notas baixas (1 a 3 estrelas) e insira feedbacks nas mensagens com problemas para orientar a IA.' })
      return
    }

    setIsRefiningManual(true)
    setManualRefineResult(null)

    try {
      const mockSuiteResults = {
        results: [{
          testCaseName: 'Correções manuais do simulador',
          passed: false,
          failureReason: 'O usuário pontuou as respostas com notas baixas.',
          stepResults: ratedTurns.map((turn, i) => ({
            clientMessage: turn.userInput,
            rawResponse: turn.assistantOutput,
            parsedResponse: null,
            passed: false,
            error: `Nota do usuário: ${turn.rating}/5. Crítica: "${turn.feedback || 'sem comentário'}"`
          }))
        }]
      }

      const adjustments = await refineConfigWithFeedback(config, mockSuiteResults, aiConfig)
      setManualRefineResult(adjustments)
    } catch (err) {
      await showDialog({ type: 'alert', message: `Erro no refinamento: ${err.message}` })
    } finally {
      setIsRefiningManual(false)
    }
  }

  const handleRefineAdjustment = async () => {
    if (!adjustmentFeedback.trim()) return
    const current = manualRefineResult || autoRefineResult
    if (!current) return
    setIsRefiningAdjustment(true)
    try {
      const refined = await refineAdjustment(current, adjustmentFeedback, config, aiConfig)
      if (manualRefineResult) setManualRefineResult(refined)
      else setAutoRefineResult(refined)
      setAdjustmentFeedback('')
    } catch (err) {
      await showDialog({ type: 'alert', message: `Erro ao refinar: ${err.message}` })
    } finally {
      setIsRefiningAdjustment(false)
    }
  }

  // --- AÇÕES MODO AUTOMÁTICO ---
  const handleRunTests = async () => {
    setIsRunningTests(true)
    setSuiteResults(null)
    setAutoRefineResult(null)
    setStepReviews({})
    setReviewModal(null)

    try {
      const results = await runTestSuite(activePromptText, activeConfig, testCases, targetModelConfig)
      setSuiteResults(results)
    } catch (err) {
      await showDialog({ type: 'alert', message: `Erro na execução dos testes: ${err.message}` })
    } finally {
      setIsRunningTests(false)
    }
  }

  const handleRefineAuto = async () => {
    if (!suiteResults) return
    setIsRefiningAuto(true)
    setAutoRefineResult(null)

    try {
      const adjustments = await refineConfigWithFeedback(activeConfig, suiteResults, aiConfig, savedExamples)
      setAutoRefineResult(adjustments)
    } catch (err) {
      await showDialog({ type: 'alert', message: `Erro no refinamento automático: ${err.message}` })
    } finally {
      setIsRefiningAuto(false)
    }
  }

  // Aplica as sugestões da IA na configuração do editor principal
  const handleApplyAdjustments = async (adjustments) => {
    if (!adjustments) return

    const isAuto = Boolean(autoRefineResult)
    const logAction = isAuto ? 'Ajuste automático (simulador)' : 'Ajuste manual (simulador)'

    // Agente alvo: o carregado no editor OU o selecionado no dropdown de teste
    const targetId = loadedAgentId || (promptSource !== 'current' ? promptSource : null)

    // Config base: se testando agente da lista (não "current"), usa a config dele
    let baseConfig = config
    if (promptSource !== 'current') {
      const testedAgent = agents.find(a => a.id?.toString() === promptSource?.toString())
      if (testedAgent) {
        baseConfig = {
          agentName:        testedAgent.agent_name || '',
          agentPersona:     testedAgent.agent_persona || '',
          domain:           testedAgent.domain || '',
          variables:        testedAgent.variables || [],
          exitDestinations: testedAgent.exit_destinations || [],
          maxAttempts:      testedAgent.max_attempts || 3,
        }
      }
    }

    let variables = [...(baseConfig.variables || [])]
    let exitDestinations = [...(baseConfig.exitDestinations || [])]

    if (adjustments.update_variables) {
      adjustments.update_variables.forEach(uv => {
        variables = variables.map(v => v.name === uv.name ? { ...v, description: uv.description } : v)
      })
    }
    if (adjustments.update_exits) {
      adjustments.update_exits.forEach(ue => {
        exitDestinations = exitDestinations.map(e =>
          e.key === ue.key ? { ...e, description: ue.description, exitMessage: ue.exitMessage || e.exitMessage } : e
        )
      })
    }

    // Aplica patches cirúrgicos no domain em vez de substituir o texto inteiro
    let domain = baseConfig.domain || ''
    if (adjustments.domain_remove?.length) {
      adjustments.domain_remove.forEach(trecho => {
        domain = domain.replace(trecho, '').replace(/\n{3,}/g, '\n\n').trim()
      })
    }
    if (adjustments.domain_add?.length) {
      domain = domain.trimEnd() + '\n' + adjustments.domain_add.join('\n')
    }
    // Compatibilidade retroativa: se ainda vier domain completo (legado), usa ele
    if (!adjustments.domain_add && !adjustments.domain_remove && adjustments.domain) {
      domain = adjustments.domain
    }

    const nextConfig = {
      ...baseConfig,
      agentPersona: adjustments.agentPersona || baseConfig.agentPersona || '',
      domain,
      variables,
      exitDestinations,
    }

    const nextPrompt = buildPrompt(nextConfig)

    // Aplica no editor
    setConfig(nextConfig)
    setGeneratedPrompt(nextPrompt)

    // Salva snapshot local
    try { saveSnapshot({ config: nextConfig, prompt: nextPrompt, description: logAction }) } catch (_) {}

    // Salva no Supabase
    let saveMsg = 'Prompt ajustado, mas nenhum agente identificado para salvar no banco.'
    if (isSupabaseConfigured && targetId) {
      try {
        const currentLogs = agents.find(a => a.id === targetId)?.logs || []
        const data = await updateAgent(targetId, { config: nextConfig, generatedPrompt: nextPrompt, logs: currentLogs, logAction })
        onAgentUpdated?.(data)
        saveMsg = 'Prompt ajustado e salvo! Pode continuar testando.'
      } catch (err) {
        console.error('Erro ao salvar ajuste no Supabase:', err)
        saveMsg = `Falha ao salvar no banco: ${err.message}`
      }
    }

    await showDialog({ type: 'alert', message: saveMsg })
    setManualRefineResult(null)
    setAutoRefineResult(null)
    setSuiteResults(null)
    setPromptSource('current')
    handleResetManual()
  }

  // CRUD de Casos de Teste
  const handleSaveTestCase = (tc) => {
    if (tc.id) {
      setTestCases(prev => prev.map(t => t.id === tc.id ? tc : t))
    } else {
      const newTc = { ...tc, id: Date.now() }
      setTestCases(prev => [...prev, newTc])
    }
    setEditingTestCase(null)
  }

  const handleDeleteTestCase = async (id) => {
    const ok = await showDialog({ type: 'confirm', message: 'Excluir este caso de teste?' })
    if (ok) {
      setTestCases(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleGenerateScenarios = async () => {
    if (!aiConfig?.apiKey) { setGenerateError('Nenhuma chave de IA configurada. Vá em Configurações.'); return }
    if (!activeConfig?.domain?.trim()) { setGenerateError('Configure o objetivo do agente antes de gerar cenários.'); return }
    setIsGeneratingScenarios(true)
    setGeneratedScenarios(null)
    setSelectedGenerated(new Set())
    setGenerateError(null)
    try {
      const scenarios = await generateTestScenarios(activeConfig, aiConfig, 8)
      setGeneratedScenarios(scenarios)
      setSelectedGenerated(new Set(scenarios.map(s => s.id)))
    } catch (err) {
      setGenerateError(err.message)
    } finally {
      setIsGeneratingScenarios(false)
    }
  }

  const handleAddSelectedScenarios = () => {
    const toAdd = (generatedScenarios || []).filter(s => selectedGenerated.has(s.id))
    setTestCases(prev => [...prev, ...toAdd])
    setGeneratedScenarios(null)
    setSelectedGenerated(new Set())
  }

  return (
    <div className="h-full grid grid-cols-12 overflow-hidden bg-background text-on-surface">
      <style>{`
        @keyframes flash-green {
          0% { background-color: rgba(74, 222, 163, 0.4); }
          100% { background-color: transparent; }
        }
        .flash-green-anim {
          animation: flash-green 1.5s ease-out;
        }
      `}</style>

      {/* --- COLUNA ESQUERDA: PARÂMETROS E CASOS DE TESTE (3/12) --- */}
      <aside className="col-span-3 h-full border-r border-outline-variant flex flex-col overflow-y-auto p-4 space-y-4"
             style={{ background: 'var(--color-surface-container-low)' }}>
        <div>
          <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant/70 uppercase">Parâmetros do Teste</h3>
          <p className="text-[10px] text-on-surface-variant/40 font-mono mt-0.5">Defina o ambiente para simular</p>
        </div>

        <div className={`space-y-3 p-3 rounded-lg border transition-all ${isEditingPreset ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5' : 'border-outline-variant bg-surface-container-high/40'}`}>
          <div>
            <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1 flex justify-between items-center">
              <span>{isEditingPreset ? 'EDITANDO PRESET' : 'PRESET DE CONFIGURAÇÃO'}</span>
              <div className="flex gap-1.5 items-center">
                {isEditingPreset ? (
                  <span className="text-[9px] font-mono text-primary flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Modo Edição
                  </span>
                ) : (
                  activePresetId && (
                    <span className="text-[9px] font-mono text-secondary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      Preset Ativo
                    </span>
                  )
                )}
                {!isEditingPreset && (
                  <button 
                    onClick={handleSavePreset}
                    title="Criar novo preset com as configurações atuais"
                    className="text-[9px] text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 font-bold flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[10px]">add</span> Criar Novo
                  </button>
                )}
              </div>
            </label>
            
            {isEditingPreset ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={editPresetName}
                  onChange={e => setEditPresetName(e.target.value)}
                  placeholder="Nome do preset..."
                  className="flex-1 bg-surface border border-primary rounded px-2 py-1.5 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary"
                  autoFocus
                />
                
                <button
                  onClick={handleSavePresetEdits}
                  title="Salvar alterações no preset"
                  className="px-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded flex items-center justify-center transition-colors cursor-pointer"
                  disabled={!editPresetName.trim()}
                >
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </button>
                
                <button
                  onClick={handleCancelEditPreset}
                  title="Cancelar alterações"
                  className="px-2.5 border border-outline-variant bg-surface hover:bg-surface-container-high rounded text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <select
                  value={activePresetId}
                  onChange={e => handleSelectPreset(e.target.value)}
                  className="flex-1 bg-surface border border-outline-variant rounded px-2 py-1.5 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Nenhum preset selecionado</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDefault ? '⭐' : ''}
                    </option>
                  ))}
                </select>
                
                {activePresetId && (
                  <>
                    <button
                      onClick={handleStartEditPreset}
                      title="Editar Preset (Nome, Provedor e Temperatura)"
                      className="px-2 border border-outline-variant bg-surface hover:bg-surface-container-high rounded text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[12px]">edit</span>
                    </button>
                    
                    <button
                      onClick={handleToggleDefaultPreset}
                      title="Tornar Padrão Inicial"
                      className="px-2 border border-outline-variant bg-surface hover:bg-surface-container-high rounded text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[12px] text-yellow-500">star</span>
                    </button>

                    <button
                      onClick={handleDeletePreset}
                      title="Excluir Preset"
                      className="px-2 border border-outline-variant bg-surface hover:bg-red-500/10 hover:text-red-500 rounded text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
                      disabled={presets.length <= 1}
                    >
                      <span className="material-symbols-outlined text-[12px]">delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <ModelSelector
            value={model}
            onChange={handleModelChange}
            apiKey={selectorApiKey}
            endpoint={selectorEndpoint}
          />

          <div>
            <div className="flex justify-between text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1">
              <span>TEMPERATURA</span>
              <span className="text-secondary">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={temperature}
              onChange={e => {
                const t = parseFloat(e.target.value)
                setTemperature(t)
                if (activePresetId) {
                  setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, temperature: t } : p))
                }
              }}
              className="w-full accent-secondary"
            />
          </div>
        </div>

        {/* --- SEÇÃO: PROMPT SOB TESTE --- */}
        <div className="space-y-3 p-3 rounded-lg border border-outline-variant bg-surface-container-high/40">
          <div>
            <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1 flex justify-between items-center">
              <span>PROMPT SOB TESTE</span>
              {promptSource !== 'current' && (
                <button
                  onClick={() => setPromptSource('current')}
                  title="Restaurar para o Rascunho Atual do Editor"
                  className="text-[9px] text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 font-bold"
                >
                  Usar Atual
                </button>
              )}
            </label>
            <select
              value={promptSource}
              onChange={e => setPromptSource(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded px-2 py-1.5 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="current">
                {loadedAgentId
                  ? `${agents.find(a => a.id === loadedAgentId)?.agent_name || 'Agente atual'} (ativo)`
                  : 'Rascunho Atual do Editor'}
              </option>
              {historyList.map(h => (
                <option key={h.id} value={h.id}>
                  {h.description}
                </option>
              ))}
            </select>
          </div>

          {activePromptText && (
            <div className="rounded border border-outline-variant/40 bg-surface/80 p-2 space-y-1">
              <div className="flex justify-between items-center text-[9px] font-mono text-on-surface-variant/60">
                <span className="uppercase">Visualizar Prompt</span>
                <div className="flex items-center gap-2">
                  <span>{activePromptText.length} chars</span>
                  <button
                    onClick={() => setPromptModalOpen(true)}
                    title="Ver prompt completo"
                    className="hover:text-primary transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_full</span>
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={activePromptText}
                className="w-full bg-transparent text-[10px] font-mono text-on-surface-variant/80 focus:outline-none resize-y border-0 p-0 scrollbar-thin"
                style={{ minHeight: 80, maxHeight: 480 }}
              />
            </div>
          )}
        </div>

        {/* Abas do simulador */}
        <div className="flex border-b border-outline-variant/60">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant/40 hover:text-on-surface'}`}
          >
            Chat Manual
          </button>
          <button
            onClick={() => setActiveTab('automated')}
            className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'automated' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant/40 hover:text-on-surface'}`}
          >
            Bateria Auto ({testCases.length})
          </button>
        </div>

        {/* Gerenciamento de Casos de Teste (só visível no modo automático) */}
        {activeTab === 'automated' && (
          <div className="flex-1 flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 uppercase">Cenários de Teste</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateScenarios}
                  disabled={isGeneratingScenarios}
                  className="text-[10px] font-mono flex items-center gap-0.5 text-secondary hover:underline disabled:opacity-40"
                >
                  {isGeneratingScenarios
                    ? <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                  }
                  {isGeneratingScenarios ? 'Gerando...' : 'Gerar com IA'}
                </button>
                <span className="text-on-surface-variant/20 text-[10px]">|</span>
                <button
                  onClick={() => setEditingTestCase({ name: 'Novo Cenário', steps: [{ clientMessage: '', expectedStatus: 'in_process' }] })}
                  className="text-[10px] font-mono flex items-center gap-0.5 text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[12px]">add</span> Adicionar
                </button>
                {testCases.length > 0 && (
                  <>
                    <span className="text-on-surface-variant/20 text-[10px]">|</span>
                    <button
                      onClick={() => { if (window.confirm(`Apagar todos os ${testCases.length} testes? Isso não pode ser desfeito.`)) setTestCases([]) }}
                      className="text-[10px] font-mono flex items-center gap-0.5 text-error/70 hover:text-error hover:underline"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete_sweep</span> Limpar todos
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Erro de geração */}
            {generateError && (
              <p className="text-[10px] font-mono text-error leading-snug">{generateError}</p>
            )}

            {/* Preview de cenários gerados */}
            {generatedScenarios && (
              <div className="rounded-lg border border-secondary/40 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-secondary) 5%, transparent)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-secondary/20">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary text-[14px]">auto_awesome</span>
                    <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-wider">
                      {generatedScenarios.length} cenários gerados
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedGenerated(prev =>
                      prev.size === generatedScenarios.length ? new Set() : new Set(generatedScenarios.map(s => s.id))
                    )}
                    className="text-[9px] font-mono text-secondary/70 hover:text-secondary"
                  >
                    {selectedGenerated.size === generatedScenarios.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>

                <div className="max-h-[280px] overflow-y-auto divide-y divide-secondary/10">
                  {generatedScenarios.map(s => {
                    const checked = selectedGenerated.has(s.id)
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedGenerated(prev => {
                          const next = new Set(prev)
                          checked ? next.delete(s.id) : next.add(s.id)
                          return next
                        })}
                        className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/5 transition-colors"
                        style={{ opacity: checked ? 1 : 0.4 }}
                      >
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5" style={{ color: checked ? 'rgb(var(--color-secondary))' : 'rgba(163,163,163,0.4)' }}>
                          {checked ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-mono font-semibold text-on-surface truncate">{s.name}</p>
                          {s.clientGoal && (
                            <p className="text-[9px] font-mono text-on-surface-variant/50 mt-0.5 truncate">{s.clientGoal}</p>
                          )}
                          <p className="text-[9px] font-mono text-on-surface-variant/40 mt-0.5">{s.steps.length} passo(s)</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-2 px-3 py-2 border-t border-secondary/20">
                  <button
                    onClick={() => { setGeneratedScenarios(null); setSelectedGenerated(new Set()) }}
                    className="flex-1 py-1.5 text-[10px] font-mono border border-outline-variant rounded hover:bg-surface-container-high transition-colors"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleAddSelectedScenarios}
                    disabled={selectedGenerated.size === 0}
                    className="flex-1 py-1.5 text-[10px] font-mono rounded font-semibold transition-colors disabled:opacity-40"
                    style={{ background: 'rgb(var(--color-secondary))', color: 'rgb(var(--color-on-secondary))' }}
                  >
                    Adicionar {selectedGenerated.size} de {generatedScenarios.length}
                  </button>
                </div>
              </div>
            )}

            {editingTestCase ? (
              <div className="p-3 rounded-lg border border-outline-variant bg-surface space-y-3">
                <input
                  type="text"
                  value={editingTestCase.name}
                  onChange={e => setEditingTestCase(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-mono font-semibold border-b border-outline-variant pb-1 focus:outline-none bg-transparent"
                  placeholder="Nome do Cenário"
                />

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {editingTestCase.steps.map((step, idx) => (
                    <div key={idx} className="p-2 rounded border border-outline-variant/40 bg-surface-container-lowest text-[10px] font-mono space-y-2 relative">
                      <button
                        onClick={() => {
                          setEditingTestCase(prev => {
                            const steps = prev.steps.filter((_, sIdx) => sIdx !== idx)
                            return { ...prev, steps }
                          })
                        }}
                        className="absolute right-1 top-1 text-error hover:text-error/80"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                      
                      <div className="font-bold text-[9px] text-on-surface-variant/50">PASSO {idx + 1}</div>
                      <div>
                        <label className="block text-[9px] text-on-surface-variant/50 mb-0.5">MENSAGEM DO CLIENTE</label>
                        <textarea
                          rows="1"
                          value={step.clientMessage}
                          onChange={e => {
                            setEditingTestCase(prev => {
                              const steps = [...prev.steps]
                              steps[idx].clientMessage = e.target.value
                              return { ...prev, steps }
                            })
                          }}
                          className="w-full bg-surface border border-outline-variant/60 rounded px-1.5 py-1 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-on-surface-variant/50 mb-0.5">STATUS ESPERADO</label>
                        <select
                          value={step.expectedStatus}
                          onChange={e => {
                            setEditingTestCase(prev => {
                              const steps = [...prev.steps]
                              steps[idx].expectedStatus = e.target.value
                              return { ...prev, steps }
                            })
                          }}
                          className="w-full bg-surface border border-outline-variant/60 rounded px-1 py-0.5 focus:outline-none text-[10px]"
                        >
                          <option value="in_process">in_process (Em andamento)</option>
                          <option value="success">success (Concluído)</option>
                          <option value="saida_atendente">saida_atendente (Atendente Humano)</option>
                          {config.exitDestinations.filter(e => !e.isSystem && e.key !== 'saida_atendente' && e.key !== 'success').map(e => (
                            <option key={e.key} value={e.key}>{e.key}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingTestCase(prev => ({
                        ...prev,
                        steps: [...prev.steps, { clientMessage: '', expectedStatus: 'in_process' }]
                      }))
                    }}
                    className="flex-1 py-1 text-[9px] font-mono border border-outline-variant hover:bg-surface-container-high transition-colors rounded"
                  >
                    + Passo
                  </button>
                  <button
                    onClick={() => handleSaveTestCase(editingTestCase)}
                    className="flex-1 py-1 text-[9px] font-mono bg-secondary text-on-secondary rounded hover:opacity-90"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingTestCase(null)}
                    className="py-1 px-2 text-[9px] font-mono border border-outline-variant rounded hover:bg-surface-container-high"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {testCases.map(tc => (
                  <div key={tc.id} className="p-3 rounded-lg border border-outline-variant bg-surface hover:border-primary/50 transition-all flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold text-on-surface truncate">{tc.name}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant/40 mt-0.5">{tc.steps.length} passo(s) de diálogo</p>
                    </div>
                    <div className="flex gap-1.5 ml-2">
                      <button onClick={() => setEditingTestCase(tc)} className="text-on-surface-variant/40 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button onClick={() => handleDeleteTestCase(tc.id)} className="text-on-surface-variant/40 hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* --- COLUNA CENTRAL: CHAT OU EXECUÇÃO (6/12) --- */}
      <main className="col-span-6 h-full flex flex-col overflow-hidden bg-surface relative">
        <div className="px-6 py-4 border-b border-outline-variant/60 flex items-center justify-between"
             style={{ background: 'var(--color-surface-container-lowest)' }}>
          <div>
            <h2 className="text-sm font-bold text-on-surface leading-none">
              {activeTab === 'manual' ? 'Playground Simulação Manual' : 'Execução da Bateria de Testes'}
            </h2>
            <p className="text-[10px] font-mono text-on-surface-variant/50 mt-1">
              {activeTab === 'manual' ? 'Simule conversas e avalie cada turno' : 'Verifique múltiplos fluxos em lote'}
            </p>
          </div>
          {activeTab === 'manual' && chatMessages.length > 0 && (
            <button
              onClick={handleResetManual}
              className="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/40 hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span> Reiniciar
            </button>
          )}
        </div>

        {/* --- CONTEÚDO DA ABA MANUAL: CHAT WHATSAPP --- */}
        {activeTab === 'manual' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Linha do tempo de mensagens */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {!activePromptText || !activePromptText.trim() ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-outline-variant/60 rounded-xl bg-surface-container-high/20">
                  <span className="material-symbols-outlined text-[48px] text-amber-500 mb-2">warning</span>
                  <p className="text-xs font-mono font-bold text-on-surface">Nenhum prompt disponível para simulação!</p>
                  <p className="text-[10px] font-mono text-on-surface-variant/60 mt-1 max-w-sm leading-relaxed">
                    Você precisa gerar um prompt no <strong>Editor</strong> ou selecionar um prompt salvo no histórico na barra lateral esquerda antes de usar o simulador.
                  </p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                  <span className="material-symbols-outlined text-[48px] mb-2">forum</span>
                  <p className="text-xs font-mono">Envie a primeira mensagem para iniciar o chat de teste.</p>
                  <p className="text-[9px] font-mono mt-1">Toda resposta gerada exigirá e consumirá créditos da sua API cadastrada.</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user'
                  const exitStatus = msg.json?.status
                  const isExit = !isUser && exitStatus && exitStatus !== 'in_process' && exitStatus !== 'success'
                  const exitDef = isExit && config.exitDestinations?.find(e => e.key === exitStatus)
                  const exitLabel = exitDef?.label || exitStatus || ''
                  const exitMsg = isExit && msg.json?.message
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
                      {isExit ? (
                        <div className="max-w-[80%] rounded-lg border border-outline-variant/50 overflow-hidden shadow-sm"
                             style={{ background: 'var(--color-surface-container-high)' }}>
                          {exitMsg && (
                            <div className="px-3 py-2 text-xs font-mono text-on-surface border-b border-outline-variant/30 whitespace-pre-wrap leading-relaxed">
                              {exitMsg}
                            </div>
                          )}
                          <div className="flex items-center gap-2.5 px-3 py-2"
                               style={{ background: 'color-mix(in srgb, var(--color-tertiary) 8%, transparent)' }}>
                            <span className="material-symbols-outlined flex-shrink-0"
                                  style={{ fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>
                              call_merge
                            </span>
                            <div className="min-w-0">
                              <p className="text-[9px] font-mono text-on-surface-variant/50 leading-none mb-0.5">Saída acionada</p>
                              <p className="text-[11px] font-mono font-semibold leading-none"
                                 style={{ color: 'rgb(var(--color-tertiary))' }}>
                                {exitLabel}
                              </p>
                              <p className="text-[9px] font-mono text-on-surface-variant/40 mt-0.5 leading-none">
                                {exitStatus}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[75%] rounded-lg px-4 py-2.5 text-xs shadow-sm font-mono whitespace-pre-wrap leading-relaxed ${
                            isUser
                              ? 'bg-primary text-on-primary rounded-tr-none'
                              : msg.error
                                ? 'bg-error-container text-on-error-container border border-error/20 rounded-tl-none'
                                : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/30'
                          }`}
                        >
                          {msg.content}
                          {msg.error && (
                            <div className="mt-2 pt-2 border-t border-error/20 text-[9px] font-semibold text-error/90 max-w-full overflow-x-auto">
                              {msg.error}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Painel de Avaliação por Turno (apenas nas respostas do bot, se válidas) */}
                      {!isUser && !msg.error && msg.json && (
                        <div className="flex flex-col gap-1 mt-1 p-2 rounded border border-outline-variant/30 bg-surface-container-lowest w-[80%] max-w-xs shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-on-surface-variant/40">Avalie a resposta:</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => {
                                const activeRating = ratings[idx]?.rating || 0
                                return (
                                  <button
                                    key={star}
                                    onClick={() => handleRateTurn(idx, star, ratings[idx]?.feedback)}
                                    className="text-[14px] leading-none focus:outline-none transition-transform active:scale-125"
                                  >
                                    <span className={`material-symbols-outlined ${star <= activeRating ? 'text-tertiary' : 'text-on-surface-variant/20'}`}
                                          style={{ fontSize: 13, fontVariationSettings: star <= activeRating ? "'FILL' 1" : undefined }}>
                                      star
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Se for 3 estrelas ou menos, solicita feedback corretivo */}
                          {ratings[idx]?.rating && ratings[idx]?.rating <= 3 && (
                            <div className="mt-1 space-y-1">
                              <textarea
                                placeholder="Diga o que a IA deveria ter feito..."
                                value={ratings[idx]?.feedback || ''}
                                onChange={e => handleRateTurn(idx, ratings[idx].rating, e.target.value)}
                                className="w-full bg-surface text-[9px] font-mono border border-outline-variant/60 rounded px-1.5 py-1 focus:outline-none placeholder:text-on-surface-variant/25 resize-none h-10"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              {isSending && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant/40 animate-pulse">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                  <span>Agente digitando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input de mensagem */}
            <div className="p-4 border-t border-outline-variant/60 bg-surface-container-lowest/40 flex items-center gap-3">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendManual()}
                disabled={isSending || !aiConfig?.apiKey || !activePromptText || !activePromptText.trim()}
                placeholder={
                  !aiConfig?.apiKey
                    ? "Cadastre uma chave de IA nas Configurações para simular"
                    : (!activePromptText || !activePromptText.trim())
                    ? "⚠️ Selecione ou gere um prompt antes de digitar..."
                    : "Digite sua mensagem simulando o cliente..."
                }
                className="flex-1 rounded-lg border border-outline-variant bg-surface px-4 py-3 text-xs font-mono focus:outline-none focus:border-primary disabled:opacity-40"
              />
              <button
                onClick={handleSendManual}
                disabled={isSending || !userInput.trim() || !aiConfig?.apiKey || !activePromptText || !activePromptText.trim()}
                className="btn-primary py-2.5 px-4 h-full rounded-lg font-mono text-xs uppercase flex items-center justify-center disabled:opacity-40"
              >
                Enviar
              </button>
            </div>

            {/* Alerta de refinamento manual */}
            {(() => {
              const lowRatingsCount = Object.values(ratings).filter(r => r.rating && r.rating <= 3).length
              if (lowRatingsCount === 0) return null
              return (
                <div className="mx-6 mb-4 p-3 rounded-lg border border-tertiary/20 bg-tertiary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 18 }}>reviews</span>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-tertiary leading-none">Ajustes pendentes</h4>
                      <p className="text-[9px] font-mono text-on-surface-variant/60 mt-1">
                        Você identificou {lowRatingsCount} turno(s) com comportamento incorreto. Clique abaixo para ajustar o prompt.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefineManual}
                    disabled={isRefiningManual}
                    className={`px-4 py-1.5 text-[10px] font-mono font-bold rounded shadow whitespace-nowrap flex items-center gap-1.5 transition-all
                      ${isRefiningManual
                        ? 'bg-tertiary text-on-tertiary animate-pulse cursor-wait scale-[1.03] shadow-lg shadow-tertiary/40'
                        : 'bg-tertiary text-on-tertiary hover:opacity-90 active:scale-95'
                      }`}
                  >
                    {isRefiningManual && (
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 12 }}>progress_activity</span>
                    )}
                    {isRefiningManual ? 'Ajustando...' : 'REPROCESSAR PROMPT'}
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* --- CONTEÚDO DA ABA AUTOMÁTICA: SUITE RUNNER --- */}
        {activeTab === 'automated' && (
          <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
            {/* Botão de Rodar e Status */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-surface-container rounded-lg p-4 border border-outline-variant/60">
              <button
                onClick={handleRunTests}
                disabled={isRunningTests || testCases.length === 0 || !aiConfig?.apiKey}
                className="w-full sm:w-auto px-6 py-3 rounded bg-primary text-on-primary text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              >
                {isRunningTests ? (
                  <>
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                    Executando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_circle</span>
                    Executar Bateria
                  </>
                )}
              </button>
              <div className="flex-1 text-center sm:text-left">
                {suiteResults ? (
                  <div>
                    <p className="text-xs font-mono font-bold">
                      Sucesso:{' '}
                      <span className={suiteResults.successRate === 100 ? 'text-secondary' : 'text-error'}>
                        {suiteResults.passedCount}/{suiteResults.totalCount} ({suiteResults.successRate.toFixed(0)}%)
                      </span>
                    </p>
                    <p className="text-[9px] font-mono text-on-surface-variant/50 mt-0.5">
                      Último teste executado em {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-on-surface-variant/40">
                    Nenhum teste executado ainda para a versão de prompt atual.
                  </p>
                )}
              </div>
            </div>

            {/* Resultados individuais de cenários */}
            {suiteResults && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold text-on-surface-variant/60 uppercase">Detalhes da Execução</h3>
                  <button
                    onClick={() => setExpandedResults(
                      expandedResults.size === suiteResults.results.length
                        ? new Set()
                        : new Set(suiteResults.results.map((_, i) => i))
                    )}
                    className="text-[10px] font-mono text-on-surface-variant/40 hover:text-on-surface-variant/70 flex items-center gap-0.5 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                      {expandedResults.size === suiteResults.results.length ? 'unfold_less' : 'unfold_more'}
                    </span>
                    {expandedResults.size === suiteResults.results.length ? 'Recolher todos' : 'Expandir todos'}
                  </button>
                </div>

                <div className="space-y-2">
                  {suiteResults.results.map((res, tcIdx) => {
                    const isExpanded = expandedResults.has(tcIdx)
                    return (
                      <div key={tcIdx} className={`rounded-lg border overflow-hidden ${res.passed ? 'border-secondary/20' : 'border-error/20'}`}
                        style={{ background: res.passed ? 'color-mix(in srgb, var(--color-secondary) 4%, var(--color-surface-container))' : 'color-mix(in srgb, var(--color-error) 4%, var(--color-surface-container))' }}>

                        {/* Header clicável */}
                        <button
                          onClick={() => {
                            setExpandedResults(isExpanded ? new Set() : new Set([tcIdx]))
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[16px] ${res.passed ? 'text-secondary' : 'text-error'}`}>
                              {res.passed ? 'check_circle' : 'cancel'}
                            </span>
                            <span className="text-xs font-mono font-semibold text-on-surface">{res.testCaseName}</span>
                            <span className="text-[9px] font-mono text-on-surface-variant/40">
                              {res.stepResults.length} {res.stepResults.length === 1 ? 'passo' : 'passos'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono font-bold uppercase ${res.passed ? 'text-secondary' : 'text-error'}`}>
                              {res.passed ? 'Passou' : 'Falhou'}
                            </span>
                            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </div>
                        </button>

                        {/* Passos expandidos */}
                        {isExpanded && (
                          <div className="border-t border-outline-variant/30 px-4 py-3 space-y-4">
                            {res.stepResults.map((step, sIdx) => (
                              <div key={sIdx} className="space-y-2">
                                {/* Número do passo + mensagem do cliente */}
                                <div className="flex items-start gap-2">
                                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold mt-0.5 ${step.passed ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}`}>
                                    {sIdx + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-mono text-on-surface-variant/40 mb-0.5">CLIENTE</p>
                                    <p className="text-[11px] font-mono italic text-on-surface/80">"{step.clientMessage}"</p>
                                  </div>
                                </div>

                                {step.parsedResponse ? (
                                  <div className="ml-7 space-y-2">
                                    {/* Status com comparação */}
                                    <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                                      <span className={`material-symbols-outlined text-[14px] ${step.passed ? 'text-secondary' : 'text-error'}`}>
                                        {step.passed ? 'check_circle' : 'error'}
                                      </span>
                                      <span className="text-on-surface-variant/50">Status:</span>
                                      <button
                                        onClick={() => {
                                          const reviewKey = `${tcIdx}-${sIdx}`
                                          const existing = stepReviews[reviewKey]
                                          setReviewModal({ tcIdx, sIdx })
                                          setReviewDraft({
                                            status: existing?.correctedStatus || step.parsedResponse.status || '',
                                            response: existing ? (existing.correctedResponse ?? '') : (step.parsedResponse.message || ''),
                                            variables: existing?.correctedVariables || Object.fromEntries(
                                              Object.entries(step.parsedResponse.variables || {}).map(([k, v]) => [k, String(v)])
                                            )
                                          })
                                        }}
                                        title="Clique para revisar"
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-0.5 transition-all group/chip ${
                                          stepReviews[`${tcIdx}-${sIdx}`]
                                            ? 'bg-secondary/10 text-secondary border border-secondary/30'
                                            : step.passed
                                              ? 'bg-secondary/10 text-secondary border border-secondary/20 hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
                                              : 'bg-error/10 text-error border border-error/20 hover:bg-primary/10 hover:text-primary hover:border-primary/40'
                                        }`}
                                      >
                                        {step.parsedResponse.status}
                                        {!stepReviews[`${tcIdx}-${sIdx}`] && (
                                          <span className={`material-symbols-outlined ${step.passed ? 'opacity-0 group-hover/chip:opacity-50' : 'opacity-60'}`} style={{ fontSize: 11 }}>edit</span>
                                        )}
                                      </button>
                                      {!step.passed && step.error && (
                                        <span className="text-on-surface-variant/40 text-[9px]">{step.error}</span>
                                      )}
                                    </div>

                                    {/* Badge após revisão */}
                                    {stepReviews[`${tcIdx}-${sIdx}`] && (
                                      <div className="flex items-center gap-2 text-[9px] font-mono px-2 py-1 rounded bg-secondary/5 border border-secondary/20">
                                        <span className="material-symbols-outlined text-[12px] text-secondary">check_circle</span>
                                        <span className="text-secondary font-semibold">
                                          {stepReviews[`${tcIdx}-${sIdx}`].action === 'fix_test' ? 'Expectativa corrigida →' : 'Exemplo salvo →'}
                                        </span>
                                        <code className="text-secondary/70">{stepReviews[`${tcIdx}-${sIdx}`].correctedStatus}</code>
                                        <button
                                          onClick={() => setStepReviews(prev => { const n = { ...prev }; delete n[`${tcIdx}-${sIdx}`]; return n })}
                                          className="ml-auto text-on-surface-variant/30 hover:text-error transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-[11px]">close</span>
                                        </button>
                                      </div>
                                    )}

                                    {/* Mensagem do agente */}
                                    {(() => {
                                      const review = stepReviews[`${tcIdx}-${sIdx}`]
                                      const displayMsg = review ? (review.correctedResponse ?? '') : (step.parsedResponse.message || '')
                                      const isOverridden = review && review.correctedResponse !== step.parsedResponse.message
                                      return (
                                      <div className="rounded border overflow-hidden"
                                        style={{
                                          borderColor: displayMsg ? undefined : 'color-mix(in srgb, var(--color-on-surface) 12%, transparent)',
                                          background: displayMsg ? 'var(--color-surface-container-high)' : 'transparent',
                                        }}>
                                      <p className="text-[8px] font-mono font-bold text-on-surface-variant/40 uppercase tracking-wider px-2.5 pt-2 pb-1 flex items-center gap-1">
                                        Resposta do Agente
                                        {isOverridden && <span className="text-secondary">(corrigida)</span>}
                                      </p>
                                      {displayMsg ? (
                                        <p className="text-[11px] font-mono text-on-surface/90 px-2.5 pb-2.5 leading-relaxed">
                                          {displayMsg}
                                        </p>
                                      ) : (
                                        <p className="text-[10px] font-mono text-on-surface-variant/30 italic px-2.5 pb-2 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">speaker_notes_off</span>
                                          Sem resposta — o agente não enviou mensagem neste turno
                                        </p>
                                      )}
                                    </div>
                                      )
                                    })()}

                                    {/* Variáveis */}
                                    {Object.keys(step.parsedResponse.variables || {}).length > 0 && (
                                      <div className="rounded border border-outline-variant/30 px-2.5 py-2"
                                        style={{ background: 'var(--color-surface-container)' }}>
                                        <p className="text-[8px] font-mono font-bold text-on-surface-variant/40 uppercase tracking-wider mb-1.5">
                                          Variáveis
                                        </p>
                                        <div className="space-y-0.5">
                                          {Object.entries(step.parsedResponse.variables).map(([k, v]) => (
                                            <div key={k} className="flex items-baseline gap-1.5 text-[10px] font-mono">
                                              <span className="text-tertiary flex-shrink-0">{k}</span>
                                              <span className="text-on-surface-variant/30">:</span>
                                              <span className="text-on-surface/70 truncate">"{String(v)}"</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Resumo */}
                                    {step.parsedResponse.summary && (
                                      <p className="text-[9px] font-mono text-on-surface-variant/40 italic pl-1 border-l-2 border-outline-variant/30">
                                        {step.parsedResponse.summary}
                                      </p>
                                    )}

                                  </div>
                                ) : step.rawResponse ? (
                                  <div className="ml-7 text-[9px] font-mono text-error/80 bg-error/5 rounded p-2 border border-error/20 max-w-full overflow-x-auto whitespace-pre-wrap">
                                    {step.rawResponse.slice(0, 600)}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Botão de ajuste automático por IA se houver falhas */}
                {suiteResults.successRate < 100 && (
                  <div className="p-4 rounded-lg border border-error/20 bg-error/5 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-error" style={{ fontSize: 22 }}>build</span>
                        <div>
                          <h4 className="text-xs font-mono font-bold text-error">Ajustes Automáticos Recomendados</h4>
                          <p className="text-[9px] font-mono text-on-surface-variant/60 mt-1 max-w-md">
                            A IA pode analisar onde os testes falharam e re-escrever de forma inteligente as regras do prompt para consertá-los.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRefineAuto}
                        disabled={isRefiningAuto}
                        className="px-5 py-2.5 rounded bg-error text-on-error text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 disabled:opacity-40 whitespace-nowrap"
                      >
                        {isRefiningAuto ? 'Analisando...' : 'AUTO-AJUSTAR PROMPT'}
                      </button>
                    </div>
                    {savedExamples.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded border border-primary/30 bg-primary/5 text-[9px] font-mono">
                        <span className="material-symbols-outlined text-primary text-[13px]">school</span>
                        <span className="text-primary/80">
                          {savedExamples.length} exemplo(s) salvos no Supabase — o AUTO-AJUSTAR vai usá-los como base
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- PROPOSTA DE MUDANÇA (Aparece tanto na manual quanto auto após refinamento) --- */}
        {(manualRefineResult || autoRefineResult) && (
          <div className="absolute inset-0 bg-background/90 z-50 p-6 flex flex-col justify-center max-w-2xl mx-auto overflow-y-auto">
            {(() => {
              const res = manualRefineResult || autoRefineResult
              return (
                <div className="p-6 rounded-lg border border-secondary/30 bg-surface shadow-2xl flex flex-col space-y-4 max-h-[90vh]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 20 }}>auto_awesome</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-mono font-bold text-secondary leading-none">Sugestão de Ajuste de Prompt</h3>
                      <p className="text-[10px] font-mono text-on-surface-variant/50 mt-1">A IA re-escreveu algumas regras de configuração para passar nos testes</p>
                    </div>
                  </div>

                  {/* Abas do Modal */}
                  <div className="flex border-b border-outline-variant/60">
                    <button
                      onClick={() => setModalTab('summary')}
                      className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-b-2 transition-all ${
                        modalTab === 'summary'
                          ? 'border-secondary text-secondary'
                          : 'border-transparent text-on-surface-variant/40 hover:text-on-surface-variant/70'
                      }`}
                    >
                      Resumo de Alterações
                    </button>
                    <button
                      onClick={() => setModalTab('diff')}
                      className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-b-2 transition-all ${
                        modalTab === 'diff'
                          ? 'border-secondary text-secondary'
                          : 'border-transparent text-on-surface-variant/40 hover:text-on-surface-variant/70'
                      }`}
                    >
                      Visualizar Diff Completo ({promptDiffResult.filter(d => d.type !== 'equal').length} alterações)
                    </button>
                  </div>

                  {modalTab === 'summary' ? (
                    <div className="space-y-3 bg-surface-container rounded-lg p-4 text-xs font-mono border border-outline-variant/60 max-h-[50vh] overflow-y-auto">
                      {/* Motivo — não é toggleável, só informativo */}
                      <div>
                        <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Motivo do Ajuste:</span>
                        <p className="text-[11px] text-on-surface leading-relaxed italic">"{res.summary}"</p>
                      </div>

                      {/* Persona */}
                      {res.agentPersona && (() => {
                        const key = 'persona'; const on = enabledItems.has(key)
                        return (
                          <div className={`pt-2 border-t border-outline-variant/30 transition-opacity ${on ? '' : 'opacity-40'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-secondary text-[10px] uppercase tracking-wider">Persona Modificada:</span>
                              <button onClick={() => setEnabledItems(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                                className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${on ? 'border-secondary/40 text-secondary' : 'border-outline-variant/40 text-on-surface-variant/40'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: on ? "'FILL' 1" : undefined }}>{on ? 'check_box' : 'check_box_outline_blank'}</span>
                                {on ? 'Incluir' : 'Excluído'}
                              </button>
                            </div>
                            <p className="text-[10px] text-on-surface-variant max-h-20 overflow-y-auto whitespace-pre-wrap">{res.agentPersona}</p>
                          </div>
                        )
                      })()}

                      {/* Objetivo */}
                      {(res.domain_add?.length > 0 || res.domain_remove?.length > 0) && (
                        <div className="pt-2 border-t border-outline-variant/30 space-y-1.5">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block">Objetivo:</span>
                          {res.domain_add?.map((r, i) => {
                            const key = `domain_add_${i}`; const on = enabledItems.has(key)
                            return (
                              <div key={key} className={`flex items-start gap-2 transition-opacity ${on ? '' : 'opacity-40'}`}>
                                <button onClick={() => setEnabledItems(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                                  className="flex-shrink-0 mt-0.5" title={on ? 'Desabilitar' : 'Habilitar'}>
                                  <span className={`material-symbols-outlined transition-colors ${on ? 'text-secondary' : 'text-on-surface-variant/30'}`}
                                        style={{ fontSize: 14, fontVariationSettings: on ? "'FILL' 1" : undefined }}>check_box{on ? '' : '_outline_blank'}</span>
                                </button>
                                <span className={`text-[9px] flex-shrink-0 font-bold mt-0.5 ${on ? 'text-secondary' : 'text-on-surface-variant/30'}`}>+</span>
                                <span className={`text-[10px] ${on ? 'text-on-surface-variant' : 'text-on-surface-variant/40 line-through'}`}>{r}</span>
                              </div>
                            )
                          })}
                          {res.domain_remove?.map((r, i) => {
                            const key = `domain_remove_${i}`; const on = enabledItems.has(key)
                            return (
                              <div key={key} className={`flex items-start gap-2 transition-opacity ${on ? '' : 'opacity-40'}`}>
                                <button onClick={() => setEnabledItems(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                                  className="flex-shrink-0 mt-0.5" title={on ? 'Desabilitar' : 'Habilitar'}>
                                  <span className={`material-symbols-outlined transition-colors ${on ? 'text-error' : 'text-on-surface-variant/30'}`}
                                        style={{ fontSize: 14, fontVariationSettings: on ? "'FILL' 1" : undefined }}>check_box{on ? '' : '_outline_blank'}</span>
                                </button>
                                <span className={`text-[9px] flex-shrink-0 font-bold mt-0.5 ${on ? 'text-error' : 'text-on-surface-variant/30'}`}>−</span>
                                <span className={`text-[10px] ${on ? 'text-on-surface-variant/60 line-through' : 'text-on-surface-variant/30 line-through'}`}>{r}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Legado: domain completo */}
                      {res.domain && !res.domain_add && !res.domain_remove && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Objetivo Modificado:</span>
                          <p className="text-[10px] text-on-surface-variant">{res.domain}</p>
                        </div>
                      )}

                      {/* Variáveis */}
                      {res.update_variables?.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/30 space-y-1.5">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block">Campos Ajustados:</span>
                          {res.update_variables.map((v, i) => {
                            const key = `var_${i}`; const on = enabledItems.has(key)
                            return (
                              <div key={key} className={`flex items-start gap-2 transition-opacity ${on ? '' : 'opacity-40'}`}>
                                <button onClick={() => setEnabledItems(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                                  className="flex-shrink-0 mt-0.5" title={on ? 'Desabilitar' : 'Habilitar'}>
                                  <span className={`material-symbols-outlined transition-colors ${on ? 'text-secondary' : 'text-on-surface-variant/30'}`}
                                        style={{ fontSize: 14, fontVariationSettings: on ? "'FILL' 1" : undefined }}>check_box{on ? '' : '_outline_blank'}</span>
                                </button>
                                <span className={`text-[10px] ${on ? 'text-on-surface-variant' : 'text-on-surface-variant/40 line-through'}`}>
                                  Variável <code>{v.name}</code>: "{v.description}"
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Saídas */}
                      {res.update_exits?.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/30 space-y-1.5">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block">Saídas Ajustadas:</span>
                          {res.update_exits.map((e, i) => {
                            const key = `exit_${i}`; const on = enabledItems.has(key)
                            return (
                              <div key={key} className={`flex items-start gap-2 transition-opacity ${on ? '' : 'opacity-40'}`}>
                                <button onClick={() => setEnabledItems(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                                  className="flex-shrink-0 mt-0.5" title={on ? 'Desabilitar' : 'Habilitar'}>
                                  <span className={`material-symbols-outlined transition-colors ${on ? 'text-secondary' : 'text-on-surface-variant/30'}`}
                                        style={{ fontSize: 14, fontVariationSettings: on ? "'FILL' 1" : undefined }}>check_box{on ? '' : '_outline_blank'}</span>
                                </button>
                                <span className={`text-[10px] ${on ? 'text-on-surface-variant' : 'text-on-surface-variant/40 line-through'}`}>
                                  Saída <code>{e.key}</code>: "{e.description}"
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto max-h-[50vh] border border-outline-variant/60 rounded bg-surface-container-lowest p-3 font-mono text-[10px] leading-relaxed select-none">
                      {promptDiffResult.length === 0 ? (
                        <div className="text-center py-8 text-on-surface-variant/40">
                          Sem alterações textuais geradas no prompt compilado.
                        </div>
                      ) : (
                        promptDiffResult.map((line, idx) => {
                          const isAdd = line.type === 'added'
                          const isRem = line.type === 'removed'
                          return (
                            <div
                              key={idx}
                              className={`flex px-2 py-0.5 rounded-sm my-0.5 ${
                                isAdd 
                                  ? 'bg-secondary/15 text-secondary border-l-2 border-secondary font-medium' 
                                  : isRem 
                                    ? 'bg-error/15 text-error border-l-2 border-error line-through' 
                                    : 'text-on-surface-variant/70'
                              }`}
                            >
                              <span className="w-4 flex-shrink-0 opacity-40 select-none font-bold">
                                {isAdd ? '+' : isRem ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre-wrap flex-1">{line.content || ' '}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* Campo de refinamento iterativo */}
                  <div className="border border-outline-variant/50 rounded-lg overflow-hidden"
                       style={{ background: 'var(--color-surface-container)' }}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/30"
                         style={{ background: 'var(--color-surface-container-high)' }}>
                      <span className="material-symbols-outlined text-on-surface-variant/50" style={{ fontSize: 14 }}>edit_note</span>
                      <span className="text-[9px] font-mono text-on-surface-variant/50">Não ficou bom? Corrija aqui e refine antes de aplicar</span>
                    </div>
                    <div className="flex gap-2 p-2">
                      <textarea
                        value={adjustmentFeedback}
                        onChange={e => setAdjustmentFeedback(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefineAdjustment() } }}
                        placeholder="Ex: Remova a parte sobre horário, isso não foi pedido..."
                        rows={2}
                        disabled={isRefiningAdjustment}
                        className="flex-1 text-[10px] font-mono bg-transparent border border-outline-variant/40 rounded px-2 py-1.5 focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/25 resize-none disabled:opacity-40"
                      />
                      <button
                        onClick={handleRefineAdjustment}
                        disabled={!adjustmentFeedback.trim() || isRefiningAdjustment}
                        className={`flex items-center gap-1 px-3 rounded text-[9px] font-mono font-semibold transition-all self-stretch flex-shrink-0
                          ${isRefiningAdjustment
                            ? 'animate-pulse cursor-wait'
                            : 'hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                        style={isRefiningAdjustment
                          ? { border: '1px solid rgba(99,102,241,0.6)', color: '#fff', background: '#6366f1', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }
                          : { border: '1px solid rgb(var(--color-secondary) / 0.4)', color: 'rgb(var(--color-secondary))' }
                        }
                      >
                        {isRefiningAdjustment
                          ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 12 }}>progress_activity</span> Refinando...</>
                          : <><span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span> Refinar</>}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={isApplyingAdjustments}
                      onClick={async () => {
                        const filtered = {
                          ...res,
                          agentPersona: enabledItems.has('persona') ? res.agentPersona : '',
                          domain_add: (res.domain_add || []).filter((_, i) => enabledItems.has(`domain_add_${i}`)),
                          domain_remove: (res.domain_remove || []).filter((_, i) => enabledItems.has(`domain_remove_${i}`)),
                          update_variables: (res.update_variables || []).filter((_, i) => enabledItems.has(`var_${i}`)),
                          update_exits: (res.update_exits || []).filter((_, i) => enabledItems.has(`exit_${i}`)),
                        }
                        setIsApplyingAdjustments(true)
                        try { await handleApplyAdjustments(filtered) } finally { setIsApplyingAdjustments(false) }
                      }}
                      className={`flex-1 py-3 bg-secondary text-on-secondary rounded font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isApplyingAdjustments ? 'opacity-70 cursor-wait' : 'hover:opacity-90'}`}
                    >
                      {isApplyingAdjustments && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                      {isApplyingAdjustments ? 'Aplicando...' : 'Aplicar Selecionados'}
                    </button>
                    <button
                      onClick={() => { setManualRefineResult(null); setAutoRefineResult(null); setAdjustmentFeedback('') }}
                      className="px-6 py-3 border border-outline-variant text-[11px] font-mono font-bold uppercase hover:bg-surface-container-high rounded"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </main>

      {/* Modal de revisão de passo */}
      {reviewModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setReviewModal(null)}>
          <div className="w-full max-w-md bg-surface-container border border-outline-variant rounded-xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
              <div>
                <p className="text-sm font-semibold text-on-surface">Revisar passo</p>
                <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">O que deveria ter acontecido</p>
              </div>
              <button onClick={() => setReviewModal(null)} className="p-1.5 rounded text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1.5 uppercase">Status correto</label>
                <select
                  autoFocus
                  value={reviewDraft.status}
                  onChange={e => setReviewDraft(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Selecionar...</option>
                  {[
                    { key: 'in_process', label: 'in_process — Em andamento' },
                    { key: 'success', label: 'success — Concluído' },
                    ...(activeConfig.exitDestinations || [])
                      .filter(e => e.key !== 'in_process' && e.key !== 'success')
                      .map(e => ({ key: e.key, label: e.key }))
                  ].map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Resposta do agente */}
              <div>
                <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1.5 uppercase">Resposta correta do agente</label>
                <textarea
                  value={reviewDraft.response}
                  onChange={e => setReviewDraft(prev => ({ ...prev, response: e.target.value }))}
                  rows={4}
                  placeholder="Como o agente deveria ter respondido..."
                  className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary resize-none leading-relaxed"
                />
              </div>

              {/* Variáveis */}
              {Object.keys(reviewDraft.variables).length > 0 && (
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-on-surface-variant/60 mb-1.5 uppercase">Variáveis corretas</label>
                  <div className="space-y-2">
                    {Object.entries(reviewDraft.variables).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-tertiary flex-shrink-0 w-28 truncate">{k}</span>
                        <input
                          type="text"
                          value={v}
                          onChange={e => setReviewDraft(prev => ({ ...prev, variables: { ...prev.variables, [k]: e.target.value } }))}
                          className="flex-1 bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-on-surface focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-outline-variant flex flex-col gap-2 flex-shrink-0">
              {/* Está correto — confirma sem mudar nada */}
              <button
                onClick={() => {
                  const { tcIdx, sIdx } = reviewModal
                  const reviewKey = `${tcIdx}-${sIdx}`
                  setTestCases(prev => prev.map(tc => {
                    if (tc.name !== suiteResults?.results?.[tcIdx]?.testCaseName) return tc
                    return { ...tc, steps: tc.steps.map((s, i) => i === sIdx ? { ...s, expectedStatus: reviewDraft.status } : s) }
                  }))
                  setStepReviews(prev => ({ ...prev, [reviewKey]: { correctedStatus: reviewDraft.status, correctedResponse: reviewDraft.response, correctedVariables: reviewDraft.variables, action: 'fix_test' } }))
                  setReviewModal(null)
                }}
                className="w-full py-2.5 text-[11px] font-mono font-semibold bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Está correto — atualizar expectativa do teste
              </button>

              <button
                disabled={!reviewDraft.status}
                onClick={() => {
                  const { tcIdx, sIdx } = reviewModal
                  const reviewKey = `${tcIdx}-${sIdx}`
                  // Badge visual
                  setStepReviews(prev => ({ ...prev, [reviewKey]: { correctedStatus: reviewDraft.status, correctedResponse: reviewDraft.response, correctedVariables: reviewDraft.variables, action: 'add_example' } }))
                  // Persistir no Supabase
                  const step = suiteResults?.results?.[tcIdx]?.stepResults?.[sIdx]
                  const newExample = {
                    clientMessage: step?.clientMessage || '',
                    scenario: suiteResults?.results?.[tcIdx]?.testCaseName || '',
                    correctStatus: reviewDraft.status,
                    correctResponse: reviewDraft.response || '',
                    correctVariables: reviewDraft.variables || {},
                    savedAt: new Date().toISOString(),
                  }
                  const newExamples = [...savedExamples, newExample]
                  setSavedExamples(newExamples)
                  if (activeAgentId) {
                    saveAgentExamples(activeAgentId, newExamples).catch(err => console.error('Erro ao salvar exemplo:', err))
                  }
                  setReviewModal(null)
                }}
                className="w-full py-2.5 text-[11px] font-mono font-semibold bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">school</span>
                Salvar como exemplo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de prompt completo */}
      {promptModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPromptModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl bg-surface-container border border-outline-variant rounded-xl shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
              <div>
                <p className="text-sm font-semibold text-on-surface">Prompt Completo</p>
                <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
                  {activePromptText.length.toLocaleString('pt-BR')} caracteres
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activePromptText)
                    setPromptCopied(true)
                    setTimeout(() => setPromptCopied(false), 2000)
                  }}
                  title="Copiar prompt"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono font-semibold transition-all ${promptCopied ? 'border-secondary/50 text-secondary' : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{promptCopied ? 'check' : 'content_copy'}</span>
                  {promptCopied ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={() => setPromptModalOpen(false)}
                  className="p-1.5 rounded text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-[11px] font-mono text-on-surface/80 leading-relaxed whitespace-pre-wrap">
                {activePromptText}
              </pre>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- COLUNA DIREITA: INSPEÇÃO DE ESTADO E LOGS (3/12) --- */}
      <aside className="col-span-3 h-full border-l border-outline-variant flex flex-col overflow-y-auto p-4 space-y-5"
             style={{ background: 'var(--color-surface-container-low)' }}>
        <div>
          <h3 className="text-xs font-mono font-bold tracking-widest text-on-surface-variant/70 uppercase">Inspetor de Estado</h3>
          <p className="text-[10px] text-on-surface-variant/40 font-mono mt-0.5">Estado do bot no último turno</p>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <span className="block text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase">STATUS ATUAL</span>
          <div className="flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface shadow-sm">
            <span className="text-xs font-mono font-bold">{botState.status}</span>
            <span className={`status-pill px-2.5 py-1 ${
              botState.status === 'in_process'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : botState.status === 'success'
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
            }`}>
              {botState.status === 'in_process' ? 'Em Progresso' : botState.status === 'success' ? 'Concluído' : 'Transbordo'}
            </span>
          </div>
        </div>

        {/* Resumo da conversa */}
        <div className="space-y-1.5">
          <span className="block text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase">RESUMO DA CONVERSA</span>
          <div className="p-3 rounded-lg border border-outline-variant bg-surface text-[10px] font-mono leading-relaxed max-h-36 overflow-y-auto text-on-surface-variant/80 shadow-sm">
            {botState.summary}
          </div>
        </div>

        {/* Variáveis e valores capturados */}
        <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
          <span className="block text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase">VARIÁVEIS CAPTURADAS</span>
          <div className="flex-1 border border-outline-variant bg-surface rounded-lg overflow-hidden flex flex-col shadow-sm">
            <div className="grid grid-cols-12 text-[9px] font-mono font-bold border-b border-outline-variant/60 bg-surface-container px-3 py-2 text-on-surface-variant/60">
              <span className="col-span-5">Variável</span>
              <span className="col-span-7">Valor Atual</span>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/30 text-[10px] font-mono">
              {config.variables.map(v => {
                const val = botState.variables[v.name]
                const isChanged = variableChanges[v.name]
                return (
                  <div key={v.name} className={`grid grid-cols-12 px-3 py-2 transition-colors ${isChanged ? 'flash-green-anim' : ''}`}>
                    <span className="col-span-5 font-bold text-on-surface truncate pr-1" title={v.name}>{v.name}</span>
                    <span className={`col-span-7 break-all ${val ? 'text-secondary font-semibold' : 'text-on-surface-variant/25'}`}>
                      {val !== undefined ? String(val) : 'vazio'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Última resposta JSON bruta */}
        {lastResponseJson && (
          <div className="space-y-1.5">
            <span className="block text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase">RETORNO JSON BRUTO</span>
            <pre className="p-3 rounded-lg border border-outline-variant bg-surface text-[8px] font-mono leading-tight overflow-x-auto max-h-40 text-on-surface-variant/85 shadow-sm">
              {JSON.stringify(lastResponseJson, null, 2)}
            </pre>
          </div>
        )}
      </aside>
    </div>
  )
}

// Helper para chamar chat completion direta (chat manual)
async function runChatDirect(messages, config) {
  const { apiKey, endpoint, temperature } = config
  const model = (config.model || '').trim()

  if (!apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')
  if (!model) throw new Error('Nenhum modelo definido. Configure o modelo em Configurações.')
  if (!endpoint) throw new Error('Endpoint não configurado. Vá em Configurações.')

  const base = endpoint.replace(/\/$/, '')
  const url = `${base}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      /^(o1|o3|o4|o-|gpt-5)/i.test(model)
        ? { model, messages, max_completion_tokens: 2048 }
        : { model, messages, max_tokens: 2048, temperature: temperature ?? 0.1 }
    ),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `HTTP ${res.status} [${base}]`)
  }
  return (await res.json()).choices?.[0]?.message?.content || ''
}

// Helper para extrair JSON
function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('A resposta não contém JSON válido.')
  return JSON.parse(match[0])
}
