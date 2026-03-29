import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [newItem, setNewItem] = useState('')
  const [type, setType] = useState('genre')

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    const { data } = await supabase.from('system_categories').select('*').order('name')
    if (data) setCategories(data)
  }

  const handleAdd = async () => {
    if (!newItem.trim()) return
    await supabase.from('system_categories').insert([{ category_type: type, name: newItem }])
    setNewItem('')
    fetchCategories()
  }

  const handleDelete = async (id) => {
    await supabase.from('system_categories').delete().eq('id', id)
    fetchCategories()
  }

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 mb-6 tracking-wider">System Categories</h3>
            
            <div className="flex gap-2 mb-6">
                <select value={type} onChange={e => setType(e.target.value)} className="bg-black border border-gray-700 text-white rounded-lg p-3 text-sm font-bold uppercase tracking-widest">
                    <option value="genre">Music Genres</option>
                    <option value="venue">Venue Types</option>
                    <option value="event">Event Types</option>
                </select>
                <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={`Add new ${type}...`} className="flex-1 bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
                <button onClick={handleAdd} className="bg-blue-600 text-white px-6 font-bold uppercase tracking-widest rounded-lg hover:bg-blue-500">Add</button>
            </div>

            <div className="flex flex-wrap gap-2">
                {categories.filter(c => c.category_type === type).map(cat => (
                    <div key={cat.id} className="bg-black border border-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        {cat.name}
                        <button onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-400">✕</button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  )
}