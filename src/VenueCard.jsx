import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export const EVENT_EMOJIS = {
  'Karaoke': '🎤',
  'Live Music': '🎵',
  'Trivia': '❓',
  'Open Mic': '🎸',
  'Comedy': '😂',
  'Drinks': '🍻',
  'Poker': '♠️',
  'Specials': '💲',
  'Featured': '⭐',
  'Community': '👥',
  'Ticketed': '🎫',
  'General': '❗',
}

const hasCustomImage = (url) => {
  if (!url) return false
  return url.startsWith('http') && !url.includes('dicebear') && !url.includes('shapes/svg')
}

function useLiveVenueCount(venueName) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!venueName) return
    const fetchCount = async () => {
      const { count: n } = await supabase
        .from('venue_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('venue_name', venueName)
      setCount(n || 0)
    }
    fetchCount()
    const channel = supabase.channel(`public:venue_checkins:${venueName}`)
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'venue_checkins', filter: `venue_name=eq.${venueName}` }, () => setCount(c => c + 1))
      .on('postgres', { event: 'DELETE', schema: 'public', table: 'venue_checkins', filter: `venue_name=eq.${venueName}` }, () => setCount(c => Math.max(0, c - 1)))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [venueName])
  return count
}

const getVenueStatus = (venue) => {
  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const currentTime = now.getHours() * 100 + now.getMinutes()

  const checkActive = (current, open, close) => {
    if (close < open) return current >= open || current <= close
    return current >= open && current <= close
  }

  const hh = venue.happy_hour_schedule?.[dayName]
  if (hh?.isOpen && hh.open && hh.close) {
    const o = parseInt(hh.open.replace(':', '')), c = parseInt(hh.close.replace(':', ''))
    if (checkActive(currentTime, o, c)) return { label: 'HH', color: '#22d4c8', glow: 'rgba(34,212,200,0.6)' }
  }

  const op = venue.hours_of_operation?.[dayName]
  if (op?.isOpen && op.open && op.close) {
    const o = parseInt(op.open.replace(':', '')), c = parseInt(op.close.replace(':', ''))
    if (checkActive(currentTime, o, c)) return { label: 'Open', color: '#34d399', glow: 'rgba(52,211,153,0.6)' }
  }

  return { label: 'Closed', color: 'rgba(255,255,255,0.2)', glow: 'transparent' }
}

export default function VenueCard({ venue, currentUser, onOpenVenue, onOpenEvent, onAdminEdit }) {
  const liveCount = useLiveVenueCount(venue.name)
  const status = getVenueStatus(venue)
  const hasBg = hasCustomImage(venue.profile_pic)

  return (
    <div
      className="w-full rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      }}
    >
      {/* Top section */}
      <div className="relative flex overflow-hidden" style={{ minHeight: 120 }}>

        {/* Background image or gradient */}
        {hasBg ? (
          <>
            <img
              src={venue.profile_pic} alt={venue.name} loading="lazy" decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-30 transition-opacity duration-500 hover:opacity-40"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(7,13,26,0.85) 0%, rgba(7,13,26,0.4) 100%)' }} />
          </>
        ) : (
          <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, #4f8cff 0%, #f5557a 100%)' }} />
        )}

        {/* Left pane: status + count */}
        <div className="relative z-10 flex flex-col justify-between px-4 py-4 w-[38%] border-r border-white/[0.06]">
          {/* Status pill */}
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: status.color,
                boxShadow: `0 0 8px ${status.glow}`,
                animation: status.label === 'Open' || status.label === 'HH' ? 'pulse-soft 2s ease-in-out infinite' : 'none',
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: status.color, fontFamily: 'Inter, sans-serif' }}
            >
              {status.label}
            </span>
          </div>

          {/* Visit counter */}
          <div>
            <div
              className="font-black leading-none mb-1"
              style={{ fontSize: 42, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'rgba(255,255,255,0.9)' }}
            >
              {liveCount}
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30" style={{ fontFamily: 'Inter, sans-serif' }}>
              BHNL Visits
            </div>
          </div>
        </div>

        {/* Right pane: 7-day schedule */}
        <div className="relative z-10 flex items-center flex-1 px-3 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(venue.schedule || []).map((slot, i) => (
            <button
              key={i}
              onClick={() => onOpenEvent(slot, venue)}
              className="flex flex-col items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all duration-150 hover:bg-white/[0.08] active:scale-90 min-w-[44px] flex-shrink-0"
            >
              <span
                className="text-[9px] font-semibold uppercase tracking-wider text-white/35"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {slot.day}
              </span>
              <span className="text-xl leading-none">
                {slot.event
                  ? EVENT_EMOJIS[slot.event.event_type] || EVENT_EMOJIS['General']
                  : <span style={{ opacity: 0.18 }}>—</span>
                }
              </span>
            </button>
          ))}
        </div>

        {/* Admin dot menu */}
        {currentUser?.account_type === 'Admin' && (
          <button
            onClick={() => onAdminEdit(venue)}
            className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.1] transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx={12} cy={5} r={1.5} /><circle cx={12} cy={12} r={1.5} /><circle cx={12} cy={19} r={1.5} />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}
      >
        <button
          onClick={() => onOpenVenue(venue)}
          className="text-sm font-semibold text-white/80 hover:text-white transition-colors truncate flex-1 text-left"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {venue.name}
        </button>
        <span className="text-[10px] text-white/25 font-medium ml-3 flex-shrink-0" style={{ fontFamily: 'Inter, sans-serif' }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
