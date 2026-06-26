import { useState } from 'react'
import { formatTimestamp, deleteSnapshot, clearHistory } from '../../lib/promptHistory'
import { diffLines, diffStats } from '../../lib/promptDiff'

function DiffBadge({ before, after }) {
  if (!before || !after) return null
  const { added, removed } = diffStats(diffLines(before, after))
  if (added === 0 && removed === 0) return (
    <span className="font-mono text-[9px] text-on-surface-variant/40">sem alterações</span>
  )
  return (
    <span className="flex items-center gap-1.5">
      {added > 0 && <span className="font-mono text-[9px] text-secondary font-bold">+{added}</span>}
      {removed > 0 && <span className="font-mono text-[9px] text-error font-bold">-{removed}</span>}
    </span>
  )
}

function summarizeConfigDiff(oldCfg, newCfg) {
  if (!oldCfg || !newCfg) return []
  const changes = []

  const oldDomain = (oldCfg.domain || '').trim()
  const newDomain = (newCfg.domain || '').trim()
  if (oldDomain !== newDomain) {
    const diff = newDomain.length - oldDomain.length
    changes.push({ icon: 'description', text: `Objetivo alterado (${diff > 0 ? '+' : ''}${diff} caracteres)`, type: 'changed' })
  }

  if ((oldCfg.agentPersona || '').trim() !== (newCfg.agentPersona || '').trim()) {
    changes.push({ icon: 'person', text: 'Persona alterada', type: 'changed' })
  }

  const oldVars = (oldCfg.variables || []).map(v => v.name).filter(Boolean)
  const newVars = (newCfg.variables || []).map(v => v.name).filter(Boolean)
  newVars.filter(n => !oldVars.includes(n)).forEach(n =>
    changes.push({ icon: 'add_circle', text: `Campo adicionado: ${n}`, type: 'added' })
  )
  oldVars.filter(n => !newVars.includes(n)).forEach(n =>
    changes.push({ icon: 'remove_circle', text: `Campo removido: ${n}`, type: 'removed' })
  )

  const oldExits = (oldCfg.exitDestinations || []).filter(e => !e.isSystem).map(e => e.key).filter(Boolean)
  const newExits = (newCfg.exitDestinations || []).filter(e => !e.isSystem).map(e => e.key).filter(Boolean)
  newExits.filter(k => !oldExits.includes(k)).forEach(k =>
    changes.push({ icon: 'add_circle', text: `Saída adicionada: ${k}`, type: 'added' })
  )
  oldExits.filter(k => !newExits.includes(k)).forEach(k =>
    changes.push({ icon: 'remove_circle', text: `Saída removida: ${k}`, type: 'removed' })
  )

  return changes
}

export default function PromptVersionPanel({ history, currentPrompt, currentConfig, onRevert, onHistoryChange, agentKey }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmRevertId, setConfirmRevertId] = useState(null)
  const [detailId, setDetailId] = useState(null)

  if (!history || history.length === 0) return null

  const closeConfirms = () => {
    setConfirmDeleteId(null)
    setConfirmRevertId(null)
  }

  const handleRevertRequest = (id) => {
    setConfirmDeleteId(null)
    setConfirmRevertId(id)
  }

  const handleRevertConfirm = (entry) => {
    onRevert(entry)
    setConfirmRevertId(null)
  }

  const handleDeleteRequest = (id) => {
    setConfirmRevertId(null)
    setConfirmDeleteId(id)
  }

  const handleDeleteConfirm = (id) => {
    const updated = deleteSnapshot(id)
    onHistoryChange(updated)
    setConfirmDeleteId(null)
    if (detailId === id) setDetailId(null)
  }

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    const updated = clearHistory(agentKey)
    onHistoryChange(updated)
    setConfirmClear(false)
    setDetailId(null)
  }

  const toggleDetail = (id) => {
    setDetailId(prev => prev === id ? null : id)
    setConfirmDeleteId(null)
    setConfirmRevertId(null)
  }

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>

      <div className="h-0.5 bg-gradient-to-r from-primary/40 via-primary/15 to-transparent" />

      {/* Header */}
      <div className="px-5 py-3 border-b border-outline-variant flex items-center gap-3 cursor-pointer select-none"
           style={{ background: 'var(--color-surface-container-high)' }}
           onClick={() => setExpanded(v => !v)}>
        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>history</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-on-surface leading-none">Histórico de Versões</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
            {history.length} snapshot{history.length !== 1 ? 's' : ''} salvos
          </p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>
          {expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
          {history.map((entry, idx) => {
            const isConfirmingDelete = confirmDeleteId === entry.id
            const isConfirmingRevert = confirmRevertId === entry.id
            const isConfirming = isConfirmingDelete || isConfirmingRevert
            const isShowingDetail = detailId === entry.id

            const changes = isShowingDetail ? summarizeConfigDiff(entry.config, currentConfig) : []

            return (
              <div key={entry.id}
                   className="rounded-lg border overflow-hidden transition-all"
                   style={{
                     borderColor: isConfirmingRevert
                       ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                       : isConfirmingDelete
                         ? 'color-mix(in srgb, var(--color-error) 40%, transparent)'
                         : isShowingDetail
                           ? 'color-mix(in srgb, var(--color-secondary) 35%, transparent)'
                           : 'color-mix(in srgb, var(--color-outline-variant) 50%, transparent)',
                     background: isConfirmingRevert
                       ? 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-container-high))'
                       : isConfirmingDelete
                         ? 'color-mix(in srgb, var(--color-error) 6%, var(--color-surface-container-high))'
                         : 'var(--color-surface-container-high)',
                   }}>

                {/* Linha principal — clicável para ver detalhes */}
                <div
                  className="px-3 py-2.5 flex items-start gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => !isConfirming && toggleDetail(entry.id)}
                >
                  <span className="font-mono text-[9px] text-on-surface-variant/30 mt-0.5 flex-shrink-0 w-4 text-right">
                    {history.length - idx}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-on-surface/80 leading-snug line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-on-surface-variant/40">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <DiffBadge before={entry.prompt} after={currentPrompt} />
                    </div>
                  </div>

                  {/* Botões — ocultos quando há confirmação aberta */}
                  {!isConfirming && (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleRevertRequest(entry.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold transition-all opacity-60 hover:opacity-100 hover:bg-primary/10"
                        style={{ color: 'var(--color-primary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>restore</span>
                        REVERT
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(entry.id)}
                        className="p-1 rounded text-on-surface-variant/25 hover:text-error transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Painel de detalhes — o que mudou desde esta versão */}
                {isShowingDetail && (
                  <div className="border-t px-3 py-3 space-y-2"
                       style={{ borderColor: 'color-mix(in srgb, var(--color-secondary) 20%, transparent)', background: 'color-mix(in srgb, var(--color-secondary) 4%, var(--color-surface-container))' }}>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-on-surface-variant/50 mb-2">
                      O que mudou desde esta versão
                    </p>
                    {changes.length === 0 ? (
                      <p className="text-[10px] font-mono text-on-surface-variant/40 italic">Nenhuma alteração de configuração detectada.</p>
                    ) : (
                      <div className="space-y-1">
                        {changes.map((c, i) => {
                          const colorClass = c.type === 'added' ? 'text-secondary' : c.type === 'removed' ? 'text-error' : 'text-on-surface-variant'
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`material-symbols-outlined flex-shrink-0 ${colorClass}`} style={{ fontSize: 13 }}>
                                {c.icon}
                              </span>
                              <span className={`text-[10px] font-mono font-semibold ${colorClass}`}>
                                {c.text}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmação de revert */}
                {isConfirmingRevert && (
                  <div className="px-3 pb-2.5 pt-2 flex items-center gap-2 border-t"
                       style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
                    <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 13 }}>info</span>
                    <span className="text-[10px] font-mono flex-1" style={{ color: 'var(--color-primary)' }}>
                      Restaurar esta versão? O estado atual será perdido.
                    </span>
                    <button
                      onClick={closeConfirms}
                      className="px-2 py-1 rounded text-[9px] font-mono text-on-surface-variant/60 hover:text-on-surface-variant border border-outline-variant/50 transition-colors">
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleRevertConfirm(entry)}
                      className="px-2 py-1 rounded text-[9px] font-mono font-semibold bg-primary text-on-primary transition-colors hover:opacity-90">
                      Restaurar
                    </button>
                  </div>
                )}

                {/* Confirmação de exclusão */}
                {isConfirmingDelete && (
                  <div className="px-3 pb-2.5 pt-2 flex items-center gap-2 border-t border-error/20">
                    <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 13 }}>warning</span>
                    <span className="text-[10px] font-mono text-error/80 flex-1">
                      Excluir este snapshot permanentemente?
                    </span>
                    <button
                      onClick={closeConfirms}
                      className="px-2 py-1 rounded text-[9px] font-mono text-on-surface-variant/60 hover:text-on-surface-variant border border-outline-variant/50 transition-colors">
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDeleteConfirm(entry.id)}
                      className="px-2 py-1 rounded text-[9px] font-mono font-semibold bg-error text-on-error transition-colors hover:opacity-90">
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={handleClear}
            className={`w-full py-1.5 text-[9px] font-mono transition-all rounded border border-dashed ${
              confirmClear
                ? 'border-error/50 text-error'
                : 'border-outline-variant/30 text-on-surface-variant/30 hover:text-on-surface-variant/50'
            }`}>
            {confirmClear ? 'Clique novamente para confirmar limpeza' : 'LIMPAR HISTÓRICO'}
          </button>
        </div>
      )}
    </section>
  )
}
