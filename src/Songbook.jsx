import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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
      
      // 🟢 THE FIX: Lowercase columns in the query
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
      if (error.code === '23505') alert("This song is already in your repertoire!")
      else alert("Error saving song.")
    } else {
      alert(`Added "${songTitle}" to your ${category} list!`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 animate-fade-in pb-32">
      <div className="bg-[#090812]/80 border border-blue-500/30 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)]">
          <h2 className="text-4xl font-['Bebas_Neue'] text-blue-400 tracking-wider mb-2">Karaoke Catalog</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-6">Search over 60,000 tracks</p>
          
          <div className="relative">
              <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Search by Artist or Song Title..." 
                  className="w-full bg-black/60 border border-gray-700 text-white rounded-xl py-4 px-5 pl-12 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
              <span className="absolute left-4 top-4 text-gray-500 text-lg">🔍</span>
          </div>
      </div>

      {loading && <div className="text-center text-blue-400 font-bold uppercase tracking-widest animate-pulse text-xs">Scanning Database...</div>}

      <div className="space-y-3">
          {results.map(song => (
              // 🟢 THE FIX: Lowercase properties to match the DB
              <div key={song.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-700 transition-colors">
                  <div>
                      <h4 className="font-bold text-white text-lg">{song.title}</h4>
                      <p className="text-gray-500 text-xs uppercase tracking-widest mt-1 truncate">{song.artist} • {song.year}</p>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'Fave')} className="flex-1 sm:flex-none bg-yellow-900/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500 hover:text-black py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                          🌟 Fave
                      </button>
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'To Sing')} className="flex-1 sm:flex-none bg-purple-900/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500 hover:text-black py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                          🎤 To Sing
                      </button>
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'Sung')} className="flex-1 sm:flex-none bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                          🕒 Sung
                      </button>
                  </div>
              </div>
          ))}
          {searchQuery.length >= 2 && results.length === 0 && !loading && (
              <p className="text-center text-gray-500 font-bold uppercase tracking-widest text-xs py-10">No tracks found.</p>
          )}
      </div>
    </div>
  )
}