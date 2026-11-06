import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'
import VenueRecurringModal from './VenueRecurringModal'
import {
  getBlackHillsDate,
  parseEventBlackHillsDate,
  buildVenueRecurringSchedule,
  isRecurringEvent,
  getEventCategory,
  getRecurringPattern,
} from './utils'

export default function ProfileVenue({ profile, currentUser, isOwner, onViewEntity }) {
  const [events, setEvents] = useState([])
  const [linkedVenuePage, setLinkedVenuePage] = useState(null)
  const [weeklySchedule, setWeeklySchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRecurringSlot, setSelectedRecurringSlot] = useState(null)
  const [selectedLineupEvent, setSelectedLineupEvent] = useState(null)

  const effectiveVenue = linkedVenuePage || profile
  const venueName = effectiveVenue?.name || profile?.name || profile?.username || ''
  const canManage =
    isOwner ||
    currentUser?.account_type === 'Admin' ||
    Boolean(effectiveVenue?.owner_id && currentUser?.id === effectiveVenue.owner_id)

  const venueData = {
    name: venueName,
    address: effectiveVenue?.address || profile?.address,
    phone: effectiveVenue?.phone || profile?.phone,
    email: effectiveVenue?.email || profile?.email,
    hours: effectiveVenue?.hours_of_operation || profile?.hours_of_operation,
    happyHour: effectiveVenue?.happy_hour_schedule || profile?.happy_hour_schedule,
    menu: effectiveVenue?.menu_url || profile?.menu_url,
    website: effectiveVenue?.website || profile?.website,
    facebook: effectiveVenue?.facebook || profile?.facebook,
    ig: effectiveVenue?.ig || profile?.ig,
    tiktok: effectiveVenue?.tiktok || profile?.tiktok,
    styles: effectiveVenue?.tags || profile?.tags || [],
  }

  const fetchVenueEvents = async () => {
    setLoading(true)
    let resolvedVenueName = profile?.name || profile?.username || ''

    // If viewing from a Venue user's own Profile tab, resolve their linked page in `pages`
    if (!profile?.page_type && profile?.id) {
      const { data: pageByOwner } = await supabase
        .from('pages')
        .select('*')
        .eq('owner_id', profile.id)
        .limit(1)
        .maybeSingle()

      if (pageByOwner) {
        setLinkedVenuePage(pageByOwner)
        resolvedVenueName = pageByOwner.name
      } else if (profile?.username) {
        const { data: pageByName } = await supabase
          .from('pages')
          .select('*')
          .ilike('name', profile.username)
          .limit(1)
          .maybeSingle()
        if (pageByName) {
          setLinkedVenuePage(pageByName)
          resolvedVenueName = pageByName.name
        }
      }
    }

    if (resolvedVenueName) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .ilike('venue', resolvedVenueName)
        .eq('status', 'approved')
      if (data) setEvents(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchVenueEvents()
  }, [profile?.id, profile?.name, profile?.username])

  useEffect(() => {
    const today = getBlackHillsDate()
    const schedule = buildVenueRecurringSchedule(
      { ...effectiveVenue, name: venueName },
      events,
      today
    )
    setWeeklySchedule(schedule)
  }, [events, effectiveVenue, venueName])

  const upcomingEventsList = events
    .filter(e => {
      const eDate = parseEventBlackHillsDate(e.event_date)
      const today = getBlackHillsDate()
      today.setHours(0, 0, 0, 0)
      return isRecurringEvent(e) || eDate >= today
    })
    .sort((a, b) => {
      const aRec = isRecurringEvent(a) ? 0 : 1
      const bRec = isRecurringEvent(b) ? 0 : 1
      if (aRec !== bRec) return aRec - bRec
      return parseEventBlackHillsDate(a.event_date) - parseEventBlackHillsDate(b.event_date)
    })

  const handleOpenRecurringSlot = (slot) => {
    setSelectedRecurringSlot(slot || weeklySchedule[0])
  }

  const handleLineupClick = (ev) => {
    if (isRecurringEvent(ev)) {
      const eDate = parseEventBlackHillsDate(ev.event_date)
      const matchedSlot =
        weeklySchedule.find(s => s.event?.id === ev.id) ||
        weeklySchedule.find(s => s.date?.getDay() === eDate.getDay()) ||
        weeklySchedule[0]
      setSelectedRecurringSlot(matchedSlot)
    } else {
      setSelectedLineupEvent(ev)
    }
  }

  const InfoRow = ({ icon, label, value, href }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-3 py-2 border-b border-white/[0.05] last:border-0">
        <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">{label}</p>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-[#4f8cff] text-sm hover:text-[#22d4c8] transition-colors truncate block">
              {value}
            </a>
          ) : (
            <p className="text-white text-sm truncate">{value}</p>
          )}
        </div>
      </div>
    )
  }

  const fullVenueObj = {
    ...effectiveVenue,
    name: venueName,
    address: venueData.address,
    schedule: weeklySchedule,
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* VenueCard / Recurring Events Tracker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300/80">
            🔁 Weekly Recurring Events Tracker
          </span>
          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenRecurringSlot(weeklySchedule[0])}
              className="text-[10px] font-bold uppercase tracking-widest text-[#4f8cff] hover:text-[#22d4c8] transition-colors"
            >
              + Manage Recurring Events
            </button>
          )}
        </div>
        <VenueCard
          venue={fullVenueObj}
          currentUser={currentUser}
          onOpenVenue={() => onViewEntity && onViewEntity(venueName)}
          onOpenEvent={(slot) => handleOpenRecurringSlot(slot)}
          onAdminEdit={() => handleOpenRecurringSlot(weeklySchedule[0])}
        />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Contact</h3>
          <InfoRow icon="📍" label="Address" value={venueData.address} />
          <InfoRow icon="📞" label="Phone" value={venueData.phone} />
          <InfoRow icon="✉️" label="Email" value={venueData.email} />

          {/* Hours */}
          {venueData.hours && Object.keys(venueData.hours).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2">Hours</p>
              <div className="space-y-1">
                {Object.entries(venueData.hours).map(([day, time]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-white/50">{day}</span>
                    <span className="text-white/80">
                      {time.isOpen === false ? 'Closed' : `${time.open || ''} – ${time.close || ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Happy Hour */}
          {venueData.happyHour && Object.keys(venueData.happyHour).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Happy Hour</p>
              <div className="space-y-1">
                {Object.entries(venueData.happyHour).map(([day, time]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-white/50">{day}</span>
                    <span className="text-emerald-400/80">
                      {time.isOpen === false ? 'None' : `${time.open || ''} – ${time.close || ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Links + tags */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Online</h3>
            <div className="flex flex-wrap gap-2">
              {venueData.website && (
                <a href={venueData.website} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 hover:bg-[#4f8cff]/20 transition-all">
                  Website
                </a>
              )}
              {venueData.facebook && (
                <a href={venueData.facebook} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 hover:bg-[#4f8cff]/20 transition-all">
                  Facebook
                </a>
              )}
              {venueData.ig && (
                <a href={venueData.ig} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all">
                  Instagram
                </a>
              )}
              {venueData.tiktok && (
                <a href={venueData.tiktok} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-white/[0.07] transition-all">
                  TikTok
                </a>
              )}
              {!venueData.website && !venueData.facebook && !venueData.ig && !venueData.tiktok && (
                <span className="text-white/30 text-xs italic">No links provided</span>
              )}
            </div>
          </div>

          {venueData.styles && venueData.styles.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Vibe</h3>
              <div className="flex flex-wrap gap-2">
                {venueData.styles.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full text-[10px] font-bold bg-white/[0.04] text-white/60 border border-white/[0.07] uppercase tracking-widest">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming & Recurring Lineup */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-white">Venue Lineup</h3>
          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenRecurringSlot(weeklySchedule[0])}
              className="text-[#4f8cff] text-[10px] font-bold uppercase tracking-widest hover:text-[#22d4c8] transition-colors"
            >
              + Add Recurring Event
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[#4f8cff] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : upcomingEventsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">No events scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEventsList.map(ev => {
              const eDate = parseEventBlackHillsDate(ev.event_date)
              const cat = getEventCategory(ev)
              const pat = getRecurringPattern(ev)
              const weekday = eDate.toLocaleDateString('en-US', { weekday: 'long' })
              return (
                <div
                  key={ev.id}
                  onClick={() => handleLineupClick(ev)}
                  className="bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.05] p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">
                      {EVENT_EMOJIS[ev.event_type] || '🗓️'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-white font-semibold text-sm truncate">{ev.title}</h4>
                        <span
                          className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                            cat === 'Recurring'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : cat === 'Special'
                              ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                              : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          }`}
                        >
                          {cat === 'Recurring' ? `🔁 ${pat}` : cat === 'Special' ? '⭐ Special' : '📅 One-Time'}
                        </span>
                      </div>
                      <p className="text-[#4f8cff] text-[10px] font-bold uppercase tracking-widest mt-0.5">
                        {cat === 'Recurring' ? `Every ${weekday}` : eDate.toLocaleDateString()} · {ev.event_type}
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recurring Event Modal */}
      {selectedRecurringSlot && (
        <VenueRecurringModal
          venue={fullVenueObj}
          initialSlot={selectedRecurringSlot}
          currentUser={currentUser}
          isOwner={canManage}
          onClose={() => setSelectedRecurringSlot(null)}
          onSaved={() => fetchVenueEvents()}
        />
      )}

      {/* One-Off / Special Event Detail Modal */}
      {selectedLineupEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0a1228] border border-white/10 p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  {getEventCategory(selectedLineupEvent)} Event
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5">{selectedLineupEvent.title}</h3>
                <p className="text-xs text-white/45">
                  {parseEventBlackHillsDate(selectedLineupEvent.event_date).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {selectedLineupEvent.event_type}
                </p>
              </div>
              <button
                onClick={() => setSelectedLineupEvent(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            {selectedLineupEvent.entertainer && (
              <p className="text-xs text-cyan-300 font-semibold">
                🎤 Host / Entertainer: <span className="text-white">{selectedLineupEvent.entertainer}</span>
              </p>
            )}
            {selectedLineupEvent.description && (
              <p className="text-sm text-white/70 whitespace-pre-wrap">{selectedLineupEvent.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
