import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function Map({ onViewEntity }) {
  const mapRef = useRef(null)
  const [venues, setVenues] = useState([])
  const [activeVenue, setActiveVenue] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  const markersRef = useRef([])

  const mapStyle = [
    { elementType: "geometry", stylers: [{ color: "#090812" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#090812" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9c" }] },
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#21213c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0f1a" }] }
  ]

  // Generates a custom SVG with a built-in drop shadow for the Neon Glow
  const createGlowMarkerURI = (hexColor, isGlowing) => {
    const shadow = isGlowing ? `<feGaussianBlur stdDeviation="4" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>` : '';
    const scale = isGlowing ? '10' : '6';
    
    const svg = `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            ${shadow}
          </filter>
        </defs>
        <circle cx="20" cy="20" r="${scale}" fill="${hexColor}" stroke="#ffffff" stroke-width="2" filter="url(#glow)" />
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  useEffect(() => {
    async function init() {
      // 1. Fetch Venues
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      
      // 2. Fetch all Events
      const { data: eventData } = await supabase.from('events').select('*')

      const processedVenues = venueData ? venueData.map(v => {
         // Determine if an event is happening RIGHT NOW at this venue
         const now = new Date()
         const activeEvents = (eventData || []).filter(e => {
            if (e.location !== v.name) return false;
            const start = new Date(e.start_time);
            const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + (4 * 60 * 60 * 1000)); // Assume 4 hours if no end time
            return now >= start && now <= end;
         })

         const isLive = activeEvents.length > 0;
         const isKaraoke = isLive && activeEvents.some(e => e.title.toLowerCase().includes('karaoke') || e.title.toLowerCase().includes('ksocial'));

         return { ...v, isLive, isKaraoke }
      }) : []

      setVenues(processedVenues)

      if (!window.google) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyD4wqqOrYrTCgelaTzepbdKd6NV7XOMsBE&libraries=places`
        script.async = true
        script.onload = () => initializeMap(processedVenues)
        document.body.appendChild(script)
      } else {
        initializeMap(processedVenues)
      }
    }
    init()
  }, [])

  const initializeMap = (venueData) => {
    if (!mapRef.current || !window.google) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 44.0805, lng: -103.2310 },
      zoom: 13,
      styles: mapStyle,
      disableDefaultUI: true, 
      zoomControl: true
    })

    setMapInstance(map)

    if (venueData && venueData.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()

      venueData.forEach(venue => {
        const position = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
        
        // Determine Marker Color and Glow State
        let markerIconUri;
        if (venue.isKaraoke) {
            markerIconUri = createGlowMarkerURI('#ff00ff', true); // Neon Pink Glow
        } else if (venue.isLive) {
            markerIconUri = createGlowMarkerURI('#00f5ff', true); // Neon Blue Glow
        } else {
            markerIconUri = createGlowMarkerURI('#4b5563', false); // Dull Gray, no glow
        }
        
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: venue.name,
          icon: {
              url: markerIconUri,
              anchor: new window.google.maps.Point(20, 20) // Centers the custom SVG 
          }
        })

        marker.addListener('click', () => {
          setActiveVenue(venue)
          map.panTo(position)
          map.setZoom(16)
        })

        markersRef.current.push(marker)
        bounds.extend(position)
      })

      if (venueData.length > 1) {
          map.fitBounds(bounds)
      } else {
          map.setCenter({ lat: parseFloat(venueData[0].lat), lng: parseFloat(venueData[0].lng) })
      }
    }
  }

  const handleVenueClick = (venue) => {
      setActiveVenue(venue)
      if (mapInstance && venue.lat && venue.lng) {
          mapInstance.panTo({ lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) })
          mapInstance.setZoom(16)
      }
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      <div className="text-center mb-6">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">The Scene</h2>
        <div className="flex justify-center gap-4 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-pink-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_5px_#ff00ff]"></span> Live Karaoke</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_5px_#00f5ff]"></span> Live Event</span>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-4 pb-2">
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

      <div className="relative w-full h-[450px] rounded-3xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] mb-6 bg-gray-900">
        {!mapInstance && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                Initializing Map Matrix...
            </div>
        )}
        <div ref={mapRef} className="w-full h-full"></div>
      </div>

      {activeVenue && (
        <div className="p-6 rounded-3xl border transition-all animate-fade-in bg-black border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{activeVenue.name}</h3>
            <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest block mb-4">
                {activeVenue.isKaraoke ? '🎤 KARAOKE LIVE NOW' : activeVenue.isLive ? '🔥 EVENT LIVE NOW' : 'Official BHNL Venue'}
            </span>
            
            <div className="space-y-3 mb-6 text-sm text-gray-300">
                <p className="flex items-start gap-3"><span className="text-lg">📍</span> <span>{activeVenue.address}</span></p>
                {activeVenue.cost && <p className="flex items-center gap-3"><span className="text-lg">💵</span> <span>Price Guide: {activeVenue.cost}</span></p>}
                {activeVenue.phone && <p className="flex items-center gap-3"><span className="text-lg">📞</span> <span>{activeVenue.phone}</span></p>}
            </div>

            <button onClick={() => onViewEntity(activeVenue.name)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                View Full Profile & Events
            </button>
        </div>
      )}
    </div>
  )
}