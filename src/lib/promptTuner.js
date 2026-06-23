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
      stepsLog: r.stepResults.map(s => ({
        input: s.clientMessage,
        output: s.parsedResponse ? `Status: ${s.parsedResponse.status}, Msg: ${s.parsedResponse.message}, Vars: ${JSON.stringify(s.parsedResponse.variables)}` : s.rawResponse,
        passed: s.passed,
        error: s.error
      }))
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
Sua missão é corrigir e ajustar os campos de configuração do agente para que ele passe em toda a bateria de testes.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify(existingConfig, null, 2)}

RESULTADOS DOS TESTES QUE FALHARAM:
${JSON.stringify(failures, null, 2)}

INSTRUÇÕES DE AJUSTE:
Analise onde a IA falhou. Ela pode ter falhado por:
1. Não capturar uma variável (corrija atualizando a descrição da variável no campo 'description' correspondente).
2. Não acionar a saída correta (corrija detalhando melhor a condição no campo 'description' daquela saída em exitDestinations).
3. Ter o tom de voz inadequado ou responder com dados errados (corrija ajustando a 'agentPersona' ou regras associadas).

Você deve propor alterações na configuração atual para consertar esses erros. Mantenha as alterações concisas e focadas.

Retorne APENAS o JSON abaixo contendo as propriedades corrigidas (retorne apenas as propriedades que você de fato alterar):

{
  "agentPersona": "Persona completa corrigida (vazio se não alterar)",
  "domain": "Domínio completo corrigido (vazio se não alterar)",
  "update_variables": [
    { "name": "nome_exato_da_var", "description": "Nova descrição mais clara orientando a IA" }
  ],
  "update_exits": [
    { "key": "saida_exata_key", "description": "Nova condição iniciando com 'Interrompa a IA quando o cliente...'", "exitMessage": "Mensagem opcional de transição" }
  ],
  "summary": "Explicação resumida em português de por que esta alteração resolve a falha"
}

REGRAS:
- update_variables: preencha apenas se precisar ajustar a descrição de uma variável já existente para que a IA entenda melhor como preenchê-la.
- update_exits: preencha apenas para ajustar condições de saídas já existentes. A descrição DEVE iniciar com 'Interrompa a IA quando o cliente'.
- Mantenha tudo no formato compatível com o BotConversa.`

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

  const body = {
    model,
    messages,
    max_tokens: 2048,
    temperature: temperature != null ? temperature : 0.1,
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
