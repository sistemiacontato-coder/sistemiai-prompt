import { useState, useEffect, useMemo } from 'react'
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

// Agrupa itens consecutivos removed+added da mesma categoria em pares "modified"
function buildPairs(items) {
  const result = []
  let i = 0
  while (i < items.length) {
    const cur = items[i]
    const nxt = items[i + 1]
    if (cur.type === 'removed' && nxt && nxt.type === 'added' && nxt.category === cur.category) {
      result.push({ kind: 'modified', removed: cur, added: nxt })
      i += 2
    } else {
      result.push({ kind: cur.type, item: cur })
      i++
    }
  }
  return result
}

// Linha de item no painel de diff — cores via variáveis CSS (funciona em modo claro e escuro)
function DiffItem({ type, category, title, detail, wordHighlight, dimmed }) {
  const isAdd = type === 'added'
  const cv = isAdd ? 'secondary' : 'error'
  const color     = `rgb(var(--color-${cv}))`
  const colorFade = `rgb(var(--color-${cv}) / 0.75)`
  const bgItem    = `rgb(var(--color-${cv}) / 0.10)`
  const bgChip    = `rgb(var(--color-${cv}) / 0.16)`
  const bdrLeft   = `rgb(var(--color-${cv}) / 0.55)`

  const renderedContent = wordHighlight
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

  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 border-b border-outline-variant/10 last:border-0 transition-opacity"
      style={{ background: dimmed ? 'transparent' : bgItem, borderLeft: `3px solid ${dimmed ? 'transparent' : bdrLeft}`, opacity: dimmed ? 0.3 : 1 }}
    >
      <span className="font-mono text-[13px] font-bold flex-shrink-0 mt-0.5 w-3" style={{ color }}>
        {isAdd ? '+' : '−'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span className="text-[8px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: bgChip, color }}>
            {category}
          </span>
        </div>
        <span className="font-mono text-[11px] font-normal leading-snug" style={{ color }}>
          {renderedContent}
        </span>
        {detail && (
          <p className="text-[10px] font-mono mt-1 leading-relaxed font-normal" style={{ color: colorFade }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

// Item avulso com checkbox
function CheckableItem({ item, checked, onToggle }) {
  return (
    <div className="flex items-stretch border-b border-outline-variant/10 last:border-0">
      <button
        onClick={onToggle}
        className="flex items-start pt-2.5 px-2 hover:opacity-80 transition-opacity flex-shrink-0"
        title={checked ? 'Desmarcar' : 'Marcar'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: checked ? '#4ade80' : 'rgba(163,163,163,0.35)' }}>
          {checked ? 'check_box' : 'check_box_outline_blank'}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <DiffItem {...item} dimmed={!checked} />
      </div>
    </div>
  )
}

// Par de modificação com checkbox único
function CheckablePair({ removed, added, checked, onToggle }) {
  return (
    <div className="border-b border-outline-variant/10 last:border-0">
      <div className="flex items-stretch">
        <button
          onClick={onToggle}
          className="flex items-start pt-2.5 px-2 hover:opacity-80 transition-opacity flex-shrink-0"
          title={checked ? 'Desmarcar par' : 'Marcar par'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: checked ? '#fb923c' : 'rgba(163,163,163,0.35)' }}>
            {checked ? 'check_box' : 'check_box_outline_blank'}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <DiffItem {...removed} dimmed={!checked} />
          <DiffItem {...added} dimmed={!checked} />
        </div>
      </div>
    </div>
  )
}

// Painel dedicado de diff semântico — inclui checkboxes individuais, réplica e botões de ação
function DiffPanel({ pendingChanges, config, onApply, onDiscard, onRefine, isRefining }) {
  const [refineText, setRefineText] = useState('')
  const [refineError, setRefineError] = useState(null)
  const [enabledKeys, setEnabledKeys] = useState(() => new Set())

  const { items, pairs } = useMemo(() => {
    if (!pendingChanges) return { items: [], pairs: [] }
    const { new_agent_name, persona_add = [], persona_remove = [], domain_add = [], domain_remove = [], add_variables = [], remove_variables = [], add_exits = [], remove_exits = [], update_exits = [] } = pendingChanges
    const its = []

    if (new_agent_name) {
      const oldName = config?.agentName || ''
      if (oldName) its.push({ type: 'removed', category: 'nome', title: oldName, detail: null, wordHighlight: null, _key: 'name-old' })
      its.push({ type: 'added', category: 'nome', title: new_agent_name, detail: null, wordHighlight: highlightChangedWords(oldName, new_agent_name), _key: 'name-new' })
    }
    persona_remove.forEach((t, i) => { if (t.trim()) its.push({ type: 'removed', category: 'persona', title: t, detail: null, wordHighlight: null, _key: `per-rem-${i}` }) })
    persona_add.forEach((t, i) => its.push({ type: 'added', category: 'persona', title: t, detail: null, wordHighlight: null, _key: `per-add-${i}` }))
    domain_remove.forEach((t, i) => { if (t.trim()) its.push({ type: 'removed', category: 'objetivo', title: t, detail: null, wordHighlight: null, _key: `dom-rem-${i}` }) })
    domain_add.forEach((t, i) => its.push({ type: 'added', category: 'objetivo', title: t, detail: null, wordHighlight: null, _key: `dom-add-${i}` }))
    remove_variables.forEach((name, i) => { const v = config?.variables?.find(v => v.name === name); its.push({ type: 'removed', category: 'campo', title: name, detail: v?.description || null, wordHighlight: null, _key: `rv-${i}` }) })
    add_variables.forEach((v, i) => its.push({ type: 'added', category: 'campo', title: v.name, detail: v.description || null, wordHighlight: null, _key: `av-${i}` }))
    remove_exits.forEach((key, i) => { const e = config?.exitDestinations?.find(e => e.key === key); its.push({ type: 'removed', category: 'saída', title: e?.label || key, detail: e?.description || null, wordHighlight: null, _key: `re-${i}` }) })
    add_exits.forEach((e, i) => its.push({ type: 'added', category: 'saída', title: e.label || e.key, detail: e.description || null, wordHighlight: null, _key: `ae-${i}` }))
    update_exits.forEach((e, i) => {
      const ex = config?.exitDestinations?.find(x => x.key === e.key)
      if (ex?.description) its.push({ type: 'removed', category: 'saída', title: `${ex.label || e.key}: ${ex.description}`, detail: null, wordHighlight: null, _key: `ue-rem-${i}` })
      its.push({ type: 'added', category: 'saída', title: `${ex?.label || e.key}: ${e.description}`, detail: null, wordHighlight: null, _key: `ue-add-${i}` })
    })

    return { items: its, pairs: buildPairs(its) }
  }, [pendingChanges, config])

  useEffect(() => {
    setEnabledKeys(new Set(items.map(i => i._key)))
  }, [pendingChanges])

  if (!pendingChanges || items.length === 0) return null

  const toggleKey = (key) => setEnabledKeys(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })
  const togglePair = (keys) => setEnabledKeys(prev => {
    const next = new Set(prev)
    const allOn = keys.every(k => prev.has(k))
    allOn ? keys.forEach(k => next.delete(k)) : keys.forEach(k => next.add(k))
    return next
  })
  const toggleAll = () => setEnabledKeys(prev =>
    prev.size === items.length ? new Set() : new Set(items.map(i => i._key))
  )

  const buildFiltered = () => {
    const has = k => enabledKeys.has(k)
    const fa = (arr, prefix) => (arr || []).filter((_, i) => has(`${prefix}${i}`))
    return {
      ...pendingChanges,
      new_agent_name: has('name-new') ? pendingChanges.new_agent_name : '',
      persona_add: fa(pendingChanges.persona_add, 'per-add-'),
      persona_remove: fa(pendingChanges.persona_remove, 'per-rem-'),
      domain_add: fa(pendingChanges.domain_add, 'dom-add-'),
      domain_remove: fa(pendingChanges.domain_remove, 'dom-rem-'),
      add_variables: fa(pendingChanges.add_variables, 'av-'),
      remove_variables: fa(pendingChanges.remove_variables, 'rv-'),
      add_exits: fa(pendingChanges.add_exits, 'ae-'),
      remove_exits: fa(pendingChanges.remove_exits, 're-'),
      update_exits: (pendingChanges.update_exits || []).filter((_, i) => has(`ue-add-${i}`)),
    }
  }

  const enabledCount = items.filter(i => enabledKeys.has(i._key)).length
  const allEnabled = enabledCount === items.length
  const totalCount = items.length

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>

      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/40"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>difference</span>
        <span className="text-[10px] font-mono font-semibold text-on-surface-variant/50 flex-1 tracking-wider uppercase">
          Prévia das Mudanças
        </span>
        <button onClick={toggleAll} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all hover:opacity-80"
          style={{ color: 'rgba(163,163,163,0.6)', border: '1px solid rgba(163,163,163,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{allEnabled ? 'deselect' : 'select_all'}</span>
          {allEnabled ? 'Desmarcar tudo' : 'Marcar tudo'}
        </button>
        <span className="text-[9px] font-mono text-on-surface-variant/40">
          {enabledCount}/{totalCount}
        </span>
      </div>

      {/* Itens com checkboxes */}
      <div className="max-h-[280px] overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
        {pairs.length === 0
          ? <p className="text-[10px] font-mono text-on-surface-variant/30 px-4 py-3">Nenhuma mudança.</p>
          : pairs.map((p, i) => {
              if (p.kind === 'modified') {
                const pairKeys = [p.removed._key, p.added._key].filter(k => items.some(it => it._key === k))
                const checked = pairKeys.some(k => enabledKeys.has(k))
                return <CheckablePair key={i} removed={p.removed} added={p.added} checked={checked} onToggle={() => togglePair(pairKeys)} />
              }
              const item = p.item
              return <CheckableItem key={item._key} item={item} checked={enabledKeys.has(item._key)} onToggle={() => toggleKey(item._key)} />
            })
        }
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
              borderColor: refineText.trim() && !isRefining ? 'rgba(74,222,128,0.4)' : 'var(--color-outline-variant)',
              background: refineText.trim() && !isRefining ? 'rgba(74,222,128,0.08)' : 'var(--color-surface)',
              color: refineText.trim() && !isRefining ? '#4ade80' : 'var(--color-on-surface-variant)',
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
        <button
          onClick={() => onApply(buildFiltered())}
          disabled={isRefining || enabledCount === 0}
          className="px-4 py-2 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-[0.99] disabled:opacity-40"
          style={{ border: '1.5px solid rgba(74,222,128,0.6)', color: '#4ade80', background: 'transparent' }}>
          Aplicar {enabledCount} de {totalCount}
        </button>
      </div>
    </div>
  )
}

export default function PromptPreview({
  prompt,
  pendingChanges, onReview, isReviewing, onApplyChanges, onDiscardChanges, onRefine,
  aiConfig, config,
  onNavigateToSimulator,
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

  const handleApply = (filtered) => {
    onApplyChanges(filtered)
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
       (pendingChanges.persona_add?.length || 0) + (pendingChanges.persona_remove?.length || 0) +
       (pendingChanges.domain_add?.length || 0) + (pendingChanges.domain_remove?.length || 0) +
       (pendingChanges.new_agent_name ? 1 : 0))
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
              {onNavigateToSimulator && (
                <button onClick={onNavigateToSimulator} className="flex items-center gap-1.5 text-secondary hover:brightness-110 transition-colors mr-3">
                  <span className="material-symbols-outlined text-[18px]">science</span>
                  <span className="label-caps text-[9.5px]">TESTAR PROMPT</span>
                </button>
              )}
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
              <span className="ml-auto text-[10px] font-mono text-on-surface-variant/40">Configure uma IA em Configurações</span>
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
                  {((pendingChanges.persona_add?.length || 0) + (pendingChanges.persona_remove?.length || 0)) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-secondary/30 text-secondary">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>person</span>
                      persona atualizada
                    </span>
                  )}
                  {((pendingChanges.domain_add?.length || 0) + (pendingChanges.domain_remove?.length || 0)) > 0 && (
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
