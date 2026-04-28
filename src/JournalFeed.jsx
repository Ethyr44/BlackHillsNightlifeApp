import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAppConfig } from './useAppConfig'

export default function JournalFeed({ currentUser }) {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const config = useAppConfig()

  useEffect(() => {
     fetchJournal()
     const sub = supabase.channel('journal-channel')
        .on('postgres', { event: 'INSERT', schema: 'public', table: 'journal' }, payload => {
            // Only add if we didn't already optimistically add it
            setEntries(prev => {
                if (prev.find(e => e.content === payload.new.content && e.user_id === payload.new.user_id)) return prev
                return [payload.new, ...prev]
            })
        }).subscribe()

     return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
      const interval = setInterval(() => {
         const tenMinsAgo = new Date(Date.now() - 10 * 60000)
         setEntries(prev => prev.filter(e => new Date(e.created_at) > tenMinsAgo))
      }, 60000)
      return () => clearInterval(interval)
  }, [])

  async function fetchJournal() {
     const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString()
     const { data } = await supabase.from('journal').select('*').gte('created_at', tenMinsAgo).order('created_at', { ascending: false }).limit(50)
     if (data) setEntries(data)
     setLoading(false)
  }

  const handleSubmit = async (e) => {
     e.preventDefault()
     if (!text.trim() || text.length > 77) return
     
     const newText = text.trim()
     setText('') 
     
     // 🟢 OPTIMISTIC UPDATE: Instantly show the message on screen
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
    <div className="w-full flex flex-col animate-fade-in bg-[#050505]">
        
        {/* 🟢 HEADER: Now dynamically powered by Supabase! */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-black/40 shrink-0">
            {config.journal_title_visible !== false ? (
                <h2 className="text-xl font-['Bebas_Neue'] text-white tracking-wider">
                    {config.journal_title || 'The Void'}
                </h2>
            ) : <div></div> /* Empty div keeps flexbox balanced if title is hidden */}
            
            {config.journal_subtitle_visible !== false && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 bg-blue-900/30 px-2 py-1 rounded-full border border-blue-500/30">
                    {config.journal_subtitle || 'Global • 10 Min Wipe'}
                </span>
            )}
        </div>

        <div className="flex-1 bg-[#090812] border-2 border-gray-800 rounded-t-3xl p-4 overflow-y-auto flex flex-col-reverse hide-scrollbar shadow-inner">
            {loading ? <div className="text-center text-gray-500 text-xs py-10">Decrypting local frequencies...</div> : (
                entries.length === 0 ? <div className="text-center text-gray-600 text-xs py-10 uppercase tracking-widest font-bold">No active transmissions.</div> :
                entries.map((entry, index) => {
                    const isMine = entry.user_id === currentUser?.id
                    const prevEntry = entries[index + 1]
                    const isSameAsPrev = prevEntry && prevEntry.user_id === entry.user_id

                    return (
                        <div key={entry.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} ${isSameAsPrev ? 'mb-1' : 'mb-4'}`}>
                            <div className={`max-w-[75%] p-3 rounded-2xl ${
                                isMine 
                                ? 'bg-blue-600 text-white rounded-br-sm shadow-[0_5px_15px_rgba(59,130,246,0.3)]' 
                                : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                            }`}>
                                <p className="text-sm break-words leading-snug">{entry.content}</p>
                                <div className={`text-[8px] mt-1.5 font-bold uppercase tracking-widest ${isMine ? 'text-blue-200 text-right' : 'text-gray-500 text-left'}`}>
                                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    )
                })
            )}
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 p-3 rounded-b-3xl border-2 border-t-0 border-gray-800 flex flex-col gap-2">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    maxLength={77}
                    placeholder="Broadcast anonymously (10 min expiry)..."
                    className="flex-1 bg-black border border-gray-700 text-white rounded-full px-5 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
                <button type="submit" disabled={!text.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                    <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
            <div className="px-4 flex justify-between">
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">End-to-End Anonymous</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${text.length === 77 ? 'text-red-500' : 'text-gray-600'}`}>{77 - text.length} / 77</span>
            </div>
        </form>
    </div>
  )
}