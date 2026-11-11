import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'
import {
  getBlackHillsDate,
  parseEventBlackHillsDate,
  doesEventOccurOnDate,
  getEventCategory,
  getRecurringPattern,
  isRecurringEvent,
} from './utils'

const CATEGORY_FILTERS = ['All', 'Recurring', 'Non-Recurring', 'Special']
const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  monthly: 'Monthly',
}

export default function Events({ currentUser, onViewEntity }) {
  const [events, setEvents] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [eventTypeFilter, setEventTypeFilter] = useState('All')

  const [currentDate, setCurrentDate] = useState(() => getBlackHillsDate())
  const [selectedDayDate, setSelectedDayDate] = useState(null)

  // Create / Edit Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    category: 'Non-Recurring', // 'Recurring' | 'Non-Recurring' | 'Special'
    recurring_pattern: 'weekly', // 'weekly' | 'biweekly' | 'monthly'
    venue: '',
    address: '',
    entertainer: '',
    event_type: 'Karaoke',
    event_date: '',
    points_awarded: 500,
    description: '',
  })

  const canCreateEvents =
    currentUser?.account_type === 'Admin' ||
    currentUser?.account_type === 'Venue' ||
    currentUser?.account_type === 'Host'

  const canManageEvent = (ev) => {
    if (!currentUser) return false
    if (currentUser.account_type === 'Admin') return true
    if (ev?.host_id && ev.host_id === currentUser.id) return true
    if (ev?.created_by && ev.created_by === currentUser.id) return true
    const matchedVenue = venues.find(
      v => (v.name || '').trim().toLowerCase() === (ev?.venue || '').trim().toLowerCase()
    )
    if (matchedVenue?.owner_id && matchedVenue.owner_id === currentUser.id) return true
    return false
  }

  const fetchData = async () => {
    setLoading(true)
    const [{ data: eventData }, { data: venueData }] = await Promise.all([
      supabase.from('events').select('*').eq('status', 'approved'),
      supabase.from('pages').select('*').eq('page_type', 'Venue').order('name', { ascending: true }),
    ])
    if (eventData) setEvents(eventData)
    if (venueData) setVenues(venueData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  // Format Date object for HTML datetime-local input
  const formatForDateTimeInput = (dateInput) => {
    const d = dateInput instanceof Date ? new Date(dateInput) : parseEventBlackHillsDate(dateInput)
    if (isNaN(d.getTime())) return ''
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Get all events (Recurring, Non-Recurring, Special) for a given JS Date object
  const getEventsForDate = (dateObj) => {
    const matched = events
      .filter(e => doesEventOccurOnDate(e, dateObj))
      .map(e => ({
        ...e,
        category: getEventCategory(e),
        isRecurring: isRecurringEvent(e),
        pattern: getRecurringPattern(e),
      }))

    return matched.filter(e => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false
      if (eventTypeFilter !== 'All' && e.event_type !== eventTypeFilter) return false
      return true
    })
  }

  const handleDayClick = (day) => {
    const targetDate = new Date(year, month, day)
    setSelectedDayDate(targetDate)
  }

  const openCreateModal = (defaultDateObj = null) => {
    const baseDate = defaultDateObj ? new Date(defaultDateObj) : getBlackHillsDate()
    baseDate.setHours(20, 0, 0, 0)
    const defaultVenue = venues[0] || null

    setEditingEventId(null)
    setFormData({
      title: '',
      category: categoryFilter !== 'All' ? categoryFilter : 'Non-Recurring',
      recurring_pattern: 'weekly',
      venue: defaultVenue?.name || '',
      address: defaultVenue?.address || '',
      entertainer: '',
      event_type: eventTypeFilter !== 'All' ? eventTypeFilter : 'Karaoke',
      event_date: formatForDateTimeInput(baseDate),
      points_awarded: 500,
      description: '',
    })
    setIsEditorOpen(true)
  }

  const openEditModal = (ev) => {
    const cat = getEventCategory(ev)
    const pat = getRecurringPattern(ev)
    setEditingEventId(ev.id)
    setFormData({
      title: ev.title || '',
      category: cat,
      recurring_pattern: pat === 'none' ? 'weekly' : pat,
      venue: ev.venue || '',
      address: ev.address || '',
      entertainer: ev.entertainer || '',
      event_type: ev.event_type || 'Karaoke',
      event_date: formatForDateTimeInput(ev.event_date),
      points_awarded: ev.points_awarded || 500,
      description: ev.description || '',
    })
    setIsEditorOpen(true)
  }

  const handleVenueChange = (venueName) => {
    const matchedVenue = venues.find(v => v.name === venueName)
    setFormData(prev => ({
      ...prev,
      venue: venueName,
      address: matchedVenue?.address || prev.address,
    }))
  }

  const handleSaveEvent = async () => {
    if (!formData.title.trim() || !formData.venue || !formData.event_date) {
      toast.error('Title, Venue, and Date/Time are required.')
      return
    }
    setSaving(true)

    let resolvedPattern = 'none'
    let resolvedWeekly = false
    if (formData.category === 'Recurring') {
      resolvedPattern = formData.recurring_pattern || 'weekly'
      resolvedWeekly = resolvedPattern === 'weekly'
    } else if (formData.category === 'Special') {
      resolvedPattern = 'special'
      resolvedWeekly = false
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      venue: formData.venue,
      address: formData.address.trim(),
      entertainer: formData.entertainer.trim(),
      event_type: formData.event_type,
      event_date: new Date(formData.event_date).toISOString(),
      points_awarded: Number(formData.points_awarded) || 500,
      recurring_pattern: resolvedPattern,
      recurring_weekly: resolvedWeekly,
      status: 'approved',
    }

    if (editingEventId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
      if (error) {
        toast.error(`Error updating event: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('Event updated!')
    } else {
      const { error } = await supabase.from('events').insert([payload])
      if (error) {
        toast.error(`Error creating event: ${error.message}`)
        setSaving(false)
        return
      }
      toast.success('Event created!')
    }

    setSaving(false)
    setIsEditorOpen(false)
    setEditingEventId(null)
    await fetchData()
  }

  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (!eventId) return
    if (!window.confirm(`Delete "${eventTitle || 'this event'}" from the calendar?`)) return

    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) {
      toast.error(`Error deleting event: ${error.message}`)
      return
    }
    toast.success('Event deleted.')
    setIsEditorOpen(false)
    setEditingEventId(null)
    await fetchData()
  }

  const selectedDayEventsList = selectedDayDate ? getEventsForDate(selectedDayDate) : []
  const todayBh = getBlackHillsDate()

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      {/* Header + Create Button */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-4xl sm:text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] leading-none">
            EVENT CALENDAR
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            Recurring • Non-Recurring • Special Events
          </p>
        </div>

        {canCreateEvents && (
          <button
            type="button"
            onClick={() => openCreateModal(selectedDayDate || todayBh)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #4f8cff, #2463d4)',
              boxShadow: '0 4px 16px rgba(79,140,255,0.35)',
            }}
          >
            + Create Event
          </button>
        )}
      </div>

      {/* Category Filter Row (All / Recurring / Non-Recurring / Special) */}
      <div className="grid grid-cols-4 gap-1.5 bg-[#090812] p-1.5 rounded-xl border border-gray-800 mb-3">
        {CATEGORY_FILTERS.map(cat => {
          const active = categoryFilter === cat
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all truncate ${
                active
                  ? cat === 'Recurring'
                    ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.5)]'
                    : cat === 'Special'
                    ? 'bg-[#ff2d78] text-white shadow-[0_0_12px_rgba(255,45,120,0.5)]'
                    : 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Event Type Filter Row */}
      <div className="flex gap-1.5 bg-[#090812] p-1.5 rounded-xl border border-gray-800 shadow-inner mb-5 overflow-x-auto hide-scrollbar">
        {['All', ...Object.keys(EVENT_EMOJIS)].map(type => (
          <button
            key={type}
            onClick={() => setEventTypeFilter(type)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
              eventTypeFilter === type
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {type !== 'All' ? `${EVENT_EMOJIS[type]} ${type}` : 'All Types'}
          </button>
        ))}
      </div>

      {/* Month Selector */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-t-2xl flex justify-between items-center">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="text-gray-400 hover:text-white px-4 py-2 font-bold transition-transform active:scale-95"
        >
          ❮
        </button>
        <h3 className="text-2xl font-bold text-white tracking-wide">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="text-gray-400 hover:text-white px-4 py-2 font-bold transition-transform active:scale-95"
        >
          ❯
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-black border border-t-0 border-gray-800 p-4 rounded-b-2xl shadow-xl">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {[...Array(firstDay)].map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1
            const targetDate = new Date(year, month, day)
            const isToday = todayBh.toDateString() === targetDate.toDateString()
            const dayEvents = getEventsForDate(targetDate)
            const hasRecurring = dayEvents.some(e => e.category === 'Recurring')
            const hasNonRecurring = dayEvents.some(e => e.category === 'Non-Recurring')
            const hasSpecial = dayEvents.some(e => e.category === 'Special')

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                  isToday
                    ? 'bg-blue-900/30 border border-blue-500 text-blue-400'
                    : 'bg-gray-900/50 text-gray-300 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <span className="font-bold text-sm">{day}</span>
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-1.5 flex items-center gap-1">
                    {hasSpecial && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff2d78] shadow-[0_0_6px_rgba(255,45,120,0.9)]" />
                    )}
                    {hasNonRecurring && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
                    )}
                    {hasRecurring && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.9)]" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-900 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" /> Recurring
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Non-Recurring
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ff2d78]" /> Special
          </span>
        </div>
      </div>

      {/* Daily Lineup Modal */}
      {selectedDayDate && (
        <div
          onClick={() => setSelectedDayDate(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#090812] w-full sm:max-w-md max-h-[82vh] overflow-y-auto rounded-3xl border border-gray-800 p-6 relative pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] hide-scrollbar"
          >
            <button
              onClick={() => setSelectedDayDate(null)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white font-bold text-xl transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center justify-between pr-8 mb-4">
              <div>
                <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-widest leading-none">
                  Daily Lineup
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  {selectedDayDate.toDateString()}
                </p>
              </div>
              {canCreateEvents && (
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedDayDate)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  + Add Event
                </button>
              )}
            </div>

            <div className="space-y-4">
              {selectedDayEventsList.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl">
                  <span className="text-3xl opacity-50 block mb-2">🗓️</span>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                    No events scheduled for this day.
                  </p>
                  {canCreateEvents && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(selectedDayDate)}
                      className="mt-4 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600/30 transition-all"
                    >
                      + Schedule an Event Here
                    </button>
                  )}
                </div>
              ) : (
                selectedDayEventsList.map(event => {
                  const eTime = parseEventBlackHillsDate(event.event_date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const editable = canManageEvent(event)

                  return (
                    <div key={event.id} className="bg-black border border-gray-800 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{EVENT_EMOJIS[event.event_type] || '🗓️'}</span>
                            <h4 className="font-bold text-white text-lg leading-tight">{event.title}</h4>
                            {event.category === 'Recurring' && (
                              <span className="bg-purple-900/30 text-purple-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-purple-500/30">
                                🔁 {FREQUENCY_LABELS[event.pattern] || 'Weekly'}
                              </span>
                            )}
                            {event.category === 'Special' && (
                              <span className="bg-pink-900/30 text-pink-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-pink-500/30">
                                ⭐ Special
                              </span>
                            )}
                            {event.category === 'Non-Recurring' && (
                              <span className="bg-cyan-900/30 text-cyan-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-cyan-500/30">
                                📅 Non-Recurring
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-1">
                            {eTime} • {event.event_type} • {event.venue}
                          </p>
                          {event.entertainer && (
                            <p className="text-[11px] text-gray-300 font-semibold mt-1">
                              🎤 Host / Act: <span className="text-white">{event.entertainer}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {event.description && (
                        <p className="text-gray-400 text-xs whitespace-pre-wrap">{event.description}</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setSelectedDayDate(null)
                            if (onViewEntity) onViewEntity(event.venue)
                          }}
                          className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                        >
                          📍 View {event.venue}
                        </button>

                        {editable && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(event)}
                              className="px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event.id, event.title)}
                              className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {isEditorOpen && (
        <div
          onClick={() => setIsEditorOpen(false)}
          className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#090812] w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-800 p-6 relative shadow-2xl hide-scrollbar space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                  Event Calendar Manager
                </span>
                <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-wider">
                  {editingEventId ? 'Edit Event' : 'Create Calendar Event'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Event Kind / Classification Selector */}
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1.5">
                Event Classification *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'Non-Recurring', label: '📅 Non-Recurring' },
                  { key: 'Recurring', label: '🔁 Recurring' },
                  { key: 'Special', label: '⭐ Special' },
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({
                        ...prev,
                        category: item.key,
                        event_type: item.key === 'Special' && prev.event_type === 'Karaoke' ? 'Specials' : prev.event_type,
                      }))
                    }
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      formData.category === item.key
                        ? item.key === 'Recurring'
                          ? 'bg-purple-600/25 border-purple-500 text-purple-300'
                          : item.key === 'Special'
                          ? 'bg-pink-600/25 border-pink-500 text-pink-300'
                          : 'bg-cyan-600/25 border-cyan-500 text-cyan-300'
                        : 'bg-black border-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {formData.category === 'Recurring' && (
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                  Recurring Frequency
                </label>
                <select
                  value={formData.recurring_pattern}
                  onChange={e => setFormData({ ...formData, recurring_pattern: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-purple-500"
                >
                  <option value="weekly">Occurs Every Week</option>
                  <option value="biweekly">Occurs Every Other Week</option>
                  <option value="monthly">Occurs Once a Month</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                Event Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Saturday Night Live Music"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                  Venue *
                </label>
                <select
                  value={formData.venue}
                  onChange={e => handleVenueChange(e.target.value)}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select Venue
                  </option>
                  {venues.map(v => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                  Event Type *
                </label>
                <select
                  value={formData.event_type}
                  onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500"
                >
                  {Object.keys(EVENT_EMOJIS).map(t => (
                    <option key={t} value={t}>
                      {EVENT_EMOJIS[t]} {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                  Date & Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                  Host / Entertainer
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={formData.entertainer}
                  onChange={e => setFormData({ ...formData, entertainer: e.target.value })}
                  className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Event details, specials, cover info..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-black border border-gray-700 text-white rounded-xl p-3 text-sm outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEvent}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-colors shadow-lg"
              >
                {saving ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
              </button>
            </div>

            {editingEventId && (
              <button
                type="button"
                onClick={() => handleDeleteEvent(editingEventId, formData.title)}
                className="w-full py-2.5 rounded-xl bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                🗑️ Delete Event
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
