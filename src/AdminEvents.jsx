import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'
import {
  parseEventBlackHillsDate,
  getEventCategory,
  getRecurringPattern,
  isRecurringEvent,
} from './utils'

const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  monthly: 'Monthly',
}

export default function AdminEvents() {
  const formTopRef = useRef(null)
  const [events, setEvents] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterMode, setFilterMode] = useState('All') // 'All' | 'Recurring' | 'Non-Recurring' | 'Special' | 'Pending'
  const [searchQuery, setSearchQuery] = useState('')

  // Form State
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventAddress, setEventAddress] = useState('')
  const [eventAct, setEventAct] = useState('')
  const [eventType, setEventType] = useState('Karaoke')
  const [eventDate, setEventDate] = useState('')
  const [eventPoints, setEventPoints] = useState(500)
  const [editingEventId, setEditingEventId] = useState(null)
  const [recurringPattern, setRecurringPattern] = useState('none') // 'none' | 'special' | 'weekly' | 'biweekly' | 'monthly'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: eData, error }, { data: pData }] = await Promise.all([
      supabase.from('events').select('*'),
      supabase.from('pages').select('id, name, page_type, address').order('name', { ascending: true }),
    ])

    if (error) console.error('Admin Events Fetch Error:', error)
    if (eData) {
      const now = new Date()
      const sorted = [...eData].sort((a, b) => {
        // 1. Pending first
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1

        // 2. Recurring events stay active alongside upcoming events
        const aDate = parseEventBlackHillsDate(a.event_date)
        const bDate = parseEventBlackHillsDate(b.event_date)
        const aPast = !isRecurringEvent(a) && aDate < now
        const bPast = !isRecurringEvent(b) && bDate < now

        if (!aPast && bPast) return -1
        if (aPast && !bPast) return 1

        if (!aPast && !bPast) return aDate - bDate
        return bDate - aDate
      })
      setEvents(sorted)
    }

    if (pData) setPages(pData)
    setLoading(false)
  }

  const handleVenueSelect = (e) => {
    const selectedVenueName = e.target.value
    setEventVenue(selectedVenueName)
    const matchedPage = pages.find(p => p.name === selectedVenueName)
    if (matchedPage && matchedPage.address) {
      setEventAddress(matchedPage.address)
    }
  }

  const saveEvent = async () => {
    if (!eventTitle.trim() || !eventDate || !eventVenue) {
      toast.error('Title, Venue, and Start Date are required')
      return
    }
    setLoading(true)

    const payload = {
      title: eventTitle.trim(),
      description: eventDesc.trim(),
      venue: eventVenue,
      address: eventAddress.trim(),
      entertainer: eventAct.trim(),
      event_type: eventType || 'Karaoke',
      event_date: new Date(eventDate).toISOString(),
      points_awarded: Number(eventPoints) || 500,
      recurring_pattern: recurringPattern,
      recurring_weekly: recurringPattern === 'weekly',
      status: 'approved',
    }

    if (editingEventId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
      if (error) {
        toast.error('DB Error: ' + error.message)
        setLoading(false)
        return
      }
      toast.success('Event updated!')
    } else {
      const { error } = await supabase.from('events').insert([payload])
      if (error) {
        toast.error('DB Error: ' + error.message)
        setLoading(false)
        return
      }
      toast.success('Event created!')
    }

    resetForm()
    fetchData()
  }

  const editEvent = (e) => {
    setEditingEventId(e.id)
    setEventTitle(e.title || '')
    setEventDesc(e.description || '')
    setEventVenue(e.venue || '')
    setEventAddress(e.address || '')
    setEventAct(e.entertainer || '')
    setEventType(e.event_type || 'Karaoke')

    const rawPat = (e.recurring_pattern || '').toLowerCase()
    if (rawPat === 'special') {
      setRecurringPattern('special')
    } else {
      setRecurringPattern(getRecurringPattern(e))
    }

    const formatForInput = (dateStr) => {
      if (!dateStr) return ''
      const d = parseEventBlackHillsDate(dateStr)
      if (isNaN(d.getTime())) return ''
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    setEventDate(formatForInput(e.event_date))
    setEventPoints(e.points_awarded || 500)

    if (formTopRef.current) {
      formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const toggleApproval = async (id, currentStatus) => {
    const newStatus = currentStatus === 'pending' ? 'approved' : 'pending'
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast.error(`Update Failed: ${error.message}`)
      return
    }
    toast.success(`Event marked as ${newStatus}`)
    fetchData()
  }

  const deleteEvent = async (id) => {
    if (!window.confirm('Delete this event completely?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
      toast.error(`Operation Failed: ${error.message}`)
      return
    }
    if (editingEventId === id) resetForm()
    toast.success('Event deleted successfully')
    fetchData()
  }

  const resetForm = () => {
    setEditingEventId(null)
    setEventTitle('')
    setEventDesc('')
    setEventVenue('')
    setEventAddress('')
    setEventAct('')
    setEventType('Karaoke')
    setEventDate('')
    setEventPoints(500)
    setRecurringPattern('none')
  }

  const filteredEvents = events.filter(e => {
    const cat = getEventCategory(e)
    if (filterMode === 'Pending' && e.status !== 'pending') return false
    if (filterMode === 'Recurring' && cat !== 'Recurring') return false
    if (filterMode === 'Non-Recurring' && cat !== 'Non-Recurring') return false
    if (filterMode === 'Special' && cat !== 'Special') return false

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const matchTitle = (e.title || '').toLowerCase().includes(q)
      const matchVenue = (e.venue || '').toLowerCase().includes(q)
      const matchType = (e.event_type || '').toLowerCase().includes(q)
      if (!matchTitle && !matchVenue && !matchType) return false
    }
    return true
  })

  const eventTypeOptions = Object.keys(EVENT_EMOJIS)
  if (eventType && !eventTypeOptions.includes(eventType)) {
    eventTypeOptions.push(eventType)
  }

  return (
    <div ref={formTopRef} className="space-y-6 animate-fade-in pb-12">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-4">
          {editingEventId ? 'Edit Event' : 'Create Event'}
        </h3>

        <div className="space-y-4">
          <input
            type="text"
            value={eventTitle}
            onChange={e => setEventTitle(e.target.value)}
            placeholder="Event Title *"
            className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={eventVenue}
              onChange={handleVenueSelect}
              className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
            >
              <option value="" disabled>
                Select Venue / Location *
              </option>
              {pages
                .filter(p => p.page_type === 'Venue')
                .map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={eventAddress}
              onChange={e => setEventAddress(e.target.value)}
              placeholder="Physical Address (Auto-fills)"
              className="w-full bg-black border border-gray-700 text-gray-400 rounded-lg p-3 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={eventAct}
              onChange={e => setEventAct(e.target.value)}
              placeholder="Entertainer / Host Name"
              className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
            />
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
            >
              {eventTypeOptions.map(t => (
                <option key={t} value={t}>
                  {EVENT_EMOJIS[t] || '🗓️'} {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">
                Classification & Frequency
              </label>
              <select
                value={recurringPattern}
                onChange={e => {
                  const val = e.target.value
                  setRecurringPattern(val)
                  if (val === 'special' && eventType === 'Karaoke') {
                    setEventType('Specials')
                  }
                }}
                className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
              >
                <option value="none">📅 Non-Recurring (One-Time Event)</option>
                <option value="special">⭐ Special Event (Featured / One-Time Special)</option>
                <option value="weekly">🔁 Recurring: Every Week</option>
                <option value="biweekly">🔁 Recurring: Every Other Week</option>
                <option value="monthly">🔁 Recurring: Once a Month</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">
                Event Date & Start Time *
              </label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <textarea
            value={eventDesc}
            onChange={e => setEventDesc(e.target.value)}
            placeholder="Event Description..."
            className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500 h-24"
          />

          <button
            onClick={saveEvent}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg"
          >
            {loading ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
          </button>

          {editingEventId && (
            <button
              onClick={resetForm}
              className="w-full mt-2 bg-transparent border border-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl uppercase tracking-widest text-xs transition-colors"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5 bg-gray-900 border border-gray-800 p-1.5 rounded-xl">
          {['All', 'Recurring', 'Non-Recurring', 'Special', 'Pending'].map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`flex-1 min-w-[90px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                filterMode === mode
                  ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search events by title, venue, or type..."
          className="w-full bg-gray-900 border border-gray-800 text-white text-xs rounded-xl px-4 py-3 outline-none focus:border-blue-500"
        />
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredEvents.map(e => {
          const cat = getEventCategory(e)
          const pat = getRecurringPattern(e)
          const eDate = parseEventBlackHillsDate(e.event_date)
          const isPast = !isRecurringEvent(e) && eDate < new Date()

          return (
            <div
              key={e.id}
              className={`bg-gray-900 border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors ${
                e.status === 'pending'
                  ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                  : 'border-gray-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-lg">{EVENT_EMOJIS[e.event_type] || '🗓️'}</span>
                  <h4 className="font-bold text-white text-lg">{e.title}</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${
                      cat === 'Recurring'
                        ? 'bg-purple-900/30 text-purple-300 border-purple-500/40'
                        : cat === 'Special'
                        ? 'bg-pink-900/30 text-pink-300 border-pink-500/40'
                        : 'bg-cyan-900/30 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {cat === 'Recurring' ? `🔁 ${FREQUENCY_LABELS[pat] || 'Weekly'}` : cat === 'Special' ? '⭐ Special' : '📅 Non-Recurring'}
                  </span>
                  {e.status === 'pending' && (
                    <span className="bg-yellow-900/30 text-yellow-500 border border-yellow-500/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest animate-pulse">
                      Needs Approval
                    </span>
                  )}
                  {isPast && (
                    <span className="bg-gray-800 text-gray-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest">
                      Past Event
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                  {cat === 'Recurring'
                    ? `Every ${eDate.toLocaleDateString('en-US', { weekday: 'long' })} at ${eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : e.event_date
                    ? eDate.toLocaleString()
                    : 'Unknown Date'}{' '}
                  • {e.venue} • {e.event_type}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => toggleApproval(e.id, e.status)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    e.status === 'pending'
                      ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                      : 'border border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {e.status === 'pending' ? 'Approve' : 'Un-Approve'}
                </button>
                <button
                  onClick={() => editEvent(e)}
                  className="flex-1 sm:flex-none text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => deleteEvent(e.id)}
                  className="flex-1 sm:flex-none bg-red-900/20 text-red-500 border border-red-900/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
