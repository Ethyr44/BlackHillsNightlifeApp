import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

import MapVenueOverlay from './MapVenueOverlay'
import MapGiftOverlay from './MapGiftOverlay'
import MapDeployGift from './MapDeployGift'
import { getDistanceInFeet } from './utils'

export default function Map({ currentUser, onViewEntity }) {
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)

  const [venues, setVenues] = useState([])
  const [geoGifts, setGeoGifts] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  
  const [filters, setFilters] = useState({
    venues: true,
    events: true,
    users: true,
    geoGifts: true
  });

  const [activeVenue, setActiveVenue] = useState(null)
  const [activeGift, setActiveGift] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [linkingVenue, setLinkingVenue] = useState(false)

  // 🟢 ADMIN STATE
  const [showAdminGiftModal, setShowAdminGiftModal] = useState(false)
  const [isPlacingGift, setIsPlacingGift] = useState(false)
  const [adminGiftCoords, setAdminGiftCoords] = useState(null)

  const markersRef = useRef([])
  const userMarkersRef = useRef([])

  const [mapCenter, setMapCenter] = useState(
      currentUser?.current_lat && currentUser?.current_lng 
      ? { lat: parseFloat(currentUser.current_lat), lng: parseFloat(currentUser.current_lng) } 
      : { lat: 44.0805, lng: -103.2310 }
  );

  useEffect(() => {
      if (currentUser?.current_lat && currentUser?.current_lng) {
          setMapCenter({ lat: parseFloat(currentUser.current_lat), lng: parseFloat(currentUser.current_lng) });
      }
  }, [currentUser?.current_lat, currentUser?.current_lng]);

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    async function init() {
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

      const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'approved')
          .or(`event_date.gte.${today.toISOString()},recurring_weekly.eq.true,recurring_pattern.neq.none`);

      const { data: giftData } = await supabase.from('geo_gifts').select('*')
      if (giftData) setGeoGifts(giftData)

      // Filter eventData down to ONLY events happening today
      const todaysEventsFiltered = (eventData || []).filter(e => {
          const safeDateStr = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z';
          const eDate = new Date(safeDateStr);
          const startDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
          
          const pattern = e.recurring_pattern || (e.recurring_weekly ? 'weekly' : 'none');
          if (pattern === 'none') {
              return eDate >= today && eDate < tomorrow;
          }
          
          if (eDate.getDay() !== today.getDay() || today < startDay) return false;
          if (pattern === 'weekly') return true;
          if (pattern === 'biweekly') return Math.round((today - startDay) / (1000 * 60 * 60 * 24 * 7)) % 2 === 0;
          if (pattern === 'monthly') return Math.ceil(startDay.getDate() / 7) === Math.ceil(today.getDate() / 7);
          return false;
      });

      // Create a fast lookup Set of venue names that have events today
      const venuesWithEvents = new Set(todaysEventsFiltered.map(e => e.venue));

      const processedVenues = venueData ? venueData.map(v => {
         const now = new Date()
         const hasEventToday = venuesWithEvents.has(v.name);

         const todaysEvents = todaysEventsFiltered.filter(e => e.venue === v.name);

         let isLiveNow = false;
         if (todaysEvents.length > 0) {
             const activeEvent = todaysEvents[0]
             const start = new Date(activeEvent.event_date)
             const end = new Date(start.getTime() + (4 * 60 * 60 * 1000));
             if (now >= start && now <= end) isLiveNow = true;
         }

         return { ...v, isLive: isLiveNow, eventToday: hasEventToday ? todaysEvents[0] : null }
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
      if (mapInstance && mapCenter) {
          mapInstance.panTo(mapCenter);
      }
  }, [mapCenter, mapInstance]);

  function initializeMap() {
    if (!mapRef.current || !window.google) return
    const map = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 13,
      disableDefaultUI: true, // Hides the general elements
      zoomControl: false,     // Explicitly kills the zoom buttons
      mapTypeControl: false,  // Explicitly kills the satellite toggle
        gestureHandling: 'greedy', // 🟢 THIS fixes the two-finger requirement on mobile
      mapId: 'e48372c619f58e7f83289663'
    })
    setMapInstance(map)
  }

  // 🟢 "TAP-TO-PLACE" MAP CLICK LISTENER
  useEffect(() => {
      if (!mapInstance || !window.google) return
      
      const clickListener = mapInstance.addListener('click', (e) => {
          if (isPlacingGift) {
              setAdminGiftCoords({
                  lat: e.latLng.lat(),
                  lng: e.latLng.lng()
              })
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
          if (venue.eventToday) {
              if (filters.events) show = true
          } else {
              if (filters.venues) show = true
          }

          if (show) {
              const position = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
              
              // 1. Check if the venue has an event today based on our earlier data fetch
              const hasEventToday = !!venue.eventToday;
              
              // 2. Check if a KSocial session is currently active
              const isLive = venue.isLive;
              
              // 3. Create the Marker Element
              const el = document.createElement('div');
              el.className = `rounded-full border-2 border-[#090812] shadow-lg transition-all ${
                  hasEventToday || isLive 
                  ? 'bg-[#ff2d78] w-5 h-5 animate-pulse shadow-[0_0_15px_rgba(255,45,120,0.8)] z-50' 
                  : 'bg-purple-600 w-4 h-4 opacity-80'
              }`;
              el.style.cursor = 'pointer';

              // 4. Add a special icon inside the dot ONLY if it is KSocial Live
              if (isLive) {
                  el.innerHTML = `<span style="font-size: 10px; display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">🎤</span>`;
              }

          const marker = new window.google.maps.marker.AdvancedMarkerElement({ 
              position, 
              map: mapInstance, 
              title: venue.name, 
                  content: el,
              zIndex: 100,
              collisionBehavior: 'REQUIRED'
          })
              marker.addListener('gmp-click', () => {
                  if (isPlacingGift) return 
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

      if (filters.geoGifts) {
          geoGifts.forEach(gift => {
              if (gift.claimed_by?.includes(currentUser?.id)) return 
              if (gift.expires_at && new Date(gift.expires_at) < new Date()) return

              const position = { lat: parseFloat(gift.lat), lng: parseFloat(gift.lng) }
              const dotDiv = document.createElement('div')
              
              dotDiv.innerHTML = `<div class="w-5 h-5 bg-green-500 shadow-[0_0_25px_rgba(34,197,94,1)] animate-pulse rounded-full border-2 border-white transition-transform duration-300"></div>`
              dotDiv.style.cursor = 'pointer'

              const marker = new window.google.maps.marker.AdvancedMarkerElement({ 
                  position, 
                  map: mapInstance, 
                  title: gift.title, 
                  content: dotDiv,
                  zIndex: 90,
                  collisionBehavior: 'REQUIRED'
              })
              marker.addListener('gmp-click', () => {
                  if (isPlacingGift) return 
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

      const allTrue = filters.venues && filters.events && filters.users && filters.geoGifts;
      if (pointsPlotted && !allTrue) mapInstance.fitBounds(bounds)
  }, [mapInstance, venues, geoGifts, filters, currentUser?.id, isPlacingGift])

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

      if (filters.users) {
          activeUsers.forEach(user => {
              if (!user.current_lat || !user.current_lng) return
              const position = { lat: parseFloat(user.current_lat), lng: parseFloat(user.current_lng) }
              const dotDiv = document.createElement('div')
              dotDiv.innerHTML = `<div class="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,1)] border border-white animate-pulse"></div>`
              const marker = new window.google.maps.marker.AdvancedMarkerElement({ 
                  position, 
                  map: mapInstance, 
                  content: dotDiv,
                  zIndex: 50,
                  collisionBehavior: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY'
              })
              userMarkersRef.current.push(marker)
          })
      }
  }, [activeUsers, mapInstance, filters.users])

  const handleClaimGift = async () => {
      setClaiming(true)
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const userLat = pos.coords.latitude
          const userLng = pos.coords.longitude
          const dist = getDistanceInFeet(userLat, userLng, activeGift.lat, activeGift.lng)

          if (dist > 100) {
              alert(`You are too far away! Get within 100 feet. (Currently ${Math.round(dist)}ft away)`)
              setClaiming(false)
              return
          }
          
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

          alert(`🎁 Cache Claimed! Received ${activeGift.reward_lp || 0} L$.`)
          setGeoGifts(prev => prev.filter(g => g.id !== activeGift.id))
          setActiveGift(null)
          setClaiming(false)

          // 🟢 FIX: Trigger Notification for GeoGift
          await supabase.from('notifications').insert([{
              user_id: currentUser.id,
              title: 'Cache Claimed!',
              content: `You discovered a GeoGift and earned +${activeGift.reward_lp || 0} L$!`
          }])
      }, (err) => {
          alert("Radar Offline. Ensure location services are enabled to claim Geo-Gifts.")
          setClaiming(false)
      }, { enableHighAccuracy: true })
  }

  const handleVenueLink = async (venue) => {
      setLinkingVenue(true)
      navigator.geolocation.getCurrentPosition(
          async (pos) => {
              const userLat = pos.coords.latitude
              const userLng = pos.coords.longitude
              const dist = getDistanceInFeet(userLat, userLng, venue.lat, venue.lng)

              if (dist > 100) {
                  alert(`You are too far away! Get within 100 feet of ${venue.name} to Link. (Currently ${Math.round(dist)}ft away)`)
                  setLinkingVenue(false)
                  return
              }

              const { data: pointsEarned, error } = await supabase.rpc('link_venue', {
                  p_user_id: currentUser.id,
                  p_username: currentUser.username,
                  p_venue_name: venue.name
              })

              if (error) {
                  alert("Link Failed: " + error.message)
              } else {
                  if (pointsEarned === 44) {
                      alert(`🎉 NEW DISCOVERY! You successfully Linked with ${venue.name} for the first time and earned 44 L$!`)
                  } else {
                      alert(`✅ Welcome back to ${venue.name}! You earned 22 L$ for Linking.`)
                  }
                  
                  // 🟢 NEW: Log the check-in for the Live Counter
                  await supabase.from('venue_checkins').insert([{
                      user_id: currentUser.id,
                      venue_name: venue.name
                  }])
              
              // 🟢 FIX: Trigger Notification for Engagement
              await supabase.from('notifications').insert([{
                  user_id: currentUser.id,
                  title: 'Location Linked',
                  content: `You earned +${pointsEarned || 22} L$ for checking into ${venue.name}!`
              }])
              }
              setLinkingVenue(false)
          },
          (error) => {
              alert("Failed to get location signal. Please check your device's location permissions.")
              setLinkingVenue(false)
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
  }

  const handleDeployGift = async (payload) => {
      const submitPayload = {
          title: 'Admin Test Drop',
          lat: parseFloat(payload.lat),
          lng: parseFloat(payload.lng),
          reward_lp: 100, // Standard test reward
          reward_gems: payload.gemType !== 'None' ? { [payload.gemType]: parseInt(payload.gemQty) } : {},
      }
      
      const { data, error } = await supabase.from('geo_gifts').insert([submitPayload]).select()
      if (!error && data) {
          setGeoGifts(prev => [...prev, data[0]])
          setShowAdminGiftModal(false)
          alert("Admin Geo-Gift deployed!")
      } else {
          alert("Error deploying Geo-Gift: " + error.message)
      }
  }

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

  // 🟢 FULLSCREEN EDGE-TO-EDGE CONTAINER STYLE FIX
  const mapContainerStyle = {
    flex: '1 1 auto', 
    minHeight: '70vh', // Forces a height if the flexbox crushes the absolute container
    width: '100%',
    margin: '0',
    overflow: 'hidden',
    position: 'relative'
  }

  let activeVenueDistance = null;
  let activeGiftDistance = null;
  
  if (currentUser?.current_lat && currentUser?.current_lng) {
      if (activeVenue) {
          activeVenueDistance = getDistanceInFeet(currentUser.current_lat, currentUser.current_lng, activeVenue.lat, activeVenue.lng)
      }
      if (activeGift) {
          activeGiftDistance = getDistanceInFeet(currentUser.current_lat, currentUser.current_lng, activeGift.lat, activeGift.lng)
      }
  }

  return (
    <div className="animate-fade-in flex flex-col pb-24">

      <div className="flex flex-col gap-3 shrink-0 border-b border-gray-800 pb-4 px-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 overflow-x-auto p-2 w-full hide-scrollbar">
              {Object.keys(filters).map(key => (
                <button 
                  key={key}
                  onClick={() => toggleFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    filters[key] 
                      ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {key === 'geoGifts' ? 'Geo-Gifts' : key}
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

      <div style={mapContainerStyle} className="bg-gray-900 z-0">
        
        {/* PLACEMENT BANNER */}
        {isPlacingGift && (
            <div className="absolute top-4 left-4 right-4 bg-red-600 text-white p-3 rounded-xl z-50 text-center shadow-xl animate-pulse flex justify-between items-center pointer-events-auto">
                <span className="text-xs font-bold uppercase tracking-widest">📍 Tap anywhere on map</span>
                <button onClick={() => setIsPlacingGift(false)} className="bg-black/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black/50">Cancel</button>
            </div>
        )}

        {!mapInstance && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#090812] text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                Initializing Radar...
            </div>
        )}
        <div id="map" ref={mapRef} className={`absolute inset-0 bg-[#090812] z-0 ${isPlacingGift ? 'cursor-crosshair' : ''}`}></div>
        
        {/* Recenter Button */}
        <div className="absolute top-4 right-4 z-40">
            <button onClick={() => {if(mapInstance && mapCenter) mapInstance.panTo(mapCenter)}} className="bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-white shadow-[0_0_20px_rgba(0,0,0,0.8)]">🛰️</button>
        </div>
      </div>

      {/* 🟢 THE MODULAR UI OVERLAYS */}
      <MapVenueOverlay 
          venue={activeVenue}
          distance={activeVenueDistance}
          isProcessing={linkingVenue}
          onCheckIn={() => handleVenueLink(activeVenue)}
          onClose={() => setActiveVenue(null)}
          onViewEntity={onViewEntity}
      />

      <MapGiftOverlay 
          gift={activeGift}
          distance={activeGiftDistance}
          isProcessing={claiming}
          onClaim={handleClaimGift}
          onClose={() => setActiveGift(null)}
      />

      <MapDeployGift 
          coords={adminGiftCoords}
          isDeploying={false}
          onDeploy={handleDeployGift}
          onClose={() => {
              setAdminGiftCoords(null)
              setShowAdminGiftModal(false)
          }}
      />
    </div>
  )
}