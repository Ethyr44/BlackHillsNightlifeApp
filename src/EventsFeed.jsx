import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'
import { toast } from './GlobalToast'

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
  const [rawLineups, setRawLineups] = useState([]) // 🟢 NEW: Stores the unsorted master list
  const [sortMode, setSortMode] = useState('distance') // 🟢 NEW: 'distance' or 'eventsFirst'
  
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
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
              (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              (err) => console.log("Location access denied or unavailable.")
          )
      }
      fetchFeedData()
  }, [])

  const fetchFeedData = async () => {
    setLoading(true)
    const { data: venuesData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').order('name', { ascending: true })
    const { data: eventsData } = await supabase.from('events').select('*').eq('status', 'approved')

    const today = new Date()
    const currentDayIndex = today.getDay() 

    const builtLineups = (venuesData || []).map(venue => {
        const schedule = []
        for (let i = 0; i < 7; i++) {
            const slotDate = new Date(today)
            slotDate.setDate(today.getDate() + i)
            const dayName = slotDate.toLocaleDateString('en-US', { weekday: 'short' })

            const event = eventsData?.find(e => {
                if (e.venue !== venue.name) return false;
                const rawDate = e.event_date;
                const safeDateStr = rawDate.includes('Z') || rawDate.includes('+') ? rawDate : rawDate + 'Z';
                const eDate = new Date(safeDateStr);
                
                if (e.recurring_weekly) {
                    return eDate.getDay() === slotDate.getDay();
                }
                return eDate.getFullYear() === slotDate.getFullYear() &&
                       eDate.getMonth() === slotDate.getMonth() &&
                       eDate.getDate() === slotDate.getDate();
            })

            schedule.push({ day: dayName, date: slotDate, event: event || null })
        }
        
        // 🟢 FIX 1: Merge schedule directly into the venue object
        return { ...venue, schedule }
    })

    // 🟢 FIX: Save raw data. The new effect below handles the sorting.
    setRawLineups(builtLineups)
    setLoading(false)
  }

  // 🟢 NEW: Dynamic Sorting Engine
  useEffect(() => {
      if (rawLineups.length === 0) return;

      const sorted = [...rawLineups];

      const getDist = (venue) => {
          if (!userLoc || !venue.lat || !venue.lng) return Infinity;
          return getDistanceInFeet(userLoc.lat, userLoc.lon, venue.lat, venue.lng);
      };

      // Helper to score a venue by its earliest event day (0 = Today, 1 = Tomorrow, ..., 7 = No Events)
      const getEventScore = (venue) => {
          for (let i = 0; i < 7; i++) {
              if (venue.schedule[i]?.event) return i;
          }
          return 7; 
      };

      sorted.sort((a, b) => {
          // Priority 1: Events First Mode
          if (sortMode === 'eventsFirst') {
              const scoreA = getEventScore(a);
              const scoreB = getEventScore(b);

              if (scoreA !== scoreB) {
                  return scoreA - scoreB; // Lower score (earlier event) floats to the top
              }
          }

          // Priority 2 (or Tie-Breaker): Distance from User
          return getDist(a) - getDist(b);
      });

      setVenueLineups(sorted);
      setDisplayedVenues(sorted.slice(0, ITEMS_PER_PAGE));
      setPage(1); // 🟢 Important: Reset pagination to page 1 when sort changes
  }, [rawLineups, userLoc, sortMode]);

  const loadMore = () => {
      const nextVenues = venueLineups.slice(0, (page + 1) * ITEMS_PER_PAGE)
      setDisplayedVenues(nextVenues)
      setPage(p => p + 1)
  }

  const handleOpenEvent = (venue, slot) => {
      setSelectedVenueInfo(venue)
      setSelectedEventInfo({ slot })
      setIsEditingEvent(false)
      if (slot.event) {
          setEditFormData({ title: slot.event.title, description: slot.event.description || '', event_type: slot.event.event_type || 'Live Music' })
      } else {
          setEditFormData({ title: '', description: '', event_type: 'Live Music' })
      }
  }

  const handleSaveEvent = async () => {
      const payload = {
          title: editFormData.title,
          description: editFormData.description,
          event_type: editFormData.event_type,
          venue: selectedVenueInfo.name,
          event_date: selectedEventInfo.slot.date.toISOString(),
          status: 'approved'
      }

      if (selectedEventInfo.slot.event) {
          await supabase.from('events').update(payload).eq('id', selectedEventInfo.slot.event.id)
          toast.success("Event updated!")
      } else {
          await supabase.from('events').insert([payload])
          toast.success("Event created!")
      }
      setIsEditingEvent(false)
      setSelectedEventInfo(null)
      fetchFeedData()
  }

  // 🟢 NEW: Delete Event Logic
  const handleDeleteEvent = async () => {
      if (!selectedEventInfo?.slot?.event?.id) return
      if (!window.confirm("Are you sure you want to permanently delete this event?")) return
      
      const { error } = await supabase.from('events').delete().eq('id', selectedEventInfo.slot.event.id)
      
      if (error) {
          toast.error(`Error deleting event: ${error.message}`)
      } else {
          toast.success("Event deleted successfully!")
          setIsEditingEvent(false)
          setSelectedEventInfo(null)
          fetchFeedData()
      }
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
        {loading ? (
            <div className="text-center p-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
        ) : (
            <>
                {/* 🟢 NEW: Sorting Toggles */}
                <div className="flex gap-2 mb-4 px-1">
                    <button
                        onClick={() => setSortMode('distance')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                            sortMode === 'distance' 
                            ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                            : 'bg-[#0B0F19] border border-gray-800 text-gray-500 hover:text-white'
                        }`}
                    >
                        📍 Nearest First
                    </button>
                    <button
                        onClick={() => setSortMode('eventsFirst')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                            sortMode === 'eventsFirst' 
                            ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' 
                            : 'bg-[#0B0F19] border border-gray-800 text-gray-500 hover:text-white'
                        }`}
                    >
                        🗓️ Events First
                    </button>
                </div>

                {displayedVenues.map((venue) => (
                    <VenueCard 
                        key={venue.id} 
                        venue={venue} 
                        currentUser={currentUser} 
                        onOpenVenue={() => onViewEntity(venue.name)}
                        onOpenEvent={(slot, v) => handleOpenEvent(v || venue, slot)}
                        onAdminEdit={() => alert("To edit venue details, please visit the Admin Console -> Manage Venues.")}
                    />
                ))}
                
                {displayedVenues.length < venueLineups.length && (
                    <button onClick={loadMore} className="w-full bg-[#0B0F19] border border-blue-900/30 hover:border-blue-500/50 hover:bg-blue-900/20 text-blue-400 py-4 rounded-[30px] font-bold uppercase tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                        Load More Venues
                    </button>
                )}
            </>
        )}

        {/* The Event Details Modal */}
        {selectedEventInfo && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-[#090812] border border-gray-800 p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
                    <button onClick={() => setSelectedEventInfo(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white font-bold text-xl">✕</button>
                    
                    <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-1">{selectedVenueInfo.name}</h3>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                        {selectedEventInfo.slot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>

                    {isEditingEvent ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Event Title</label>
                                <input type="text" value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Event Type</label>
                                <select value={editFormData.event_type} onChange={e => setEditFormData({...editFormData, event_type: e.target.value})} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none">
                                    {Object.keys(EVENT_EMOJIS).map(type => <option key={type} value={type}>{EVENT_EMOJIS[type]} {type}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Description</label>
                                <textarea value={editFormData.description} onChange={e => setEditFormData({...editFormData, description: e.target.value})} className="w-full h-32 bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setIsEditingEvent(false)} className="flex-1 border border-gray-700 text-gray-400 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleSaveEvent} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-colors">Save Event</button>
                            </div>
                            
                            {/* 🟢 NEW: Delete Event Button */}
                            {selectedEventInfo.slot.event && (
                                <button onClick={handleDeleteEvent} className="w-full mt-2 bg-red-900/20 border border-red-900/50 text-red-500 hover:bg-red-500 hover:text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg">
                                    Delete Event
                                </button>
                            )}
                        </div>
                    ) : (
                        <div>
                            {selectedEventInfo.slot.event ? (
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-white text-xl font-bold">{selectedEventInfo.slot.event.title}</h4>
                                        <span className="text-[10px] text-purple-400 uppercase tracking-widest font-bold bg-purple-900/20 px-2 py-1 rounded border border-purple-500/30 inline-block mt-2">
                                            {EVENT_EMOJIS[selectedEventInfo.slot.event.event_type] || '🗓️'} {selectedEventInfo.slot.event.event_type}
                                        </span>
                                    </div>
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