import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function JournalFeed({ currentUser }) {
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
     fetchJournal()
     const sub = supabase.channel('journal-channel')
        .on('postgres', { event: 'INSERT', schema: 'public', table: 'journal' }, payload => {
            setEntries(prev => [payload.new, ...prev])
        }).subscribe()

     return () => supabase.removeChannel(sub)
  }, [])

  // Silent 60-second sweeper to remove expired messages from view
  useEffect(() => {
      const interval = setInterval(() => {
         const tenMinsAgo = new Date(Date.now() - 10 * 60000)
         setEntries(prev => prev.filter(e => new Date(e.created_at) > tenMinsAgo))
      }, 60000)
      return () => clearInterval(interval)
  }, [])

  async function fetchJournal() {
     // Only pull records from the last 10 minutes
     const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString()
     
     const { data } = await supabase
        .from('journal')
        .select('*')
        .gte('created_at', tenMinsAgo)
        .order('created_at', { ascending: false })
        .limit(50)
        
     if (data) setEntries(data)
     setLoading(false)
  }

  const handleSubmit = async (e) => {
     e.preventDefault()
     if (!text.trim() || text.length > 77) return
     const payload = { content: text.trim(), user_id: currentUser?.id }
     setText('') 
     await supabase.from('journal').insert([payload])
  }

  return (
    <div className="w-full relative animate-fade-in">
        
        {/* 🟢 BUBBLES CONTAINER: Floating OVER the Map Viewport */}
        {/* 'pointer-events-none' applied to ALL floating wrappers allows clicks to pass through to the Map */}
        <div className="absolute bottom-[100%] left-0 w-full h-[350px] flex flex-col justify-end pointer-events-none z-20 pb-2">
            <div className="w-full max-w-md mx-auto flex flex-col justify-end h-full pointer-events-none">
                
                {/* The Chat Window (Header text removed) */}
                <div className="px-4 overflow-hidden flex flex-col-reverse hide-scrollbar">
                    {loading ? <div className="text-center text-white drop-shadow-md text-xs py-10">Decrypting local frequencies...</div> : (
                        entries.length === 0 ? <div className="text-center text-white drop-shadow-[0_0_5px_rgba(0,0,0,1)] text-xs py-10 uppercase tracking-widest font-bold">No active transmissions.</div> :
                        entries.map((entry, index) => {
                            const isMine = entry.user_id === currentUser?.id
                            const prevEntry = entries[index + 1]
                            const isSameAsPrev = prevEntry && prevEntry.user_id === entry.user_id

                            return (
                                <div key={entry.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} ${isSameAsPrev ? 'mb-1' : 'mb-3'}`}>
                                    <div className={`max-w-[75%] p-3 rounded-2xl backdrop-blur-md shadow-[0_5px_15px_rgba(0,0,0,0.5)] ${
                                        isMine 
                                        ? 'bg-blue-600/90 text-white rounded-br-sm' 
                                        : 'bg-black/70 text-gray-200 rounded-bl-sm border border-gray-700/50'
                                    }`}>
                                        <p className="text-sm break-words leading-snug">{entry.content}</p>
                                        <div className={`text-[8px] mt-1.5 font-bold uppercase tracking-widest ${isMine ? 'text-blue-200 text-right' : 'text-gray-400 text-left'}`}>
                                            {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>

        {/* 🟢 INPUT CONTAINER: Sits statically beneath the map */}
        <form onSubmit={handleSubmit} className="px-4 py-3 flex flex-col gap-2 max-w-md mx-auto w-full">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    maxLength={77}
                    placeholder="Broadcast anonymously..."
                    className="flex-1 bg-black border border-gray-800 text-white rounded-full px-5 focus:outline-none focus:border-blue-500 text-sm shadow-inner"
                />
                <button type="submit" disabled={!text.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-900 disabled:text-gray-700 text-white w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
        </form>
        
    </div>
  )
}