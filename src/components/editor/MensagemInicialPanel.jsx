import { useState } from 'react'
import { callAI } from '../../lib/claude'

const BC_VARS = [
  { tag: '{primeiro-nome}', label: 'Primeiro nome' },
  { tag: '{nome-completo}', label: 'Nome completo' },
  { tag: '{email}',         label: 'E-mail' },
  { tag: '{telefone}',      label: 'Telefone' },
  { tag: '{Resumo}',        label: 'Resumo da conversa' },
]

function autoInstrucoesFromVars(variables) {
  const commonMap = {
    nome_cliente: '{primeiro-nome}',
    nome: '{primeiro-nome}',
    email: '{email}',
    telefone: '{telefone}',
    plano: '{plano}',
    data_pagamento: '{data-pagamento}',
  }
  return variables
    .filter(v => v.name?.trim())
    .map(v => {
      const key = v.name.toLowerCase()
      const bcVar = commonMap[key] || `{${key.replace(/_/g, '-')}}`
      const label = v.description?.replace(/^salvar aqui\s*/i, '') || v.name.replace(/_/g, ' ')
      return `${label}: ${bcVar}`
    })
    .join('\n')
}

async function gerarPreInstrucao(config, instrucoesIndividuais, aiConfig) {
  const temInstrucoes = instrucoesIndividuais.trim().length > 0
  const prompt = `Você é especialista em BotConversa. Gere a "Mensagem Inicial para a I.A." para o agente abaixo.
Esta é uma pré-instrução interna (invisível ao usuário) enviada antes do prompt principal começar.

AGENTE: ${config.agentName || 'Assistente Virtual'}
OBJETIVO: ${config.domain || '(não informado)'}
${temInstrucoes ? `\nINSTRUÇÕES INDIVIDUAIS (dados do CRM já disponíveis):\n${instrucoesIndividuais}` : ''}

Estrutura obrigatória:
1. Se for a PRIMEIRA interação ({Resumo} vazio): o que o agente deve fazer — saudação${temInstrucoes ? ', use os dados disponíveis para personalizar' : ', pergunte o nome'}, status in_process
2. Se NÃO for a primeira: reconhecer o contexto de {Resumo} e continuar naturalmente
3. Instrução para focar 100% no objetivo

Retorne APENAS o texto da pré-instrução, sem explicações, sem markdown. Máximo 6 frases.`

  return callAI(prompt, aiConfig)
}

function FieldSection({ icon, title, subtitle, accentColor = 'primary', children }) {
  return (
    <div className="rounded-lg border border-outline-variant overflow-hidden"
         style={{ background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-outline-variant/50"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <span className={`material-symbols-outlined text-${accentColor}`} style={{ fontSize: 15 }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono font-semibold text-on-surface leading-none">{title}</p>
          {subtitle && <p className="text-[9px] font-mono text-on-surface-variant/45 mt-0.5 leading-tight">{subtitle}</p>}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export default function MensagemInicialPanel({ config, mensagemInicial, setMensagemInicial, aiConfig }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const { textoFixo, instrucoesIndividuais, preInstrucaoIA } = mensagemInicial
  const set = (key, val) => setMensagemInicial(prev => ({ ...prev, [key]: val }))

  const handleAutoInstrucoes = () => {
    const sugestao = autoInstrucoesFromVars(config.variables || [])
    set('instrucoesIndividuais', sugestao || '')
  }

  const handleGerarPreInstrucao = async () => {
    if (!aiConfig?.apiKey) { setGenError('Configure a chave de IA em Configurações.'); return }
    setIsGenerating(true)
    setGenError('')
    try {
      const texto = await gerarPreInstrucao(config, instrucoesIndividuais, aiConfig)
      set('preInstrucaoIA', texto.trim())
    } catch (e) {
      setGenError(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>
      {/* Accent */}
      <div className="h-0.5 bg-gradient-to-r from-primary/70 via-secondary/40 to-transparent" />

      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>forum</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-on-surface leading-none">Mensagem Inicial</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
            Configure como o agente inicia a conversa no BotConversa
          </p>
        </div>
        <span className="label-caps text-[9px] text-on-surface-variant/40 border border-outline-variant px-2 py-0.5 rounded">V2</span>
      </div>

      <div className="p-5 space-y-4">

        {/* 1 — Mensagem para o Contato (fixa) */}
        <FieldSection
          icon="chat"
          title="Mensagem para o Contato"
          subtitle="Texto fixo enviado ao usuário no início. Deixe vazio se a I.A. vai gerar a primeira mensagem."
          accentColor="secondary"
        >
          <textarea
            value={textoFixo}
            onChange={e => set('textoFixo', e.target.value)}
            placeholder="Ex: Olá! Seja bem-vindo. Como posso ajudar?"
            rows={3}
            className="w-full rounded border border-outline-variant px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-secondary resize-none"
            style={{ background: 'var(--color-surface-container)' }}
          />
          <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1.5">
            Visível ao usuário. Se preenchida, a I.A. não precisa de pré-instrução para a primeira mensagem.
          </p>
        </FieldSection>

        {/* 2 — Instruções Individuais */}
        <FieldSection
          icon="person_pin"
          title="Instruções Individuais"
          subtitle="Dados do CRM injetados automaticamente pelo BotConversa antes de cada interação."
          accentColor="tertiary"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex flex-wrap gap-1">
              {BC_VARS.map(v => (
                <button key={v.tag} type="button"
                  onClick={() => set('instrucoesIndividuais', (instrucoesIndividuais ? instrucoesIndividuais + '\n' : '') + `${v.label}: ${v.tag}`)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-outline-variant/60 text-on-surface-variant/60 hover:text-tertiary hover:border-tertiary/50 transition-all">
                  {v.tag}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleAutoInstrucoes}
              disabled={!(config.variables?.length > 0)}
              className="flex items-center gap-1 text-[9px] font-mono text-tertiary hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ml-2">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
              Auto-preencher
            </button>
          </div>
          <textarea
            value={instrucoesIndividuais}
            onChange={e => set('instrucoesIndividuais', e.target.value)}
            placeholder={'Nome do cliente: {primeiro-nome}\nPlano atual: {plano}\nÚltimo pagamento: {data-pagamento}'}
            rows={4}
            className="w-full rounded border border-outline-variant px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-tertiary resize-none"
            style={{ background: 'var(--color-surface-container)' }}
          />
        </FieldSection>

        {/* 3 — Pré-mensagem para a I.A. */}
        <FieldSection
          icon="smart_toy"
          title="Pré-mensagem para a I.A."
          subtitle="Instrução interna enviada à I.A. antes do prompt principal. Não é visível ao usuário."
          accentColor="primary"
        >
          <div className="flex items-center justify-end mb-1.5">
            <button type="button" onClick={handleGerarPreInstrucao}
              disabled={isGenerating || !aiConfig?.apiKey}
              className="flex items-center gap-1 text-[9px] font-mono text-primary hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
              {isGenerating
                ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 12 }}>progress_activity</span> Gerando...</>
                : <><span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span> Gerar com I.A.</>}
            </button>
          </div>
          <textarea
            value={preInstrucaoIA}
            onChange={e => set('preInstrucaoIA', e.target.value)}
            placeholder="Cole ou gere aqui a pré-instrução para a I.A. Recomendado referenciar {Resumo} para distinguir primeira interação das demais."
            rows={6}
            className="w-full rounded border border-outline-variant px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary resize-none"
            style={{ background: 'var(--color-surface-container)' }}
          />
          {genError && <p className="text-[9px] font-mono text-error mt-1">{genError}</p>}
          <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1.5">
            Use <code className="bg-surface-container-high px-1 rounded">{'{Resumo}'}</code> para detectar primeira vs demais interações.
          </p>
        </FieldSection>

      </div>
    </section>
  )
}
