import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAppConfig } from './useAppConfig'

export default function JournalFeed({ currentUser }) {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const config = useAppConfig()

  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000; // 48 Hours in milliseconds

  useEffect(() => {
     fetchJournal()
     const sub = supabase.channel('journal-channel')
        .on('postgres', { event: 'INSERT', schema: 'public', table: 'journal' }, payload => {
            setEntries(prev => {
                if (prev.find(e => e.content === payload.new.content && e.user_id === payload.new.user_id)) return prev
                return [payload.new, ...prev]
            })
        }).subscribe()

     return () => supabase.removeChannel(sub)
  }, [])

  // 🟢 THE FIX: 48 Hour Expiry Loop
  useEffect(() => {
      const interval = setInterval(() => {
         const cutoffTime = new Date(Date.now() - FORTY_EIGHT_HOURS)
         setEntries(prev => prev.filter(e => new Date(e.created_at) > cutoffTime))
      }, 60000)
      return () => clearInterval(interval)
  }, [])

  // 🟢 THE FIX: Fetch past 48 hours instead of 10 mins
  async function fetchJournal() {
     const cutoffTime = new Date(Date.now() - FORTY_EIGHT_HOURS).toISOString()
     const { data } = await supabase.from('journal').select('*').gte('created_at', cutoffTime).order('created_at', { ascending: false }).limit(100)
     if (data) setEntries(data)
     setLoading(false)
  }

  const handleSubmit = async (e) => {
     e.preventDefault()
     if (!text.trim() || text.length > 150) return // Bumped char limit slightly for 48h format
     
     const newText = text.trim()
     setText('') 
     
     const tempEntry = {
         id: 'temp-' + Date.now(),
         content: newText,
         user_id: currentUser?.id,
         created_at: new Date().toISOString()
     }
     setEntries(prev => [tempEntry, ...prev])

     await supabase.from('journal').insert([{ content: newText, user_id: currentUser?.id }])
  }

  return (
    // 🟢 THE FIX: Full Screen Height constraint!
    <div className="w-full flex flex-col animate-fade-in bg-[#050505] h-[calc(100vh-140px)] rounded-3xl overflow-hidden border border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 bg-black shrink-0">
            {config.journal_title_visible !== false && (
                <h2 className="text-2xl font-['Bebas_Neue'] text-white tracking-wider">
                    {config.journal_title || 'The Void'}
                </h2>
            )}
            
            {config.journal_subtitle_visible !== false && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 bg-blue-900/30 px-3 py-1 rounded-full border border-blue-500/30">
                    {config.journal_subtitle || 'Global • 48 Hour Wipe'}
                </span>
            )}
        </div>

        <div className="flex-1 bg-gradient-to-b from-[#090812] to-black p-4 overflow-y-auto flex flex-col-reverse hide-scrollbar shadow-inner relative">
            {loading ? <div className="text-center text-blue-500 text-xs py-10 uppercase tracking-widest font-bold animate-pulse">Decrypting local frequencies...</div> : (
                entries.length === 0 ? <div className="text-center text-gray-600 text-xs py-10 uppercase tracking-widest font-bold">No active transmissions in the last 48 hours.</div> :
                entries.map((entry, index) => {
                    const isMine = entry.user_id === currentUser?.id
                    const prevEntry = entries[index + 1]
                    const isSameAsPrev = prevEntry && prevEntry.user_id === entry.user_id

                    return (
                        <div key={entry.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} ${isSameAsPrev ? 'mb-1' : 'mb-4'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl ${
                                isMine 
                                ? 'bg-blue-600 text-white rounded-br-sm shadow-[0_5px_15px_rgba(59,130,246,0.2)]' 
                                : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                            }`}>
                                <p className="text-sm break-words leading-snug">{entry.content}</p>
                                <div className={`text-[8px] mt-1.5 font-bold uppercase tracking-widest ${isMine ? 'text-blue-200 text-right' : 'text-gray-500 text-left'}`}>
                                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(entry.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    )
                })
            )}
        </div>

        <form onSubmit={handleSubmit} className="bg-black p-3 border-t border-gray-800 flex flex-col gap-2 shrink-0 z-10">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    maxLength={150}
                    placeholder="Broadcast anonymously..."
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-5 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
                <button type="submit" disabled={!text.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                    <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
            <div className="px-1 flex justify-between">
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">End-to-End Anonymous</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${text.length === 150 ? 'text-red-500' : 'text-gray-600'}`}>{150 - text.length} / 150</span>
            </div>
        </form>
    </div>
  )
}