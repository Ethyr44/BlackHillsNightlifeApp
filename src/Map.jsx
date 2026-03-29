import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function Map({ onViewEntity }) {
  const mapRef = useRef(null)
  const [venues, setVenues] = useState([])
  const [activeVenue, setActiveVenue] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  const markersRef = useRef([])

  // The Cyberpunk/Neon Dark Theme (Hides all default POIs!)
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

  useEffect(() => {
    async function init() {
      // 1. Fetch Venues that have coordinates
      const { data } = await supabase.from('pages').select('*').eq('page_type', 'Venue').not('lat', 'is', null)
      if (data) setVenues(data)

      // 2. Load Google Maps Script
      if (!window.google) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyD4wqqOrYrTCgelaTzepbdKd6NV7XOMsBE&libraries=places`
        script.async = true
        script.onload = () => initializeMap(data)
        document.body.appendChild(script)
      } else {
        initializeMap(data)
      }
    }
    init()
  }, [])

  const initializeMap = (venueData) => {
    if (!mapRef.current || !window.google) return

    // Center map on Rapid City, SD by default
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 44.0805, lng: -103.2310 },
      zoom: 13,
      styles: mapStyle,
      disableDefaultUI: true, 
      zoomControl: true
    })

    setMapInstance(map)

    // Plot markers
    if (venueData && venueData.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()

      venueData.forEach(venue => {
        const position = { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
        
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: venue.name,
          icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#00f5ff',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
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

      // Auto-fit map to show all pins
      if (venueData.length > 1) {
          map.fitBounds(bounds)
      } else {
          map.setCenter({ lat: parseFloat(venueData[0].lat), lng: parseFloat(venueData[0].lng) })
      }
    }
  }

  // Handle external button clicks to pan map
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
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs mt-2">Verified Venues Only</p>
      </div>

      {/* Venue Selector */}
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

      {/* THE FIX: Separated the React Loading Text from the Google Map Container */}
      <div className="relative w-full h-[450px] rounded-3xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] mb-6 bg-gray-900">
        {!mapInstance && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse z-10">
                Initializing Map Matrix...
            </div>
        )}
        {/* Google Maps gets this completely empty div all to itself */}
        <div ref={mapRef} className="w-full h-full"></div>
      </div>

      {/* Active Venue Details Panel */}
      {activeVenue && (
        <div className="p-6 rounded-3xl border transition-all animate-fade-in bg-black border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{activeVenue.name}</h3>
            <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest block mb-4">Official BHNL Venue</span>
            
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