import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import JournalFeed from './JournalFeed'
import { useAppConfig } from './useAppConfig'

// Haversine Formula to accurately calculate distance between two GPS coordinates in feet
function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of the earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; 
    return d * 5280; // Convert to feet
}

export default function Map({ currentUser, onViewEntity }) {
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const config = useAppConfig()

  // Map Data
  const [venues, setVenues] = useState([])
  const [geoGifts, setGeoGifts] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  
  // UI State
  const [activeFilter, setActiveFilter] = useState('All') // 'All', 'Venues', 'Events', 'Geo-Gifts', 'Hotspots'
  const [activeVenue, setActiveVenue] = useState(null)
  const [activeGift, setActiveGift] = useState(null)
  const [claiming, setClaiming] = useState(false)

  const markersRef = useRef([]) // Unified ref for venues and gifts
  const userMarkersRef = useRef([])

  useEffect(() => {
    async function init() {
      // Fetch Venues
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      
      // Fetch Events
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { data: eventData } = await supabase.from('events').select('*').eq('status', 'approved').gte('event_date', startOfToday.toISOString())

      // Fetch Geo-Gifts
      const { data: giftData } = await supabase.from('geo_gifts').select('*')
      if (giftData) setGeoGifts(giftData)

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
             if (activeEvent.recurring_weekly) start.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
             const end = new Date(start.getTime() + (4 * 60 * 60 * 1000));
             if (now >= start && now <= end) isLiveNow = true;
         }

         return { ...v, isLive: isLiveNow, eventToday: todaysEvents.length > 0 ? todaysEvents[0] : null }
      }) : []

      setVenues(processedVenues)

      if (window.google && window.google.maps && window.google.maps.Map) {
        initializeMap()
      } else {
        window.initMap = initializeMap
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
          const { data } = await supabase.from('profiles').select('id, current_lat, current_lng').not('current_lat', 'is', null).gte('last_active', twoHoursAgo)
          if (data) setActiveUsers(data)
      }
      fetchUsers()
      const sub = supabase.channel('public-users-location').on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
              setActiveUsers(prev => {
                  const exists = prev.find(u => u.id === payload.new.id)
                  if (exists) return prev.map(u => u.id === payload.new.id ? payload.new : u)
                  else if (payload.new.current_lat) return [...prev, payload.new]
                  return prev
              })
          }).subscribe()
      return () => supabase.removeChannel(sub)
  }, [])

  function initializeMap() {
    if (!mapRef.current || !window.google) return
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 44.0805, lng: -103.2310 },
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      mapId: 'e48372c619f58e7f83289663'
    })
    setMapInstance(map)
  }

  // 🟢 DYNAMIC MARKER RENDERING ENGINE
  useEffect(() => {
      if (!mapInstance || !window.google) return

      // Clear existing markers
      markersRef.current.forEach(m => m.map = null)
      markersRef.current = []

      const bounds = new window.google.maps.LatLngBounds()
      let pointsPlotted = false

      // 1. Plot Venues / Events / Hotspots based on Filter
      venues.forEach(venue => {
          let show = false
          if (activeFilter === 'All' || activeFilter === 'Venues') show = true
          if (activeFilter === 'Events' && venue.eventToday) show = true
          if (activeFilter === 'Hotspots' && venue.is_hotspot) show = true

          if (show) {
              const position = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
              const dotDiv = document.createElement('div')

              let dotColor = venue.is_hotspot ? 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.9)]' : 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.8)]'
              let dotSize = 'w-4 h-4'
              let animation = ''

              if (venue.eventToday) {
                  dotColor = 'bg-[#ff2d78] shadow-[0_0_20px_rgba(255,45,120,0.9)]'
                  if (venue.isLive) { dotSize = 'w-5 h-5'; animation = 'animate-pulse' }
              }

              dotDiv.innerHTML = `<div class="${dotSize} ${dotColor} ${animation} rounded-full border-2 border-white transition-transform duration-300"></div>`
              dotDiv.style.cursor = 'pointer'

              const marker = new window.google.maps.marker.AdvancedMarkerElement({ position, map: mapInstance, title: venue.name, content: dotDiv })
              marker.addListener('gmp-click', () => {
                  setActiveGift(null)
                  setActiveVenue(venue)
                  mapInstance.panTo(position)
                  mapInstance.setZoom(17)
              })

              markersRef.current.push(marker)
              bounds.extend(position)
              pointsPlotted = true
          }
      })

      // 2. Plot Geo-Gifts based on Filter
      if (activeFilter === 'All' || activeFilter === 'Geo-Gifts') {
          geoGifts.forEach(gift => {
              if (gift.claimed_by?.includes(currentUser?.id)) return // Hide if already claimed by me

              const position = { lat: parseFloat(gift.lat), lng: parseFloat(gift.lng) }
              const dotDiv = document.createElement('div')
              
              // Toxic Green Pulsing Pin for Rewards
              dotDiv.innerHTML = `<div class="w-5 h-5 bg-green-500 shadow-[0_0_25px_rgba(34,197,94,1)] animate-pulse rounded-full border-2 border-white transition-transform duration-300"></div>`
              dotDiv.style.cursor = 'pointer'

              const marker = new window.google.maps.marker.AdvancedMarkerElement({ position, map: mapInstance, title: gift.title, content: dotDiv })
              marker.addListener('gmp-click', () => {
                  setActiveVenue(null)
                  setActiveGift(gift)
                  mapInstance.panTo(position)
                  mapInstance.setZoom(20) // Extreme zoom to help find the 25ft mark
              })

              markersRef.current.push(marker)
              bounds.extend(position)
              pointsPlotted = true
          })
      }

      if (pointsPlotted && activeFilter !== 'All') mapInstance.fitBounds(bounds)
  }, [mapInstance, venues, geoGifts, activeFilter, currentUser])

  // Plot User Radar Dots
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

  // 🟢 THE CLAIM LOGIC (25 FT RULE)
  const handleClaimGift = async () => {
      if (!currentUser?.current_lat || !currentUser?.current_lng) {
          return alert("Radar Offline. Ensure location services are enabled to claim Geo-Gifts.")
      }

      const dist = getDistanceInFeet(currentUser.current_lat, currentUser.current_lng, activeGift.lat, activeGift.lng)

      if (dist > 25) {
          return alert(`Too far! You are ${Math.round(dist)} feet away. Get within 25 feet to claim.`)
      }

      setClaiming(true)

      // 1. Refresh profile data to avoid race condition wipes
      const { data: p } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
      
      // 2. Perform math
      const newLp = (p.lifestyle_points || 0) + (activeGift.reward_lp || 0)
      const newWood = (p.cur_wood || 0) + (activeGift.reward_resources?.Wood || 0)
      const newStone = (p.cur_stone || 0) + (activeGift.reward_resources?.Stone || 0)
      const newIron = (p.cur_iron || 0) + (activeGift.reward_resources?.Iron || 0)
      
      const newGems = { ...(p.inv_gems || {}) }
      for (const [gem, amt] of Object.entries(activeGift.reward_gems || {})) {
           newGems[gem] = (newGems[gem] || 0) + amt
      }

      // 3. Update Database
      await supabase.from('profiles').update({
          lifestyle_points: newLp,
          cur_wood: newWood,
          cur_stone: newStone,
          cur_iron: newIron,
          inv_gems: newGems
      }).eq('id', currentUser.id)

      const updatedClaimers = [...(activeGift.claimed_by || []), currentUser.id]
      await supabase.from('geo_gifts').update({ claimed_by: updatedClaimers }).eq('id', activeGift.id)

      // 4. Update UI
      alert(`🎁 Cache Claimed! Received ${activeGift.reward_lp} L$.`)
      setGeoGifts(prev => prev.filter(g => g.id !== activeGift.id))
      setActiveGift(null)
      setClaiming(false)
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in flex flex-col gap-6 pb-24">

      <div className="text-center mb-2">
        {config.map_title_visible !== false && (
            <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                {config.map_title || 'The Scene'}
            </h2>
        )}
      </div>

      {/* 🟢 NEW VIEWPORT FILTER ROW */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 shrink-0 border-b border-gray-800">
        {['All', 'Venues', 'Events', 'Geo-Gifts', 'Hotspots'].map(filter => (
            <button
                key={filter}
                onClick={() => { setActiveFilter(filter); setActiveVenue(null); setActiveGift(null); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                    activeFilter === filter
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                    : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-white'
                }`}
            >
                View {filter}
            </button>
        ))}
      </div>

      {/* THE MERGED MAP & JOURNAL HUD */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-blue-900/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col bg-[#050505]">

        {/* Map Viewport */}
        <div className="relative w-full h-[60vh] min-h-[450px]">
            {!mapInstance && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#090812] text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                    Initializing Radar...
                </div>
            )}
            <div ref={mapRef} className="absolute inset-0 bg-[#090812] z-0"></div>

            {/* Venue Info Overlay */}
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

            {/* 🟢 Geo-Gift Claim Overlay */}
            {activeGift && (
                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#090812]/95 backdrop-blur-md border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] z-30 pointer-events-auto text-center">
                    <div className="flex justify-between items-start mb-1 absolute right-4 top-4">
                        <button onClick={() => setActiveGift(null)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                    <div className="text-4xl mb-2">🎁</div>
                    <h3 className="text-2xl font-['Bebas_Neue'] text-green-400 tracking-widest">{activeGift.title}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Location Cache Identified</p>
                    
                    <button 
                        onClick={handleClaimGift} 
                        disabled={claiming}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg"
                    >
                        {claiming ? 'Extracting...' : 'Claim Reward (Must be within 25ft)'}
                    </button>
                </div>
            )}
        </div>

      </div>

      {/* THE JOURNAL WIDGET */}
      <div className="pb-32">
          <div className="text-center mb-6">
              {config.journal_title_visible !== false && (
                  <h2 className="text-4xl font-['Bebas_Neue'] text-gray-300 tracking-wider">
                      {config.journal_title || 'The Void'}
                  </h2>
              )}
              {config.journal_subtitle_visible !== false && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {config.journal_subtitle || 'Global Anonymous Chatter • 10 Min Auto-Wipe'}
                  </p>
              )}
          </div>
          
          <JournalFeed currentUser={currentUser} />
      </div>
    </div>
  )
}