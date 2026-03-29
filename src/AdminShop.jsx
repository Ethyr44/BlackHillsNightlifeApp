import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminShop() {
  const [shopItems, setShopItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [shopName, setShopName] = useState('')
  const [shopType, setShopType] = useState('Consumable')
  const [shopCost, setShopCost] = useState(1000)
  const [shopIcon, setShopIcon] = useState('🎁')
  const [shopColor, setShopColor] = useState('blue')
  const [editingShopId, setEditingShopId] = useState(null)

  useEffect(() => {
    fetchShopItems()
  }, [])

  const fetchShopItems = async () => {
    const { data } = await supabase.from('shop_items').select('*').order('cost', { ascending: true })
    if (data) setShopItems(data)
  }

  const saveShopItem = async () => {
    if (!shopName) return alert('Name is required')
    setLoading(true)
    const payload = { name: shopName, item_type: shopType, cost: shopCost, icon: shopIcon, color_theme: shopColor }
    if (editingShopId) await supabase.from('shop_items').update(payload).eq('id', editingShopId)
    else await supabase.from('shop_items').insert([payload])
    
    setShopName(''); setShopType('Consumable'); setShopCost(1000); setShopIcon('🎁'); setShopColor('blue'); setEditingShopId(null);
    fetchShopItems(); setLoading(false);
  }

  const editShopItem = (item) => {
      setEditingShopId(item.id); setShopName(item.name); setShopType(item.item_type); setShopCost(item.cost); setShopIcon(item.icon); setShopColor(item.color_theme || 'blue');
  }

  const deleteShopItem = async (id) => {
      if(window.confirm('Delete this item from the shop?')) {
          await supabase.from('shop_items').delete().eq('id', id)
          fetchShopItems()
      }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 mb-4 tracking-wider">{editingShopId ? 'Edit Shop Item' : 'Create New Shop Item'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Item Name (e.g. Free Drink)" value={shopName} onChange={e => setShopName(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={shopType} onChange={e => setShopType(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="Consumable">Consumable (Food/Drink)</option>
            <option value="Discount">Discount (% Off)</option>
            <option value="Merch">Merchandise</option>
          </select>
          <input type="number" placeholder="Cost in Points" value={shopCost} onChange={e => setShopCost(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <input type="text" placeholder="Emoji Icon (e.g. 🍹)" value={shopIcon} onChange={e => setShopIcon(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={shopColor} onChange={e => setShopColor(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full md:col-span-2">
            <option value="blue">Color Theme: Neon Blue</option>
            <option value="pink">Color Theme: Cyber Pink</option>
            <option value="orange">Color Theme: Sunset Orange</option>
            <option value="green">Color Theme: Matrix Green</option>
            <option value="purple">Color Theme: Royal Purple</option>
            <option value="cyan">Color Theme: Electric Cyan</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={saveShopItem} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded uppercase tracking-widest text-xs transition-colors shadow-lg">{editingShopId ? 'Update Item' : 'Add to Shop'}</button>
          {editingShopId && <button onClick={() => {setEditingShopId(null); setShopName('');}} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded uppercase tracking-widest text-xs transition-colors">Cancel</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">{item.icon}</div>
              <div>
                <h4 className="font-bold text-white text-lg">{item.name}</h4>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{item.cost} PTS</span>
              </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => editShopItem(item)} className="flex-1 text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">Edit</button>
                <button onClick={() => deleteShopItem(item.id)} className="flex-1 text-gray-400 hover:text-white border border-gray-700 hover:border-red-500 hover:bg-red-900/20 px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}