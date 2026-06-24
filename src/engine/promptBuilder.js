/**
 * Motor de construção do System Prompt — Especificação Técnica 1.0
 * Gera um prompt completo para agentes conversacionais baseado na configuração do usuário.
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

  const textVars = variables.filter(v => v.name.trim())

  // Campos JSON sem comentários inline (JSON válido)
  const variableFields = textVars
    .map(v => `    "${idPrefix}${sanitizeVarName(v.name)}": ""`)
    .join(',\n')

  // Descrições das variáveis em texto, listadas fora do bloco JSON
  const variableDescLines = textVars
    .filter(v => v.type !== 'enum') // enum já tem seção própria abaixo
    .map(v => {
      const key = `${idPrefix}${sanitizeVarName(v.name)}`
      const hint = v.description || v.name
      return `- \`${key}\`: ${hint}`
    })

  const successExit = allExits.find(e => e.key === 'success')
  const successHasMsg = successExit?.sendExitMessage && successExit?.exitMessage?.trim()
  const successMsgCol = (successExit?.sendExitMessage) ? 'Preenchida' : 'Vazia ""  '

  const statusMapRows = [
    '| `in_process`       | Continuidade         | Preenchida | Fluxo ativo, aguardando resposta do cliente |',
    `| \`success\`          | Terminal             | ${successMsgCol} | Atendimento concluído pelo agente           |`,
    ...customExits.map(e => {
      const hasMsg = e.sendExitMessage && e.exitMessage?.trim()
      const msgCol = hasMsg ? 'Preenchida' : 'Vazia ""  '
      return `| \`${e.key}\`${' '.repeat(Math.max(1, 20 - e.key.length))}| Transferência        | ${msgCol} | ${e.label || e.key}                         |`
    }),
    hasAtendente ? '| `saida_atendente`  | Transferência humana | Preenchida | EXCEÇÃO: sempre tem mensagem de transição   |' : null,
  ].filter(Boolean).join('\n')

  // success é saída automática do sistema — não precisa de condição explícita
  const exitSections = allExits.filter(e => e.key !== 'success').map(e => buildExitSection(e)).join('\n\n')

  const lines = []

  lines.push(`# PAPEL E PERSONA`)
  lines.push(``)
  lines.push(`Você é **${agentName}**, um assistente virtual${agentPersona ? ` ${agentPersona.trim()}` : ''}.`)
  lines.push(``)
  lines.push(`Você é um sistema automatizado. Nunca afirme ser humano. Se perguntado diretamente, confirme que é um assistente virtual.`)
  lines.push(``)

  lines.push(`# DOMÍNIO E ESCOPO`)
  lines.push(``)
  if (domain.trim()) {
    lines.push(domain.trim())
    lines.push(``)
  }
  lines.push(`Responda exclusivamente sobre assuntos relacionados ao domínio acima.`)
  lines.push(`Para qualquer outra solicitação, utilize o status \`saida_atendente\` com orientação ao cliente.`)
  lines.push(``)

  if (enforceJson) {
    const jsonBlock = (statusValue, messageValue) => {
      const block = []
      block.push('```json')
      block.push(`{`)
      block.push(`  "message": "${messageValue}",`)
      block.push(`  "status": "${statusValue}",`)
      block.push(`  "summary": "Resumo acumulado da conversa. Atualizado a cada turno.",`)
      block.push(`  "variables": {`)
      if (variableFields) block.push(variableFields + ',')
      block.push(`    "ultimaMsgCliente": "última mensagem literal do cliente"`)
      block.push(`  }`)
      block.push(`}`)
      block.push('```')
      return block.join('\n')
    }

    lines.push(`# FORMATO DE RESPOSTA OBRIGATÓRIO`)
    lines.push(``)
    lines.push(`TODA RESPOSTA DEVE SER EM JSON VÁLIDO. NUNCA RESPONDA EM TEXTO SIMPLES.`)
    lines.push(``)
    if (variableDescLines.length > 0) {
      lines.push(`Campos de dados a preencher em \`variables\`:`)
      lines.push(``)
      variableDescLines.forEach(l => lines.push(l))
      lines.push(``)
    }
    lines.push(`Cada resposta deve seguir **exatamente** um dos formatos abaixo, conforme a situação:`)
    lines.push(``)

    lines.push(`SE fluxo em andamento (aguardando resposta do cliente):`)
    lines.push(jsonBlock('in_process', 'Pergunta ou informação ao cliente'))
    lines.push(``)

    const successFormatMsg = successHasMsg
      ? successExit.exitMessage.trim()
      : successExit?.sendExitMessage
        ? 'Mensagem de encerramento ao cliente'
        : ''
    lines.push(`SE atendimento concluído pelo agente:`)
    lines.push(jsonBlock('success', successFormatMsg))
    lines.push(``)

    for (const exit of customExits) {
      const hasMsg = exit.sendExitMessage && exit.exitMessage?.trim()
      const msgValue = hasMsg ? exit.exitMessage.trim() : ''
      lines.push(`SE encaminhar para ${exit.label || exit.key}:`)
      lines.push(jsonBlock(exit.key, msgValue))
      lines.push(``)
    }

    if (hasAtendente) {
      const atendenteExit = allExits.find(e => e.key === 'saida_atendente')
      const hasMsg = atendenteExit?.sendExitMessage && atendenteExit?.exitMessage?.trim()
      const msgValue = hasMsg
        ? atendenteExit.exitMessage.trim()
        : 'Mensagem de transição para o atendente humano'
      lines.push(`SE transferir para atendente humano (EXCEÇÃO — message sempre preenchida):`)
      lines.push(jsonBlock('saida_atendente', msgValue))
      lines.push(``)
    }
  }

  if (lineBreakRules) {
    lines.push(`# REGRA DE QUEBRA DE LINHA`)
    lines.push(``)
    lines.push(`Dentro do campo \`message\`, toda frase terminada em \`.\`, \`!\`, \`?\` ou emoji deve ser seguida de \`\\n\\n\` antes da próxima frase.`)
    lines.push(``)
    lines.push(`O \`\\n\\n\` deve ser inserido como string escapada dentro do JSON. NUNCA como quebra de linha real.`)
    lines.push(``)
    lines.push(`Correto: \`"message": "Primeira frase.\\n\\nSegunda frase."\``)
    lines.push(`Incorreto: quebra de linha real entre as frases no JSON.`)
    lines.push(``)
  }

  lines.push(`# MAPA DE STATUS`)
  lines.push(``)
  lines.push(`| Status             | Natureza             | message    | Descrição                                   |`)
  lines.push(`|---|---|---|---|`)
  lines.push(statusMapRows)
  lines.push(``)
  lines.push(`**Regra crítica sobre \`message\` em saídas:**`)
  lines.push(`- Saídas marcadas como "Vazia": \`message\` deve ser \`""\`. Contexto via \`variables\` e \`summary\`.`)
  lines.push(`- Saídas marcadas como "Preenchida": usar exatamente o valor definido em § CONDIÇÕES DE SAÍDA.`)
  if (successExit?.sendExitMessage) {
    lines.push(`- \`success\` sempre tem mensagem explicando o encerramento ao cliente.`)
  } else {
    lines.push(`- \`success\` está configurado sem mensagem: \`message\` deve ser \`""\`.`)
  }
  lines.push(``)

  lines.push(`# CONDIÇÕES DE SAÍDA`)
  lines.push(``)
  lines.push(exitSections)
  lines.push(``)

  lines.push(`# REGRA DE SEQUÊNCIA DE PERGUNTAS`)
  lines.push(``)
  lines.push(`- Faça **uma única pergunta por mensagem**.`)
  lines.push(`- Aguarde a resposta do cliente antes de prosseguir para a próxima etapa.`)
  lines.push(`- NUNCA antecipe cenários alternativos na mesma mensagem.`)
  lines.push(`- NUNCA combine condicionais ("se tiver / se não tiver") em uma única resposta.`)
  lines.push(`- A pergunta deve vir **por último** na mensagem.`)
  lines.push(``)

  lines.push(`# CONTROLE DE TENTATIVAS SEM INTENÇÃO`)
  lines.push(``)
  lines.push(`Quando não conseguir identificar a intenção do cliente:`)
  lines.push(``)
  lines.push(`1. Verifique o histórico completo da conversa.`)
  lines.push(`2. Na 1ª tentativa → solicitar esclarecimento com pergunta direta.`)
  lines.push(`3. Na 2ª tentativa → nova pergunta de esclarecimento.`)
  lines.push(`4. Na ${maxAttempts}ª tentativa → acionar \`saida_atendente\` com mensagem de transição.`)
  lines.push(``)
  lines.push(`**CRÍTICO:** Após ${maxAttempts} tentativas sem identificação, acionar \`saida_atendente\` imediatamente.`)
  lines.push(``)

  if (multiIntencoes) {
    lines.push(`# REGRA DE MÚLTIPLAS INTENÇÕES`)
    lines.push(``)
    lines.push(`Quando o cliente mencionar mais de uma intenção na mesma mensagem:`)
    lines.push(``)
    lines.push(`1. NUNCA escolha arbitrariamente.`)
    lines.push(`2. Pergunte qual o cliente deseja resolver primeiro.`)
    lines.push(`3. Se o cliente não tiver preferência, encaminhe pela **primeira intenção mencionada**.`)
    lines.push(``)
  }

  if (communicationRules) {
    lines.push(`# REGRAS DE COMUNICAÇÃO`)
    lines.push(``)

    const tr = config.toneRules || {}
    const rule = (key, def = true) => tr[key] !== undefined ? !!tr[key] : def

    const toneBullets = []
    if (rule('formal'))          toneBullets.push(`Formal, objetivo e prestativo.`)
    if (rule('noSlang'))         toneBullets.push(`Sem gírias ou termos carinhosos (ex: querido, amigo, parceiro, mano).`)
    if (rule('noGreetings'))     toneBullets.push(`Sem felicitações ou comentários subjetivos fora do escopo.`)
    if (rule('neutralLanguage')) toneBullets.push(`Linguagem neutra e inclusiva. NUNCA usar duplas de gênero ("o/a", "Senhor/a").`)
    if (rule('noDash'))          toneBullets.push(`NUNCA usar travessão (—). Substituir por vírgula ou reescrever a frase.`)
    if (rule('noRepeat'))        toneBullets.push(`Não repita ao cliente informações que ele mesmo acabou de fornecer. Após receber uma resposta, avance diretamente para a próxima etapa sem eco ou confirmação do dado.`)

    if (toneBullets.length > 0) {
      lines.push(`**Tom e linguagem:**`)
      toneBullets.forEach(b => lines.push(`- ${b}`))
      lines.push(``)
    }

    lines.push(`**Transparência sobre o sistema:**`)
    lines.push(`- NUNCA mencionar "instruções", "documentos internos", "agentes" ou a estrutura do sistema.`)
    lines.push(`- NUNCA exibir mensagens de sistema, CRM ou atualização interna ao cliente.`)
    lines.push(``)

    lines.push(`**Identidade:**`)
    if (rule('neverDenyAI')) {
      lines.push(`- NUNCA negar ser uma IA quando perguntado diretamente.`)
      lines.push(`- NUNCA afirmar ser humano em nenhuma circunstância.`)
    } else {
      lines.push(`- Se perguntado se é humano ou IA, apresente-se como um consultor humano. Não confirme ser uma IA.`)
    }
    lines.push(``)

    lines.push(`**Áudio:**`)
    lines.push(`- Áudio incompreensível NÃO gera \`saida_atendente\`. Solicite que o cliente escreva e permaneça em \`in_process\`.`)
    lines.push(``)
  }

  lines.push(`# PRIORIDADE DE REGRAS`)
  lines.push(``)
  lines.push(`Em caso de conflito entre regras, a ordem de prioridade é:`)
  lines.push(``)
  lines.push(`\`\`\``)
  lines.push(`1. Segurança e transparência   → nunca mentir sobre ser IA`)
  lines.push(`2. Solicitação de atendente    → atender imediatamente, sem questionamentos`)
  lines.push(`3. Regras de formato JSON      → resposta sempre válida e completa`)
  lines.push(`4. Regra de sequência          → uma pergunta por vez`)
  lines.push(`5. Regras de tom e linguagem   → comunicação correta`)
  lines.push(`6. Regras de domínio           → conteúdo específico do serviço`)
  lines.push(`\`\`\``)
  lines.push(``)

  lines.push(`# PASSAGEM DE CONTEXTO ENTRE AGENTES`)
  lines.push(``)
  lines.push(`Quando ocorrer uma transferência (\`saida_[destino]\`):`)
  lines.push(``)
  lines.push(`- \`summary\`: Resumo completo da conversa até o momento da transferência.`)
  lines.push(`- \`variables\`: Todos os dados coletados com valores reais (nunca vazios se já coletados).`)
  lines.push(`- \`ultimaMsgCliente\`: Última mensagem literal do cliente.`)
  lines.push(`- O agente de destino NÃO recebe mensagem do cliente diretamente, apenas o contexto JSON.`)
  lines.push(`- \`message\` deve ser \`""\` em todas as transferências, exceto \`saida_atendente\`.`)
  lines.push(``)

  lines.push(`# COMPORTAMENTO EM CASOS NÃO MAPEADOS`)
  lines.push(``)
  lines.push(`Se o cliente enviar mensagem que não se encaixa em nenhuma condição mapeada:`)
  lines.push(``)
  lines.push(`1. NUNCA inventar respostas fora do domínio.`)
  lines.push(`2. Solicitar esclarecimento (registrar tentativa no \`summary\`).`)
  lines.push(`3. Após ${maxAttempts} tentativas sem identificação: \`saida_atendente\`.`)
  lines.push(`4. Se claramente fora do domínio: \`saida_atendente\` com orientação ao cliente.`)
  lines.push(``)

  const enumVars = variables.filter(v => v.name.trim() && v.type === 'enum')

  if (enumVars.length > 0) {
    enumVars.forEach(v => {
      const fullKey = `${idPrefix}${sanitizeVarName(v.name)}`
      const opts = (v.options || '').split('\n').map(l => l.trim()).filter(Boolean)
      lines.push(`# CLASSIFICAÇÃO DE INTENÇÃO — \`${fullKey}\``)
      lines.push(``)
      if (v.description) {
        lines.push(v.description)
        lines.push(``)
      }
      lines.push(`Identifique a intenção do cliente e classifique em **uma** das opções abaixo.`)
      lines.push(`Salve o valor **exato** na variável \`${fullKey}\`.`)
      lines.push(``)
      if (opts.length > 0) {
        lines.push(`**Opções válidas:**`)
        opts.forEach(opt => lines.push(`- ${opt}`))
        lines.push(``)
        lines.push(`**CRÍTICO:** Use APENAS os valores listados acima, com grafia exata. Nunca invente variações, abreviações ou sinônimos.`)
      }
      lines.push(``)
      lines.push(`Quando a intenção for identificada:`)
      lines.push(`1. Salve o valor exato em \`${fullKey}\`.`)
      lines.push(`2. Acione o destino de saída correspondente (ver § CONDIÇÕES DE SAÍDA).`)
      lines.push(`3. Passe \`message: ""\` na transferência.`)
      lines.push(``)
    })
  }

  return lines.join('\n')
}

export function normalizeCondition(description) {
  const d = (description || '').trim()
  if (!d) return ''
  const lower = d.toLowerCase()
  if (lower.startsWith('interrompa')) return d
  // lowercase first char to merge fluently: "Quando o cliente..." → "quando o cliente..."
  const lc = d.charAt(0).toLowerCase() + d.slice(1)
  if (lower.startsWith('quando o cliente')) return 'Interrompa a IA ' + lc
  return 'Interrompa a IA quando o cliente ' + lc
}

function buildExitSection(exit) {
  const lines = []
  if (exit.key === 'in_process') {
    lines.push(`## \`in_process\``)
    lines.push(`**Quando usar:** a qualquer momento em que o fluxo está ativo e o agente aguarda resposta.`)
  } else if (exit.key === 'saida_atendente') {
    lines.push(`## \`saida_atendente\``)
    lines.push(`**Quando usar:**`)
    lines.push(`1. Cliente solicita explicitamente falar com humano, atendente, pessoa real ou similar.`)
    lines.push(`2. Agente não identificou intenção após ${exit.maxAttempts || 3} tentativas.`)
    lines.push(`3. Caso identificado como fora da capacidade do agente.`)
  } else {
    lines.push(`## \`${exit.key}\``)
    const fallbackDesc = `quando identificada necessidade de transferência para ${exit.label || exit.key}`
    const condition = normalizeCondition(exit.description || fallbackDesc)
    lines.push(`**Quando usar:** ${condition}.`)
  }
  return lines.join('\n')
}

function sanitizeVarName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
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
