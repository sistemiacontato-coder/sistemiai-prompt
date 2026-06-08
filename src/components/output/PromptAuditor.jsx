import { useState } from 'react'

const SEVERITY = {
  critical:   { label: 'Crítico',  color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)', icon: 'error' },
  warning:    { label: 'Aviso',    color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.35)',  icon: 'warning' },
  suggestion: { label: 'Sugestão', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.35)',  icon: 'lightbulb' },
}

function ScoreRing({ score }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#f87171'
  return (
    <div className="relative flex items-center justify-center w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <span className="absolute text-[13px] font-mono font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

// Linha de cada problema — gerencia o estado de edição localmente
function IssueRow({ issue, idx, onApplyFix }) {
  const [editing, setEditing] = useState(false)
  const [fixText, setFixText] = useState(issue.fix || '')
  const [sending, setSending] = useState(false)

  const s = SEVERITY[issue.severity] || SEVERITY.suggestion

  const handleSend = async () => {
    if (!fixText.trim() || sending) return
    setSending(true)
    try {
      await onApplyFix(fixText.trim())
      setEditing(false)
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
              <span className="text-[8px] font-mono text-on-surface-variant/40 uppercase tracking-wide">
                {issue.category}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono font-semibold text-on-surface/90 leading-snug mb-1">
            {issue.title}
          </p>
          <p className="text-[10px] font-mono text-on-surface-variant/60 leading-relaxed">
            {issue.description}
          </p>
        </div>
      </div>

      {/* Área de correção */}
      {issue.fix && (
        <div className="ml-5 rounded-lg overflow-hidden"
             style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>

          {!editing ? (
            /* — Modo leitura: mostra o texto e botão "Corrigir" — */
            <div className="flex items-start gap-2 px-3 py-2.5">
              <span className="material-symbols-outlined text-on-surface-variant/30 flex-shrink-0 mt-0.5" style={{ fontSize: 12 }}>
                build
              </span>
              <p className="text-[10px] font-mono text-on-surface-variant/50 leading-snug flex-1">
                {issue.fix}
              </p>
              <button
                onClick={() => { setFixText(issue.fix); setEditing(true) }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold transition-all flex-shrink-0 active:scale-95"
                style={{ border: `1px solid ${s.border}`, color: s.color, background: s.bg }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>edit</span>
                Corrigir
              </button>
            </div>
          ) : (
            /* — Modo edição: textarea editável + botões — */
            <div className="p-3 space-y-2">
              <p className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-wider">
                Edite a instrução de correção antes de enviar
              </p>
              <textarea
                rows={3}
                value={fixText}
                onChange={e => setFixText(e.target.value)}
                disabled={sending}
                autoFocus
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-[11px] font-mono text-on-surface leading-relaxed resize-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 focus:outline-none transition-all disabled:opacity-40"
                style={{ background: 'var(--color-surface-container)' }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  disabled={sending}
                  className="px-3 py-1.5 rounded text-[10px] font-mono text-on-surface-variant/50 hover:text-on-surface-variant border border-outline-variant/40 transition-all disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!fixText.trim() || sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ border: `1.5px solid ${s.border}`, color: s.color, background: s.bg }}
                >
                  {sending
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>Enviando...</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_fix_high</span>Enviar para IA</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PromptAuditor({ onAudit, isAuditing, auditResult, aiConfig, onApplyFix }) {
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
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>shield_check</span>
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
        <ScoreRing score={overallScore ?? 0} />

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
            <IssueRow key={i} issue={issue} idx={i} onApplyFix={onApplyFix} />
          ))}
        </div>
      )}

      {expanded && issues.length === 0 && (
        <div className="px-5 py-8 flex flex-col items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#4ade80' }}>verified</span>
          <p className="text-[11px] font-mono text-on-surface-variant/50">Nenhum problema encontrado</p>
        </div>
      )}
    </section>
  )
}
