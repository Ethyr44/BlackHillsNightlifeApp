import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Repertoire({ userId, isOwner, canSuggest, trigger, setTrigger }) {
  const [songs, setSongs] = useState([])
  const [activeSetlist, setActiveSetlist] = useState([]) 
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Tagging & Editing State
  const [taggingSongId, setTaggingSongId] = useState(null)
  const [editSongId, setEditSongId] = useState(null) 

  const fetchProfileSetlist = async () => {
    const { data } = await supabase.from('profiles').select('active_setlist').eq('id', userId).single()
    if (data && data.active_setlist) setActiveSetlist(data.active_setlist)
  }

  useEffect(() => {
    fetchSonglist()
    fetchProfileSetlist()

    // Updates from Setlist.jsx via parent trigger
  }, [userId, trigger])

  // Auto-Search (400ms Debounce)
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) {
        setSearchResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase.from('songs').select('*').or(`Title.ilike.%${q}%,Artist.ilike.%${q}%`).limit(20)
      if (!error && data) setSearchResults(data)
      setLoading(false)
    }, 400)
    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  // THE FIX: Bulletproof Fetch
  const fetchSonglist = async () => {
    const { data, error } = await supabase
      .from('user_songs')
      .select('*, songs("Id", "Title", "Artist")')
      .eq('user_id', userId)
      .order('id', { ascending: false }) // Sorts safely by internal ID instead of guessing the date column

    if (error) {
      console.error("Song Fetch Error:", error)
      alert("Error loading Vault: " + error.message)
    }
    
    if (data) setSongs(data)
  }

  // --- DATABASE ACTION HANDLERS ---
  const handleAddSongToBook = async (songId, categoryTag) => {
    const { error } = await supabase.from('user_songs').insert([{ user_id: userId, song_id: songId, category: categoryTag }])
    if (error) alert("Error adding song: " + error.message)
    else { setTaggingSongId(null); fetchSonglist() }
  }

  const handleUpdateCategory = async (recordId, newCategory) => {
    const { error } = await supabase.from('user_songs').update({ category: newCategory }).eq('id', recordId)
    if (!error) { fetchSonglist(); setEditSongId(null); }
  }

  const handleDeleteSong = async (recordId) => {
    if(!window.confirm("Remove this song from your book permanently?")) return
    const { error } = await supabase.from('user_songs').delete().eq('id', recordId)
    if (!error) fetchSonglist()
  }

  const toggleSetlist = async (songId) => {
    let newArray = []
    if (activeSetlist.includes(songId)) {
      newArray = activeSetlist.filter(id => id !== songId) // Remove it
    } else {
      if (activeSetlist.length >= 7) return alert("Setlist is full! Maximum of 7 songs allowed.")
      newArray = [...activeSetlist, songId] // Add it
    }
    
    const { error } = await supabase.from('profiles').update({ active_setlist: newArray }).eq('id', userId)
    if (!error) {
      setActiveSetlist(newArray)
      if (setTrigger) setTrigger(prev => prev + 1) // Tells Setlist.jsx to reload
    }
  }

  // Visual Engine for the Glow Effects
  const getGlowStyles = (category) => {
    switch(category) {
      case 'Fave': return 'border-yellow-500/50 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
      case 'To Sing': return 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
      case 'Requested': return 'border-pink-500/50 shadow-[0_0_15px_rgba(255,45,120,0.4)]'
      case 'Sung': return 'border-gray-800' 
      default: return 'border-gray-800'
    }
  }

  const getTagIcon = (category) => {
    switch(category) {
      case 'Fave': return '🌟'
      case 'To Sing': return '🎤'
      case 'Requested': return '💌'
      case 'Sung': return '🕒'
      default: return '🎵'
    }
  }

  return (
    <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg animate-fade-in pb-4">
      
      <div className="bg-black border-b border-gray-800 px-6 py-4">
        <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-wider flex items-center gap-2"><span>🎵</span> Song List</h3>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{isOwner ? 'Manage your repertoire' : 'Suggest a track'}</p>
      </div>

      <div className="p-6">
        
        {/* Search Bar */}
        {(isOwner || canSuggest) && (
          <div className="flex gap-2 relative mb-6">
            <input 
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
              placeholder={isOwner ? "Search catalog to add a song..." : "Search catalog to send a request..."} 
              className="flex-1 bg-black border border-gray-700 text-white rounded-lg py-3 px-4 focus:border-blue-500 outline-none text-sm"
            />
            {loading && <span className="absolute right-4 top-3 text-xs text-blue-500 font-bold uppercase tracking-widest animate-pulse">Searching...</span>}
          </div>
        )}

        {/* Live Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl space-y-2 max-h-80 overflow-y-auto custom-scrollbar mb-8">
            <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Catalog Results</h4>
            {searchResults.map(song => {
              const inSetlist = activeSetlist.includes(song.Id);
              return (
                <div key={song.Id} className="bg-black p-3 rounded border border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="truncate pr-4">
                      <p className="text-white font-bold leading-tight">{song.Title}</p>
                      <p className="text-gray-500 text-xs uppercase tracking-widest">{song.Artist}</p>
                    </div>
                    {isOwner ? (
                      <button onClick={() => setTaggingSongId(taggingSongId === song.Id ? null : song.Id)} className="bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white px-3 py-1 rounded text-xs font-bold shrink-0 transition-colors">
                        {taggingSongId === song.Id ? 'Cancel' : '+ Add'}
                      </button>
                    ) : (
                      <button onClick={() => handleAddSongToBook(song.Id, 'Requested')} className="bg-pink-600/20 text-pink-400 border border-pink-500/50 hover:bg-pink-600 hover:text-white px-3 py-1 rounded text-xs font-bold shrink-0 transition-colors">
                        Request
                      </button>
                    )}
                  </div>

                  {/* Inline Tagging Menu */}
                  {taggingSongId === song.Id && isOwner && (
                    <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2 animate-fade-in">
                      <button onClick={() => toggleSetlist(song.Id)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-colors ${inSetlist ? 'bg-red-900/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-black' : 'bg-green-900/20 text-green-400 border border-green-500/50 hover:bg-green-500 hover:text-black'}`}>
                        {inSetlist ? '✕ Remove Setlist' : '📋 Add Setlist'}
                      </button>
                      <button onClick={() => {handleAddSongToBook(song.Id, 'Fave'); setSearchQuery(''); setSearchResults([]);}} className="flex items-center gap-1 bg-yellow-900/20 text-yellow-500 border border-yellow-500/50 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors">🌟 Fave</button>
                      <button onClick={() => {handleAddSongToBook(song.Id, 'To Sing'); setSearchQuery(''); setSearchResults([]);}} className="flex items-center gap-1 bg-purple-900/20 text-purple-400 border border-purple-500/50 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-purple-500 hover:text-black transition-colors">🎤 To Sing</button>
                      <button onClick={() => {handleAddSongToBook(song.Id, 'Sung'); setSearchQuery(''); setSearchResults([]);}} className="flex items-center gap-1 bg-gray-800 text-gray-300 border border-gray-600 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-gray-600 transition-colors">🕒 Sung</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* The Unified Song List */}
        <div className="space-y-4">
          {songs.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-4xl">🎵</span>
              <p className="text-gray-500 italic text-sm mt-4">The song list is currently empty.</p>
            </div>
          ) : (
            songs.map(entry => {
              const inSetlist = activeSetlist.includes(entry.song_id);
              
              // THE FIX: Account for Supabase returning an array OR an object for foreign keys
              const songData = Array.isArray(entry.songs) ? entry.songs[0] : entry.songs;
              
              return (
                <div key={entry.id} className={`flex flex-col bg-black rounded-xl border transition-all ${getGlowStyles(entry.category)}`}>
                  
                  {/* Song Display Row */}
                  <div className="flex justify-between items-center p-4">
                    <div className="truncate pr-4">
                      <div className="flex items-center gap-2">
                        {inSetlist && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded uppercase font-black tracking-widest">Setlist</span>}
                        <p className="text-white font-bold text-lg leading-tight truncate">{songData?.Title || "Unknown Track"}</p>
                      </div>
                      <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">{songData?.Artist || "Unknown Artist"}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0 pl-2">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xl" title={entry.category}>{getTagIcon(entry.category)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{entry.category}</span>
                      </div>
                      
                      {/* Owner Edit Button */}
                      {isOwner && (
                        <button 
                          onClick={() => setEditSongId(editSongId === entry.id ? null : entry.id)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 border border-gray-700 hover:border-blue-500 hover:text-blue-400 transition-colors text-gray-400 font-bold"
                        >
                          ⋮
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Edit Menu */}
                  {editSongId === entry.id && (
                    <div className="bg-gray-900 border-t border-gray-800 p-4 rounded-b-xl flex flex-wrap gap-2 animate-fade-in">
                      <button onClick={() => toggleSetlist(entry.song_id)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-colors w-full sm:w-auto justify-center ${inSetlist ? 'bg-red-900/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-black' : 'bg-green-900/20 text-green-400 border border-green-500/50 hover:bg-green-500 hover:text-black'}`}>
                        {inSetlist ? '✕ Remove from Setlist' : '📋 Add to Setlist'}
                      </button>
                      
                      <div className="w-full h-px bg-gray-800 my-1 sm:hidden"></div>

                      <button onClick={() => handleUpdateCategory(entry.id, 'Fave')} className="flex-1 flex justify-center items-center gap-1 bg-yellow-900/20 text-yellow-500 border border-yellow-500/50 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors">🌟 Fave</button>
                      <button onClick={() => handleUpdateCategory(entry.id, 'To Sing')} className="flex-1 flex justify-center items-center gap-1 bg-purple-900/20 text-purple-400 border border-purple-500/50 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500 hover:text-black transition-colors">🎤 To Sing</button>
                      <button onClick={() => handleUpdateCategory(entry.id, 'Sung')} className="flex-1 flex justify-center items-center gap-1 bg-gray-800 text-gray-300 border border-gray-600 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-gray-600 transition-colors">🕒 Sung</button>
                      
                      <button onClick={() => handleDeleteSong(entry.id)} className="w-full sm:w-auto flex justify-center items-center gap-1 bg-red-900/20 text-red-500 border border-red-900 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-red-900 hover:text-white transition-colors mt-2 sm:mt-0 sm:ml-auto">
                        🗑️ Delete
                      </button>
                    </div>
                  )}

                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}