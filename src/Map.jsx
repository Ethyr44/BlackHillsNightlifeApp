import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import JournalFeed from './JournalFeed'

export default function Map({ currentUser, onViewEntity }) {
  const mapRef = useRef(null)
  const [venues, setVenues] = useState([])
  const [activeVenue, setActiveVenue] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  
  const venueMarkersRef = useRef([])
  const userMarkersRef = useRef([]) 
  const [activeUsers, setActiveUsers] = useState([])

  useEffect(() => {
    async function init() {
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const { data: eventData } = await supabase.from('events').select('*').eq('status', 'approved').gte('event_date', startOfToday.toISOString())

      const processedVenues = venueData ? venueData.map(v => {
         const now = new Date()
         const todayStr = now.toDateString()
         const todayDayOfWeek = now.getDay()

         const todaysEvents = (eventData || []).filter(e => {
            if (e.venue !== v.name) return false;
            const eDate = new Date(e.event_date);
            if (e.recurring_weekly) return eDate.getDay() === todayDayOfWeek;
            return eDate.toDateString() === todayStr;
         })

         let isLiveNow = false;
         if (todaysEvents.length > 0) {
             const activeEvent = todaysEvents[0]
             const start = new Date(activeEvent.event_date)
             if (activeEvent.recurring_weekly) {
                 start.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
             }
             const end = new Date(start.getTime() + (4 * 60 * 60 * 1000));
             if (now >= start && now <= end) isLiveNow = true;
         }

         return { ...v, isLive: isLiveNow, eventToday: todaysEvents.length > 0 ? todaysEvents[0] : null }
      }) : []

      setVenues(processedVenues)

      // BULLETPROOF SCRIPT LOADER (With Strict Mode Fix)
      if (window.google && window.google.maps && window.google.maps.Map) {
        initializeMap(processedVenues)
      } else {
        window.initMap = () => {
            initializeMap(processedVenues)
        }

        if (!document.getElementById('google-maps-script')) {
            const script = document.createElement('script')
            script.id = 'google-maps-script'
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyD4wqqOrYrTCgelaTzepbdKd6NV7XOMsBE&libraries=places,marker&map_ids=e48372c619f58e7f83289663&v=weekly&loading=async&callback=initMap`
            script.async = true 
            script.defer = true
            document.head.appendChild(script)
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
      const fetchUsers = async () => {
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          const { data } = await supabase.from('profiles')
              .select('id, current_lat, current_lng')
              .not('current_lat', 'is', null)
              .gte('last_active', twoHoursAgo)
          if (data) setActiveUsers(data)
      }
      
      fetchUsers()

      const sub = supabase.channel('public-users-location')
          .on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
              setActiveUsers(prev => {
                  const exists = prev.find(u => u.id === payload.new.id)
                  if (exists) return prev.map(u => u.id === payload.new.id ? payload.new : u)
                  else if (payload.new.current_lat) return [...prev, payload.new]
                  return prev
              })
          }).subscribe()

      return () => supabase.removeChannel(sub)
  }, [])

  async function initializeMap(venueData) {
    if (!mapRef.current || !window.google) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 44.0805, lng: -103.2310 },
      zoom: 13,
      disableDefaultUI: true, 
      zoomControl: true,
      mapId: 'e48372c619f58e7f83289663'
    })

    setMapInstance(map)

    if (venueData && venueData.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()

      venueData.forEach(venue => {
        const position = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
        const dotDiv = document.createElement('div')
        
        let dotColor = 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.8)]' 
        let dotSize = 'w-4 h-4'
        let animation = ''

        if (venue.eventToday) {
            dotColor = 'bg-[#ff2d78] shadow-[0_0_20px_rgba(255,45,120,0.9)]'
            if (venue.isLive) {
                dotSize = 'w-5 h-5'
                animation = 'animate-pulse'
            }
        }

        dotDiv.innerHTML = `<div class="${dotSize} ${dotColor} ${animation} rounded-full border-2 border-white transition-transform duration-300"></div>`
        dotDiv.style.cursor = 'pointer'

        const marker = new window.google.maps.marker.AdvancedMarkerElement({ position, map, title: venue.name || 'Venue', content: dotDiv })
        marker.addListener('gmp-click', () => {
          setActiveVenue(venue)
          map.panTo(position)
          map.setZoom(16)
        })

        venueMarkersRef.current.push(marker)
        bounds.extend(position)
      })

      if (venueData.length > 1) map.fitBounds(bounds)
    }
  }

  useEffect(() => {
      if (!mapInstance || !window.google) return

      userMarkersRef.current.forEach(marker => { marker.map = null })
      userMarkersRef.current = []

      activeUsers.forEach(user => {
          if (!user.current_lat || !user.current_lng) return

          const position = { lat: parseFloat(user.current_lat), lng: parseFloat(user.current_lng) }
          const dotDiv = document.createElement('div')
          
          dotDiv.innerHTML = `<div class="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,1)] border border-white animate-pulse"></div>`

          const marker = new window.google.maps.marker.AdvancedMarkerElement({ position, map: mapInstance, content: dotDiv })
          userMarkersRef.current.push(marker)
      })
  }, [activeUsers, mapInstance])

  const handleVenueClick = (venue) => {
      setActiveVenue(venue)
      if (mapInstance && venue.lat && venue.lng) {
          mapInstance.panTo({ lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) })
          mapInstance.setZoom(16)
      }
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in flex flex-col gap-6 pb-24">
      
      <div className="text-center">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">The Scene</h2>
        <div className="flex justify-center gap-4 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff2d78] flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff2d78] animate-pulse"></span> Event</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Venue</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> User</span>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 shrink-0">
        {venues.map(venue => (
            <button 
                key={venue.id}
                onClick={() => handleVenueClick(venue)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                    activeVenue?.id === venue.id 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                    : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-white'
                }`}
            >
                {venue.name}
            </button>
        ))}
      </div>

      {/* 🟢 THE MERGED MAP & JOURNAL HUD */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-blue-900/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col bg-[#050505]">
        
        {/* Map Viewport (Takes up the majority of the space) */}
        <div className="relative w-full h-[60vh] min-h-[450px]">
            {!mapInstance && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#090812] text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                    Initializing Radar...
                </div>
            )}
            <div ref={mapRef} className="absolute inset-0 bg-[#090812] z-0"></div>

            {/* Venue Info Overlay (Pops over the map when a pin is clicked) */}
            {activeVenue && (
                <div className="absolute top-4 left-4 right-4 p-4 rounded-2xl bg-black/80 backdrop-blur-md border border-blue-500/50 shadow-2xl z-30 pointer-events-auto">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">{activeVenue.name}</h3>
                        <button onClick={() => setActiveVenue(null)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                    {activeVenue.eventToday ? (
                        <div className="mb-3">
                            <span className="text-[#ff2d78] text-[9px] font-bold uppercase tracking-widest block">{activeVenue.isLive ? '🔥 LIVE NOW' : '📅 TODAY'}</span>
                            <span className="text-white text-xs font-bold">{activeVenue.eventToday.title}</span>
                        </div>
                    ) : (
                        <span className="text-purple-400 text-[9px] font-bold uppercase tracking-widest block mb-3">Official BHNL Venue</span>
                    )}
                    <button onClick={() => onViewEntity(activeVenue.name)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors shadow-lg">
                        Full Profile
                    </button>
                </div>
            )}
        </div>

        {/* 🟢 The Journal Input Bar (Sits completely beneath the map) */}
        <div className="relative w-full z-40 border-t border-gray-800">
            <JournalFeed currentUser={currentUser} />
        </div>

      </div>