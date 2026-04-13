import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'

export default function SongBook({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
        .limit(50)
      
      if (error) console.error("Search Error:", error)
      if (!error && data) setResults(data)
      setLoading(false)
    }, 400)
    
    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  const handleSaveToVault = async (songId, songTitle, category) => {
    const { error } = await supabase
      .from('user_songs')
      .insert([{ user_id: currentUser.id, song_id: songId, category: category }])
      
    if (error) {
      if (error.code === '23505') alert(`"${songTitle}" is already in your Repertoire!`)
      else alert("Error saving song.")
    } else {
      alert(`Added "${songTitle}" to your ${category}!`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-32">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider mb-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] text-center">
            Global Songbook
        </h2>

        {/* Search Bar */}
        <div className="relative mb-6">
            <input 
                type="text" 
                placeholder="Search by Title or Artist..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border-2 border-gray-800 text-white rounded-2xl py-4 px-6 focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-lg"
            />
            {loading && <div className="absolute right-4 top-4 w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
        </div>

        {/* Results Rendered using the Modular Component */}
        <div className="space-y-3">
          {results.map(song => (
              <SongRow 
                  key={song.id}
                  title={song.title}
                  artist={song.artist}
                  actions={
                      <>
                          <button onClick={() => handleSaveToVault(song.id, song.title, 'Fave')} className="flex-1 sm:flex-none bg-yellow-900/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500 hover:text-black py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                              🌟 Fave
                          </button>
                          <button onClick={() => handleSaveToVault(song.id, song.title, 'To Sing')} className="flex-1 sm:flex-none bg-purple-900/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500 hover:text-black py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                              🎤 To Sing
                          </button>
                          <button onClick={() => handleSaveToVault(song.id, song.title, 'Sung')} className="flex-1 sm:flex-none bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                              🕒 Sung
                          </button>
                      </>
                  }
              />
          ))}
          
          {searchQuery.length >= 2 && results.length === 0 && !loading && (
              <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl">
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No songs found in the catalog.</p>
              </div>
          )}
        </div>
    </div>
  )
}