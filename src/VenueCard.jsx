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
  'General': '❗'
}

// 🟢 1. Create a helper to detect if a URL is "Real" (Not a default/placeholder)
const hasCustomImage = (url) => {
    if (!url) return false;
    // Your AdminPages.jsx uses dicebear or shapes/svg for placeholders. 
    // We check if the string contains those patterns to exclude them.
    return url.startsWith('http') && !url.includes('dicebear') && !url.includes('shapes/svg');
};

// 🟢 NEW: Custom Realtime Hook for Live Counters
function useLiveVenueCount(venueName) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!venueName) return

    // 1. Fetch the initial count
    const fetchCount = async () => {
      const { count: initialCount } = await supabase
        .from('venue_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('venue_name', venueName)
      
      setCount(initialCount || 0)
    }
    
    fetchCount()

    // 2. Subscribe to Realtime Inserts/Deletes for THIS specific venue
    const channel = supabase.channel(`public:venue_checkins:${venueName}`)
      .on(
        'postgres', 
        { event: 'INSERT', schema: 'public', table: 'venue_checkins', filter: `venue_name=eq.${venueName}` }, 
        () => setCount(c => c + 1)
      )
      .on(
        'postgres', 
        { event: 'DELETE', schema: 'public', table: 'venue_checkins', filter: `venue_name=eq.${venueName}` }, 
        () => setCount(c => Math.max(0, c - 1))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [venueName])

  return count
}

// Add this helper inside VenueCard.jsx
const getVenueStatus = (venue) => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = now.getHours() * 100 + now.getMinutes();

    // 1. Pink: Events occurring right now (Higher priority than Open/Happy Hour)
    const hasActiveEvent = venue.schedule?.some(slot => {
        if (!slot.event) return false;
        // Logic: if event date is today (and we're in the event time range)
        return slot.date.toDateString() === now.toDateString(); 
    });
    if (hasActiveEvent) return { color: 'bg-pink-500', label: 'LIVE' };

    // HELPER: Handles standard hours AND midnight crossovers
    const checkIsActive = (current, openTime, closeTime) => {
        if (closeTime < openTime) {
            // Midnight crossover (e.g., Open 1600, Close 200)
            // Active if it's late evening (>= 1600) OR early morning (<= 200)
            return current >= openTime || current <= closeTime;
        }
        // Standard daytime hours (e.g., Open 0900, Close 1700)
        return current >= openTime && current <= closeTime;
    };

    // 2. Green: Happy Hour
    const hh = venue.happy_hour_schedule?.[dayName];
    if (hh?.isOpen && hh.open && hh.close) {
        const open = parseInt(hh.open.replace(':', ''));
        const close = parseInt(hh.close.replace(':', ''));
        if (checkIsActive(currentTime, open, close)) return { color: 'bg-green-500', label: 'HH' };
    }

    // 3. Red: Open Hours
    const op = venue.hours_of_operation?.[dayName];
    if (op?.isOpen && op.open && op.close) {
        const open = parseInt(op.open.replace(':', ''));
        const close = parseInt(op.close.replace(':', ''));
        if (checkIsActive(currentTime, open, close)) return { color: 'bg-red-500', label: 'OPEN' };
    }

    return { color: 'bg-gray-600', label: 'OFF' };
};

export default function VenueCard({ venue, currentUser, onOpenVenue, onOpenEvent, onAdminEdit }) {
  // 🟢 NEW: Tap into the live count using the hook
  const liveCount = useLiveVenueCount(venue.name)
  const venueStatus = getVenueStatus(venue)

  return (
    <div className="flex flex-col w-full h-[220px] rounded-[30px] overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex-shrink-0 transition-transform hover:scale-[1.02] border border-blue-900/30 group">
      
      {/* Info Section */}
      <div className="relative flex-1 flex bg-[#0B0F19] overflow-hidden p-4 sm:p-6">
        
        {/* 🟢 2. The Conditional Backdrop */}
        {hasCustomImage(venue.profile_pic) ? (
            <>
                <img 
                    src={venue.profile_pic} 
                    alt={venue.name} 
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Overlay for readability */}
                <div className="absolute inset-0 bg-black/60" />
            </>
        ) : (
            <>
                {/* Background Ambient Glows */}
                <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-purple-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/30 transition-colors duration-700"></div>
                <div className="absolute bottom-[-30%] right-[20%] w-[200px] h-[200px] bg-blue-600/20 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/30 transition-colors duration-700"></div>
                <div className="absolute top-[20%] right-[50%] w-[100px] h-[100px] bg-cyan-500/10 rounded-full blur-xl pointer-events-none"></div>
            </>
        )}

        {/* Left Side (Status & Users) */}
        <div className="relative z-10 flex flex-col justify-between w-[35%] border-r border-white/5 pr-4">
          
          {/* Status Indicator (Restored to Top Left flow) */}
          <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest mt-1">
            <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] animate-pulse ${venueStatus.color}`}></span>
            <span className="drop-shadow-md text-gray-300">{venueStatus.label}</span>
          </div>

          {/* REALISTIC 1-40 COUNTER RESTORED (Using liveCount hook) */}
          <div>
            <div className="text-5xl sm:text-6xl font-bold text-white mb-[-8px] font-['Bebas_Neue'] tracking-widest drop-shadow-lg">
              {liveCount}
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-2">
              BHNL Visits
            </div>
          </div>
          
        </div>

        {/* Right Side (7-Days Schedule) */}
        <div className="relative z-10 flex items-center w-[65%] pl-4 pr-1 gap-2 overflow-x-auto hide-scrollbar flex-nowrap">
          {(venue.schedule || []).map((slot, i) => (
            <button 
                key={i} 
                onClick={() => onOpenEvent(slot, venue)}
                className="flex flex-col items-center justify-center gap-2 hover:bg-white/10 py-2 px-1 rounded-xl transition-all min-w-[40px] sm:min-w-[48px] flex-shrink-0"
            >
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{slot.day}</div>
              <div className="text-2xl sm:text-3xl flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                {slot.event ? EVENT_EMOJIS[slot.event.event_type] || EVENT_EMOJIS['General'] : <span className="text-gray-700 text-xl opacity-50">➖</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="h-[50px] bg-[#05070A] border-t border-blue-900/40 text-white flex items-center justify-between px-4 sm:px-6 text-xs sm:text-sm font-bold uppercase tracking-widest">
        <button onClick={() => onOpenVenue(venue)} className="hover:text-cyan-400 truncate flex-1 text-left transition-colors">
            {venue.name}
        </button>
        
        <div className="flex items-center gap-4">
            <span className="text-gray-500 text-[10px] sm:text-xs">{venue.currentTime}</span>
            {currentUser?.account_type === 'Admin' && (
                <button onClick={() => onAdminEdit(venue)} className="text-gray-500 hover:text-white text-xl leading-none pb-1 transition-colors">⋮</button>
            )}
        </div>
      </div>

    </div>
  )
}