import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SongRow from './SongRow'
import Setlist from './Setlist'
import Repertoire from './Repertoire'

export default function SongBook({ currentUser, profileUser, isOwnProfile = true, embedded = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [setlistTrigger, setSetlistTrigger] = useState(0)

  useEffect(() => {
    let isMounted = true
    const t = setTimeout(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) { if (isMounted) setResults([]); return }
      setLoading(true)
      const { data, error } = await supabase.from('songs').select('*').or(`title.ilike.%${q}%,artist.ilike.%${q}%`).limit(50)
      if (error) console.error('Search Error:', error)
      if (isMounted) { if (!error && data) setResults(data); setLoading(false) }
    }, 400)
    return () => { isMounted = false; clearTimeout(t) }
  }, [searchQuery])

  const handleSaveToVault = async (songId, songTitle, category) => {
    const { error } = await supabase.from('user_songs').insert([{ user_id: currentUser.id, song_id: songId, category }])
    if (error) {
      if (error.code === '23505') alert(`"${songTitle}" is already in your Repertoire!`)
      else alert('Error saving song.')
    } else {
      alert(`Added "${songTitle}" to your ${category}!`)
      setSetlistTrigger(prev => prev + 1)
    }
  }

  const handleSuggestSong = async (song) => {
    if (isOwnProfile) return
    if (!window.confirm(`Suggest "${song.title}" for ${profileUser.username} to sing?`)) return
    const { error } = await supabase.from('user_songs').insert({
      user_id: profileUser.id, song_id: song.id,
      suggested_by_id: currentUser.id, suggested_by_username: currentUser.username, category: 'Suggested'
    })
    if (error) {
      if (error.code === '23505') alert(`They already have "${song.title}" in their Repertoire!`)
      else alert('Error suggesting song: ' + error.message)
    } else {
      alert(`Awesome! You suggested ${song.title} to ${profileUser.username}.`)
      await supabase.from('notifications').insert([{
        user_id: profileUser.id, title: 'Song Suggestion', content: `${currentUser.username} suggested you sing "${song.title}"!`
      }])
    }
  }

  return (
    <div className={embedded ? '' : 'max-w-2xl mx-auto p-4 animate-fade-in pb-32 space-y-5'}>
      {!embedded && isOwnProfile && <Setlist session={{ user: currentUser }} isOwner={true} />}

      <div className={embedded ? '' : 'rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03]'}>
        {/* Header */}
        <div className={embedded ? 'mb-5' : 'px-5 pt-5 pb-4 border-b border-white/[0.06]'}>
          <h2 className={`font-bold tracking-widest text-center ${
            embedded
              ? 'text-xl text-emerald-400 mb-1'
              : 'text-2xl text-white mb-1'
          }`}>
            {embedded ? 'Suggest a Song' : 'Global Songbook'}
          </h2>
          {!embedded && (
            <p className="text-white/40 text-xs text-center">Search the full catalog</p>
          )}
        </div>

        {/* Search */}
        <div className={embedded ? '' : 'p-4'}>
          <div className="relative mb-4">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by title or artist..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none transition-colors placeholder:text-white/30"
            />
            {loading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#4f8cff] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-2">
            {results.map(song => (
              <SongRow
                key={song.id}
                title={song.title}
                artist={song.artist}
                actions={
                  isOwnProfile ? (
                    <>
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'Fave')} className="flex-1 sm:flex-none bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">🌟 Fave</button>
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'To Sing')} className="flex-1 sm:flex-none bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 hover:bg-[#4f8cff]/20 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">🎤 Queue</button>
                      <button onClick={() => handleSaveToVault(song.id, song.title, 'Sung')} className="flex-1 sm:flex-none bg-white/[0.04] text-white/50 border border-white/[0.08] hover:bg-white/[0.07] py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">🕒 Sung</button>
                    </>
                  ) : (
                    <button onClick={() => handleSuggestSong(song)} className="flex-1 sm:flex-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Suggest</button>
                  )
                }
              />
            ))}

            {searchQuery.length >= 2 && results.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg opacity-40">🎵</span>
                </div>
                <p className="text-white/30 text-xs font-medium uppercase tracking-widest">No songs found in the catalog</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {!embedded && isOwnProfile && (
        <Repertoire
          userId={currentUser.id} isOwner={true} canSuggest={false}
          currentUser={currentUser} profileUser={currentUser}
          trigger={setlistTrigger} setTrigger={setSetlistTrigger}
        />
      )}
    </div>
  )
}
