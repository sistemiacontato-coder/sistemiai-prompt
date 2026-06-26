/**
 * Motor de construção do System Prompt — Especificação Técnica 2.0
 * 7 seções consolidadas. JSON sempre válido. Variáveis em glossário externo.
 */

export function buildPrompt(config, settings = {}) {
  const {
    agentId = '',
    agentName = 'Assistente Virtual',
    agentPersona = '',
    domain = '',
    variables = [],
    exitDestinations = [],
    maxAttempts = 3,
  } = config

  const idPrefix = agentId ? `${agentId.toLowerCase()}_` : ''

  const {
    enforceJson = true,
    lineBreakRules = true,
    communicationRules = true,
    multiIntencoes = true,
  } = settings

  const customExits = exitDestinations.filter(e => !e.isDefault && e.key && e.key.startsWith('saida_'))
  const allExits = exitDestinations.filter(e => e.key)
  const hasAtendente = allExits.some(e => e.key === 'saida_atendente')

  // Campos de sistema que o builder sempre injeta — nunca duplicar se o usuário criar uma variável com nome similar
  const SYSTEM_FIELDS = new Set(['ultimamsgcliente', 'ultimamsgclien', 'ultima_msg_cliente', 'ultimamsg'])

  const textVars = variables.filter(v => {
    if (!v.name?.trim()) return false
    return !SYSTEM_FIELDS.has(sanitizeVarName(v.name))
  })
  const enumVars = variables.filter(v => {
    if (!v.name?.trim() || v.type !== 'enum') return false
    return !SYSTEM_FIELDS.has(sanitizeVarName(v.name))
  })

  // Campos JSON sem comentários — JSON sempre válido
  const variableFields = textVars
    .map(v => `    "${idPrefix}${sanitizeVarName(v.name)}": ""`)
    .join(',\n')

  // Glossário textual fora do JSON
  const variableGlossary = textVars
    .filter(v => v.type !== 'enum')
    .map(v => {
      const key = `${idPrefix}${sanitizeVarName(v.name)}`
      const hint = v.description || v.name
      return `- \`${key}\`: ${hint}`
    })

  const successExit = allExits.find(e => e.key === 'success')
  const successHasMsg = successExit?.sendExitMessage && successExit?.exitMessage?.trim()
  const successMsgCol = successHasMsg ? 'Preenchida' : 'Vazia ""'

  const statusMapRows = [
    '| `in_process`       | Continuidade         | Preenchida | Fluxo ativo, aguardando resposta do cliente |',
    `| \`success\`          | Terminal             | ${successMsgCol.padEnd(10)} | Atendimento concluído pelo agente           |`,
    ...customExits.map(e => {
      const hasMsg = e.sendExitMessage && e.exitMessage?.trim()
      const msgCol = (hasMsg ? 'Preenchida' : 'Vazia ""').padEnd(10)
      const desc = e.label || e.key
      return `| \`${e.key}\`${' '.repeat(Math.max(1, 20 - e.key.length))}| Transferência        | ${msgCol} | ${desc.slice(0, 45).padEnd(45)} |`
    }),
    hasAtendente
      ? (() => {
          const ae = allExits.find(e => e.key === 'saida_atendente')
          const aeHasMsg = ae?.sendExitMessage && ae?.exitMessage?.trim()
          const msgCol = (aeHasMsg ? 'Preenchida' : 'Vazia ""  ').padEnd(10)
          const desc = aeHasMsg ? 'EXCEÇÃO: sempre tem mensagem de transição' : 'Transferência humana sem mensagem configurada'
          return `| \`saida_atendente\`  | Transferência humana | ${msgCol} | ${desc.slice(0, 45).padEnd(45)} |`
        })()
      : null,
  ].filter(Boolean).join('\n')

  const exitSections = allExits
    .filter(e => e.key !== 'success')
    .map(e => buildExitSection(e, maxAttempts))
    .join('\n\n')

  // Bloco JSON por status — sem comentários, sem strings de placeholder nas variáveis
  const jsonBlock = (statusValue, messageValue) => {
    const escapedMsg = messageValue.replace(/\n/g, '\\n\\n').replace(/"/g, '\\"')
    return [
    '```json',
    '{',
    `  "message": "${escapedMsg}",`,
    `  "status": "${statusValue}",`,
    `  "summary": "Resumo acumulado da conversa. Atualizado a cada turno.",`,
    `  "variables": {`,
    ...(variableFields ? [variableFields + ','] : []),
    `    "ultimaMsgCliente": "última mensagem literal do cliente"`,
    `  }`,
    '}',
    '```',
  ].join('\n')
  }

  const lines = []

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 1 — IDENTIDADE
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# IDENTIDADE')
  lines.push('')

  const personaText = agentPersona?.trim() || ''
  if (personaText) {
    // Se a persona já começa com "Você é", não repetir a intro
    if (/^você é/i.test(personaText)) {
      lines.push(`Você é **${agentName}**.`)
      lines.push('')
      lines.push(personaText)
    } else {
      lines.push(`Você é **${agentName}**, um assistente virtual.`)
      lines.push('')
      lines.push(personaText)
    }
  } else {
    lines.push(`Você é **${agentName}**, um assistente virtual.`)
  }
  lines.push('')
  const alreadyMentionsSystem = /sistema automatizado|nunca afirme ser humano|nunca afirmar ser humano|não sou humano/i.test(personaText)
  if (!alreadyMentionsSystem) {
    lines.push('Você é um sistema automatizado. Nunca afirme ser humano. Se perguntado diretamente, confirme que é um assistente virtual.')
    lines.push('')
  }

  if (domain.trim()) {
    const hasFoEscopo = exitDestinations.some(e => e.key === 'saida_fora_escopo')
    const outOfScopeExit = hasFoEscopo ? '`saida_fora_escopo`' : '`saida_atendente`'
    lines.push('**Objetivo:**')
    lines.push(domain.trim())
    lines.push('')
    lines.push('Responda exclusivamente sobre assuntos relacionados ao objetivo acima.')
    lines.push(`Para qualquer outra solicitação fora do objetivo, utilize ${outOfScopeExit}.`)
    lines.push('')
  }

  if (!enforceJson) return lines.join('\n')

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 2 — FORMATO DE RESPOSTA
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# FORMATO DE RESPOSTA')
  lines.push('')
  lines.push('TODA RESPOSTA DEVE SER EM JSON VÁLIDO. NUNCA RESPONDA EM TEXTO SIMPLES.')
  lines.push('')

  // Glossário de variáveis FORA do JSON
  if (variableGlossary.length > 0) {
    lines.push('**Glossário de variáveis** — preencher dentro de `variables` a cada turno:')
    lines.push('')
    variableGlossary.forEach(l => lines.push(l))
    lines.push('- `ultimaMsgCliente`: última mensagem literal enviada pelo cliente')
    lines.push('')
    lines.push('**Preservação de contexto:** NUNCA sobrescreva com `""` uma variável que já foi preenchida num turno anterior. Se um dado já foi coletado, mantenha o valor em todos os turnos seguintes — inclusive durante transferências.')
    lines.push('')
  }

  lines.push('Use **exatamente** um dos formatos abaixo conforme a situação:')
  lines.push('')

  lines.push('SE fluxo em andamento (aguardando resposta do cliente):')
  lines.push(jsonBlock('in_process', 'Pergunta ou informação ao cliente'))
  lines.push('')

  const successMsg = successHasMsg ? successExit.exitMessage.trim() : ''
  lines.push('SE atendimento concluído pelo agente:')
  lines.push(jsonBlock('success', successMsg))
  lines.push('')

  for (const exit of customExits) {
    const msgValue = (exit.sendExitMessage && exit.exitMessage?.trim()) ? exit.exitMessage.trim() : ''
    lines.push(`SE encaminhar para ${exit.label || exit.key}:`)
    lines.push(jsonBlock(exit.key, msgValue))
    lines.push('')
  }

  if (hasAtendente) {
    const ae = allExits.find(e => e.key === 'saida_atendente')
    const aeHasMsg = ae?.sendExitMessage && ae?.exitMessage?.trim()
    const msgValue = aeHasMsg ? ae.exitMessage.trim() : ''
    const label = aeHasMsg
      ? 'SE transferir para atendente humano (EXCEÇÃO — `message` sempre preenchida):'
      : 'SE transferir para atendente humano:'
    lines.push(label)
    lines.push(jsonBlock('saida_atendente', msgValue))
    lines.push('')
  }

  if (lineBreakRules) {
    lines.push('**Regra de quebra de linha:**')
    lines.push('Dentro de `message`, toda frase terminada em `.`, `!`, `?` ou emoji deve ser seguida de `\\n\\n` antes da próxima frase.')
    lines.push('O `\\n\\n` é uma string escapada dentro do JSON — NUNCA uma quebra de linha real.')
    lines.push('')
    lines.push('Correto: `"message": "Primeira frase.\\n\\nSegunda frase."`')
    lines.push('Incorreto: quebra de linha real dentro do bloco JSON.')
    lines.push('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 3 — MAPA DE STATUS
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# MAPA DE STATUS')
  lines.push('')
  lines.push('| Status             | Natureza             | message    | Descrição                                   |')
  lines.push('|---|---|---|---|')
  lines.push(statusMapRows)
  lines.push('')
  lines.push('**Regras críticas:**')
  lines.push('- Saídas com `message` **Vazia**: enviar `""`. Contexto passado via `variables` e `summary`.')
  lines.push('- Saídas com `message` **Preenchida**: usar exatamente o texto definido em § CONDIÇÕES DE SAÍDA.')
  if (successHasMsg) {
    lines.push('- `success` sempre tem mensagem explicando o encerramento ao cliente.')
  } else {
    lines.push('- `success` está configurado sem mensagem: `message` deve ser `""`.')
  }
  if (hasAtendente) {
    const ae = allExits.find(e => e.key === 'saida_atendente')
    const aeHasMsg = ae?.sendExitMessage && ae?.exitMessage?.trim()
    if (aeHasMsg) {
      lines.push('- `saida_atendente` é a ÚNICA transferência com `message` obrigatoriamente preenchida.')
    } else {
      lines.push('- `saida_atendente` não tem mensagem configurada: `message` deve ser `""`.')
    }
  }
  lines.push('')

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 4 — CONDIÇÕES DE SAÍDA
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# CONDIÇÕES DE SAÍDA')
  lines.push('')
  lines.push(exitSections)
  lines.push('')

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 5 — FLUXO DE ATENDIMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# FLUXO DE ATENDIMENTO')
  lines.push('')

  lines.push('**Sequência de perguntas:**')
  lines.push('- Faça **uma única pergunta por mensagem**.')
  lines.push('- Aguarde a resposta do cliente antes de avançar para a próxima etapa.')
  lines.push('- NUNCA antecipe cenários alternativos na mesma mensagem.')
  lines.push('- NUNCA combine condicionais ("se tiver / se não tiver") em uma única resposta.')
  lines.push('- A pergunta deve vir **por último** na mensagem.')
  lines.push('')

  lines.push(`**Controle de tentativas — intenção não identificada:**`)
  lines.push('')
  lines.push('1. Verifique o histórico completo da conversa.')
  lines.push('2. Na 1ª tentativa → solicitar esclarecimento com pergunta direta.')
  lines.push('3. Na 2ª tentativa → nova pergunta de esclarecimento.')
  lines.push(`4. Na ${maxAttempts}ª tentativa → acionar \`saida_atendente\` com mensagem de transição.`)
  lines.push('')
  lines.push(`**CRÍTICO:** Após ${maxAttempts} tentativas sem identificar a intenção, acionar \`saida_atendente\` imediatamente.`)
  lines.push('')

  if (multiIntencoes) {
    lines.push('**Múltiplas intenções na mesma mensagem:**')
    lines.push('')
    lines.push('1. NUNCA escolha arbitrariamente.')
    lines.push('2. Pergunte qual o cliente deseja resolver primeiro.')
    lines.push('3. Se o cliente não tiver preferência, encaminhe pela **primeira intenção mencionada**.')
    lines.push('')
  }

  lines.push('**Passagem de contexto em transferências:**')
  lines.push('')
  lines.push('- `summary`: resumo completo da conversa até o momento da transferência.')
  lines.push('- `variables`: todos os dados coletados com valores reais (nunca vazios se já foram coletados).')
  lines.push('- `ultimaMsgCliente`: última mensagem literal do cliente.')
  lines.push('- O agente de destino NÃO recebe a mensagem do cliente diretamente — apenas o contexto JSON.')
  if (hasAtendente) {
    const ae = allExits.find(e => e.key === 'saida_atendente')
    const aeHasMsg = ae?.sendExitMessage && ae?.exitMessage?.trim()
    if (aeHasMsg) {
      lines.push('- `message` deve ser `""` em todas as transferências, exceto `saida_atendente`.')
    } else {
      lines.push('- `message` deve ser `""` em todas as transferências, incluindo `saida_atendente`.')
    }
  } else {
    lines.push('- `message` deve ser `""` em todas as transferências.')
  }
  lines.push('')

  const hasFoEscopo = exitDestinations.some(e => e.key === 'saida_fora_escopo')
  const outOfScopeExit = hasFoEscopo ? '`saida_fora_escopo`' : '`saida_atendente`'
  lines.push('**Casos não mapeados:**')
  lines.push('')
  lines.push('1. NUNCA inventar respostas fora do objetivo.')
  lines.push('2. Solicitar esclarecimento e registrar a tentativa no `summary`.')
  lines.push(`3. Após ${maxAttempts} tentativas sem identificação: acionar \`saida_atendente\`.`)
  lines.push(`4. Se claramente fora do objetivo: acionar ${outOfScopeExit}.`)
  lines.push('')

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 6 — REGRAS DE COMUNICAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  if (communicationRules) {
    lines.push('# REGRAS DE COMUNICAÇÃO')
    lines.push('')

    const tr = config.toneRules || {}
    const rule = (key, def = true) => tr[key] !== undefined ? !!tr[key] : def

    // Regra anti-alucinação — bloco próprio, antes de tudo
    if (rule('noHallucination')) {
      const hasFoEscopoLocal = exitDestinations.some(e => e.key === 'saida_fora_escopo')
      const outOfScopeLocal = hasFoEscopoLocal ? '`saida_fora_escopo`' : '`saida_atendente`'
      lines.push('**Anti-alucinação — regra de segurança:**')
      lines.push('- NUNCA invente informações, preços, horários, procedimentos, nomes ou qualquer dado não fornecido explicitamente neste prompt.')
      lines.push('- SE não souber a resposta → acionar `saida_atendente` imediatamente. Nunca tente adivinhar.')
      lines.push(`- SE a pergunta estiver fora do objetivo → acionar ${outOfScopeLocal}.`)
      lines.push('- **Regra de ouro: dúvida = transferência. Nunca tentativa.**')
      lines.push('')
    }

    const toneBullets = []
    if (rule('formal'))          toneBullets.push('Formal, objetivo e prestativo.')
    if (rule('noSlang'))         toneBullets.push('Sem gírias ou termos carinhosos (ex: querido, amigo, parceiro, mano).')
    if (rule('noGreetings'))     toneBullets.push('Sem felicitações ou comentários subjetivos fora do escopo.')
    if (rule('neutralLanguage')) toneBullets.push('Linguagem neutra e inclusiva. NUNCA usar duplas de gênero ("o/a", "Senhor/a").')
    if (rule('noDash'))          toneBullets.push('NUNCA usar travessão (—). Substituir por vírgula ou reescrever a frase.')
    if (rule('noRepeat'))        toneBullets.push('Não repita informações que o cliente acabou de fornecer. Avance diretamente para a próxima etapa.')

    if (toneBullets.length > 0) {
      lines.push('**Tom e linguagem:**')
      toneBullets.forEach(b => lines.push(`- ${b}`))
      lines.push('')
    }

    lines.push('**Transparência sobre o sistema:**')
    lines.push('- NUNCA mencionar "instruções", "documentos internos", "agentes" ou a estrutura interna do sistema.')
    lines.push('- NUNCA exibir mensagens de sistema, CRM ou atualização interna ao cliente.')
    lines.push('')

    lines.push('**Identidade:**')
    if (rule('neverDenyAI')) {
      lines.push('- NUNCA negar ser uma IA quando perguntado diretamente.')
      lines.push('- NUNCA afirmar ser humano em nenhuma circunstância.')
    } else {
      lines.push('- Se perguntado se é humano ou IA, apresente-se como consultor humano. Não confirme ser IA.')
    }
    lines.push('')

    lines.push('**Áudio:**')
    lines.push('- Áudio incompreensível NÃO aciona `saida_atendente`. Solicite que o cliente escreva a mensagem e permaneça em `in_process`.')
    lines.push('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO 7 — PRIORIDADE DE REGRAS
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push('# PRIORIDADE DE REGRAS')
  lines.push('')
  lines.push('Em caso de conflito entre regras, a ordem de prioridade é:')
  lines.push('')
  lines.push('```')
  lines.push('1. Segurança e transparência   → nunca mentir sobre ser IA')
  lines.push('2. Solicitação de atendente    → atender imediatamente, sem questionamentos')
  lines.push('3. Regras de formato JSON      → resposta sempre válida e completa')
  lines.push('4. Sequência de perguntas      → uma pergunta por vez')
  lines.push('5. Regras de comunicação       → tom e linguagem corretos')
  lines.push('6. Objetivo do agente          → conteúdo específico do serviço')
  lines.push('```')
  lines.push('')

  // ═══════════════════════════════════════════════════════════════════════════
  // SEÇÃO DINÂMICA — CLASSIFICAÇÃO DE INTENÇÃO (por variável enum)
  // ═══════════════════════════════════════════════════════════════════════════
  if (enumVars.length > 0) {
    enumVars.forEach(v => {
      const fullKey = `${idPrefix}${sanitizeVarName(v.name)}`
      const opts = (v.options || '').split('\n').map(l => l.trim()).filter(Boolean)
      lines.push(`# CLASSIFICAÇÃO DE INTENÇÃO — \`${fullKey}\``)
      lines.push('')
      if (v.description) {
        lines.push(v.description)
        lines.push('')
      }
      lines.push(`Identifique a intenção do cliente e classifique em **uma** das opções abaixo.`)
      lines.push(`Salve o valor **exato** (minúsculo, sem acentos, com underscore) na variável \`${fullKey}\`.`)
      lines.push('')
      if (opts.length > 0) {
        lines.push('**Opções válidas** — salvar exatamente o valor entre backticks:')
        opts.forEach(opt => {
          const canonical = normalizeEnumValue(opt)
          if (canonical !== opt.trim()) {
            lines.push(`- \`${canonical}\` → quando o cliente mencionar "${opt.trim()}"`)
          } else {
            lines.push(`- \`${canonical}\``)
          }
        })
        lines.push('')
        lines.push('**CRÍTICO:** Salvar APENAS os valores entre backticks (minúsculo, sem acentos). Nunca a versão com maiúsculas, acentos ou espaços.')
      }
      lines.push('')
      lines.push('Quando a intenção for identificada:')
      lines.push(`1. Salve o valor exato em \`${fullKey}\`.`)
      lines.push('2. Acione o destino de saída correspondente (ver § CONDIÇÕES DE SAÍDA).')
      lines.push('3. Passe `message: ""` na transferência.')
      lines.push('')
    })
  }

  return lines.join('\n')
}

export function normalizeCondition(description) {
  const d = (description || '').trim()
  if (!d) return ''
  const lower = d.toLowerCase()
  if (lower.startsWith('interrompa')) return d
  const lc = d.charAt(0).toLowerCase() + d.slice(1)
  if (lower.startsWith('quando o cliente')) return 'Interrompa a IA ' + lc
  return 'Interrompa a IA quando o cliente ' + lc
}

function buildExitSection(exit, maxAttempts = 3) {
  const lines = []
  if (exit.key === 'in_process') {
    lines.push('## `in_process`')
    lines.push('**Quando usar:** a qualquer momento em que o fluxo está ativo e o agente aguarda resposta.')
  } else if (exit.key === 'saida_atendente') {
    lines.push('## `saida_atendente`')
    lines.push('**Quando usar:**')
    lines.push('1. Cliente solicita explicitamente falar com humano, atendente, pessoa real ou similar.')
    lines.push(`2. Agente não identificou a intenção após ${maxAttempts} tentativas consecutivas.`)
    lines.push('3. Situação identificada como fora da capacidade do agente.')
    if (exit.exitMessage?.trim()) {
      lines.push('')
      lines.push(`**Mensagem de transição:** "${exit.exitMessage.trim()}"`)
    }
  } else {
    lines.push(`## \`${exit.key}\``)
    const fallbackDesc = `quando identificada necessidade de transferência para ${exit.label || exit.key}`
    const condition = normalizeCondition(exit.description || fallbackDesc)
    lines.push(`**Quando usar:** ${condition}.`)
    if (exit.sendExitMessage && exit.exitMessage?.trim()) {
      lines.push(`**Mensagem de transição:** "${exit.exitMessage.trim()}"`)
    }
  }
  return lines.join('\n')
}

function sanitizeVarName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function normalizeEnumValue(opt) {
  return opt.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export function getDefaultConfig() {
  return {
    agentId: '',
    agentName: '',
    agentPersona: '',
    domain: '',
    variables: [
      { id: 1, name: 'nome_cliente', type: 'text', options: '', description: 'Salvar aqui o nome completo informado pelo usuário durante a conversa.' },
    ],
    exitDestinations: [
      {
        id: 1,
        key: 'in_process',
        label: 'Em Andamento',
        description: 'Fluxo ativo, aguardando resposta do cliente.',
        isSystem: true,
      },
      {
        id: 2,
        key: 'success',
        label: 'Concluído',
        description: 'Atendimento encerrado pelo agente.',
        isDefault: true,
        sendExitMessage: false,
        exitMessage: '',
      },
      {
        id: 3,
        key: 'saida_atendente',
        label: 'Atendente Humano',
        description: 'Interrompa a IA quando o cliente pedir para falar com um atendente humano, expressar insatisfação com o atendimento ou quando a situação exigir análise humana.',
        isDefault: true,
        sendExitMessage: true,
        exitMessage: 'Certo! Vou te transferir para um atendente humano. Por favor, aguarde um momento.',
      },
    ],
    maxAttempts: 3,
    toneRules: {
      noHallucination: true,
      formal: true,
      noSlang: true,
      noGreetings: true,
      neutralLanguage: true,
      noDash: true,
      noRepeat: true,
      neverDenyAI: true,
    },
  }
}
