import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'
import VenueRecurringModal from './VenueRecurringModal'
import { getDistanceInFeet, getBlackHillsDate, buildVenueRecurringSchedule } from './utils'

export default function EventsFeed({ currentUser, onViewEntity }) {
  const [rawLineups, setRawLineups] = useState([])
  const [checkinCounts, setCheckinCounts] = useState({})
  const [sortMode, setSortMode] = useState('distance')
  const [eventTypeFilter, setEventTypeFilter] = useState('All')
  const [venueSearch, setVenueSearch] = useState('')
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false)
  const [venueLineups, setVenueLineups] = useState([])
  const [displayedVenues, setDisplayedVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLoc, setUserLoc] = useState(null)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  const [selectedVenueInfo, setSelectedVenueInfo] = useState(null)
  const [selectedEventInfo, setSelectedEventInfo] = useState(null)

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}
      )
    }
    fetchFeedData()

    const checkinChannel = supabase.channel('public:venue_checkins:shared')
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'venue_checkins' }, payload => {
        const vName = payload.new?.venue_name
        if (vName) setCheckinCounts(prev => ({ ...prev, [vName]: (prev[vName] || 0) + 1 }))
      })
      .on('postgres', { event: 'DELETE', schema: 'public', table: 'venue_checkins' }, payload => {
        const vName = payload.old?.venue_name
        if (vName) setCheckinCounts(prev => ({ ...prev, [vName]: Math.max(0, (prev[vName] || 0) - 1) }))
      })
      .subscribe()

    return () => supabase.removeChannel(checkinChannel)
  }, [])

  const fetchFeedData = async () => {
    setLoading(true)
    const [{ data: venuesData }, { data: eventsData }, { data: checkinsData }] = await Promise.all([
      supabase.from('pages').select('*').eq('page_type', 'Venue').order('name', { ascending: true }),
      supabase.from('events').select('*').eq('status', 'approved'),
      supabase.from('venue_checkins').select('venue_name'),
    ])

    const counts = {}
    ;(checkinsData || []).forEach(row => {
      if (row.venue_name) counts[row.venue_name] = (counts[row.venue_name] || 0) + 1
    })
    setCheckinCounts(counts)

    const today = getBlackHillsDate()

    const builtLineups = (venuesData || []).map(venue => ({
      ...venue,
      schedule: buildVenueRecurringSchedule(venue, eventsData || [], today),
    }))

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
    setSelectedEventInfo({ slot: slot || venue?.schedule?.[0] })
  }

  const handleRecurringSaved = () => {
    fetchFeedData()
  }

  const EVENT_TYPES = ['All', ...Object.keys(EVENT_EMOJIS)]

  const topVenueSuggestions = venueSearch.trim()
    ? [...rawLineups]
        .filter(v => {
          const q = venueSearch.trim().toLowerCase()
          return (
            (v.name && v.name.toLowerCase().includes(q)) ||
            (v.address && v.address.toLowerCase().includes(q)) ||
            (v.tags && v.tags.join(' ').toLowerCase().includes(q))
          )
        })
        .sort((a, b) => {
          const q = venueSearch.trim().toLowerCase()
          const aStarts = (a.name || '').toLowerCase().startsWith(q) ? 0 : 1
          const bStarts = (b.name || '').toLowerCase().startsWith(q) ? 0 : 1
          return aStarts - bStarts || (a.name || '').localeCompare(b.name || '')
        })
        .slice(0, 3)
    : []

  return (
    <div className="space-y-4 animate-fade-in-up pb-4">

      {/* Search */}
      <div className="relative mx-1 z-30">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
        </div>
        <input
          type="text"
          value={venueSearch}
          onChange={e => {
            setVenueSearch(e.target.value)
            setShowVenueSuggestions(true)
          }}
          placeholder="Search venues, addresses, vibes..."
          className="w-full pl-10 pr-4 py-3 text-sm text-white/80 rounded-xl outline-none transition-all duration-200"
          style={{
            fontFamily: 'Inter, sans-serif',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(79,140,255,0.5)'
            setShowVenueSuggestions(true)
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.08)'
            setTimeout(() => setShowVenueSuggestions(false), 180)
          }}
        />

        {/* Top 3 Venue Suggestions Dropdown */}
        {showVenueSuggestions && topVenueSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0b1324]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.75)] overflow-hidden z-50 animate-fade-in">
            <div className="px-3.5 py-1.5 border-b border-white/[0.06] flex justify-between items-center">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Top 3 Matching Venues</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#4f8cff]/70">Tap to Open Page</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {topVenueSuggestions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setShowVenueSuggestions(false)
                    if (onViewEntity) onViewEntity(v.name)
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={v.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${v.name}`}
                      alt={v.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/10 bg-[#070d1a] flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{v.name}</p>
                      <p className="text-[10px] text-white/40 truncate">{v.address || (v.tags && v.tags.join(' · ')) || 'Venue'}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#4f8cff]/15 text-[#4f8cff] border border-[#4f8cff]/30 flex-shrink-0">
                    Open →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
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
                liveCount={checkinCounts[venue.name] || 0}
                onOpenVenue={() => onViewEntity(venue.name)}
                onOpenEvent={(slot, v) => handleOpenEvent(v || venue, slot)}
                onAdminEdit={v => handleOpenEvent(v || venue, (v || venue)?.schedule?.[0])}
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

      {/* Recurring Event Tracker Modal */}
      {selectedEventInfo && selectedVenueInfo && (
        <VenueRecurringModal
          venue={rawLineups.find(v => v.id === selectedVenueInfo.id) || selectedVenueInfo}
          initialSlot={selectedEventInfo.slot}
          currentUser={currentUser}
          onClose={() => {
            setSelectedEventInfo(null)
            setSelectedVenueInfo(null)
          }}
          onSaved={handleRecurringSaved}
        />
      )}
    </div>
  )
}
