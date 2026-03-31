import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Leaderboard() {
  const [users, setUsers] = useState([])
  const [timeframe, setTimeframe] = useState('weekly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      
      // Match the active tab to the exact column name in Supabase
      let column = 'league_all_time'
      if (timeframe === 'nightly') column = 'league_nightly'
      if (timeframe === 'weekly') column = 'league_weekly'
      if (timeframe === 'monthly') column = 'league_monthly'
      if (timeframe === 'yearly') column = 'league_yearly'
      if (timeframe === 'all_time') column = 'league_all_time'

      // THE FIX: Removed the 'Singer' restriction so ALL users are pulled
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order(column, { ascending: false, nullsFirst: false })
        .limit(100) // Bumped to 100 to ensure everyone fits
      
      if (!error && data) {
          const realUsers = data.map(u => ({
              user_id: u.id,
              username: u.username,
              account_type: u.account_type,
              profile_pic: u.profile_pic,
              period_points: u[column] || 0 // Default to 0 points so they still show up
          }))
          setUsers(realUsers)
      } else {
          setUsers([])
      }
      setLoading(false)
    }
    fetchLeaderboard()
  }, [timeframe])

  const tabs = [
    { id: 'nightly', label: 'Nightly' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'all_time', label: 'All-Time' }
  ]

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 space-y-6 animate-fade-in pb-32">
      <div className="text-center mb-8">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">KSocial Live!</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs mt-2">League Rankings</p>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 justify-center">
        {tabs.map(tab => (
          <button 
            key={tab.id} onClick={() => setTimeframe(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
              timeframe === tab.id 
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-105' 
                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-6">
        {loading ? (
           <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : users.length === 0 ? (
           <p className="text-center text-gray-500 text-sm font-bold tracking-widest uppercase mt-10">No users ranked yet.</p>
        ) : (
          users.map((user, index) => {
            const isTop3 = index < 3;
            const medalColors = ['text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]', 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.8)]', 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)]'];
            
            return (
              <div key={user.user_id} className={`bg-gray-900 border ${isTop3 ? 'border-blue-500/30' : 'border-gray-800'} rounded-xl p-4 flex items-center gap-4 shadow-lg transition-transform hover:scale-[1.02]`}>
                <div className={`font-['Bebas_Neue'] text-3xl w-8 text-center ${isTop3 ? medalColors[index] : 'text-gray-600'}`}>
                  {index + 1}
                </div>
                <img src={user.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`} alt="avatar" className={`w-12 h-12 rounded-full border-2 ${isTop3 ? 'border-blue-500' : 'border-gray-700'} object-cover bg-black`} />
                <div className="flex-1">
                  <h4 className="font-bold text-white text-lg leading-tight">{user.username}</h4>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">{user.account_type}</span>
                </div>
                <div className="text-right">
                  <span className="font-['Bebas_Neue'] text-3xl text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]">{user.period_points}</span>
                  <span className="block text-[10px] uppercase text-gray-500 font-bold tracking-widest">Pts</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}