import { useState } from 'react'
import { diffLines } from '../../lib/promptDiff'

function tokenizeLine(line) {
  if (line.startsWith('# ')) return { type: 'h1', content: line }
  if (line.startsWith('## ')) return { type: 'h2', content: line }
  if (line.startsWith('### ')) return { type: 'h3', content: line }
  if (line.startsWith('```')) return { type: 'fence', content: line }
  if (line.startsWith('- ')) return { type: 'list', content: line }
  if (line.startsWith('|')) return { type: 'table', content: line }
  if (line.match(/^\d+\./)) return { type: 'ordered', content: line }
  if (line.startsWith('**') && line.endsWith('**')) return { type: 'bold', content: line }
  return { type: 'body', content: line }
}

function renderLine(line, idx) {
  const token = tokenizeLine(line)
  const key = idx

  const highlightInline = (text) => {
    const parts = []
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\{\{[^}]+\}\})/g
    let lastIdx = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx)
        parts.push(<span key={lastIdx}>{text.slice(lastIdx, match.index)}</span>)
      const m = match[0]
      if (m.startsWith('`'))
        parts.push(<code key={match.index} className="font-mono text-primary bg-primary/10 px-1 rounded text-[12px]">{m.slice(1, -1)}</code>)
      else if (m.startsWith('**'))
        parts.push(<strong key={match.index} className="text-on-surface font-semibold">{m.slice(2, -2)}</strong>)
      else if (m.startsWith('{{'))
        parts.push(<span key={match.index} className="font-mono text-secondary bg-secondary/10 px-1 rounded text-[12px]">{m}</span>)
      lastIdx = match.index + m.length
    }
    if (lastIdx < text.length)
      parts.push(<span key={lastIdx}>{text.slice(lastIdx)}</span>)
    return parts
  }

  switch (token.type) {
    case 'h1': return <div key={key} className="mt-5 mb-1"><span className="text-secondary font-mono font-bold text-[13px]">{line}</span></div>
    case 'h2': return <div key={key} className="mt-3 mb-0.5"><span className="text-primary font-mono font-semibold text-[13px]">{line}</span></div>
    case 'h3': return <div key={key} className="mt-2"><span className="text-on-surface font-mono font-semibold text-[12px]">{line}</span></div>
    case 'fence': return <div key={key} className="text-outline font-mono text-[12px]">{line}</div>
    case 'list': return (
      <div key={key} className="text-on-surface/75 font-mono text-[12px] leading-relaxed pl-2">
        <span className="text-secondary mr-1">-</span>{highlightInline(line.slice(2))}
      </div>
    )
    case 'table': return <div key={key} className="text-on-surface-variant font-mono text-[11px] leading-relaxed">{line}</div>
    case 'ordered': return <div key={key} className="text-on-surface/75 font-mono text-[12px] leading-relaxed pl-2">{highlightInline(line)}</div>
    default: return (
      <div key={key} className="text-on-surface/75 font-mono text-[12px] leading-relaxed">
        {line ? highlightInline(line) : <br />}
      </div>
    )
  }
}

// Compara duas strings por palavras e retorna array { word, isBold }
// isBold = true apenas para as palavras que mudaram (diferente do oldStr)
function highlightChangedWords(oldStr, newStr) {
  if (!oldStr || !newStr) return null
  const oldWords = oldStr.trim().split(/\s+/)
  const newWords = newStr.trim().split(/\s+/)

  // Prefixo comum
  let start = 0
  while (start < oldWords.length && start < newWords.length && oldWords[start] === newWords[start]) start++

  // Sufixo comum
  let endOld = oldWords.length - 1
  let endNew = newWords.length - 1
  while (endOld >= start && endNew >= start && oldWords[endOld] === newWords[endNew]) { endOld--; endNew-- }

  // Nada mudou
  if (start > endNew && start > endOld) return null

  return newWords.map((word, i) => ({ word, isBold: i >= start && i <= endNew }))
}

// Linha de item no painel de diff — cores via variáveis CSS (funciona em modo claro e escuro)
function DiffItem({ type, category, title, detail, wordHighlight }) {
  const isAdd = type === 'added'
  const cv = isAdd ? 'secondary' : 'error'
  const color     = `rgb(var(--color-${cv}))`
  const colorFade = `rgb(var(--color-${cv}) / 0.75)`
  const bgItem    = `rgb(var(--color-${cv}) / 0.10)`
  const bgChip    = `rgb(var(--color-${cv}) / 0.16)`
  const bdrLeft   = `rgb(var(--color-${cv}) / 0.55)`

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 border-b border-outline-variant/10 last:border-0"
      style={{ background: bgItem, borderLeft: `3px solid ${bdrLeft}` }}
    >
      <span className="font-mono text-[13px] font-bold flex-shrink-0 mt-0.5 w-3" style={{ color }}>
        {isAdd ? '+' : '−'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[8px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: bgChip, color }}
          >
            {category}
          </span>
          <span className="font-mono text-[11px] font-normal leading-snug" style={{ color }}>
            {wordHighlight
              ? (() => {
                  const groups = []
                  for (const w of wordHighlight) {
                    const last = groups[groups.length - 1]
                    if (last && last.isBold === w.isBold) last.words.push(w.word)
                    else groups.push({ isBold: w.isBold, words: [w.word] })
                  }
                  return groups.map((g, i) =>
                    g.isBold
                      ? <span key={i} style={{ fontWeight: 900, color, background: `rgb(var(--color-${cv}) / 0.22)`, borderRadius: '3px', padding: '0 4px' }}>
                          {g.words.join(' ')}
                        </span>
                      : <span key={i}>{g.words.join(' ')} </span>
                  )
                })()
              : title
            }
          </span>
        </div>
        {detail && (
          <p className="text-[10px] font-mono mt-0.5 leading-relaxed font-normal" style={{ color: colorFade }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

// Painel dedicado de diff semântico — inclui réplica e botões de ação
function DiffPanel({ pendingChanges, config, onApply, onDiscard, onRefine, isRefining, totalChanges }) {
  const [filter, setFilter] = useState('all')
  const [refineText, setRefineText] = useState('')
  const [refineError, setRefineError] = useState(null)

  if (!pendingChanges) return null

  const { new_agent_name, new_agent_persona, new_domain, add_variables, remove_variables, add_exits, remove_exits } = pendingChanges

  // Monta itens semânticos
  const items = []

  // Nome do agente
  if (new_agent_name) {
    const oldName = config?.agentName || ''
    if (oldName) items.push({ type: 'removed', category: 'nome', title: oldName, detail: null, wordHighlight: null, _key: 'name-old' })
    items.push({ type: 'added', category: 'nome', title: new_agent_name, detail: null, wordHighlight: null, _key: 'name-new' })
  }

  // Persona do agente — diff linha a linha
  if (new_agent_persona) {
    const oldPersona = config?.agentPersona || ''
    if (oldPersona && oldPersona !== new_agent_persona) {
      const personaDiff = diffLines(oldPersona, new_agent_persona)
      personaDiff.filter(d => d.type === 'removed').forEach((d, i) => {
        items.push({ type: 'removed', category: 'persona', title: d.content || '(vazio)', detail: null, wordHighlight: null, _key: `per-rem-${i}` })
      })
      personaDiff.filter(d => d.type === 'added').forEach((d, i) => {
        items.push({ type: 'added', category: 'persona', title: d.content || '(vazio)', detail: null, wordHighlight: null, _key: `per-add-${i}` })
      })
    } else if (!oldPersona) {
      new_agent_persona.split('\n').forEach((line, i) => {
        if (line.trim()) items.push({ type: 'added', category: 'persona', title: line, detail: null, wordHighlight: null, _key: `per-new-${i}` })
      })
    }
  }

  // Objetivo — diff linha a linha, com highlight de palavras nos itens adicionados
  if (new_domain) {
    const oldDomain = config?.domain || ''
    if (oldDomain && oldDomain !== new_domain) {
      const domainDiff = diffLines(oldDomain, new_domain)
      const domRemoved = domainDiff.filter(d => d.type === 'removed').map(d => d.content || '')
      const domAdded   = domainDiff.filter(d => d.type === 'added').map(d => d.content || '')

      // Exibe pares: removido → adicionado (mesma posição)
      const pairCount = Math.max(domRemoved.length, domAdded.length)
      for (let i = 0; i < pairCount; i++) {
        if (domRemoved[i] !== undefined) {
          items.push({ type: 'removed', category: 'objetivo', title: domRemoved[i] || '(linha vazia)', detail: null, wordHighlight: null, _key: `dom-rem-${i}` })
        }
        if (domAdded[i] !== undefined) {
          const highlight = highlightChangedWords(domRemoved[i] || '', domAdded[i])
          items.push({ type: 'added', category: 'objetivo', title: domAdded[i] || '(linha vazia)', detail: null, wordHighlight: highlight, _key: `dom-add-${i}` })
        }
      }
    } else if (!oldDomain) {
      new_domain.split('\n').forEach((line, i) => {
        if (line.trim()) items.push({ type: 'added', category: 'objetivo', title: line, detail: null, wordHighlight: null, _key: `dom-new-${i}` })
      })
    }
  }

  // Campos removidos
  remove_variables.forEach((name, i) => {
    const v = config?.variables?.find(v => v.name === name)
    items.push({ type: 'removed', category: 'campo', title: name, detail: v?.description || null, wordHighlight: null, _key: `rv-${i}` })
  })

  // Campos adicionados
  add_variables.forEach((v, i) => {
    items.push({ type: 'added', category: 'campo', title: v.name, detail: v.description || null, wordHighlight: null, _key: `av-${i}` })
  })

  // Saídas removidas
  remove_exits.forEach((key, i) => {
    const e = config?.exitDestinations?.find(e => e.key === key)
    items.push({ type: 'removed', category: 'saída', title: e?.label || key, detail: e?.description || null, wordHighlight: null, _key: `re-${i}` })
  })

  // Saídas adicionadas
  add_exits.forEach((e, i) => {
    items.push({ type: 'added', category: 'saída', title: e.label || e.key, detail: e.description || null, wordHighlight: null, _key: `ae-${i}` })
  })

  if (items.length === 0) return null

  const addedCount  = items.filter(i => i.type === 'added').length
  const removedCount = items.filter(i => i.type === 'removed').length

  const visible = filter === 'added'   ? items.filter(i => i.type === 'added') :
                  filter === 'removed' ? items.filter(i => i.type === 'removed') :
                  items

  const filterBtns = [
    { key: 'all',     label: 'Tudo',       count: items.length, activeColor: '#a3a3a3', activeBg: 'rgba(163,163,163,0.12)', activeBorder: 'rgba(163,163,163,0.25)' },
    { key: 'added',   label: 'Adicionado', count: addedCount,   activeColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)',  activeBorder: 'rgba(74,222,128,0.35)' },
    { key: 'removed', label: 'Removido',   count: removedCount, activeColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)', activeBorder: 'rgba(248,113,113,0.35)' },
  ].filter(f => f.count > 0 || f.key === 'all')

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>

      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/40"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>difference</span>
        <span className="text-[10px] font-mono font-semibold text-on-surface-variant/50 flex-1 tracking-wider uppercase">
          Prévia das Mudanças
        </span>
        <div className="flex items-center gap-1">
          {filterBtns.map(f => {
            const isActive = filter === f.key
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all"
                style={{
                  background: isActive ? f.activeBg : 'transparent',
                  color: isActive ? f.activeColor : 'rgba(163,163,163,0.45)',
                  border: isActive ? `1px solid ${f.activeBorder}` : '1px solid transparent',
                }}>
                {f.key === 'added'   && <span>+</span>}
                {f.key === 'removed' && <span>−</span>}
                {f.label} ({f.count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Itens */}
      <div className="max-h-[260px] overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
        {visible.length === 0 ? (
          <p className="text-[10px] font-mono text-on-surface-variant/30 px-4 py-3">
            Nenhuma mudança nesta categoria.
          </p>
        ) : (
          visible.map(item => (
            <DiffItem key={item._key} type={item.type} category={item.category}
                      title={item.title} detail={item.detail} wordHighlight={item.wordHighlight} />
          ))
        )}
      </div>

      {/* Campo de réplica */}
      <div className="px-3 py-3 border-t border-outline-variant/30 space-y-2"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <p className="text-[9px] font-mono text-on-surface-variant/40 tracking-wider uppercase">
          Não ficou certo? Faça os ajustes finos abaixo
        </p>
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={refineText}
            onChange={e => { setRefineText(e.target.value); setRefineError(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && refineText.trim() && !isRefining) {
                setRefineError(null)
                onRefine(refineText.trim()).catch(err => setRefineError(err.message)).finally(() => setRefineText(''))
              }
            }}
            placeholder="Ex: não adicione esse campo, só atualize o objetivo..."
            disabled={isRefining}
            className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-[11px] font-mono text-on-surface leading-relaxed resize-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 focus:outline-none transition-all disabled:opacity-40"
            style={{ background: 'var(--color-surface)' }}
          />
          <button
            disabled={!refineText.trim() || isRefining}
            onClick={() => {
              setRefineError(null)
              onRefine(refineText.trim()).catch(err => setRefineError(err.message)).finally(() => setRefineText(''))
            }}
            className="self-stretch px-3 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
            style={{
              borderColor: refineText.trim() && !isRefining
                ? 'rgba(74,222,128,0.4)'
                : 'var(--color-outline-variant)',
              background: refineText.trim() && !isRefining
                ? 'rgba(74,222,128,0.08)'
                : 'var(--color-surface)',
              color: refineText.trim() && !isRefining
                ? '#4ade80'
                : 'var(--color-on-surface-variant)',
            }}>
            {isRefining
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>reply</span>
            }
            <span className="text-[8px] font-mono font-semibold tracking-wide">
              {isRefining ? 'AJUST.' : 'REFINAR'}
            </span>
          </button>
        </div>
        {refineError && (
          <p className="text-[10px] font-mono text-error leading-snug">{refineError}</p>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex items-center justify-end gap-2 px-3 py-3 border-t border-outline-variant/40"
           style={{ background: 'var(--color-surface-container)' }}>
        <button onClick={onDiscard}
          className="px-4 py-2 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-[0.99]"
          style={{ border: '1.5px solid rgba(248,113,113,0.6)', color: '#f87171', background: 'transparent' }}>
          Descartar
        </button>
        <button onClick={onApply}
          disabled={isRefining}
          className="px-4 py-2 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-[0.99] disabled:opacity-50"
          style={{ border: '1.5px solid rgba(74,222,128,0.6)', color: '#4ade80', background: 'transparent' }}>
          Aplicar {totalChanges} mudança{totalChanges !== 1 ? 's' : ''} e Regenerar
        </button>
      </div>
    </div>
  )
}

export default function PromptPreview({
  prompt,
  pendingChanges, onReview, isReviewing, onApplyChanges, onDiscardChanges, onRefine,
  aiConfig, config,
}) {
  const [copied, setCopied] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [reviewError, setReviewError] = useState(null)

  const handleCopy = async () => {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!prompt) return
    const blob = new Blob([prompt], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'system_prompt.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReview = async () => {
    if (!instruction.trim() || isReviewing) return
    setReviewError(null)
    try {
      await onReview(instruction.trim())
    } catch (e) {
      setReviewError(e.message)
    }
  }

  const handleApply = () => {
    onApplyChanges()
    setInstruction('')
    setReviewError(null)
  }

  const handleDiscard = () => {
    onDiscardChanges()
    setReviewError(null)
  }

  const charCount = prompt?.length || 0
  const tokenEstimate = Math.ceil(charCount / 4)

  const totalChanges = pendingChanges
    ? (pendingChanges.add_variables.length + pendingChanges.remove_variables.length +
       pendingChanges.add_exits.length + pendingChanges.remove_exits.length +
       (pendingChanges.new_domain ? 1 : 0) +
       (pendingChanges.new_agent_name ? 1 : 0) +
       (pendingChanges.new_agent_persona ? 1 : 0))
    : 0

  return (
    <section className="bg-surface-container-low border border-outline-variant rounded overflow-hidden">
      {/* Header */}
      <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="label-caps">SYSTEM_PROMPT_OUTPUT.md</span>
          {prompt && (
            <>
              <span className="text-[10px] font-mono text-on-surface-variant/40">{charCount} chars</span>
              <span className="text-[10px] font-mono text-on-surface-variant/40">~{tokenEstimate} tokens</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {prompt && (
            <>
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                <span className="label-caps text-[9px]">{copied ? 'COPIADO' : 'COPIAR'}</span>
              </button>
              <button onClick={handleDownload} className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span className="label-caps text-[9px]">DOWNLOAD</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div className="p-6 min-h-[300px] max-h-[500px] overflow-y-auto">
        {!prompt ? (
          <div className="flex flex-col items-center justify-center h-[260px] text-on-surface-variant/30">
            <span className="material-symbols-outlined text-[48px] mb-3">terminal</span>
            <p className="label-caps">AGUARDANDO GERAÇÃO DO PROMPT</p>
            <p className="text-[11px] font-mono mt-2">Configure o agente e clique em GERAR PROMPT</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {prompt.split('\n').map((line, i) => renderLine(line, i))}
          </div>
        )}
      </div>

      {/* ── Revisor de Prompt ── */}
      {prompt && (
        <div className="border-t border-outline-variant" style={{ background: 'var(--color-surface-container)' }}>
          <div className="px-6 py-3 border-b border-outline-variant/50 flex items-center gap-2"
               style={{ background: 'var(--color-surface-container-high)' }}>
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>rate_review</span>
            <span className="label-caps text-[10px] text-secondary">REVISAR COM IA</span>
            {!aiConfig?.apiKey && (
              <span className="ml-auto text-[10px] font-mono text-on-surface-variant/40">Configure uma IA em Config IA</span>
            )}
          </div>

          <div className="p-5 space-y-3">
            {/* Resumo das mudanças pendentes */}
            {pendingChanges && (
              <div className="rounded-lg border-2 p-4 space-y-3"
                   style={{
                     borderColor: 'color-mix(in srgb, var(--color-secondary) 40%, transparent)',
                     background: 'color-mix(in srgb, var(--color-secondary) 5%, transparent)',
                   }}>

                {/* Instrução original do usuário */}
                {pendingChanges.originalInstruction && (
                  <div className="flex items-start gap-2 pb-3 border-b border-outline-variant/20">
                    <span className="material-symbols-outlined text-on-surface-variant/40 flex-shrink-0 mt-0.5" style={{ fontSize: 14 }}>chat_bubble</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-wider mb-0.5">Sua instrução</p>
                      <p className="text-[11px] font-mono text-on-surface/70 leading-relaxed italic">
                        "{pendingChanges.originalInstruction}"
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>auto_fix_high</span>
                  <p className="text-[12px] font-mono text-secondary leading-relaxed flex-1">{pendingChanges.summary}</p>
                  <button
                    onClick={handleDiscard}
                    title="Descartar mudanças"
                    className="flex-shrink-0 text-on-surface-variant/30 hover:text-error transition-colors mt-0.5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {pendingChanges.new_agent_name && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>badge</span>
                      nome atualizado
                    </span>
                  )}
                  {pendingChanges.new_agent_persona && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>person</span>
                      persona atualizada
                    </span>
                  )}
                  {pendingChanges.new_domain && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>edit</span>
                      objetivo atualizado
                    </span>
                  )}
                  {pendingChanges.add_variables.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>add</span>
                      {pendingChanges.add_variables.length} campo{pendingChanges.add_variables.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pendingChanges.remove_variables.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-error/30 text-error">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>remove</span>
                      {pendingChanges.remove_variables.length} campo{pendingChanges.remove_variables.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pendingChanges.add_exits.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>add</span>
                      {pendingChanges.add_exits.length} saída{pendingChanges.add_exits.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pendingChanges.remove_exits.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-error/30 text-error">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>remove</span>
                      {pendingChanges.remove_exits.length} saída{pendingChanges.remove_exits.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Painel semântico de mudanças — com réplica e botões de ação na base */}
            {pendingChanges && (
              <DiffPanel
                pendingChanges={pendingChanges}
                config={config}
                onApply={handleApply}
                onDiscard={handleDiscard}
                onRefine={onRefine}
                isRefining={isReviewing}
                totalChanges={totalChanges}
              />
            )}

            {/* Erro do revisor */}
            {reviewError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-error/30 text-[11px] font-mono text-error leading-relaxed"
                   style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}>
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 14 }}>error</span>
                {reviewError}
              </div>
            )}

            {/* Input de instrução */}
            {!pendingChanges && (
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={instruction}
                  onChange={e => { setInstruction(e.target.value); setReviewError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReview() }}
                  placeholder="O que precisa mudar? Ex: encaminhar para o financeiro quando o cliente perguntar sobre parcelamento..."
                  disabled={!aiConfig?.apiKey}
                  className="flex-1 rounded-lg border border-outline-variant px-3 py-2.5 text-[12px] font-mono text-on-surface leading-relaxed resize-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 focus:outline-none transition-all disabled:opacity-40"
                  style={{ background: 'var(--color-surface)' }}
                />
                <button
                  onClick={handleReview}
                  disabled={!instruction.trim() || isReviewing || !aiConfig?.apiKey}
                  className="self-stretch px-4 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                  style={{
                    borderColor: instruction.trim() && aiConfig?.apiKey
                      ? 'color-mix(in srgb, var(--color-secondary) 50%, transparent)'
                      : 'var(--color-outline-variant)',
                    background: instruction.trim() && aiConfig?.apiKey
                      ? 'color-mix(in srgb, var(--color-secondary) 8%, transparent)'
                      : 'var(--color-surface)',
                    color: instruction.trim() && aiConfig?.apiKey
                      ? 'var(--color-secondary)'
                      : 'var(--color-on-surface-variant)',
                  }}>
                  {isReviewing
                    ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                    : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_fix_high</span>
                  }
                  <span className="text-[9px] font-mono font-semibold tracking-wide">
                    {isReviewing ? 'ANALISANDO' : 'REVISAR'}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </section>
  )
}
