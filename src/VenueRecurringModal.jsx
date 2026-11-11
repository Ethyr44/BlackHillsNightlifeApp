import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'
import { parseEventBlackHillsDate, getRecurringPattern } from './utils'

const FREQUENCY_LABELS = {
  weekly: 'Every Week',
  biweekly: 'Every Other Week',
  monthly: 'Once a Month',
}

export default function VenueRecurringModal({
  venue,
  initialSlot,
  currentUser,
  isOwner = false,
  onClose,
  onSaved,
}) {
  const schedule = venue?.schedule || []
  const [selectedIdx, setSelectedIdx] = useState(() => {
    if (!initialSlot || schedule.length === 0) return 0
    const idx = schedule.findIndex(
      s => s.date && initialSlot.date && s.date.toDateString() === initialSlot.date.toDateString()
    )
    return idx >= 0 ? idx : 0
  })

  const activeSlot = schedule[selectedIdx] || initialSlot
  const canManage =
    currentUser?.account_type === 'Admin' ||
    isOwner ||
    Boolean(venue?.owner_id && currentUser?.id === venue.owner_id)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'Karaoke',
    recurring_pattern: 'weekly',
    start_time: '20:00',
    entertainer: '',
    description: '',
  })

  useEffect(() => {
    if (!activeSlot) return
    const ev = activeSlot.event
    if (ev) {
      let timeStr = '20:00'
      if (ev.event_date) {
        const d = parseEventBlackHillsDate(ev.event_date)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        timeStr = `${hh}:${mm}`
      }
      const pat = getRecurringPattern(ev)
      setFormData({
        title: ev.title || '',
        event_type: ev.event_type || 'Karaoke',
        recurring_pattern: pat === 'none' ? 'weekly' : pat,
        start_time: timeStr,
        entertainer: ev.entertainer || '',
        description: ev.description || '',
      })
    } else {
      setFormData({
        title: '',
        event_type: 'Karaoke',
        recurring_pattern: 'weekly',
        start_time: '20:00',
        entertainer: '',
        description: '',
      })
    }
    setIsEditing(false)
  }, [selectedIdx, activeSlot?.event?.id])

  if (!venue || !activeSlot) return null

  const weekdayLong = activeSlot.date
    ? activeSlot.date.toLocaleDateString('en-US', { weekday: 'long' })
    : activeSlot.longDay || activeSlot.day

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a recurring event title.')
      return
    }
    setSaving(true)

    const targetDate = new Date(activeSlot.date || new Date())
    const [hours, minutes] = (formData.start_time || '20:00').split(':').map(n => parseInt(n, 10))
    targetDate.setHours(isNaN(hours) ? 20 : hours, isNaN(minutes) ? 0 : minutes, 0, 0)

    const pattern = formData.recurring_pattern || 'weekly'
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      event_type: formData.event_type,
      entertainer: formData.entertainer.trim(),
      venue: venue.name,
      address: venue.address || '',
      event_date: targetDate.toISOString(),
      recurring_pattern: pattern,
      recurring_weekly: pattern === 'weekly',
      status: 'approved',
    }

    if (activeSlot.event?.id) {
      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', activeSlot.event.id)
        .select()
        .maybeSingle()

      if (error) {
        toast.error(`Error updating recurring event: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('Recurring event updated!')
      if (onSaved) onSaved(data || { ...activeSlot.event, ...payload }, null, activeSlot.date)
    } else {
      const { data, error } = await supabase
        .from('events')
        .insert([payload])
        .select()
        .maybeSingle()

      if (error) {
        toast.error(`Error creating recurring event: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('Recurring event created!')
      if (onSaved) onSaved(data || payload, null, activeSlot.date)
    }

    setSaving(false)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!activeSlot.event?.id) return
    if (!window.confirm(`Remove "${activeSlot.event.title}" from ${venue.name}'s recurring schedule?`)) return

    setSaving(true)
    const { error } = await supabase.from('events').delete().eq('id', activeSlot.event.id)
    if (error) {
      toast.error(`Error deleting recurring event: ${error.message}`)
      setSaving(false)
      return
    }
    toast.success('Recurring event deleted.')
    if (onSaved) onSaved(null, activeSlot.event.id, activeSlot.date)
    setSaving(false)
    setIsEditing(false)
  }

  const ev = activeSlot.event
  const evPattern = ev ? getRecurringPattern(ev) : 'weekly'
  const formattedTime = ev?.event_date
    ? parseEventBlackHillsDate(ev.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{
          background: 'rgba(10,18,40,0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  🔁 Recurring Events Tracker
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {venue.name}
              </h3>
              <p className="text-xs text-white/40 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                Every {weekdayLong} ({activeSlot.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              ✕
            </button>
          </div>

          {/* 7-Day Switcher Strip */}
          {schedule.length > 0 && (
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.06] overflow-x-auto hide-scrollbar">
              {schedule.map((slot, idx) => {
                const isSelected = idx === selectedIdx
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`flex-1 min-w-[44px] py-1.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all border ${
                      isSelected
                        ? 'bg-[#4f8cff]/20 border-[#4f8cff]/60 text-white shadow-[0_0_12px_rgba(79,140,255,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/45 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider">{slot.day}</span>
                    <span className="text-base leading-none">
                      {slot.event
                        ? EVENT_EMOJIS[slot.event.event_type] || EVENT_EMOJIS['General']
                        : <span className="opacity-25 text-xs">—</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                  Recurring Event Title *
                </label>
                <input
                  type="text"
                  placeholder={`e.g. ${weekdayLong} Night Karaoke`}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                    Event Type
                  </label>
                  <select
                    value={formData.event_type}
                    onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none bg-[#0b1326] border border-white/15"
                  >
                    {Object.keys(EVENT_EMOJIS).map(t => (
                      <option key={t} value={t} className="bg-[#0b1326] text-white">
                        {EVENT_EMOJIS[t]} {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.recurring_pattern}
                    onChange={e => setFormData({ ...formData, recurring_pattern: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none bg-[#0b1326] border border-white/15"
                  >
                    <option value="weekly" className="bg-[#0b1326] text-white">Every Week</option>
                    <option value="biweekly" className="bg-[#0b1326] text-white">Every Other Week</option>
                    <option value="monthly" className="bg-[#0b1326] text-white">Once a Month</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                    Host / Entertainer
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.entertainer}
                    onChange={e => setFormData({ ...formData, entertainer: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1">
                  Description / Specials
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Details, drink specials, sign-up times..."
                  className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/60 border border-white/10 hover:bg-white/[0.05] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #4f8cff, #2463d4)' }}
                >
                  {saving ? 'Saving...' : 'Save Recurring Event'}
                </button>
              </div>

              {ev?.id && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDelete}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(245,85,122,0.12)',
                    border: '1px solid rgba(245,85,122,0.3)',
                    color: '#f5557a',
                  }}
                >
                  🗑️ Delete Recurring Event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {ev ? (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none mt-0.5">
                      {EVENT_EMOJIS[ev.event_type] || '🗓️'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-white leading-snug">
                        {ev.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#4f8cff]/15 text-[#4f8cff] border border-[#4f8cff]/30">
                          {ev.event_type}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          🔁 {FREQUENCY_LABELS[evPattern] || 'Every Week'} • {weekdayLong}s
                        </span>
                        {formattedTime && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/[0.06] text-white/70">
                            🕗 {formattedTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {ev.entertainer && (
                    <p className="text-xs text-cyan-300 font-semibold">
                      🎤 Hosted / Performed by: <span className="text-white">{ev.entertainer}</span>
                    </p>
                  )}

                  {ev.description && (
                    <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap pt-1 border-t border-white/[0.06]">
                      {ev.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                  <span className="text-3xl opacity-30 block mb-2">🔁</span>
                  <p className="text-xs text-white/40 font-medium">
                    No recurring event scheduled for {weekdayLong}s at {venue.name}.
                  </p>
                </div>
              )}

              {canManage && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: 'linear-gradient(135deg, rgba(79,140,255,0.2), rgba(168,85,247,0.2))',
                      border: '1px solid rgba(79,140,255,0.4)',
                      color: '#fff',
                    }}
                  >
                    {ev ? `✏️ Edit ${weekdayLong} Recurring Event` : `+ Create ${weekdayLong} Recurring Event`}
                  </button>
                  {ev?.id && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDelete}
                      className="w-full py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all text-[#f5557a] bg-[#f5557a]/10 border border-[#f5557a]/25 hover:bg-[#f5557a]/20"
                    >
                      🗑️ Delete Recurring Event
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
