import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

import MapVenueOverlay from './MapVenueOverlay'
import MapGiftOverlay from './MapGiftOverlay'
import MapDeployGift from './MapDeployGift'
import {
  getDistanceInFeet,
  getBlackHillsDate,
  parseEventBlackHillsDate,
  doesEventOccurOnDate,
  getEventCategory,
} from './utils'

// Generates coordinates guaranteed to be 25ft–85ft (within 100ft) of a venue
function getOffsetWithin100Feet(venueLat, venueLng) {
  const baseLat = parseFloat(venueLat)
  const baseLng = parseFloat(venueLng)
  const distanceFeet = 25 + Math.random() * 60 // 25ft to 85ft (strictly <= 100ft)
  const angle = Math.random() * 2 * Math.PI
  const feetPerDegLat = 364000
  const feetPerDegLng = 364000 * Math.cos(baseLat * (Math.PI / 180))
  const dLat = (distanceFeet * Math.cos(angle)) / feetPerDegLat
  const dLng = (distanceFeet * Math.sin(angle)) / feetPerDegLng
  return {
    lat: Number((baseLat + dLat).toFixed(6)),
    lng: Number((baseLng + dLng).toFixed(6))
  }
}

const DAILY_GEM_POOL = ['Quartz', 'Quartz', 'Amethyst', 'Amethyst', 'Jade', 'Emerald', 'Sapphire', 'Ruby', 'Diamond']

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

  // Spawns daily GeoGifts within 100ft of existing venues, prioritizing venues with events today
  const spawnDailyVenueGeoGifts = async (venueList) => {
    const validVenues = (venueList || []).filter(
      v => v.lat !== null && v.lat !== undefined && v.lng !== null && v.lng !== undefined && !isNaN(parseFloat(v.lat)) && !isNaN(parseFloat(v.lng))
    )
    if (validVenues.length === 0) return []

    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)
    const eventVenues = shuffle(validVenues.filter(v => Boolean(v.eventToday)))
    const otherVenues = shuffle(validVenues.filter(v => !v.eventToday))
    const prioritized = [...eventVenues, ...otherVenues]

    const targetCount = Math.max(7, eventVenues.length)
    const selectedVenues = []
    for (let i = 0; i < targetCount; i++) {
      selectedVenues.push(prioritized[i % prioritized.length])
    }

    const endOfToday = getBlackHillsDate()
    endOfToday.setHours(23, 59, 59, 999)

    const newDrops = selectedVenues.map(v => {
      const coords = getOffsetWithin100Feet(v.lat, v.lng)
      const randomGem = DAILY_GEM_POOL[Math.floor(Math.random() * DAILY_GEM_POOL.length)]
      return {
        title: v.eventToday ? `🔥 Event Cache @ ${v.name}` : `📍 Venue Cache @ ${v.name}`,
        lat: coords.lat,
        lng: coords.lng,
        reward_lp: v.eventToday ? 100 : 50,
        reward_gems: { [randomGem]: 1 },
        claimed_by: [],
        expires_at: endOfToday.toISOString()
      }
    })

    await supabase.from('geo_gifts').delete().not('id', 'is', null)
    const { data: inserted, error } = await supabase.from('geo_gifts').insert(newDrops).select('*')
    if (error) {
      // Fallback to SECURITY DEFINER RPC if RLS restricts client-side table writes
      const { error: rpcErr } = await supabase.rpc('regenerate_daily_gifts')
      if (!rpcErr) {
        const { data: rpcGifts } = await supabase.from('geo_gifts').select('*')
        return rpcGifts || []
      }
      console.error('GeoGift auto-spawn error:', error)
      return []
    }
    return inserted || []
  }

  useEffect(() => {
    async function init() {
      const today = getBlackHillsDate();
      today.setHours(0, 0, 0, 0); // Start of today (Black Hills Time)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

      const [venueRes, eventRes, giftRes] = await Promise.all([
        supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null),
        supabase.from('events').select('*').eq('status', 'approved'),
        supabase.from('geo_gifts').select('*')
      ]);

      const venueData = venueRes.data;
      const eventData = eventRes.data;
      let giftData = giftRes.data || [];

      // Filter eventData down to ALL events (Recurring, Non-Recurring, Special) happening today (Black Hills Time)
      const todaysEventsFiltered = (eventData || []).filter(e =>
          doesEventOccurOnDate(e, today, { ignoreStartDateForRecurring: true })
      ).map(e => ({
          ...e,
          category: getEventCategory(e)
      }));

      const todayShortDay = today.toLocaleDateString('en-US', { weekday: 'short' });
      const todayLongDay = today.toLocaleDateString('en-US', { weekday: 'long' });

      const processedVenues = venueData ? venueData.map(v => {
         const now = getBlackHillsDate()
         const venueClean = (v.name || '').trim().toLowerCase()
         const todaysEvents = todaysEventsFiltered.filter(
             e => (e.venue || '').trim().toLowerCase() === venueClean
         );

         // Also check legacy recurring schedule on the venue if no DB event matched
         if (todaysEvents.length === 0 && Array.isArray(v.details?.schedule)) {
             const legacySlot = v.details.schedule.find(
                 s => s.day === todayShortDay || s.day === todayLongDay
             );
             if (legacySlot?.event) {
                 todaysEvents.push({
                     ...legacySlot.event,
                     venue: v.name,
                     category: 'Recurring'
                 });
             }
         }

         const hasEventToday = todaysEvents.length > 0;

         let isLiveNow = false;
         if (hasEventToday && todaysEvents[0].event_date) {
             const activeEvent = todaysEvents[0]
             const start = parseEventBlackHillsDate(activeEvent.event_date)
             const startToday = new Date(today)
             startToday.setHours(start.getHours(), start.getMinutes(), 0, 0)
             const endToday = new Date(startToday.getTime() + (4 * 60 * 60 * 1000));
             if (now >= startToday && now <= endToday) isLiveNow = true;
         }

         return {
             ...v,
             isLive: isLiveNow,
             eventToday: hasEventToday ? todaysEvents[0] : null,
             eventsToday: todaysEvents
         }
      }) : []

      setVenues(processedVenues)

      // Check if GeoGifts need a daily reset/respawn or if any gift is outside 100ft of all venues
      const nowTime = getBlackHillsDate()
      const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
      const savedDayKey = localStorage.getItem('bhnl_geogifts_day_key')

      const validGiftsToday = giftData.filter(g => {
        if (g.expires_at && getBlackHillsDate(g.expires_at) <= nowTime) return false
        if (g.created_at && getBlackHillsDate(g.created_at) < today) return false
        // Verify gift is within 100ft of at least one venue (unless Admin Test Drop)
        if (g.title !== 'Admin Test Drop' && processedVenues.length > 0) {
          const nearAnyVenue = processedVenues.some(
            v => getDistanceInFeet(parseFloat(g.lat), parseFloat(g.lng), parseFloat(v.lat), parseFloat(v.lng)) <= 100
          )
          if (!nearAnyVenue) return false
        }
        return true
      })

      if (processedVenues.length > 0 && (validGiftsToday.length === 0 || savedDayKey !== todayKey)) {
        const spawned = await spawnDailyVenueGeoGifts(processedVenues)
        if (spawned.length > 0) {
          giftData = spawned
          localStorage.setItem('bhnl_geogifts_day_key', todayKey)
        } else {
          giftData = validGiftsToday
        }
      } else {
        giftData = validGiftsToday
      }

      setGeoGifts(giftData)

      if (window.google && window.google.maps && window.google.maps.Map) {
        initializeMap()
      } else {
        window.initMap = initializeMap
        if (!document.getElementById('google-maps-script')) {
            const script = document.createElement('script')
            script.id = 'google-maps-script'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,marker&map_ids=e48372c619f58e7f83289663&v=weekly&loading=async&callback=initMap`
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
              
              // 3. Create the Marker Element (Glows neon pink whenever an Event — Recurring, Non-Recurring, or Special — is taking place today)
              const el = document.createElement('div');
              if (hasEventToday || isLive) {
                  el.className = 'w-5 h-5 rounded-full bg-[#ff2d78] border-2 border-white animate-pulse transition-all z-50';
                  el.style.boxShadow = '0 0 14px #ff2d78, 0 0 28px rgba(255,45,120,0.95)';
              } else {
                  el.className = 'w-4 h-4 rounded-full bg-purple-600 border-2 border-[#090812] shadow-lg opacity-85 transition-all';
              }
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
      // Fetch users who have shared a location within the last 24 hours so the map stays fresh and uncluttered
      const fetchUsers = async () => {
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const { data } = await supabase
              .from('profiles')
              .select('id, current_lat, current_lng, last_active')
              .not('current_lat', 'is', null)
              .not('current_lng', 'is', null)
              .gte('last_active', twentyFourHoursAgo)
          if (data) setActiveUsers(data)
      }
      fetchUsers()
      const sub = supabase.channel('public-users-location').on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
              setActiveUsers(prev => {
                  const hasCoords = payload.new.current_lat !== null && payload.new.current_lat !== undefined && payload.new.current_lng !== null && payload.new.current_lng !== undefined
                  const cutoff = Date.now() - 24 * 60 * 60 * 1000
                  const isRecent = !payload.new.last_active || new Date(payload.new.last_active).getTime() >= cutoff
                  if (!hasCoords || !isRecent) {
                      return prev.filter(u => u.id !== payload.new.id)
                  }
                  const updatedUser = {
                      id: payload.new.id,
                      current_lat: payload.new.current_lat,
                      current_lng: payload.new.current_lng,
                      last_active: payload.new.last_active
                  }
                  const exists = prev.find(u => u.id === payload.new.id)
                  if (exists) return prev.map(u => u.id === payload.new.id ? updatedUser : u)
                  return [...prev, updatedUser]
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
              const isSelf = currentUser?.id && user.id === currentUser.id
              const position = { lat: parseFloat(user.current_lat), lng: parseFloat(user.current_lng) }
              const dotDiv = document.createElement('div')
              if (isSelf) {
                  dotDiv.innerHTML = `<div class="w-3.5 h-3.5 bg-[#f5c542] rounded-full shadow-[0_0_16px_rgba(245,197,66,1)] border-2 border-white animate-pulse"></div>`
              } else {
                  dotDiv.innerHTML = `<div class="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,1)] border border-white animate-pulse"></div>`
              }
              const marker = new window.google.maps.marker.AdvancedMarkerElement({ 
                  position, 
                  map: mapInstance, 
                  title: isSelf ? 'Your Location' : undefined,
                  content: dotDiv,
                  zIndex: isSelf ? 80 : 50,
                  collisionBehavior: isSelf ? 'REQUIRED' : 'OPTIONAL_AND_HIDES_LOWER_PRIORITY'
              })
              userMarkersRef.current.push(marker)
          })
      }
  }, [activeUsers, mapInstance, filters.users, currentUser?.id])

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
          
          const { data: p } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
          if (!p) {
              setClaiming(false)
              return
          }

          let multUses = Number(p.multiplier_uses_left || 0)
          let activeMult = Number(p.active_multiplier || 1)
          let appliedMult = 1
          if (multUses > 0 && activeMult > 1) {
              appliedMult = activeMult
              multUses -= 1
              if (multUses <= 0) {
                  multUses = 0
                  activeMult = 1
              }
          }

          const baseLp = Number(activeGift.reward_lp || 0)
          const finalLpEarned = Math.round(baseLp * appliedMult)
          const newLp = Number(p.lifestyle_points || 0) + finalLpEarned
          const newWood = Number(p.cur_wood || 0) + Number(activeGift.reward_resources?.Wood || 0)
          const newStone = Number(p.cur_stone || 0) + Number(activeGift.reward_resources?.Stone || 0)
          const newIron = Number(p.cur_iron || 0) + Number(activeGift.reward_resources?.Iron || 0)

          const newGems = { ...(p.inv_gems || {}) }
          for (const [gem, amt] of Object.entries(activeGift.reward_gems || {})) {
               newGems[gem] = (newGems[gem] || 0) + amt
          }

          await supabase.from('profiles').update({
              lifestyle_points: newLp,
              active_multiplier: activeMult,
              multiplier_uses_left: multUses,
              cur_wood: newWood,
              cur_stone: newStone,
              cur_iron: newIron,
              inv_gems: newGems
          }).eq('id', currentUser.id)

          const updatedClaimers = [...(activeGift.claimed_by || []), currentUser.id]
          await supabase.from('geo_gifts').update({ claimed_by: updatedClaimers }).eq('id', activeGift.id)

          alert(`🎁 Cache Claimed! Received ${finalLpEarned} L$${appliedMult > 1 ? ` (${appliedMult}x Multiplier!)` : ''}.`)
          setGeoGifts(prev => prev.filter(g => g.id !== activeGift.id))
          setActiveGift(null)
          setClaiming(false)

          // 🟢 FIX: Trigger Notification for GeoGift
          await supabase.from('notifications').insert([{
              user_id: currentUser.id,
              title: 'Cache Claimed!',
              content: `You discovered a GeoGift and earned +${finalLpEarned} L$!`
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
      if (!window.confirm("This will wipe all current Geo-Gifts and respawn new ones within 100ft of existing venues (prioritizing venues with events today). Proceed?")) return;
      
      const spawned = await spawnDailyVenueGeoGifts(venues)
      if (spawned.length > 0) {
          setGeoGifts(spawned)
          alert(`Success! ${spawned.length} new venue Geo-Gifts have dropped within 100ft of venues.`)
      } else {
          // Fallback to RPC if direct insert was blocked by RLS
          const { error } = await supabase.rpc('regenerate_daily_gifts')
          if (error) {
              alert("Error regenerating: " + error.message)
          } else {
              alert("Success! New venue caches have dropped.")
              const { data } = await supabase.from('geo_gifts').select('*')
              if (data) setGeoGifts(data)
          }
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

      <div data-no-page-swipe="true" style={mapContainerStyle} className="bg-gray-900 z-0">
        
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