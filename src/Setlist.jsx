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
      const { data } = await supabase.from('songs').select('*').in('Id', setlistIds)
      if (data) {
        // Maintain the exact order the user intended
        const orderedSongs = setlistIds.map(id => data.find(song => song.Id === id)).filter(Boolean)
        setSetlistSongs(orderedSongs)
      }
    }
    fetchSongDetails()
  }, [setlistIds])

  const handleRemove = async (indexToRemove) => {
    if (!isOwner) return // Safety lock
    
    const newArray = setlistIds.filter((_, index) => index !== indexToRemove)
    const { error } = await supabase.from('profiles').update({ active_setlist: newArray }).eq('id', session.user.id)
    if (!error) {
      setSetlistIds(newArray)
      window.dispatchEvent(new Event('setlistUpdated')) 
    }
  }

  return (
    <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg animate-fade-in">
      <div className="bg-black border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-['Bebas_Neue'] text-purple-400 tracking-wider flex items-center gap-2">
            <span>📋</span> {isOwner ? "Tonight's Setlist" : "Current Setlist"}
          </h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Ready for KSocial Sync</p>
        </div>
        <div className={`font-['Bebas_Neue'] text-3xl ${setlistIds.length === 7 ? 'text-red-500' : 'text-purple-400'}`}>
          {setlistIds.length} <span className="text-gray-600 text-lg">/ 7</span>
        </div>
      </div>

      <div className="p-6">
        {setlistSongs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl bg-black/50">
            <p className="text-gray-500 italic text-sm">{isOwner ? "Your setlist is empty. Search your Songlist below to add up to 7 songs." : "This singer hasn't added any songs to their setlist yet."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {setlistSongs.map((song, index) => (
              <div key={`${song.Id}-${index}`} className="flex items-center justify-between bg-black p-3 rounded-xl border border-purple-500/30 hover:border-purple-500 transition-colors">
                <div className="flex items-center gap-4 truncate pr-4">
                  <span className="font-['Bebas_Neue'] text-2xl text-purple-600 w-4">{index + 1}</span>
                  <div className="truncate">
                    <p className="text-white font-bold leading-tight truncate">{song.Title}</p>
                    <p className="text-gray-400 text-xs uppercase tracking-widest truncate">{song.Artist}</p>
                  </div>
                </div>
                {/* Only render the remove button if they own this profile */}
                {isOwner && <button onClick={() => handleRemove(index)} className="text-gray-600 hover:text-red-500 font-bold px-3 transition-colors text-lg">✕</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}