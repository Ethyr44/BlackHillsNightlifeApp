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

  const fetchJournal = async () => {
     const { data } = await supabase.from('journal').select('*').order('created_at', { ascending: false }).limit(50)
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
    <div className="animate-fade-in flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        <div className="flex-1 bg-[#090812] border-2 border-gray-800 rounded-t-3xl p-4 overflow-y-auto flex flex-col-reverse hide-scrollbar shadow-inner">
            {loading ? <div className="text-center text-gray-500 text-xs py-10">Decrypting journal...</div> : (
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
                    placeholder="Send an anonymous message..."
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