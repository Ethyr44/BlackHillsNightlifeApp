import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import JournalFeed from './JournalFeed'
import { useAppConfig } from './useAppConfig'

function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; 
    return d * 5280;
}

export default function Map({ currentUser, onViewEntity }) {
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const config = useAppConfig()

  const [venues, setVenues] = useState([])
  const [geoGifts, setGeoGifts] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeVenue, setActiveVenue] = useState(null)
  const [activeGift, setActiveGift] = useState(null)
  const [claiming, setClaiming] = useState(false)

  // 🟢 ADMIN STATE
  const [showAdminGiftModal, setShowAdminGiftModal] = useState(false)
  const [isPlacingGift, setIsPlacingGift] = useState(false)
  const [adminGift, setAdminGift] = useState({
      title: 'Admin Test Drop',
      lat: '',
      lng: '',
      lp: 100,
      wood: 0,
      stone: 0,
      iron: 0,
      gemType: 'None',
      gemQty: 1,
      expiresAt: ''
  })

  const markersRef = useRef([])
  const userMarkersRef = useRef([])

  // Default to User's location immediately if available, otherwise fallback to Rapid City
  const [mapCenter, setMapCenter] = useState(
      currentUser?.current_lat && currentUser?.current_lng 
      ? { lat: parseFloat(currentUser.current_lat), lng: parseFloat(currentUser.current_lng) } 
      : { lat: 44.0805, lng: -103.2310 }
  );

  // Force re-center if the user's location updates after initial load
  useEffect(() => {
      if (currentUser?.current_lat && currentUser?.current_lng) {
          setMapCenter({ lat: parseFloat(currentUser.current_lat), lng: parseFloat(currentUser.current_lng) });
      }
  }, [currentUser?.current_lat, currentUser?.current_lng]);

  useEffect(() => {
    async function init() {
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { data: eventData } = await supabase.from('events').select('*').eq('status', 'approved').gte('event_date', startOfToday.toISOString())

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

  // Pan to mapCenter when the center coordinates change
  useEffect(() => {
      if (mapInstance && mapCenter) {
          mapInstance.panTo(mapCenter);
      }
  }, [mapCenter, mapInstance]);

  function initializeMap() {
    if (!mapRef.current || !window.google) return
    const map = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      mapId: 'e48372c619f58e7f83289663'
    })
    setMapInstance(map)
  }

  // 🟢 "TAP-TO-PLACE" MAP CLICK LISTENER
  useEffect(() => {
      if (!mapInstance || !window.google) return
      
      const clickListener = mapInstance.addListener('click', (e) => {
          if (isPlacingGift) {
              setAdminGift(prev => ({
                  ...prev,
                  lat: e.latLng.lat().toFixed(6),
                  lng: e.latLng.lng().toFixed(6)
              }))
              setIsPlacingGift(false)
              setShowAdminGiftModal(true)
          }
      })

      return () => window.google.maps.event.removeListener(clickListener)
  }, [mapInstance, isPlacingGift])


  useEffect(() => {
      if (!mapInstance || !window.google) return

      markersRef.current.forEach(m => m.map = null)
      markersRef.current = []

      const bounds = new window.google.maps.LatLngBounds()
      let pointsPlotted = false

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
                  if (isPlacingGift) return // Prevent opening venue if placing gift
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

      if (activeFilter === 'All' || activeFilter === 'Geo-Gifts') {
          geoGifts.forEach(gift => {
              if (gift.claimed_by?.includes(currentUser?.id)) return 
              if (gift.expires_at && new Date(gift.expires_at) < new Date()) return

              const position = { lat: parseFloat(gift.lat), lng: parseFloat(gift.lng) }
              const dotDiv = document.createElement('div')
              
              dotDiv.innerHTML = `<div class="w-5 h-5 bg-green-500 shadow-[0_0_25px_rgba(34,197,94,1)] animate-pulse rounded-full border-2 border-white transition-transform duration-300"></div>`
              dotDiv.style.cursor = 'pointer'

              const marker = new window.google.maps.marker.AdvancedMarkerElement({ position, map: mapInstance, title: gift.title, content: dotDiv })
              marker.addListener('gmp-click', () => {
                  if (isPlacingGift) return // Prevent opening gift if placing gift
                  setActiveVenue(null)
                  setActiveGift(gift)
                  mapInstance.panTo(position)
                  mapInstance.setZoom(20) 
              })

              markersRef.current.push(marker)
              bounds.extend(position)
              pointsPlotted = true
          })
      }

      if (pointsPlotted && activeFilter !== 'All') mapInstance.fitBounds(bounds)
  }, [mapInstance, venues, geoGifts, activeFilter, currentUser, isPlacingGift])

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

  const handleClaimGift = async () => {
      if (!currentUser?.current_lat || !currentUser?.current_lng) {
          return alert("Radar Offline. Ensure location services are enabled to claim Geo-Gifts.")
      }

      const dist = getDistanceInFeet(currentUser.current_lat, currentUser.current_lng, activeGift.lat, activeGift.lng)

      if (dist > 25) {
          return alert(`Too far! You are ${Math.round(dist)} feet away. Get within 25 feet to claim.`)
      }

      setClaiming(true)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
      
      const newLp = (p.lifestyle_points || 0) + (activeGift.reward_lp || 0)
      const newWood = (p.cur_wood || 0) + (activeGift.reward_resources?.Wood || 0)
      const newStone = (p.cur_stone || 0) + (activeGift.reward_resources?.Stone || 0)
      const newIron = (p.cur_iron || 0) + (activeGift.reward_resources?.Iron || 0)
      
      const newGems = { ...(p.inv_gems || {}) }
      for (const [gem, amt] of Object.entries(activeGift.reward_gems || {})) {
           newGems[gem] = (newGems[gem] || 0) + amt
      }

      await supabase.from('profiles').update({
          lifestyle_points: newLp,
          cur_wood: newWood,
          cur_stone: newStone,
          cur_iron: newIron,
          inv_gems: newGems
      }).eq('id', currentUser.id)

      const updatedClaimers = [...(activeGift.claimed_by || []), currentUser.id]
      await supabase.from('geo_gifts').update({ claimed_by: updatedClaimers }).eq('id', activeGift.id)

      alert(`🎁 Cache Claimed! Received ${activeGift.reward_lp} L$.`)
      setGeoGifts(prev => prev.filter(g => g.id !== activeGift.id))
      setActiveGift(null)
      setClaiming(false)
  }

  const handleAdminGiftSubmit = async (e) => {
      e.preventDefault()
      const payload = {
          title: adminGift.title,
          lat: parseFloat(adminGift.lat),
          lng: parseFloat(adminGift.lng),
          reward_lp: parseInt(adminGift.lp),
          reward_resources: {
              Wood: parseInt(adminGift.wood),
              Stone: parseInt(adminGift.stone),
              Iron: parseInt(adminGift.iron)
          },
          reward_gems: adminGift.gemType !== 'None' ? { [adminGift.gemType]: parseInt(adminGift.gemQty) } : {},
          expires_at: adminGift.expiresAt ? new Date(adminGift.expiresAt).toISOString() : null
      }
      
      const { data, error } = await supabase.from('geo_gifts').insert([payload]).select()
      if (!error && data) {
          setGeoGifts(prev => [...prev, data[0]])
          setShowAdminGiftModal(false)
          alert("Admin Geo-Gift deployed!")
      } else {
          alert("Error deploying Geo-Gift.")
      }
  }

  // 🟢 FORCE RESPAWN ALL GIFTS
  const handleForceRegenerate = async () => {
      if (!window.confirm("This will wipe all current Geo-Gifts and spawn 7 new ones at random locations. Proceed?")) return;
      
      const { error } = await supabase.rpc('regenerate_daily_gifts')
      if (error) {
          alert("Error regenerating: " + error.message)
      } else {
          alert("Success! 7 new caches have dropped.")
          const { data } = await supabase.from('geo_gifts').select('*')
          if (data) setGeoGifts(data)
      }
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

      <div className="flex flex-col gap-3 shrink-0 border-b border-gray-800 pb-4">
          <div className="flex justify-between items-center">
              <div className="flex overflow-x-auto hide-scrollbar gap-2">
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
          </div>
          
          {/* ADMIN ONLY DROP & RESPAWN BUTTONS */}
          {currentUser?.account_type === 'Admin' && (
              <div className="flex gap-2">
                  <button 
                      onClick={() => setIsPlacingGift(true)} 
                      className="flex-1 bg-red-900/30 border border-red-500/50 text-red-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-900/50 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                      + Tap-to-Place Cache
                  </button>
                  <button 
                      onClick={handleForceRegenerate} 
                      className="flex-1 bg-green-900/30 border border-green-500/50 text-green-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-900/50 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  >
                      🔄 Force Respawn
                  </button>
              </div>
          )}
      </div>

      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-blue-900/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col bg-[#050505]">
        
        {/* 🟢 PLACEMENT BANNER */}
        {isPlacingGift && (
            <div className="absolute top-4 left-4 right-4 bg-red-600 text-white p-3 rounded-xl z-50 text-center shadow-xl animate-pulse flex justify-between items-center pointer-events-auto">
                <span className="text-xs font-bold uppercase tracking-widest">📍 Tap anywhere on map</span>
                <button onClick={() => setIsPlacingGift(false)} className="bg-black/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black/50">Cancel</button>
            </div>
        )}

        {/* THE FIX: Changed h-[60vh] to h-[85vh] to force it to fill the device screen */}
        <div className="relative w-full h-[85vh] z-0">
            {!mapInstance && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#090812] text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                    Initializing Radar...
                </div>
            )}
            <div ref={mapRef} className={`absolute inset-0 bg-[#090812] z-0 ${isPlacingGift ? 'cursor-crosshair' : ''}`}></div>

            {activeVenue && !isPlacingGift && (
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

            {activeGift && !isPlacingGift && (
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

      <div className="pb-32">
          <div className="text-center mb-6">
              {config.journal_title_visible !== false && (
                  <h2 className="text-4xl font-['Bebas_Neue'] text-gray-300 tracking-wider">
                      {config.journal_title || 'Live Journal Chat'}
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

      {showAdminGiftModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
              <div className="w-full max-w-md bg-gray-900 border border-red-500/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.2)] my-10">
                  <div className="flex justify-between items-start mb-6">
                      <h2 className="text-2xl font-['Bebas_Neue'] text-red-400 tracking-widest">Deploy Custom Geo-Gift</h2>
                      <button onClick={() => setShowAdminGiftModal(false)} className="text-gray-500 hover:text-white font-bold">✕</button>
                  </div>

                  <form onSubmit={handleAdminGiftSubmit} className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Gift Title</label>
                          <input required type="text" value={adminGift.title} onChange={e => setAdminGift({...adminGift, title: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-3 rounded-xl focus:border-red-500 outline-none" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Latitude</label>
                              <input readOnly type="text" value={adminGift.lat} className="w-full bg-black/50 border border-gray-800 text-gray-500 p-3 rounded-xl outline-none cursor-not-allowed" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Longitude</label>
                              <input readOnly type="text" value={adminGift.lng} className="w-full bg-black/50 border border-gray-800 text-gray-500 p-3 rounded-xl outline-none cursor-not-allowed" />
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1 block">Reward L$</label>
                              <input type="number" min="0" value={adminGift.lp} onChange={e => setAdminGift({...adminGift, lp: e.target.value})} className="w-full bg-black border border-blue-900 p-3 rounded-xl focus:border-blue-500 outline-none text-white" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Expiration Date/Time</label>
                              <input type="datetime-local" value={adminGift.expiresAt} onChange={e => setAdminGift({...adminGift, expiresAt: e.target.value})} className="w-full bg-black border border-gray-700 p-3 rounded-xl outline-none text-white text-xs" />
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1 block">Wood</label>
                              <input type="number" min="0" value={adminGift.wood} onChange={e => setAdminGift({...adminGift, wood: e.target.value})} className="w-full bg-black border border-amber-900 p-3 rounded-xl text-white outline-none" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Stone</label>
                              <input type="number" min="0" value={adminGift.stone} onChange={e => setAdminGift({...adminGift, stone: e.target.value})} className="w-full bg-black border border-slate-700 p-3 rounded-xl text-white outline-none" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-1 block">Iron</label>
                              <input type="number" min="0" value={adminGift.iron} onChange={e => setAdminGift({...adminGift, iron: e.target.value})} className="w-full bg-black border border-gray-600 p-3 rounded-xl text-white outline-none" />
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pb-4">
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-pink-400 mb-1 block">Include Rare Gem</label>
                              <select value={adminGift.gemType} onChange={e => setAdminGift({...adminGift, gemType: e.target.value})} className="w-full bg-black border border-pink-900/50 p-3 rounded-xl text-white outline-none text-sm">
                                  <option value="None">None</option>
                                  <option value="Quartz">Quartz</option>
                                  <option value="Amethyst">Amethyst</option>
                                  <option value="Jade">Jade</option>
                                  <option value="Emerald">Emerald</option>
                                  <option value="Sapphire">Sapphire</option>
                                  <option value="Ruby">Ruby</option>
                                  <option value="Diamond">Diamond</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-pink-400 mb-1 block">Gem Qty</label>
                              <input type="number" min="1" value={adminGift.gemQty} onChange={e => setAdminGift({...adminGift, gemQty: e.target.value})} className="w-full bg-black border border-pink-900/50 p-3 rounded-xl text-white outline-none" disabled={adminGift.gemType === 'None'} />
                          </div>
                      </div>

                      <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20">
                          Deploy Cache to Coordinates
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  )
}