import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'

const CAT_CONFIG = {
  'Fave':      { icon: '🌟', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'To Sing':   { icon: '🎤', color: 'text-[#4f8cff]', bg: 'bg-[#4f8cff]/10', border: 'border-[#4f8cff]/20' },
  'Sung':      { icon: '🕒', color: 'text-white/40', bg: 'bg-white/[0.04]', border: 'border-white/[0.07]' },
  'Suggested': { icon: '💡', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

export default function Repertoire({ userId, isOwner, canSuggest, currentUser, profileUser, trigger, setTrigger }) {
  const [songs, setSongs] = useState([])
  const [activeSetlist, setActiveSetlist] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const fetchSonglist = async () => {
    setLoading(true)
    const { data } = await supabase.from('user_songs').select('*, songs(id, title, artist)').eq('user_id', userId).order('id', { ascending: false })
    if (data) setSongs(data)
    setLoading(false)
  }

  const fetchProfileSetlist = async () => {
    const { data } = await supabase.from('profiles').select('active_setlist').eq('id', userId).single()
    if (data && data.active_setlist) setActiveSetlist(data.active_setlist)
    else setActiveSetlist([])
  }

  useEffect(() => { fetchSonglist(); fetchProfileSetlist() }, [userId, trigger])

  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchQuery.toLowerCase().trim()
      if (q.length < 2) { setSearchResults([]); return }
      setSearchResults(songs.filter(e => e.songs?.title?.toLowerCase().includes(q) || e.songs?.artist?.toLowerCase().includes(q)))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, songs])

  const handleUpdateCategory = async (entryId, newCat) => {
    const { error } = await supabase.from('user_songs').update({ category: newCat }).eq('id', entryId)
    if (error) { alert('Error updating category: ' + error.message); return }
    fetchSonglist()
  }

  const handleDeleteSong = async (entryId) => {
    if (!window.confirm('Remove this song from your vault?')) return
    const { error } = await supabase.from('user_songs').delete().eq('id', entryId)
    if (error) { alert('Error deleting song: ' + error.message); return }
    fetchSonglist()
  }

  const handleToggleSetlist = async (songId) => {
    let newSetlist = [...activeSetlist]
    if (newSetlist.includes(songId)) {
      newSetlist = newSetlist.filter(id => id !== songId)
    } else {
      if (newSetlist.length >= 7) return alert('Setlist is full! (Max 7)')
      newSetlist.push(songId)
    }
    const { error } = await supabase.from('profiles').update({ active_setlist: newSetlist }).eq('id', userId)
    if (error) { alert('Network Error: Could not update setlist.'); return }
    setActiveSetlist(newSetlist)
    if (setTrigger) setTrigger(prev => prev + 1)
    window.dispatchEvent(new Event('setlistUpdated'))
  }

  const handleSuggestSong = async (songId, title) => {
    const { error } = await supabase.from('notifications').insert([{
      user_id: userId, title: 'Song Suggestion', content: `${currentUser?.username || 'A friend'} suggested you sing "${title}"!`
    }])
    if (!error) alert(`Suggested "${title}"!`)
  }

  const handleReject = async (entryId) => {
    if (!window.confirm('Reject this song suggestion?')) return
    const { error } = await supabase.from('user_songs').delete().eq('id', entryId)
    if (error) { alert('Error rejecting suggestion: ' + error.message); return }
    fetchSonglist()
  }

  const displayList = searchQuery.length >= 2 ? searchResults : songs

  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
      {/* Header toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#4f8cff]/10 border border-[#4f8cff]/20 flex items-center justify-center">
            <span className="text-sm">🎒</span>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">{isOwner ? 'My Vault' : 'Their Vault'}</h3>
            <p className="text-white/40 text-[10px]">{songs.length} songs saved</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#4f8cff] bg-[#4f8cff]/10 border border-[#4f8cff]/20 px-2 py-0.5 rounded-full">
            {songs.length}
          </span>
          <svg className={`w-4 h-4 text-white/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.06] p-4 space-y-3 animate-fade-in">
          {/* Search */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</div>
            <input
              type="text"
              placeholder="Search the vault..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-[#4f8cff]/50 transition-colors placeholder:text-white/30"
            />
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="w-5 h-5 border-2 border-[#4f8cff] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          <div className="space-y-2">
            {displayList.map(entry => {
              if (!entry.songs) return null
              const inSetlist = activeSetlist.includes(entry.songs.id)
              const cat = CAT_CONFIG[entry.category] || CAT_CONFIG['Sung']

              return (
                <SongRow
                  key={entry.id}
                  title={entry.songs.title}
                  artist={entry.songs.artist}
                  indexLabel={<span className="text-base">{cat.icon}</span>}
                  isSuggestion={entry.category === 'Suggested'}
                  suggestedBy={entry.suggested_by_username}
                  onReject={isOwner && entry.category === 'Suggested' ? () => handleReject(entry.id) : null}
                  actions={
                    <>
                      {isOwner ? (
                        <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                          <button
                            onClick={() => handleToggleSetlist(entry.songs.id)}
                            className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                              inSetlist
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            {inSetlist ? '− Set' : '+ Set'}
                          </button>
                          <div className="flex gap-1">
                            {entry.category !== 'Fave' && (
                              <button onClick={() => handleUpdateCategory(entry.id, 'Fave')} className="bg-white/[0.04] text-amber-400 hover:bg-amber-500/10 border border-white/[0.07] px-2.5 py-2 rounded-xl text-[10px] transition-all">🌟</button>
                            )}
                            {entry.category !== 'To Sing' && (
                              <button onClick={() => handleUpdateCategory(entry.id, 'To Sing')} className="bg-white/[0.04] text-[#4f8cff] hover:bg-[#4f8cff]/10 border border-white/[0.07] px-2.5 py-2 rounded-xl text-[10px] transition-all">🎤</button>
                            )}
                            {entry.category !== 'Sung' && (
                              <button onClick={() => handleUpdateCategory(entry.id, 'Sung')} className="bg-white/[0.04] text-white/40 hover:bg-white/[0.06] border border-white/[0.07] px-2.5 py-2 rounded-xl text-[10px] transition-all">🕒</button>
                            )}
                            <button onClick={() => handleDeleteSong(entry.id)} className="bg-white/[0.04] text-red-400 hover:bg-red-500/10 border border-white/[0.07] px-2.5 py-2 rounded-xl text-[10px] transition-all">✕</button>
                          </div>
                        </div>
                      ) : canSuggest ? (
                        <button
                          onClick={() => handleSuggestSong(entry.songs.id, entry.songs.title)}
                          className="bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4f8cff]/20 transition-all"
                        >
                          Suggest
                        </button>
                      ) : null}
                    </>
                  }
                />
              )
            })}
            {displayList.length === 0 && !loading && (
              <div className="text-center py-6">
                <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
                  {searchQuery.length >= 2 ? 'No songs match your search' : 'Vault is empty'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
