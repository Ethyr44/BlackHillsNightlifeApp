import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'

// 🟢 NEW: Distance Calculator
function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) * 5280;
}

export default function EventsFeed({ currentUser, onViewEntity }) {
  const [venueLineups, setVenueLineups] = useState([])
  const [displayedVenues, setDisplayedVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLoc, setUserLoc] = useState(null) // 🟢 NEW: Store user location
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  const [selectedVenueInfo, setSelectedVenueInfo] = useState(null)
  const [selectedEventInfo, setSelectedEventInfo] = useState(null)
  const [isEditingEvent, setIsEditingEvent] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)

    // 🟢 NEW: Grab user location for distance scoring
    navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Location denied, skipping distance sorting.")
    )

    const { data: venues } = await supabase.from('pages').select('*').eq('page_type', 'Venue')
    
    // 🟢 FIX: Fetch ALL approved events, not just ones strictly >= today, 
    // so we can catch older events that are set to recur.
    const { data: allEvents } = await supabase.from('events')
        .select('*')
        .eq('status', 'approved')

    const days = []
    const today = new Date()
    today.setHours(0,0,0,0) 

    for(let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        days.push({ dateString: d.toISOString().split('T')[0], dayOfWeek: d.getDay(), dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().substring(0,3), rawDate: d })
    }

    const processedLineups = (venues || []).map(v => {
        let isLiveNow = false
        let hasAnyEvent = false

        const schedule = days.map(dayObj => {
            // Find matching event for this specific slot day
            const eventToday = allEvents?.find(e => {
                if (e.venue !== v.name) return false;
                
                // 🟢 FIX: Ensure raw DB dates are parsed as UTC to prevent timezone drifting
                const rawDate = e.event_date;
                const safeDateStr = rawDate.includes('Z') || rawDate.includes('+') ? rawDate : rawDate + 'Z';
                const eDate = new Date(safeDateStr);
                
                if (e.recurring_weekly) {
                    return eDate.getDay() === dayObj.rawDate.getDay();
                }
                return eDate.getFullYear() === dayObj.rawDate.getFullYear() &&
                       eDate.getMonth() === dayObj.rawDate.getMonth() &&
                       eDate.getDate() === dayObj.rawDate.getDate();
            })
            
            if (eventToday) {
                hasAnyEvent = true
                const start = new Date(eventToday.event_date)
                if (eventToday.recurring_weekly) {
                    start.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
                }
                const end = new Date(start.getTime() + (4 * 60 * 60 * 1000))
                const now = new Date()
                if (now >= start && now <= end) isLiveNow = true
            }

            return { day: dayObj.dayLabel, date: dayObj.rawDate, event: eventToday || null }
        })

        const mockVisits = (v.name.length * 7) % 40 + 1
        return {
            ...v,
            currentTime: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            userCount: mockVisits,
            isLive: isLiveNow,
            schedule: schedule,
            hasAnyEvent
        }
    })

    // 🟢 THE SMART ALGORITHM: Score and Sort the Venues
    const scoredVenues = processedLineups.map(item => {
        let score = 0;
        const todayEvent = item.schedule[0]?.event;
        const tomorrowEvent = item.schedule[1]?.event;

        // 1. Hotspots / Featured / Major Events
        if (item.is_featured || todayEvent?.event_type === 'KSocial' || todayEvent?.event_type === 'Karaoke Crawl') {
            score += 1000;
        }

        // 2. Events Happening Today
        if (todayEvent) score += 500;

        // 3 & 4. Proximity (If user allowed location)
        if (userLoc && item.lat && item.lng) {
            const dist = getDistanceInFeet(userLoc.lat, userLoc.lng, item.lat, item.lng);
            if (dist < 5280) { // Within 1 mile radius
                if (todayEvent) score += 300; // Event near user
                else score += 200; // Venue near user
            }
        }

        // 5. Events Happening Tomorrow
        if (tomorrowEvent) score += 100;

        // 6. User Preferences Match
        const userPreferences = [
            ...(currentUser?.pref_venues || []), 
            ...(currentUser?.pref_events || []), 
            ...(currentUser?.pref_genres || [])
        ];
        
        if (userPreferences.length > 0 && item.tags) {
            const matches = item.tags.some(tag => userPreferences.includes(tag));
            if (matches) score += 50;
        }

        return { ...item, priorityScore: score };
    }).sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name)); // Sort Highest Score to Lowest

    setVenueLineups(scoredVenues)
    setDisplayedVenues(scoredVenues.slice(0, ITEMS_PER_PAGE))
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [])

  const handleOpenEvent = (slot, venue) => {
      setSelectedEventInfo({ slot, venue })
      setIsEditingEvent(false)
  }

  const handleSaveEvent = async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      
      const safeDate = new Date(selectedEventInfo.slot.date)
      safeDate.setHours(12, 0, 0, 0)

      const payload = {
          title: fd.get('title'),
          description: fd.get('description'),
          event_type: fd.get('event_type'),
          entertainer: fd.get('entertainer'),
          recurring_weekly: fd.get('recurring_weekly') === 'on',
          venue: selectedEventInfo.venue.name,
          status: 'approved',
          event_date: safeDate.toISOString(),
          created_by: currentUser.id 
      }

      let dbError = null;

      if (selectedEventInfo.slot.event) {
          const { error } = await supabase.from('events').update(payload).eq('id', selectedEventInfo.slot.event.id)
          dbError = error
      } else {
          const { error } = await supabase.from('events').insert([payload])
          dbError = error
      }

      if (dbError) {
          alert(`Failed to save event! Error: ${dbError.message}`)
          return;
      }

      setSelectedEventInfo(null)
      fetchEvents() 
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  const loadMore = () => {
      const nextPage = page + 1
      setDisplayedVenues(venueLineups.slice(0, nextPage * ITEMS_PER_PAGE))
      setPage(nextPage)
  }

  return (
    <div className="animate-fade-in relative w-full">
        <div className="flex flex-col space-y-6 w-full">
            {displayedVenues.map((venue, idx) => (
                <VenueCard 
                    key={idx} 
                    venue={venue} 
                    currentUser={currentUser}
                    onOpenVenue={setSelectedVenueInfo}
                    onOpenEvent={handleOpenEvent}
                    onAdminEdit={(v) => alert("To edit events, click directly on the Day abbreviation inside the card! To edit Venue info, go to the Admin Console tab.")}
                />
            ))}
        </div>

        {venueLineups.length > displayedVenues.length && (
            <button 
                onClick={loadMore}
                className="w-full bg-[#090812] border-2 border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/50 py-4 rounded-3xl text-xs font-bold uppercase tracking-widest transition-all mt-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            >
                Load More Venues
            </button>
        )}

        {selectedVenueInfo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden animate-slide-up-fast">
                    <div className="h-32 bg-blue-900/40 relative">
                        <button onClick={() => setSelectedVenueInfo(null)} className="absolute top-4 right-4 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                    </div>
                    <div className="px-6 pb-6 relative">
                        <img src={selectedVenueInfo.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedVenueInfo.name}`} className="w-24 h-24 rounded-full border-4 border-gray-900 bg-black absolute -top-12 object-cover" alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedVenueInfo.name}` }} />
                        <h2 className="text-3xl font-['Bebas_Neue'] tracking-widest text-white pt-14 mb-1">{selectedVenueInfo.name}</h2>
                        <div className="flex gap-2 mb-4">
                            <span className="bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Venue</span>
                            {selectedVenueInfo.cost && <span className="bg-green-900/30 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">{selectedVenueInfo.cost}</span>}
                        </div>
                        
                        <div className="space-y-3 text-sm text-gray-300">
                            {selectedVenueInfo.address && <p className="flex items-start gap-3"><span className="text-lg">📍</span> <span>{selectedVenueInfo.address}</span></p>}
                            {selectedVenueInfo.phone && <p className="flex items-center gap-3"><span className="text-lg">📞</span> <span>{selectedVenueInfo.phone}</span></p>}
                            {selectedVenueInfo.website && <p className="flex items-center gap-3"><span className="text-lg">🌐</span> <a href={selectedVenueInfo.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Website</a></p>}
                            {selectedVenueInfo.facebook && <p className="flex items-center gap-3"><span className="text-lg">👍</span> <a href={selectedVenueInfo.facebook} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Facebook</a></p>}
                            {selectedVenueInfo.bio && <p className="mt-4 p-4 bg-black/50 rounded-xl text-xs leading-relaxed italic border border-gray-800">{selectedVenueInfo.bio}</p>}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {selectedEventInfo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6 relative animate-slide-up-fast max-h-[90vh] overflow-y-auto">
                    <button onClick={() => setSelectedEventInfo(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">✕</button>
                    
                    <h2 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider mb-1">
                        {selectedEventInfo.venue.name} • {selectedEventInfo.slot.day}
                    </h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">{selectedEventInfo.slot.date.toDateString()}</p>

                    {isEditingEvent ? (
                        <form onSubmit={handleSaveEvent} className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Event Title</label>
                                <input name="title" defaultValue={selectedEventInfo.slot.event?.title || ''} required className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Event Type (Emoji)</label>
                                    <select name="event_type" defaultValue={selectedEventInfo.slot.event?.event_type || 'General'} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none">
                                        {Object.keys(EVENT_EMOJIS).map(type => <option key={type} value={type}>{EVENT_EMOJIS[type]} {type}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Host/Act</label>
                                    <input name="entertainer" defaultValue={selectedEventInfo.slot.event?.entertainer || ''} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Details</label>
                                <textarea name="description" defaultValue={selectedEventInfo.slot.event?.description || ''} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm h-24 focus:border-blue-500 outline-none resize-none"></textarea>
                            </div>
                            
                            <div className="flex items-center gap-3 bg-black/50 border border-gray-700 p-3 rounded-lg mt-2">
                                <input type="checkbox" name="recurring_weekly" id="recurring" defaultChecked={selectedEventInfo.slot.event?.recurring_weekly || false} className="w-4 h-4 accent-blue-500" />
                                <label htmlFor="recurring" className="text-xs text-gray-300 font-bold uppercase tracking-widest">Recurring Weekly Event</label>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setIsEditingEvent(false)} className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg">Save Event</button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            {selectedEventInfo.slot.event ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-4xl">{EVENT_EMOJIS[selectedEventInfo.slot.event.event_type] || '❗'}</div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white leading-tight">{selectedEventInfo.slot.event.title}</h3>
                                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">{selectedEventInfo.slot.event.event_type}</p>
                                        </div>
                                    </div>
                                    {selectedEventInfo.slot.event.entertainer && (
                                        <div className="bg-black/50 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                                            <span className="text-xl">🎤</span>
                                            <div>
                                                <span className="block text-[9px] text-gray-500 font-bold uppercase tracking-widest">Hosted By</span>
                                                <span className="text-white text-sm font-bold">{selectedEventInfo.slot.event.entertainer}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedEventInfo.slot.event.description || "No specific details provided."}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-10 bg-black/50 border border-gray-800 rounded-2xl">
                                    <span className="text-4xl block mb-2 opacity-50">📅</span>
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No event scheduled yet.</p>
                                </div>
                            )}

                            {currentUser?.account_type === 'Admin' && (
                                <button onClick={() => setIsEditingEvent(true)} className="w-full mt-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-gray-700">
                                    {selectedEventInfo.slot.event ? '✏️ Edit Event Details' : '➕ Create Event Here'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  )
}