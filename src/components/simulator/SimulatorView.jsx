import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { runTestSuite, runTestCase, refineConfigWithFeedback } from '../../lib/promptTuner'
import { buildPrompt } from '../../engine/promptBuilder'
import { detectProviderFromKey, fetchOpenAIModels, detectProviderFromModel } from '../../lib/claude'
import { loadHistory, saveSnapshot } from '../../lib/promptHistory'
import { diffLines } from '../../lib/promptDiff'
import { deployAgent, updateAgent, isSupabaseConfigured, makeLogEntry } from '../../lib/supabase'


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
    }))
  }, [agents])

  const activePromptText = useMemo(() => {
    if (promptSource === 'current') return generatedPrompt || ''
    const found = historyList.find(h => h.id?.toString() === promptSource?.toString())
    return found ? found.prompt : ''
  }, [promptSource, historyList, generatedPrompt])

  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'automated'
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
  const [isRefiningAuto, setIsRefiningAuto] = useState(false)
  const [autoRefineResult, setAutoRefineResult] = useState(null)
  const [editingTestCase, setEditingTestCase] = useState(null)

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

  // --- AÇÕES MODO AUTOMÁTICO ---
  const handleRunTests = async () => {
    setIsRunningTests(true)
    setSuiteResults(null)
    setAutoRefineResult(null)

    try {
      const results = await runTestSuite(activePromptText, config, testCases, targetModelConfig)
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
      const adjustments = await refineConfigWithFeedback(config, suiteResults, aiConfig)
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

    setConfig(prev => {
      let variables = [...prev.variables]
      let exitDestinations = [...prev.exitDestinations]

      // Atualizar variáveis
      if (adjustments.update_variables) {
        adjustments.update_variables.forEach(uv => {
          variables = variables.map(v => 
            v.name === uv.name ? { ...v, description: uv.description } : v
          )
        })
      }

      // Atualizar saídas
      if (adjustments.update_exits) {
        adjustments.update_exits.forEach(ue => {
          exitDestinations = exitDestinations.map(e => 
            e.key === ue.key ? { ...e, description: ue.description, exitMessage: ue.exitMessage || e.exitMessage } : e
          )
        })
      }

      const nextConfig = {
        ...prev,
        agentPersona: adjustments.agentPersona || prev.agentPersona,
        domain: adjustments.domain || prev.domain,
        variables,
        exitDestinations
      }

      // Regenerar o prompt compilado e salvar snapshot no histórico
      setTimeout(async () => {
        const nextPrompt = buildPrompt(nextConfig)
        setGeneratedPrompt(nextPrompt)

        // Salva automaticamente no histórico indicando alteração via simulador
        const isAuto = Boolean(autoRefineResult)
        const desc = isAuto 
          ? "Ajuste via Simulador - Correção de testes em lote" 
          : "Ajuste via Simulador - Refinamento manual de chat"

        try {
          saveSnapshot({ config: nextConfig, prompt: nextPrompt, description: desc })
          setHistoryList(loadHistory())

          if (isSupabaseConfigured) {
            if (loadedAgentId) {
              const currentLogs = agents.find(a => a.id === loadedAgentId)?.logs || []
              const logAction = isAuto ? 'Ajuste automático (simulador)' : 'Ajuste manual (simulador)'
              const data = await updateAgent(loadedAgentId, { config: nextConfig, generatedPrompt: nextPrompt, logs: currentLogs, logAction })
              onAgentUpdated?.(data)
            } else {
              await deployAgent({ config: nextConfig, generatedPrompt: nextPrompt, logs: [makeLogEntry(isAuto ? 'Ajuste automático (simulador)' : 'Ajuste manual (simulador)')] })
            }
          }
        } catch (err) {
          console.error('Erro ao salvar snapshot automático do simulador:', err)
        }
      }, 50)

      return nextConfig
    })

    await showDialog({ type: 'alert', message: 'Configurações e prompt atualizados com sucesso com base nas correções do Simulador!' })
    setManualRefineResult(null)
    setAutoRefineResult(null)
    setSuiteResults(null)
    setPromptSource('current') // Sempre muda a origem do prompt de volta para o rascunho atual com as novas alterações aplicadas!
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
              onChange={e => setTemperature(parseFloat(e.target.value))}
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
              <option value="current">Rascunho Atual do Editor</option>
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
                <span>{activePromptText.length} chars</span>
              </div>
              <textarea
                readOnly
                value={activePromptText}
                className="w-full h-20 bg-transparent text-[10px] font-mono text-on-surface-variant/80 focus:outline-none resize-none border-0 p-0 scrollbar-thin"
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
              <button
                onClick={() => setEditingTestCase({ name: 'Novo Cenário', steps: [{ clientMessage: '', expectedStatus: 'in_process' }] })}
                className="text-[10px] font-mono flex items-center gap-0.5 text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[12px]">add</span> Adicionar
              </button>
            </div>

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
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
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
                    className="px-4 py-1.5 text-[10px] font-mono font-bold bg-tertiary text-on-tertiary rounded shadow hover:opacity-90 active:scale-95 disabled:opacity-40 whitespace-nowrap"
                  >
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
                <h3 className="text-xs font-mono font-bold text-on-surface-variant/60 uppercase">Detalhes da Execução</h3>
                
                <div className="space-y-3">
                  {suiteResults.results.map((res, tcIdx) => (
                    <div key={tcIdx} className={`rounded-lg border p-4 bg-surface-container-high/20 ${res.passed ? 'border-secondary/20 bg-secondary/5' : 'border-error/20 bg-error/5'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[18px] ${res.passed ? 'text-secondary' : 'text-error'}`}>
                            {res.passed ? 'check_circle' : 'cancel'}
                          </span>
                          <span className="text-xs font-mono font-bold text-on-surface">{res.testCaseName}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold uppercase ${res.passed ? 'text-secondary' : 'text-error'}`}>
                          {res.passed ? 'Passou' : 'Falhou'}
                        </span>
                      </div>

                      {/* Passos e asserções */}
                      <div className="space-y-2 mt-3 pl-6 border-l border-outline-variant/40">
                        {res.stepResults.map((step, sIdx) => (
                          <div key={sIdx} className="text-[10px] font-mono space-y-1">
                            <div className="flex items-start gap-1">
                              <span className="text-on-surface-variant/40">&gt; Cliente:</span>
                              <span className="italic">"{step.clientMessage}"</span>
                            </div>
                            
                            {step.parsedResponse ? (
                              <div className="pl-3 text-[9px] space-y-0.5 text-on-surface-variant/70">
                                <div><span className="font-bold">Status retornado:</span> `{step.parsedResponse.status}`</div>
                                {Object.keys(step.parsedResponse.variables || {}).length > 0 && (
                                  <div><span className="font-bold">Variáveis:</span> {JSON.stringify(step.parsedResponse.variables)}</div>
                                )}
                              </div>
                            ) : step.rawResponse ? (
                              <div className="pl-3 text-[9px] text-error/80 max-w-full overflow-x-auto whitespace-pre">
                                {step.rawResponse}
                              </div>
                            ) : null}

                            {!step.passed && (
                              <div className="pl-3 flex items-center gap-1 text-error font-bold text-[9px]">
                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                                <span>{step.error}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botão de ajuste automático por IA se houver falhas */}
                {suiteResults.successRate < 100 && (
                  <div className="p-4 rounded-lg border border-error/20 bg-error/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                      <div>
                        <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Motivo do Ajuste:</span>
                        <p className="text-[11px] text-on-surface leading-relaxed italic">"{res.summary}"</p>
                      </div>

                      {res.agentPersona && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Persona Modificada:</span>
                          <p className="text-[10px] text-on-surface-variant max-h-20 overflow-y-auto whitespace-pre-wrap">{res.agentPersona}</p>
                        </div>
                      )}

                      {res.domain && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Objetivo Modificado:</span>
                          <p className="text-[10px] text-on-surface-variant">{res.domain}</p>
                        </div>
                      )}

                      {res.update_variables && res.update_variables.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Campos Ajustados:</span>
                          <ul className="list-disc list-inside space-y-1 text-[10px] text-on-surface-variant">
                            {res.update_variables.map((v, i) => (
                              <li key={i}>Variável `{v.name}`: "{v.description}"</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {res.update_exits && res.update_exits.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <span className="font-bold text-secondary text-[10px] uppercase tracking-wider block mb-1">Saídas Ajustadas:</span>
                          <ul className="list-disc list-inside space-y-1 text-[10px] text-on-surface-variant">
                            {res.update_exits.map((e, i) => (
                              <li key={i}>Saída `{e.key}`: "{e.description}"</li>
                            ))}
                          </ul>
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

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleApplyAdjustments(res)}
                      className="flex-1 py-3 bg-secondary text-on-secondary rounded font-mono text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                    >
                      Aplicar Ajustes no Prompt
                    </button>
                    <button
                      onClick={() => { setManualRefineResult(null); setAutoRefineResult(null) }}
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
