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
  "domain_add": ["Nova regra a acrescentar ao domínio — uma frase curta e direta"],
  "domain_remove": ["Trecho EXATO do domínio atual a remover ou substituir"],
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
- domain_add: array com frases NOVAS a acrescentar ao domínio. Cada item é UMA frase curta. Use [] se não precisar adicionar.
- domain_remove: array com trechos EXATOS do domínio atual a remover. Copie o texto sem alterar. Use [] se não precisar remover.
- NUNCA reescreva o domínio inteiro. Altere APENAS o trecho relevante com domain_add e domain_remove.
- CRÍTICO: não toque em partes do domínio que a instrução não menciona.
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
    domain_add:        Array.isArray(parsed.domain_add)    ? parsed.domain_add.filter(Boolean)    : [],
    domain_remove:     Array.isArray(parsed.domain_remove) ? parsed.domain_remove.filter(Boolean) : [],
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
                       result.domain_add.length + result.domain_remove.length +
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
  "domain_add": ["Nova regra a acrescentar ao domínio — uma frase curta"],
  "domain_remove": ["Trecho EXATO do domínio atual a remover"],
  "add_variables": [],
  "remove_variables": [],
  "add_exits": [],
  "remove_exits": [],
  "update_exits": [],
  "summary": "Resumo das mudanças corrigidas em português"
}

REGRAS OBRIGATÓRIAS:
- new_agent_name: vazio "" se não precisar alterar o nome
- new_agent_persona: escreva o texto COMPLETO da persona se precisar alterar. Vazio "" se não precisar.
- NUNCA reescreva o domínio inteiro. Use domain_add e domain_remove para mudanças cirúrgicas.
- domain_add: array com frases novas a acrescentar. Use [] se não precisar adicionar.
- domain_remove: array com trechos EXATOS a remover. Copie sem alterar. Use [] se não precisar remover.
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
                       result.update_exits.length +
                       result.domain_add.length + result.domain_remove.length +
                       (result.new_agent_name ? 1 : 0) +
                       (result.new_agent_persona ? 1 : 0)

  if (totalChanges === 0) throw new Error('A IA não identificou mudanças na correção. Tente ser mais específico.')

  return result
}
