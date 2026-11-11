import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'
import { toast } from './GlobalToast'
import { extractSetlistsFromProfile, updateDualSetlistOnProfile } from './utils'

export default function Setlist({ session, isOwner = true }) {
  const [sideAIds, setSideAIds] = useState([])
  const [sideBIds, setSideBIds] = useState([])
  const [activeSide, setActiveSide] = useState('A')
  const [setlistSongs, setSetlistSongs] = useState([])
  const touchStartRef = useRef(null)

  const currentIds = activeSide === 'B' ? sideBIds : sideAIds

  const fetchProfileSetlist = async () => {
    const targetId = session?.user?.id
    if (!targetId) return
    const { data } = await supabase
      .from('profiles')
      .select('active_setlist, details')
      .eq('id', targetId)
      .single()

    if (data) {
      const parsed = extractSetlistsFromProfile(data)
      setSideAIds(parsed.sideA)
      setSideBIds(parsed.sideB)
      setActiveSide(parsed.activeSide)
    } else {
      setSideAIds([])
      setSideBIds([])
    }
  }

  useEffect(() => {
    fetchProfileSetlist()
    window.addEventListener('setlistUpdated', fetchProfileSetlist)
    return () => window.removeEventListener('setlistUpdated', fetchProfileSetlist)
  }, [session])

  useEffect(() => {
    async function fetchSongDetails() {
      if (currentIds.length === 0) {
        setSetlistSongs([])
        return
      }
      const { data } = await supabase
        .from('songs')
        .select('id, title, artist')
        .in('id', currentIds)
      if (data) {
        const orderedSongs = currentIds
          .map(id => data.find(song => song.id === id))
          .filter(Boolean)
        setSetlistSongs(orderedSongs)
      }
    }
    fetchSongDetails()
  }, [sideAIds, sideBIds, activeSide])

  const handleSwitchSide = async (nextSide) => {
    if (nextSide === activeSide) return
    setActiveSide(nextSide)
    if (isOwner && session?.user?.id) {
      await updateDualSetlistOnProfile(supabase, session.user.id, {
        sideA: sideAIds,
        sideB: sideBIds,
        activeSide: nextSide
      })
      window.dispatchEvent(new Event('setlistUpdated'))
    }
  }

  const handleRemove = async (indexToRemove) => {
    const newSetlist = currentIds.filter((_, idx) => idx !== indexToRemove)
    const nextSideA = activeSide === 'A' ? newSetlist : sideAIds
    const nextSideB = activeSide === 'B' ? newSetlist : sideBIds

    const { error } = await updateDualSetlistOnProfile(supabase, session.user.id, {
      sideA: nextSideA,
      sideB: nextSideB,
      activeSide
    })
    if (error) {
      toast.error('Network error: Could not remove song.')
      return
    }
    setSideAIds(nextSideA)
    setSideBIds(nextSideB)
    window.dispatchEvent(new Event('setlistUpdated'))
  }

  const handleTouchStart = (e) => {
    e.stopPropagation()
    if (!e.touches || e.touches.length !== 1) return
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e) => {
    e.stopPropagation()
    if (!touchStartRef.current || !e.changedTouches || e.changedTouches.length === 0) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      // Swipe left or right toggles between Side A and Side B
      const nextSide = activeSide === 'A' ? 'B' : 'A'
      handleSwitchSide(nextSide)
    }
  }

  const filled = setlistSongs.length
  const total = 7
  const pct = Math.round((filled / total) * 100)

  return (
    <div
      data-no-page-swipe="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03] select-none"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {isOwner ? 'My Setlist' : 'Their Setlist'}
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#4f8cff]/15 text-[#4f8cff] border border-[#4f8cff]/30">
                Side {activeSide}
              </span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">
              {filled} / {total} songs · Swipe left/right to flip sides
            </p>
          </div>

          {/* Side A / Side B Switcher + Progress ring */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="inline-flex rounded-xl p-1 bg-white/[0.04] border border-white/[0.08]">
              {['A', 'B'].map(side => {
                const isSelected = activeSide === side
                const count = side === 'A' ? sideAIds.length : sideBIds.length
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => handleSwitchSide(side)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#4f8cff] to-[#22d4c8] text-white shadow-[0_0_12px_rgba(79,140,255,0.4)]'
                        : 'text-white/45 hover:text-white/80'
                    }`}
                  >
                    Side {side} ({count})
                  </button>
                )
              })}
            </div>

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
              {isOwner
                ? `Side ${activeSide} is empty — add songs from your vault below`
                : `No songs in Side ${activeSide} yet`}
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
