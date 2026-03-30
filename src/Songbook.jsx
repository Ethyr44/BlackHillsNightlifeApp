import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function SongBook({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [savedStatus, setSavedStatus] = useState(null)

  // Auto-Search the global KaraFun catalog (400ms Debounce)
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      // Searches both Title and Artist columns in the songs table
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

  const handleSaveToVault = async (songId, title) => {
    const { error } = await supabase
      .from('user_songs')
      .insert([{ user_id: currentUser.id, song_id: songId, category: 'To Sing' }])
      
    if (!error) {
      setSavedStatus(`Added "${title}" to your Vault!`)
      setTimeout(() => setSavedStatus(null), 3000)
    } else {
      // Prevent duplicate errors if they already have it
      if (error.code === '23505') setSavedStatus(`"${title}" is already in your Vault.`)
      else setSavedStatus('Error saving song.')
      setTimeout(() => setSavedStatus(null), 3000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      <div className="text-center mb-6">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">Song Book</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs mt-2">Global Karaoke Catalog</p>
      </div>

      {savedStatus && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.5)] font-bold text-xs uppercase tracking-widest whitespace-nowrap animate-bounce">
          {savedStatus}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative">
        <div className="relative mb-6">
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Search by artist or song title..." 
            className="w-full bg-black border-2 border-gray-700 text-white rounded-xl py-4 px-5 focus:border-blue-500 outline-none transition-colors text-lg font-bold"
          />
          {loading && <span className="absolute right-5 top-4 text-xs text-blue-500 font-bold uppercase tracking-widest animate-pulse mt-1">Searching...</span>}
        </div>

        <div className="space-y-3">
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
            <div key={song.Id} className="bg-black p-4 rounded-xl border border-gray-800 flex justify-between items-center hover:border-gray-600 transition-colors">
              <div className="truncate pr-4">
                <p className="text-white font-bold text-lg leading-tight">{song.Title}</p>
                <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">{song.Artist} • {song.Year}</p>
              </div>
              <button 
                onClick={() => handleSaveToVault(song.Id, song.Title)} 
                className="bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shrink-0 transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              >
                + Vault
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}