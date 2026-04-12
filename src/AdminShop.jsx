import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminShop() {
  const [shopItems, setShopItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [shopName, setShopName] = useState('')
  const [shopType, setShopType] = useState('Consumable')
  const [shopIcon, setShopIcon] = useState('🎁')
  const [shopColor, setShopColor] = useState('blue')
  const [paymentLogic, setPaymentLogic] = useState('OR')
  
  // Multi-Currency States
  const [costLp, setCostLp] = useState(0)
  const [costIron, setCostIron] = useState(0)
  const [costWood, setCostWood] = useState(0)
  const [costStone, setCostStone] = useState(0)
  const [costUsd, setCostUsd] = useState(0)
  
  const [editingShopId, setEditingShopId] = useState(null)

  useEffect(() => {
    fetchShopItems()
  }, [])

  const fetchShopItems = async () => {
    const { data } = await supabase.from('shop_items').select('*').order('cost_lp', { ascending: true })
    if (data) setShopItems(data)
  }

  const saveShopItem = async () => {
    if (!shopName) return alert('Name is required')
    setLoading(true)
    
    const payload = { 
        name: shopName, 
        item_type: shopType, 
        icon: shopIcon, 
        color_theme: shopColor,
        payment_logic: paymentLogic,
        cost_lp: parseInt(costLp) || 0,
        cost_iron: parseInt(costIron) || 0,
        cost_wood: parseInt(costWood) || 0,
        cost_stone: parseInt(costStone) || 0,
        cost_usd: parseFloat(costUsd) || 0.00
    }

    if (editingShopId) await supabase.from('shop_items').update(payload).eq('id', editingShopId)
    else await supabase.from('shop_items').insert([payload])
    
    resetForm(); fetchShopItems(); setLoading(false);
  }

  const resetForm = () => {
      setShopName(''); setShopType('Consumable'); setShopIcon('🎁'); setShopColor('blue'); setPaymentLogic('OR');
      setCostLp(0); setCostIron(0); setCostWood(0); setCostStone(0); setCostUsd(0);
      setEditingShopId(null);
  }

  const editShopItem = (item) => {
      setEditingShopId(item.id); setShopName(item.name); setShopType(item.item_type); 
      setShopIcon(item.icon); setShopColor(item.color_theme || 'blue'); setPaymentLogic(item.payment_logic || 'OR');
      setCostLp(item.cost_lp || 0); setCostIron(item.cost_iron || 0); setCostWood(item.cost_wood || 0); 
      setCostStone(item.cost_stone || 0); setCostUsd(item.cost_usd || 0);
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
          <input type="text" placeholder="Item Name" value={shopName} onChange={e => setShopName(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={shopType} onChange={e => setShopType(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="Consumable">Consumable (Food/Drink)</option>
            <option value="Discount">Discount (% Off)</option>
            <option value="Merch">Merchandise</option>
            <option value="Item">Item</option>
            <option value="Resource">Resource</option>
            <option value="General">General</option>
            <option value="Special">Special</option>
          </select>
          <input type="text" placeholder="Emoji Icon (e.g. 🍹)" value={shopIcon} onChange={e => setShopIcon(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={shopColor} onChange={e => setShopColor(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="blue">Color Theme: Neon Blue</option>
            <option value="pink">Color Theme: Cyber Pink</option>
            <option value="orange">Color Theme: Sunset Orange</option>
            <option value="green">Color Theme: Matrix Green</option>
            <option value="purple">Color Theme: Royal Purple</option>
            <option value="cyan">Color Theme: Electric Cyan</option>
          </select>
        </div>

        {/* Multi-Currency Pricing Block */}
        <div className="bg-black/40 border border-gray-800 p-4 rounded-xl mb-6">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-white font-bold text-sm">Pricing Matrix</h4>
                <select value={paymentLogic} onChange={e => setPaymentLogic(e.target.value)} className="bg-gray-800 border border-gray-600 text-white rounded p-1 text-xs font-bold uppercase">
                    <option value="OR">Pay with ANY (OR)</option>
                    <option value="AND">Pay with ALL (AND)</option>
                </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">LP</label>
                    <input type="number" min="0" value={costLp} onChange={e => setCostLp(e.target.value)} className="w-full bg-black border border-blue-900/50 text-blue-400 font-bold rounded p-2 text-sm text-center" />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Iron</label>
                    <input type="number" min="0" value={costIron} onChange={e => setCostIron(e.target.value)} className="w-full bg-black border border-gray-700 text-gray-300 font-bold rounded p-2 text-sm text-center" />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Wood</label>
                    <input type="number" min="0" value={costWood} onChange={e => setCostWood(e.target.value)} className="w-full bg-black border border-amber-900/50 text-amber-600 font-bold rounded p-2 text-sm text-center" />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Stone</label>
                    <input type="number" min="0" value={costStone} onChange={e => setCostStone(e.target.value)} className="w-full bg-black border border-slate-700 text-slate-400 font-bold rounded p-2 text-sm text-center" />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">USD ($)</label>
                    <input type="number" min="0" step="0.01" value={costUsd} onChange={e => setCostUsd(e.target.value)} className="w-full bg-black border border-green-900/50 text-green-400 font-bold rounded p-2 text-sm text-center" />
                </div>
            </div>
        </div>

        <div className="flex gap-2">
          <button onClick={saveShopItem} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded uppercase tracking-widest text-xs transition-colors shadow-lg">{editingShopId ? 'Update Item' : 'Add to Shop'}</button>
          {editingShopId && <button onClick={resetForm} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded uppercase tracking-widest text-xs transition-colors">Cancel</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">{item.icon}</div>
              <div>
                <h4 className="font-bold text-white text-lg">{item.name}</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                    {item.cost_lp > 0 && <span className="bg-blue-900/30 text-blue-400 border border-blue-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{item.cost_lp} LP</span>}
                    {item.cost_iron > 0 && <span className="bg-gray-800 text-gray-300 border border-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{item.cost_iron} Iron</span>}
                    {item.cost_wood > 0 && <span className="bg-amber-900/20 text-amber-600 border border-amber-900/50 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{item.cost_wood} Wood</span>}
                    {item.cost_stone > 0 && <span className="bg-slate-800/50 text-slate-400 border border-slate-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{item.cost_stone} Stone</span>}
                    {item.cost_usd > 0 && <span className="bg-green-900/20 text-green-400 border border-green-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">${item.cost_usd}</span>}
                </div>
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