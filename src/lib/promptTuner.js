import { callAI, detectProviderFromKey } from './claude'
import { buildPrompt } from '../engine/promptBuilder'

/**
 * Executes a single test case (conversation scenario with multiple steps)
 * against the selected model and temperature.
 *
 * @param {string} systemPrompt The generated system prompt
 * @param {object} config The current agent config
 * @param {object} testCase The test case containing steps
 * @param {object} modelConfig The chosen model and temperature
 * @returns {Promise<object>} Result of the test case
 */
export async function runTestCase(systemPrompt, config, testCase, modelConfig) {
  const messages = [
    { role: 'system', content: systemPrompt }
  ]
  const stepResults = []
  let passed = true
  let failureReason = ''

  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i]
    messages.push({ role: 'user', content: step.clientMessage })

    try {
      // Configurar a chamada para simular exatamente o modelo e a temperatura
      const callConfig = {
        provider: modelConfig.provider || 'compat',
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        model: modelConfig.model,
        // Injetamos a temperatura customizada na requisição
        temperature: modelConfig.temperature != null ? modelConfig.temperature : 0.1,
      }

      // Preparar a chamada. Formato de mensagens da API OpenAI/Gemini/Claude
      // Em claude.js, a função callAI usa callClaude, callGemini ou callOpenAICompat.
      // Modificamos a chamada para passar o histórico de mensagens completo.
      // Como callAI espera um prompt simples do tipo string, precisamos criar uma versão que suporte chat
      // ou construir o prompt de chat agregando o histórico.
      // Vamos criar um método de chamada de chat em claude.js ou simular montando o prompt de texto
      // caso o provedor seja Gemini simplificado.
      // Mas para manter a consistência, vamos chamar a API diretamente aqui de forma simplificada
      // ou estender callAI. Vamos ver como callAI está implementada:
      // callAI(prompt, config) -> onde prompt é string simples.
      // Para simular chat multilinha com histórico no callAI padrão, podemos formatar o histórico
      // como texto se for um prompt normal, ou fazer uma chamada de chat estruturada.
      // Como a maioria das APIs suporta chat completions, vamos implementar a chamada de chat aqui
      // de forma compatível com a chave do usuário.
      const responseText = await callChatAPI(messages, callConfig)
      
      let parsedResponse
      try {
        parsedResponse = extractJson(responseText)
      } catch (err) {
        passed = false
        failureReason = `Resposta da IA não é um JSON válido: ${err.message}. Retorno bruto: "${responseText}"`
        stepResults.push({
          stepIndex: i,
          clientMessage: step.clientMessage,
          rawResponse: responseText,
          parsedResponse: null,
          passed: false,
          error: failureReason
        })
        break
      }

      const { status = '', message = '', variables = {}, summary = '' } = parsedResponse

      // Validar asserções do passo
      const assertions = []
      let stepPassed = true
      let stepError = ''

      if (step.expectedStatus && status !== step.expectedStatus) {
        stepPassed = false
        stepError = `Status esperado era "${step.expectedStatus}", mas retornou "${status}"`
      }

      if (step.expectedMessageContains && !message.toLowerCase().includes(step.expectedMessageContains.toLowerCase())) {
        stepPassed = false
        stepError = `${stepError ? stepError + '; ' : ''}Mensagem esperada continha "${step.expectedMessageContains}", mas a resposta foi "${message}"`
      }

      if (step.expectedVariables) {
        for (const [varName, expectedVal] of Object.entries(step.expectedVariables)) {
          const actualVal = variables[varName]
          if (expectedVal === '__present__') {
            if (actualVal === undefined || actualVal === null || String(actualVal).trim() === '') {
              stepPassed = false
              stepError = `${stepError ? stepError + '; ' : ''}Variável "${varName}" deveria estar preenchida, mas está vazia ou ausente`
            }
          } else if (String(actualVal).toLowerCase() !== String(expectedVal).toLowerCase()) {
            stepPassed = false
            stepError = `${stepError ? stepError + '; ' : ''}Variável "${varName}" esperada: "${expectedVal}", obtida: "${actualVal}"`
          }
        }
      }

      stepResults.push({
        stepIndex: i,
        clientMessage: step.clientMessage,
        rawResponse: responseText,
        parsedResponse: { status, message, variables, summary },
        passed: stepPassed,
        error: stepError
      })

      if (!stepPassed) {
        passed = false
        failureReason = stepError
        break
      }

      // Adicionar a resposta da IA no histórico para o próximo turno da conversa
      messages.push({ role: 'assistant', content: responseText })

    } catch (err) {
      passed = false
      failureReason = `Erro na requisição: ${err.message}`
      stepResults.push({
        stepIndex: i,
        clientMessage: step.clientMessage,
        rawResponse: null,
        parsedResponse: null,
        passed: false,
        error: failureReason
      })
      break
    }
  }

  return {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    passed,
    failureReason,
    stepResults
  }
}

/**
 * Runs the whole test suite against the compiled prompt
 */
export async function runTestSuite(systemPrompt, config, testCases, modelConfig) {
  const results = []
  let passedCount = 0

  for (const tc of testCases) {
    const res = await runTestCase(systemPrompt, config, tc, modelConfig)
    results.push(res)
    if (res.passed) passedCount++
  }

  return {
    passedCount,
    totalCount: testCases.length,
    successRate: testCases.length > 0 ? (passedCount / testCases.length) * 100 : 100,
    results
  }
}

/**
 * Uses LLM to refine the config to fix failing tests
 */
export async function refineConfigWithFeedback(config, testSuiteResults, aiConfig) {
  // Coletar apenas as falhas estruturadas
  const failures = testSuiteResults.results.filter(r => !r.passed).map(r => {
    return {
      scenario: r.testCaseName,
      reason: r.failureReason,
      stepsLog: r.stepResults.map(s => {
        const entry = {
          pergunta_do_usuario: s.clientMessage,
          passed: s.passed,
        }
        // Separar feedback humano da resposta errada da IA
        if (s.error) {
          const feedbackMatch = s.error.match(/Crítica:\s*"(.+)"/)
          const ratingMatch  = s.error.match(/Nota do usuário:\s*(\d)/)
          if (feedbackMatch?.[1] && feedbackMatch[1] !== 'sem comentário') {
            entry.instrucao_do_usuario = feedbackMatch[1]
          }
          if (ratingMatch) entry.nota = Number(ratingMatch[1])
        }
        // Incluir o que a IA respondeu de errado apenas como contexto, separado
        const rawOutput = s.parsedResponse
          ? `Status: ${s.parsedResponse.status}, Msg: ${s.parsedResponse.message}`
          : s.rawResponse
        if (rawOutput) entry.resposta_errada_da_ia = rawOutput
        return entry
      })
    }
  })

  if (failures.length === 0) return null // Nada para ajustar

  const existingConfig = {
    agentName: config.agentName,
    agentPersona: config.agentPersona,
    domain: config.domain,
    variables: config.variables.map(v => ({ name: v.name, type: v.type, description: v.description, options: v.options || '' })),
    exitDestinations: config.exitDestinations.filter(e => !e.isSystem).map(e => ({ key: e.key, label: e.label, description: e.description || '', sendExitMessage: e.sendExitMessage, exitMessage: e.exitMessage || '' })),
  }

  const prompt = `Você é um Engenheiro de Prompt especialista na otimização de agentes de WhatsApp para o BotConversa.
Sua missão é corrigir os campos de configuração do agente com base no feedback do testador.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify(existingConfig, null, 2)}

FALHAS IDENTIFICADAS:
${JSON.stringify(failures, null, 2)}

HIERARQUIA DE PRIORIDADE para gerar a correção:
1. Se há "instrucao_do_usuario": use EXATAMENTE o que o usuário pediu. Não adicione nada além disso.
2. Se não há "instrucao_do_usuario": use "pergunta_do_usuario" para inferir o que o agente deveria ter feito.
3. "resposta_errada_da_ia": use APENAS para entender o tipo de erro. NUNCA copie termos ou conceitos dela para a correção.

ONDE COLOCAR CADA TIPO DE CORREÇÃO:
- "domain": use para regras de atendimento, informações factuais, procedimentos específicos, o que perguntar ou informar em cada situação. É aqui que vai a grande maioria das correções.
- "agentPersona": use SOMENTE se o problema for de tom, linguagem ou personalidade (ex: foi rude, foi informal demais, não se apresentou). NUNCA use para corrigir fatos, procedimentos ou o que o agente deve perguntar/informar.
- "update_variables" / "update_exits": use se o problema for captura de dados ou encaminhamento.

Retorne APENAS o JSON abaixo (somente as propriedades que você de fato alterar):

{
  "agentPersona": "Persona completa corrigida — USE APENAS para tom/linguagem/personalidade (vazio se não alterar)",
  "domain_add": ["Regra nova a acrescentar ao domínio — uma frase curta"],
  "domain_remove": ["Trecho EXATO do domínio atual a remover ou substituir"],
  "update_variables": [
    { "name": "nome_exato_da_var", "description": "Nova descrição mais clara orientando a IA" }
  ],
  "update_exits": [
    { "key": "saida_exata_key", "description": "Nova condição iniciando com 'Interrompa a IA quando o cliente...'", "exitMessage": "Mensagem opcional de transição" }
  ],
  "summary": "Uma frase direta explicando o que foi corrigido"
}

REGRAS CRÍTICAS:
- NUNCA reescreva o domínio inteiro. Use APENAS domain_add e domain_remove para mudanças cirúrgicas.
- domain_add: array com as frases novas a adicionar. Cada item é UMA frase curta e direta.
- domain_remove: array com trechos EXATOS do domínio atual que precisam ser removidos ou substituídos. Copie o texto original sem alterar.
- Se só precisa adicionar uma regra, use apenas domain_add e deixe domain_remove vazio.
- agentPersona: texto COMPLETO apenas se o problema for de tom ou linguagem — nunca para regras de atendimento.
- update_variables: só para ajustar descrição de variável já existente.
- update_exits: descrição DEVE iniciar com "Interrompa a IA quando o cliente".
- Não adicione informações (horários, preços, procedimentos) que não foram mencionadas no feedback.
- summary: máximo 1 frase.`

  // Resolver se usa a chave de lapidação dedicada ou a chave padrão
  const activeConfig = aiConfig?.refinerApiKey
    ? {
        provider: detectProviderFromKey(aiConfig.refinerApiKey)?.provider || 'compat',
        apiKey: aiConfig.refinerApiKey,
        endpoint: aiConfig.refinerEndpoint,
        model: aiConfig.refinerModel || ''
      }
    : aiConfig

  const responseText = await callAI(prompt, activeConfig)
  
  try {
    const parsed = extractJson(responseText)
    return parsed
  } catch (err) {
    throw new Error(`O otimizador de IA não retornou um JSON de ajuste válido: ${err.message}`)
  }
}

export async function refineAdjustment(currentAdjustment, userFeedback, config, aiConfig) {
  const activeConfig = aiConfig?.refinerApiKey
    ? { provider: detectProviderFromKey(aiConfig.refinerApiKey)?.provider || 'compat', apiKey: aiConfig.refinerApiKey, endpoint: aiConfig.refinerEndpoint, model: aiConfig.refinerModel || '' }
    : aiConfig

  const prompt = `Você é um Engenheiro de Prompt especialista em otimização de agentes de WhatsApp.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify({ domain: config.domain, agentPersona: config.agentPersona }, null, 2)}

SUGESTÃO DE AJUSTE GERADA ANTERIORMENTE:
${JSON.stringify(currentAdjustment, null, 2)}

CORREÇÃO DO USUÁRIO: "${userFeedback}"

O usuário viu a sugestão e quer um ajuste. Refine a proposta aplicando a correção. Mantenha o que estava correto e altere apenas o que o usuário indicou.

Retorne APENAS o JSON corrigido, sem texto adicional:

{
  "agentPersona": "Persona completa corrigida — apenas se problema for de tom/linguagem (vazio se não alterar)",
  "domain_add": ["Regra nova a acrescentar — uma frase curta"],
  "domain_remove": ["Trecho EXATO do domínio atual a remover"],
  "update_variables": [{ "name": "nome_exato", "description": "nova descrição" }],
  "update_exits": [{ "key": "saida_exata_key", "description": "Interrompa a IA quando o cliente...", "exitMessage": "" }],
  "summary": "Uma frase explicando o que foi corrigido"
}

REGRAS:
- Cada item em domain_add: UMA frase curta e direta, sem exemplos ou exceções.
- NUNCA reescreva o domínio inteiro.
- Não adicione informações não mencionadas pelo usuário.
- summary: máximo 1 frase.`

  const responseText = await callAI(prompt, activeConfig)
  try {
    return extractJson(responseText)
  } catch (err) {
    throw new Error(`Retorno inválido ao refinar ajuste: ${err.message}`)
  }
}

// Helper para extrair JSON
function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Retorno não contém JSON estruturado.')
  return JSON.parse(match[0])
}

// Executa requisição de chat completions direta de acordo com o provedor
async function callChatAPI(messages, config) {
  const { apiKey, endpoint, temperature } = config

  if (!apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')

  const model = (config.model || '').trim()
  if (!model) throw new Error('Nenhum modelo definido. Configure o modelo em Configurações.')

  if (!endpoint) throw new Error('Endpoint não configurado. Vá em Configurações.')

  const base = endpoint.replace(/\/$/, '')
  const url = `${base}/chat/completions`

  const fetchWithTimeout = (url, opts, ms = 90000) => {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), ms)
    return fetch(url, { ...opts, signal: ctrl.signal })
      .then(r => { clearTimeout(id); return r })
      .catch(e => { clearTimeout(id); throw e.name === 'AbortError' ? new Error('Tempo limite excedido (90s).') : e })
  }

  const isReasoning = /^(o1|o3|o4|o-|gpt-5)/i.test(model)
  const body = { model, messages }
  if (isReasoning) {
    body.max_completion_tokens = 2048
  } else {
    body.max_tokens = 2048
    body.temperature = temperature != null ? temperature : 0.1
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `HTTP ${res.status} [${base}]`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error(`Modelo "${model}" retornou resposta vazia.`)
  return text
}
