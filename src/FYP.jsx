import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import FeedPost from './FeedPost'
import VenueCard, { EVENT_EMOJIS } from './VenueCard'

export default function FYP({ currentUser, onViewEntity }) {
  const [activeMiniPage, setActiveMiniPage] = useState('Feed') 

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-32">
      
      {/* HUB HEADER & SUB-NAVIGATION */}
      <div className="p-4 pt-6 sticky top-[68px] sm:top-[76px] bg-[#030712]/95 backdrop-blur-xl z-40 border-b border-gray-800 shadow-xl">
         <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            {activeMiniPage === 'Feed' && 'THE FEED'}
            {activeMiniPage === 'Events' && 'THE LINEUP'}
            {activeMiniPage === 'Journal' && 'THE JOURNAL'}
         </h2>
         
         <div className="flex gap-2 mt-4 bg-gray-900 p-1.5 rounded-xl border border-gray-800 shadow-inner">
            {['Feed', 'Events', 'Journal'].map(tab => (
               <button 
                 key={tab} 
                 onClick={() => setActiveMiniPage(tab)}
                 className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    activeMiniPage === tab 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                 }`}
               >
                 {tab}
               </button>
            ))}
         </div>
      </div>

      {/* MINI-PAGE RENDERING */}
      <div className="p-4 mt-2">
         {activeMiniPage === 'Feed' && <MainFeed currentUser={currentUser} onViewEntity={onViewEntity} />}
         {activeMiniPage === 'Events' && <EventsFeed currentUser={currentUser} />}
         {activeMiniPage === 'Journal' && <JournalFeed currentUser={currentUser} />}
      </div>

    </div>
  )
}

/* =========================================
   1. MAIN FEED (Unchanged)
========================================= */
function MainFeed({ currentUser, onViewEntity }) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLivingFeed = async () => {
      setLoading(true)
      const { data: rawPosts } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(20)
      const { data: profiles } = await supabase.from('profiles').select('id, username, profile_pic')
      
      const formattedPosts = (rawPosts || []).map(post => {
          const author = profiles?.find(p => p.id === post.author_id || p.id === post.user_id) || {}
          return {
              id: `post_${post.id}`, type: 'post', timestamp: new Date(post.created_at).getTime(),
              data: { ...post, username: author.username || 'Unknown', profile_pic: author.profile_pic }
          }
      })
      setFeed(formattedPosts)
      setLoading(false)
    }
    fetchLivingFeed()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6 animate-fade-in">
      {feed.length === 0 ? (
          <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl">
            <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">No recent updates.</p>
          </div>
      ) : (
          feed.map(item => <FeedPost key={item.id} item={item} currentUser={currentUser} onViewEntity={onViewEntity} />)
      )}
    </div>
  )
}

/* =========================================
   2. EVENTS MINI-PAGE & MODALS
========================================= */
function EventsFeed({ currentUser }) {
  const [venueLineups, setVenueLineups] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal States
  const [selectedVenueInfo, setSelectedVenueInfo] = useState(null)
  const [selectedEventInfo, setSelectedEventInfo] = useState(null)
  const [isEditingEvent, setIsEditingEvent] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    const { data: venues } = await supabase.from('pages').select('*').eq('page_type', 'Venue')
    const { data: upcomingEvents } = await supabase.from('events').select('*').eq('status', 'approved').gte('event_date', new Date().toISOString()).order('event_date', { ascending: true })

    const days = []
    const today = new Date()
    for(let i = 0; i < 5; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        days.push({ dateString: d.toDateString(), dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().substring(0,3), rawDate: d })
    }

    const processedLineups = (venues || []).map(v => {
        let isLiveNow = false

        const schedule = days.map(dayObj => {
            const eventToday = upcomingEvents?.find(e => e.venue === v.name && new Date(e.event_date).toDateString() === dayObj.dateString)
            
            // Check if live right now (within 4 hours of start)
            if (eventToday) {
                const start = new Date(eventToday.event_date)
                const end = new Date(start.getTime() + (4 * 60 * 60 * 1000))
                if (today >= start && today <= end) isLiveNow = true
            }

            return { day: dayObj.dayLabel, date: dayObj.rawDate, event: eventToday || null }
        })

        // Placeholder for the requested BHNL Visits stat
        const mockVisits = (v.name.length * 42) % 3000 + 500

        return {
            ...v,
            currentTime: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            userCount: mockVisits,
            isLive: isLiveNow,
            schedule: schedule
        }
    })

    // WE NO LONGER FILTER OUT EMPTY VENUES. WE SHOW THEM ALL.
    setVenueLineups(processedLineups)
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
      const payload = {
          title: fd.get('title'),
          description: fd.get('description'),
          event_type: fd.get('event_type'),
          entertainer: fd.get('entertainer'),
          venue: selectedEventInfo.venue.name,
          status: 'approved',
          event_date: selectedEventInfo.slot.date.toISOString() // Sets it to the day clicked
      }

      if (selectedEventInfo.slot.event) {
          // Update existing
          await supabase.from('events').update(payload).eq('id', selectedEventInfo.slot.event.id)
      } else {
          // Create new
          await supabase.from('events').insert([payload])
      }

      setSelectedEventInfo(null)
      fetchEvents() // Refresh the lineup!
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="animate-fade-in relative w-full">
        <div className="flex flex-col space-y-6 w-full">
            {venueLineups.map((venue, idx) => (
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

        {/* VENUE INFO MODAL */}
        {selectedVenueInfo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md overflow-hidden animate-slide-up-fast">
                    <div className="h-32 bg-blue-900/40 relative">
                        <button onClick={() => setSelectedVenueInfo(null)} className="absolute top-4 right-4 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                    </div>
                    <div className="px-6 pb-6 relative">
                        <img src={selectedVenueInfo.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedVenueInfo.name}`} className="w-24 h-24 rounded-full border-4 border-gray-900 bg-black absolute -top-12 object-cover" alt="" />
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

        {/* EVENT INFO / EDIT MODAL */}
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
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Details (Time, Entry, Bio)</label>
                                <textarea name="description" defaultValue={selectedEventInfo.slot.event?.description || ''} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm h-24 focus:border-blue-500 outline-none resize-none"></textarea>
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

/* =========================================
   3. JOURNAL (Classic Chatroom UI)
========================================= */
function JournalFeed({ currentUser }) {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
     fetchJournal()
     const sub = supabase.channel('journal-channel')
        .on('postgres', { event: 'INSERT', schema: 'public', table: 'journal' }, payload => {
            // Because flex-col-reverse places newest at the top of the array visually at the bottom
            setEntries(prev => [payload.new, ...prev])
        }).subscribe()

     return () => supabase.removeChannel(sub)
  }, [])

  const fetchJournal = async () => {
     const { data } = await supabase.from('journal').select('*').order('created_at', { ascending: false }).limit(50)
     if (data) setEntries(data)
     setLoading(false)
  }

  const handleSubmit = async (e) => {
     e.preventDefault()
     if (!text.trim() || text.length > 77) return
     const payload = { content: text.trim(), user_id: currentUser?.id }
     setText('') 
     await supabase.from('journal').insert([payload])
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        
        {/* CHAT DISPLAY (Auto-scrolls to bottom via flex-col-reverse) */}
        <div className="flex-1 bg-[#090812] border-2 border-gray-800 rounded-t-3xl p-4 overflow-y-auto flex flex-col-reverse hide-scrollbar shadow-inner">
            {loading ? <div className="text-center text-gray-500 text-xs py-10">Connecting to secure server...</div> : (
                entries.map((entry, index) => {
                    const isMine = entry.user_id === currentUser?.id
                    
                    // Simple logic to group bubbles from the same "Anonymous" user if they rapid-fire (optional UI polish)
                    const prevEntry = entries[index + 1]
                    const isSameAsPrev = prevEntry && prevEntry.user_id === entry.user_id

                    return (
                        <div key={entry.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} ${isSameAsPrev ? 'mb-1' : 'mb-4'}`}>
                            <div className={`max-w-[75%] p-3 rounded-2xl ${
                                isMine 
                                ? 'bg-blue-600 text-white rounded-br-sm shadow-[0_5px_15px_rgba(59,130,246,0.3)]' 
                                : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                            }`}>
                                <p className="text-sm break-words leading-snug">{entry.content}</p>
                                <div className={`text-[8px] mt-1.5 font-bold uppercase tracking-widest ${isMine ? 'text-blue-200 text-right' : 'text-gray-500 text-left'}`}>
                                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    )
                })
            )}
        </div>

        {/* INPUT FORM */}
        <form onSubmit={handleSubmit} className="bg-gray-900 p-3 rounded-b-3xl border-2 border-t-0 border-gray-800 flex flex-col gap-2">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    maxLength={77}
                    placeholder="Send an anonymous message..."
                    className="flex-1 bg-black border border-gray-700 text-white rounded-full px-5 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
                <button type="submit" disabled={!text.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                    <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
            <div className="px-4 flex justify-between">
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">End-to-End Anonymous</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${text.length === 77 ? 'text-red-500' : 'text-gray-600'}`}>{77 - text.length} / 77</span>
            </div>
        </form>

    </div>
  )
}