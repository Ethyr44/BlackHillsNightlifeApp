import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'

export default function Setlist({ session, isOwner = true }) {
  const [setlistIds, setSetlistIds] = useState([])
  const [setlistSongs, setSetlistSongs] = useState([])

  const fetchProfileSetlist = async () => {
    const targetId = session?.user?.id
    if (!targetId) return

    const { data } = await supabase.from('profiles').select('active_setlist').eq('id', targetId).single()
    if (data && data.active_setlist) setSetlistIds(data.active_setlist)
    else setSetlistIds([])
  }

  useEffect(() => {
    fetchProfileSetlist()
    window.addEventListener('setlistUpdated', fetchProfileSetlist)
    return () => window.removeEventListener('setlistUpdated', fetchProfileSetlist)
  }, [session])

  useEffect(() => {
    async function fetchSongDetails() {
      if (setlistIds.length === 0) {
        setSetlistSongs([])
        return
      }
      const { data } = await supabase.from('songs').select('id, title, artist').in('id', setlistIds)
      if (data) {
        // Keeps the songs in the exact order they were added
        const orderedSongs = setlistIds.map(id => data.find(song => song.id === id)).filter(Boolean)
        setSetlistSongs(orderedSongs)
      }
    }
    fetchSongDetails()
  }, [setlistIds])

  const handleRemove = async (indexToRemove) => {
    const newSetlist = setlistIds.filter((_, idx) => idx !== indexToRemove)
    await supabase.from('profiles').update({ active_setlist: newSetlist }).eq('id', session.user.id)
    setSetlistIds(newSetlist)
    window.dispatchEvent(new Event('setlistUpdated'))
  }

  return (
    <div className="bg-[#090812] border-2 border-purple-500/30 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
        <div className="flex justify-between items-end mb-6">
            <div>
                <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    {isOwner ? "My Setlist" : "Their Setlist"}
                </h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                    {setlistSongs.length} / 7 Songs Ready
                </p>
            </div>
        </div>

        {setlistSongs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl bg-black/50">
            <p className="text-gray-500 italic text-sm">{isOwner ? "Your setlist is empty. Add songs from your Vault below!" : "This singer hasn't added any songs to their setlist yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {setlistSongs.map((song, index) => (
              <SongRow
                  key={`${song.id}-${index}`}
                  title={song.title}
                  artist={song.artist}
                  indexLabel={<span className="text-purple-500 text-3xl font-['Bebas_Neue'] drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">{index + 1}</span>}
                  actions={
                      isOwner ? (
                          <button onClick={() => handleRemove(index)} className="w-full sm:w-auto text-gray-400 hover:text-red-500 bg-gray-900 hover:bg-red-900/20 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors border border-gray-800 hover:border-red-500/50">
                              Remove
                          </button>
                      ) : null
                  }
              />
            ))}
          </div>
        )}
    </div>
  )
}