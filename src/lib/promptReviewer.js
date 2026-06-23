import { callAI, loadAIConfig } from './claude'

function buildReviewPrompt(config, instruction) {
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

  return `Você é um revisor de configurações de agentes de chatbot para WhatsApp.

CONFIGURAÇÃO ATUAL DO AGENTE:
${JSON.stringify(existing, null, 2)}

INSTRUÇÃO DO USUÁRIO: "${instruction}"

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
  "summary": "Resumo das mudanças em português"
}

REGRAS OBRIGATÓRIAS:
- new_agent_name: use APENAS quando a instrução pedir para corrigir o nome do agente (campo agentName). Vazio "" se não precisar.
- new_agent_persona: use APENAS quando a instrução alterar o campo persona do agente — texto de apresentação, comportamento, tom, como o agente se descreve. ESCREVA O TEXTO COMPLETO da persona com as correções aplicadas. Vazio "" se não precisar.
- new_domain: use APENAS quando a instrução alterar o que o agente faz, o escopo de atendimento ou os objetivos do agente. Vazio "" se não precisar.
- CRÍTICO: esses três campos são INDEPENDENTES. Corrigir o nome na persona → use new_agent_persona (não new_domain). Corrigir o nome do agente → use new_agent_name (não new_domain). Apenas altere new_domain quando a instrução tratar explicitamente do domínio/objetivo do agente.
- EXEMPLO: se a instrução for "corrija o nome João para Marcos na persona", retorne new_agent_persona com o texto completo corrigido, e new_agent_name/new_domain vazios.
- add_variables[].name: minúsculo, underline, sem acento, MÁXIMO 14 caracteres
- add_exits[].key: sempre começa com "saida_", MÁXIMO 20 caracteres total
- add_exits[].description: SEMPRE começar com "Interrompa a IA quando o cliente"
- Arrays vazios [] se não houver mudanças desse tipo
- remove_variables: use os nomes EXATOS das variáveis da configuração atual
- remove_exits: use as chaves EXATAS das saídas da configuração atual
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
    summary:           parsed.summary || 'Mudanças propostas pela IA.',
  }
}

export async function reviewPromptChanges(instruction, config, aiConfig) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')

  const prompt = buildReviewPrompt(config, instruction)
  const text = await callAI(prompt, cfg)
  const parsed = extractJson(text)

  const result = normalizeResult(parsed)

  const totalChanges = result.add_variables.length + result.remove_variables.length +
                       result.add_exits.length + result.remove_exits.length +
                       (result.new_domain ? 1 : 0) +
                       (result.new_agent_name ? 1 : 0) +
                       (result.new_agent_persona ? 1 : 0)

  if (totalChanges === 0) throw new Error('A IA não identificou mudanças necessárias para esta instrução.')

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
