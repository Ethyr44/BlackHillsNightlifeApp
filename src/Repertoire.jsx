import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'

export default function Repertoire({ userId, isOwner, canSuggest, currentUser, profileUser, trigger, setTrigger }) {
  const [songs, setSongs] = useState([])
  const [activeSetlist, setActiveSetlist] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false) // 🟢 Controls Dropdown

  const catIcons = { 'Fave': '🌟', 'To Sing': '🎤', 'Sung': '🕒' }

  const fetchSonglist = async () => {
    setLoading(true)
    const { data, error } = await supabase
        .from('user_songs')
        .select('*, songs(id, title, artist)')
        .eq('user_id', userId)
        .order('id', { ascending: false })
    if (data) setSongs(data)
    setLoading(false)
  }

  const fetchProfileSetlist = async () => {
    const { data } = await supabase.from('profiles').select('active_setlist').eq('id', userId).single()
    if (data && data.active_setlist) setActiveSetlist(data.active_setlist)
    else setActiveSetlist([])
  }

  useEffect(() => {
    fetchSonglist()
    fetchProfileSetlist()
  }, [userId, trigger])

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      const q = searchQuery.toLowerCase().trim()
      if (q.length < 2) {
        setSearchResults([])
        return
      }
      const filtered = songs.filter(entry =>
        entry.songs?.title?.toLowerCase().includes(q) ||
        entry.songs?.artist?.toLowerCase().includes(q)
      )
      setSearchResults(filtered)
    }, 300)
    return () => clearTimeout(searchTimeout)
  }, [searchQuery, songs])

  const handleUpdateCategory = async (entryId, newCat) => {
      await supabase.from('user_songs').update({ category: newCat }).eq('id', entryId)
      fetchSonglist()
  }

  const handleDeleteSong = async (entryId) => {
      if (window.confirm("Remove this song from your vault?")) {
          await supabase.from('user_songs').delete().eq('id', entryId)
          fetchSonglist()
      }
  }

  const handleToggleSetlist = async (songId) => {
      let newSetlist = [...activeSetlist]
      if (newSetlist.includes(songId)) {
          newSetlist = newSetlist.filter(id => id !== songId)
      } else {
          if (newSetlist.length >= 7) return alert("Setlist is full! (Max 7)")
          newSetlist.push(songId)
      }
      await supabase.from('profiles').update({ active_setlist: newSetlist }).eq('id', userId)
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
      if (!window.confirm("Reject this song suggestion?")) return;
      
      await supabase.from('user_songs').delete().eq('id', entryId);
      fetchSonglist();
  }

  const displayList = searchQuery.length >= 2 ? searchResults : songs

  return (
    <div className="bg-[#090812] border-2 border-blue-900/30 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 shadow-[0_0_30px_rgba(59,130,246,0.1)] mt-8">
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
            <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                {isOwner ? 'My Vault' : 'Their Vault'}
            </h3>
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-500/30">
                    {songs.length} Songs
                </span>
                <span className={`text-gray-500 text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </div>
        </div>

        {isExpanded && (
        <div className="mt-6 space-y-4 animate-fade-in">
        <input
            type="text"
            placeholder="Search the vault..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors text-sm"
        />

        {loading && <div className="text-blue-500 font-bold uppercase tracking-widest text-xs text-center py-4">Unlocking Vault...</div>}

        <div className="space-y-3">
          {displayList.map(entry => {
              if (!entry.songs) return null
              const inSetlist = activeSetlist.includes(entry.songs.id)

              return (
                  <SongRow
                      key={entry.id}
                      title={entry.songs.title}
                      artist={entry.songs.artist}
                      indexLabel={<span className="text-2xl">{catIcons[entry.category] || '🎵'}</span>}
                      isSuggestion={entry.category === 'Suggested'}
                      suggestedBy={entry.suggested_by_username}
                      onReject={isOwner && entry.category === 'Suggested' ? () => handleReject(entry.id) : null}
                      actions={
                          <>
                              {isOwner ? (
                                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                                      <button onClick={() => handleToggleSetlist(entry.songs.id)} className={`flex-1 px-3 py-2 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${inSetlist ? 'bg-red-900/20 text-red-400 border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-green-900/20 text-green-400 border-green-500/50 hover:bg-green-500 hover:text-black'}`}>
                                          {inSetlist ? 'Remove from Set' : 'Add to Set'}
                                      </button>
                                      
                                      <div className="flex gap-1">
                                          {entry.category !== 'Fave' && <button onClick={() => handleUpdateCategory(entry.id, 'Fave')} className="flex-1 bg-gray-800 text-gray-400 hover:text-yellow-400 px-3 py-2 rounded border border-gray-700 text-[10px] font-bold">🌟</button>}
                                          {entry.category !== 'To Sing' && <button onClick={() => handleUpdateCategory(entry.id, 'To Sing')} className="flex-1 bg-gray-800 text-gray-400 hover:text-purple-400 px-3 py-2 rounded border border-gray-700 text-[10px] font-bold">🎤</button>}
                                          {entry.category !== 'Sung' && <button onClick={() => handleUpdateCategory(entry.id, 'Sung')} className="flex-1 bg-gray-800 text-gray-400 hover:text-gray-200 px-3 py-2 rounded border border-gray-700 text-[10px] font-bold">🕒</button>}
                                          <button onClick={() => handleDeleteSong(entry.id)} className="flex-1 bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded border border-red-900 text-[10px] font-bold">✕</button>
                                      </div>
                                  </div>
                              ) : canSuggest ? (
                                  <button onClick={() => handleSuggestSong(entry.songs.id, entry.songs.title)} className="w-full bg-blue-900/20 text-blue-400 border border-blue-500/50 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 hover:text-black transition-colors">
                                      Suggest Song
                                  </button>
                              ) : null}
                          </>
                      }
                  />
              )
          })}
          {displayList.length === 0 && !loading && (
              <div className="text-center p-8 bg-black/40 border border-gray-800 rounded-2xl">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Vault is empty.</p>
              </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}