import { callAI, loadAIConfig } from './claude'

function buildReviewPrompt(config, instruction, generatedPrompt) {
  const existing = {
    agentName: config.agentName,
    agentPersona: config.agentPersona,
    domain: config.domain,
    variables: config.variables.map(v => ({
      name: v.name, type: v.type, description: v.description, options: v.options || '',
    })),
    exits: config.exitDestinations
      .filter(e => !e.isSystem)
      .map(e => ({ key: e.key, label: e.label, description: e.description || '' })),
  }

  const promptSection = generatedPrompt
    ? `\nPROMPT GERADO ATUAL (use para entender o contexto exato do problema):\n---\n${generatedPrompt.slice(0, 3000)}${generatedPrompt.length > 3000 ? '\n[...truncado]' : ''}\n---\n`
    : ''

  return `Você é um revisor de configurações de agentes de chatbot para WhatsApp.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify(existing, null, 2)}
${promptSection}
INSTRUÇÃO: "${instruction}"

Com base na instrução, identifique as mudanças necessárias na configuração.

Retorne APENAS o JSON abaixo, sem texto adicional, sem markdown, sem bloco de código:

{
  "new_agent_name": "Novo nome do agente (vazio se não precisar alterar)",
  "new_agent_persona": "Nova persona COMPLETA do agente (vazio se não precisar alterar)",
  "new_domain": "Texto COMPLETO e FINAL do domínio/objetivo do agente (vazio se não precisar alterar o domínio)",
  "add_variables": [
    { "name": "nome_max14chars", "type": "text", "description": "orientação para a IA", "options": "" }
  ],
  "remove_variables": [],
  "add_exits": [
    { "key": "saida_nome", "label": "Nome Legível", "description": "Interrompa a IA quando o cliente..." }
  ],
  "remove_exits": [],
  "update_exits": [
    { "key": "saida_existente", "description": "Condição corrigida iniciando com 'Interrompa a IA quando o cliente...'" }
  ],
  "summary": "Resumo das mudanças em português"
}

REGRAS OBRIGATÓRIAS:
- new_agent_name: use APENAS quando a instrução pedir para corrigir o nome do agente. Vazio "" se não precisar.
- new_agent_persona: use APENAS para alterar tom, comportamento ou apresentação do agente. ESCREVA O TEXTO COMPLETO. Vazio "" se não precisar.
- new_domain: use APENAS quando a instrução alterar o escopo ou objetivos do agente. Vazio "" se não precisar.
- CRÍTICO: esses três campos são INDEPENDENTES — use apenas o campo correto para cada tipo de mudança.
- update_exits: use para CORRIGIR a condição de uma saída JÁ EXISTENTE (não adicione nem remova — apenas atualize). Use a chave EXATA da saída. A description DEVE começar com "Interrompa a IA quando o cliente".
- add_exits: use APENAS para saídas NOVAS que não existem na configuração atual.
- add_exits[].key: sempre começa com "saida_", MÁXIMO 20 caracteres total
- Arrays vazios [] se não houver mudanças desse tipo
- remove_variables / remove_exits: use os nomes/chaves EXATOS da configuração atual
- Não remova saida_atendente a menos que explicitamente solicitado
- summary: explique as mudanças de forma concisa em português`
}

function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    const preview = cleaned.slice(0, 100).replace(/\n/g, ' ')
    throw new Error(`A IA não retornou JSON válido. Resposta: "${preview || '(vazia)'}" — Tente novamente.`)
  }
  return JSON.parse(match[0])
}

function normalizeResult(parsed) {
  return {
    new_agent_name:    typeof parsed.new_agent_name === 'string'    ? parsed.new_agent_name.trim()    : '',
    new_agent_persona: typeof parsed.new_agent_persona === 'string' ? parsed.new_agent_persona.trim() : '',
    new_domain:        typeof parsed.new_domain === 'string'        ? parsed.new_domain.trim()        : '',
    add_variables:     Array.isArray(parsed.add_variables)    ? parsed.add_variables    : [],
    remove_variables:  Array.isArray(parsed.remove_variables) ? parsed.remove_variables : [],
    add_exits:         Array.isArray(parsed.add_exits)        ? parsed.add_exits        : [],
    remove_exits:      Array.isArray(parsed.remove_exits)     ? parsed.remove_exits     : [],
    update_exits:      Array.isArray(parsed.update_exits)     ? parsed.update_exits     : [],
    summary:           parsed.summary || 'Mudanças propostas pela IA.',
  }
}

export async function reviewPromptChanges(instruction, config, aiConfig, generatedPrompt) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')

  const prompt = buildReviewPrompt(config, instruction, generatedPrompt)
  const text = await callAI(prompt, cfg)
  const parsed = extractJson(text)

  const result = normalizeResult(parsed)

  const totalChanges = result.add_variables.length + result.remove_variables.length +
                       result.add_exits.length + result.remove_exits.length +
                       result.update_exits.length +
                       (result.new_domain ? 1 : 0) +
                       (result.new_agent_name ? 1 : 0) +
                       (result.new_agent_persona ? 1 : 0)

  if (totalChanges === 0) throw new Error('SEM_MUDANCAS')

  return result
}

export async function refinePromptChanges(correction, pendingChanges, config, aiConfig) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')

  const existing = {
    agentName: config.agentName,
    agentPersona: config.agentPersona,
    domain: config.domain,
    variables: config.variables.map(v => ({ name: v.name, type: v.type, description: v.description, options: v.options || '' })),
    exits: config.exitDestinations.filter(e => !e.isSystem).map(e => ({ key: e.key, label: e.label, description: e.description || '' })),
  }

  const prompt = `Você é um revisor de configurações de agentes de chatbot para WhatsApp.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify(existing, null, 2)}

MUDANÇAS QUE VOCÊ PROPÔS ANTERIORMENTE:
${JSON.stringify(pendingChanges, null, 2)}

CORREÇÃO DO USUÁRIO: "${correction}"

O usuário viu sua proposta anterior e quer um ajuste. Revise as mudanças propostas aplicando a correção acima. Mantenha o que estava correto e corrija apenas o que o usuário apontou.

Retorne APENAS o JSON abaixo com as mudanças CORRIGIDAS, sem texto adicional, sem markdown:

{
  "new_agent_name": "Novo nome do agente (vazio se não precisar alterar)",
  "new_agent_persona": "Nova persona COMPLETA (vazio se não precisar alterar)",
  "new_domain": "Texto COMPLETO e FINAL do domínio (vazio se não precisar alterar)",
  "add_variables": [],
  "remove_variables": [],
  "add_exits": [],
  "remove_exits": [],
  "summary": "Resumo das mudanças corrigidas em português"
}

REGRAS OBRIGATÓRIAS:
- new_agent_name: vazio "" se não precisar alterar o nome
- new_agent_persona: escreva o texto COMPLETO da persona se precisar alterar. Vazio "" se não precisar.
- new_domain: escreva o texto COMPLETO do domínio se precisar alterar. Vazio "" se não precisar.
- add_variables[].name: minúsculo, underline, sem acento, MÁXIMO 14 caracteres
- add_exits[].key: sempre começa com "saida_", MÁXIMO 20 caracteres total
- add_exits[].description: SEMPRE começar com "Interrompa a IA quando o cliente"
- Arrays vazios [] se não houver mudanças desse tipo
- summary: explique as mudanças corrigidas de forma concisa em português`

  const text = await callAI(prompt, cfg)
  const parsed = extractJson(text)
  const result = normalizeResult(parsed)

  const totalChanges = result.add_variables.length + result.remove_variables.length +
                       result.add_exits.length + result.remove_exits.length +
                       (result.new_domain ? 1 : 0) +
                       (result.new_agent_name ? 1 : 0) +
                       (result.new_agent_persona ? 1 : 0)

  if (totalChanges === 0) throw new Error('A IA não identificou mudanças na correção. Tente ser mais específico.')

  return result
}
