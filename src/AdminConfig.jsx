import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminConfig() {
  // --- App Config State ---
  const [configs, setConfigs] = useState([])
  const [savingKey, setSavingKey] = useState(null)

  // --- Ticker State ---
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => { 
      fetchConfigs() 
      fetchMessages()
  }, [])

  // --- CONFIG LOGIC ---
  const fetchConfigs = async () => {
    const { data } = await supabase.from('app_config').select('*').order('config_key')
    if (data) setConfigs(data)
  }

  const handleUpdateConfig = async (key, newValue) => {
    setSavingKey(key)
    await supabase.from('app_config').update({ config_value: newValue }).eq('config_key', key)
    setTimeout(() => setSavingKey(null), 1000)
  }

  const handleVisibilityToggle = async (key, isVisible) => {
    setSavingKey(key)
    setConfigs(prev => prev.map(c => c.config_key === key ? { ...c, is_visible: isVisible } : c))
    await supabase.from('app_config').update({ is_visible: isVisible }).eq('config_key', key)
    setTimeout(() => setSavingKey(null), 1000)
  }

  // --- TICKER LOGIC ---
  const fetchMessages = async () => {
    const { data } = await supabase.from('ticker_messages').select('*').order('sort_order', { ascending: true })
    if (data) setMessages(data)
  }

  const handleAddTicker = async (e) => {
    e.preventDefault()
    if (!newMessage) return
    await supabase.from('ticker_messages').insert([{ message: newMessage }])
    setNewMessage('')
    fetchMessages()
  }

  const toggleTickerActive = async (id, currentStatus) => {
    await supabase.from('ticker_messages').update({ is_active: !currentStatus }).eq('id', id)
    fetchMessages()
  }

  const handleDeleteTicker = async (id) => {
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
    <div className="space-y-6 animate-fade-in pb-20">
        
        {/* SECTION 1: LIVE TICKER BROADCAST */}
        <div className="bg-gray-900 p-6 rounded-xl border border-[#00f5ff]/30 shadow-[0_0_15px_rgba(0,245,255,0.1)]">
            <h3 className="text-xl font-['Bebas_Neue'] text-[#00f5ff] tracking-widest mb-4">Live Ticker Broadcast</h3>
            
            <form onSubmit={handleAddTicker} className="flex gap-2 mb-6">
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

            <div className="space-y-2 max-h-[250px] overflow-y-auto hide-scrollbar">
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
                            <button onClick={() => toggleTickerActive(msg.id, msg.is_active)} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest ${msg.is_active ? 'bg-orange-900/30 text-orange-400' : 'bg-green-900/30 text-green-400'}`}>
                                {msg.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button onClick={() => handleDeleteTicker(msg.id)} className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest bg-red-900/30 text-red-400 hover:bg-red-900/50">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* SECTION 2: MASTER UI OVERRIDES */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-1">Master UI Overrides</h3>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Toggle visibility or rename core app components.</p>
            
            <div className="space-y-4">
                {configs.map(item => (
                    <div key={item.id} className="bg-black/50 p-4 rounded-xl border border-gray-800">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">{item.config_key.replace(/_/g, ' ')}</label>
                        <div className="flex gap-3 items-center">
                            <input 
                                type="checkbox"
                                checked={item.is_visible !== false}
                                onChange={(e) => handleVisibilityToggle(item.config_key, e.target.checked)}
                                className="w-6 h-6 accent-blue-500 cursor-pointer"
                                title="Toggle Visibility"
                            />
                            <input 
                                type="text" 
                                defaultValue={item.config_value} 
                                onBlur={(e) => {
                                    if (e.target.value !== item.config_value) {
                                        handleUpdateConfig(item.config_key, e.target.value)
                                    }
                                }}
                                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-blue-500 outline-none" 
                                disabled={item.is_visible === false}
                            />
                            <div className="w-16 flex items-center justify-center shrink-0">
                                {savingKey === item.config_key ? <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Saved</span> : null}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  )
}