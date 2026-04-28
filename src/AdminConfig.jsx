import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminConfig() {
  const [configs, setConfigs] = useState([])
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => { fetchConfigs() }, [])

  const fetchConfigs = async () => {
    const { data } = await supabase.from('app_config').select('*').order('config_key')
    if (data) setConfigs(data)
  }

  const handleUpdate = async (key, newValue) => {
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

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-2 tracking-wider">App Text Manager</h3>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Uncheck the box to hide the text element entirely.</p>
            
            <div className="space-y-4">
                {configs.map(item => (
                    <div key={item.id} className={`bg-black border p-4 rounded-xl transition-all ${item.is_visible === false ? 'border-red-900/50 opacity-60' : 'border-gray-800'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <label className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">{item.config_key}</label>
                            <span className="text-gray-600 text-[9px] uppercase tracking-widest">{item.description}</span>
                        </div>
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
                                        handleUpdate(item.config_key, e.target.value)
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