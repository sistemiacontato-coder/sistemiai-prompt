import { callAI, loadAIConfig } from './claude'

function sanitize(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function buildAuditPrompt(generatedPrompt, config) {
  const idPrefix = config.agentId ? `${config.agentId.toLowerCase()}_` : ''

  const nonSystemExits = config.exitDestinations.filter(e => !e.isSystem)

  // Variáveis com o prefixo exato como aparecem no prompt gerado
  const variableKeys = config.variables
    .filter(v => v.name?.trim())
    .map(v => `${idPrefix}${sanitize(v.name)}`)

  // Variáveis de sistema sempre presentes no BotConversa (nunca são erros)
  const systemVars = ['summary', 'ultimaMsgCliente']

  const hasAtendente = nonSystemExits.some(e => e.key === 'saida_atendente')

  // Descreve o comportamento de mensagem de cada saída para o auditor
  const exitDetails = nonSystemExits.map(e => {
    const msgBehavior = e.sendExitMessage && e.exitMessage?.trim()
      ? `message = "${e.exitMessage.trim()}" (CORRETO — mensagem configurada)`
      : e.sendExitMessage
        ? `message = texto livre de encerramento (CORRETO — mensagem habilitada sem texto fixo)`
        : `message = "" string vazia (CORRETO — mensagem DESABILITADA intencionalmente por configuração)`
    return `  • ${e.key}: ${msgBehavior}`
  }).join('\n')

  return `Você é um auditor especialista em prompts para chatbots WhatsApp no formato BotConversa.

Analise o prompt abaixo e identifique APENAS problemas reais. NÃO invente problemas onde não existem.

CONFIGURAÇÃO ATUAL DO AGENTE:
- Nome: ${config.agentName || '(não definido)'}
- Variáveis declaradas (prefixo exato): ${variableKeys.join(', ') || '(nenhuma)'}
- Variáveis de sistema (sempre presentes, NUNCA são erro): ${systemVars.join(', ')}

CONFIGURAÇÃO DE MENSAGEM POR SAÍDA (esta é a configuração intencional — NÃO gere erro para estes casos):
${exitDetails || '  (nenhuma saída configurada)'}

REGRAS DO FORMATO BOTCONVERSA — NÃO gere erros para os itens abaixo:
1. Cada saída com "message = string vazia" foi CONFIGURADA ASSIM intencionalmente. A condição de acionamento (quando acionar) e a mensagem de saída (o que enviar) são INDEPENDENTES. Uma saída pode ter condição clara E mensagem vazia — isso é CORRETO e intencional no BotConversa. NUNCA critique mensagem vazia como "inconsistência", "falta de mensagem" ou "saída incompleta".
2. A saída \`saida_fora_escopo\` é por definição um catch-all aberto: ela cobre QUALQUER coisa que não esteja no domínio do agente — sem precisar enumerar exemplos. Isso é o design correto e intencional. NÃO critique a condição de saida_fora_escopo como "vaga", "ambígua" ou "mal definida". NÃO crie issue sobre "falta de definição do que é fora do escopo". A ausência de listagem explícita É o comportamento correto — tudo não mencionado é fora do escopo por padrão.
3. "Serviços não listados", "casos não mapeados", "perguntas não cobertas" e similares são automaticamente fora do escopo e, portanto, já tratados por \`saida_fora_escopo\` (ou \`saida_atendente\`). NÃO gere issue de "falta de tratamento" para cenários não listados — eles são cobertos pelo catch-all por design.
4. ${hasAtendente
    ? 'A saída `saida_atendente` JÁ cobre: pedidos de atendente humano, insatisfação, intenção não identificada após tentativas. NÃO gere erro sobre falta de tratamento fora do escopo quando esta saída está presente.'
    : 'Não há saida_atendente. Questione apenas se não há outra saída que cubra casos não mapeados.'
  }
5. As variáveis listadas em "Variáveis declaradas" estão corretamente configuradas no BotConversa. Nunca gere "variável não declarada" para elas.
6. As variáveis de sistema (\`summary\`, \`ultimaMsgCliente\`) são automáticas no BotConversa.
7. A saída \`success\` é genérica por design — cobre qualquer encerramento do fluxo pelo agente. Não gere erro sobre ambiguidade no critério de success.

PROMPT GERADO:
---
${generatedPrompt}
---

Verifique ESPECIFICAMENTE:

1. CONSISTÊNCIA: As chaves de status no MAPA DE STATUS correspondem exatamente às chaves em CONDIÇÕES DE SAÍDA? Alguma chave aparece em um lugar mas não no outro?

2. CONTRADIÇÕES: Alguma instrução contradiz outra no mesmo prompt? Tom, regras de atendimento, condições de saída conflitantes?

3. SOBREPOSIÇÃO: Duas saídas com condições de acionamento que se sobrepõem, gerando ambiguidade real de qual acionar?

4. COMPLETUDE DO DOMÍNIO: Existe algum cenário operacional CRÍTICO e ÓBVIO para o negócio descrito que não tem nem saída específica nem catch-all (saida_fora_escopo / saida_atendente)? Lembre-se: qualquer coisa não listada já é tratada pelo catch-all — só aponte incompletude se o prompt CONTRADIZ ou IGNORA explicitamente um cenário que o próprio objetivo define como essencial.

Retorne APENAS o JSON abaixo, sem texto adicional:

{
  "issues": [
    {
      "severity": "critical",
      "category": "saídas",
      "title": "Título curto do problema",
      "description": "Explicação clara do problema encontrado",
      "fix": "Instrução exata para corrigir via revisor"
    }
  ],
  "overallScore": 85,
  "summary": "Resumo geral em uma frase"
}

REGRAS:
- severity: "critical" (quebra o bot), "warning" (comportamento inesperado), "suggestion" (melhoria)
- Só inclua issues reais — não invente problemas que não existem
- fix: instrução para o revisor, ex: "Adicionar condição de saída para clientes que pedem reembolso"
- overallScore: 0-100, onde 100 é perfeito. Reduza apenas por problemas reais encontrados.
- Se não encontrar nenhum problema real, retorne "issues": [] e overallScore alto (90+)
- Máximo 6 issues`
}

function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()

  const candidates = cleaned.match(/\{[\s\S]*\}/)
  if (!candidates) {
    const preview = cleaned.slice(0, 120).replace(/\n/g, ' ')
    throw new Error(`A IA não retornou JSON válido. Resposta recebida: "${preview || '(vazia)'}" — Tente reauditar.`)
  }

  try {
    return JSON.parse(candidates[0])
  } catch {
    // Tenta reparar JSON truncado: fecha arrays e objetos abertos
    let partial = candidates[0]
    const openBraces  = (partial.match(/\{/g) || []).length - (partial.match(/\}/g) || []).length
    const openBrackets = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length
    if (openBrackets > 0) partial += ']'.repeat(openBrackets)
    if (openBraces > 0)   partial += '}'.repeat(openBraces)
    try {
      return JSON.parse(partial)
    } catch {
      throw new Error('A resposta da IA foi cortada ou mal formatada. Tente reauditar com um modelo de maior contexto.')
    }
  }
}

export async function auditPrompt(generatedPrompt, config, aiConfig) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Configurações.')
  if (!generatedPrompt?.trim()) throw new Error('Gere o prompt antes de auditar.')

  const prompt = buildAuditPrompt(generatedPrompt, config)
  // Auditoria pode precisar de mais tokens — passa maxTokens no config
  const text = await callAI(prompt, { ...cfg, maxTokens: 4096 })
  const parsed = extractJson(text)

  return {
    issues:       Array.isArray(parsed.issues) ? parsed.issues : [],
    overallScore: typeof parsed.overallScore === 'number' ? Math.max(0, Math.min(100, parsed.overallScore)) : null,
    summary:      parsed.summary || '',
  }
}
