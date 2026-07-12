import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'
import { toast } from './GlobalToast'

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
      if (setlistIds.length === 0) { setSetlistSongs([]); return }
      const { data } = await supabase.from('songs').select('id, title, artist').in('id', setlistIds)
      if (data) {
        const orderedSongs = setlistIds.map(id => data.find(song => song.id === id)).filter(Boolean)
        setSetlistSongs(orderedSongs)
      }
    }
    fetchSongDetails()
  }, [setlistIds])

  const handleRemove = async (indexToRemove) => {
    const newSetlist = setlistIds.filter((_, idx) => idx !== indexToRemove)
    const { error } = await supabase.from('profiles').update({ active_setlist: newSetlist }).eq('id', session.user.id)
    if (error) { toast.error('Network error: Could not remove song.'); return }
    setSetlistIds(newSetlist)
    window.dispatchEvent(new Event('setlistUpdated'))
  }

  const filled = setlistSongs.length
  const total = 7
  const pct = Math.round((filled / total) * 100)

  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              {isOwner ? 'My Setlist' : 'Their Setlist'}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">{filled} / {total} songs</p>
          </div>
          {/* Progress ring */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={filled === total ? '#22d4c8' : '#4f8cff'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct * 0.942} 94.2`}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/70">{filled}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: filled === total
                ? 'linear-gradient(90deg, #22d4c8, #4f8cff)'
                : 'linear-gradient(90deg, #4f8cff, #22d4c8)'
            }}
          />
        </div>
      </div>

      {/* Song list */}
      <div className="p-4 space-y-2">
        {setlistSongs.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
              <span className="text-lg opacity-50">🎵</span>
            </div>
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
              {isOwner ? 'Add songs from your vault below' : 'No songs in setlist yet'}
            </p>
          </div>
        ) : (
          setlistSongs.map((song, index) => (
            <SongRow
              key={`${song.id}-${index}`}
              title={song.title}
              artist={song.artist}
              indexLabel={
                <span className="text-[var(--blue)] text-sm font-bold">{index + 1}</span>
              }
              actions={
                isOwner ? (
                  <button
                    onClick={() => handleRemove(index)}
                    className="text-white/40 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.07] hover:border-red-500/30 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    Remove
                  </button>
                ) : null
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
