import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

const THEME_CONFIG = {
  pink:   { glow: 'rgba(245,85,122,0.25)',  accent: '#f5557a', border: 'rgba(245,85,122,0.35)',  label: 'text-[#f5557a]' },
  orange: { glow: 'rgba(251,146,60,0.25)',  accent: '#fb923c', border: 'rgba(251,146,60,0.35)',  label: 'text-orange-400' },
  green:  { glow: 'rgba(52,211,153,0.25)',  accent: '#34d399', border: 'rgba(52,211,153,0.35)',  label: 'text-emerald-400' },
  blue:   { glow: 'rgba(79,140,255,0.25)',  accent: '#4f8cff', border: 'rgba(79,140,255,0.35)',  label: 'text-[#4f8cff]' },
  purple: { glow: 'rgba(168,85,247,0.25)',  accent: '#a855f7', border: 'rgba(168,85,247,0.35)',  label: 'text-purple-400' },
  cyan:   { glow: 'rgba(34,212,200,0.25)',  accent: '#22d4c8', border: 'rgba(34,212,200,0.35)',  label: 'text-[#22d4c8]' },
}

function BalancePill({ label, value, color }) {
  return (
    <div
      className="flex flex-col items-center px-4 py-2 rounded-xl border"
      style={{ borderColor: `${color}40`, background: `${color}12` }}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>{label}</span>
      <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-white leading-none">{value}</span>
    </div>
  )
}

function PriceBadge({ value, unit, canAfford, separator }) {
  return (
    <>
      {separator && <span className="text-[8px] text-white/30 font-bold">OR</span>}
      <span
        className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
        style={{
          color: canAfford ? '#fff' : 'rgba(255,255,255,0.25)',
          background: canAfford ? 'rgba(255,255,255,0.1)' : 'transparent',
        }}
      >
        {value} {unit}
      </span>
    </>
  )
}

export default function Shop({ currentUser }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState(null)

  useEffect(() => { fetchShopItems() }, [])

  const fetchShopItems = async () => {
    setLoading(true)
    const { data } = await supabase.from('shop_items').select('*').order('cost_lp', { ascending: true })
    if (data) setItems(data)
    setLoading(false)
  }

  const balLp    = currentUser?.lifestyle_points || 0
  const balIron  = currentUser?.cur_iron || 0
  const balWood  = currentUser?.cur_wood || 0
  const balStone = currentUser?.cur_stone || 0

  const checkAffordability = (item) => {
    const hasLp    = item.cost_lp    > 0 && balLp    >= item.cost_lp
    const hasIron  = item.cost_iron  > 0 && balIron  >= item.cost_iron
    const hasWood  = item.cost_wood  > 0 && balWood  >= item.cost_wood
    const hasStone = item.cost_stone > 0 && balStone >= item.cost_stone

    const requiresMats = item.cost_iron > 0 || item.cost_wood > 0 || item.cost_stone > 0
    const hasAllMats = (!item.cost_iron || hasIron) && (!item.cost_wood || hasWood) && (!item.cost_stone || hasStone)

    if (item.payment_logic === 'AND') {
      return (!item.cost_lp || hasLp) && (!requiresMats || hasAllMats)
    }
    return hasLp || hasAllMats || item.cost_usd > 0
  }

  const handlePurchase = async (item) => {
    setPurchasingId(item.id)
    const { error } = await supabase.rpc('purchase_shop_item', {
      p_user_id: currentUser.id,
      p_item_id: item.id,
    })
    if (error) toast.error(error.message)
    else toast.success(`${item.name} purchased!`)
    setPurchasingId(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-32 animate-[fadeIn_0.3s_ease-out]">

      {/* Header */}
      <div className="text-center mb-8">
        <h2
          className="font-['Plus_Jakarta_Sans'] font-extrabold text-4xl tracking-tight text-white mb-1"
          style={{ textShadow: '0 0 30px rgba(79,140,255,0.45)' }}
        >
          The Vault
        </h2>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Trade your resources for real-world rewards
        </p>
      </div>

      {/* Balance Bar */}
      <div
        className="flex flex-wrap justify-center gap-2 mb-8 p-3 rounded-2xl border"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderColor: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <BalancePill label="LP"    value={balLp}    color="#4f8cff" />
        <BalancePill label="Iron"  value={balIron}  color="#94a3b8" />
        <BalancePill label="Wood"  value={balWood}  color="#fb923c" />
        <BalancePill label="Stone" value={balStone} color="#a8a29e" />
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(79,140,255,0.4)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl border"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="text-4xl mb-3 opacity-40">🏛️</div>
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            The vault is currently empty.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map(item => {
            const canAfford = checkAffordability(item)
            const theme = THEME_CONFIG[item.color_theme] || THEME_CONFIG.blue
            const isPurchasing = purchasingId === item.id

            return (
              <div
                key={item.id}
                className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme.border}`,
                  boxShadow: canAfford ? `0 0 20px ${theme.glow}` : 'none',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }}
                />

                <div className="p-4 flex flex-col items-center text-center flex-1">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-3 shadow-lg"
                    style={{ background: `${theme.accent}18`, border: `1px solid ${theme.border}` }}
                  >
                    {item.icon}
                  </div>

                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-white text-sm leading-tight mb-1">
                    {item.name}
                  </h3>
                  <span className={`text-[9px] font-bold uppercase tracking-widest mb-3 ${theme.label}`}>
                    {item.item_type}
                  </span>

                  {/* Pricing */}
                  <div
                    className="w-full rounded-xl py-2 px-2 mb-3 flex flex-wrap justify-center items-center gap-1 min-h-[36px]"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {item.cost_lp > 0 && (
                      <PriceBadge value={item.cost_lp} unit="LP" canAfford={balLp >= item.cost_lp} />
                    )}
                    {item.payment_logic === 'OR' && item.cost_lp > 0 && (item.cost_iron > 0 || item.cost_usd > 0) && (
                      <span className="text-[8px] text-white/25 font-bold">OR</span>
                    )}
                    {item.cost_iron > 0 && (
                      <PriceBadge value={item.cost_iron} unit="FE" canAfford={balIron >= item.cost_iron} />
                    )}
                    {item.cost_wood > 0 && (
                      <PriceBadge value={item.cost_wood} unit="WD" canAfford={balWood >= item.cost_wood} />
                    )}
                    {item.cost_stone > 0 && (
                      <PriceBadge value={item.cost_stone} unit="ST" canAfford={balStone >= item.cost_stone} />
                    )}
                    {item.payment_logic === 'OR' && item.cost_usd > 0 && (item.cost_lp > 0 || item.cost_iron > 0) && (
                      <span className="text-[8px] text-white/25 font-bold">OR</span>
                    )}
                    {item.cost_usd > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                        ${item.cost_usd}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handlePurchase(item)}
                    disabled={!canAfford || isPurchasing}
                    className="w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 mt-auto"
                    style={
                      canAfford
                        ? {
                            background: `linear-gradient(135deg, ${theme.accent}cc, ${theme.accent}88)`,
                            color: '#fff',
                            boxShadow: `0 4px 14px ${theme.glow}`,
                          }
                        : {
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.2)',
                            cursor: 'not-allowed',
                          }
                    }
                  >
                    {isPurchasing ? (
                      <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    ) : canAfford ? (
                      'Claim'
                    ) : (
                      'Locked'
                    )}
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
