import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Setlist({ session, isOwner = true }) {
  const [setlistIds, setSetlistIds] = useState([])
  const [setlistSongs, setSetlistSongs] = useState([])

  const fetchProfileSetlist = async () => {
    // Safely grab the ID from whoever's session we passed in
    const targetId = session?.user?.id
    if (!targetId) return

    const { data } = await supabase.from('profiles').select('active_setlist').eq('id', targetId).single()
    if (data && data.active_setlist) {
      setSetlistIds(data.active_setlist)
    } else {
      setSetlistIds([]) // 🟢 THE FIX: Clear state if DB is empty
    }
  }

  // Fetch on load AND whenever the Repertoire component tells us to update
  useEffect(() => {
    fetchProfileSetlist()
    window.addEventListener('setlistUpdated', fetchProfileSetlist)
    return () => window.removeEventListener('setlistUpdated', fetchProfileSetlist)
  }, [session])

  // Fetch song details whenever the IDs change
  useEffect(() => {
    async function fetchSongDetails() {
      if (setlistIds.length === 0) {
        setSetlistSongs([])
        return
      }
      
      // 🟢 THE FIX: Lowercase 'id' in the .in() query
      const { data } = await supabase.from('songs').select('*').in('id', setlistIds)
      
      if (data) {
        // Map the details to the exact order of the IDs in the setlist array
        const orderedSongs = setlistIds.map(id => data.find(s => s.id === id)).filter(Boolean)
        setSetlistSongs(orderedSongs)
      }
    }
    fetchSongDetails()
  }, [setlistIds])

  const handleRemove = async (indexToRemove) => {
    const updatedIds = setlistIds.filter((_, idx) => idx !== indexToRemove)
    
    // Update Database
    const { error } = await supabase.from('profiles').update({ active_setlist: updatedIds }).eq('id', session.user.id)
    
    if (!error) {
      setSetlistIds(updatedIds)
      // Tell other components (like Repertoire) to refresh
      window.dispatchEvent(new Event('setlistUpdated'))
    }
  }

  return (
    <div className="bg-gray-900 border-2 border-purple-500/30 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-purple-400" style={{ textShadow: `0 0 15px rgba(168,85,247,0.5)` }}>
            {isOwner ? "My Active Setlist" : "Current Setlist"}
        </h3>

        {setlistSongs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl bg-black/50">
            <p className="text-gray-500 italic text-sm">{isOwner ? "Your setlist is empty. Search your Songlist below to add up to 7 songs." : "This singer hasn't added any songs to their setlist yet."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {setlistSongs.map((song, index) => (
              // 🟢 THE FIX: Lowercase 'id', 'title', and 'artist' in the render block
              <div key={`${song.id}-${index}`} className="flex items-center justify-between bg-black p-3 rounded-xl border border-purple-500/30 hover:border-purple-500 transition-colors">
                <div className="flex items-center gap-4 truncate pr-4">
                  <span className="font-['Bebas_Neue'] text-2xl text-purple-600 w-4">{index + 1}</span>
                  <div className="truncate">
                    <p className="text-white font-bold leading-tight truncate">{song.title}</p>
                    <p className="text-gray-400 text-xs uppercase tracking-widest truncate">{song.artist}</p>
                  </div>
                </div>
                {/* Only render the remove button if they own this profile */}
                {isOwner && <button onClick={() => handleRemove(index)} className="text-gray-600 hover:text-red-500 font-bold px-3 py-1 text-sm transition-colors">✕</button>}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}