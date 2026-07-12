import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'
import { getDistanceInFeet } from './utils'

export default function EventsFeed({ currentUser, onViewEntity }) {
  const [rawLineups, setRawLineups] = useState([])
  const [sortMode, setSortMode] = useState('distance')
  const [eventTypeFilter, setEventTypeFilter] = useState('All')
  const [venueSearch, setVenueSearch] = useState('')
  const [venueLineups, setVenueLineups] = useState([])
  const [displayedVenues, setDisplayedVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLoc, setUserLoc] = useState(null)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  const [selectedVenueInfo, setSelectedVenueInfo] = useState(null)
  const [selectedEventInfo, setSelectedEventInfo] = useState(null)
  const [isEditingEvent, setIsEditingEvent] = useState(false)
  const [editFormData, setEditFormData] = useState({ title: '', description: '', event_type: 'Live Music' })

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}
      )
    }
    fetchFeedData()
  }, [])

  const fetchFeedData = async () => {
    setLoading(true)
    const { data: venuesData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').order('name', { ascending: true })
    const { data: eventsData } = await supabase.from('events').select('*').eq('status', 'approved')
    const today = new Date()

    const builtLineups = (venuesData || []).map(venue => {
      const schedule = []
      const legacySchedule = venue.details?.schedule || []
      for (let i = 0; i < 7; i++) {
        const slotDate = new Date(today)
        slotDate.setDate(today.getDate() + i)
        const dayName = slotDate.toLocaleDateString('en-US', { weekday: 'short' })
        let matchedEvent = eventsData?.find(e => {
          if (e.venue !== venue.name || e.recurring_weekly) return false
          const safe = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
          const d = new Date(safe)
          return d.getFullYear() === slotDate.getFullYear() && d.getMonth() === slotDate.getMonth() && d.getDate() === slotDate.getDate()
        })
        if (!matchedEvent) {
          matchedEvent = eventsData?.find(e => {
            if (e.venue !== venue.name || !e.recurring_weekly) return false
            const safe = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
            return new Date(safe).getDay() === slotDate.getDay()
          })
        }
        if (!matchedEvent) {
          const ls = legacySchedule.find(s => s.day === dayName || s.day === slotDate.toLocaleDateString('en-US', { weekday: 'long' }))
          if (ls?.event) matchedEvent = ls.event
        }
        schedule.push({ day: dayName, date: slotDate, event: matchedEvent || null })
      }
      return { ...venue, schedule }
    })

    setRawLineups(builtLineups)
    setLoading(false)
  }

  useEffect(() => {
    if (rawLineups.length === 0) return
    let sorted = [...rawLineups]
    if (venueSearch.trim()) {
      const q = venueSearch.toLowerCase()
      sorted = sorted.filter(v =>
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q)) ||
        (v.tags && v.tags.join(' ').toLowerCase().includes(q))
      )
    }
    if (eventTypeFilter !== 'All') {
      sorted = sorted.filter(v => v.schedule.some(s => s.event?.event_type === eventTypeFilter))
    }
    const getDist = v => (!userLoc || !v.lat || !v.lng) ? Infinity : getDistanceInFeet(userLoc.lat, userLoc.lon, v.lat, v.lng)
    const getScore = v => { for (let i = 0; i < 7; i++) { if (v.schedule[i]?.event) return i } return 7 }
    sorted.sort((a, b) => {
      if (sortMode === 'eventsFirst') {
        const d = getScore(a) - getScore(b)
        if (d !== 0) return d
      }
      return getDist(a) - getDist(b)
    })
    setVenueLineups(sorted)
    setDisplayedVenues(sorted.slice(0, ITEMS_PER_PAGE))
    setPage(1)
  }, [rawLineups, userLoc, sortMode, eventTypeFilter, venueSearch])

  const loadMore = () => {
    setDisplayedVenues(venueLineups.slice(0, (page + 1) * ITEMS_PER_PAGE))
    setPage(p => p + 1)
  }

  const handleOpenEvent = (venue, slot) => {
    setSelectedVenueInfo(venue)
    setSelectedEventInfo({ slot })
    setIsEditingEvent(false)
    if (slot.event) {
      setEditFormData({ title: slot.event.title || '', description: slot.event.description || '', event_type: slot.event.event_type || 'Live Music' })
    } else {
      setEditFormData({ title: '', description: '', event_type: 'Live Music' })
    }
  }

  const handleSaveEvent = async () => {
    const payload = {
      title: editFormData.title || `${selectedVenueInfo.name} Event`,
      description: editFormData.description,
      event_type: editFormData.event_type,
      venue: selectedVenueInfo.name,
      event_date: selectedEventInfo.slot.date.toISOString(),
      status: 'approved',
    }
    let newEventObj = { ...payload }
    if (selectedEventInfo.slot.event?.id) {
      const { data } = await supabase.from('events').update(payload).eq('id', selectedEventInfo.slot.event.id).select().single()
      if (data) newEventObj = data
      toast.success('Event updated!')
    } else {
      const { data } = await supabase.from('events').insert([payload]).select().single()
      if (data) newEventObj = data
      toast.success('Event created!')
    }
    setRawLineups(prev => prev.map(v => {
      if (v.id !== selectedVenueInfo.id) return v
      return { ...v, schedule: v.schedule.map(s => s.date.toDateString() === selectedEventInfo.slot.date.toDateString() ? { ...s, event: newEventObj } : s) }
    }))
    setIsEditingEvent(false)
    setSelectedEventInfo(null)
    fetchFeedData()
  }

  const handleDeleteEvent = async () => {
    if (!selectedEventInfo?.slot?.event?.id || !window.confirm('Delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', selectedEventInfo.slot.event.id)
    if (error) { toast.error(`Error: ${error.message}`); return }
    toast.success('Event deleted.')
    setRawLineups(prev => prev.map(v => {
      if (v.id !== selectedVenueInfo.id) return v
      return { ...v, schedule: v.schedule.map(s => s.date.toDateString() === selectedEventInfo.slot.date.toDateString() ? { ...s, event: null } : s) }
    }))
    setIsEditingEvent(false)
    setSelectedEventInfo(null)
    fetchFeedData()
  }

  const EVENT_TYPES = ['All', 'Karaoke', 'Live Music', 'Comedy', 'Open Mic', 'Trivia', 'Drinks']

  return (
    <div className="space-y-4 animate-fade-in-up pb-4">

      {/* Search */}
      <div className="relative mx-1">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
        </div>
        <input
          type="text"
          value={venueSearch}
          onChange={e => setVenueSearch(e.target.value)}
          placeholder="Search venues, addresses, vibes..."
          className="w-full pl-10 pr-4 py-3 text-sm text-white/80 rounded-xl outline-none transition-all duration-200"
          style={{
            fontFamily: 'Inter, sans-serif',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(79,140,255,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>

      {/* Sort + Filter row */}
      <div className="flex gap-2 mx-1">
        {[
          { key: 'distance', label: '📍 Nearest' },
          { key: 'eventsFirst', label: '🗓️ Events' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortMode(key)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              fontFamily: 'Inter, sans-serif',
              ...(sortMode === key
                ? { background: 'linear-gradient(135deg, #4f8cff, #2463d4)', color: '#fff', boxShadow: '0 2px 12px rgba(79,140,255,0.3)' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event type filter */}
      <div className="flex gap-1.5 overflow-x-auto mx-1 pb-1" style={{ scrollbarWidth: 'none' }}>
        {EVENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setEventTypeFilter(type)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0"
            style={{
              fontFamily: 'Inter, sans-serif',
              ...(eventTypeFilter === type
                ? { background: 'rgba(79,140,255,0.18)', color: '#4f8cff', border: '1px solid rgba(79,140,255,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }),
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading && rawLineups.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#4f8cff]/20 border-t-[#4f8cff] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-3 mx-1">
            {displayedVenues.map(venue => (
              <VenueCard
                key={venue.id}
                venue={venue}
                currentUser={currentUser}
                onOpenVenue={() => onViewEntity(venue.name)}
                onOpenEvent={(slot, v) => handleOpenEvent(v || venue, slot)}
                onAdminEdit={() => alert('To edit venue details, visit Admin Console → Manage Venues.')}
              />
            ))}
          </div>

          {displayedVenues.length < venueLineups.length && (
            <button
              onClick={loadMore}
              className="w-full py-3.5 rounded-xl text-xs font-semibold transition-all duration-150 mx-1"
              style={{
                fontFamily: 'Inter, sans-serif',
                background: 'rgba(79,140,255,0.07)',
                border: '1px solid rgba(79,140,255,0.18)',
                color: 'rgba(79,140,255,0.8)',
              }}
            >
              Load more venues
            </button>
          )}
        </>
      )}

      {/* Event detail modal */}
      {selectedEventInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,18,40,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Modal header */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {selectedVenueInfo.name}
                  </h3>
                  <p className="text-xs text-white/35 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {selectedEventInfo.slot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setSelectedEventInfo(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4">
              {isEditingEvent ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35 block mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>Title</label>
                    <input
                      type="text"
                      value={editFormData.title}
                      onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35 block mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>Type</label>
                    <select
                      value={editFormData.event_type}
                      onChange={e => setEditFormData({ ...editFormData, event_type: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif' }}
                    >
                      {Object.keys(EVENT_EMOJIS).map(t => <option key={t} value={t}>{EVENT_EMOJIS[t]} {t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35 block mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>Description</label>
                    <textarea
                      value={editFormData.description}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif' }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setIsEditingEvent(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/50 transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif' }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveEvent} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #4f8cff, #2463d4)', fontFamily: 'Inter, sans-serif' }}>
                      Save
                    </button>
                  </div>
                  {selectedEventInfo.slot.event?.id && (
                    <button onClick={handleDeleteEvent} className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: 'rgba(245,85,122,0.1)', border: '1px solid rgba(245,85,122,0.25)', color: '#f5557a', fontFamily: 'Inter, sans-serif' }}>
                      Delete Event
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedEventInfo.slot.event ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{EVENT_EMOJIS[selectedEventInfo.slot.event.event_type] || '🗓️'}</span>
                        <div>
                          <h4 className="text-sm font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedEventInfo.slot.event.title}</h4>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4f8cff]/70" style={{ fontFamily: 'Inter, sans-serif' }}>{selectedEventInfo.slot.event.event_type}</span>
                        </div>
                      </div>
                      {selectedEventInfo.slot.event.description && (
                        <p className="text-sm text-white/50 leading-relaxed px-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {selectedEventInfo.slot.event.description}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <span className="text-3xl opacity-30 block mb-2">📅</span>
                      <p className="text-xs text-white/30 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>No event scheduled.</p>
                    </div>
                  )}

                  {currentUser?.account_type === 'Admin' && (
                    <button
                      onClick={() => setIsEditingEvent(true)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}
                    >
                      {selectedEventInfo.slot.event ? '✏️ Edit Event' : '+ Create Event'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
