import { useState, useCallback } from 'react'
import { classifyPromptComplexity } from '../../lib/promptComplexity'

function PricingTable({ recommendedModel }) {
  const [pricing, setPricing]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [open, setOpen]         = useState(false)

  const fetchPricing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pricing')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPricing(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open && !pricing && !loading) fetchPricing()
  }

  const fmt = (val) => val != null ? `$${val.toFixed(2)}` : '—'
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="rounded-lg border border-outline-variant/40 overflow-hidden"
         style={{ background: 'rgb(var(--color-surface-container-high))' }}>

      {/* Toggle header */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:opacity-80 transition-opacity"
      >
        <span className="material-symbols-outlined text-primary/60" style={{ fontSize: 14 }}>
          {loading ? 'progress_activity' : 'compare_arrows'}
        </span>
        <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-on-surface-variant/50 flex-1">
          Comparativo de Preços OpenAI em Tempo Real
        </span>
        <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 14 }}>
          {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </button>

      {open && (
        <div className="border-t border-outline-variant/30">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-4 text-on-surface-variant/50">
              <span className="material-symbols-outlined animate-spin text-primary/60" style={{ fontSize: 15 }}>progress_activity</span>
              <span className="text-[10px] font-mono">Consultando preços em tempo real...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 14 }}>error</span>
              <span className="text-[10px] font-mono text-error/80 flex-1">{error}</span>
              <button
                onClick={fetchPricing}
                className="text-[9px] font-mono text-primary underline hover:no-underline"
              >Tentar novamente</button>
            </div>
          )}

          {pricing?.models?.length > 0 && (
            <div>
              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr style={{ background: 'rgb(var(--color-surface-container))' }}>
                      <th className="text-left px-4 py-2 text-on-surface-variant/50 font-semibold">Modelo</th>
                      <th className="text-right px-3 py-2 text-on-surface-variant/50 font-semibold">Input /1M tokens</th>
                      <th className="text-right px-3 py-2 text-on-surface-variant/50 font-semibold">Output /1M tokens</th>
                      <th className="text-right px-4 py-2 text-on-surface-variant/50 font-semibold">Contexto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.models.map(m => {
                      const isRec = m.model === recommendedModel
                      return (
                        <tr key={m.model}
                            className="border-t border-outline-variant/20"
                            style={{
                              background: isRec
                                ? 'rgb(var(--color-primary) / 0.06)'
                                : 'transparent',
                            }}>
                          <td className="px-4 py-2.5 flex items-center gap-2">
                            <code className={`font-bold ${isRec ? 'text-primary' : 'text-on-surface/70'}`}>{m.model}</code>
                            {isRec && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgb(var(--color-primary) / 0.15)', color: 'rgb(var(--color-primary))' }}>
                                RECOMENDADO
                              </span>
                            )}
                          </td>
                          <td className={`text-right px-3 py-2.5 tabular-nums ${isRec ? 'text-primary font-bold' : 'text-on-surface/60'}`}>
                            {fmt(m.inputPer1M)}
                          </td>
                          <td className={`text-right px-3 py-2.5 tabular-nums ${isRec ? 'text-primary font-bold' : 'text-on-surface/60'}`}>
                            {fmt(m.outputPer1M)}
                          </td>
                          <td className="text-right px-4 py-2.5 text-on-surface-variant/40 tabular-nums">
                            {m.maxInputTokens ? `${(m.maxInputTokens / 1000).toFixed(0)}k` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant/20">
                <span className="text-[8px] font-mono text-on-surface-variant/30">
                  Fonte: LiteLLM · OpenAI Pricing
                  {pricing.fetchedAt && ` · ${fmtDate(pricing.fetchedAt)}`}
                </span>
                <button
                  onClick={fetchPricing}
                  disabled={loading}
                  className="flex items-center gap-1 text-[8px] font-mono text-primary/50 hover:text-primary transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>refresh</span>
                  Atualizar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Mapeamento para variáveis CSS do tema — funciona em modo claro e escuro
const SEVERITY = {
  critical:   { label: 'Crítico',  colorVar: 'error',    icon: 'error' },
  warning:    { label: 'Aviso',    colorVar: 'tertiary',  icon: 'warning' },
  suggestion: { label: 'Sugestão', colorVar: 'primary',   icon: 'lightbulb' },
}

function getSeverityStyle(key) {
  const cv = (SEVERITY[key] || SEVERITY.suggestion).colorVar
  return {
    label:  (SEVERITY[key] || SEVERITY.suggestion).label,
    icon:   (SEVERITY[key] || SEVERITY.suggestion).icon,
    color:  `rgb(var(--color-${cv}))`,
    bg:     `rgb(var(--color-${cv}) / 0.12)`,
    border: `rgb(var(--color-${cv}) / 0.40)`,
  }
}

function ScoreChip({ score }) {
  const cv  = score >= 80 ? 'secondary' : score >= 60 ? 'tertiary' : 'error'
  const label = score >= 80 ? 'Ótimo' : score >= 60 ? 'Regular' : 'Crítico'
  const color  = `rgb(var(--color-${cv}))`
  const bg     = `rgb(var(--color-${cv}) / 0.12)`
  const border = `rgb(var(--color-${cv}) / 0.35)`
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0 px-3 py-2 rounded-lg border"
         style={{ background: bg, borderColor: border, minWidth: 56 }}>
      <span className="text-[16px] font-mono font-black tabular-nums leading-none" style={{ color }}>{score}</span>
      <span className="text-[8px] font-mono font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  )
}

// Linha de cada problema — gerencia o estado de edição localmente
function IssueRow({ issue, idx, onApplyFix, onDismiss }) {
  const [editing, setEditing] = useState(false)
  const [fixText, setFixText] = useState(issue.fix || '')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)

  const s = getSeverityStyle(issue.severity)

  const handleSend = async () => {
    if (!fixText.trim() || sending) return
    setSendError(null)
    setSending(true)
    try {
      await onApplyFix(fixText.trim(), idx)
      setEditing(false)
    } catch (err) {
      setSendError(err.message || 'Erro ao processar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="px-5 py-4 space-y-3"
      style={{ background: idx % 2 === 0 ? 'var(--color-surface-container)' : 'var(--color-surface-container-high)' }}
    >
      {/* Cabeçalho do problema */}
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15, color: s.color }}>
          {s.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
            {issue.category && (
              <span className="text-[8px] font-mono text-on-surface-variant/50 uppercase tracking-wide">
                {issue.category}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono font-semibold text-on-surface leading-snug mb-1">
            {issue.title}
          </p>
          <p className="text-[10px] font-mono text-on-surface-variant/70 leading-relaxed">
            {issue.description}
          </p>
        </div>
        {/* Botão ignorar */}
        <button
          onClick={() => onDismiss(idx)}
          title="Ignorar este aviso"
          className="flex-shrink-0 text-on-surface-variant/25 hover:text-on-surface-variant/60 transition-colors mt-0.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>

      {/* Área de correção */}
      {issue.fix && (
        <div
          className="ml-5 rounded-lg overflow-hidden transition-all"
          style={{
            background: editing ? s.bg : 'var(--color-surface-container-high)',
            border: editing ? `1.5px solid ${s.border}` : '1px solid rgb(var(--color-outline-variant))',
          }}
        >
          {!editing ? (
            /* — Modo leitura: mostra o texto e botão "Corrigir" — */
            <div className="flex items-start gap-2 px-3 py-2.5">
              <span className="material-symbols-outlined flex-shrink-0 mt-0.5"
                    style={{ fontSize: 12, color: s.color, opacity: 0.6 }}>
                build
              </span>
              <p className="text-[10px] font-mono leading-snug flex-1"
                 style={{ color: 'rgb(var(--color-on-surface-variant))', opacity: 0.8 }}>
                {issue.fix}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setFixText(issue.fix); setEditing(true) }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold transition-all flex-shrink-0 active:scale-95 hover:brightness-110"
                style={{ border: `1px solid ${s.border}`, color: s.color, background: s.bg }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>draw</span>
                Corrigir
              </button>
            </div>
          ) : (
            /* — Modo edição: textarea editável + botões — */
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: s.color }}>stylus</span>
                <p className="text-[9px] font-mono font-semibold uppercase tracking-wider" style={{ color: s.color }}>
                  Edite a correção e envie para a IA
                </p>
              </div>
              <textarea
                rows={3}
                value={fixText}
                onChange={e => setFixText(e.target.value)}
                disabled={sending}
                className="w-full rounded-lg px-3 py-2 text-[11px] font-mono leading-relaxed resize-none focus:outline-none transition-all disabled:opacity-40"
                style={{
                  background: 'rgb(var(--color-surface))',
                  border: `1px solid ${s.border}`,
                  color: 'rgb(var(--color-on-surface))',
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setEditing(false); setSendError(null) }}
                  disabled={sending}
                  className="px-3 py-1.5 rounded text-[10px] font-mono hover:opacity-80 transition-all disabled:opacity-40"
                  style={{
                    border: '1px solid rgb(var(--color-outline-variant))',
                    color: 'rgb(var(--color-on-surface-variant))',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!fixText.trim() || sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                  style={{ border: `1.5px solid ${s.border}`, color: s.color, background: s.bg }}
                >
                  {sending
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>Enviando...</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_fix_high</span>Enviar para IA</>
                  }
                </button>
              </div>
              {sendError && (
                <div className="flex items-start gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 12 }}>error</span>
                  <p className="text-[10px] font-mono text-error leading-snug">{sendError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PromptAuditor({ onAudit, isAuditing, auditResult, aiConfig, onApplyFix, onDismissIssue, prompt, config }) {
  const [expanded, setExpanded] = useState(true)

  if (!auditResult && !isAuditing) {
    return (
      <div className="flex items-center justify-between px-5 py-3 rounded-lg border border-outline-variant/50"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 18 }}>policy</span>
          <div>
            <p className="text-[11px] font-mono font-semibold text-on-surface/70">Auditoria de Prompt</p>
            <p className="text-[10px] font-mono text-on-surface-variant/40">Detecta erros, contradições e conflitos</p>
          </div>
        </div>
        <button
          onClick={onAudit}
          disabled={!aiConfig?.apiKey}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ border: '1.5px solid rgba(96,165,250,0.5)', color: '#60a5fa', background: 'rgba(96,165,250,0.07)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>policy</span>
          Auditar Prompt
        </button>
      </div>
    )
  }

  if (isAuditing) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-lg border border-outline-variant/50"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <span className="material-symbols-outlined animate-spin text-on-surface-variant/50" style={{ fontSize: 18 }}>progress_activity</span>
        <p className="text-[11px] font-mono text-on-surface-variant/50">Analisando o prompt em busca de problemas...</p>
      </div>
    )
  }

  const { issues, overallScore, summary } = auditResult
  const criticals   = issues.filter(i => i.severity === 'critical')
  const warnings    = issues.filter(i => i.severity === 'warning')
  const suggestions = issues.filter(i => i.severity === 'suggestion')

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>

      <div className="h-0.5" style={{
        background: overallScore >= 80
          ? 'linear-gradient(to right, rgba(74,222,128,0.6), rgba(74,222,128,0.1), transparent)'
          : overallScore >= 60
            ? 'linear-gradient(to right, rgba(251,191,36,0.6), rgba(251,191,36,0.1), transparent)'
            : 'linear-gradient(to right, rgba(248,113,113,0.6), rgba(248,113,113,0.1), transparent)',
      }} />

      {/* Header */}
      <div className="px-5 py-3 border-b border-outline-variant flex items-center gap-3 cursor-pointer"
           style={{ background: 'var(--color-surface-container-high)' }}
           onClick={() => setExpanded(v => !v)}>
        <ScoreChip score={overallScore ?? 0} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[12px] font-mono font-semibold text-on-surface">Auditoria de Prompt</p>
            {issues.length === 0 && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                APROVADO
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono text-on-surface-variant/50 leading-snug">{summary}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {criticals.length > 0 && (
              <span className="text-[9px] font-mono font-semibold" style={{ color: '#f87171' }}>
                {criticals.length} crítico{criticals.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-[9px] font-mono font-semibold" style={{ color: '#fbbf24' }}>
                {warnings.length} aviso{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {suggestions.length > 0 && (
              <span className="text-[9px] font-mono font-semibold" style={{ color: '#60a5fa' }}>
                {suggestions.length} sugestão{suggestions.length !== 1 ? 'ões' : ''}
              </span>
            )}
            {issues.length === 0 && (
              <span className="text-[9px] font-mono text-on-surface-variant/40">Nenhum problema encontrado</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onAudit() }}
            disabled={isAuditing}
            className="text-[9px] font-mono text-on-surface-variant/40 hover:text-on-surface-variant transition-colors px-2 py-1 rounded border border-outline-variant/30">
            Reauditar
          </button>
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 16 }}>
            {expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          </span>
        </div>
      </div>

      {/* Problemas */}
      {expanded && issues.length > 0 && (
        <div className="divide-y divide-outline-variant/20">
          {issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} idx={i} onApplyFix={onApplyFix} onDismiss={onDismissIssue} />
          ))}
        </div>
      )}

      {expanded && issues.length === 0 && (
        <div className="px-5 py-6 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#4ade80' }}>verified</span>
            <p className="text-[11px] font-mono text-on-surface-variant/50">Nenhum problema encontrado</p>
          </div>

          {/* Explicação da pontuação quando < 100 */}
          {(overallScore ?? 0) < 100 && (
            <div className="rounded-lg border border-outline-variant/40 px-4 py-3"
                 style={{ background: 'rgb(var(--color-surface-container-high))' }}>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-on-surface-variant/40 flex-shrink-0 mt-0.5" style={{ fontSize: 15 }}>info</span>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono font-semibold text-on-surface/70">
                    Por que {overallScore ?? 0}/100 e não 100?
                  </p>
                  <p className="text-[10px] font-mono text-on-surface-variant/55 leading-relaxed">
                    Nenhum auditor automatizado consegue garantir 100% sem conhecer a fundo o negócio. Os {100 - (overallScore ?? 0)} pontos restantes refletem margem de incerteza sobre especificidades que só você conhece — fluxos operacionais, sazonalidades e casos de borda do seu setor. Não há erros detectáveis no prompt.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recomendações dinâmicas baseadas na complexidade do prompt */}
          {prompt && config && (() => {
            const cx = classifyPromptComplexity(prompt, config)
            const levelColor = `rgb(var(--color-${cx.color}))`
            const levelBg    = `rgb(var(--color-${cx.color}) / 0.10)`
            const levelBdr   = `rgb(var(--color-${cx.color}) / 0.30)`
            return (
              <>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: levelBdr, background: 'rgb(var(--color-surface-container-high))' }}>

                {/* Header com nível de complexidade */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant/30">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: levelColor }}>rocket_launch</span>
                  <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-on-surface-variant/50 flex-1">
                    Configurações Recomendadas para Deploy
                  </p>
                  <span className="text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{ background: levelBg, color: levelColor, border: `1px solid ${levelBdr}` }}>
                    {cx.label}
                  </span>
                </div>

                <div className="px-4 py-3 space-y-3">
                  {/* Modelo */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: `rgb(var(--color-${cx.color}) / 0.12)` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13, color: levelColor }}>memory</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-on-surface-variant/50">Modelo</span>
                        <code className="text-[11px] font-mono font-bold" style={{ color: levelColor }}>{cx.model}</code>
                      </div>
                      <p className="text-[9px] font-mono text-on-surface-variant/45 leading-relaxed mt-0.5">{cx.modelNote}</p>
                    </div>
                  </div>

                  {/* Temperatura */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: `rgb(var(--color-${cx.color}) / 0.12)` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13, color: levelColor }}>thermostat</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-on-surface-variant/50">Temperatura</span>
                        <code className="text-[11px] font-mono font-bold" style={{ color: levelColor }}>{cx.temperature}</code>
                      </div>
                      <p className="text-[9px] font-mono text-on-surface-variant/45 leading-relaxed mt-0.5">{cx.tempNote}</p>
                    </div>
                  </div>

                  {/* Stats do prompt */}
                  <div className="flex items-center gap-3 pt-1 border-t border-outline-variant/20 flex-wrap">
                    {[
                      { icon: 'text_snippet', label: `${cx.stats.charCount.toLocaleString('pt-BR')} chars` },
                      { icon: 'data_object',  label: `${cx.stats.varCount} variáve${cx.stats.varCount !== 1 ? 'is' : 'l'}` },
                      { icon: 'call_split',   label: `${cx.stats.exitCount} saída${cx.stats.exitCount !== 1 ? 's' : ''}` },
                      ...(cx.stats.enumCount > 0 ? [{ icon: 'list', label: `${cx.stats.enumCount} enum${cx.stats.enumCount !== 1 ? 's' : ''}` }] : []),
                    ].map(s => (
                      <span key={s.label} className="flex items-center gap-1 text-[9px] font-mono text-on-surface-variant/35">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{s.icon}</span>
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabela de preços em tempo real */}
              <PricingTable recommendedModel={cx.model} />
              </>
            )
          })()}
        </div>
      )}
    </section>
  )
}
