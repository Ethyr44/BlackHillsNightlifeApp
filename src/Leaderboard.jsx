import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Leaderboard({ currentUser, onViewEntity }) {
  const [activeBoard, setActiveBoard] = useState('BHNL') // 'BHNL', 'KSocial', 'Trivia'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      
      let orderBy = activeBoard === 'BHNL' ? 'lifestyle_points' : 'league_monthly'
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order(orderBy, { ascending: false, nullsFirst: false })
        .limit(100)
      
      if (!error && data) {
          const realUsers = data.map(u => ({
              user_id: u.id,
              username: u.username,
              account_type: u.account_type,
              profile_pic: u.profile_pic,
              period_points: u[orderBy] || 0
          }))
          setUsers(realUsers)
      } else {
          setUsers([])
      }
      setLoading(false)
    }
    
    if (activeBoard !== 'Trivia') fetchLeaderboard()
    else { setUsers([]); setLoading(false); }
  }, [activeBoard])

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 space-y-6 animate-fade-in pb-32">
      <div className="text-center mb-8">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">LEAGUES</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs mt-2">Local Scene Rankings</p>
      </div>

      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-4">
        {['BHNL', 'KSocial', 'Trivia'].map(tab => (
            <button 
                key={tab} 
                onClick={() => setActiveBoard(tab)}
                disabled={tab === 'Trivia'}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    activeBoard === tab ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                    : tab === 'Trivia' ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500 hover:text-white'
                }`}
            >
                {tab} {tab === 'Trivia' && <span className="block text-[8px] text-gray-600">Coming Soon</span>}
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
            const isMe = currentUser?.id === user.user_id;
            const medalColors = ['text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]', 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.8)]', 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)]'];
            
            return (
              <div key={user.user_id} className={`bg-gray-900 border ${isMe ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-[1.02]' : isTop3 ? 'border-blue-500/30' : 'border-gray-800'} rounded-xl p-4 flex items-center gap-4 transition-transform`}>
                <div className={`font-['Bebas_Neue'] text-3xl w-8 text-center ${isTop3 ? medalColors[index] : 'text-gray-600'}`}>
                  {index + 1}
                </div>
                <img 
                  onClick={() => onViewEntity(user.username)} 
                  src={user.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`} 
                  alt="avatar" 
                  className={`w-12 h-12 rounded-full border-2 ${isMe ? 'border-yellow-400' : isTop3 ? 'border-blue-500' : 'border-gray-700'} object-cover bg-black cursor-pointer hover:border-blue-400 transition-colors`} 
                  referrerPolicy="no-referrer" 
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}` }} 
                />
                <div className="flex-1">
                  <h4 onClick={() => onViewEntity(user.username)} className={`font-bold text-lg leading-tight cursor-pointer transition-colors ${isMe ? 'text-yellow-400' : 'text-white hover:text-blue-400'}`}>
                      {user.username} {isMe && <span className="text-[10px] ml-1 text-yellow-500">(You)</span>}
                  </h4>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">{user.account_type}</span>
                </div>
                <div className="text-right">
                  <span className="font-['Bebas_Neue'] text-3xl text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]">{user.period_points}</span>
                  <span className="block text-[10px] uppercase text-gray-500 font-bold tracking-widest">{activeBoard === 'BHNL' ? 'L$' : 'Pts'}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}