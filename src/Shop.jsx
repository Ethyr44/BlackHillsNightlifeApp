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
    const { data, error } = await supabase.from('shop_items').select('*').order('cost_lp', { ascending: true })
    if (data) setItems(data)
    setLoading(false)
  }

  // User Balances
  const balLp = currentUser?.lifestyle_points || 0
  const balIron = currentUser?.cur_iron || 0
  const balWood = currentUser?.cur_wood || 0
  const balStone = currentUser?.cur_stone || 0

  const checkAffordability = (item) => {
      const hasLp = item.cost_lp > 0 && balLp >= item.cost_lp
      const hasIron = item.cost_iron > 0 && balIron >= item.cost_iron
      const hasWood = item.cost_wood > 0 && balWood >= item.cost_wood
      const hasStone = item.cost_stone > 0 && balStone >= item.cost_stone
      
      const requiresMats = item.cost_iron > 0 || item.cost_wood > 0 || item.cost_stone > 0
      const hasAllMats = (!item.cost_iron || hasIron) && (!item.cost_wood || hasWood) && (!item.cost_stone || hasStone)

      if (item.payment_logic === 'AND') {
          return (!item.cost_lp || hasLp) && (!requiresMats || hasAllMats)
      } else {
          // OR logic: They can pay with LP *or* Mats *or* USD
          // (USD is handled through an external gateway, so we ignore it in balance checks for now)
          return hasLp || hasAllMats || item.cost_usd > 0
      }
  }

  const handlePurchase = (item) => {
    if (!checkAffordability(item)) {
        alert(`You don't have enough resources to unlock the ${item.name}! Keep hitting the circuit!`)
    } else {
        alert(`Purchase processing for ${item.name}. (Deduction logic will be wired next!)`)
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
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1 mb-6">
            Trade your Resources for real-world rewards
        </p>
        
        {/* User Inventory Display */}
        <div className="inline-flex flex-wrap justify-center gap-2 bg-black/50 border border-blue-500/30 rounded-2xl p-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <div className="bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-800 text-center">
                <span className="block text-[8px] text-blue-400 font-bold uppercase tracking-widest">LP</span>
                <span className="font-['Bebas_Neue'] text-xl text-white">{balLp}</span>
            </div>
            <div className="bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700 text-center">
                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Iron</span>
                <span className="font-['Bebas_Neue'] text-xl text-white">{balIron}</span>
            </div>
            <div className="bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-900/50 text-center">
                <span className="block text-[8px] text-amber-600 font-bold uppercase tracking-widest">Wood</span>
                <span className="font-['Bebas_Neue'] text-xl text-white">{balWood}</span>
            </div>
            <div className="bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 text-center">
                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest">Stone</span>
                <span className="font-['Bebas_Neue'] text-xl text-white">{balStone}</span>
            </div>
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
                const canAfford = checkAffordability(item)
                const theme = getThemeClasses(item.color_theme)
                
                return (
                    <div key={item.id} className={`bg-gradient-to-br ${theme.bg} border ${theme.border} rounded-3xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all hover:scale-[1.02]`}>
                        <div className="text-4xl mb-3 drop-shadow-xl">{item.icon}</div>
                        <h3 className="font-bold text-white text-sm mb-1 leading-tight">{item.name}</h3>
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-4">{item.item_type}</span>
                        
                        <div className="mt-auto w-full">
                            <div className="bg-black/80 rounded-xl py-2 px-1 mb-2 border border-white/10 flex flex-wrap justify-center gap-1 min-h-[40px] items-center">
                                {/* Dynamic Pricing Display */}
                                {item.cost_lp > 0 && <span className={`text-[10px] font-bold uppercase ${balLp >= item.cost_lp ? 'text-blue-400' : 'text-gray-600'}`}>{item.cost_lp} LP</span>}
                                {item.payment_logic === 'OR' && item.cost_lp > 0 && (item.cost_iron > 0 || item.cost_usd > 0) && <span className="text-[8px] text-gray-600">OR</span>}
                                {item.cost_iron > 0 && <span className={`text-[10px] font-bold uppercase ${balIron >= item.cost_iron ? 'text-gray-300' : 'text-gray-600'}`}>{item.cost_iron} FE</span>}
                                {item.cost_wood > 0 && <span className={`text-[10px] font-bold uppercase ${balWood >= item.cost_wood ? 'text-amber-500' : 'text-gray-600'}`}>{item.cost_wood} WD</span>}
                                {item.cost_stone > 0 && <span className={`text-[10px] font-bold uppercase ${balStone >= item.cost_stone ? 'text-slate-400' : 'text-gray-600'}`}>{item.cost_stone} ST</span>}
                                {item.payment_logic === 'OR' && item.cost_usd > 0 && (item.cost_lp > 0 || item.cost_iron > 0) && <span className="text-[8px] text-gray-600">OR</span>}
                                {item.cost_usd > 0 && <span className="text-[10px] text-green-400 font-bold uppercase">${item.cost_usd}</span>}
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