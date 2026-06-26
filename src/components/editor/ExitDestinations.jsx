import { useState, useEffect } from 'react'

let nextExitId = 20
const MAX_CHARS = 20
const PREFIX = 'saida_'

const STATUS_STYLE = {
  in_process:      { dot: 'bg-primary',         text: 'text-primary',         border: 'border-primary/25',   accentVar: '--color-primary' },
  success:         { dot: 'bg-secondary',        text: 'text-secondary',       border: 'border-secondary/25', accentVar: '--color-secondary' },
  saida_atendente: { dot: 'bg-tertiary',         text: 'text-tertiary',        border: 'border-tertiary/25',  accentVar: '--color-tertiary' },
}

function getStyle(key) {
  return STATUS_STYLE[key] || {
    dot: 'bg-on-surface-variant',
    text: 'text-on-surface',
    border: 'border-outline-variant',
    accentVar: '--color-on-surface-variant',
  }
}

function SystemBadge({ exit }) {
  const s = getStyle(exit.key)
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${s.border} text-[11px] font-mono font-semibold ${s.text}`}
         style={{ background: `color-mix(in srgb, var(${s.accentVar}) 8%, transparent)` }}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {exit.key}
    </div>
  )
}

function ExitCard({ exit, editable, onChange, onDelete, onGenerateMessage, isGeneratingMessage, aiAvailable }) {
  const s = getStyle(exit.key)
  const charCount = exit.key.length
  const isOver = charCount > MAX_CHARS
  const namePart = exit.key.startsWith(PREFIX) ? exit.key.slice(PREFIX.length) : exit.key

  const [descDraft, setDescDraft] = useState(exit.description || '')
  const [msgDraft, setMsgDraft] = useState(exit.exitMessage || '')

  useEffect(() => { setDescDraft(exit.description || '') }, [exit.description])
  useEffect(() => { setMsgDraft(exit.exitMessage || '') }, [exit.exitMessage])

  const descDirty = descDraft !== (exit.description || '')
  const msgDirty = msgDraft !== (exit.exitMessage || '')
  const hasDraft = descDirty || msgDirty

  const handleKeyChange = (val) => {
    const slug = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const full = PREFIX + slug
    const autoLabel = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (full.length <= MAX_CHARS) onChange({ ...exit, key: full, label: autoLabel || exit.label })
  }

  const handleSave = () => onChange({ ...exit, description: descDraft, exitMessage: msgDraft })
  const handleCancel = () => { setDescDraft(exit.description || ''); setMsgDraft(exit.exitMessage || '') }

  return (
    <div className={`rounded-lg border ${s.border} overflow-hidden transition-all`}
         style={{ background: 'var(--color-surface-container-high)' }}>

      <div className="flex">
        <div className="w-0.5 flex-shrink-0" style={{ background: `var(${s.accentVar})`, opacity: 0.5 }} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />

            {editable && !exit.isDefault ? (
              <div className="flex items-center flex-1 min-w-0 gap-1">
                <span className="font-mono text-[11px] text-on-surface-variant/40 flex-shrink-0">{PREFIX}</span>
                <input
                  type="text"
                  value={namePart}
                  onChange={e => handleKeyChange(e.target.value)}
                  placeholder="nome_saida"
                  className={`flex-1 min-w-0 bg-transparent font-mono text-sm font-semibold focus:outline-none
                    ${isOver ? 'text-error' : s.text} placeholder:text-on-surface-variant/25 placeholder:font-normal`}
                />
              </div>
            ) : (
              <code className={`flex-1 font-mono text-sm font-semibold ${s.text}`}>{exit.key}</code>
            )}

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`font-mono text-[10px] tabular-nums ${isOver ? 'text-error font-bold' : 'text-on-surface-variant/35'}`}>
                {charCount} / {MAX_CHARS}
              </span>
              {onDelete && (
                <button onClick={onDelete} className="text-on-surface-variant/30 hover:text-error transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              )}
            </div>
          </div>

          {/* Descrição */}
          {editable ? (
            <textarea
              rows={3}
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              placeholder="Interrompa a IA quando o cliente..."
              className="w-full bg-transparent px-4 py-3 text-[12px] font-mono text-on-surface/75 placeholder:text-on-surface-variant/25 focus:outline-none resize-none leading-relaxed"
            />
          ) : exit.description ? (
            <p className="px-4 py-3 text-[12px] font-mono text-on-surface-variant/50 leading-relaxed">{exit.description}</p>
          ) : null}

          {/* Mensagem de saída */}
          {editable && (
            <div className="border-t border-outline-variant/40 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...exit, sendExitMessage: !exit.sendExitMessage })}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
                    exit.sendExitMessage ? 'bg-primary' : 'bg-outline-variant'
                  }`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    exit.sendExitMessage ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-[10px] font-mono text-on-surface-variant/60">Mensagem de saída</span>
              </div>

              {exit.sendExitMessage && (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={msgDraft}
                    onChange={e => setMsgDraft(e.target.value)}
                    placeholder="Mensagem enviada ao cliente ao acionar esta saída..."
                    className="w-full rounded-lg border border-outline-variant px-3 py-2 text-[12px] font-mono text-on-surface/80 placeholder:text-on-surface-variant/25 focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none resize-none leading-relaxed transition-all"
                    style={{ background: 'var(--color-surface-container)' }}
                  />
                  <button
                    type="button"
                    onClick={onGenerateMessage}
                    disabled={isGeneratingMessage || !aiAvailable}
                    className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                      color: 'var(--color-primary)',
                    }}>
                    {isGeneratingMessage
                      ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>
                      : <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>}
                    {isGeneratingMessage ? 'Gerando...' : exit.exitMessage?.trim() ? 'Regenerar' : 'Gerar com IA'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Salvar / Cancelar — sempre visível quando editável */}
          {editable && (
            <div className="border-t border-outline-variant/40 px-4 py-2.5 flex items-center justify-end gap-2">
              <button onClick={handleCancel} disabled={!hasDraft}
                className="px-3 py-1 rounded text-[10px] font-mono border border-outline-variant/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-on-surface-variant/60 hover:text-on-surface-variant">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!hasDraft}
                className="flex items-center gap-1 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-primary text-on-primary hover:opacity-90">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExitDestinations({ config, setConfig, pendingChanges, aiConfig, generatingExitId, onGenerateExitMessage, hasGeneratedPrompt, onRegeneratePrompt }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)

  const systemExits  = config.exitDestinations.filter(e => e.isSystem)
  const defaultExits = config.exitDestinations.filter(e => e.isDefault)
  const customExits  = config.exitDestinations.filter(e => !e.isSystem && !e.isDefault)

  const updateExit = (id, updated) =>
    setConfig(prev => ({ ...prev, exitDestinations: prev.exitDestinations.map(e => e.id === id ? updated : e) }))

  const removeExit = (id) => {
    setConfig(prev => ({ ...prev, exitDestinations: prev.exitDestinations.filter(e => e.id !== id) }))
    setConfirmDeleteId(null)
    if (hasGeneratedPrompt) onRegeneratePrompt?.()
  }

  const handleDeleteRequest = (id) => {
    if (!hasGeneratedPrompt) { removeExit(id); return }
    setConfirmDeleteId(id)
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBatchDelete = () => {
    if (!confirmBatchDelete) { setConfirmBatchDelete(true); return }
    setConfig(prev => ({
      ...prev,
      exitDestinations: prev.exitDestinations.filter(e => !selectedIds.has(e.id)),
    }))
    setSelectedIds(new Set())
    setSelectionMode(false)
    setConfirmBatchDelete(false)
    if (hasGeneratedPrompt) onRegeneratePrompt?.()
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setConfirmBatchDelete(false)
  }

  const addExit = () => {
    setConfig(prev => ({
      ...prev,
      exitDestinations: [...prev.exitDestinations, {
        id: nextExitId++, key: 'saida_', label: 'Nova Saída', description: '', isDefault: false, isSystem: false,
        sendExitMessage: true, exitMessage: '',
      }],
    }))
  }

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
      <div className="h-0.5 bg-gradient-to-r from-tertiary/60 via-tertiary/20 to-transparent" />

      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>account_tree</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface leading-none">Saídas Condicionais</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Transferências e encerramentos do fluxo</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-on-surface-variant/50">
            {config.exitDestinations.filter(e => !e.isSystem).length} saídas
          </span>
          {customExits.length > 1 && !pendingChanges && (
            selectionMode ? (
              <>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                      confirmBatchDelete
                        ? 'bg-error text-white'
                        : 'border border-error/50 text-error hover:bg-error/10'
                    }`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete_sweep</span>
                    {confirmBatchDelete ? 'Confirmar exclusão' : `Excluir ${selectedIds.size}`}
                  </button>
                )}
                <button
                  onClick={exitSelectionMode}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-outline-variant/50 text-[10px] font-mono text-on-surface-variant/60 hover:text-on-surface-variant transition-all">
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant/60 hover:border-error/50 hover:text-error transition-all text-[11px] font-mono font-semibold">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>checklist</span>
                SELECIONAR
              </button>
            )
          )}
          {!selectionMode && (
            <button onClick={addExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-all text-[11px] font-mono font-semibold">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              ADICIONAR
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">

        {/* Sistema */}
        <div>
          <p className="label-caps text-[9px] mb-2.5 opacity-35">ESTADOS DO SISTEMA</p>
          <div className="flex flex-wrap gap-2">
            {systemExits.map(e => <SystemBadge key={e.id} exit={e} />)}
          </div>
        </div>

        {/* Padrão — mark pending removals */}
        <div>
          <p className="label-caps text-[9px] mb-2.5 opacity-35">SAÍDAS PADRÃO — Spec. § 4.4 / § 4.5</p>
          <div className="space-y-3">
            {defaultExits.map(e => {
              const isPendingRemoval = pendingChanges?.remove_exits?.includes(e.key)
              return (
                <div key={e.id} className={isPendingRemoval ? 'opacity-60' : ''}>
                  <ExitCard exit={e} editable={!isPendingRemoval} onChange={updated => updateExit(e.id, updated)}
                    onGenerateMessage={() => onGenerateExitMessage?.(e.id)}
                    isGeneratingMessage={generatingExitId === e.id}
                    aiAvailable={!!aiConfig?.apiKey} />
                  {isPendingRemoval && (
                    <p className="text-[10px] font-mono text-error/70 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>remove_circle</span>
                      Será removida ao aplicar as mudanças
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Personalizadas */}
        <div>
          <p className="label-caps text-[9px] mb-2.5 opacity-35">SAÍDAS PERSONALIZADAS</p>
          {customExits.length === 0 && !pendingChanges?.add_exits?.length ? (
            <button onClick={!pendingChanges ? addExit : undefined}
              className="w-full py-6 border-2 border-dashed border-outline-variant/40 rounded-lg flex flex-col items-center gap-2 text-on-surface-variant/35 hover:border-primary/40 hover:text-primary/50 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>add_road</span>
              <span className="label-caps text-[9px]">Adicionar transferência entre agentes</span>
            </button>
          ) : (
            <div className="space-y-3">
              {customExits.map(e => {
                const isPendingRemoval = pendingChanges?.remove_exits?.includes(e.key)
                const isConfirming = confirmDeleteId === e.id
                const isSelected = selectedIds.has(e.id)
                return (
                  <div key={e.id} className={`flex items-start gap-2 ${isPendingRemoval ? 'relative' : ''}`}>
                    {/* Checkbox no modo seleção */}
                    {selectionMode && !isPendingRemoval && (
                      <button
                        onClick={() => toggleSelect(e.id)}
                        className={`mt-3 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-error border-error'
                            : 'border-outline-variant hover:border-error/60'
                        }`}>
                        {isSelected && <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                    <ExitCard exit={e} editable={!isPendingRemoval && !isConfirming && !selectionMode}
                      onChange={!isPendingRemoval && !isConfirming && !selectionMode ? updated => updateExit(e.id, updated) : undefined}
                      onDelete={!isPendingRemoval && !isConfirming && !selectionMode ? () => handleDeleteRequest(e.id) : undefined}
                      onGenerateMessage={() => onGenerateExitMessage?.(e.id)}
                      isGeneratingMessage={generatingExitId === e.id}
                      aiAvailable={!!aiConfig?.apiKey}
                    />

                    {/* Confirmação de exclusão inline */}
                    {isConfirming && (
                      <div className="mt-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-error/40"
                           style={{ background: 'rgb(var(--color-error) / 0.08)' }}>
                        <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
                        <p className="text-[10px] font-mono text-error flex-1 leading-snug">
                          Excluir esta saída e regenerar o prompt?
                        </p>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded text-[9px] font-mono text-on-surface-variant hover:text-on-surface border border-outline-variant transition-colors">
                          Cancelar
                        </button>
                        <button
                          onClick={() => removeExit(e.id)}
                          className="px-2 py-1 rounded text-[9px] font-mono font-semibold text-white transition-colors"
                          style={{ background: 'rgb(var(--color-error))' }}>
                          Excluir e Regenerar
                        </button>
                      </div>
                    )}

                    {isPendingRemoval && (
                      <div className="absolute inset-0 rounded-lg border-2 border-dashed border-error/50 flex items-center justify-center pointer-events-none"
                           style={{ background: 'color-mix(in srgb, var(--color-error) 8%, transparent)' }}>
                        <span className="text-[10px] font-mono font-bold text-error flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>remove_circle</span>
                          REMOVER
                        </span>
                      </div>
                    )}
                    </div>
                  </div>
                )
              })}

              {/* Saídas propostas pela IA */}
              {pendingChanges?.add_exits?.length > 0 && (
                <>
                  <p className="label-caps text-[9px] text-secondary/60 pt-1">PROPOSTO PELA IA</p>
                  {pendingChanges.add_exits.map((e, i) => {
                    const s = getStyle(e.key)
                    return (
                      <div key={`proposed-exit-${i}`}
                        className="rounded-lg border-2 border-dashed overflow-hidden"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-secondary) 50%, transparent)',
                          background: 'color-mix(in srgb, var(--color-secondary) 5%, var(--color-surface-container-high))',
                        }}>
                        <div className="flex">
                          <div className="w-0.5 flex-shrink-0"
                               style={{ background: 'rgb(var(--color-secondary))', opacity: 0.5 }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/40">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-secondary/60" />
                              <code className="flex-1 font-mono text-sm font-semibold text-secondary">{e.key}</code>
                              <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--color-secondary) 20%, transparent)', color: 'var(--color-secondary)' }}>
                                + NOVO
                              </span>
                            </div>
                            {e.description && (
                              <p className="px-4 py-3 text-[12px] font-mono text-secondary/60 leading-relaxed">{e.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {!pendingChanges && (
                <button onClick={addExit}
                  className="w-full py-2.5 border border-dashed border-outline-variant/40 rounded-lg flex items-center justify-center gap-2 text-on-surface-variant/35 hover:border-primary/40 hover:text-primary/50 transition-all text-[11px] font-mono">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  ADICIONAR SAÍDA
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] font-mono text-on-surface-variant/30 mt-2.5">
            Formato: <code>saida_nome</code> — máx. {MAX_CHARS} chars.
          </p>
        </div>

      </div>
    </section>
  )
}
