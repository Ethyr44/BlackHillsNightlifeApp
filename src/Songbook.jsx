import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function SongBook({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [savedStatus, setSavedStatus] = useState(null)

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
        .or(`Title.ilike.%${q}%,Artist.ilike.%${q}%`)
        .limit(50)
      
      if (!error && data) setResults(data)
      setLoading(false)
    }, 400)
    
    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  // 🟢 NEW: Accepts category as a parameter!
  const handleSaveToVault = async (songId, title, category) => {
    const { error } = await supabase
      .from('user_songs')
      .insert([{ user_id: currentUser.id, song_id: songId, category: category }])
      
    if (error) {
      if (error.code === '23505') { 
        alert(`${title} is already in your Songlist!`)
      } else {
        alert(`Error saving song: ${error.message}`)
      }
    } else {
      setSavedStatus(`Added "${title}" to ${category}!`)
      setTimeout(() => setSavedStatus(null), 3000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      <div className="text-center mb-8">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">Global Catalog</h2>
        <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest font-bold">Search 60,000+ Tracks</p>
      </div>

      <div className="sticky top-[80px] z-40 bg-[#030712] pt-2 pb-4 border-b border-gray-800">
        <div className="relative">
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl">🔍</span>
          <input 
            type="text" 
            placeholder="Search by Artist or Title..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#090812] border-2 border-gray-800 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          {loading && <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
        </div>
      </div>

      {savedStatus && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.6)] z-50 font-bold uppercase tracking-widest text-xs animate-fade-in">
          {savedStatus}
        </div>
      )}

      <div className="space-y-3 mt-6">
          {results.length === 0 && searchQuery.length > 1 && !loading && (
            <p className="text-center text-gray-500 italic py-8">No tracks found. Try a different artist or title.</p>
          )}
          
          {results.length === 0 && searchQuery.length <= 1 && (
            <div className="text-center py-12 opacity-50">
               <span className="text-6xl block mb-4">🎤</span>
               <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Type to search thousands of tracks</p>
            </div>
          )}

          {results.map(song => (
            <div key={song.Id} className="bg-black p-4 rounded-xl border border-gray-800 flex flex-col gap-4 hover:border-gray-600 transition-colors">
              <div className="truncate">
                <p className="text-white font-bold text-lg leading-tight truncate">{song.Title}</p>
                <p className="text-gray-500 text-xs uppercase tracking-widest mt-1 truncate">{song.Artist} • {song.Year}</p>
              </div>
              
              {/* 🟢 NEW: 3-Button Layout for direct categorization */}
              <div className="flex gap-2 w-full">
                <button onClick={() => handleSaveToVault(song.Id, song.Title, 'Fave')} className="flex-1 bg-yellow-900/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500 hover:text-black py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                    🌟 Fave
                </button>
                <button onClick={() => handleSaveToVault(song.Id, song.Title, 'To Sing')} className="flex-1 bg-purple-900/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500 hover:text-black py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                    🎤 To Sing
                </button>
                <button onClick={() => handleSaveToVault(song.Id, song.Title, 'Sung')} className="flex-1 bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                    🕒 Sung
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}