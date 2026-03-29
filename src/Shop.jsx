import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Shop({ currentUser }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShopItems()
  }, [])

  const fetchShopItems = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('shop_items').select('*').order('cost', { ascending: true })
    if (data) setItems(data)
    setLoading(false)
  }

  const userPoints = currentUser?.lifestyle_points || 0

  const handlePurchase = (item) => {
    if (userPoints < item.cost) {
        alert(`You need ${item.cost - userPoints} more points to unlock the ${item.name}! Keep hitting the circuit!`)
    } else {
        alert(`Purchase successful! Present this digital voucher to the bartender or host to claim your ${item.name}.`)
    }
  }

  const getThemeClasses = (color) => {
    const themes = {
        pink: { bg: 'from-pink-900/40 to-black', border: 'border-pink-500/50' },
        orange: { bg: 'from-orange-900/40 to-black', border: 'border-orange-500/50' },
        green: { bg: 'from-green-900/40 to-black', border: 'border-green-500/50' },
        blue: { bg: 'from-blue-900/40 to-black', border: 'border-blue-500/50' },
        purple: { bg: 'from-purple-900/40 to-black', border: 'border-purple-500/50' },
        cyan: { bg: 'from-cyan-900/40 to-black', border: 'border-cyan-500/50' }
    }
    return themes[color] || themes.blue
  }

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-32">
      
      <div className="text-center mb-8 pt-4">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]">
            THE VAULT
        </h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1 mb-4">
            Trade your Lifestyle Points for real-world rewards
        </p>
        
        <div className="inline-block bg-black/50 border border-blue-500/30 rounded-2xl px-6 py-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest block mb-1">Your Balance</span>
            <span className="text-3xl font-['Bebas_Neue'] text-green-400 tracking-widest">{userPoints} PTS</span>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : items.length === 0 ? (
          <div className="text-center p-10 bg-[#090812]/80 border-2 border-gray-800 rounded-3xl">
              <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">The vault is currently empty.</p>
          </div>
      ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map(item => {
                const canAfford = userPoints >= item.cost
                const theme = getThemeClasses(item.color_theme)

                return (
                    <div key={item.id} className={`bg-gradient-to-br ${theme.bg} border ${theme.border} rounded-3xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all hover:scale-[1.02]`}>
                        <div className="text-4xl mb-3 drop-shadow-xl">{item.icon}</div>
                        <h3 className="font-bold text-white text-sm mb-1 leading-tight">{item.name}</h3>
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-4">{item.item_type}</span>
                        
                        <div className="mt-auto w-full">
                            <div className="bg-black/60 rounded-xl py-2 mb-2 border border-white/10">
                                <span className={`text-sm font-['Bebas_Neue'] tracking-widest ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                                    {item.cost} PTS
                                </span>
                            </div>
                            <button 
                                onClick={() => handlePurchase(item)}
                                className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    canAfford ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-blue-500' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                                }`}
                            >
                                {canAfford ? 'Claim' : 'Locked'}
                            </button>
                        </div>
                    </div>
                )
            })}
          </div>
      )}
    </div>
  )
}