import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminTicker() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => { fetchMessages() }, [])

  const fetchMessages = async () => {
    const { data } = await supabase.from('ticker_messages').select('*').order('sort_order', { ascending: true })
    if (data) setMessages(data)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newMessage) return
    await supabase.from('ticker_messages').insert([{ message: newMessage }])
    setNewMessage('')
    fetchMessages()
  }

  const toggleActive = async (id, currentStatus) => {
    await supabase.from('ticker_messages').update({ is_active: !currentStatus }).eq('id', id)
    fetchMessages()
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this message?")) return
    await supabase.from('ticker_messages').delete().eq('id', id)
    fetchMessages()
  }

  // --- TICKER DRAG AND DROP ---
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', index);
  };

  const handleDrop = async (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('dragIndex'));
    if (dragIndex === dropIndex) return; // Didn't move

    // Reorder locally first for instant UI response
    const newMessages = [...messages];
    const [draggedItem] = newMessages.splice(dragIndex, 1);
    newMessages.splice(dropIndex, 0, draggedItem);
    setMessages(newMessages);

    // Save the new sort_order to Supabase
    const updates = newMessages.map((msg, idx) => ({ id: msg.id, sort_order: idx }));
    for (const update of updates) {
      await supabase.from('ticker_messages').update({ sort_order: update.sort_order }).eq('id', update.id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-xl font-['Bebas_Neue'] text-[#00f5ff] tracking-widest mb-4">Live Ticker Broadcast</h3>
            
            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type a new broadcast message..." 
                    className="flex-1 bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-[#00f5ff] outline-none"
                    maxLength={100}
                />
                <button type="submit" className="bg-[#00f5ff] text-black px-6 rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-[#00d5dd]">Broadcast</button>
            </form>

            <div className="space-y-2">
                {messages.map((msg, index) => (
                    <div 
                        key={msg.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing ${msg.is_active ? 'bg-black/50 border-[#00f5ff]/30' : 'bg-black/20 border-gray-800 opacity-50'}`}
                    >
                        <div className="text-gray-500 mr-3 text-lg">☰</div>
                        <div className="flex-1 text-white text-sm mr-4">{msg.message}</div>
                        <div className="flex gap-2">
                            <button onClick={() => toggleActive(msg.id, msg.is_active)} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest ${msg.is_active ? 'bg-orange-900/30 text-orange-400' : 'bg-green-900/30 text-green-400'}`}>
                                {msg.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button onClick={() => handleDelete(msg.id)} className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest bg-red-900/30 text-red-400 hover:bg-red-900/50">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  )
}