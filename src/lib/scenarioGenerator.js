import { callAI, loadAIConfig, detectProviderFromKey } from './claude'

export async function generateTestScenarios(config, aiConfig, count = 8) {
  const base = aiConfig || loadAIConfig()
  if (!base?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')

  // Usa chave dedicada para cenários se configurada; senão cai para a principal
  const cfg = base.scenarioApiKey
    ? {
        provider: detectProviderFromKey(base.scenarioApiKey)?.provider || 'compat',
        apiKey: base.scenarioApiKey,
        endpoint: base.scenarioEndpoint || '',
        model: base.scenarioModel || 'gemini-2.0-flash',
      }
    : base

  const exits = config.exitDestinations
    .filter(e => !e.isSystem)
    .map(e => ({ key: e.key, label: e.label, description: e.description || '' }))

  const variables = config.variables
    .filter(v => v.name?.trim())
    .map(v => ({ name: v.name, description: v.description }))

  const exitKeys = exits.map(e => e.key).join(' | ')

  const prompt = `Você é um especialista em testes de agentes de IA para WhatsApp.

CONFIGURAÇÃO DO AGENTE:
Nome: ${config.agentName}
Persona: ${config.agentPersona || '(não definida)'}
Objetivo: ${config.domain || '(não definido)'}

SAÍDAS DISPONÍVEIS:
${JSON.stringify(exits, null, 2)}

VARIÁVEIS A COLETAR:
${JSON.stringify(variables, null, 2)}

Gere exatamente ${count} cenários de teste realistas e variados para este agente.

Cubra obrigatoriamente:
- Pelo menos um cenário para CADA saída configurada
- Pelo menos um cenário com pedido incompleto (usuário não diz o tipo/dado necessário)
- Pelo menos um cenário com pedido fora do objetivo do agente
- Pelo menos um cenário com linguagem informal ou ambígua

Retorne APENAS o JSON abaixo, sem markdown, sem texto adicional:

[
  {
    "name": "Nome curto e descritivo",
    "clientGoal": "O que o cliente quer resolver — uma frase",
    "steps": [
      {
        "clientMessage": "Mensagem que o cliente enviaria no WhatsApp (natural, informal)",
        "expectedStatus": "in_process"
      },
      {
        "clientMessage": "Próxima mensagem do cliente se o agente precisar de mais info",
        "expectedStatus": "${exitKeys || 'saida_atendente'}"
      }
    ]
  }
]

REGRAS OBRIGATÓRIAS:
- Cada cenário tem entre 1 e 4 passos
- clientMessage deve ser como uma pessoa real escreve no WhatsApp: informal, às vezes com erro de digitação, sem pontuação perfeita
- O ÚLTIMO passo de cada cenário deve ter o expectedStatus da saída esperada (ou "in_process" se o agente deve continuar pedindo info)
- Passos intermediários têm expectedStatus "in_process"
- expectedStatus deve ser exatamente uma dessas chaves: in_process, success, ${exits.map(e => e.key).join(', ')}
- Não inclua IDs nos objetos JSON`

  const text = await callAI(prompt, cfg)

  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('A IA não retornou cenários válidos. Tente novamente.')

  const raw = JSON.parse(match[0])
  const validExitKeys = new Set(['in_process', 'success', ...exits.map(e => e.key)])

  return raw
    .filter(s => s.name && Array.isArray(s.steps) && s.steps.length > 0)
    .map((s, i) => ({
      id: Date.now() + i,
      name: s.name,
      clientGoal: s.clientGoal || '',
      steps: s.steps
        .filter(step => step.clientMessage?.trim())
        .map(step => ({
          clientMessage: step.clientMessage.trim(),
          expectedStatus: validExitKeys.has(step.expectedStatus) ? step.expectedStatus : 'in_process',
        }))
    }))
    .filter(s => s.steps.length > 0)
}
